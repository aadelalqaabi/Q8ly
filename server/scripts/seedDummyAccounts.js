/**
 * Seed 20 test accounts
 * Phones: +96500000001 → +96500000020
 * OTP:    123456 (always bypassed)
 *
 * Run: node scripts/seedDummyAccounts.js
 * Also deletes stale accounts #21–50 if they exist.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

// بو / أم style — the most authentic Kuwaiti anonymous social media convention
const BASE_URL = 'https://kuwai.app/profiles';

const DUMMY_USERS = [
  { username: 'bu_fahad',     name: 'بو فهد',      bio: 'كويتي أصيل 🇰🇼',                   profilePic: `${BASE_URL}/1.jpg`  },
  { username: 'um_khaled',    name: 'أم خالد',     bio: 'بيت وعيال وحياة 🤍',               profilePic: `${BASE_URL}/2.jpg`  },
  { username: 'bu_nasser',    name: 'بو ناصر',     bio: 'شاهد على الكويت منذ زمان',          profilePic: `${BASE_URL}/3.jpg`  },
  { username: 'um_salma',     name: 'أم سلمى',     bio: 'أم وزوجة وكل شي 🌸',               profilePic: `${BASE_URL}/4.jpg`  },
  { username: 'bu_sultan',    name: 'بو سلطان',    bio: 'رأي وكلام بدون فلتر',               profilePic: `${BASE_URL}/5.jpg`  },
  { username: 'um_reem',      name: 'أم ريم',      bio: 'طبخ وبيت وأسرة ❤️',                profilePic: `${BASE_URL}/6.jpg`  },
  { username: 'bu_abdulla',   name: 'بو عبدالله',  bio: 'تجارة وأعمال | الكويت أولاً',       profilePic: `${BASE_URL}/7.jpg`  },
  { username: 'um_noura',     name: 'أم نورة',     bio: 'حياتي اليومية بعيون كويتية',        profilePic: `${BASE_URL}/8.png`  },
  { username: 'bu_yousef',    name: 'بو يوسف',     bio: 'رياضة وصحة وعافية 💪',             profilePic: `${BASE_URL}/9.jpg`  },
  { username: 'um_lulu',      name: 'أم لولو',     bio: 'موضة ودلع وستايل ✨',               profilePic: `${BASE_URL}/10.jpg` },
  { username: 'bu_rashed',    name: 'بو راشد',     bio: 'سفر وتجوال حول العالم ✈️',         profilePic: `${BASE_URL}/11.jpg` },
  { username: 'um_dana',      name: 'أم دانة',     bio: 'كافيهات وفود بالكويت ☕',           profilePic: `${BASE_URL}/12.jpg` },
  { username: 'bu_meshal',    name: 'بو مشعل',     bio: 'سيارات وموتورز 🚗',                profilePic: `${BASE_URL}/13.png` },
  { username: 'um_shaikha',   name: 'أم شيخة',     bio: 'ديكور وسكن وأفكار 🏡',             profilePic: `${BASE_URL}/14.jpg` },
  { username: 'bu_saad',      name: 'بو سعد',      bio: 'صيد وبحر وطبيعة 🎣',               profilePic: `${BASE_URL}/15.jpg` },
  { username: 'um_haya',      name: 'أم هيا',      bio: 'تربية وأطفال ومواقف 😄',            profilePic: `${BASE_URL}/16.jpg` },
  { username: 'bu_tariq',     name: 'بو طارق',     bio: 'استثمار وأسهم وعقارات 📈',          profilePic: `${BASE_URL}/17.jpg` },
  { username: 'um_jawahir',   name: 'أم جواهر',    bio: 'طبخات كويتية أصيلة 🍽',            profilePic: `${BASE_URL}/18.jpg` },
  { username: 'bu_omar',      name: 'بو عمر',      bio: 'تقنية وأجهزة وتكنولوجيا 💻',       profilePic: `${BASE_URL}/19.jpg` },
  { username: 'um_muneera',   name: 'أم منيرة',    bio: 'كتب وقراءة وثقافة 📚',              profilePic: `${BASE_URL}/20.jpg` },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Remove stale accounts #21–50
  const stalePhones = Array.from({ length: 30 }, (_, i) =>
    `+965000000${String(i + 21).padStart(2, '0')}`
  );
  const deleted = await User.deleteMany({ phone: { $in: stalePhones } });
  if (deleted.deletedCount > 0) console.log(`🗑  Removed ${deleted.deletedCount} stale accounts (#21–50)`);

  let updated = 0, created = 0;

  for (let i = 0; i < DUMMY_USERS.length; i++) {
    const phone = `+965000000${String(i + 1).padStart(2, '0')}`;
    const data = DUMMY_USERS[i];

    try {
      const existing = await User.findOne({ phone });
      if (existing) {
        await User.updateOne({ phone }, { $set: { username: data.username, name: data.name, bio: data.bio, profilePic: data.profilePic } });
        updated++;
        console.log(`✓ updated  ${phone}  @${data.username}  (${data.name})`);
      } else {
        await User.create({ phone, username: data.username, name: data.name, bio: data.bio, profilePic: data.profilePic, phoneVerified: true, isActive: true });
        created++;
        console.log(`✓ created  ${phone}  @${data.username}  (${data.name})`);
      }
    } catch (err) {
      console.error(`✗ ${phone} — ${err.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}  Created: ${created}`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
