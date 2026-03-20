/**
 * Creates (or resets) the Apple/store reviewer demo account.
 *
 * Usage:
 *   node server/scripts/createReviewerAccount.js
 *
 * The account uses phone +96500000000.
 * Login: enter "00000000" in the Kuwait phone field, OTP code: 123456
 *
 * Run this once on your server/Railway console after deploying.
 * Safe to re-run — it upserts, never duplicates.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const DEMO_PHONE    = '+96500000000';
const DEMO_USERNAME = 'reviewer';
const DEMO_NAME     = 'Demo User';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('[seed] connected to MongoDB');

  const existing = await User.findOne({ phone: DEMO_PHONE });

  if (existing) {
    console.log(`[seed] Demo account already exists: @${existing.username} (${existing._id})`);
    console.log('[seed] No changes made.');
  } else {
    const user = await User.create({
      phone: DEMO_PHONE,
      phoneVerified: true,
      username: DEMO_USERNAME,
      name: DEMO_NAME,
      bio: 'App reviewer account — for testing purposes only.',
      isActive: true,
      accountType: 'user',
    });
    console.log(`[seed] ✅ Demo account created: @${user.username} (${user._id})`);
  }

  console.log('\n── Apple Review Credentials ──────────────────────────');
  console.log('  Phone field (Kuwait):  00000000');
  console.log('  OTP code:              123456');
  console.log('  Username:              @reviewer');
  console.log('──────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
