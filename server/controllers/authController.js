const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const Topic = require('../models/Topic');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { username, email, password, name, phone } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({ success: false, message: `This ${field} is already registered` });
    }

    // Create user
    const user = await User.create({ username, email, password, name, phone });

    // Auto-follow default topics
    const defaultTopics = await Topic.find({ isOfficial: true }).limit(6).select('_id');
    if (defaultTopics.length > 0) {
      user.followedTopics = defaultTopics.map((t) => t._id);
      await user.save();
      await Topic.updateMany(
        { _id: { $in: defaultTopics.map((t) => t._id) } },
        { $inc: { followersCount: 1 } }
      );
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier = email or username

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Account is banned' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last seen
    user.lastSeen = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followedTopics', 'name nameAr slug color icon')
      .populate('joinedSpaces', 'name nameAr slug type icon');

    res.json({
      success: true,
      user: {
        ...user.toPublicProfile(),
        email: user.email,
        phone: user.phone,
        followedTopics: user.followedTopics,
        joinedSpaces: user.joinedSpaces,
        mutedTopics: user.mutedTopics,
        notificationSettings: user.notificationSettings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id);
    res.json({ success: true, message: 'Password updated successfully', token });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Expo push token
// @route   PUT /api/auth/push-token
// @access  Private
const updatePushToken = async (req, res, next) => {
  try {
    const { expoPushToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { expoPushToken });
    res.json({ success: true, message: 'Push token updated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updatePassword, updatePushToken };
