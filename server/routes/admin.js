const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  login, getStats, getUsers, banUser, deleteUser, verifyUser,
  getPosts, removePost, getReportedPosts, dismissReport, getSuggestions, updateSuggestion,
  sendPushNotification,
} = require('../controllers/adminController');
const { getAllAds, createAd, updateAd, deleteAd } = require('../controllers/adController');

// Public: admin login
router.post('/login', login);

// All routes below require admin token
router.use(adminAuth);

router.get('/stats', getStats);

router.get('/users', getUsers);
router.patch('/users/:id/ban', banUser);
router.patch('/users/:id/verify', verifyUser);
router.delete('/users/:id', deleteUser);

router.get('/posts', getPosts);
router.patch('/posts/:id/remove', removePost);
router.get('/reports', getReportedPosts);
router.patch('/posts/:id/dismiss-report', dismissReport);

router.get('/suggestions', getSuggestions);
router.patch('/suggestions/:id', updateSuggestion);

// Push notifications
router.post('/push', sendPushNotification);

// Ads management
router.get('/ads', getAllAds);
router.post('/ads', createAd);
router.patch('/ads/:id', updateAd);
router.delete('/ads/:id', deleteAd);

module.exports = router;
