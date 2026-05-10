require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Hachi = require('../models/Hachi');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const del = await Hachi.findOneAndDelete({ venueName: 'Marina Mall', isVenueCircle: true });
  console.log(del ? `  ✓ deleted: Marina Mall (${del._id})` : '  ! Marina Mall not found');

  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
  if (!founder) { console.error('Founder not found'); process.exit(1); }

  const existing = await Hachi.findOne({ venueName: 'Khairan Mall', isVenueCircle: true });
  if (existing) { console.log('  ! Khairan Mall already exists'); }
  else {
    await Hachi.create({
      title: 'Khairan Mall',
      category: 'general',
      creator: founder._id,
      isPublic: true,
      isVenueCircle: true,
      venueName: 'Khairan Mall',
      venueType: 'mall',
      venueCoords: { lat: 29.0731, lng: 48.2375 },
      venueRadius: 300,
      location: { type: 'Point', coordinates: [48.2375, 29.0731] },
      members: [founder._id],
      memberCount: 0,
    });
    console.log('  ✓ created: Khairan Mall');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
