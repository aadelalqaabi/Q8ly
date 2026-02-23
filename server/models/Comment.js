const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: [300, 'Comment cannot exceed 300 characters'],
      trim: true,
    },
    // Threading
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    depth: {
      type: Number,
      default: 0,
      max: 2, // Max 3 levels deep (0, 1, 2)
    },
    repliesCount: { type: Number, default: 0 },
    // Interactions
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Moderation
    isReported: { type: Boolean, default: false },
    reportsCount: { type: Number, default: 0 },
    isRemoved: { type: Boolean, default: false },
    removedReason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, likesCount: -1 });
commentSchema.index({ parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
