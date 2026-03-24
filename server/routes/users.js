const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  getProfile, getUserPosts, toggleFollow, toggleBlock,
  updateProfile, searchUsers, getFollowers, reportUser, getSuggestions, savePushToken,
  togglePostNotifications, requestVerification, deleteAccount,
} = require('../controllers/userController');
const { getBookmarks } = require('../controllers/postController');

router.post('/push-token', protect, savePushToken);
router.get('/search', optionalAuth, searchUsers);
router.get('/suggestions', protect, getSuggestions);
router.get('/bookmarks', protect, getBookmarks);
router.get('/:username', optionalAuth, getProfile);
router.get('/:username/posts', optionalAuth, getUserPosts);
router.get('/:username/followers', optionalAuth, getFollowers);
router.get('/:username/following', optionalAuth, getFollowers);
router.post('/:id/follow', protect, toggleFollow);
router.post('/:id/notify-posts', protect, togglePostNotifications);
router.post('/:id/block', protect, toggleBlock);
router.post('/:id/report', protect, reportUser);
router.put('/profile', protect, updateProfile);
router.post('/verify-request', protect, requestVerification);
router.delete('/account', protect, deleteAccount);

module.exports = router;
