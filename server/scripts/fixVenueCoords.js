/**
 * fixVenueCoords.js
 * Fixes coordinates and radii for key Kuwait venue circles.
 * Coordinates verified against Google Maps.
 * Run: node scripts/fixVenueCoords.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Hachi = require('../models/Hachi');
const User = require('../models/User');

// Verified coords from Google Maps. Radii are generous on purpose:
// indoor GPS drifts 50-200m and large malls span 400-600m across.
const VENUES = [
  { name: '360 Mall',           lat: 29.2936,  lng: 48.0846,  radius: 650, type: 'mall' },
  { name: 'The Avenues Mall',   lat: 29.3101,  lng: 47.9349,  radius: 700, type: 'mall' },
  { name: 'Assima Mall',        lat: 29.3680,  lng: 47.9793,  radius: 450, type: 'mall' },
  { name: 'Al Kout Mall',       lat: 29.2219,  lng: 48.1006,  radius: 500, type: 'mall' },
  { name: 'Marina Mall',        lat: 29.3461,  lng: 47.9847,  radius: 400, type: 'mall' },
  { name: 'Khairan Mall',       lat: 29.0731,  lng: 48.2375,  radius: 400, type: 'mall' },
  { name: 'Kuwait Towers',      lat: 29.3838,  lng: 47.9906,  radius: 250, type: 'attraction' },
  { name: 'Souk Al-Mubarakiya', lat: 29.3697,  lng: 47.9755,  radius: 400, type: 'marketplace' },
  { name: 'Al Shaheed Park',    lat: 29.3756,  lng: 47.9906,  radius: 500, type: 'park' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
  if (!founder) { console.error('Founder not found'); process.exit(1); }

  for (const v of VENUES) {
    let circle = await Hachi.findOne({ venueName: v.name, isVenueCircle: true });

    if (!circle) {
      // Create it if missing
      circle = await Hachi.create({
        title: v.name,
        category: 'general',
        creator: founder._id,
        isPublic: true,
        isVenueCircle: true,
        venueName: v.name,
        venueType: v.type,
        venueCoords: { lat: v.lat, lng: v.lng },
        venueRadius: v.radius,
        location: { type: 'Point', coordinates: [v.lng, v.lat] },
        members: [founder._id],
        memberCount: 0,
      });
      console.log(`  ✓ CREATED  ${v.name} (${v.lat}, ${v.lng}) r=${v.radius}m`);
    } else {
      // Update coords and radius
      const old = `(${circle.venueCoords?.lat?.toFixed(4)}, ${circle.venueCoords?.lng?.toFixed(4)}) r=${circle.venueRadius}m`;
      await Hachi.findByIdAndUpdate(circle._id, {
        venueCoords: { lat: v.lat, lng: v.lng },
        venueRadius: v.radius,
        venueType: v.type,
        location: { type: 'Point', coordinates: [v.lng, v.lat] },
      });
      console.log(`  ✓ UPDATED  ${v.name}`);
      console.log(`             was: ${old}`);
      console.log(`             now: (${v.lat}, ${v.lng}) r=${v.radius}m`);
    }
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
