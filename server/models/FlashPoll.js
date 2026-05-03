const mongoose = require('mongoose');

// One poll inside one circle. Self-destructs at expiresAt via MongoDB TTL.
// Each user can have at most one vote — voters[] on each option.

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 80, trim: true },
  voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: true });

const flashPollSchema = new mongoose.Schema({
  circle:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hachi', required: true, index: true },
  creator:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  question:  { type: String, required: true, maxlength: 120, trim: true },
  options:   { type: [optionSchema], validate: (v) => v.length >= 2 && v.length <= 4 },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

// Auto-delete expired docs
flashPollSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FlashPoll', flashPollSchema);
