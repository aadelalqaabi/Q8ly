import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrutNav, BrutHero, BrutRule, BG, TEXT, MUTED, isAr as ar_, ls, shout } from '../../components/Brut';

// ── Content ──────────────────────────────────────────────────────────────────

const TERMS_EN = {
  title: 'Terms of Service',
  updated: 'Last updated: March 2025',
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body: `By accessing or using KUWAI ("the App", "the Platform", "we", "us", or "our"), you agree to be bound by these Terms of Service and all applicable laws and regulations of the State of Kuwait. If you do not agree with any part of these terms, you must not use the App.`,
    },
    {
      heading: '2. Eligibility',
      body: `You must be at least 18 years old, or the age of majority in your jurisdiction, to use KUWAI. By using the App, you represent and warrant that you meet this requirement and that your use of the App does not violate any applicable laws.`,
    },
    {
      heading: '3. User Accounts',
      body: `You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and truthful information when registering. We reserve the right to suspend or terminate any account at our sole discretion, without prior notice, if we believe you have violated these Terms.`,
    },
    {
      heading: '4. User-Generated Content',
      body: `You are solely and entirely responsible for all content you post, share, transmit, or otherwise make available through KUWAI ("User Content"). By submitting User Content, you grant KUWAI a non-exclusive, worldwide, royalty-free license to use, display, and distribute that content within the App.\n\nYou represent and warrant that:\n• You own or have the necessary rights to post your content\n• Your content does not violate the rights of any third party\n• Your content complies with all applicable laws\n\nWe do not endorse, verify, or take responsibility for any User Content. You acknowledge that you — not KUWAI — are fully responsible for your content and any consequences arising from it.`,
    },
    {
      heading: '5. Prohibited Conduct',
      body: `You agree not to use KUWAI to:\n• Post content that is unlawful, defamatory, harassing, threatening, obscene, or otherwise objectionable under Kuwaiti law or international standards\n• Publish, share, or distribute content that violates the dignity of the State of Kuwait, its leadership, or national symbols\n• Incite sectarian, religious, or ethnic hatred or discrimination\n• Spread false news, misinformation, or content that may cause public disorder\n• Impersonate any person or entity, or misrepresent your identity or affiliation\n• Post sexually explicit, violent, or gratuitously offensive content\n• Infringe any intellectual property rights\n• Engage in any form of fraud, phishing, or malicious activity\n• Circumvent any security features or access controls of the App\n• Use the App for any commercial solicitation without prior written consent`,
    },
    {
      heading: '6. Compliance with Kuwaiti Law',
      body: `KUWAI operates in compliance with the laws of the State of Kuwait, including but not limited to:\n• Law No. 63 of 2015 regarding Combating Information Technology Crimes\n• Press and Publications Law\n• Telecommunications Law\n• Any applicable regulations issued by the Communications and Information Technology Regulatory Authority (CITRA)\n\nAll users — regardless of their location — must ensure that their use of KUWAI complies with Kuwaiti law. Content that violates Kuwaiti law will be removed, and the relevant account may be suspended or reported to the appropriate authorities. KUWAI will cooperate fully with any lawful government request or judicial order.`,
    },
    {
      heading: '7. Content Moderation',
      body: `We reserve the right, but are not obligated, to monitor, review, edit, or remove any User Content that we determine, in our sole discretion, violates these Terms or applicable law. We may take action on any content or account at any time without prior notice. Removal of content or suspension of an account does not constitute an admission of liability on our part.`,
    },
    {
      heading: '8. Privacy & Data',
      body: `Your use of KUWAI is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the App, you consent to the collection and use of your information as described in the Privacy Policy.\n\nWe collect only the data necessary to provide and improve the service, including your phone number, profile information, and usage data. We do not sell your personal data to third parties. Data is stored securely and in accordance with applicable data protection regulations.`,
    },
    {
      heading: '9. Intellectual Property',
      body: `All trademarks, logos, trade names, and the overall look and feel of KUWAI are the exclusive property of KUWAI and its licensors. Nothing in these Terms grants you any right to use any of our intellectual property without our prior written consent. User Content remains the intellectual property of the respective user, subject to the license granted in Section 4.`,
    },
    {
      heading: '10. Disclaimers & Limitation of Liability',
      body: `KUWAI is provided "as is" and "as available" without any warranties, express or implied. We do not warrant that the App will be uninterrupted, error-free, or free of viruses.\n\nTo the fullest extent permitted by law, KUWAI and its founders, employees, and affiliates shall not be liable for:\n• Any indirect, incidental, special, consequential, or punitive damages\n• Any harm arising from User Content posted by third parties\n• Any loss of data, profits, or goodwill\n• Any harm resulting from unauthorised access to your account\n\nYou use the App at your own risk.`,
    },
    {
      heading: '11. Indemnification',
      body: `You agree to indemnify, defend, and hold harmless KUWAI, its founders, operators, employees, and affiliates from and against any claims, liabilities, damages, losses, and expenses — including legal fees — arising out of or in connection with:\n• Your use of the App\n• Your User Content\n• Your violation of these Terms\n• Your violation of any applicable law or the rights of any third party`,
    },
    {
      heading: '12. Third-Party Services',
      body: `KUWAI may contain links to or integrations with third-party services (e.g., Cloudinary for media storage, Twilio for OTP). We are not responsible for the privacy practices or content of those third-party services. Your interactions with them are governed by their own terms and privacy policies.`,
    },
    {
      heading: '13. Termination',
      body: `We may suspend or terminate your access to KUWAI at any time, with or without cause, with or without notice, effective immediately. Upon termination, your right to use the App ceases. All provisions of these Terms that by their nature should survive termination shall survive.`,
    },
    {
      heading: '14. Changes to Terms',
      body: `We reserve the right to modify these Terms at any time. We will notify you of material changes via a notice in the App. Your continued use of KUWAI after any change constitutes your acceptance of the new Terms.`,
    },
    {
      heading: '15. Governing Law',
      body: `These Terms shall be governed by and construed in accordance with the laws of the State of Kuwait. Any dispute arising from or relating to these Terms or your use of KUWAI shall be subject to the exclusive jurisdiction of the courts of the State of Kuwait.`,
    },
    {
      heading: '16. Contact',
      body: `If you have any questions about these Terms, please contact us through the "Suggest a Feature" section in the App's Settings screen.`,
    },
  ],
};

