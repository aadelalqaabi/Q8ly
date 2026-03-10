const Ad = require('../models/Ad');

const now = () => new Date();

// GET /api/ads?placement=feed — active ads for a placement (public)
exports.getAds = async (req, res) => {
  try {
    const { placement = 'feed' } = req.query;
    const ads = await Ad.find({
      isActive: true,
      placement,
      startDate: { $lte: now() },
      endDate: { $gte: now() },
    }).sort({ priority: -1 }).limit(10);

    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ads/:id/impression — increment view count (fire-and-forget)
exports.recordImpression = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ads/:id/click — increment click count
exports.recordClick = async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin CRUD ────────────────────────────────────────────────────────────────

// GET /api/admin/ads
exports.getAllAds = async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/ads
exports.createAd = async (req, res) => {
  try {
    const { sponsor, sponsorLogo, title, body, imageUrl, ctaText, ctaUrl, placement, startDate, endDate, priority } = req.body;
    if (!sponsor || !title || !ctaUrl || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'sponsor, title, ctaUrl, startDate, endDate are required' });
    }
    const ad = await Ad.create({ sponsor, sponsorLogo, title, body, imageUrl, ctaText, ctaUrl, placement, startDate, endDate, priority: priority || 0 });
    res.status(201).json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/ads/:id
exports.updateAd = async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    res.json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/admin/ads/:id
exports.deleteAd = async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
