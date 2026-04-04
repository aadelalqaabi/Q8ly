const Hachi = require('../models/Hachi');
const User = require('../models/User');
const { invalidateUserCache } = require('../middleware/auth');

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

// GET /api/hachi — list circles, sorted by velocity
exports.getRooms = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    if (req.query.creator) {
      query.creator = req.query.creator;
    }
    const rawRooms = await Hachi.find(query)
      .populate('creator', 'name username profilePic verifiedBadge')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    const now = Date.now();

    // Compute velocity score and messageCount for each room
    const rooms = rawRooms.map((r) => {
      const { messages, ...rest } = r;
      return {
        ...rest,
        messageCount: (messages || []).length,
        velocityScore: velocityScore({ ...r, messages }, now),
      };
    });

    // Sort by velocity (highest first)
    rooms.sort((a, b) => b.velocityScore - a.velocityScore);

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
    const { title, category = 'general', isPublic = true } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

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
      // Deduct points and bust the auth cache so the stale balance isn't reused
      await User.findByIdAndUpdate(req.user._id, { $inc: { hachiPoints: -HACHI_POINTS_COST } });
      invalidateUserCache(req.user._id);
    }

    const room = await Hachi.create({
      title: title.trim(),
      category,
      isPublic: isPublic !== false,
      creator: req.user._id,
      members: [req.user._id],
      memberCount: 1,
    });

    await room.populate('creator', 'name username profilePic verifiedBadge');

    // Fetch updated points to return to client
    const updatedUser = await User.findById(req.user._id).select('hachiPoints');

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
