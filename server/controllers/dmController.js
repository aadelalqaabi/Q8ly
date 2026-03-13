const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// GET /api/dm — list my conversations (sorted by most recent)
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .select('-messages')
      .populate('participants', 'username name profilePic verifiedBadge')
      .sort({ lastMessageAt: -1 })
      .limit(50);

    const userIdStr = req.user._id.toString();
    const result = conversations.map((c) => {
      const other = c.participants.find((p) => p._id.toString() !== userIdStr);
      const unread = c.unreadCounts?.get(userIdStr) || 0;
      return { _id: c._id, other, lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt, unread };
    });

    res.json({ success: true, conversations: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dm/:userId — get or create conversation with a user + fetch messages
exports.getOrCreateConversation = async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    if (otherId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    const otherUser = await User.findById(otherId).select('username name profilePic verifiedBadge isActive');
    if (!otherUser || !otherUser.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherId], $size: 2 },
    }).populate('messages.sender', 'username name profilePic');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, otherId],
        messages: [],
        unreadCounts: {},
      });
      conversation = await conversation.populate('messages.sender', 'username name profilePic');
    }

    // Mark all messages to me as read
    const userIdStr = req.user._id.toString();
    let dirty = false;
    conversation.messages.forEach((m) => {
      if (m.sender._id?.toString() !== userIdStr && !m.isRead) {
        m.isRead = true;
        dirty = true;
      }
    });
    if (dirty) {
      conversation.unreadCounts.set(userIdStr, 0);
      await conversation.save();
    }

    res.json({ success: true, conversation, other: otherUser });
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

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, otherId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, otherId],
        messages: [],
        unreadCounts: {},
      });
    }

    const message = {
      sender: req.user._id,
      text: text.trim(),
      isRead: false,
    };

    conversation.messages.push(message);
    conversation.lastMessage = text.trim().slice(0, 80);
    conversation.lastMessageAt = new Date();
    conversation.lastSenderId = req.user._id;
    // Increment unread count for the other user
    const otherUnread = (conversation.unreadCounts?.get(otherId) || 0) + 1;
    conversation.unreadCounts.set(otherId, otherUnread);

    await conversation.save();

    const newMsg = conversation.messages[conversation.messages.length - 1];

    // Real-time via socket
    const io = req.app.get('io');
    if (io) {
      const sender = { _id: req.user._id, username: req.user.username, name: req.user.name, profilePic: req.user.profilePic };
      io.to(`user:${otherId}`).emit('dmMessage', {
        conversationId: conversation._id,
        message: { ...newMsg.toObject(), sender },
      });
    }

    res.status(201).json({ success: true, message: { ...newMsg.toObject(), sender: { _id: req.user._id, username: req.user.username, name: req.user.name, profilePic: req.user.profilePic } } });
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
