/**
 * Seed script — creates dummy users + posts for Kuwait Now.
 * Run: node scripts/seedPosts.js
 * Safe to run multiple times (checks for existing usernames).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

// ── Dummy users ───────────────────────────────────────────────────────────────
const DUMMY_USERS = [
  { username: 'faisal_q8',    name: 'فيصل المطيري',   phone: '+96550000001', email: 'faisal_q8@seed.kn',    bio: 'كويتي أصيل | محب للرياضة والسفر' },
  { username: 'nora_kwt',     name: 'نورة العتيبي',   phone: '+96550000002', email: 'nora_kwt@seed.kn',     bio: 'مدونة | كاتبة محتوى | أم لطفلين' },
  { username: 'bader_q8',     name: 'بدر الرشيدي',    phone: '+96550000003', email: 'bader_q8@seed.kn',     bio: 'رجل أعمال | شريك في @kwt_ventures' },
  { username: 'sara_kuwait',  name: 'سارة الحربي',    phone: '+96550000004', email: 'sara_kuwait@seed.kn',  bio: 'طالبة جامعية | شغوفة بالفن والتصميم' },
  { username: 'abdulaziz_kw', name: 'عبدالعزيز الصبح',phone: '+96550000005', email: 'abdulaziz_kw@seed.kn', bio: 'مهندس برمجيات | متحمس للتقنية' },
  { username: 'maryam_q8',   name: 'مريم الأنصاري',  phone: '+96550000006', email: 'maryam_q8@seed.kn',   bio: 'طبيبة أسنان | اهتم بالصحة والعافية' },
  { username: 'khaled_kwt',  name: 'خالد العجمي',    phone: '+96550000007', email: 'khaled_kwt@seed.kn',  bio: 'محامي | حقوق | شؤون قانونية' },
  { username: 'dana_q8',     name: 'دانة المضف',     phone: '+96550000008', email: 'dana_q8@seed.kn',     bio: 'مصورة | أحب التوثيق والسفر' },
];

// ── Dummy posts (Arabic, realistic Kuwaiti content) ──────────────────────────
const POST_TEMPLATES = [
  // Everyday life
  { content: 'الطقس اليوم ممتاز والله! ناس تنزل البحر؟ 🌊' },
  { content: 'زحمة على طريق الجهراء من الصبح، الله يعين الناس 😩 خذوا طريق بدل' },
  { content: 'مطعم الدار الجديد في سالمية جربته أمس — الكبسة ما شاء الله عليها، أنصح فيه كثير 🍚' },
  { content: 'وين أحسن مكان أشيل سيارة في الكويت؟ أبغى ورشة أمينة ومو غالية' },
  { content: 'نتيجة مباراة الكويت أمس كانت خيبة صراحة، الفريق يحتاج دعم وإدارة أفضل 😔⚽' },
  { content: 'للناس اللي تبحث عن شقة في حولي — منطقة سلام عروض حلوة هالأيام، المتر بـ 280' },
  { content: 'شرو ذهب عيار 21 شو السعر هالأيام؟ أبغى أطري لعروسة' },
  { content: 'افتتاح أول كوفي شوب يشتغل 24 ساعة في السالمية! أخيراً 🙌☕' },
  { content: 'سؤال جد: وين تشترون لحم طازج بسعر معقول؟ السوق المركزي غالي هالأيام' },
  { content: 'رحلة ماليزيا بـ 180 دينار ذهاب وإياب من الكويت — شريت التذكرة هالصبح 😁✈️' },
  { content: 'مبروك الكويت على المركز الأول عربياً في مؤشر الابتكار الحكومي 🇰🇼🏆' },
  { content: 'أي واحد جرب خدمة توصيل هنقرستيشن الجديدة؟ يستاهل؟' },
  { content: 'انتبهوا — فيه نصابين يتصلون ويقولون إنهم من بنك بيت التمويل، لا تعطوهم أي معلومات 🚫' },
  { content: 'كل سنة وأهل الكويت بخير بمناسبة الأعياد الوطنية 🇰🇼❤️' },
  { content: 'مرحبا بالمطر اليوم! الكويت ما تكفيها إلا أمطار كثيرة في الشتاء 🌧️' },
  { content: 'لمن يبحث عن وظيفة في قطاع الأمن السيبراني — فيه فرص ممتازة في الشركات الناشئة الكويتية، تواصلوا معي' },
  { content: 'تجمعنا الكويت يوم ما نشوف الديوانيات والناس تتجمع وتتحدث 🫖' },
  { content: 'أفضل كيبروس أو تايلاند للإجازة الصيفية؟ عندكم توصيات؟' },
  { content: 'الكهرباء وقفت ثلاث مرات هالأسبوع في الفروانية — وزارة الكهرباء لازم تحل المشكلة بجدية' },
  { content: 'نصيحة: لا تكملون البنزين من محطات الطرف، خذوا البنزين من المحطات الداخلية أرخص وأفضل' },
  { content: 'جديد: إطلاق تطبيق كويتي لطلب الخدمات المنزلية، يشبه أفضل نسخة من التطبيقات العالمية 💪📱' },
  { content: 'البحر كان صافي اليوم صبح — قاعدين نصيد مع الوالد، مو بس جمال 🎣' },
  { content: 'أسعار الخضار ارتفعت بشكل كبير، الكيلو خيار وصل لـ 800 فلس! شو السبب؟' },
  { content: 'ذكريات الطفولة في حديقة الحيوان الكويتية، وين راحت تلك الأيام 😌' },
  { content: 'شهادتي في خط الكويت طيران: أفضل من قبل بكثير، الخدمة تحسنت والمضيفين محترمين' },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Create users (skip existing)
  const userDocs = [];
  for (const u of DUMMY_USERS) {
    let user = await User.findOne({ username: u.username });
    if (!user) {
      user = await User.create({
        username: u.username,
        name: u.name,
        phone: u.phone,
        email: u.email,
        bio: u.bio,
        isVerified: false,
        role: 'user',
      });
      console.log(`Created user: @${u.username}`);
    } else {
      console.log(`User exists: @${u.username}`);
    }
    userDocs.push(user);
  }

  // Wire up some follows so feeds aren't empty
  for (let i = 0; i < userDocs.length; i++) {
    const u = userDocs[i];
    // Each user follows the next 3 users in the list (circular)
    for (let j = 1; j <= 3; j++) {
      const target = userDocs[(i + j) % userDocs.length];
      const alreadyFollowing = u.following?.some(
        (id) => id.toString() === target._id.toString()
      );
      if (!alreadyFollowing) {
        await User.findByIdAndUpdate(u._id, { $addToSet: { following: target._id }, $inc: { followingCount: 1 } });
        await User.findByIdAndUpdate(target._id, { $addToSet: { followers: u._id }, $inc: { followersCount: 1 } });
      }
    }
  }
  console.log('Follow relationships set up');

  // Create posts — spread across the last 7 days, randomised order
  let created = 0;
  for (let i = 0; i < POST_TEMPLATES.length; i++) {
    const template = POST_TEMPLATES[i];
    const author = userDocs[i % userDocs.length];

    // Random timestamp in the last 7 days
    const daysAgo = Math.random() * 7;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // Random like count (0-40)
    const likesCount = Math.floor(Math.random() * 40);

    await Post.create({
      userId: author._id,
      content: template.content,
      type: 'text',
      images: [],
      likesCount,
      commentsCount: Math.floor(Math.random() * 10),
      isRemoved: false,
      createdAt,
      updatedAt: createdAt,
    });
    created++;
  }

  // Bump postsCount on each user
  for (const u of userDocs) {
    const count = await Post.countDocuments({ userId: u._id });
    await User.findByIdAndUpdate(u._id, { postsCount: count });
  }

  console.log(`Created ${created} posts across ${userDocs.length} users`);
  console.log('Done! ✅');
  await mongoose.disconnect();
};

seed().catch((e) => { console.error(e.message); process.exit(1); });
