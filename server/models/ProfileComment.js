const mongoose = require('mongoose');

const profileCommentSchema = new mongoose.Schema(
  {
    profileUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },
  },
  { timestamps: true }
);

profileCommentSchema.index({ profileUser: 1, createdAt: -1 });

module.exports = mongoose.model('ProfileComment', profileCommentSchema);
