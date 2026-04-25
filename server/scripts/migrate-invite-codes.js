/**
 * One-time migration: generate invite codes for all existing users.
 * Founder (+96599440289) gets 50 invites, everyone else gets 3.
 *
 * Usage:  node server/scripts/migrate-invite-codes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');

const FOUNDER_PHONE = '+96599440289';
const FOUNDER_INVITES = 50;
const DEFAULT_INVITES = 3;

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({ $or: [{ inviteCode: { $exists: false } }, { inviteCode: null }, { inviteCode: '' }] });
  console.log(`Found ${users.length} users without invite codes`);

  for (const user of users) {
    user.inviteCode = generateInviteCode();
    const isFounder = user.phone === FOUNDER_PHONE;
    user.invitesRemaining = isFounder ? FOUNDER_INVITES : DEFAULT_INVITES;
    await user.save();
    console.log(`${isFounder ? '[FOUNDER]' : '        '} ${user.phone || user.username} → ${user.inviteCode} (${user.invitesRemaining} invites)`);
  }

  console.log('Done');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
