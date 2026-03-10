/**
 * Kuwaa Content Seed Script
 * Creates 12 fake Kuwaiti users + 55 authentic posts + 6 circles
 * Run: node scripts/seedKuwaaContent.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Hachi = require('../models/Hachi');

// ── Fake Kuwaiti users ────────────────────────────────────────────────────────
const USERS = [
  { username: 'bu_khalid_q8',    name: 'بو خالد',        bio: 'كويتي أصيل | ديوانية كل خميس' },
  { username: 'um_nora_kw',      name: 'أم نورة',         bio: 'أم وربة بيت | أكل وحلويات' },
  { username: 'fahad_q8',        name: 'فهد المطيري',     bio: 'كرة قدم وسيارات | العربي دايم' },
  { username: 'dalal_kwt',       name: 'دلال',            bio: 'قهوة متخصصة | سفر | سالمية' },
  { username: 'meshaal_q8',      name: 'مشعل الرشيدي',   bio: 'مهندس | هواية الكشته والصحراء' },
  { username: 'nouf_kw',         name: 'نوف',             bio: 'طالبة | كتب وأفلام وطعام' },
  { username: 'abdulaziz_kwt',   name: 'عبدالعزيز',       bio: 'رجل أعمال | الأفنيوز بيتي الثاني' },
  { username: 'reem_q8',         name: 'ريم الكندري',     bio: 'مصورة | أحب الكويت في الشتاء' },
  { username: 'omar_albidaa',    name: 'عمر',             bio: 'من البدع | أكل وضحك وكويت' },
  { username: 'sara_kwt',        name: 'سارة',            bio: 'معلمة | أم لثلاثة | الرميثية' },
  { username: 'jaber_q8',        name: 'جابر العجمي',     bio: 'موظف حكومي | هواية الفوتوغرافي' },
  { username: 'lulwa_kw',        name: 'لولوة',           bio: 'محامية | قهوة كرك الساعة ٢ صباح' },
];

// ── Post content ──────────────────────────────────────────────────────────────
const POSTS = [
  // Food & Restaurants
  { userIdx: 0, content: 'وين أحسن مكان مشاويه بالكويت؟ سألت هالسؤال ألف مره وكل مره أحصل جواب جديد 😅 قولوا لي وصياتكم', likes: 47, replies: 23 },
  { userIdx: 1, content: 'مطعم جديد يفتح بالأفنيوز كل أسبوع بس نفس المنيو — برغر وسلطه ومشروب تريندي 🙄 متى نشوف إبداع؟', likes: 89, replies: 31 },
  { userIdx: 3, content: 'Finally tried that new Korean BBQ place in Salmiya. The queue was 45 mins. Was it worth it? Honestly… yeah. The marinated galbi alone justified the wait.', likes: 62, replies: 18 },
  { userIdx: 1, content: 'الناس تتكلم عن المطاعم الجديدة بس أنا ما أقدر أتخلى عن مطبخ أمي. المچبوس اللي تسويه ما يجيه مطعم بالدنيا كلها 🤍', likes: 203, replies: 44 },
  { userIdx: 9, content: 'Hot take: الكنافة النابلسية اللي بالكويت أحسن من اللي بنابلس نفسها. جربت الاثنين وأنا واثق. قولوا لي رأيكم', likes: 156, replies: 67 },
  { userIdx: 11, content: 'Anyone else ordering from Talabat at 2am telling themselves "last time" every single night? 😂 asking for a friend', likes: 341, replies: 89 },
  { userIdx: 6, content: 'The Avenues food court at 9pm on a Thursday is literally a different country. Every language, every age, every vibe. I love it and hate it equally.', likes: 78, replies: 12 },
  { userIdx: 1, content: 'رمضان يجي وأنا أحلم بالهريس والجريش من عند أهلي. الأكل الكويتي الأصيل ما فيه كلام — أي مطعم فاخر ما يوصل لمستواه', likes: 189, replies: 28 },
  { userIdx: 11, content: 'Bait Al Khamees or Mais Alghanim for a traditional Kuwaiti dinner? Genuine question, need a table for 8. Budget is not the issue.', likes: 43, replies: 56 },
  { userIdx: 8, content: 'مطبخ أمي يوم الجمعة: مچبوس دجاج + دبيازي + أرز بالزعفران. أنا مو محتاج أفنيوز ولا مطاعم. هذا هو الفايف ستار الحقيقي 👑', likes: 274, replies: 35 },

  // Traffic & Roads
  { userIdx: 2, content: 'الدائري الخامس الساعة ٨ الصبح. السبب الوحيد اللي يخليني أتمنى أشتغل من البيت كل يوم الله يصبر الجميع', likes: 298, replies: 76 },
  { userIdx: 0, content: 'شخص ياخذ ٣ مواقف بالباركينج بسيارة واحدة. الجنة والنار حقيقيتان وهذا الشخص يعرف طريقه جيداً 🙂', likes: 445, replies: 93 },
  { userIdx: 7, content: 'Gulf Road on a Friday evening hits different. The breeze, the cornice, the lights reflecting off the water. One of the best things about this country.', likes: 187, replies: 22 },
  { userIdx: 4, content: 'أحتاج أسافر من الفروانية للسالمية الساعة ٥ العصر يوم خميس. دعواتكم بصدق، الله المعين 🤲', likes: 312, replies: 118 },
  { userIdx: 2, content: 'Why does every Kuwaiti driver act like they personally built the road and have exclusive rights to all three lanes simultaneously', likes: 567, replies: 144 },
  { userIdx: 0, content: 'نظام الباص الجديد بالكويت — هل ركب أحد فعلاً؟ جاد أسأل، مو استهزاء. أبي أجرب بس ما أعرف أحد جربه', likes: 89, replies: 67 },

  // Weather
  { userIdx: 9, content: 'أبريل بالكويت: الصبح ١٨ درجة وبالظهر ٤٢. كيف الواحد يلبس؟ جهزت ٤ تيشيرتات ومعطف بنفس اليوم', likes: 423, replies: 87 },
  { userIdx: 7, content: 'The sandstorm yesterday turned my white car into a desert art installation. Nature said: here\'s your free paint job 🌪️', likes: 389, replies: 54 },
  { userIdx: 4, content: 'Kuwait winter (all 3 weeks of it) is actually peak. Hoodies, qahwa, diwaniya, desert camping. Life is genuinely good.', likes: 234, replies: 31 },
  { userIdx: 10, content: 'الغبار اليوم مو طبيعي. سماعاتي كان فيها رمل. رمل داخل السماعات. كيف؟ ليش؟ متى تنتهي هالحياة ☁️', likes: 512, replies: 98 },
  { userIdx: 2, content: 'يونيو يجي وأنا أبدأ حياتي الليلية رسمياً. النهار ملك الشمس والليل ملكنا. كل نشاطاتي بعد الساعة ٩ مساء', likes: 267, replies: 43 },

  // Sports
  { userIdx: 2, content: 'العربي ما يستاهل النتيجة اليوم والله. الأداء كان تحت المستوى بمراحل. ما راح أتكلم زيادة عشان ما أزيد ضغطي', likes: 178, replies: 89 },
  { userIdx: 2, content: 'الكويت في كأس العرب — ما كنت أتخيل إني أشوف هذا اليوم بعيني الحين. فخورين وكل كويتي يستاهل يشوف هالمنظر 🇰🇼', likes: 634, replies: 112 },
  { userIdx: 8, content: 'Anyone else still replaying that goal from the Kuwait vs Iraq match? That finish was absolutely top shelf. The man is built different.', likes: 289, replies: 76 },
  { userIdx: 0, content: 'الفريق الوطني يحتاج لاعبين يحسون بالانتماء، مو بس مدربين أجانب يجيبون تكتيكات ما تناسب روحنا وطريقة لعبنا', likes: 234, replies: 143 },
  { userIdx: 2, content: 'القادسية والعربي الجمعة القادمة. اللي يجي يجي بقلب قوي وضغط دم طبيعي. ما ضمنا شي 🔥', likes: 198, replies: 87 },

  // Culture & Tradition
  { userIdx: 0, content: 'الديوانية ما تعوضها أي سوشيال ميديا بالدنيا. حضور حقيقي، قهوة حقيقية، كلام حقيقي، ضحكة حقيقية. هذي الحياة', likes: 387, replies: 64 },
  { userIdx: 10, content: 'أول يوم رمضان بعد أذان المغرب — هذا الإحساس ما أقدر أوصفه بكلمات وما أتوقع أقدر يوم ما أوصفه', likes: 456, replies: 78 },
  { userIdx: 9, content: 'My grandma still makes gahwa the old way — cardamom roasted in a dallah over actual fire. I always arrive early just to watch her do it.', likes: 312, replies: 47 },
  { userIdx: 9, content: 'الليوان في بيت أهلي القديم بالرميثية أحسن مكان بالكويت كله. كل شي ثاني نسيه. أجلس هناك وأحس إن الوقت وقف', likes: 223, replies: 38 },
  { userIdx: 10, content: 'صلاة الفجر جماعة بالمسجد في رمضان بعد السحور مباشرة. أحسن شعور في الدنيا بفرق كبير. جربوها', likes: 398, replies: 55 },

  // Everyday Life & Humor
  { userIdx: 0, content: 'الكويتي لما يقول "بجي بعدين" يعني راح يجي بعد ساعتين بالضبط. هذا مو تأخير، هذا ثقافة متوارثة ولها احترامها', likes: 689, replies: 234 },
  { userIdx: 3, content: 'Scheduling anything in Kuwait for the summer is genuinely a joke. "Let\'s do it after summer" is our local version of "never." And we all know it.', likes: 478, replies: 98 },
  { userIdx: 2, content: 'حر يوليو بالكويت يخلي الإنسان يتساءل بصدق عن كل قراراته في الحياة. ليش هنا؟ ليش الساعة هذي؟ ليش الوجود؟', likes: 534, replies: 143 },
  { userIdx: 6, content: 'The AC in my car is currently working harder than I have in my entire career. Full respect and solidarity to it. 🙏', likes: 623, replies: 87 },
  { userIdx: 8, content: 'لما تدور موقف بالسالمية يوم عطلة رسمية. دعاء وحده مو كافي، تحتاج صبر أيوب وحظ إبراهيم', likes: 445, replies: 112 },
  { userIdx: 11, content: 'Kuwaiti "inshallah" has at least 7 distinct meanings depending entirely on tone and context. Linguists should dedicate entire papers to this.', likes: 756, replies: 189 },
  { userIdx: 5, content: 'The number of WhatsApp group chats I\'m in that exist purely to forward voice notes: 11. The number I\'ve muted: 11. We move.', likes: 498, replies: 76 },
  { userIdx: 0, content: 'جدي ما يفهم ليش ما أجي للديوانية كل يوم. أنا أشتغل يا جدي. الوظيفة مو تقاعد 😂 يقول "زماننا ما كان في اعتذارات"', likes: 567, replies: 134 },

  // Places & Areas
  { userIdx: 3, content: 'Salmiya waterfront after isha prayer — the energy is unreal. Families, couples, kids, old men on chairs. This is what a real city feels like.', likes: 234, replies: 43 },
  { userIdx: 6, content: 'The Avenues Phase 5 is genuinely so large I got lost for 20 minutes. Had to use Google Maps. Inside a mall. Kuwait things.', likes: 445, replies: 87 },
  { userIdx: 4, content: 'الكشته بالصحراء في الشتاء أحسن تجربة ممكنة بالكويت. ناري وخيمة ونجوم وسكوت ولحم مشوي. ما يحتاج أكثر من كذا', likes: 312, replies: 67 },
  { userIdx: 7, content: 'Went to Marina Crescent at sunset. Forgot my problems for exactly 45 minutes. Strongly recommend as a free therapy session.', likes: 289, replies: 34 },
  { userIdx: 8, content: 'البدع والشويخ أحسن منطقتين بالكويت للمحلات والجلسات. الأفنيوز تزورها بس ما تعيش فيها. هذا رأيي وأنا واثق منه', likes: 178, replies: 98 },
  { userIdx: 10, content: '360 Mall on a Wednesday afternoon is genuinely the move. Parking is free, crowd is manageable, vibes are right. Underrated timing.', likes: 167, replies: 45 },

  // Coffee & Cafes
  { userIdx: 3, content: '% Arabica بالأفنيوز. ما أفهم كيف كوب قهوة يساوي ٣ دنانير بس والله هي زينة، ما أقدر أكذب على نفسي ☕', likes: 234, replies: 78 },
  { userIdx: 11, content: 'Karak chai from a random Pakistani spot at 3am hits differently than any specialty coffee I\'ve ever had. Not apologizing for this take.', likes: 389, replies: 56 },
  { userIdx: 3, content: 'The specialty coffee scene in Kuwait exploded in the last 3 years. We went from Nescafé Gold to single origin light roast real fast. The people are ready.', likes: 198, replies: 43 },
  { userIdx: 11, content: 'مطلع الساعة ٢ صباح ولازم قهوة كرك من عند الباكستاني. هذا الروتين ما يتبدل مهما صار. هو الثابت الوحيد في حياتي', likes: 345, replies: 67 },

  // Nostalgia & Identity
  { userIdx: 5, content: 'Kuwait in the early 2000s had a completely different soul. Sharq Mall, video game shops in Salmiya, weekend drives with the family. Miss it.', likes: 534, replies: 123 },
  { userIdx: 9, content: 'لما كنا صغار نطلع للبحر مع العيلة كل جمعة الصبح. الآن كل واحد بموبايله. شي تغير وما نقدر نرجعه', likes: 467, replies: 89 },
  { userIdx: 10, content: 'Unpopular opinion: Kuwait\'s sunsets over the Gulf are genuinely top 5 in the world. The orange and purple sky here is something else.', likes: 412, replies: 54 },
  { userIdx: 7, content: 'يوم التحرير ٢٦ فبراير يمر وأنا دايم أتوقف لحظة. ناس ضحوا بكل شي عشان أعيش بأمان. ما ننسى ولا نقدر ننسى 🇰🇼', likes: 678, replies: 87 },
  { userIdx: 0, content: 'National Day feeling never gets old. Blue and red everywhere, car convoys honking, everyone out in the streets. Kuwait does celebration right.', likes: 589, replies: 76 },
  { userIdx: 9, content: 'الكويت بلد ما تشبه أي بلد ثاني في الدنيا. هذا مو مدح فقط، هذي حقيقة يعيشها كل من جاء وعاش هنا', likes: 445, replies: 67 },
];

// ── Circles (Hachi) ───────────────────────────────────────────────────────────
const CIRCLES = [
  { topic: 'أحسن مچبوس بالكويت — أرشحوا مطاعمكم', category: 'food', tag: 'مچبوس' },
  { topic: 'Best coffee spots in Salmiya right now?', category: 'coffee', tag: 'coffee' },
  { topic: 'الدائري الخامس الحين — أحد يعرف السبب؟', category: 'general', tag: 'مرور' },
  { topic: 'Kuwait vs Iraq match reactions 🔥', category: 'general', tag: 'كويت' },
  { topic: 'الكشته الشتاء — وين تنصحون؟', category: 'general', tag: 'كشته' },
  { topic: 'New restaurants worth trying this month', category: 'food', tag: 'food' },
];

// ── Seed function ─────────────────────────────────────────────────────────────
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create users
    const createdUsers = [];
    for (const u of USERS) {
      let user = await User.findOne({ username: u.username });
      if (!user) {
        user = await User.create({
          username: u.username,
          phone: `+96550${Math.floor(10000 + Math.random() * 89999)}`,
          name: u.name,
          bio: u.bio,
          isVerified: Math.random() > 0.7,
          verifiedBadge: Math.random() > 0.8 ? 'media' : 'none',
          activityPoints: Math.floor(20 + Math.random() * 200),
        });
        console.log(`👤 Created user: ${u.username}`);
      }
      createdUsers.push(user);
    }

    // Create posts
    let postCount = 0;
    for (const p of POSTS) {
      const user = createdUsers[p.userIdx];
      const hoursAgo = Math.floor(Math.random() * 72);
      const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      // Build fake likes array from other users
      const likerCount = Math.min(p.likes, createdUsers.length);
      const likedBy = createdUsers
        .filter((_, i) => i !== p.userIdx)
        .slice(0, likerCount)
        .map(u => u._id);

      await Post.create({
        userId: user._id,
        content: p.content,
        type: 'text',
        likes: likedBy,
        likesCount: p.likes,
        commentsCount: p.replies,
        trendingScore: p.likes * 2 + p.replies * 3,
        createdAt,
        updatedAt: createdAt,
      });
      postCount++;
    }
    console.log(`📝 Created ${postCount} posts`);

    // Create circles
    let circleCount = 0;
    for (const c of CIRCLES) {
      const creator = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const memberCount = Math.floor(3 + Math.random() * 8);
      const members = createdUsers
        .filter(u => u._id.toString() !== creator._id.toString())
        .slice(0, memberCount)
        .map(u => u._id);

      await Hachi.create({
        creator: creator._id,
        title: c.topic,
        category: c.category,
        members: [creator._id, ...members],
        memberCount: memberCount + 1,
        isActive: true,
        isPublic: true,
        reactions: {
          fire: Math.floor(Math.random() * 20),
          eyes: Math.floor(Math.random() * 15),
          skull: Math.floor(Math.random() * 8),
        },
        messages: [],
      });
      circleCount++;
    }
    console.log(`🔵 Created ${circleCount} circles`);

    console.log('\n✨ Kuwaa seed complete!');
    console.log(`   ${createdUsers.length} users | ${postCount} posts | ${circleCount} circles`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
