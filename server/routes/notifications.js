const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAsRead, getUnreadCount, deleteNotification } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.get('/count', protect, getUnreadCount);
router.put('/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
