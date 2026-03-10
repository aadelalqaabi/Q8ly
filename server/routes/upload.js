const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, uploadImages, uploadProfilePic, uploadCoverPhoto, uploadVideo, uploadAudio } = require('../controllers/uploadController');

router.post('/images', protect, upload.array('images', 4), uploadImages);
router.post('/profile-pic', protect, upload.single('image'), uploadProfilePic);
router.post('/cover-photo', protect, upload.single('image'), uploadCoverPhoto);
router.post('/video', protect, upload.single('video'), uploadVideo);
router.post('/audio', protect, upload.single('audio'), uploadAudio);

module.exports = router;
