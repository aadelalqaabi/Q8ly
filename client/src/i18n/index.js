/**
 * Kuwait Now — i18n (i18next + react-i18next)
 *
 * Usage in any component:
 *   const { t, i18n } = useTranslation();
 *   <Text>{t('home.trending')}</Text>
 *   <Text>{t('notif.like', { name: 'Ahmad' })}</Text>
 *   <Text>{t('post.replies', { count: 5 })}</Text>
 *
 * Change language (Settings screen):
 *   const restartApp = useContext(AppRestartContext);
 *   await changeAppLanguage('en', i18n, restartApp);
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ar as arLocale, enUS } from 'date-fns/locale';

import ar from './locales/ar.json';
import en from './locales/en.json';

export const LANG_KEY = '@kn_lang';

// ── Init ──────────────────────────────────────────────────────────────────────
// Resources are bundled — no network needed, works offline.
i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: 'ar',            // overridden by App.js before first render
  fallbackLng: 'ar',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
});

export default i18n;

// ── Language helpers ──────────────────────────────────────────────────────────

/** Detect the device's system language — 'ar' if Arabic, 'en' otherwise. */
function getDeviceLang() {
  try {
    // Intl is available in Hermes (Expo SDK 47+)
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return locale.startsWith('ar') ? 'ar' : 'en';
  } catch {
    // Fallback: RTL means Arabic keyboard/locale is active
    return I18nManager.isRTL ? 'ar' : 'en';
  }
}

/** Call once in App.js before rendering to apply stored preference. */
export async function initLanguage() {
  const stored = await AsyncStorage.getItem(LANG_KEY).catch(() => null);
  // Use stored preference if explicitly set; otherwise follow device language
  const lang = (stored === 'ar' || stored === 'en') ? stored : getDeviceLang();

  I18nManager.forceRTL(lang === 'ar');
  await i18n.changeLanguage(lang);
  return lang;
}

/**
 * Change app language from Settings.
 * Calls I18nManager.forceRTL, updates i18n, then remounts the navigation
 * tree via restartApp() so the direction change takes effect instantly.
 */
export async function changeAppLanguage(newLang, i18nInstance, restartApp) {
  const current = i18nInstance.language;
  if (newLang === current) return;

  await i18nInstance.changeLanguage(newLang);
  await AsyncStorage.setItem(LANG_KEY, newLang);
  I18nManager.forceRTL(newLang === 'ar');

  // Remount the navigation tree — direction applies immediately, no manual restart
  restartApp();
}

// ── date-fns locale helper ────────────────────────────────────────────────────
/** Returns the date-fns locale matching the current app language. */
export function getDateLocale() {
  return i18n.language === 'ar' ? arLocale : enUS;
}
