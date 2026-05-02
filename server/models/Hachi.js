const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId }],
}, { _id: false });

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, maxlength: 500, trim: true },
  image: { type: String },
  video: { type: String },
  videoThumbnail: { type: String },
  voiceUrl: { type: String },
  voiceDuration: { type: Number },
  isLive: { type: Boolean, default: false },
  reactions: [reactionSchema],
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId },
    text: { type: String },
    userName: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const CATEGORIES = ['general', 'food', 'coffee', 'cars', 'girls', 'sports', 'tech', 'finance', 'travel', 'entertainment', 'gaming', 'realestate'];

const hachiSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 80, trim: true },
  category: { type: String, enum: CATEGORIES, default: 'general', index: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberCount: { type: Number, default: 1 },
  messages: [messageSchema],
  isActive: { type: Boolean, default: true, index: true },
  isPublic: { type: Boolean, default: true },
  blockedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    username: { type: String },
    requestedAt: { type: Date, default: Date.now },
  }],
  reactions: {
    fire:  { type: Number, default: 0 },
    eyes:  { type: Number, default: 0 },
    skull: { type: Number, default: 0 },
  },
  lastMessage: {
    text:      { type: String, default: '' },
    createdAt: { type: Date },
  },
  summary: {
    messageCount:     { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },
    excerpt:          { type: String,  default: '' },
  },
  // Set when this circle first reaches #1 in velocity ranking → creator gets bonus
  trendingAwardedAt: { type: Date, default: null },
  // Creator's location at time of creation (optional)
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },

  // Venue data — set for auto-generated OSM circles
  isVenueCircle: { type: Boolean, default: false, index: true },
  venueName: { type: String },
  venueType: { type: String },
  venueCoords: {
    lat: { type: Number },
    lng: { type: Number },
  },
  venueRadius: { type: Number }, // meters — derived from venue type
  vibeTheme: {
    primaryColor: { type: String },
    accentColor: { type: String },
    isDark: { type: Boolean, default: true },
    fontWeight: { type: String, default: '600' },
  },

  // Live presence: users confirmed physically at this venue in last 30 min
  hereNow: [{
    userId: { type: mongoose.Schema.Types.ObjectId },
    confidence: { type: Number },
    expiresAt: { type: Date },
  }],
}, { timestamps: true });

hachiSchema.index({ isActive: 1, memberCount: -1, createdAt: -1 });
hachiSchema.index({ location: '2dsphere' }, { sparse: true });

module.exports = mongoose.model('Hachi', hachiSchema);
module.exports.CATEGORIES = CATEGORIES;
