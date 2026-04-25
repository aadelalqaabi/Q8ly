const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const Topic = require('../models/Topic');
const { sendOtp: sendOtpSvc, verifyOtp: verifyOtpSvc, normalizePhone } = require('../services/otpService');

// ── Constants ─────────────────────────────────────────────────────────────────
const EARLY_ADOPTER_LIMIT = 500;   // first N users get the big grant
const EARLY_ADOPTER_GRANT = 500;
const STANDARD_GRANT = 100;
const DAILY_BONUS = 10;
const REFERRAL_BONUS = 100;        // both sides
const FOUNDER_INVITES = 50;        // founder gets extra invites
const INVITE_COST_POINTS = 50;     // points to buy 1 extra invite

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char e.g. "B7E2C1"
}

function generateReferralCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char e.g. "A3F9B2"
}

// Kuwait midnight: UTC+3, so Kuwait day changes at 21:00 UTC
function kuwaitDayStart() {
  const now = new Date();
  // Shift to Kuwait time (+3h), floor to midnight, shift back to UTC
  const kw = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  kw.setUTCHours(0, 0, 0, 0);
  return new Date(kw.getTime() - 3 * 60 * 60 * 1000);
}

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
    const { phone, code, name, referralCode, inviteCode } = req.body;
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
      // ── Invite code required for new users ──
      if (!inviteCode) {
        return res.status(403).json({ success: false, message: 'Invite code required', needsInvite: true });
      }
      const inviter = await User.findOne({ inviteCode: inviteCode.toUpperCase() });
      if (!inviter) {
        return res.status(403).json({ success: false, message: 'Invalid invite code', needsInvite: true });
      }
      if (inviter.invitesRemaining <= 0) {
        return res.status(403).json({ success: false, message: 'This invite code has no remaining invites', needsInvite: true });
      }

      // Determine welcome grant: first 500 real users get 500, rest get 100
      const realUserCount = await User.countDocuments({ phoneVerified: true });
      const welcomeGrant = realUserCount < EARLY_ADOPTER_LIMIT ? EARLY_ADOPTER_GRANT : STANDARD_GRANT;

      // New user — name is set in the next onboarding step
      const providedName = name?.trim() || '';
      const username = providedName
        ? await generateUniqueUsername(providedName)
        : `user${Date.now().toString().slice(-5)}`;

      // Generate unique referral code
      let newReferralCode;
      let codeConflict = true;
      while (codeConflict) {
        newReferralCode = generateReferralCode();
        codeConflict = await User.exists({ referralCode: newReferralCode });
      }

      // Generate unique invite code for the new user
      let newInviteCode;
      let inviteConflict = true;
      while (inviteConflict) {
        newInviteCode = generateInviteCode();
        inviteConflict = await User.exists({ inviteCode: newInviteCode });
      }

      user = await User.create({
        phone: normalized,
        phoneVerified: true,
        name: providedName,
        username,
        hachiPoints: welcomeGrant,
        referralCode: newReferralCode,
        inviteCode: newInviteCode,
        invitesRemaining: 3,
        invitedBy: inviter._id,
      });

      // Decrement inviter's remaining invites and award bonus
      await User.findByIdAndUpdate(inviter._id, {
        $inc: { invitesRemaining: -1, hachiPoints: REFERRAL_BONUS },
      });

      // Handle referral: if a valid referral code was provided, award both parties
      if (referralCode) {
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referrer && referrer._id.toString() !== user._id.toString()) {
          user.referredBy = referrer._id;
          user.hachiPoints += REFERRAL_BONUS;
          await user.save({ validateBeforeSave: false });
          await User.findByIdAndUpdate(referrer._id, { $inc: { hachiPoints: REFERRAL_BONUS } });
        }
      }

      // Auto-follow default topics
      const defaultTopics = await Topic.find({ isOfficial: true }).limit(6).select('_id');
      if (defaultTopics.length > 0) {
        user.followedTopics = defaultTopics.map((t) => t._id);
        await user.save({ validateBeforeSave: false });
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
    if (!/^\+965000000(0[1-9]|1[0-9]|20)$/.test(normalized)) {
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

// @desc    Claim daily login bonus (+10 points, once per Kuwait day)
// @route   POST /api/auth/daily-bonus
// @access  Private
const claimDailyBonus = async (req, res, next) => {
  try {
    const user = req.user;
    const dayStart = kuwaitDayStart();

    if (user.lastLoginBonusDate && user.lastLoginBonusDate >= dayStart) {
      // Already claimed today
      return res.json({
        success: true,
        alreadyClaimed: true,
        hachiPoints: user.hachiPoints,
      });
    }

    user.hachiPoints = (user.hachiPoints || 0) + DAILY_BONUS;
    user.lastLoginBonusDate = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      alreadyClaimed: false,
      bonus: DAILY_BONUS,
      hachiPoints: user.hachiPoints,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Redeem a referral code after signup (only once, only if not already referred)
// @route   POST /api/auth/redeem-referral
// @access  Private
const redeemReferral = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.referredBy) {
      return res.status(400).json({ success: false, message: 'Already redeemed a referral' });
    }

    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const referrer = await User.findOne({ referralCode: code.toUpperCase().trim() });
    if (!referrer) return res.status(404).json({ success: false, message: 'Invalid referral code' });
    if (referrer._id.toString() === user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot use your own code' });
    }

    user.referredBy = referrer._id;
    user.hachiPoints = (user.hachiPoints || 0) + REFERRAL_BONUS;
    await user.save({ validateBeforeSave: false });

    await User.findByIdAndUpdate(referrer._id, { $inc: { hachiPoints: REFERRAL_BONUS } });

    res.json({ success: true, bonus: REFERRAL_BONUS, hachiPoints: user.hachiPoints });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate an invite code (no auth needed)
// @route   POST /api/auth/validate-invite
// @access  Public
const validateInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ success: false, valid: false });
    const inviter = await User.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
    if (!inviter || inviter.invitesRemaining <= 0) {
      return res.json({ success: true, valid: false });
    }
    res.json({ success: true, valid: true, inviterName: inviter.name || inviter.username });
  } catch (error) {
    next(error);
  }
};

