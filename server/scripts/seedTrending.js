/**
 * Seed script — creates topics + recent posts tagged to them so the trending
 * algorithm (posts in last 24h) has real data to work with.
 *
 * Run: node scripts/seedTrending.js
 * Safe to re-run: skips existing topics by slug, creates fresh posts each time.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User  = require('../models/User');
const Post  = require('../models/Post');
const Topic = require('../models/Topic');

// ── Topics to seed ─────────────────────────────────────────────────────────────
const TOPICS = [
  { name: 'Traffic',      nameAr: 'زحمة',          slug: 'traffic',        category: 'traffic',       color: '#FF9500', postsCount: 0 },
  { name: 'Jobs',         nameAr: 'وظائف',          slug: 'jobs',           category: 'jobs',          color: '#34C759', postsCount: 0 },
  { name: 'Real Estate',  nameAr: 'عقارات',         slug: 'realestate',     category: 'realestate',    color: '#007AFF', postsCount: 0 },
  { name: 'Sports',       nameAr: 'رياضة',          slug: 'sports',         category: 'sports',        color: '#FF3B30', postsCount: 0 },
  { name: 'Events',       nameAr: 'فعاليات',        slug: 'events',         category: 'events',        color: '#AF52DE', postsCount: 0 },
  { name: 'Technology',   nameAr: 'تقنية',          slug: 'technology',     category: 'technology',    color: '#0033A0', postsCount: 0 },
  { name: 'Food',         nameAr: 'مطاعم وأكل',    slug: 'food',           category: 'entertainment', color: '#FF6B35', postsCount: 0 },
  { name: 'Health',       nameAr: 'صحة',            slug: 'health',         category: 'health',        color: '#32ADE6', postsCount: 0 },
  { name: 'Politics',     nameAr: 'سياسة',          slug: 'politics',       category: 'politics',      color: '#C8102E', postsCount: 0 },
  { name: 'Society',      nameAr: 'مجتمع',          slug: 'society',        category: 'society',       color: '#636366', postsCount: 0 },
  { name: 'Offers',       nameAr: 'عروض وخصومات',  slug: 'offers',         category: 'offers',        color: '#FF2D55', postsCount: 0 },
  { name: 'Entertainment',nameAr: 'ترفيه',          slug: 'entertainment',  category: 'entertainment', color: '#FF9F0A', postsCount: 0 },
];

// ── Posts per topic (realistic Kuwaiti content) ────────────────────────────────
const TOPIC_POSTS = {
  traffic:       ['زحمة على السالمية هالصبح ما تصدق! خذوا طريق بدل 🚗', 'حادث على طريق الجهراء، الله يعين الناس', 'اليوم الأزرق في المنقف زحمة غير طبيعية 😩', 'طريق الفحيحيل مسكر من الساعة 7، اللي يبي يروح الأحمدي خذ الدائري'],
  jobs:          ['فرصة عمل في شركة ناشئة كويتية — مطلوب مطور فول ستاك 🚀', 'بنك بيتك يفتح باب التوظيف لخريجي المحاسبة', 'وظائف حكومية جديدة في ديوان الخدمة المدنية، الموعد النهائي الأسبوع الجاي', 'مطلوب مصمم جرافيك بخبرة سنتين في الكويت، الراتب مجزي'],
  realestate:    ['شقة للإيجار في حولي — 3 غرف وصالة بـ 450 دينار', 'أسعار الأراضي في جنوب الصباحية ارتفعت 30% هذا العام', 'فيلا للبيع في البيان — سعر مناسب وموقع ممتاز 🏡', 'أفضل مناطق للإيجار بسعر معقول في الكويت هالأيام؟'],
  sports:        ['الكويت تفوز على البحرين 2-1 في التصفيات! 🇰🇼⚽', 'القادسية بطل كأس الأمير هذا الموسم، مبروك! 🏆', 'منتخب الكويت للكرة الطائرة يتأهل للبطولة الآسيوية', 'افتتاح مركز رياضي جديد في مدينة صباح الأحمد الرياضية'],
  events:        ['مهرجان الكويت للتسوق يبدأ الأسبوع الجاي — خصومات تصل 70%', 'معرض الكتاب الدولي في الكويت يفتتح أبوابه يوم الجمعة 📚', 'حفل موسيقي في أفنيوز هذا الجمعة — التذاكر محدودة 🎵', 'معرض الفن الكويتي في المتحف الوطني يستمر حتى نهاية الشهر 🎨'],
  technology:    ['آبل تفتتح أول متجر رسمي في الكويت! 🍎', 'شركة كويتية ناشئة تحصل على تمويل 10 مليون دولار', 'خدمة الجيل الخامس تصل لمنطقة الأحمدي قريباً', 'أفضل لابتوب للعمل من المنزل في 2025 — مقارنة كاملة'],
  food:          ['أفضل مطعم مشاوي في الكويت — تجربتي في مطعم ليوان 🍢', 'كافيه جديد في السالمية اسمه Blend، القهوة ممتازة ☕', 'الكبسة الكويتية الأصلية وين تلقاها هالأيام؟ 🍚', 'مطعم برجر جديد افتتح في الأفنيوز، الصمون مختلف!'],
  health:        ['وزارة الصحة تعلن عن حملة تطعيم مجانية الأسبوع الجاي 💉', 'مستشفى الأميري يفتتح قسم جديد للقلب والأوعية الدموية', 'نصائح للوقاية من ضربة الشمس في الصيف الكويتي ☀️', 'نتائج بحث جديد: المشي 30 دقيقة يومياً يقلل خطر السكري 40%'],
  politics:      ['مجلس الأمة يناقش ميزانية الدولة غداً — تفاصيل مهمة', 'وزير المالية يعلن عن حزمة دعم للمواطنين', 'الكويت تستضيف اجتماع الجامعة العربية الشهر الجاي', 'إقرار قانون جديد لدعم المشاريع الصغيرة والمتوسطة'],
  society:       ['الديوانيات الكويتية — تراث ما يُقدَّر بثمن 🫖', 'تزايد ظاهرة العمل الحر بين الشباب الكويتي', 'مبادرة شبابية كويتية لتنظيف الشواطئ — 500 متطوع!', 'ارتفاع نسبة التحصيل الجامعي عند المرأة الكويتية'],
  offers:        ['نون.كوم خصومات تصل 60% على الإلكترونيات هذا الأسبوع 🛒', 'كارفور عرض الأسبوع — خصم 30% على الخضار والفواكه', 'زارا تخفيضات الموسم بدأت، أسعار ما تصدق 👗', 'أنكر تخفيضات على أجهزة الشحن اللاسلكي — سعر رائع'],
  entertainment: ['فيلم Mission Impossible الجديد في سينما الأفنيوز 🎬', 'مسلسل كويتي جديد على شاهد يبدأ رمضان الجاي', 'ألبوم فيروز الجديد أخيراً متاح على سبوتيفاي 🎵', 'حلقة جديدة من برنامج مشاهير الكويت على يوتيوب'],
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Find or create a seed user to author posts
  let seedUser = await User.findOne({ username: 'seed_trending' });
  if (!seedUser) {
    seedUser = await User.create({
      username: 'seed_trending',
      name: 'Kuwait Trending',
      phone: '+96599999000',
      email: 'trending@seed.kn',
    });
    console.log('✓ Created seed user');
  }

  // Upsert topics
  const topicDocs = {};
  for (const t of TOPICS) {
    let doc = await Topic.findOne({ slug: t.slug });
    if (!doc) {
      doc = await Topic.create({ ...t, isActive: true });
      console.log(`  + Topic: ${t.nameAr}`);
    } else {
      console.log(`  ~ Topic exists: ${t.nameAr}`);
    }
    topicDocs[t.slug] = doc;
  }

  // Create posts with topicTags (timestamped within last 24h)
  let postCount = 0;
  const now = Date.now();

  for (const [slug, contents] of Object.entries(TOPIC_POSTS)) {
    const topic = topicDocs[slug];
    if (!topic) continue;

    for (let i = 0; i < contents.length; i++) {
      // Spread posts over last 22 hours so all fall in the 24h window
      const hoursAgo = Math.random() * 22;
      const createdAt = new Date(now - hoursAgo * 60 * 60 * 1000);

      await Post.create({
        userId: seedUser._id,
        content: contents[i],
        type: 'text',
        visibility: 'public',
        topicTags: [topic._id],
        likesCount: Math.floor(Math.random() * 40),
        commentsCount: Math.floor(Math.random() * 10),
        createdAt,
        updatedAt: createdAt,
      });
      postCount++;
    }

    // Keep postsCount accurate
    await Topic.findByIdAndUpdate(topic._id, { $inc: { postsCount: contents.length } });
  }

  console.log(`✓ Created ${postCount} seeded posts across ${Object.keys(TOPIC_POSTS).length} topics`);
  await mongoose.disconnect();
  console.log('✓ Done');
}

seed().catch((err) => { console.error(err); process.exit(1); });
