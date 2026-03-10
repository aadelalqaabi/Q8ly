const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Suggestion = require('../models/Suggestion');

// POST /api/suggestions — mobile app submits a suggestion
router.post('/', protect, async (req, res) => {
  try {
    const { text, category } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Suggestion text is required' });
    }
    const suggestion = await Suggestion.create({
      userId: req.user._id,
      text: text.trim(),
      category: category || 'feature',
    });
    res.status(201).json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/suggestions/mine — user's own suggestions
router.get('/mine', protect, async (req, res) => {
  try {
    const suggestions = await Suggestion.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, suggestions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
