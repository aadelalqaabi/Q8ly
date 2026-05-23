const VENUE_RADII = {
  cafe: 80,
  coffee_shop: 80,
  restaurant: 120,
  fast_food: 80,
  food_court: 200,
  bakery: 80,
  ice_cream: 80,
  bar: 100,
  pub: 100,
  mall: 400,
  supermarket: 200,
  department_store: 300,
  clothes: 100,
  gym: 150,
  fitness_centre: 150,
  sports_centre: 250,
  swimming_pool: 150,
  cinema: 120,
  theatre: 120,
  hotel: 200,
  hospital: 300,
  clinic: 100,
  mosque: 150,
  university: 500,
  school: 200,
  default: 250,
};

const TYPE_TO_CATEGORY = {
  cafe: 'coffee',
  coffee_shop: 'coffee',
  restaurant: 'food',
  fast_food: 'food',
  food_court: 'food',
  bakery: 'food',
  ice_cream: 'food',
  bar: 'general',
  pub: 'general',
  mall: 'general',
  supermarket: 'general',
  department_store: 'general',
  gym: 'sports',
  fitness_centre: 'sports',
  sports_centre: 'sports',
  swimming_pool: 'sports',
  cinema: 'entertainment',
  theatre: 'entertainment',
  hotel: 'travel',
  default: 'general',
};

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns 0–1. ≥0.6 = here, 0.3–0.6 = nearby, <0.3 = locked
// GPS_BUFFER: flat tolerance added to every venue radius to absorb indoor
// GPS drift (phones can report 50-200m off inside large buildings).
const GPS_BUFFER_METERS = 120;

function computeConfidence(userLat, userLng, userSpeedKmh = 0, venueCoords, venueRadius) {
  const dist = haversineMeters(userLat, userLng, venueCoords.lat, venueCoords.lng);
  const effectiveRadius = (venueRadius || 250) + GPS_BUFFER_METERS;
  const normalized = dist / effectiveRadius;
  const distScore = Math.max(0, 1 - normalized);
  const speedPenalty = Math.min((userSpeedKmh || 0) / 20, 1);
  return distScore * (1 - speedPenalty);
}

function venueRadiusFor(venueType) {
  return VENUE_RADII[venueType] || VENUE_RADII.default;
}

function categoryFor(venueType) {
  return TYPE_TO_CATEGORY[venueType] || TYPE_TO_CATEGORY.default;
}

// Users who bypass geofence checks (founder account, dev accounts, etc.)
const FOUNDER_PHONES = new Set(['+96599440289']);
function bypassesGeofence(user) {
  if (!user) return false;
  return FOUNDER_PHONES.has(user.phone) || user.isFounder === true;
}

module.exports = { haversineMeters, computeConfidence, venueRadiusFor, categoryFor, bypassesGeofence, VENUE_RADII, TYPE_TO_CATEGORY };
