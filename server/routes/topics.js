const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const {
  getTrending, getTopics, getTopic, getTopicPosts,
  toggleFollow, toggleMute, searchTopics,
} = require('../controllers/topicController');

router.get('/trending', optionalAuth, getTrending);
router.get('/search', optionalAuth, searchTopics);
router.get('/', optionalAuth, getTopics);
router.get('/:slug', optionalAuth, getTopic);
router.get('/:slug/posts', optionalAuth, getTopicPosts);
router.post('/:id/follow', protect, toggleFollow);
router.post('/:id/mute', protect, toggleMute);

module.exports = router;
