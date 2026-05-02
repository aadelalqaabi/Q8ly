const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 60, trim: true },
  voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: true });

const flashPollSchema = new mongoose.Schema({
  circle: { type: mongoose.Schema.Types.ObjectId, ref: 'Hachi', required: true, index: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true, maxlength: 100, trim: true },
  options: [optionSchema],
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

// TTL: MongoDB will delete docs at expiresAt automatically
flashPollSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FlashPoll', flashPollSchema);