const TERMS_AR = {
  title: 'شروط الخدمة',
  updated: 'آخر تحديث: مارس 2025',
  sections: [
    {
      heading: '١. قبول الشروط',
      body: `باستخدامك لتطبيق KUWAI ("التطبيق"، "المنصة"، "نحن"، "لنا")، فأنت توافق على الالتزام بشروط الخدمة هذه وبجميع القوانين واللوائح المعمول بها في دولة الكويت. إذا كنت لا توافق على أي جزء من هذه الشروط، فيجب عليك التوقف عن استخدام التطبيق فوراً.`,
    },
    {
      heading: '٢. أهلية الاستخدام',
      body: `يجب أن يكون عمرك 18 عاماً على الأقل، أو بلوغ سن الرشد المعمول به في اختصاصك القضائي، لاستخدام KUWAI. باستخدامك للتطبيق، فأنت تقر وتضمن استيفاءك لهذا الشرط وأن استخدامك لا يخالف أي قانون نافذ.`,
    },
    {
      heading: '٣. حسابات المستخدمين',
      body: `أنت المسؤول الكامل عن الحفاظ على سرية بيانات حسابك وعن جميع الأنشطة التي تجري باستخدام حسابك. توافق على تقديم معلومات دقيقة وصادقة عند التسجيل. نحتفظ بالحق في تعليق أو إنهاء أي حساب وفق تقديرنا المنفرد، دون إشعار مسبق، إذا اعتقدنا بوجود انتهاك لهذه الشروط.`,
    },
    {
      heading: '٤. المحتوى الذي ينشره المستخدمون',
      body: `أنت المسؤول الوحيد والكامل عن جميع المحتويات التي تنشرها أو تشاركها أو ترسلها عبر KUWAI ("محتوى المستخدم"). بتقديمك محتوى المستخدم، فأنت تمنح KUWAI ترخيصاً غير حصري وعالمي وخالياً من الإتاوات لاستخدام هذا المحتوى وعرضه وتوزيعه داخل التطبيق.\n\nأنت تقر وتضمن بما يلي:\n• أنك تملك المحتوى أو تمتلك الحقوق اللازمة لنشره\n• أن المحتوى لا ينتهك حقوق أي طرف ثالث\n• أن المحتوى يمتثل لجميع القوانين النافذة\n\nنحن لا نؤيد أي محتوى للمستخدمين ولا نتحقق منه ولا نتحمل أي مسؤولية عنه. أنت — لا KUWAI — مسؤول مسؤولية كاملة عن محتواك وعن أي تبعات تنجم عنه.`,
    },
    {
      heading: '٥. السلوكيات المحظورة',
      body: `توافق على عدم استخدام KUWAI من أجل:\n• نشر أي محتوى مخالف للقانون أو تشهيري أو مضايق أو مهدِّد أو فاضح أو مسيء بموجب القانون الكويتي أو المعايير الدولية\n• نشر أي محتوى يمس كرامة دولة الكويت أو قيادتها أو رموزها الوطنية\n• التحريض على الكراهية الطائفية أو الدينية أو العرقية أو التمييز بأي شكل\n• نشر أخبار كاذبة أو معلومات مضللة أو محتوى قد يثير البلبلة العامة\n• انتحال شخصية أي فرد أو جهة، أو تقديم معلومات زائفة عن هويتك أو انتمائك\n• نشر محتوى جنسي صريح أو عنيف أو مسيء بصورة مبالغ فيها\n• انتهاك أي حقوق ملكية فكرية\n• ممارسة أي شكل من أشكال الاحتيال أو الاصطياد الإلكتروني أو الأنشطة الضارة\n• تجاوز أي ميزات أمنية أو ضوابط وصول في التطبيق\n• استخدام التطبيق لأي ترويج تجاري دون الحصول على موافقة خطية مسبقة`,
    },
    {
      heading: '٦. الامتثال للقوانين الكويتية',
      body: `يعمل KUWAI وفقاً لقوانين دولة الكويت، بما فيها على سبيل المثال لا الحصر:\n• القانون رقم 63 لسنة 2015 في شأن مكافحة جرائم تقنية المعلومات\n• قانون المطبوعات والنشر\n• قانون الاتصالات\n• أي لوائح تصدرها الهيئة التنظيمية لقطاع الاتصالات والمعلومات (CITRA)\n\nيجب على جميع المستخدمين — بصرف النظر عن موقعهم — التأكد من أن استخدامهم لـ KUWAI يمتثل للقانون الكويتي. سيُزال المحتوى المخالف للقانون الكويتي وقد يُعلَّق الحساب المعني أو يُبلَّغ عنه للجهات المختصة. سيتعاون KUWAI تعاوناً كاملاً مع أي طلب حكومي مشروع أو أمر قضائي.`,
    },
    {
      heading: '٧. إشراف المحتوى',
      body: `نحتفظ بالحق — دون أن نكون ملزمين بذلك — في مراقبة أي محتوى للمستخدمين أو مراجعته أو تعديله أو إزالته، إذا رأينا وفق تقديرنا المنفرد أنه يخالف هذه الشروط أو القانون النافذ. يحق لنا اتخاذ إجراءات بشأن أي محتوى أو حساب في أي وقت دون إشعار مسبق. لا تعني إزالة المحتوى أو تعليق الحساب اعترافنا بأي مسؤولية من جانبنا.`,
    },
    {
      heading: '٨. الخصوصية والبيانات',
      body: `يخضع استخدامك لـ KUWAI أيضاً لسياسة الخصوصية الخاصة بنا، المدمجة في هذه الشروط بالإحالة. باستخدامك للتطبيق، فأنت توافق على جمع معلوماتك واستخدامها وفقاً لسياسة الخصوصية.\n\nنجمع فقط البيانات الضرورية لتقديم الخدمة وتطويرها، بما في ذلك رقم هاتفك ومعلومات ملفك الشخصي وبيانات الاستخدام. لا نبيع بياناتك الشخصية لأطراف ثالثة. تُخزَّن البيانات بأمان ووفقاً للأنظمة المعمول بها في مجال حماية البيانات.`,
    },
    {
      heading: '٩. الملكية الفكرية',
      body: `جميع العلامات التجارية والشعارات والأسماء التجارية والمظهر العام لـ KUWAI هي ملك حصري لـ KUWAI والمرخِّصين له. لا يمنحك أي نص في هذه الشروط أي حق لاستخدام أي من ملكيتنا الفكرية دون موافقتنا الخطية المسبقة. يظل محتوى المستخدم ملكية فكرية للمستخدم المعني، مع مراعاة الترخيص الممنوح في البند الرابع.`,
    },
    {
      heading: '١٠. إخلاء المسؤولية والحد من المسؤولية',
      body: `يُقدَّم KUWAI "كما هو" و"حسب الإتاحة" دون أي ضمانات صريحة أو ضمنية. لا نضمن أن التطبيق سيكون متواصلاً أو خالياً من الأخطاء أو الفيروسات.\n\nبالقدر الأقصى المسموح به قانوناً، لن يكون KUWAI ومؤسسوه وموظفوه وشركاؤه مسؤولين عن:\n• أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو عقابية\n• أي ضرر ناجم عن محتوى نشره مستخدمون آخرون\n• أي خسارة في البيانات أو الأرباح أو السمعة\n• أي ضرر ناتج عن وصول غير مصرح به إلى حسابك\n\nأنت تستخدم التطبيق على مسؤوليتك الخاصة.`,
    },
    {
      heading: '١١. التعويض',
      body: `توافق على تعويض KUWAI ومؤسسيه ومشغليه وموظفيه وشركائه والدفاع عنهم وإبراء ذمتهم من أي مطالبات أو التزامات أو أضرار أو خسائر ونفقات — بما فيها أتعاب المحاماة — الناشئة عن أو المتعلقة بما يلي:\n• استخدامك للتطبيق\n• محتواك المنشور\n• انتهاكك لهذه الشروط\n• انتهاكك لأي قانون نافذ أو حقوق أي طرف ثالث`,
    },
    {
      heading: '١٢. الخدمات الخارجية',
      body: `قد يتضمن KUWAI روابط أو تكاملات مع خدمات طرف ثالث (مثل Cloudinary لتخزين الوسائط، وTwilio لرمز التحقق). لسنا مسؤولين عن ممارسات الخصوصية أو محتوى تلك الخدمات. تخضع تعاملاتك معها لشروطها وسياسات خصوصيتها الخاصة.`,
    },
    {
      heading: '١٣. الإنهاء',
      body: `يجوز لنا تعليق وصولك إلى KUWAI أو إنهاؤه في أي وقت، بسبب أو بدون سبب، مع إشعار أو بدونه، بأثر فوري. عند الإنهاء، يتوقف حقك في استخدام التطبيق. تبقى جميع أحكام هذه الشروط التي يقتضي طبيعتها الاستمرار سارية المفعول بعد الإنهاء.`,
    },
    {
      heading: '١٤. التعديلات على الشروط',
      body: `نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنخطرك بالتغييرات الجوهرية عبر إشعار داخل التطبيق. استمرارك في استخدام KUWAI بعد أي تعديل يُعدّ قبولاً منك للشروط الجديدة.`,
    },
    {
      heading: '١٥. القانون الحاكم',
      body: `تخضع هذه الشروط وتُفسَّر وفقاً لقوانين دولة الكويت. يخضع أي نزاع ينشأ عن هذه الشروط أو يتعلق باستخدامك لـ KUWAI للاختصاص القضائي الحصري لمحاكم دولة الكويت.`,
    },
    {
      heading: '١٦. التواصل معنا',
      body: `إذا كان لديك أي استفسار حول هذه الشروط، يرجى التواصل معنا عبر قسم "اقترح ميزة" في شاشة الإعدادات بالتطبيق.`,
    },
  ],
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TermsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const ar = ar_(i18n);
  const content = ar ? TERMS_AR : TERMS_EN;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <BrutNav onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
      >
        <BrutHero title={content.title} label={shout(content.updated, ar)} size={42} />
        <BrutRule mt={24} mb={28} />

        {content.sections.map((sec, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={[styles.sectionHeading, { textAlign: ar ? 'right' : 'left' }]}>
              {sec.heading}
            </Text>
            <Text style={[styles.sectionBody, { textAlign: ar ? 'right' : 'left' }]}>
              {sec.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 8 },
  section: { marginBottom: 28 },
  sectionHeading: { fontSize: 15, fontWeight: '900', color: TEXT, marginBottom: 8, lineHeight: 22 },
  sectionBody: { fontSize: 14, color: MUTED, lineHeight: 22, fontWeight: '500' },
});
