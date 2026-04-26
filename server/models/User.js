const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      // No default — omitting the field entirely lets the partial index ignore it
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
      default: null,
    },
    name: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    profilePic: {
      type: String,
      default: null,
    },
    coverPhoto: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: '',
    },
    district: {
      type: String,
      enum: [
        'Al Asimah',
        'Hawalli',
        'Farwaniyah',
        'Ahmadi',
        'Jahra',
        'Mubarak Al-Kabeer',
        '',
      ],
      default: '',
    },
    // Account type
    accountType: {
      type: String,
      enum: ['user', 'business', 'media', 'official'],
      default: 'user',
    },
    // Verification badge
    verifiedBadge: {
      type: String,
      enum: ['none', 'official', 'government', 'media', 'influencer', 'business', 'founder'],
      default: 'none',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isFounder: {
      type: Boolean,
      default: false,
    },
    // Email verification
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    // Social graph
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    // Followed topics and spaces
    followedTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    joinedSpaces: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Space' }],
    mutedTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    // Blocked users
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Users whose new posts trigger a push notification for this user
    postNotifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Stats
    postsCount: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    // Hachi point economy
    hachiPoints: { type: Number, default: 0 },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Invite system
    inviteCodes: [{
      code: { type: String, required: true },
      usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      usedAt: { type: Date, default: null },
    }],
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginBonusDate: { type: Date, default: null },
    // Admin role
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // Account status
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    banExpires: { type: Date, default: null },
    // Rate limiting for new accounts
    postRateLimit: {
      count: { type: Number, default: 0 },
      resetAt: { type: Date, default: Date.now },
    },
    lastSeen: { type: Date, default: Date.now },
    // Notification preferences
    notificationSettings: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      reposts: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
    },
    // Push notification token (Expo)
    expoPushToken: { type: String, default: null },
    // Bookmarked posts
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    // Pinned circles (max 3)
    pinnedCircles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hachi' }],
    // Verification request
    verificationRequest: {
      status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
      type: { type: String, enum: ['government', 'media', 'influencer', 'business', ''], default: '' },
      reason: { type: String, maxlength: 500, default: '' },
      submittedAt: { type: Date, default: null },
      adminNote: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: is account new (rate-limit consideration)
userSchema.virtual('isNewAccount').get(function () {
  const daysSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
  return daysSinceCreation < 7;
});

// Pre-save: hash password (only if set)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Sparse unique indexes — only enforced when the field is present (not null/missing)
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: public profile (safe to send to client)
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    username: this.username,
    name: this.name,
    profilePic: this.profilePic,
    bio: this.bio,
    district: this.district,
    accountType: this.accountType,
    verifiedBadge: this.verifiedBadge,
    isVerified: this.isVerified,
    isFounder: this.isFounder,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    postsCount: this.postsCount,
    likesReceived: this.likesReceived,
    hachiPoints: this.hachiPoints || 0,
    inviteCodes: (this.inviteCodes || []).map((c) => ({
      code: c.code,
      used: !!c.usedBy,
      usedBy: c.usedBy || null,
      usedAt: c.usedAt || null,
    })),
    pinnedCircles: (this.pinnedCircles || []).map(String),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
