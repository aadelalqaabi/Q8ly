const Hachi = require('../models/Hachi');
const User = require('../models/User');
const { invalidateUserCache } = require('../middleware/auth');
const { computeConfidence } = require('../utils/locationUtils');

// ── Velocity score ─────────────────────────────────────────────────────────────
// Computes a real-time "hotness" score for ranking the Most Active list.
// Weights recent messages (last 30 min) heavily over raw member count.
function velocityScore(room, now) {
  const windowMs = 30 * 60 * 1000; // 30 minutes
  const cutoff = now - windowMs;
  const recentMsgs = (room.messages || []).filter(
    (m) => new Date(m.createdAt).getTime() > cutoff
  ).length;
  return recentMsgs * 3 + (room.memberCount || 1);
}

// GET /api/hachi — list circles, sorted by proximity (if lat/lng given) then velocity
exports.getRooms = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    if (req.query.creator) {
      query.creator = req.query.creator;
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const hasLocation = !isNaN(lat) && !isNaN(lng);
    const MAX_DISTANCE_M = 3000; // 3 km radius

    let rawRooms;
    if (hasLocation) {
      // Geo query: circles with location sorted by distance first, then all others
      const [nearby, rest] = await Promise.all([
        Hachi.find({ ...query, location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: MAX_DISTANCE_M } } })
          .populate('creator', 'name username profilePic verifiedBadge')
          .limit(80)
          .lean(),
        Hachi.find({ ...query, location: { $exists: false } })
          .populate('creator', 'name username profilePic verifiedBadge')
          .sort({ updatedAt: -1 })
          .limit(40)
          .lean(),
      ]);
      rawRooms = [...nearby, ...rest];
    } else {
      rawRooms = await Hachi.find(query)
        .populate('creator', 'name username profilePic verifiedBadge')
        .sort({ updatedAt: -1 })
        .limit(80)
        .lean();
    }

    const now = Date.now();
    const nowDate = new Date(now);

    // Compute velocity score, messageCount, and activeHere for each room
    const rooms = rawRooms.map((r) => {
      const { messages, hereNow, ...rest } = r;
      const activeHere = (hereNow || []).filter((p) => new Date(p.expiresAt) > nowDate).length;
      const vel = velocityScore({ ...r, messages }, now);
      // feedScore weights physical presence heavily
      const feedScore = activeHere * 5 + vel;
      return {
        ...rest,
        messageCount: (messages || []).length,
        velocityScore: vel,
        activeHere,
        feedScore,
      };
    });

    // Sort by feedScore (presence + velocity)
    rooms.sort((a, b) => b.feedScore - a.feedScore);

    // Attach followingInRoom: which people the current user follows are in each room
    if (req.user && req.user.following?.length) {
      const followingSet = new Set(req.user.following.map((id) => id.toString()));

      // Collect all member IDs across all rooms that the user follows
      const relevantIds = new Set();
      for (const room of rooms) {
        for (const memberId of room.members || []) {
          const s = memberId.toString();
          if (followingSet.has(s)) relevantIds.add(s);
        }
      }

      // Fetch names + profilePics in one query
      let memberMap = {};
      if (relevantIds.size > 0) {
        const memberUsers = await User.find({ _id: { $in: [...relevantIds] } })
          .select('name username profilePic')
          .lean();
        for (const u of memberUsers) {
          memberMap[u._id.toString()] = { _id: u._id, name: u.name, username: u.username, profilePic: u.profilePic };
        }
      }

      for (const room of rooms) {
        room.followingInRoom = (room.members || [])
          .map((id) => id.toString())
          .filter((id) => followingSet.has(id))
          .map((id) => memberMap[id])
          .filter(Boolean);
      }
    }

    // Trending refund: if the #1 room hasn't been awarded yet, give the creator a bonus
    if (rooms.length > 0) {
      const top = rooms[0];
      if (!top.trendingAwardedAt && top.velocityScore >= 5) {
        // Award async — don't block the response
        Hachi.findByIdAndUpdate(top._id, { trendingAwardedAt: new Date() }).exec();
        User.findByIdAndUpdate(top.creator?._id || top.creator, { $inc: { hachiPoints: 100 } }).exec();
        // Emit a socket event so the creator's client can update points live
        const io = req.app?.get('io');
        if (io && top.creator?._id) {
          io.to(`user:${top.creator._id}`).emit('hachiTrendingBonus', {
            roomId: top._id,
            roomTitle: top.title,
            bonus: 100,
          });
        }
      }
    }

    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const HACHI_POINTS_COST = 50;

