/**
 * Seed 50 founder dummy accounts
 * Phones: +96500000001 → +96500000050
 * OTP:    123456 (always, no SMS sent)
 *
 * Run: node scripts/seedDummyAccounts.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const DISTRICTS = ['Al Asimah', 'Hawalli', 'Farwaniyah', 'Ahmadi', 'Jahra', 'Mubarak Al-Kabeer'];

const DUMMY_USERS = [
  { username: 'test_ahmed_q8',      name: 'أحمد الكويتي',      bio: 'كويتي أصيل',                district: 'Al Asimah' },
  { username: 'test_sara_kw',       name: 'سارة المطيري',       bio: 'طالبة جامعية',               district: 'Hawalli' },
  { username: 'test_fahad_kwt',     name: 'فهد العجمي',         bio: 'مهندس | تقنية',              district: 'Al Asimah' },
  { username: 'test_noura_q8',      name: 'نورة الرشيدي',       bio: 'معلمة ومدونة',               district: 'Farwaniyah' },
  { username: 'test_khalid_kw',     name: 'خالد العنزي',        bio: 'رياضة وصحة',                 district: 'Ahmadi' },
  { username: 'test_lulwa_q8',      name: 'لولوة الصباح',       bio: 'فن وتصميم',                  district: 'Al Asimah' },
  { username: 'test_jaber_kw',      name: 'جابر المطيري',       bio: 'محامي | حقوق',               district: 'Jahra' },
  { username: 'test_reem_kwt',      name: 'ريم الكندري',        bio: 'مصورة فوتوغرافية',           district: 'Hawalli' },
  { username: 'test_omar_q8',       name: 'عمر الشمري',         bio: 'طباخ هاوي',                  district: 'Mubarak Al-Kabeer' },
  { username: 'test_dalal_kw',      name: 'دلال الفضلي',        bio: 'موضة وستايل',                district: 'Al Asimah' },
  { username: 'test_meshaal_q8',    name: 'مشعل العتيبي',       bio: 'رجل أعمال',                  district: 'Ahmadi' },
  { username: 'test_afra_kw',       name: 'عفراء الصباح',       bio: 'سفر وترحال',                 district: 'Hawalli' },
  { username: 'test_bader_q8',      name: 'بدر الحربي',         bio: 'موسيقى وفن',                 district: 'Al Asimah' },
  { username: 'test_hessa_kw',      name: 'حصة المطيري',        bio: 'أم وربة بيت',                district: 'Farwaniyah' },
  { username: 'test_waleed_q8',     name: 'وليد الرشيدي',       bio: 'تقنية ومبرمج',               district: 'Al Asimah' },
  { username: 'test_sheikha_kw',    name: 'شيخة العجمي',        bio: 'طبيبة أسنان',                district: 'Hawalli' },
  { username: 'test_faisal_q8',     name: 'فيصل الزيد',         bio: 'استثمار وأسهم',              district: 'Al Asimah' },
  { username: 'test_mona_kwt',      name: 'منى الخالد',         bio: 'مديرة تسويق',                district: 'Ahmadi' },
  { username: 'test_salman_q8',     name: 'سلمان العازمي',      bio: 'لاعب كرة قدم',               district: 'Jahra' },
  { username: 'test_ghaida_kw',     name: 'غيداء الصباح',       bio: 'ديكور وتصميم داخلي',         district: 'Al Asimah' },
  { username: 'test_nasser_q8',     name: 'ناصر البدر',         bio: 'صيد وطبيعة',                 district: 'Ahmadi' },
  { username: 'test_fatima_kw',     name: 'فاطمة الهاجري',      bio: 'خريجة هندسة',                district: 'Mubarak Al-Kabeer' },
  { username: 'test_yousef_q8',     name: 'يوسف الحمدان',       bio: 'مخرج أفلام قصيرة',           district: 'Hawalli' },
  { username: 'test_rana_kwt',      name: 'رنا الفضلي',         bio: 'كتابة إبداعية',              district: 'Al Asimah' },
  { username: 'test_abdulla_q8',    name: 'عبدالله الدوسري',    bio: 'رياضيات ومنطق',              district: 'Farwaniyah' },
  { username: 'test_wafa_kw',       name: 'وفاء الحربي',        bio: 'مديرة مدرسة',                district: 'Al Asimah' },
  { username: 'test_turki_q8',      name: 'تركي الشمري',        bio: 'مطاعم وكافيهات',             district: 'Hawalli' },
  { username: 'test_ameera_kw',     name: 'أميرة العنزي',       bio: 'محاسبة وأرقام',              district: 'Ahmadi' },
  { username: 'test_hamad_q8',      name: 'حمد المري',          bio: 'سيارات كلاسيكية',            district: 'Al Asimah' },
  { username: 'test_mariam_kw',     name: 'مريم الصباح',        bio: 'علم نفس وإرشاد',             district: 'Jahra' },
  { username: 'test_nawaf_q8',      name: 'نواف الرشيد',        bio: 'لاعب جيمر محترف',            district: 'Al Asimah' },
  { username: 'test_abeer_kw',      name: 'عبير الخالد',        bio: 'شعر وأدب',                   district: 'Hawalli' },
  { username: 'test_majed_q8',      name: 'ماجد الحمدان',       bio: 'مصمم جرافيك',                district: 'Farwaniyah' },
  { username: 'test_aseel_kw',      name: 'أصيل الفضلي',        bio: 'مدرّبة لياقة',               district: 'Al Asimah' },
  { username: 'test_rashid_q8',     name: 'راشد العازمي',       bio: 'مزارع عضوي',                 district: 'Ahmadi' },
  { username: 'test_ghada_kw',      name: 'غادة الصباح',        bio: 'إعلامية وصحفية',             district: 'Al Asimah' },
  { username: 'test_salem_q8',      name: 'سالم البدر',         bio: 'بحار وغواص',                 district: 'Mubarak Al-Kabeer' },
  { username: 'test_hind_kw',       name: 'هند الرشيدي',        bio: 'طفولة وتربية',               district: 'Hawalli' },
  { username: 'test_essa_q8',       name: 'عيسى العتيبي',       bio: 'تطوير عقارات',               district: 'Al Asimah' },
  { username: 'test_latifa_kw',     name: 'لطيفة الكندري',      bio: 'طاهية ومدونة',               district: 'Farwaniyah' },
  { username: 'test_mishari_q8',    name: 'مشاري الزيد',        bio: 'موظف بنك',                   district: 'Al Asimah' },
  { username: 'test_nada_kw',       name: 'ندى الحربي',         bio: 'باحثة علمية',                district: 'Ahmadi' },
  { username: 'test_sultan_q8',     name: 'سلطان المطيري',      bio: 'مصارع وبطل رياضي',           district: 'Jahra' },
  { username: 'test_ruba_kw',       name: 'ربى الشمري',         bio: 'نباتية ومتحررة',             district: 'Al Asimah' },
  { username: 'test_emad_q8',       name: 'عماد الصباح',        bio: 'دكتور طوارئ',                district: 'Hawalli' },
  { username: 'test_suha_kw',       name: 'سها العنزي',         bio: 'حقوق المرأة',                district: 'Al Asimah' },
  { username: 'test_bandar_q8',     name: 'بندر الفضلي',        bio: 'هواية الاختراع',             district: 'Farwaniyah' },
  { username: 'test_nour_kw',       name: 'نور الهاجري',        bio: 'تعليم ومناهج',               district: 'Al Asimah' },
  { username: 'test_saad_q8',       name: 'سعد الرشيد',         bio: 'مقاول ومشاريع',              district: 'Ahmadi' },
  { username: 'test_arwa_kw',       name: 'أروى الحمدان',       bio: 'فلسفة وفكر',                 district: 'Al Asimah' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < DUMMY_USERS.length; i++) {
    // Produces +96500000001 through +96500000050
    const p = `+965000000${String(i + 1).padStart(2, '0')}`;
    const data = DUMMY_USERS[i];

    try {
      const exists = await User.findOne({ $or: [{ phone: p }, { username: data.username }] });
      if (exists) { skipped++; continue; }

      await User.create({
        username: data.username,
        name: data.name,
        bio: data.bio,
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
      console.log(`✓ ${p}  @${data.username}  (${data.name})`);
    } catch (err) {
      console.error(`✗ ${p} — ${err.message}`);
    }
  }

  console.log(`\nDone. Created: ${created}  Skipped (already exist): ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
