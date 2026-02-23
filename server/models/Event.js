const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    titleAr: {
      type: String,
      trim: true,
      maxlength: [100, 'Arabic title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    descriptionAr: {
      type: String,
      maxlength: [1000, 'Arabic description cannot exceed 1000 characters'],
      default: '',
    },
    // Creator
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Timing
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    // Location
    venueName: {
      type: String,
      maxlength: [100, 'Venue name cannot exceed 100 characters'],
      default: null,
    },
    district: {
      type: String,
      enum: [
        'Al Asimah',
        'Hawalli',
        'Farwaniyah',
        'Ahmadi',
        'Jahra',
        'Mubarak Al-Kabeer',
        'Online',
        null,
      ],
      default: null,
    },
    address: { type: String, default: null },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    // Category
    category: {
      type: String,
      enum: [
        'social',
        'cultural',
        'sports',
        'business',
        'educational',
        'entertainment',
        'food',
        'other',
      ],
      default: 'other',
    },
    // Media
    coverImage: { type: String, default: null },
    // Attendees
    rsvps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    rsvpCount: { type: Number, default: 0 },
    maxAttendees: { type: Number, default: null },
    // Pricing
    isFree: { type: Boolean, default: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'KWD' },
    // Linked space
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Space',
      default: null,
    },
    // Status
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'past', 'cancelled'],
      default: 'upcoming',
    },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ district: 1, startDate: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1, startDate: 1 });

module.exports = mongoose.model('Event', eventSchema);
