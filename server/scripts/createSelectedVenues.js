require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Hachi = require('../models/Hachi');
const User = require('../models/User');

const VENUES = [
  { name: 'Kuwait Towers',    lat: 29.3838, lng: 47.9906, venueType: 'attraction', category: 'general',       radius: 200 },
  { name: 'Souk Al-Mubarakiya', lat: 29.3697, lng: 47.9755, venueType: 'marketplace', category: 'general',   radius: 350 },
  { name: 'Marina Mall',      lat: 29.3461, lng: 47.9847, venueType: 'mall',       category: 'general',       radius: 300 },
  { name: 'Al Shaheed Park',  lat: 29.3756, lng: 47.9906, venueType: 'park',       category: 'general',       radius: 400 },
  { name: 'Al Kout Mall',     lat: 29.2219, lng: 48.1006, venueType: 'mall',       category: 'general',       radius: 300 },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
  if (!founder) { console.error('Founder not found'); process.exit(1); }

  for (const v of VENUES) {
    const existing = await Hachi.findOne({ venueName: v.name, isVenueCircle: true });
    if (existing) { console.log(`  skip: ${v.name} already exists`); continue; }

    await Hachi.create({
      title: v.name,
      category: v.category,
      creator: founder._id,
      isPublic: true,
      isVenueCircle: true,
      venueName: v.name,
      venueType: v.venueType,
      venueCoords: { lat: v.lat, lng: v.lng },
      venueRadius: v.radius,
      location: { type: 'Point', coordinates: [v.lng, v.lat] },
      members: [founder._id],
      memberCount: 0,
    });
    console.log(`  ✓ created: ${v.name}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
