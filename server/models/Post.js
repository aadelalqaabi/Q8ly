const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Content
    content: {
      type: String,
      maxlength: [500, 'Post content cannot exceed 500 characters'],
      default: '',
    },
    // Media
    images: [{ type: String }],
    video: { type: String, default: null },
    videoThumbnail: { type: String, default: null },
    // Post type
    type: {
      type: String,
      enum: ['text', 'photo', 'video', 'poll', 'repost', 'event', 'offer'],
      default: 'text',
    },
    // Poll data
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
          votesCount: { type: Number, default: 0 },
        },
      ],
      expiresAt: Date,
      totalVotes: { type: Number, default: 0 },
    },
    // Repost reference
    originalPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    // Tagging
    topicTags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    spaceTags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Space' }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hashtags: [{ type: String }],
    // Location
    location: {
      district: { type: String, default: null },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    // Visibility
    visibility: {
      type: String,
      enum: ['public', 'followers', 'space'],
      default: 'public',
    },
    // Interactions
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    repostsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    // Trending score (calculated periodically)
    trendingScore: { type: Number, default: 0 },
    // Pinned in a space
    isPinned: { type: Boolean, default: false },
    pinnedIn: { type: mongoose.Schema.Types.ObjectId, ref: 'Space', default: null },
    // Moderation
    isReported: { type: Boolean, default: false },
    reportsCount: { type: Number, default: 0 },
    isRemoved: { type: Boolean, default: false },
    removedReason: { type: String, default: null },
    // Fact-check/community note
    hasCommunityNote: { type: Boolean, default: false },
    communityNote: {
      content: String,
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: Date,
    },
    // Kuwait Brief
    isKuwaitBrief: { type: Boolean, default: false },
    briefDate: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
postSchema.index({ createdAt: -1, topicTags: 1 });
postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ trendingScore: -1 });
postSchema.index({ isKuwaitBrief: 1, briefDate: -1 });

// Calculate trending score based on recency + engagement
postSchema.methods.calculateTrendingScore = function () {
  const now = Date.now();
  const ageHours = (now - this.createdAt) / (1000 * 60 * 60);
  const engagementScore = this.likesCount * 1 + this.commentsCount * 2 + this.repostsCount * 3;
  // Decay factor: halve score every 12 hours
  this.trendingScore = engagementScore / Math.pow(1 + ageHours / 12, 1.5);
  return this.trendingScore;
};

module.exports = mongoose.model('Post', postSchema);
