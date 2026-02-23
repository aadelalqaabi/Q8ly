const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getEvents, getEvent, createEvent, toggleRsvp } = require('../controllers/eventController');

router.get('/', optionalAuth, getEvents);
router.get('/:id', optionalAuth, getEvent);
router.post(
  '/',
  protect,
  [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title required'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
  ],
  validate,
  createEvent
);
router.post('/:id/rsvp', protect, toggleRsvp);

module.exports = router;
