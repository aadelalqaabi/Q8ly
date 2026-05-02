const FlashPoll = require('../models/FlashPoll');
const Hachi = require('../models/Hachi');
const { computeConfidence, bypassesGeofence } = require('../utils/locationUtils');

const POLL_DURATION_MS = 15 * 60 * 1000; // 15 min

async function ensureInside(req, res) {
  const room = await Hachi.findById(req.params.id || req.body.circleId).select('isVenueCircle venueCoords venueRadius').lean();
  if (!room) {
    res.status(404).json({ success: false, message: 'Circle not found' });
    return null;
  }
  if (room.isVenueCircle && room.venueCoords?.lat && !bypassesGeofence(req.user)) {
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
  }
  return room;
}

// POST /api/hachi/:id/polls
exports.createPoll = async (req, res) => {
  try {
    const room = await ensureInside(req, res);
    if (!room) return;
    const { question, options } = req.body;
    if (!question?.trim() || !Array.isArray(options) || options.length < 2 || options.length > 4) {
      return res.status(400).json({ success: false, message: 'Question + 2-4 options required' });
    }
    const poll = await FlashPoll.create({
      circle: req.params.id,
      creator: req.user._id,
      question: question.trim(),
      options: options.slice(0, 4).map((text) => ({ text: String(text).trim().slice(0, 60), voters: [] })),
      expiresAt: new Date(Date.now() + POLL_DURATION_MS),
    });
    const io = req.app.get('io');
    io.to(`hachi:${req.params.id}`).emit('flashPollCreated', { poll });
    res.status(201).json({ success: true, poll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/:id/polls — active polls only
exports.listPolls = async (req, res) => {
  try {
    // Allow viewing polls only if inside (reuse middleware)
    const room = await ensureInside(req, res);
    if (!room) return;
    const polls = await FlashPoll.find({
      circle: req.params.id,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, polls });
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
    if (poll.expiresAt < new Date()) return res.status(410).json({ success: false, message: 'Poll expired' });

    // Geofence check: must still be inside the circle to vote
    req.params.id = poll.circle;
    const room = await ensureInside(req, res);
    if (!room) return;

    // Remove user from any other option, add to chosen
    const uid = req.user._id.toString();
    poll.options.forEach((o) => {
      o.voters = o.voters.filter((v) => v.toString() !== uid);
    });
    const target = poll.options.id(optionId);
    if (!target) return res.status(404).json({ success: false, message: 'Option not found' });
    target.voters.push(req.user._id);
    await poll.save();

    const io = req.app.get('io');
    io.to(`hachi:${poll.circle}`).emit('flashPollUpdate', { poll: poll.toObject() });
    res.json({ success: true, poll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
