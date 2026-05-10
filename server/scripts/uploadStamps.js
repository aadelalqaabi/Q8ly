require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Hachi = require('../models/Hachi');
const User = require('../models/User');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const STAMPS_DIR = '/Users/aadelalqaabi/Desktop/KUWAI STAMPS';

// Map file name → venue name in DB (and optional coords to create if missing)
const STAMP_MAP = [
  { file: 'The Avenues.png',    venue: 'The Avenues Mall' },
  { file: '360 mall.png',       venue: '360 Mall' },
  { file: 'Kuwait towers.png',  venue: 'Kuwait Towers' },
  { file: 'Souk Mubarakiya.png',venue: 'Souk Al-Mubarakiya' },
  { file: 'alshaheed park.png', venue: 'Al Shaheed Park' },
  { file: 'alkout mall.png',    venue: 'Al Kout Mall' },
  { file: 'khairan mall.png',   venue: 'Khairan Mall' },
  { file: 'Assima Mall.png',    venue: 'Assima Mall', create: { lat: 29.3797, lng: 47.9956, radius: 300 } },
];

function uploadFile(filePath, publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, { public_id: publicId, resource_type: 'image', overwrite: true, format: 'png' },
      (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
    );
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');

  for (const entry of STAMP_MAP) {
    const filePath = path.join(STAMPS_DIR, entry.file);
    if (!fs.existsSync(filePath)) { console.log(`  ! file not found: ${entry.file}`); continue; }

    // Create circle if flagged and missing
    if (entry.create) {
      const exists = await Hachi.findOne({ venueName: entry.venue, isVenueCircle: true });
      if (!exists && founder) {
        await Hachi.create({
          title: entry.venue, category: 'general', creator: founder._id,
          isPublic: true, isVenueCircle: true, venueName: entry.venue, venueType: 'mall',
          venueCoords: { lat: entry.create.lat, lng: entry.create.lng },
          venueRadius: entry.create.radius,
          location: { type: 'Point', coordinates: [entry.create.lng, entry.create.lat] },
          members: [founder._id], memberCount: 0,
        });
        console.log(`  ✓ created circle: ${entry.venue}`);
      }
    }

    const circle = await Hachi.findOne({ venueName: entry.venue, isVenueCircle: true });
    if (!circle) { console.log(`  ! circle not found: ${entry.venue}`); continue; }

    const publicId = `venue_stamps/${circle._id}`;
    try {
      const url = await uploadFile(filePath, publicId);
      await Hachi.findByIdAndUpdate(circle._id, { stampUrl: url });
      console.log(`  ✓ ${entry.venue}: ${url}`);
    } catch (err) {
      console.error(`  ✗ ${entry.venue}: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
