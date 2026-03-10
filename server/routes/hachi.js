const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { getRooms, getArchivedRooms, createRoom, getRoom, closeRoom, reactRoom, searchRooms } = require('../controllers/hachiController');

router.get('/', getRooms);
router.get('/search', searchRooms);
router.get('/archived', getArchivedRooms);
router.post('/', protect, createRoom);
router.get('/:id', optionalAuth, getRoom);
router.post('/:id/react', protect, reactRoom);
router.delete('/:id', protect, closeRoom);

module.exports = router;
