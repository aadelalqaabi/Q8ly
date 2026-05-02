const LocationRequest = require('../models/LocationRequest');
const Hachi = require('../models/Hachi');
const { venueRadiusFor, categoryFor } = require('../utils/locationUtils');

// POST /api/location-requests
exports.create = async (req, res) => {
  try {
    const { name, note = '', lat, lng } = req.body;
    if (!name?.trim() || lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'name + lat + lng required' });
    }
    const request = await LocationRequest.create({
      user: req.user._id,
      name: name.trim(),
      note: note.trim(),
      coords: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/location-requests/mine
exports.listMine = async (req, res) => {
  try {
    const requests = await LocationRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — GET /api/admin/location-requests?status=pending
exports.adminList = async (req, res) => {
  try {
    const status = req.query.status;
    const query = status && ['pending', 'approved', 'denied'].includes(status) ? { status } : {};
    const requests = await LocationRequest.find(query)
      .populate('user', 'name username phone')
      .sort({ status: 1, createdAt: -1 })
      .limit(200);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — POST /api/admin/location-requests/:id/approve
// Body: { venueType, radius, category }
exports.adminApprove = async (req, res) => {
  try {
    const request = await LocationRequest.findById(req.params.id).populate('user', '_id');
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Already processed' });
    }

    const { venueType = 'default', radius, category } = req.body;
    const finalRadius = radius || venueRadiusFor(venueType);
    const finalCategory = category || categoryFor(venueType);

    // Find the founder to be the creator
    const User = require('../models/User');
    const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
    const creatorId = founder?._id || request.user._id;

    const circle = await Hachi.create({
      title: request.name,
      category: finalCategory,
      creator: creatorId,
      isPublic: true,
      isVenueCircle: true,
      venueName: request.name,
      venueType,
      venueCoords: request.coords,
      venueRadius: finalRadius,
      location: { type: 'Point', coordinates: [request.coords.lng, request.coords.lat] },
      members: [creatorId],
      memberCount: 0,
    });

    request.status = 'approved';
    request.approvedCircle = circle._id;
    await request.save();

    res.json({ success: true, circle, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — POST /api/admin/location-requests/:id/deny
exports.adminDeny = async (req, res) => {
  try {
    const request = await LocationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    request.status = 'denied';
    await request.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — PATCH /api/admin/circles/:id  — update vibe theme + radius
exports.adminUpdateCircle = async (req, res) => {
  try {
    const updates = {};
    const allowed = ['venueRadius', 'venueName', 'venueType', 'isActive'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.coords?.lat && req.body.coords?.lng) {
      updates.venueCoords = { lat: req.body.coords.lat, lng: req.body.coords.lng };
      updates.location = { type: 'Point', coordinates: [req.body.coords.lng, req.body.coords.lat] };
    }
    if (req.body.vibeTheme) {
      updates.vibeTheme = req.body.vibeTheme;
    }
    const circle = await Hachi.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!circle) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, circle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — POST /api/admin/circles  — create custom circle
exports.adminCreateCircle = async (req, res) => {
  try {
    const { name, lat, lng, venueType = 'default', radius, category, vibeTheme } = req.body;
    if (!name?.trim() || lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'name + lat + lng required' });
    }
    const User = require('../models/User');
    const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
    const creatorId = founder?._id;

    const circle = await Hachi.create({
      title: name.trim(),
      category: category || categoryFor(venueType),
      creator: creatorId,
      isPublic: true,
      isVenueCircle: true,
      venueName: name.trim(),
      venueType,
      venueCoords: { lat: parseFloat(lat), lng: parseFloat(lng) },
      venueRadius: radius || venueRadiusFor(venueType),
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      vibeTheme: vibeTheme || undefined,
      members: [creatorId],
      memberCount: 0,
    });
    res.status(201).json({ success: true, circle });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
