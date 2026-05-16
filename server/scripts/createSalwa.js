require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Hachi = require('../models/Hachi');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
  if (!founder) { console.error('Founder not found'); process.exit(1); }

  const exists = await Hachi.findOne({ venueName: 'Salwa' });
  if (exists) { console.log('Already exists:', exists._id); process.exit(0); }

  const circle = await Hachi.create({
    title: 'Salwa',
    venueName: 'Salwa',
    venueType: 'neighborhood',
    category: 'general',
    isVenueCircle: true,
    isActive: true,
    venueCoords: { lat: 29.2987336, lng: 48.0716711 },
    venueRadius: 800,
    creator: founder._id,
    members: [founder._id],
    memberCount: 0,
    messages: [],
  });

  console.log('✅ Created Salwa circle:', circle._id);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
