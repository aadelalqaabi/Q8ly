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

// Authentic Kuwaiti social media pseudonyms — neighborhood, identity, and slang-based
const BASE_URL = 'https://kuwai.app/profiles';

const DUMMY_USERS = [
  { username: 'ibn_shuwaikh',   name: 'ابن الشويخ',       bio: 'من الشويخ بكل فخر 🇰🇼',           profilePic: `${BASE_URL}/1.jpg`  },
  { username: 'bnt_salmiya',    name: 'بنت السالمية',      bio: 'السالمية هي الدنيا ✨',             profilePic: `${BASE_URL}/2.jpg`  },
  { username: 'q8_proud',       name: 'كويتي وأفتخر',      bio: 'رأي وكلام بدون فلتر',              profilePic: `${BASE_URL}/3.jpg`  },
  { username: 'wld_asima',      name: 'ولد العاصمة',       bio: 'من قلب الكويت 🏙',                 profilePic: `${BASE_URL}/4.jpg`  },
  { username: 'almsahri',       name: 'المسهري',           bio: 'سهران على الكويت كل ليلة 🌙',      profilePic: `${BASE_URL}/5.jpg`  },
  { username: 'ibn_fahaheel',   name: 'ابن الفحيحيل',      bio: 'الجنوب أصل وفصل',                  profilePic: `${BASE_URL}/6.jpg`  },
  { username: 'aldirah_q8',     name: 'الديرة القديمة',    bio: 'ذكريات وأصالة من الكويت القديمة',  profilePic: `${BASE_URL}/7.jpg`  },
  { username: 'shari_mbrk',     name: 'شاري المباركية',    bio: 'سواليف وحكايات من الديرة ☕',      profilePic: `${BASE_URL}/8.png`  },
  { username: 'sahib_dawain',   name: 'صاحب الدواوين',     bio: 'الديوانية مدرسة الحياة',            profilePic: `${BASE_URL}/9.jpg`  },
  { username: 'bnt_rawdah',     name: 'بنت الروضة',        bio: 'موضة وستايل وكويت 🤍',             profilePic: `${BASE_URL}/10.jpg` },
  { username: 'aljahrawi',      name: 'الجهراوي',          bio: 'الجهراء أصل العرب 🦅',              profilePic: `${BASE_URL}/11.jpg` },
  { username: 'am_bu_nasser',   name: 'عم بو ناصر',        bio: 'نصايح مجانية وسواليف مفيدة 😄',   profilePic: `${BASE_URL}/12.jpg` },
  { username: 'thrthar_q8',     name: 'ثرثار الكويت',      bio: 'أتكلم وأتكلم وما أسكت 🗣',         profilePic: `${BASE_URL}/13.png` },
  { username: 'q8_night',       name: 'الكويت بالليل',     bio: 'الكويت أجمل في الليل 🌃',          profilePic: `${BASE_URL}/14.jpg` },
  { username: 'ibn_ahmadi',     name: 'ابن الأحمدي',       bio: 'من أرض النفط والتاريخ 🛢',         profilePic: `${BASE_URL}/15.jpg` },
  { username: 'bu_khamsa',      name: 'بو خمسة وخميسة',   bio: 'أب وبس | الحياة تمشي 😅',          profilePic: `${BASE_URL}/16.jpg` },
  { username: 'hamra_naym',     name: 'الحمراء نايم',      bio: 'مسترخي ومشاهد الأحداث 👀',         profilePic: `${BASE_URL}/17.jpg` },
  { username: 'saqr_alkhaleej', name: 'صقر الخليج',        bio: 'فخر خليجي وأصالة كويتية 🦅',       profilePic: `${BASE_URL}/18.jpg` },
  { username: 'q8_nostalgia',   name: 'نوستالجيا كويت',    bio: 'زمان كان أحلى 🌴',                 profilePic: `${BASE_URL}/19.jpg` },
  { username: 'wld_aldirah',    name: 'ولد الديرة',         bio: 'من الديرة وللديرة دايمًا 🇰🇼',    profilePic: `${BASE_URL}/20.jpg` },
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
