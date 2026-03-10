const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  // Who's advertising
  sponsor: { type: String, required: true, trim: true },       // "مطعم البرجر"
  sponsorLogo: { type: String },                                // Cloudinary URL

  // Ad content
  title: { type: String, required: true, maxlength: 80, trim: true },
  body: { type: String, maxlength: 200, trim: true },
  imageUrl: { type: String },                                   // main creative

  // CTA
  ctaText: { type: String, maxlength: 30, trim: true },         // "اطلب الآن"
  ctaUrl: { type: String, required: true },                     // website or deep link

  // Placement
  placement: {
    type: String,
    enum: ['feed', 'hachi', 'discover'],
    default: 'feed',
    index: true,
  },

  // Scheduling
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true, index: true },

  // Simple analytics
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },

  // Priority — higher number = shown first when multiple ads are active
  priority: { type: Number, default: 0 },
}, { timestamps: true });

// Compound index for fast active-ad queries
adSchema.index({ isActive: 1, placement: 1, startDate: 1, endDate: 1, priority: -1 });

module.exports = mongoose.model('Ad', adSchema);
