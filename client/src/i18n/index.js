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
import { I18nManager, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ar as arLocale, enUS } from 'date-fns/locale';

import ar from './locales/ar.json';
import en from './locales/en.json';

export const LANG_KEY = '@kn_lang';          // legacy key (no longer written)
const LANG_EXPLICIT_KEY = '@kn_lang_explicit'; // written only when user picks in Settings

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
    // 1. Intl API — most reliable in Hermes (SDK 47+)
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    if (intlLocale) return intlLocale.startsWith('ar') ? 'ar' : 'en';
  } catch {}

  try {
    // 2. iOS: AppleLanguages list (user's preferred language order)
    const langs = NativeModules.SettingsManager?.settings?.AppleLanguages || [];
    if (langs.length > 0) return langs[0].startsWith('ar') ? 'ar' : 'en';

    // 3. iOS: AppleLocale (region locale, less reliable for language)
    const appleLocale = NativeModules.SettingsManager?.settings?.AppleLocale || '';
    if (appleLocale) return appleLocale.startsWith('ar') ? 'ar' : 'en';

    // 4. Android
    const androidLocale = NativeModules.I18nManager?.localeIdentifier || '';
    if (androidLocale) return androidLocale.startsWith('ar') ? 'ar' : 'en';
  } catch {}

  // 5. Last resort: check if system is already RTL
  return I18nManager.isRTL ? 'ar' : 'en';
}

/** Call once in App.js before rendering to apply stored preference. */
export async function initLanguage() {
  // Only respect language the user EXPLICITLY chose in Settings.
  // Ignore old @kn_lang (may have been wrongly auto-saved as 'en').
  const explicit = await AsyncStorage.getItem(LANG_EXPLICIT_KEY).catch(() => null);

  // If user hasn't explicitly picked yet, use device language as a temp default
  // (LanguageSelectScreen will ask on first launch and override this).
  const lang = (explicit === 'ar' || explicit === 'en') ? explicit : getDeviceLang();

  // One-time migration: disable native RTL mirroring — we handle layout direction
  // manually via component-level `isRTL = i18n.language === 'ar'` checks.
  if (I18nManager.isRTL) {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
    await i18n.changeLanguage(lang);
    try {
      const Updates = require('expo-updates');
      await Updates.reloadAsync(); // execution stops here — restarts with isRTL=false
    } catch (e) {
      console.warn('[i18n] reloadAsync failed, restart the app once to finish migration:', e?.message);
    }
  }

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
  await AsyncStorage.setItem(LANG_EXPLICIT_KEY, newLang);
  // No forceRTL — layout direction is handled by component-level isRTL checks.
  restartApp();
}

// ── date-fns locale helper ────────────────────────────────────────────────────
/** Returns the date-fns locale matching the current app language. */
export function getDateLocale() {
  return i18n.language === 'ar' ? arLocale : enUS;
}
