const mongoose = require('mongoose');

const kuwaitBriefSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    period: {
      type: String,
      enum: ['morning', 'evening'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    titleAr: {
      type: String,
      maxlength: 100,
    },
    items: [
      {
        category: {
          type: String,
          enum: ['news', 'decision', 'incident', 'trend', 'offer', 'event'],
          required: true,
        },
        content: {
          type: String,
          required: true,
          maxlength: 300,
        },
        contentAr: {
          type: String,
          maxlength: 300,
        },
        linkedPost: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Post',
          default: null,
        },
        linkedTopic: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Topic',
          default: null,
        },
        emoji: { type: String, default: null },
      },
    ],
    // Curated by
    curatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = system-generated (manual admin input)
    },
    // Stats
    viewsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

kuwaitBriefSchema.index({ date: -1, period: 1 });
kuwaitBriefSchema.index({ isPublished: 1, date: -1 });

module.exports = mongoose.model('KuwaitBrief', kuwaitBriefSchema);
