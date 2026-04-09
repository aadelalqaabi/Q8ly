const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // What is being reported
    targetType: {
      type: String,
      enum: ['post', 'comment', 'user', 'circle_message'],
      required: true,
    },
    targetPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    targetComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hachi',
      default: null,
    },
    targetMessage: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Reason
    reason: {
      type: String,
      enum: [
        'harassment',
        'hate_speech',
        'fake_news',
        'spam',
        'explicit_content',
        'privacy',
        'violence',
        'other',
      ],
      required: true,
    },
    details: {
      type: String,
      maxlength: [500, 'Details cannot exceed 500 characters'],
      default: '',
    },
    // Moderation status
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'actioned', 'dismissed'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    actionTaken: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedBy: 1 });

module.exports = mongoose.model('Report', reportSchema);
