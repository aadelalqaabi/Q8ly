/**
 * Deletes venue circles that have no coordinates.
 * Usage: node server/scripts/cleanupVenueCircles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Hachi = require('../models/Hachi');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Hachi.deleteMany({
    isVenueCircle: true,
    $or: [
      { 'venueCoords.lat': { $exists: false } },
      { 'venueCoords.lat': null },
      { 'venueCoords.lng': { $exists: false } },
      { 'venueCoords.lng': null },
    ],
  });

  console.log(`Deleted ${result.deletedCount} venue circle(s) with no coordinates.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
