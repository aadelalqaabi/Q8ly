import Constants from 'expo-constants';

// ── API Config ────────────────────────────────────────────────────────────────
export const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = Constants.expoConfig?.extra?.SOCKET_URL || 'http://localhost:5000';

// ── Kuwait Districts ──────────────────────────────────────────────────────────
export const DISTRICTS = [
  { label: 'Al Asimah', labelAr: 'العاصمة', value: 'Al Asimah' },
  { label: 'Hawalli', labelAr: 'حولي', value: 'Hawalli' },
  { label: 'Farwaniyah', labelAr: 'الفروانية', value: 'Farwaniyah' },
  { label: 'Ahmadi', labelAr: 'الأحمدي', value: 'Ahmadi' },
  { label: 'Jahra', labelAr: 'الجهراء', value: 'Jahra' },
  { label: 'Mubarak Al-Kabeer', labelAr: 'مبارك الكبير', value: 'Mubarak Al-Kabeer' },
];

// ── Topic Categories ──────────────────────────────────────────────────────────
export const TOPIC_CATEGORIES = [
  { key: 'politics', label: 'Politics & Parliament', labelAr: 'السياسة', icon: 'landmark', color: '#C8102E' },
  { key: 'society', label: 'Society & Culture', labelAr: 'المجتمع', icon: 'users', color: '#007A3D' },
  { key: 'traffic', label: 'Traffic & Roads', labelAr: 'المرور', icon: 'car', color: '#FF6B35' },
  { key: 'jobs', label: 'Jobs & Business', labelAr: 'الوظائف', icon: 'briefcase', color: '#2196F3' },
  { key: 'realestate', label: 'Real Estate', labelAr: 'العقارات', icon: 'home', color: '#9C27B0' },
  { key: 'sports', label: 'Sports', labelAr: 'الرياضة', icon: 'trophy', color: '#00BCD4' },
  { key: 'events', label: 'Events', labelAr: 'الفعاليات', icon: 'calendar', color: '#FF9800' },
  { key: 'offers', label: 'Offers & Shopping', labelAr: 'العروض', icon: 'tag', color: '#E91E63' },
  { key: 'technology', label: 'Technology', labelAr: 'التقنية', icon: 'cpu', color: '#607D8B' },
  { key: 'health', label: 'Health', labelAr: 'الصحة', icon: 'heart', color: '#4CAF50' },
  { key: 'entertainment', label: 'Entertainment', labelAr: 'الترفيه', icon: 'music', color: '#FF5722' },
];

// ── Colors (Kuwait flag palette + UI) ────────────────────────────────────────
export const COLORS = {
  primary: '#C8102E',       // Kuwait flag red
  secondary: '#007A3D',     // Kuwait flag green
  accent: '#000000',        // Kuwait flag black
  white: '#FFFFFF',
  background: '#F5F5F5',
  backgroundDark: '#121212',
  surface: '#FFFFFF',
  surfaceDark: '#1E1E1E',
  text: '#1A1A1A',
  textLight: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  borderDark: '#333333',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

// ── Report Reasons ────────────────────────────────────────────────────────────
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment', labelAr: 'مضايقة' },
  { value: 'hate_speech', label: 'Hate Speech', labelAr: 'خطاب كراهية' },
  { value: 'fake_news', label: 'Fake News / Misinformation', labelAr: 'أخبار مزيفة' },
  { value: 'spam', label: 'Spam', labelAr: 'رسائل مزعجة' },
  { value: 'explicit_content', label: 'Explicit Content', labelAr: 'محتوى غير لائق' },
  { value: 'privacy', label: 'Privacy Violation', labelAr: 'انتهاك الخصوصية' },
  { value: 'violence', label: 'Violence', labelAr: 'عنف' },
  { value: 'other', label: 'Other', labelAr: 'أخرى' },
];

// ── Post Types ────────────────────────────────────────────────────────────────
export const POST_TYPES = ['text', 'photo', 'video', 'poll'];

// ── Verified Badge Labels ─────────────────────────────────────────────────────
export const VERIFIED_BADGE_LABELS = {
  government: { label: 'Government / Official', icon: '🏛️', color: '#2196F3' },
  media: { label: 'Media', icon: '📰', color: '#FF9800' },
  influencer: { label: 'Public Figure', icon: '⭐', color: '#9C27B0' },
  business: { label: 'Business', icon: '🏢', color: '#4CAF50' },
  none: null,
};

// ── Pagination ────────────────────────────────────────────────────────────────
export const PAGE_SIZE = 20;
