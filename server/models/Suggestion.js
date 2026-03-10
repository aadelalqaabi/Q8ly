const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  category: {
    type: String,
    enum: ['feature', 'bug', 'design', 'content', 'other'],
    default: 'feature',
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'planned', 'done', 'rejected'],
    default: 'pending',
  },
  adminNote: { type: String, default: '' },
}, { timestamps: true });

suggestionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
