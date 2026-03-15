/**
 * Screenshot seed — fills the app with realistic Kuwait content for App Store screenshots.
 * Run: node scripts/seedScreenshots.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Hachi = require('../models/Hachi');

// ── Demo users — fictional names only, no family names, no officials ───────────
const USERS = [
  // 0
  {
    username: 'demo_khaled7',
    name: 'خالد',
    bio: 'سيارات وكافيه ☕ | Salmiya',
    profilePic: 'https://i.pravatar.cc/150?img=11',
    verifiedBadge: 'none',
    district: 'Hawalli',
  },
  // 1
  {
    username: 'demo_noura',
    name: 'نورة 🌸',
    bio: 'Food blogger 🍜 | Trying every spot in Kuwait 🇰🇼',
    profilePic: 'https://i.pravatar.cc/150?img=47',
    verifiedBadge: 'influencer',
    district: 'Al Asimah',
  },
  // 2
  {
    username: 'demo_sultan',
    name: 'سلطان',
    bio: 'Tech & startups 🚀 | Coffee first, code second',
    profilePic: 'https://i.pravatar.cc/150?img=33',
    verifiedBadge: 'business',
    district: 'Al Asimah',
  },
  // 3
  {
    username: 'demo_rana',
    name: 'رنا ✏️',
    bio: 'Artist & designer | كويت | 🎨',
    profilePic: 'https://i.pravatar.cc/150?img=44',
    verifiedBadge: 'none',
    district: 'Ahmadi',
  },
  // 4
  {
    username: 'demo_ali99',
    name: 'علي',
    bio: 'رياضة وصحة 💪 | 5am club | Jahra',
    profilePic: 'https://i.pravatar.cc/150?img=15',
    verifiedBadge: 'none',
    district: 'Jahra',
  },
  // 5
  {
    username: 'demo_layla',
    name: 'ليلى ✈️',
    bio: 'Travel addict | Coffee lover ☕ | Based in Kuwait',
    profilePic: 'https://i.pravatar.cc/150?img=56',
    verifiedBadge: 'none',
    district: 'Hawalli',
  },
  // 6
  {
    username: 'demo_jasem',
    name: 'جاسم',
    bio: 'أخبار وتقارير 📰 | Sharing what matters',
    profilePic: 'https://i.pravatar.cc/150?img=3',
    verifiedBadge: 'none',
    district: 'Al Asimah',
  },
  // 7
  {
    username: 'demo_dina',
    name: 'دينا 💄',
    bio: 'Beauty & lifestyle | كل شي كويت 🇰🇼',
    profilePic: 'https://i.pravatar.cc/150?img=49',
    verifiedBadge: 'influencer',
    district: 'Hawalli',
  },
];

// ── Posts ─────────────────────────────────────────────────────────────────────
const POSTS = [
  {
    usernameIndex: 6, // jasem
    content: '🚦 حركة المرور على الدائري الثاني كثيفة جداً الآن، حادث قرب مخرج 7. استخدموا الطريق البديل عبر الساحل.',
    likesCount: 1872,
    commentsCount: 94,
    type: 'text',
    createdAt: minsAgo(12),
  },
  {
    usernameIndex: 1, // noura
    content: 'جربت مطعع برجر جديد في السالمية وكان على مستوى آخر 🔥 The wagyu patty alone is worth the trip. Highly recommend for a special night out 🍔✨',
    images: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
    ],
    likesCount: 412,
    commentsCount: 67,
    type: 'photo',
    createdAt: minsAgo(22),
  },
  {
    usernameIndex: 2, // sultan
    content: "Excited to announce our startup just closed its seed round! 🎉 شكراً لكل من صدّق بنا من اليوم الأول. Kuwait's tech scene is growing fast — we're just getting started 🚀",
    likesCount: 1203,
    commentsCount: 89,
    type: 'text',
    createdAt: minsAgo(45),
  },
  {
    usernameIndex: 0, // khaled
    content: 'وصلت نسخة 2025 من الـ Land Cruiser للكويت 🤩 The new interior is incredible. كل الي بيشتريها يسويها 🔑',
    images: [
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
    ],
    likesCount: 673,
    commentsCount: 98,
    type: 'photo',
    createdAt: minsAgo(120),
  },
  {
    usernameIndex: 5, // layla
    content: 'طلعت يوم سريع وكان الجو رهيب ☀️ Weekend trips hit different. من يجي معي المرة الجاية؟ 😄',
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    ],
    likesCount: 289,
    commentsCount: 43,
    type: 'photo',
    createdAt: minsAgo(180),
  },
  {
    usernameIndex: 7, // dina
    content: 'روتين الصبح اللي غيّر حياتي ✨ Skincare + قهوة + نافذة مفتوحة. جربوه لأسبوع واخبروني 💕',
    images: [
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80',
    ],
    likesCount: 881,
    commentsCount: 112,
    type: 'photo',
    createdAt: minsAgo(150),
  },
  {
    usernameIndex: 4, // ali
    content: 'Day 30 of the 100-day challenge done ✅ 5am workouts are the only way. من يبدأ معي تحدي الشهر الجاي؟ 💪🏋️',
    likesCount: 198,
    commentsCount: 52,
    type: 'text',
    createdAt: minsAgo(240),
  },
  {
    usernameIndex: 3, // rana
    content: "Finished this piece last night 🎨 inspired by Kuwait's old pearl-diving heritage. السمحة والمرساة والبحر.. كويت قديمة في لوحة حديثة. Available — DM me 📩",
    images: [
      'https://images.unsplash.com/photo-1579762715118-a6f1d4b934f1?w=800&q=80',
    ],
    likesCount: 521,
    commentsCount: 76,
    type: 'photo',
    createdAt: minsAgo(310),
  },
  {
    usernameIndex: 1, // noura
    content: "ترتيب أفضل 5 كافيهات في الكويت بشكل موضوعي ☕\n\n1. Mokha — العاصمة\n2. Stir — السالمية\n3. Press'd — حولي\n4. Caribou — الجهراء\n5. The Spot — الفروانية\n\nاتفقون وتختلفون؟",
    likesCount: 934,
    commentsCount: 187,
    type: 'text',
    createdAt: minsAgo(420),
  },
  {
    usernameIndex: 2, // sultan
    content: "Hiring! Looking for a senior React Native dev to join our Kuwait City team 🇰🇼 Remote-friendly with good KD package. DM or drop your CV 📄 #jobs #tech #kuwait",
    likesCount: 445,
    commentsCount: 63,
    type: 'text',
    createdAt: minsAgo(500),
  },
  {
    usernameIndex: 0, // khaled
    content: 'الكافيه الجديد في السالمية جنان والله ☕ ديكور راقي والقهوة أحلى من غيرها — يستاهل الزيارة',
    images: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    ],
    likesCount: 334,
    commentsCount: 41,
    type: 'photo',
    createdAt: minsAgo(600),
  },
  {
    usernameIndex: 6, // jasem
    content: 'درجة الحرارة بكرة توصل 47 درجة 🌡️ خذوا احتياطاتكم، اشربوا مية، وما تطلعون بالشمس إلا ضرورة.',
    likesCount: 2100,
    commentsCount: 158,
    type: 'text',
    createdAt: minsAgo(55),
  },
];

// ── Hachi Circles ─────────────────────────────────────────────────────────────
const CIRCLES = [
  {
    title: 'وين أحسن غداء اليوم؟ 🍽️',
    category: 'food',
    creatorIndex: 1,
    memberIndices: [0, 2, 4, 5],
    reactions: { fire: 34, eyes: 18, skull: 5 },
    messages: [
      { userIndex: 1, text: 'شباب وين تنصحونني الغداء اليوم؟ تعبت من نفس الأماكن 😭' },
      { userIndex: 0, text: 'جرب Slider Station في الأفنيوز، الـ sliders حق اليوم لا يوصف 🔥' },
      { userIndex: 4, text: 'أنا أنصح سمك طازج، ما في أفضل منه يوم الخميس' },
      { userIndex: 2, text: 'في مطعم جديد في السالمية اسمه Grill House، top tier' },
      { userIndex: 5, text: 'أنا مع الكبسة الكويتية دايم، ما تغلط أبد 🍚' },
    ],
  },
  {
    title: 'احسن قهوة بوسط البلد ☕',
    category: 'coffee',
    creatorIndex: 0,
    memberIndices: [1, 3, 5],
    reactions: { fire: 22, eyes: 41, skull: 2 },
    messages: [
      { userIndex: 0, text: 'يا جماعة من يعرف كافيه هادي ومريح في العاصمة؟' },
      { userIndex: 5, text: 'Mokha هو الـ GOAT ☕ الجو هناك مختلف كلياً' },
      { userIndex: 3, text: 'أنا أحب One More Cup, بس ازدحام دايم 😅' },
      { userIndex: 1, text: 'Stir في السالمية أحسن flat white, trust me on this' },
    ],
  },
  {
    title: 'ليلة المباراة — الكويت 🏆⚽',
    category: 'general',
    creatorIndex: 4,
    memberIndices: [0, 2, 6, 7],
    reactions: { fire: 89, eyes: 12, skull: 31 },
    messages: [
      { userIndex: 4, text: 'شباب نتجمع نشاهد المباراة؟ 🙋' },
      { userIndex: 0, text: 'أنا معك بس وين؟' },
      { userIndex: 4, text: 'عندي مكان، ابغى 6 أشخاص على الأقل' },
      { userIndex: 2, text: 'أنا جاي إن شاء الله! الكويت الليلة تفوز ✅🇰🇼' },
      { userIndex: 6, text: 'المباراة الساعة 8 مساء، لا تتأخرون' },
      { userIndex: 7, text: 'من يجيب وناسة وكشنة؟ أنا جايبه 🎉' },
    ],
  },
  {
    title: 'سيارات — عروض وبيع 🚗',
    category: 'cars',
    creatorIndex: 0,
    memberIndices: [2, 4],
    reactions: { fire: 15, eyes: 27, skull: 3 },
    messages: [
      { userIndex: 0, text: 'عندي GX موديل 2021 للبيع، فل كامل بدون حوادث' },
      { userIndex: 2, text: 'كم السعر؟' },
      { userIndex: 0, text: '12,500 KD — السعر نهائي' },
      { userIndex: 4, text: 'أنا بحث عن Prado ما عندك شي؟' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function minsAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Create users
  const createdUsers = [];
  for (const u of USERS) {
    let user = await User.findOne({ username: u.username });
    if (!user) {
      user = await User.create({
        username: u.username,
        name: u.name,
        bio: u.bio,
        profilePic: u.profilePic,
        verifiedBadge: u.verifiedBadge || 'none',
        district: u.district,
        phone: `+96599${String(createdUsers.length + 1000000).slice(1)}`,
        phoneVerified: true,
        postsCount: Math.floor(Math.random() * 80) + 10,
        hachiPoints: 100,
        isActive: true,
      });
      console.log(`  👤 Created user: @${u.username}`);
    } else {
      console.log(`  ↩️  Exists: @${u.username}`);
    }
    createdUsers.push(user);
  }

  // Make all users follow each other so the feed is full
  for (let i = 0; i < createdUsers.length; i++) {
    for (let j = 0; j < createdUsers.length; j++) {
      if (i === j) continue;
      const a = createdUsers[i];
      const b = createdUsers[j];
      const already = a.following.some((f) => f.toString() === b._id.toString());
      if (!already) {
        a.following.push(b._id);
        b.followers.push(a._id);
      }
    }
  }
  for (const u of createdUsers) {
    u.followersCount = u.followers.length;
    u.followingCount = u.following.length;
    u.hachiPoints = 100;
    await u.save();
  }
  console.log('  🔗 Follow graph set up');

  // Create posts
  for (const p of POSTS) {
    const author = createdUsers[p.usernameIndex];
    await Post.create({
      userId: author._id,
      content: p.content,
      images: p.images || [],
      type: p.type || 'text',
      likesCount: p.likesCount || 0,
      commentsCount: p.commentsCount || 0,
      trendingScore: p.likesCount + (p.commentsCount * 2),
      createdAt: p.createdAt || new Date(),
      updatedAt: p.createdAt || new Date(),
    });
    console.log(`  📝 Post by @${author.username}: "${p.content.slice(0, 40)}…"`);
  }

  // Create Hachi circles
  for (const c of CIRCLES) {
    const existing = await Hachi.findOne({ title: c.title });
    if (existing) {
      console.log(`  ↩️  Circle exists: ${c.title}`);
      continue;
    }
    const creator = createdUsers[c.creatorIndex];
    const members = c.memberIndices.map((i) => createdUsers[i]._id);
    const messages = c.messages.map((m) => ({
      user: createdUsers[m.userIndex]._id,
      text: m.text,
      reactions: [],
      createdAt: new Date(Date.now() - Math.random() * 30 * 60 * 1000),
    }));
    await Hachi.create({
      title: c.title,
      category: c.category,
      creator: creator._id,
      members: [creator._id, ...members],
      memberCount: members.length + 1,
      messages,
      reactions: c.reactions,
      isActive: true,
      isPublic: true,
    });
    console.log(`  💬 Circle: "${c.title}" (${messages.length} messages)`);
  }

  console.log('\n🎉 Screenshot seed complete! Restart the server and refresh the app.');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
