const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Post = require('../models/Post');
const Suggestion = require('../models/Suggestion');
const Hachi = require('../models/Hachi');
const { sendToAll, sendPush } = require('../services/pushService');

// POST /api/admin/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const admin = await Admin.findOne({ username }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await admin.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign({ id: admin._id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, admin: { username: admin.username, name: admin.name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      activeUsers,
      bannedUsers,
      totalPosts,
      postsToday,
      activeRooms,
      totalSuggestions,
      pendingSuggestions,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', createdAt: { $gte: todayStart } }),
      User.countDocuments({ role: 'user', lastSeen: { $gte: weekAgo } }),
      User.countDocuments({ isBanned: true }),
      Post.countDocuments({ isRemoved: false }),
      Post.countDocuments({ isRemoved: false, createdAt: { $gte: todayStart } }),
      Hachi.countDocuments({ isActive: true }),
      Suggestion.countDocuments(),
      Suggestion.countDocuments({ status: 'pending' }),
    ]);

    // Users registered per day for the last 14 days
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo }, role: 'user' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Posts per day for the last 14 days
    const postActivity = await Post.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo }, isRemoved: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers, newUsersToday, activeUsers, bannedUsers,
        totalPosts, postsToday, activeRooms,
        totalSuggestions, pendingSuggestions,
      },
      charts: { userGrowth, postActivity },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/users?page=1&limit=20&search=
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search?.trim();

    const query = { role: 'user' };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('username name profilePic phone postsCount followersCount hachiPoints isBanned banReason verifiedBadge isVerified createdAt lastSeen')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/ban
exports.banUser = async (req, res) => {
  try {
    const { banReason, permanent } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isBanned) {
      // Unban
      user.isBanned = false;
      user.banReason = null;
      user.banExpires = null;
    } else {
      // Ban
      user.isBanned = true;
      user.banReason = banReason || 'Violated community guidelines';
      user.banExpires = permanent ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await user.save();
    res.json({ success: true, isBanned: user.isBanned });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/verify
exports.verifyUser = async (req, res) => {
  try {
    const { verifiedBadge } = req.body;
    const valid = ['none', 'government', 'media', 'influencer', 'business'];
    if (!valid.includes(verifiedBadge)) {
      return res.status(400).json({ success: false, message: 'Invalid badge type' });
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.verifiedBadge = verifiedBadge;
    user.isVerified = verifiedBadge !== 'none';
    await user.save();
    res.json({ success: true, verifiedBadge: user.verifiedBadge, isVerified: user.isVerified });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await User.deleteOne({ _id: req.params.id });
    await Post.deleteMany({ userId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/posts?page=1&limit=20&search=
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search?.trim();

    const query = {};
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('userId', 'username name profilePic')
        .select('content images video type likesCount commentsCount isRemoved removedReason reportsCount createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/posts/:id
exports.removePost = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (post.isRemoved) {
      post.isRemoved = false;
      post.removedReason = null;
    } else {
      post.isRemoved = true;
      post.removedReason = reason || 'Removed by admin';
    }

    await post.save();
    res.json({ success: true, isRemoved: post.isRemoved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/reports?page=1&limit=20
exports.getReportedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const query = { isReported: true, isRemoved: false };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('userId', 'username name profilePic')
        .select('content images video type likesCount commentsCount reportsCount createdAt isReported isRemoved removedReason')
        .sort({ reportsCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    res.json({ success: true, posts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/posts/:id/dismiss-report
exports.dismissReport = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    post.isReported = false;
    post.reportsCount = 0;
    await post.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/suggestions?status=pending&page=1
exports.getSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const query = status && status !== 'all' ? { status } : {};

    const [suggestions, total] = await Promise.all([
      Suggestion.find(query)
        .populate('userId', 'username name profilePic')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Suggestion.countDocuments(query),
    ]);

    res.json({ success: true, suggestions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/push — send push notification to all users or a specific user
exports.sendPushNotification = async (req, res) => {
  try {
    const { title, body, targetUsername } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    if (targetUsername) {
      const user = await User.findOne({ username: targetUsername }).select('expoPushToken');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (!user.expoPushToken) {
        return res.status(400).json({ success: false, message: 'User has no push token registered' });
      }
      await sendPush([{ to: user.expoPushToken, title: title.trim(), body: body.trim(), sound: 'default' }]);
      return res.json({ success: true, sent: 1 });
    }

    await sendToAll(title.trim(), body.trim(), { type: 'admin' });
    const count = await User.countDocuments({ expoPushToken: { $exists: true, $ne: null } });
    res.json({ success: true, sent: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/suggestions/:id
exports.updateSuggestion = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found' });

    if (status) suggestion.status = status;
    if (adminNote !== undefined) suggestion.adminNote = adminNote;
    await suggestion.save();

    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
