const mongoose = require('mongoose');

const spaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Space name is required'],
      trim: true,
      maxlength: [60, 'Space name cannot exceed 60 characters'],
    },
    nameAr: {
      type: String,
      trim: true,
      maxlength: [60, 'Arabic name cannot exceed 60 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    descriptionAr: {
      type: String,
      maxlength: [300, 'Arabic description cannot exceed 300 characters'],
      default: '',
    },
    // Space type
    type: {
      type: String,
      enum: ['location', 'interest', 'institution'],
      required: true,
    },
    // Location-specific fields
    district: {
      type: String,
      enum: [
        'Al Asimah',
        'Hawalli',
        'Farwaniyah',
        'Ahmadi',
        'Jahra',
        'Mubarak Al-Kabeer',
        null,
      ],
      default: null,
    },
    // Visuals
    coverPhoto: { type: String, default: null },
    icon: { type: String, default: null },
    color: { type: String, default: '#007A3D' }, // Kuwait flag green
    // Membership
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    membersCount: { type: Number, default: 0 },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Rules
    rules: [
      {
        title: String,
        titleAr: String,
        description: String,
        descriptionAr: String,
      },
    ],
    // Pinned posts
    pinnedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    // Stats
    postsCount: { type: Number, default: 0 },
    // Official space (curated by admins, e.g., government ministries)
    isOfficial: { type: Boolean, default: false },
    // Visibility
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    // Trending
    trendingScore: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

spaceSchema.index({ type: 1 });
spaceSchema.index({ district: 1 });
spaceSchema.index({ trendingScore: -1 });

module.exports = mongoose.model('Space', spaceSchema);
