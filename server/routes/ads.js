const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAds, recordImpression, recordClick } = require('../controllers/adController');

// Public — fetch active ads for a placement
router.get('/', getAds);

// Authenticated — record analytics (fire-and-forget, best effort)
router.post('/:id/impression', protect, recordImpression);
router.post('/:id/click', protect, recordClick);

module.exports = router;
