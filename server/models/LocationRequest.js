const mongoose = require('mongoose');

const locationRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 80, trim: true },
  note: { type: String, maxlength: 200, trim: true },
  coords: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true,
  },
  approvedCircle: { type: mongoose.Schema.Types.ObjectId, ref: 'Hachi' },
}, { timestamps: true });

module.exports = mongoose.model('LocationRequest', locationRequestSchema);
