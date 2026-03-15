const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Helper: shape a conversation for the list response
function shapeConv(c, userIdStr) {
  const other = c.participants.find((p) => p._id.toString() !== userIdStr);
  const unread = c.unreadCounts?.get(userIdStr) || 0;
  return {
    _id: c._id,
    other,
    lastMessage: c.lastMessage,
    lastMessageAt: c.lastMessageAt,
    unread,
    status: c.status,
    isInitiator: c.initiator?.toString() === userIdStr,
  };
}

// GET /api/dm — list my conversations + pending requests
exports.getConversations = async (req, res) => {
  try {
    const userIdStr = req.user._id.toString();
    const all = await Conversation.find({ participants: req.user._id })
      .select('-messages')
      .populate('participants', 'username name profilePic verifiedBadge')
      .sort({ lastMessageAt: -1 })
      .limit(100);

    const conversations = [];
    const requests = [];

    for (const c of all) {
      const shaped = shapeConv(c, userIdStr);
      if (c.status === 'accepted') {
        conversations.push(shaped);
      } else if (c.status === 'pending') {
        // If I'm the initiator → show in my conversations (pending outbox)
        if (c.initiator?.toString() === userIdStr) {
          conversations.push(shaped);
        } else {
          // I'm the recipient → show as request
          requests.push(shaped);
        }
      }
    }

    res.json({ success: true, conversations, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dm/:userId — fetch existing conversation (does NOT create one)
exports.getOrCreateConversation = async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    if (otherId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const otherUser = await User.findById(otherId).select('username name profilePic verifiedBadge isActive blockedUsers');
    if (!otherUser || !otherUser.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check blocks
    const meBlocked = (otherUser.blockedUsers || []).some((id) => id.toString() === req.user._id.toString());
    if (meBlocked) return res.status(403).json({ success: false, message: 'Cannot message this user' });

    const senderIdStr = req.user._id.toString();

    const conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherId], $size: 2 },
    }).populate('messages.sender', 'username name profilePic');

    if (conversation) {
      // Recipient opens a pending conversation → auto-accept
      if (conversation.status === 'pending' && conversation.initiator?.toString() !== senderIdStr) {
        conversation.status = 'accepted';
        await conversation.save();
      }

      // Mark messages sent to me as read
      let dirty = false;
      conversation.messages.forEach((m) => {
        const senderId = m.sender?._id?.toString() || m.sender?.toString();
        if (senderId !== senderIdStr && !m.isRead) {
          m.isRead = true;
          dirty = true;
        }
      });
      if (dirty) {
        conversation.unreadCounts.set(senderIdStr, 0);
        await conversation.save();
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${otherId}`).emit('dmSeen', { conversationId: conversation._id.toString() });
        }
      }
    }

    res.json({ success: true, conversation: conversation || null, other: otherUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/dm/:userId — send message
exports.sendMessage = async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    if (text.trim().length > 1000) return res.status(400).json({ success: false, message: 'Message too long' });

    // Check if other user blocked me
    const otherUser = await User.findById(otherId).select('blockedUsers following');
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found' });
    const meBlocked = (otherUser.blockedUsers || []).some((id) => id.toString() === req.user._id.toString());
    if (meBlocked) return res.status(403).json({ success: false, message: 'Cannot message this user' });

    // Check if I blocked them
    const me = await User.findById(req.user._id).select('blockedUsers');
    const iBlocked = (me.blockedUsers || []).some((id) => id.toString() === otherId);
    if (iBlocked) return res.status(403).json({ success: false, message: 'Unblock this user to message them' });

    const senderIdStr = req.user._id.toString();
    // Recipient follows sender → direct message; otherwise → request
    const recipientFollowsSender = (otherUser.following || []).some((id) => id.toString() === senderIdStr);

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, otherId],
        messages: [],
        unreadCounts: {},
        status: recipientFollowsSender ? 'accepted' : 'pending',
        initiator: req.user._id,
      });
    } else if (conversation.status === 'pending' && conversation.initiator?.toString() !== req.user._id.toString()) {
      // Recipient is replying → auto-accept
      conversation.status = 'accepted';
    }

    const message = { sender: req.user._id, text: text.trim(), isRead: false };
    conversation.messages.push(message);
    conversation.lastMessage = text.trim().slice(0, 80);
    conversation.lastMessageAt = new Date();
    conversation.lastSenderId = req.user._id;
    const otherUnread = (conversation.unreadCounts?.get(otherId) || 0) + 1;
    conversation.unreadCounts.set(otherId, otherUnread);
    await conversation.save();

    const newMsg = conversation.messages[conversation.messages.length - 1];
    const senderInfo = { _id: req.user._id, username: req.user.username, name: req.user.name, profilePic: req.user.profilePic };

    // Real-time via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${otherId}`).emit('dmMessage', {
        conversationId: conversation._id,
        message: { ...newMsg.toObject(), sender: senderInfo },
      });
    }

    res.status(201).json({ success: true, message: { ...newMsg.toObject(), sender: senderInfo } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/dm/:conversationId/accept — accept a message request
exports.acceptRequest = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conv.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    conv.status = 'accepted';
    await conv.save();

    // Notify the initiator in real-time
    const io = req.app.get('io');
    if (io && conv.initiator) {
      io.to(`user:${conv.initiator.toString()}`).emit('dmRequestAccepted', {
        conversationId: conv._id.toString(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/dm/:conversationId/deny — deny / delete a message request
exports.denyRequest = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conv.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await conv.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dm/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const userIdStr = req.user._id.toString();
    const conversations = await Conversation.find({ participants: req.user._id }).select('unreadCounts');
    const total = conversations.reduce((sum, c) => sum + (c.unreadCounts?.get(userIdStr) || 0), 0);
    res.json({ success: true, count: total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