// POST /api/hachi — create room (deducts 50 points)
exports.createRoom = async (req, res) => {
  try {
    const { title: rawTitle, category = 'general', isPublic = true } = req.body;
    if (!rawTitle?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    // Strip emoji characters from title
    const title = rawTitle.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    // Badged users (verified) bypass the points cost
    const hasBadge = req.user.verifiedBadge && req.user.verifiedBadge !== 'none';

    if (!hasBadge) {
      const currentPoints = req.user.hachiPoints || 0;
      if (currentPoints < HACHI_POINTS_COST) {
        return res.status(403).json({
          success: false,
          message: 'ما وصلت بعد',
          hachiPoints: currentPoints,
          required: HACHI_POINTS_COST,
        });
      }
    }

    // Create the room FIRST — only deduct points if creation succeeds
    const { lat: cLat, lng: cLng } = req.body;
    const locationField = cLat && cLng ? {
      location: { type: 'Point', coordinates: [parseFloat(cLng), parseFloat(cLat)] },
    } : {};

    const room = await Hachi.create({
      title: title.trim(),
      category,
      isPublic: isPublic !== false,
      creator: req.user._id,
      ...locationField,
      members: [req.user._id],
      memberCount: 1,
    });

    await room.populate('creator', 'name username profilePic verifiedBadge');

    // Deduct points now that the room exists
    let updatedUser;
    if (!hasBadge) {
      updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { hachiPoints: -HACHI_POINTS_COST } },
        { new: true }
      ).select('hachiPoints');
      invalidateUserCache(req.user._id);
    } else {
      updatedUser = await User.findById(req.user._id).select('hachiPoints');
    }

    const io = req.app.get('io');
    io.emit('hachiNewRoom', { ...room.toObject(), messages: undefined });

    res.status(201).json({ success: true, room, hachiPoints: updatedUser.hachiPoints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/subjects — top 5 active subjects (categories) by circle count
exports.getSubjects = async (req, res) => {
  try {
    const counts = await Hachi.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    res.json({ success: true, subjects: counts.map((c) => ({ category: c._id, count: c.count })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/archived — list recently closed rooms (last 7 days)
exports.getArchivedRooms = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const query = { isActive: false, updatedAt: { $gte: sevenDaysAgo } };
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    if (req.query.creator) {
      query.creator = req.query.creator;
    }
    const rooms = await Hachi.find(query)
      .populate('creator', 'name username profilePic')
      .select('-messages')
      .sort({ updatedAt: -1 })
      .limit(30);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/moments — pinned messages across active rooms (for home feed)
exports.getPinnedMoments = async (req, res) => {
  try {
    const rooms = await Hachi.find({
      isActive: true,
      'pinnedMessages.0': { $exists: true },
    })
      .populate('creator', 'name username profilePic')
      .populate('messages.user', 'name username profilePic')
      .sort({ updatedAt: -1 })
      .limit(20);

    const moments = [];
    for (const room of rooms) {
      for (const pinId of room.pinnedMessages) {
        const msg = room.messages.find(
          (m) => m._id.toString() === pinId.toString()
        );
        if (msg) {
          // Count replies after this message
          const msgIdx = room.messages.findIndex(
            (m) => m._id.toString() === pinId.toString()
          );
          let replyCount = 0;
          if (msgIdx >= 0) {
            for (let i = msgIdx + 1; i < room.messages.length && replyCount < 50; i++) {
              replyCount++;
            }
          }
          moments.push({
            _id: `${room._id}_${msg._id}`,
            roomId: room._id,
            roomTitle: room.title,
            roomCategory: room.category,
            memberCount: room.memberCount,
            message: {
              _id: msg._id,
              text: msg.text,
              createdAt: msg.createdAt,
              user: msg.user,
            },
            replyCount,
            pinnedAt: msg.createdAt,
          });
        }
      }
    }

    // Sort by most recent pinned message
    moments.sort((a, b) => new Date(b.pinnedAt) - new Date(a.pinnedAt));

    res.json({ success: true, moments: moments.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/:id — get room with messages (works for both active and archived)
// For venue circles: enforce geofence — if user not physically inside, return room without messages
exports.getRoom = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id)
      .populate('creator', 'name username profilePic verifiedBadge')
      .populate('messages.user', 'name username profilePic verifiedBadge');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Blocked users can still view the room (read-only), just cannot send messages via socket
    const isBlocked = req.user && room.blockedMembers.some((b) => b.toString() === req.user._id.toString());

    // Geofence enforcement for venue circles: only return messages if user is physically inside.
    let inside = true;
    let confidence = 1;
    if (room.isVenueCircle && room.venueCoords?.lat) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const speed = parseFloat(req.query.speed) || 0;
      if (!isNaN(lat) && !isNaN(lng)) {
        confidence = computeConfidence(lat, lng, speed, room.venueCoords, room.venueRadius || 250);
        inside = confidence > 0;
      } else {
        // No coordinates sent — radar already gated entry, trust the client
        inside = true;
        confidence = 1;
      }
    }

    const roomData = room.toObject();
    if (!inside) {
      roomData.messages = [];
      roomData.lastMessage = null;
      roomData.hereNow = [];
    } else {
    }

    res.json({
      success: true,
      room: roomData,
      isViewOnly: isBlocked || false,
      inside,
      confidence,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/:id/react — add a pulse reaction
exports.reactRoom = async (req, res) => {
  try {
    const { type } = req.body;
    if (!['fire', 'eyes', 'skull'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid reaction type' });
    }
    const room = await Hachi.findByIdAndUpdate(
      req.params.id,
      { $inc: { [`reactions.${type}`]: 1 } },
      { new: true }
    ).select('reactions');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const io = req.app.get('io');
    io.to(`hachi:${req.params.id}`).emit('hachiReactionUpdate', {
      roomId: req.params.id,
      reactions: room.reactions,
    });

    res.json({ success: true, reactions: room.reactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/hachi/:id — close room (creator only)
exports.closeRoom = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Compute TL;DR summary before closing
    const textMessages = room.messages.filter((m) => m.text);
    const first = textMessages[0]?.text || '';
    const last = textMessages[textMessages.length - 1]?.text || '';
    const excerpt = (first + (textMessages.length > 1 ? ' ... ' + last : '')).slice(0, 120);
    room.summary = {
      messageCount: room.messages.length,
      participantCount: room.members.length,
      excerpt,
    };
    room.isActive = false;
    await room.save();

    const io = req.app.get('io');
    io.to(`hachi:${room._id}`).emit('hachiRoomClosed', { roomId: room._id });
    io.emit('hachiRoomRemoved', { roomId: room._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/joined — rooms the current user is a member of (active + recently closed)
exports.getJoinedRooms = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rooms = await Hachi.find({
      members: req.user._id,
      $or: [{ isActive: true }, { isActive: false, updatedAt: { $gte: sevenDaysAgo } }],
    })
      .populate('creator', 'name username profilePic')
      .select('-messages')
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(100);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/my — all rooms created by current user (active + ended)
exports.getMyRooms = async (req, res) => {
  try {
    const rooms = await Hachi.find({ creator: req.user._id })
      .populate('creator', 'name username profilePic')
      .select('-messages')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/hachi/:id/delete — permanently delete a circle (creator only)
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`hachi:${room._id}`).emit('hachiRoomClosed', { roomId: room._id });
      io.emit('hachiRoomRemoved', { roomId: room._id });
    }

    await Hachi.deleteOne({ _id: room._id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/:id/pin — pin a circle (max 3)
exports.pinRoom = async (req, res) => {
  try {
    const user = req.user;
    if (user.pinnedCircles.length >= 3) {
      return res.status(400).json({ success: false, message: 'Max 3 pinned circles' });
    }
    if (user.pinnedCircles.map(String).includes(req.params.id)) {
      return res.json({ success: true, pinned: true });
    }
    user.pinnedCircles.push(req.params.id);
    await user.save();
    res.json({ success: true, pinned: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/hachi/:id/pin — unpin a circle
exports.unpinRoom = async (req, res) => {
  try {
    req.user.pinnedCircles.pull(req.params.id);
    await req.user.save();
    res.json({ success: true, pinned: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/:id/leave — leave a circle as a member (non-creator)
exports.leaveRoom = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Creator cannot leave — end the circle instead' });
    }
    room.members.pull(req.user._id);
    room.memberCount = Math.max(1, (room.memberCount || 1) - 1);
    await room.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/user-messages/:userId — a user's messages across circles (for profile)
exports.getUserMessages = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ username: req.params.username }).select('_id');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const userId = user._id;
    const rooms = await Hachi.find({ 'messages.user': userId })
      .populate('creator', 'name username profilePic')
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    const messages = [];
    for (const room of rooms) {
      const userMsgs = (room.messages || [])
        .filter((m) => m.user?.toString() === userId.toString() && (m.text || m.image || m.video))
        .slice(-10); // last 10 from each room
      for (const msg of userMsgs) {
        messages.push({
          _id: msg._id,
          text: msg.text,
          image: msg.image,
          video: msg.video,
          videoThumbnail: msg.videoThumbnail,
          createdAt: msg.createdAt,
          roomId: room._id,
          roomTitle: room.title,
          roomCategory: room.category,
          isActive: room.isActive,
        });
      }
    }

    // Sort by most recent first, limit to 30
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, messages: messages.slice(0, 30) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/nearby?lat=&lng=&maxDist=  — closest venue circle to the user.
// Returns full circle info (name, distance, status) so the radar can show a "what's near you" card.
// Founders receive any active venue circle even without coords (status: 'here').
exports.getNearby = async (req, res) => {
  try {
    const { haversineMeters, computeConfidence } = require('../utils/locationUtils');
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const maxDist = parseFloat(req.query.maxDist) || 3000;
    const hasCoords = !isNaN(lat) && !isNaN(lng);

    if (!hasCoords) {
      return res.status(400).json({ success: false, message: 'lat/lng required' });
    }

    const nearby = await Hachi.find({
      isActive: true,
      isVenueCircle: true,
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDist,
        },
      },
    })
      .select('_id title venueName venueType venueCoords venueRadius hereNow lastMessage')
      .limit(1)
      .lean();
    const circle = nearby[0];

    if (!circle) return res.json({ success: true, circle: null });

    const dist = Math.round(haversineMeters(lat, lng, circle.venueCoords.lat, circle.venueCoords.lng));
    const confidence = computeConfidence(lat, lng, 0, circle.venueCoords, circle.venueRadius || 250);
    const status = confidence >= 0.6 ? 'here' : confidence >= 0.3 ? 'nearby' : 'locked';
    const now = new Date();
    const activeHere = (circle.hereNow || []).filter((p) => new Date(p.expiresAt) > now).length;
    res.json({
      success: true,
      circle: {
        _id: circle._id,
        title: circle.title,
        venueName: circle.venueName,
        venueType: circle.venueType,
        venueRadius: circle.venueRadius,
        distance: dist,
        status,
        activeHere,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/:id/visit — record that user has physically entered this circle.
// Adds the circleId to user's visitedCircles (idempotent — duplicates are skipped).
exports.recordVisit = async (req, res) => {
  try {
    const { lat, lng, speed = 0 } = req.body;
    const room = await Hachi.findById(req.params.id).select('isVenueCircle venueCoords venueRadius').lean();
    if (!room) return res.status(404).json({ success: false, message: 'Circle not found' });
    if (!room.isVenueCircle || !room.venueCoords?.lat) {
      return res.status(400).json({ success: false, message: 'Not a venue circle' });
    }
    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'lat/lng required' });
    }
    const confidence = computeConfidence(parseFloat(lat), parseFloat(lng), parseFloat(speed) || 0, room.venueCoords, room.venueRadius || 250);
    if (confidence < 0.6) {
      return res.status(403).json({ success: false, message: 'Not inside the venue' });
    }
    const user = await User.findById(req.user._id).select('visitedCircles').lean();
    const alreadyVisited = (user.visitedCircles || []).map(String).includes(req.params.id);
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { visitedCircles: req.params.id } }
    );
    const circle = await Hachi.findById(req.params.id).select('stampUrl venueName').lean();
    res.json({ success: true, firstVisit: !alreadyVisited, stampUrl: circle?.stampUrl || null, venueName: circle?.venueName || '' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/profile/vault — vault data for current user.
// Returns a list of ALL venue circles (id + visited flag) so the client can render the full grid.
exports.getVault = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('visitedCircles').lean();
    const visitedSet = new Set((user.visitedCircles || []).map(String));
    const allCircles = await Hachi.find({
      isVenueCircle: true,
      isActive: true,
      'venueCoords.lat': { $exists: true, $ne: null },
      'venueCoords.lng': { $exists: true, $ne: null },
    })
      .select('_id venueName venueType category venueCoords venueRadius mapSnapshot stampUrl')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    const items = allCircles.map((c) => ({
      _id: String(c._id),
      title: c.venueName || '',
      category: c.category || 'general',
      lat: c.venueCoords?.lat ?? null,
      lng: c.venueCoords?.lng ?? null,
      radius: c.venueRadius ?? 650,
      mapSnapshot: c.mapSnapshot || null,
      stampUrl: c.stampUrl || null,
      visited: visitedSet.has(String(c._id)),
    }));
    const totalCircles = allCircles.length;
    const visitedCount = items.filter((x) => x.visited).length;
    const percentage = totalCircles > 0 ? Math.floor((visitedCount / totalCircles) * 100) : 0;
    res.json({
      success: true,
      items,
      visitedCount,
      totalCircles,
      percentage,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/radar — minimal "heat pulse" data for the dark map view.
// Returns only circles with current activity (recent messages OR active hereNow presence).
// Does NOT return titles/messages — just coordinates + intensity.
// Founder accounts see EVERY active venue circle (even cold ones with intensity 0).
exports.getRadar = async (req, res) => {
  try {
    const now = Date.now();
    const recentCutoff = new Date(now - 30 * 60 * 1000); // 30 min
    const rooms = await Hachi.find({ isActive: true, isVenueCircle: true })
      .select('venueCoords venueRadius hereNow lastMessage messages venueType title venueName')
      .lean();

    const pulses = rooms.map((r) => {
      const lat = r.venueCoords?.lat;
      const lng = r.venueCoords?.lng;
      if (!lat || !lng) return null;
      const activeHere = (r.hereNow || []).filter((p) => new Date(p.expiresAt) > new Date(now)).length;
      const recentMsgs = (r.messages || []).filter(
        (m) => new Date(m.createdAt).getTime() > now - 30 * 60 * 1000
      ).length;
      const intensity = Math.min(1, (activeHere * 2 + recentMsgs * 0.5) / 10);
      return { _id: r._id, lat, lng, intensity, activeHere, venueType: r.venueType, title: r.title, venueName: r.venueName };
    }).filter(Boolean);

    res.json({ success: true, pulses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/:id/check-location?lat=&lng=&speed=
exports.checkLocation = async (req, res) => {
  try {
    const { lat, lng, speed = 0 } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ success: false, message: 'lat/lng required' });
    }
    const room = await Hachi.findById(req.params.id).select('venueCoords venueRadius isVenueCircle').lean();
    if (!room) return res.status(404).json({ success: false, message: 'Not found' });
    if (!room.isVenueCircle || !room.venueCoords?.lat) {
      return res.json({ success: true, confidence: 1, status: 'open' });
    }
    const confidence = computeConfidence(userLat, userLng, parseFloat(speed) || 0, room.venueCoords, room.venueRadius || 250);
    const status = confidence >= 0.6 ? 'here' : confidence >= 0.3 ? 'nearby' : 'locked';
    res.json({ success: true, confidence, status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hachi/search?q=... — search active rooms by title
exports.searchRooms = async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (!q.trim()) return res.json({ success: true, rooms: [] });
    const escaped = q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const rooms = await Hachi.find({ title: { $regex: regex } })
      .populate('creator', 'name username profilePic')
      .select('-messages')
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(30);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hachi/:id/messages/:msgId/like — toggle like on a message
exports.likeMessage = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const userId = req.user._id;
    const room = await Hachi.findById(id).select('messages');
    if (!room) return res.status(404).json({ success: false });
    const msg = room.messages.id(msgId);
    if (!msg) return res.status(404).json({ success: false });
    const liked = (msg.likes || []).some(l => l.toString() === userId.toString());
    if (liked) {
      msg.likes = msg.likes.filter(l => l.toString() !== userId.toString());
    } else {
      msg.likes.push(userId);
    }
    await room.save();
    res.json({ success: true, likes: msg.likes.length, liked: !liked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Founder-only: list all circles (no messages) ──────────────────────────────
exports.founderListCircles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const [circles, total] = await Promise.all([
      Hachi.find({})
        .select('-messages')
        .populate('creator', 'username name profilePic')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Hachi.countDocuments({}),
    ]);
    res.json({ success: true, circles, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Founder-only: get single circle with messages populated ───────────────────
exports.founderGetCircle = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id)
      .populate('messages.user', 'username name profilePic');
    if (!room) return res.status(404).json({ success: false, message: 'Circle not found' });
    res.json({ success: true, circle: room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Founder-only: delete a message from a circle ─────────────────────────────
exports.founderDeleteMessage = async (req, res) => {
  try {
    const { id, msgId } = req.params;
    const mongoose = require('mongoose');
    await Hachi.updateOne(
      { _id: id },
      { $pull: { messages: { _id: new mongoose.Types.ObjectId(msgId) } } }
    );
    const io = req.app.get('io');
    if (io) {
      io.to(`hachi:${id}`).emit('hachiMessageDeleted', { roomId: id, messageId: msgId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
