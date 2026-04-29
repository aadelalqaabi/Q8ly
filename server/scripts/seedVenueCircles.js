/**
 * Seeds circles for real Kuwait venues from OpenStreetMap (Overpass API).
 * Runs once — skips venues that already have a circle.
 * Usage: node server/scripts/seedVenueCircles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const https = require('https');
const Hachi = require('../models/Hachi');
const User = require('../models/User');
const { venueRadiusFor, categoryFor } = require('../utils/locationUtils');

// Kuwait bounding box: S, W, N, E
const BBOX = '28.5,47.5,30.1,48.6';

const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["amenity"~"^(cafe|restaurant|fast_food|food_court|bakery|ice_cream|bar|cinema|theatre)$"]["name"](${BBOX});
  node["shop"~"^(mall|supermarket|department_store)$"]["name"](${BBOX});
  node["leisure"~"^(gym|fitness_centre|sports_centre|swimming_pool)$"]["name"](${BBOX});
  way["shop"="mall"]["name"](${BBOX});
  way["leisure"~"^(gym|fitness_centre|sports_centre)$"]["name"](${BBOX});
);
out center;
`.trim();

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'KUWAI-App/1.0',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractVenues(elements) {
  const seen = new Set();
  const venues = [];
  for (const el of elements) {
    const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:ar'];
    if (!name) continue;

    // Get lat/lng — nodes have it directly, ways have center
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!lat || !lng) continue;

    // Determine venue type
    const venueType =
      el.tags?.amenity ||
      el.tags?.shop ||
      el.tags?.leisure ||
      'general';

    const key = `${name}|${Math.round(lat * 1000)}|${Math.round(lng * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    venues.push({ name, lat, lng, venueType });
  }
  return venues;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find founder account to be creator of all venue circles
  const founder = await User.findOne({ phone: '+96599440289' }).select('_id');
  if (!founder) {
    console.error('Founder account not found. Run migrate-invite-codes.js first.');
    process.exit(1);
  }

  console.log('Querying Overpass API for Kuwait venues...');
  let result;
  try {
    result = await fetchOverpass(OVERPASS_QUERY);
  } catch (err) {
    console.error('Overpass API error:', err.message);
    process.exit(1);
  }

  const venues = extractVenues(result.elements || []);
  console.log(`Found ${venues.length} venues from OSM`);

  // Load existing venue circles to avoid duplicates
  const existing = await Hachi.find({ isVenueCircle: true }).select('venueName venueCoords').lean();
  const existingKeys = new Set(
    existing.map((c) => `${c.venueName}|${Math.round((c.venueCoords?.lat || 0) * 1000)}|${Math.round((c.venueCoords?.lng || 0) * 1000)}`)
  );

  let created = 0;
  let skipped = 0;

  for (const venue of venues) {
    const key = `${venue.name}|${Math.round(venue.lat * 1000)}|${Math.round(venue.lng * 1000)}`;
    if (existingKeys.has(key)) { skipped++; continue; }

    const venueRadius = venueRadiusFor(venue.venueType);
    const category = categoryFor(venue.venueType);

    try {
      await Hachi.create({
        title: venue.name,
        category,
        creator: founder._id,
        isPublic: true,
        isVenueCircle: true,
        venueName: venue.name,
        venueType: venue.venueType,
        venueCoords: { lat: venue.lat, lng: venue.lng },
        venueRadius,
        location: { type: 'Point', coordinates: [venue.lng, venue.lat] },
        members: [founder._id],
        memberCount: 0,
      });
      created++;
      if (created % 50 === 0) console.log(`  Created ${created}...`);
    } catch (err) {
      // Skip duplicates / validation errors silently
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
