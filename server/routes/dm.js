const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getConversations, getOrCreateConversation, sendMessage, getUnreadCount, acceptRequest, denyRequest } = require('../controllers/dmController');

router.get('/unread-count', protect, getUnreadCount);
router.get('/', protect, getConversations);
router.patch('/:conversationId/accept', protect, acceptRequest);
router.delete('/:conversationId/deny', protect, denyRequest);
router.get('/:userId', protect, getOrCreateConversation);
router.post('/:userId', protect, sendMessage);

module.exports = router;
