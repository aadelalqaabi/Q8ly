const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true },
  lang: { type: String, enum: ['ar', 'en'], default: 'ar' },
  status: { type: String, enum: ['waiting', 'invited', 'joined'], default: 'waiting' },
  invitedAt: { type: Date, default: null },
}, { timestamps: true });

waitlistSchema.index({ phone: 1 }, { unique: true });
waitlistSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
