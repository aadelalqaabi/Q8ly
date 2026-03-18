/**
 * Cleanup script — removes all seeded data from MongoDB.
 * Run: node scripts/cleanSeedData.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Hachi = require('../models/Hachi');
const Topic = require('../models/Topic');
const Space = require('../models/Space');

const SEED_USERNAMES = [
  // from seedKuwaaContent.js
  'bu_khalid_q8', 'um_nora_kw', 'fahad_q8', 'dalal_kwt', 'meshaal_q8',
  'nouf_kw', 'abdulaziz_kwt', 'reem_q8', 'omar_albidaa', 'sara_kwt',
  'jaber_q8', 'lulwa_kw',
  // from seedData.js
  'kuwait_now_admin',
];

const SEED_TOPIC_SLUGS = [
  'politics', 'society', 'traffic', 'jobs', 'real-estate', 'sports',
  'events', 'offers', 'technology', 'health', 'entertainment', 'weather',
];

const SEED_SPACE_SLUGS = [
  'asimah', 'hawalli', 'farwaniyah', 'ahmadi', 'jahra', 'mubarak-kabeer',
  'kuwait-football', 'foodies-kuwait', 'kuwait-startups', 'cars-kuwait',
];

const clean = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Find all seeded user IDs
  const seedUsers = await User.find({
    $or: [
      { username: { $in: SEED_USERNAMES } },
      { email: /@seed\.kn$/ },
    ],
  }).select('_id username email');

  const seedUserIds = seedUsers.map((u) => u._id);
  console.log(`Found ${seedUsers.length} seeded users:`, seedUsers.map((u) => u.username));

  // 2. Delete posts by seeded users
  const postResult = await Post.deleteMany({ author: { $in: seedUserIds } });
  console.log(`Deleted ${postResult.deletedCount} posts`);

  // 3. Delete Hachi circles by seeded users
  const hachiResult = await Hachi.deleteMany({ creator: { $in: seedUserIds } });
  console.log(`Deleted ${hachiResult.deletedCount} Hachi circles`);

  // 4. Delete seeded users
  const userResult = await User.deleteMany({ _id: { $in: seedUserIds } });
  console.log(`Deleted ${userResult.deletedCount} users`);

  // 5. Delete seeded topics
  const topicResult = await Topic.deleteMany({ slug: { $in: SEED_TOPIC_SLUGS } });
  console.log(`Deleted ${topicResult.deletedCount} topics`);

  // 6. Delete seeded spaces
  const spaceResult = await Space.deleteMany({ slug: { $in: SEED_SPACE_SLUGS } });
  console.log(`Deleted ${spaceResult.deletedCount} spaces`);

  console.log('\nDone! All seed data removed.');
  await mongoose.disconnect();
};

clean().catch((err) => {
  console.error(err);
  process.exit(1);
});
