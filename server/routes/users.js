const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  getProfile, getUserPosts, toggleFollow, toggleBlock,
  updateProfile, searchUsers, getFollowers, reportUser, getSuggestions,
} = require('../controllers/userController');

router.get('/search', optionalAuth, searchUsers);
router.get('/suggestions', protect, getSuggestions);
router.get('/:username', optionalAuth, getProfile);
router.get('/:username/posts', optionalAuth, getUserPosts);
router.get('/:username/followers', optionalAuth, getFollowers);
router.get('/:username/following', optionalAuth, getFollowers);
router.post('/:id/follow', protect, toggleFollow);
router.post('/:id/block', protect, toggleBlock);
router.post('/:id/report', protect, reportUser);
router.put('/profile', protect, updateProfile);

module.exports = router;
