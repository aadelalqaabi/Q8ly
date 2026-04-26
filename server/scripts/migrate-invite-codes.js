/**
 * Migration: convert old inviteCode field to new inviteCodes array (2 codes per user).
 * Founder (+96599440289) gets 10 codes.
 *
 * Usage:  node server/scripts/migrate-invite-codes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');

const FOUNDER_PHONE = '+96599440289';
const FOUNDER_CODE_COUNT = 10;
const DEFAULT_CODE_COUNT = 2;

function generateInviteCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const allCodes = new Set();
  // Collect existing codes to avoid duplicates
  const users = await User.find({});
  for (const u of users) {
    if (u.inviteCodes) u.inviteCodes.forEach((c) => allCodes.add(c.code));
  }

  function uniqueCode() {
    let code;
    do { code = generateInviteCode(); } while (allCodes.has(code));
    allCodes.add(code);
    return code;
  }

  let migrated = 0;
  for (const user of users) {
    const isFounder = user.phone === FOUNDER_PHONE;
    const targetCount = isFounder ? FOUNDER_CODE_COUNT : DEFAULT_CODE_COUNT;
    const existing = user.inviteCodes || [];

    // If user has old-style inviteCode field, convert it
    if (user.inviteCode && existing.length === 0) {
      existing.push({ code: user.inviteCode });
    }

    // Add codes until they have the target count
    while (existing.length < targetCount) {
      existing.push({ code: uniqueCode() });
    }

    user.inviteCodes = existing;
    user.inviteCode = undefined; // remove old field
    user.invitesRemaining = undefined; // remove old field
    await user.save({ validateBeforeSave: false });
    migrated++;
    const codes = existing.map((c) => `${c.code}${c.usedBy ? ' (used)' : ''}`).join(', ');
    console.log(`${isFounder ? '[FOUNDER]' : '        '} ${user.phone || user.username} → [${codes}]`);
  }

  console.log(`Migrated ${migrated} users`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
