const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const Topic = require('../models/Topic');
const { sendOtp: sendOtpSvc, verifyOtp: verifyOtpSvc, normalizePhone } = require('../services/otpService');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateUniqueUsername(name) {
  // "Ahmad Al Rashidi" → "ahmadalrashidi"
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14) || 'user';

  let username = base;
  let exists = await User.findOne({ username });
  while (exists) {
    username = base + Math.floor(1000 + Math.random() * 9000);
    exists = await User.findOne({ username });
  }
  return username;
}

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

// @desc    Send OTP to phone number
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

    const normalized = normalizePhone(phone);

    // Basic E.164 check
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const result = await sendOtpSvc(normalized);

    // Let the client know if this is a new or existing account
    const existingUser = await User.findOne({ phone: normalized });

    res.json({
      success: true,
      isNewUser: !existingUser,
      testMode: result.testMode || false,
      message: result.testMode
        ? 'Test mode: use code 123456'
        : 'Verification code sent via SMS',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and sign in / register
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, code, name } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code are required' });
    }

    const normalized = normalizePhone(phone);

    const check = await verifyOtpSvc(normalized, code);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.reason || 'Invalid code' });
    }

    // Find or create user
    let user = await User.findOne({ phone: normalized });

    const isNewUser = !user;

    if (!user) {
      // New user — name is set in the next onboarding step
      const providedName = name?.trim() || '';
      const username = providedName
        ? await generateUniqueUsername(providedName)
        : `user${Date.now().toString().slice(-5)}`;
      user = await User.create({
        phone: normalized,
        phoneVerified: true,
        name: providedName,
        username,
      });

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
    } else {
      // Existing user — mark phone as verified and update lastSeen
      user.phoneVerified = true;
      user.lastSeen = Date.now();
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }
    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Account is banned' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      isNewUser,
      message: isNewUser ? 'Account created' : 'Login successful',
      token,
      user: { ...user.toPublicProfile(), phone: user.phone },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Direct login for founder dummy accounts (no OTP store dependency)
// @route   POST /api/dev/dummy-auth
// @access  Public (but restricted to dummy phone range server-side)
const dummyAuth = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });

    const normalized = normalizePhone(phone);

    // Only allow the 50 dummy phones (+96500000001 – +96500000050)
    if (!/^\+965000000(0[1-9]|[1-4][0-9]|50)$/.test(normalized)) {
      return res.status(403).json({ success: false, message: 'Not a dummy account' });
    }

    const user = await User.findOne({ phone: normalized });
    if (!user) return res.status(404).json({ success: false, message: 'Dummy account not seeded' });

    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated' });

    user.lastSeen = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: { ...user.toPublicProfile(), phone: user.phone },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updatePassword, updatePushToken, sendOtp, verifyOtp, dummyAuth };
