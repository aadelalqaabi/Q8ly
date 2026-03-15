/**
 * Adds more messages to existing seeded circles for App Store screenshots.
 * Run: node scripts/addCircleMessages.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Hachi = require('../models/Hachi');

const EXTRA_MESSAGES = {
  'وين أحسن غداء اليوم؟ 🍽️': [
    { username: 'demo_rana',    text: 'أنا جربت مطعم اللؤلؤة أمس، الكابسة ما شاء الله 🙌' },
    { username: 'demo_sultan',  text: 'هل في أحد جرب Noodle House الجديد؟ سمعت عنه' },
    { username: 'demo_noura',   text: 'نعم! كنت هناك الأسبوع الماضي، الـ ramen لا يوصف 😍' },
    { username: 'demo_ali99',   text: 'أنا بس أريد برگر، وين أحسن برگر الكويت؟' },
    { username: 'demo_khaled7', text: 'MyBurger ولا كلام! الـ smash burger عندهم خيال' },
    { username: 'demo_layla',   text: 'وأنا أفضل الأكل البيتي يوم الخميس، أمي تطبخ مجبوس سمك 💙' },
    { username: 'demo_rana',    text: 'هههه يا حظك يا لؤلؤة! أنا أبي أجي بيتكم' },
    { username: 'demo_noura',   text: 'شباب ما نسيتوا المندي الأحمدي؟ كل أسبوع ترند' },
    { username: 'demo_sultan',  text: 'صدج، بس الازدحام يقتل الشهية' },
    { username: 'demo_ali99',   text: 'اللي ما جرب مطعم ديرة مو عارف شيء 🔥🔥' },
    { username: 'demo_khaled7', text: 'فكرة: نتجمع نغدى سوا الأسبوع الجاي؟' },
    { username: 'demo_noura',   text: 'فكرة ممتازة! نختار المكان في البكرة' },
  ],

  'احسن قهوة بوسط البلد ☕': [
    { username: 'demo_rana',    text: 'جربتوا Blacksmith؟ الجو هناك أحلى من أي مكان' },
    { username: 'demo_sultan',  text: 'أنا أشتغل من هناك كل صباح، الواي فاي ممتاز والزحمة قليلة الصبح' },
    { username: 'demo_layla',   text: 'بس السعر مو طبيعي، 4 د للكب 😅' },
    { username: 'demo_sultan',  text: 'الجو يساوي، ترى' },
    { username: 'demo_jasem',   text: 'أنا أفضل Cali Press، قهوتهم من أفضل ما جربت بالكويت' },
    { username: 'demo_rana',    text: 'كافيه Boon هم مستواهم عالي وهادي نسبياً' },
    { username: 'demo_layla',   text: 'أحياناً أبي بس مكان هادي أجلس أقرأ بدون موسيقى 📚' },
    { username: 'demo_jasem',   text: 'كتبلكم مكان: مقهى صغير في شرق ما يعرفه أحد تقريباً، الجو رهيب' },
    { username: 'demo_rana',    text: 'أرسل اللوكيشن؟' },
    { username: 'demo_jasem',   text: 'أرسلت في الدايركت ✌️' },
    { username: 'demo_sultan',  text: 'أنا ما وصلني شي 😭' },
    { username: 'demo_jasem',   text: 'هههه يلا أرسلك الحين' },
  ],

  'ليلة المباراة — الكويت 🏆⚽': [
    { username: 'demo_jasem',   text: 'تأكدوا الساعة 9 وايد مهمة' },
    { username: 'demo_khaled7', text: 'أنا آخذ المشروبات، شو تبون؟' },
    { username: 'demo_ali99',   text: 'ريد بول وشيبس يكفي 😂' },
    { username: 'demo_dina',    text: 'أنا أجيب البيتزا، ترتيب؟' },
    { username: 'demo_jasem',   text: 'نعم بالله! بيتزا وريد بول = ليلة مثالية ⚽' },
    { username: 'demo_khaled7', text: 'من يبي الكويت تفوز رفعوا إيدهم 🙋‍♂️' },
    { username: 'demo_ali99',   text: '🙋🙋🙋' },
    { username: 'demo_dina',    text: 'بالروح بالدم 🇰🇼❤️' },
    { username: 'demo_jasem',   text: 'GOOOOL! هلا هلا هلالووو 🔥🔥🔥' },
    { username: 'demo_khaled7', text: '😱😱😱 ما صدقت!!!' },
    { username: 'demo_ali99',   text: 'رائعين ماشاء الله، الدفاع هالمباراة علي مستوى' },
    { username: 'demo_dina',    text: 'أحسن مباراة شفتها من زمان 🏆🏆' },
    { username: 'demo_jasem',   text: 'نعيد الكرّة الأسبوع الجاي؟' },
    { username: 'demo_khaled7', text: 'لازم! دايمي هذا 🙌' },
  ],

  'سيارات — عروض وبيع 🚗': [
    { username: 'demo_sultan',  text: 'كم كيلو على الـ GX؟' },
    { username: 'demo_khaled7', text: '78,000 كيلو، بس الصيانة دايماً عند التوكيل' },
    { username: 'demo_sultan',  text: 'اللون؟' },
    { username: 'demo_khaled7', text: 'بيرل وايت، اللون الأجمل على رأيي' },
    { username: 'demo_ali99',   text: 'هل فيه سبع ركاب؟' },
    { username: 'demo_khaled7', text: 'أيوا ولا كلام، 7 مقاعد فل' },
    { username: 'demo_sultan',  text: 'ممكن موعد للمشاهدة بكرة؟' },
    { username: 'demo_khaled7', text: 'تفضل، قولي الوقت المناسب' },
    { username: 'demo_jasem',   text: 'شباب عندي كمان Prado 2022 للبيع إذا أحد يبي' },
    { username: 'demo_ali99',   text: 'كم سعره؟' },
    { username: 'demo_jasem',   text: '17,800 KD، فل كامل TXL' },
    { username: 'demo_sultan',  text: 'ما شاء الله، بس غالي شوي' },
    { username: 'demo_jasem',   text: 'السعر قابل للنقاش للجاد 😄' },
    { username: 'demo_khaled7', text: 'يلا شباب من يشتري يصير له' },
  ],
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Build username → _id map
  const usernames = [...new Set(Object.values(EXTRA_MESSAGES).flat().map(m => m.username))];
  const users = await User.find({ username: { $in: usernames } }).select('_id username');
  const userMap = {};
  users.forEach(u => { userMap[u.username] = u._id; });

  for (const [title, msgs] of Object.entries(EXTRA_MESSAGES)) {
    const room = await Hachi.findOne({ title });
    if (!room) { console.log(`  ⚠️  Circle not found: "${title}"`); continue; }

    const newMessages = msgs
      .filter(m => userMap[m.username])
      .map((m, i) => ({
        user: userMap[m.username],
        text: m.text,
        reactions: [],
        createdAt: new Date(Date.now() - (msgs.length - i) * 90_000), // 90s apart
      }));

    room.messages.push(...newMessages);
    room.summary = {
      messageCount: room.messages.length,
      participantCount: room.members.length,
      excerpt: (room.messages[0]?.text || '').slice(0, 120),
    };
    await room.save();
    console.log(`  ✅ Added ${newMessages.length} messages to "${title}" (total: ${room.messages.length})`);
  }

  console.log('\nDone!');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