// @desc    Buy an extra invite with points
// @route   POST /api/auth/buy-invite
// @access  Private
const buyInvite = async (req, res, next) => {
  try {
    const user = req.user;
    if ((user.hachiPoints || 0) < INVITE_COST_POINTS) {
      return res.status(400).json({ success: false, message: 'Not enough points' });
    }
    user.hachiPoints -= INVITE_COST_POINTS;
    user.invitesRemaining = (user.invitesRemaining || 0) + 1;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, invitesRemaining: user.invitesRemaining, hachiPoints: user.hachiPoints });
  } catch (error) {
    next(error);
  }
};

// @desc    Join waitlist
// @route   POST /api/auth/waitlist
// @access  Public
const joinWaitlist = async (req, res, next) => {
  try {
    const Waitlist = require('../models/Waitlist');
    const { phone, lang } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
    const normalized = normalizePhone(phone);

    const existing = await Waitlist.findOne({ phone: normalized });
    if (existing) {
      return res.json({ success: true, message: 'Already on waitlist', position: await Waitlist.countDocuments({ status: 'waiting', createdAt: { $lte: existing.createdAt } }) });
    }

    await Waitlist.create({ phone: normalized, lang: lang || 'ar' });
    const position = await Waitlist.countDocuments({ status: 'waiting' });
    res.status(201).json({ success: true, message: 'Added to waitlist', position });
  } catch (error) {
    if (error.code === 11000) {
      return res.json({ success: true, message: 'Already on waitlist' });
    }
    next(error);
  }
};

module.exports = { register, login, getMe, updatePassword, updatePushToken, sendOtp, verifyOtp, dummyAuth, claimDailyBonus, redeemReferral, validateInvite, buyInvite, joinWaitlist };
