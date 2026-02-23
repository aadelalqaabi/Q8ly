const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Topic name is required'],
      trim: true,
      maxlength: [50, 'Topic name cannot exceed 50 characters'],
    },
    nameAr: {
      type: String,
      trim: true,
      maxlength: [50, 'Arabic name cannot exceed 50 characters'],
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
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    descriptionAr: {
      type: String,
      maxlength: [200, 'Arabic description cannot exceed 200 characters'],
      default: '',
    },
    // Category
    category: {
      type: String,
      enum: [
        'politics',
        'society',
        'traffic',
        'jobs',
        'realestate',
        'sports',
        'events',
        'offers',
        'technology',
        'health',
        'entertainment',
        'other',
      ],
      default: 'other',
    },
    icon: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: '#C8102E', // Kuwait flag red
    },
    // Stats
    followersCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    // Official topic (curated by admins)
    isOfficial: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    // Pinned official post
    pinnedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    // Active status
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

topicSchema.index({ slug: 1 });
topicSchema.index({ trendingScore: -1 });
topicSchema.index({ category: 1 });

module.exports = mongoose.model('Topic', topicSchema);
