const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getConversations, getOrCreateConversation, sendMessage, getUnreadCount } = require('../controllers/dmController');

router.get('/unread-count', protect, getUnreadCount);
router.get('/', protect, getConversations);
router.get('/:userId', protect, getOrCreateConversation);
router.post('/:userId', protect, sendMessage);

module.exports = router;
