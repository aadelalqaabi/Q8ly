/**
 * Seed / update 50 founder dummy accounts
 * Phones: +96500000001 → +96500000050
 * OTP:    123456 (always, no SMS sent)
 *
 * Run: node scripts/seedDummyAccounts.js
 * Safe to re-run — uses upsert to update existing users.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

// Kuwait influencer-style names — first name only, no family names
// Profile pics: randomuser.me (real portrait photos, diverse, stable URLs)
// Kuwaiti names: first name + father's first name — no tribe/family names
const DUMMY_USERS = [
  { username: 'noura.khaled',   name: 'نورا خالد',      bio: 'كونتنت كريتور • لايف ستايل ✨',   profilePic: 'https://randomuser.me/api/portraits/women/44.jpg',  district: 'Al Asimah' },
  { username: 'dalal.faisal',   name: 'دلال فيصل',      bio: 'موضة وستايل • كويت 🤍',           profilePic: 'https://randomuser.me/api/portraits/women/47.jpg',  district: 'Hawalli' },
  { username: 'sara.omar',      name: 'سارة عمر',       bio: 'فود بلوغر وكافيهات ☕',           profilePic: 'https://randomuser.me/api/portraits/women/65.jpg',  district: 'Al Asimah' },
  { username: 'lulu.ahmad',     name: 'لولو أحمد',      bio: 'تراول وأدفنشر 🌍',               profilePic: 'https://randomuser.me/api/portraits/women/31.jpg',  district: 'Farwaniyah' },
  { username: 'reem.nasser',    name: 'ريم ناصر',       bio: 'فوتوغرافر | لحظات حقيقية 📸',    profilePic: 'https://randomuser.me/api/portraits/women/79.jpg',  district: 'Hawalli' },
  { username: 'shaikha.yousef', name: 'شيخة يوسف',      bio: 'ديكور وسكن 🏡 | حياة أجمل',     profilePic: 'https://randomuser.me/api/portraits/women/57.jpg',  district: 'Al Asimah' },
  { username: 'mona.hamad',     name: 'منى حمد',        bio: 'ماركتينغ وبراندينغ 💡',           profilePic: 'https://randomuser.me/api/portraits/women/23.jpg',  district: 'Ahmadi' },
  { username: 'ghada.saad',     name: 'غادة سعد',       bio: 'إعلامية وصوت الكويت 🎙',         profilePic: 'https://randomuser.me/api/portraits/women/90.jpg',  district: 'Al Asimah' },
  { username: 'aseel.jasim',    name: 'أصيل جاسم',      bio: 'فيتنس وهيلث كوتش 💪',            profilePic: 'https://randomuser.me/api/portraits/women/35.jpg',  district: 'Hawalli' },
  { username: 'fatima.waleed',  name: 'فاطمة وليد',     bio: 'مينيمالست | أقل أجمل 🤍',        profilePic: 'https://randomuser.me/api/portraits/women/56.jpg',  district: 'Al Asimah' },
  { username: 'hessa.bader',    name: 'حصة بدر',        bio: 'أم وبلوغر | اليومية الكويتية',   profilePic: 'https://randomuser.me/api/portraits/women/63.jpg',  district: 'Farwaniyah' },
  { username: 'afra.salem',     name: 'عفراء سالم',     bio: 'رحلات وتنقل ✈️',                 profilePic: 'https://randomuser.me/api/portraits/women/21.jpg',  district: 'Mubarak Al-Kabeer' },
  { username: 'rana.mohammed',  name: 'رنا محمد',       bio: 'كتابة وأدب وشعر 📝',             profilePic: 'https://randomuser.me/api/portraits/women/43.jpg',  district: 'Al Asimah' },
  { username: 'mariam.rashed',  name: 'مريم راشد',      bio: 'علم نفس وتطوير الذات 🧠',        profilePic: 'https://randomuser.me/api/portraits/women/54.jpg',  district: 'Hawalli' },
  { username: 'latifa.adel',    name: 'لطيفة عادل',     bio: 'شيف وطباخة بيتية 👩‍🍳',          profilePic: 'https://randomuser.me/api/portraits/women/68.jpg',  district: 'Al Asimah' },
  { username: 'hind.sultan',    name: 'هند سلطان',      bio: 'تربية وطفولة 🌸',                profilePic: 'https://randomuser.me/api/portraits/women/74.jpg',  district: 'Farwaniyah' },
  { username: 'ghaida.tariq',   name: 'غيداء طارق',     bio: 'إنتيريور وتصميم داخلي 🏠',       profilePic: 'https://randomuser.me/api/portraits/women/26.jpg',  district: 'Al Asimah' },
  { username: 'nada.kareem',    name: 'ندى كريم',       bio: 'باحثة وأكاديمية',                profilePic: 'https://randomuser.me/api/portraits/women/82.jpg',  district: 'Ahmadi' },
  { username: 'arwa.mazen',     name: 'أروى مازن',      bio: 'فلسفة وفكر حر 💭',               profilePic: 'https://randomuser.me/api/portraits/women/48.jpg',  district: 'Al Asimah' },
  { username: 'wafa.sami',      name: 'وفاء سامي',      bio: 'تعليم وإلهام 📚',                profilePic: 'https://randomuser.me/api/portraits/women/33.jpg',  district: 'Hawalli' },
  { username: 'abeer.ziad',     name: 'عبير زياد',      bio: 'شعر وكلمات | صوت المرأة',        profilePic: 'https://randomuser.me/api/portraits/women/19.jpg',  district: 'Al Asimah' },
  { username: 'ruba.anwar',     name: 'ربى أنور',       bio: 'ويلنس وصحة نفسية 🌿',            profilePic: 'https://randomuser.me/api/portraits/women/59.jpg',  district: 'Jahra' },
  { username: 'suha.ali',       name: 'سها علي',        bio: 'قانون وحقوق | محامية ⚖️',        profilePic: 'https://randomuser.me/api/portraits/women/72.jpg',  district: 'Al Asimah' },
  { username: 'ameera.hassan',  name: 'أميرة حسن',      bio: 'فاينانس وإنفست 📊',              profilePic: 'https://randomuser.me/api/portraits/women/38.jpg',  district: 'Ahmadi' },
  { username: 'nour.ibrahim',   name: 'نور إبراهيم',    bio: 'إبداع وتصميم 🎨',                profilePic: 'https://randomuser.me/api/portraits/women/85.jpg',  district: 'Al Asimah' },
  { username: 'ahmad.yousef',   name: 'أحمد يوسف',      bio: 'تك وستارت أب 🚀',               profilePic: 'https://randomuser.me/api/portraits/men/45.jpg',    district: 'Al Asimah' },
  { username: 'faisal.nasser',  name: 'فيصل ناصر',      bio: 'إنفستمنت وبورصة 📈',             profilePic: 'https://randomuser.me/api/portraits/men/32.jpg',    district: 'Hawalli' },
  { username: 'khaled.omar',    name: 'خالد عمر',       bio: 'رياضة وفيتنس 💪',               profilePic: 'https://randomuser.me/api/portraits/men/67.jpg',    district: 'Al Asimah' },
  { username: 'nawaf.salem',    name: 'نواف سالم',      bio: 'جيمر وتك إنفلونسر 🎮',           profilePic: 'https://randomuser.me/api/portraits/men/25.jpg',    district: 'Farwaniyah' },
  { username: 'meshal.bader',   name: 'مشعل بدر',       bio: 'بيزنس وإنتربرنيور',              profilePic: 'https://randomuser.me/api/portraits/men/52.jpg',    district: 'Ahmadi' },
  { username: 'bader.hamad',    name: 'بدر حمد',        bio: 'موسيقى وفن 🎵',                  profilePic: 'https://randomuser.me/api/portraits/men/78.jpg',    district: 'Al Asimah' },
  { username: 'hamad.rashed',   name: 'حمد راشد',       bio: 'سيارات كلاسيك 🚗',              profilePic: 'https://randomuser.me/api/portraits/men/41.jpg',    district: 'Hawalli' },
  { username: 'salem.jasim',    name: 'سالم جاسم',      bio: 'صيد وبحر 🎣',                   profilePic: 'https://randomuser.me/api/portraits/men/60.jpg',    district: 'Mubarak Al-Kabeer' },
  { username: 'yousef.tariq',   name: 'يوسف طارق',      bio: 'فيلم وإخراج 🎬',                profilePic: 'https://randomuser.me/api/portraits/men/36.jpg',    district: 'Al Asimah' },
  { username: 'omar.saad',      name: 'عمر سعد',        bio: 'فود وكافيهات ☕',               profilePic: 'https://randomuser.me/api/portraits/men/83.jpg',    district: 'Hawalli' },
  { username: 'turki.waleed',   name: 'تركي وليد',      bio: 'ريستورانت وشيف 🍽',              profilePic: 'https://randomuser.me/api/portraits/men/29.jpg',    district: 'Al Asimah' },
  { username: 'rashed.fahad',   name: 'راشد فهد',       bio: 'زراعة عضوية 🌱',                profilePic: 'https://randomuser.me/api/portraits/men/55.jpg',    district: 'Ahmadi' },
  { username: 'sultan.mohammed',name: 'سلطان محمد',     bio: 'رياضة وبطولات 🏆',              profilePic: 'https://randomuser.me/api/portraits/men/72.jpg',    district: 'Jahra' },
  { username: 'saad.ali',       name: 'سعد علي',        bio: 'مقاولات وعقارات 🏗',             profilePic: 'https://randomuser.me/api/portraits/men/46.jpg',    district: 'Al Asimah' },
  { username: 'waleed.kareem',  name: 'وليد كريم',      bio: 'سوفتوير إنجنير | كود ❤️',        profilePic: 'https://randomuser.me/api/portraits/men/38.jpg',    district: 'Hawalli' },
  { username: 'mishari.ziad',   name: 'مشاري زياد',     bio: 'فاينانشل أدفايزر 💼',            profilePic: 'https://randomuser.me/api/portraits/men/63.jpg',    district: 'Al Asimah' },
  { username: 'bandar.ahmad',   name: 'بندر أحمد',      bio: 'مهندس ومخترع 🔧',               profilePic: 'https://randomuser.me/api/portraits/men/22.jpg',    district: 'Farwaniyah' },
  { username: 'essa.mazen',     name: 'عيسى مازن',      bio: 'تطوير عقاري 🏢',                profilePic: 'https://randomuser.me/api/portraits/men/70.jpg',    district: 'Al Asimah' },
  { username: 'emad.sami',      name: 'عماد سامي',      bio: 'دكتور طوارئ 🏥',                profilePic: 'https://randomuser.me/api/portraits/men/57.jpg',    district: 'Ahmadi' },
  { username: 'jaber.anwar',    name: 'جابر أنور',      bio: 'قانون وحقوق ⚖️',               profilePic: 'https://randomuser.me/api/portraits/men/49.jpg',    district: 'Jahra' },
  { username: 'nasser.ibrahim', name: 'ناصر إبراهيم',   bio: 'بيئة وطبيعة 🌿',                profilePic: 'https://randomuser.me/api/portraits/men/87.jpg',    district: 'Al Asimah' },
  { username: 'abdullah.hassan',name: 'عبدالله حسن',    bio: 'برمجة ولوجيك 🧩',               profilePic: 'https://randomuser.me/api/portraits/men/33.jpg',    district: 'Hawalli' },
  { username: 'majed.adel',     name: 'ماجد عادل',      bio: 'جرافيك ديزاين 🎨',              profilePic: 'https://randomuser.me/api/portraits/men/76.jpg',    district: 'Al Asimah' },
  { username: 'salman.faisal',  name: 'سلمان فيصل',     bio: 'كرة قدم وكويت SC ⚽',           profilePic: 'https://randomuser.me/api/portraits/men/19.jpg',    district: 'Farwaniyah' },
  { username: 'fahad.khaled',   name: 'فهد خالد',       bio: 'تك وإي-كوميرس 🛒',              profilePic: 'https://randomuser.me/api/portraits/men/42.jpg',    district: 'Al Asimah' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let updated = 0;
  let created = 0;

  for (let i = 0; i < DUMMY_USERS.length; i++) {
    const p = `+965000000${String(i + 1).padStart(2, '0')}`;
    const data = DUMMY_USERS[i];

    try {
      const existing = await User.findOne({ phone: p });

      if (existing) {
        // Update existing user with new name, username, bio, profilePic
        await User.updateOne(
          { phone: p },
          {
            $set: {
              username: data.username,
              name: data.name,
              bio: data.bio,
              profilePic: data.profilePic,
              district: data.district,
            },
          }
        );
        updated++;
        console.log(`✓ updated  ${p}  @${data.username}  (${data.name})`);
      } else {
        // Create new user
        await User.create({
          username: data.username,
          name: data.name,
          bio: data.bio,
          profilePic: data.profilePic,
          district: data.district,
          phone: p,
          phoneVerified: true,
          isActive: true,
          hachiPoints: Math.floor(Math.random() * 200) + 50,
          followersCount: Math.floor(Math.random() * 500),
          followingCount: Math.floor(Math.random() * 200),
          postsCount: Math.floor(Math.random() * 30),
        });
        created++;
        console.log(`✓ created  ${p}  @${data.username}  (${data.name})`);
      }
    } catch (err) {
      console.error(`✗ ${p} — ${err.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}  Created: ${created}`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
