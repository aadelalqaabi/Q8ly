const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { register, login, getMe, updatePassword, updatePushToken, sendOtp, verifyOtp } = require('../controllers/authController');

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3–30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Name is required'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('identifier').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', protect, getMe);

router.put(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  updatePassword
);

router.put('/push-token', protect, updatePushToken);

// Phone OTP auth
router.post(
  '/send-otp',
  [body('phone').trim().notEmpty().withMessage('Phone number is required')],
  validate,
  sendOtp
);

router.post(
  '/verify-otp',
  [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  ],
  validate,
  verifyOtp
);

module.exports = router;
