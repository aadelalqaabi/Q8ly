const Hachi = require('../models/Hachi');

// GET /api/hachi — list active rooms (optional ?category=food&creator=userId&tag=x)
exports.getRooms = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    if (req.query.creator) {
      query.creator = req.query.creator;
    }
    const rooms = await Hachi.find(query)
      .populate('creator', 'name username profilePic')
      .select('-messages')
      .sort({ memberCount: -1, createdAt: -1 })
      .limit(50);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const HACHI_POINTS_REQUIRED = 50;

// POST /api/hachi — create room
exports.createRoom = async (req, res) => {
  try {
    const { title, category = 'general', isPublic = true } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    // Badged users (verified) bypass the points gate entirely
    const hasBadge = req.user.verifiedBadge && req.user.verifiedBadge !== 'none';
    // Loyalty gate: user must have at least 50 hachiPoints (skipped for badged users)
    if (!hasBadge && (req.user.hachiPoints || 0) < HACHI_POINTS_REQUIRED) {
      return res.status(403).json({
        success: false,
        message: 'ما وصلت بعد',
        hachiPoints: req.user.hachiPoints || 0,
        required: HACHI_POINTS_REQUIRED,
      });
    }

    const room = await Hachi.create({
      title: title.trim(),
      category,
      isPublic: isPublic !== false,
      creator: req.user._id,
      members: [req.user._id],
      memberCount: 1,
    });

    await room.populate('creator', 'name username profilePic');

    const io = req.app.get('io');
    io.emit('hachiNewRoom', { ...room.toObject(), messages: undefined });

    res.status(201).json({ success: true, room });
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

// GET /api/hachi/:id — get room with messages (works for both active and archived)
exports.getRoom = async (req, res) => {
  try {
    const room = await Hachi.findById(req.params.id)
      .populate('creator', 'name username profilePic')
      .populate('messages.user', 'name username profilePic');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Blocked users can still view the room (read-only), just cannot send messages via socket
    const isBlocked = req.user && room.blockedMembers.some((b) => b.toString() === req.user._id.toString());

    res.json({ success: true, room, isViewOnly: isBlocked || false });
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
