const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getSpaces, getSpace, getSpaceFeed, createSpace, toggleJoin, searchSpaces } = require('../controllers/spaceController');

router.get('/search', optionalAuth, searchSpaces);
router.get('/', optionalAuth, getSpaces);
router.post(
  '/',
  protect,
  [
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase letters, numbers, and hyphens'),
    body('type').isIn(['location', 'interest', 'institution']).withMessage('Invalid type'),
  ],
  validate,
  createSpace
);
router.get('/:slug', optionalAuth, getSpace);
router.get('/:slug/feed', optionalAuth, getSpaceFeed);
router.post('/:id/join', protect, toggleJoin);

module.exports = router;
