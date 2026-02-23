const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (we'll upload buffer to Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported. Allowed: JPEG, PNG, GIF, WebP, MP4, MOV'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// Helper: upload buffer to cloudinary
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

// @desc    Upload image(s)
// @route   POST /api/upload/images
// @access  Private
const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, {
        folder: 'kuwait-now/posts',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        resource_type: 'image',
      })
    );

    const results = await Promise.all(uploadPromises);
    const urls = results.map((r) => r.secure_url);

    res.json({ success: true, urls });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile picture
// @route   POST /api/upload/profile-pic
// @access  Private
const uploadProfilePic = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'kuwait-now/profiles',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
      resource_type: 'image',
    });

    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload cover photo
// @route   POST /api/upload/cover-photo
// @access  Private
const uploadCoverPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'kuwait-now/covers',
      transformation: [
        { width: 1500, height: 500, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
      resource_type: 'image',
    });

    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    next(error);
  }
};

module.exports = { upload, uploadImages, uploadProfilePic, uploadCoverPhoto };
