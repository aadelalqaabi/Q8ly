const FlashPoll = require('../models/FlashPoll');
const Hachi = require('../models/Hachi');
const { computeConfidence, bypassesGeofence } = require('../utils/locationUtils');

const ALLOWED_DURATIONS_MIN = new Set([15, 30, 60]);
const DEFAULT_DURATION_MIN = 15;

// Reject if the user is not physically inside the venue (founder bypasses).
async function requireInside(req, res) {
  const room = await Hachi.findById(req.params.id || req.body.circleId)
    .select('isVenueCircle venueCoords venueRadius')
    .lean();
  if (!room) {
    res.status(404).json({ success: false, message: 'Circle not found' });
    return null;
  }
  if (!room.isVenueCircle || !room.venueCoords?.lat) return room; // free circle
  if (bypassesGeofence(req.user)) return room;

  const lat = parseFloat(req.body.lat ?? req.query.lat);
  const lng = parseFloat(req.body.lng ?? req.query.lng);
  const speed = parseFloat(req.body.speed ?? req.query.speed) || 0;
  if (isNaN(lat) || isNaN(lng)) {
    res.status(403).json({ success: false, message: 'Location required' });
    return null;
  }
  const confidence = computeConfidence(lat, lng, speed, room.venueCoords, room.venueRadius || 250);
  if (confidence < 0.6) {
    res.status(403).json({ success: false, message: 'Must be physically inside the circle' });
    return null;
  }
  return room;
}

// Public shape — no per-user state. Used for socket broadcasts.
// Each client merges its own `mine` flag locally from the previous state.
function shapePollPublic(poll) {
  let total = 0;
  const options = poll.options.map((o) => {
    const count = (o.voters || []).length;
    total += count;
    return { _id: String(o._id), text: o.text, count };
  });
  return {
    _id: String(poll._id),
    question: poll.question,
    options,
    totalVotes: total,
    expiresAt: poll.expiresAt,
    remainingMs: Math.max(0, new Date(poll.expiresAt).getTime() - Date.now()),
    creator: String(poll.creator),
    createdAt: poll.createdAt,
  };
}

// Per-user shape — adds `mine` for each option. Used for HTTP responses.
function shapePoll(poll, userId) {
  const me = userId ? String(userId) : null;
  const base = shapePollPublic(poll);
  const minedOptions = base.options.map((o, i) => {
    const voters = poll.options[i]?.voters || [];
    const mine = me && voters.some((v) => String(v?._id || v) === me);
    return { ...o, mine: !!mine };
  });
  return { ...base, options: minedOptions };
}

// POST /api/hachi/:id/polls
exports.createPoll = async (req, res) => {
  try {
    const room = await requireInside(req, res);
    if (!room) return;
    const { question, options, durationMinutes } = req.body;
    const trimmedQ = (question || '').trim();
    if (!trimmedQ) {
      return res.status(400).json({ success: false, message: 'Question required' });
    }
    const cleanOptions = (Array.isArray(options) ? options : [])
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    if (cleanOptions.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 options required' });
    }
    const dur = ALLOWED_DURATIONS_MIN.has(Number(durationMinutes))
      ? Number(durationMinutes)
      : DEFAULT_DURATION_MIN;
    const poll = await FlashPoll.create({
      circle: req.params.id,
      creator: req.user._id,
      question: trimmedQ.slice(0, 120),
      options: cleanOptions.map((text) => ({ text: text.slice(0, 80), voters: [] })),
      expiresAt: new Date(Date.now() + dur * 60 * 1000),
    });
    const shaped = shapePoll(poll.toObject(), req.user._id);
    const io = req.app.get('io');
    io.to(`hachi:${req.params.id}`).emit('flashPollCreated', { poll: shapePollPublic(poll.toObject()) });
    res.status(201).json({ success: true, poll: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/:id/polls — active only
exports.listPolls = async (req, res) => {
  try {
    const room = await requireInside(req, res);
    if (!room) return;
    const polls = await FlashPoll.find({
      circle: req.params.id,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, polls: polls.map((p) => shapePoll(p, req.user?._id)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/polls/:pollId/vote { optionId }
exports.votePoll = async (req, res) => {
  try {
    const { optionId } = req.body;
    if (!optionId) return res.status(400).json({ success: false, message: 'optionId required' });
    const poll = await FlashPoll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (poll.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'Poll expired' });
    }
    // Geofence enforced via the circle this poll belongs to
    req.params.id = poll.circle;
    const room = await requireInside(req, res);
    if (!room) return;

    const me = String(req.user._id);
    poll.options.forEach((o) => {
      o.voters = (o.voters || []).filter((v) => String(v) !== me);
    });
    const target = poll.options.id(optionId);
    if (!target) return res.status(404).json({ success: false, message: 'Option not found' });
    target.voters.push(req.user._id);
    await poll.save();

    const shaped = shapePoll(poll.toObject(), req.user._id);
    const io = req.app.get('io');
    io.to(`hachi:${poll.circle}`).emit('flashPollUpdate', { poll: shapePollPublic(poll.toObject()) });
    res.json({ success: true, poll: shaped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/hachi/polls/:pollId — creator only
exports.deletePoll = async (req, res) => {
  try {
    const poll = await FlashPoll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (String(poll.creator) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const circleId = String(poll.circle);
    await poll.deleteOne();
    const io = req.app.get('io');
    io.to(`hachi:${circleId}`).emit('flashPollRemoved', { pollId: req.params.pollId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
