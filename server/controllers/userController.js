const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const { sendToUser } = require('../services/pushService');

// @desc    Get user profile by username
// @route   GET /api/users/:username
// @access  Public
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate('followedTopics', 'name nameAr slug color')
      .select('-password -passwordResetToken -emailVerificationToken -blockedUsers');

    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profile = user.toPublicProfile();

    // Check if current user follows this user
    if (req.user) {
      profile.isFollowing = req.user.following.includes(user._id);
      profile.isBlocked = req.user.blockedUsers.includes(user._id);
      profile.isNotifyEnabled = (req.user.postNotifications || []).some(
        (id) => id.toString() === user._id.toString()
      );
    }

    res.json({ success: true, user: profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's posts
// @route   GET /api/users/:username/posts
// @access  Public
const getUserPosts = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: user._id, isRemoved: false };
    if (type) query.type = type;

    // If not own profile, only show public posts
    if (!req.user || req.user._id.toString() !== user._id.toString()) {
      query.visibility = 'public';
    }

    const posts = await Post.find(query)
      .populate('userId', 'username name profilePic verifiedBadge')
      .populate('topicTags', 'name nameAr slug color')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Follow / Unfollow user
// @route   POST /api/users/:id/follow
// @access  Private
const toggleFollow = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't follow yourself" });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUser = req.user;
    const isFollowing = currentUser.following.includes(targetUser._id);

    if (isFollowing) {
      // Unfollow
      currentUser.following.pull(targetUser._id);
      currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
      targetUser.followers.pull(currentUser._id);
      targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
    } else {
      // Follow
      currentUser.following.push(targetUser._id);
      currentUser.followingCount += 1;
      targetUser.followers.push(currentUser._id);
      targetUser.followersCount += 1;
      targetUser.hachiPoints = (targetUser.hachiPoints || 0) + 3;

      // Notify target user
      const notification = await Notification.create({
        userId: targetUser._id,
        type: 'follow',
        fromUser: currentUser._id,
      });

      const io = req.app.get('io');
      if (io) io.to(`user:${targetUser._id}`).emit('notification', notification);

      // Push notification
      sendToUser(
        targetUser, 'follows',
        'New follower',
        `@${currentUser.username} started following you`,
        { type: 'follow', userId: currentUser._id.toString() }
      );
    }

    await currentUser.save({ validateBeforeSave: false });
    await targetUser.save({ validateBeforeSave: false });

    res.json({
      success: true,
      following: !isFollowing,
      followersCount: targetUser.followersCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Block / Unblock user
// @route   POST /api/users/:id/block
// @access  Private
const toggleBlock = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't block yourself" });
    }

    const currentUser = await User.findById(req.user._id);
    const isBlocked = currentUser.blockedUsers.includes(req.params.id);

    if (isBlocked) {
      currentUser.blockedUsers.pull(req.params.id);
    } else {
      currentUser.blockedUsers.push(req.params.id);
      // Also unfollow if following
      if (currentUser.following.includes(req.params.id)) {
        currentUser.following.pull(req.params.id);
        currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
        await User.findByIdAndUpdate(req.params.id, {
          $pull: { followers: currentUser._id },
          $inc: { followersCount: -1 },
        });
      }
    }

    await currentUser.save({ validateBeforeSave: false });
    res.json({ success: true, blocked: !isBlocked });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, district, profilePic, coverPhoto, notificationSettings } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (district !== undefined) updateFields.district = district;
    if (profilePic !== undefined) updateFields.profilePic = profilePic;
    if (coverPhoto !== undefined) updateFields.coverPhoto = coverPhoto;
    if (notificationSettings !== undefined) updateFields.notificationSettings = notificationSettings;

    const user = await User.findByIdAndUpdate(req.user._id, updateFields, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Public
const searchUsers = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const escaped = q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      isActive: true,
      $or: [{ username: regex }, { name: regex }],
    })
      .select('username name profilePic verifiedBadge accountType followersCount bio')
      .sort({ followersCount: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get followers / following list
// @route   GET /api/users/:username/followers
// @route   GET /api/users/:username/following
// @access  Public
const getFollowers = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const type = req.path.includes('following') ? 'following' : 'followers';

    const user = await User.findOne({ username: req.params.username })
      .populate({
        path: type,
        select: 'username name profilePic verifiedBadge accountType followersCount',
        options: { skip, limit: parseInt(limit) },
      });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, users: user[type] });
  } catch (error) {
    next(error);
  }
};

// @desc    Report user
// @route   POST /api/users/:id/report
// @access  Private
const reportUser = async (req, res, next) => {
  try {
    const { reason, details } = req.body;
    await Report.create({
      reportedBy: req.user._id,
      targetType: 'user',
      targetUser: req.params.id,
      reason,
      details,
    });
    res.json({ success: true, message: 'Report submitted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get suggested users to follow
// @route   GET /api/users/suggestions
// @access  Private
const getSuggestions = async (req, res, next) => {
  try {
    const currentUser = req.user;
    const excluded = [...currentUser.following, currentUser._id, ...currentUser.blockedUsers];

    const suggestions = await User.find({
      _id: { $nin: excluded },
      isActive: true,
    })
      .select('username name profilePic verifiedBadge accountType followersCount bio')
      .sort({ followersCount: -1, isVerified: -1 })
      .limit(10);

    res.json({ success: true, users: suggestions });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle post notifications for a user
// @route   POST /api/users/:id/notify-posts
// @access  Private
const togglePostNotifications = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const currentUser = await User.findById(req.user._id);
    const isEnabled = (currentUser.postNotifications || []).some(
      (id) => id.toString() === targetId
    );
    if (isEnabled) {
      currentUser.postNotifications.pull(targetId);
    } else {
      currentUser.postNotifications.push(targetId);
    }
    await currentUser.save({ validateBeforeSave: false });
    res.json({ success: true, enabled: !isEnabled });
  } catch (error) {
    next(error);
  }
};

// @desc    Save Expo push token
// @route   POST /api/users/push-token
// @access  Private
const savePushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });
    await User.findByIdAndUpdate(req.user._id, { expoPushToken: token });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Request verification badge
// @route   POST /api/users/verify-request
// @access  Private
const requestVerification = async (req, res, next) => {
  try {
    const { type, reason } = req.body;
    const validTypes = ['government', 'media', 'influencer', 'business'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid verification type' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const user = await User.findById(req.user._id);
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified' });
    }
    if (user.verificationRequest?.status === 'pending') {
      return res.status(409).json({ success: false, message: 'You already have a pending request' });
    }

    user.verificationRequest = {
      status: 'pending',
      type,
      reason: reason.trim().slice(0, 500),
      submittedAt: new Date(),
      adminNote: '',
    };
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Verification request submitted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  getUserPosts,
  toggleFollow,
  toggleBlock,
  updateProfile,
  searchUsers,
  getFollowers,
  reportUser,
  getSuggestions,
  savePushToken,
  togglePostNotifications,
  requestVerification,
};
