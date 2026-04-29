const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { getRooms, getArchivedRooms, createRoom, getRoom, closeRoom, reactRoom, searchRooms, getMyRooms, getJoinedRooms, deleteRoom, pinRoom, unpinRoom, leaveRoom, getPinnedMoments, getUserMessages, getSubjects, checkLocation } = require('../controllers/hachiController');

router.get('/', optionalAuth, getRooms);
router.get('/search', searchRooms);
router.get('/subjects', getSubjects);
router.get('/moments', getPinnedMoments);
router.get('/archived', getArchivedRooms);
router.get('/my', protect, getMyRooms);
router.get('/joined', protect, getJoinedRooms);
router.get('/user-messages/:username', getUserMessages);
router.post('/', protect, createRoom);
router.get('/:id/check-location', checkLocation);
router.get('/:id', optionalAuth, getRoom);
router.post('/:id/react', protect, reactRoom);
router.delete('/:id/delete', protect, deleteRoom);
router.post('/:id/pin', protect, pinRoom);
router.delete('/:id/pin', protect, unpinRoom);
router.post('/:id/leave', protect, leaveRoom);

module.exports = router;
