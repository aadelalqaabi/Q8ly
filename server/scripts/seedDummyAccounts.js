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

const BASE_URL = 'https://kuwai.app/profiles';

const DUMMY_USERS = [
  { username: 'noura_kw',    name: 'نورا',      bio: 'كونتنت كريتور ✨',         profilePic: `${BASE_URL}/1.jpg`  },
  { username: 'dalal_kw',    name: 'دلال',      bio: 'موضة وستايل 🤍',           profilePic: `${BASE_URL}/2.jpg`  },
  { username: 'sara_kw',     name: 'سارة',      bio: 'فود بلوغر ☕',             profilePic: `${BASE_URL}/3.jpg`  },
  { username: 'reem_kw',     name: 'ريم',       bio: 'فوتوغرافر 📸',             profilePic: `${BASE_URL}/4.jpg`  },
  { username: 'lulua_kw',    name: 'لولوة',     bio: 'تراول وأدفنشر 🌍',         profilePic: `${BASE_URL}/5.jpg`  },
  { username: 'mariam_kw',   name: 'مريم',      bio: 'تصميم وإبداع 🎨',          profilePic: `${BASE_URL}/6.jpg`  },
  { username: 'hessa_kw',    name: 'حصة',       bio: 'أم وبلوغر 🌸',             profilePic: `${BASE_URL}/7.jpg`  },
  { username: 'shaikha_kw',  name: 'شيخة',      bio: 'ديكور وسكن 🏡',            profilePic: `${BASE_URL}/8.png`  },
  { username: 'fatima_kw',   name: 'فاطمة',     bio: 'طبخ وأكل 🍽',              profilePic: `${BASE_URL}/9.jpg`  },
  { username: 'aseel_kw',    name: 'أصيل',      bio: 'فيتنس وهيلث 💪',           profilePic: `${BASE_URL}/10.jpg` },
  { username: 'ahmad_kw',    name: 'أحمد',      bio: 'تك وستارت أب 🚀',          profilePic: `${BASE_URL}/11.jpg` },
  { username: 'faisal_kw',   name: 'فيصل',      bio: 'استثمار وأسهم 📈',         profilePic: `${BASE_URL}/12.jpg` },
  { username: 'khaled_kw',   name: 'خالد',      bio: 'رياضة وفيتنس 💪',          profilePic: `${BASE_URL}/13.png` },
  { username: 'nawaf_kw',    name: 'نواف',      bio: 'جيمر وتقنية 🎮',           profilePic: `${BASE_URL}/14.jpg` },
  { username: 'meshal_kw',   name: 'مشعل',      bio: 'بيزنس وريادة أعمال',       profilePic: `${BASE_URL}/15.jpg` },
  { username: 'yousef_kw',   name: 'يوسف',      bio: 'فيلم وإخراج 🎬',           profilePic: `${BASE_URL}/16.jpg` },
  { username: 'hamad_kw',    name: 'حمد',       bio: 'سيارات وموتورز 🚗',        profilePic: `${BASE_URL}/17.jpg` },
  { username: 'omar_kw',     name: 'عمر',       bio: 'فود وكافيهات ☕',           profilePic: `${BASE_URL}/18.jpg` },
  { username: 'jaber_kw',    name: 'جابر',      bio: 'قانون وحقوق ⚖️',           profilePic: `${BASE_URL}/19.jpg` },
  { username: 'sultan_kw',   name: 'سلطان',     bio: 'رياضة وبطولات 🏆',         profilePic: `${BASE_URL}/20.jpg` },
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
