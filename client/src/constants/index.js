import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001/api';
export const SOCKET_URL = Constants.expoConfig?.extra?.SOCKET_URL || 'http://localhost:5001';

export const DISTRICTS = [
  { label: 'Al Asimah', labelAr: 'العاصمة', value: 'Al Asimah' },
  { label: 'Hawalli', labelAr: 'حولي', value: 'Hawalli' },
  { label: 'Farwaniyah', labelAr: 'الفروانية', value: 'Farwaniyah' },
  { label: 'Ahmadi', labelAr: 'الأحمدي', value: 'Ahmadi' },
  { label: 'Jahra', labelAr: 'الجهراء', value: 'Jahra' },
  { label: 'Mubarak Al-Kabeer', labelAr: 'مبارك الكبير', value: 'Mubarak Al-Kabeer' },
];

export const TOPIC_CATEGORIES = [
  { key: 'politics',      label: 'Politics',      labelAr: 'السياسة',   icon: 'business',        color: '#C8102E' },
  { key: 'society',       label: 'Society',        labelAr: 'المجتمع',   icon: 'people',          color: '#007A3D' },
  { key: 'traffic',       label: 'Traffic',        labelAr: 'المرور',    icon: 'car',             color: '#FF6B35' },
  { key: 'jobs',          label: 'Jobs',           labelAr: 'الوظائف',   icon: 'briefcase',       color: '#2563EB' },
  { key: 'realestate',    label: 'Real Estate',    labelAr: 'العقارات',  icon: 'home',            color: '#7C3AED' },
  { key: 'sports',        label: 'Sports',         labelAr: 'الرياضة',   icon: 'trophy',          color: '#0891B2' },
  { key: 'events',        label: 'Events',         labelAr: 'الفعاليات', icon: 'calendar',        color: '#D97706' },
  { key: 'offers',        label: 'Offers',         labelAr: 'العروض',    icon: 'pricetag',        color: '#DB2777' },
  { key: 'technology',    label: 'Tech',           labelAr: 'التقنية',   icon: 'hardware-chip',   color: '#475569' },
  { key: 'health',        label: 'Health',         labelAr: 'الصحة',     icon: 'medkit',          color: '#059669' },
  { key: 'entertainment', label: 'Entertainment',  labelAr: 'الترفيه',   icon: 'musical-notes',   color: '#EA580C' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — minimal Apple-style (light + dark)
// ─────────────────────────────────────────────────────────────────────────────
export const LIGHT_COLORS = {
  accent:  '#0033A0',
  primary: '#0033A0',
  background:      '#FAF8F5',
  surface:         '#FFFFFF',
  white:           '#FFFFFF',
  card:            '#FFFFFF',
  sheet:           '#F0EDE8',
  text:            '#1A1A1A',
  textSub:         '#8A857E',
  textMuted:       '#8A857E',
  textPlaceholder: '#B8B2AA',
  separator:       '#E8E4DE',
  fill:            '#F0EDE8',
  overlay:         'rgba(0,0,0,0.35)',
  success:         '#34C759',
  error:           '#FF3B30',
  secondary:       '#007A3D',
  black:               '#1A1A1A',
  border:              '#E8E4DE',
  textSecondary:       '#8A857E',
  textLight:           '#8A857E',
  fillSecondary:       '#F0EDE8',
  backgroundSecondary: '#F0EDE8',
  surfaceSecondary:    '#F0EDE8',
  backgroundDark:      '#1A1A1A',
  surfaceDark:         '#2A2824',
  borderDark:          '#3A3630',
};

export const DARK_COLORS = {
  accent:  '#4D80FF',
  primary: '#4D80FF',
  background:      '#0D0D0D',
  surface:         '#1C1A18',
  white:           '#0D0D0D',
  card:            '#1C1A18',
  sheet:           '#242220',
  text:            '#F0EDE8',
  textSub:         '#9E9890',
  textMuted:       '#9E9890',
  textPlaceholder: '#6E6860',
  separator:       '#2E2B27',
  fill:            '#2A2824',
  overlay:         'rgba(0,0,0,0.65)',
  success:         '#30D158',
  error:           '#FF453A',
  secondary:       '#30D158',
  black:               '#F0EDE8',
  border:              '#2E2B27',
  textSecondary:       '#9E9890',
  textLight:           '#9E9890',
  fillSecondary:       '#3A3630',
  backgroundSecondary: '#1C1A18',
  surfaceSecondary:    '#2A2824',
  backgroundDark:      '#0D0D0D',
  surfaceDark:         '#1C1A18',
  borderDark:          '#2E2B27',
};

// Static fallback for module-level StyleSheet.create calls
export const COLORS = LIGHT_COLORS;

export const SHADOWS = {
  card:  { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,  elevation: 2 },
  heavy: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 6 },
  sm:    { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,  elevation: 2 },
  md:    { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,  elevation: 2 },
  lg:    { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 6 },
};

export const FONTS = {
  largeTitle: { fontSize: 34, fontWeight: '800' },
  title1:     { fontSize: 28, fontWeight: '700' },
  title2:     { fontSize: 22, fontWeight: '700' },
  title3:     { fontSize: 20, fontWeight: '600' },
  headline:   { fontSize: 17, fontWeight: '600' },
  body:       { fontSize: 15, fontWeight: '400' },
  callout:    { fontSize: 16, fontWeight: '400' },
  subhead:    { fontSize: 14, fontWeight: '400' },
  footnote:   { fontSize: 13, fontWeight: '400' },
  caption1:   { fontSize: 12, fontWeight: '400' },
  caption2:   { fontSize: 11, fontWeight: '400' },
};

export const SPACING = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 };
export const RADIUS  = { sm: 8, md: 12, lg: 16, xl: 20, pill: 9999 };

export const REPORT_REASONS = [
  { value: 'harassment',       label: 'Harassment or bullying' },
  { value: 'hate_speech',      label: 'Hate speech' },
  { value: 'fake_news',        label: 'Misinformation' },
  { value: 'spam',             label: 'Spam or ads' },
  { value: 'explicit_content', label: 'Explicit content' },
  { value: 'privacy',          label: 'Privacy violation' },
  { value: 'violence',         label: 'Violence or threats' },
  { value: 'other',            label: 'Other' },
];

export const POST_TYPES = ['text', 'photo', 'video', 'poll'];

export const VERIFIED_BADGE_LABELS = {
  government: { label: 'Official',      color: '#0033A0' },
  media:      { label: 'Media',         color: '#D97706' },
  influencer: { label: 'Influencer', color: '#7C3AED' },
  business:   { label: 'Business',      color: '#16A34A' },
  none: null,
};

export const PAGE_SIZE = 20;
