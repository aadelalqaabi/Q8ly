/**
 * Generates a Cloudinary-hosted map snapshot for every venue circle that lacks one.
 * Uses CartoDB Light tiles (free, no key) → uploads to Cloudinary → stores URL.
 * Usage: node server/scripts/generateMapSnapshots.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Hachi = require('../models/Hachi');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ZOOM = 16;

function tileXY(lat, lng) {
  const n = Math.pow(2, ZOOM);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  // pixel offset of venue within the tile (0–255)
  const pixX = Math.round(((lng + 180) / 360 * n - x) * 256);
  const pixY = Math.round(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - y) * 256);
  return { x, y, pixX, pixY };
}

// Fetch tile PNG as a Buffer
function fetchTile(x, y) {
  return new Promise((resolve, reject) => {
    const url = `https://a.basemaps.cartocdn.com/light_all/${ZOOM}/${x}/${y}.png`;
    https.get(url, { headers: { 'User-Agent': 'KUWAI-App/1.0' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Upload buffer to Cloudinary, return secure URL
function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', overwrite: true, format: 'png' },
      (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
    );
    stream.end(buffer);
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const circles = await Hachi.find({
    isVenueCircle: true,
    isActive: true,
    'venueCoords.lat': { $exists: true, $ne: null },
    'venueCoords.lng': { $exists: true, $ne: null },
  }).lean();

  console.log(`Found ${circles.length} venue circle(s) to process`);

  for (const circle of circles) {
    const { lat, lng } = circle.venueCoords;
    const { x, y } = tileXY(lat, lng);
    const publicId = `venue_maps/${circle._id}`;

    try {
      console.log(`  → ${circle.venueName}: tile ${x}/${y}`);
      const buffer = await fetchTile(x, y);
      const url = await uploadToCloudinary(buffer, publicId);
      await Hachi.findByIdAndUpdate(circle._id, { mapSnapshot: url });
      console.log(`    ✓ ${url}`);
    } catch (err) {
      console.error(`    ✗ ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
