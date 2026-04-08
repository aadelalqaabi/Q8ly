/**
 * Content Filter — Kuwait Now
 * Two-tier moderation:
 *   BLOCKED  → hard block, return 400 to client
 *   FLAGGED  → allow but auto-flag post for admin review
 */

// Severe terms — post is rejected immediately
const BLOCKED = [
  // Arabic slurs / severe insults
  'كلب', 'كلبه', 'كلبة', 'حمار', 'حمارة', 'خنزير', 'خنزيره', 'خنزيرة',
  'عاهرة', 'عاهره', 'شرموطة', 'شرموطه', 'قحبة', 'قحبه', 'زانية', 'زانيه',
  'ابن الكلب', 'بنت الكلب', 'ابن الحمار', 'منيوك', 'متناك', 'كس', 'طيز',
  'زب', 'نيك', 'انيك', 'أنيك', 'تنتاك', 'لعن امك', 'العن امك', 'يلعن امك',
  'يلعن ابوك', 'ولد الكلب', 'يبن المتناكة',
  // English severe
  'fuck', 'fucker', 'fucking', 'motherfucker', 'cunt', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'fag', 'kike', 'spic', 'chink',
  'rape', 'raping', 'raped',
];

// Moderate terms — post is allowed but flagged for review
const FLAGGED = [
  // Arabic moderate
  'غبي', 'غبية', 'احمق', 'حمق', 'تافه', 'تافهة', 'مجنون', 'مجنونة',
  'خسيس', 'خسيسة', 'وقح', 'وقحة', 'وسخ', 'وسخة', 'نذل', 'نذلة',
  'ابله', 'أبله', 'قبيح', 'قبيحة', 'منافق', 'منافقة', 'حقير', 'حقيرة',
  // English moderate
  'idiot', 'stupid', 'moron', 'dumbass', 'asshole', 'bastard', 'bitch',
  'crap', 'shit', 'damn', 'hell', 'ass', 'piss',
  'loser', 'freak', 'creep', 'perv', 'psycho',
];

/**
 * Normalize text for matching:
 * - lowercase
 * - remove diacritics (tashkeel) from Arabic
 * - collapse whitespace
 */
function normalize(text) {
  return text
    .toLowerCase()
    // Strip Arabic diacritics (harakat)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variants → ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize teh marbuta
    .replace(/ة/g, 'ه')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesWord(text, word) {
  const normalizedText = normalize(text);
  const normalizedWord = normalize(word);
  const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isArabic = /[\u0600-\u06FF]/.test(word);
  if (isArabic) {
    // Word boundary for Arabic: must be surrounded by space, start, or end of string
    const re = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
    return re.test(normalizedText);
  }
  // English: match whole words only
  const re = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
  return re.test(normalizedText);
}

/**
 * Check content for blocked/flagged terms.
 * @param {string} text
 * @returns {{ isBlocked: boolean, isFlagged: boolean, matchedWord: string|null }}
 */
function checkContent(text) {
  if (!text || typeof text !== 'string') {
    return { isBlocked: false, isFlagged: false, matchedWord: null };
  }

  for (const word of BLOCKED) {
    if (matchesWord(text, word)) {
      return { isBlocked: true, isFlagged: false, matchedWord: word };
    }
  }

  for (const word of FLAGGED) {
    if (matchesWord(text, word)) {
      return { isBlocked: false, isFlagged: true, matchedWord: word };
    }
  }

  return { isBlocked: false, isFlagged: false, matchedWord: null };
}

module.exports = { checkContent };
