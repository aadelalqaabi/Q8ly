import React, { useState, useContext } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n';
import { AppRestartContext } from '../../context/AppRestartContext';

const ACCENT = '#0033A0';
const LANG_EXPLICIT_KEY = '@kn_lang_explicit';

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const [selecting, setSelecting] = useState(null); // 'ar' | 'en'
  const restartApp = useContext(AppRestartContext);

  const pick = async (lang) => {
    if (selecting) return;
    setSelecting(lang);

    await AsyncStorage.setItem(LANG_EXPLICIT_KEY, lang);
    await i18n.changeLanguage(lang);

    // Try a full JS reload so the language change applies cleanly
    try {
      const Updates = require('expo-updates');
      await Updates.reloadAsync();
    } catch (e) {
      // Expo Go or new-arch: reload failed — remount navigation tree instead.
      // Language is already saved; AppNavigator will re-read it and show the correct stack.
      console.warn('[LanguageSelect] reloadAsync failed, falling back to restartApp:', e?.message);
      restartApp();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}>

      {/* Logo */}
      <View style={styles.logoSection}>
        <Text style={styles.wordmark}>KUWAI</Text>
        <View style={styles.taglinePair}>
          <Text style={styles.taglineAr}>هنا تتكلم الكويت</Text>
          <Text style={styles.taglineDot}> · </Text>
          <Text style={styles.taglineEn}>Kuwait speaks here</Text>
        </View>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeAr}>اختر لغتك</Text>
        <Text style={styles.welcomeEn}>Choose your language</Text>
      </View>

      {/* Language buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.langBtn, selecting === 'ar' && styles.langBtnLoading]}
          onPress={() => pick('ar')}
          activeOpacity={0.85}
          disabled={!!selecting}
        >
          {selecting === 'ar'
            ? <ActivityIndicator color={ACCENT} />
            : (
              <>
                <Text style={styles.langBtnTitle}>العربية</Text>
                <Text style={styles.langBtnSub}>Arabic</Text>
              </>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langBtn, selecting === 'en' && styles.langBtnLoading]}
          onPress={() => pick('en')}
          activeOpacity={0.85}
          disabled={!!selecting}
        >
          {selecting === 'en'
            ? <ActivityIndicator color={ACCENT} />
            : (
              <>
                <Text style={styles.langBtnTitle}>English</Text>
                <Text style={styles.langBtnSub}>الإنجليزية</Text>
              </>
            )
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },

  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 96,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
  },
  taglinePair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taglineAr: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  taglineDot: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  taglineEn: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeAr: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    writingDirection: 'rtl',
  },
  welcomeEn: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },

  btnRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  langBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  langBtnLoading: {
    opacity: 0.7,
  },
  langBtnTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 2,
  },
  langBtnSub: {
    fontSize: 12,
    color: 'rgba(0,51,160,0.5)',
    fontWeight: '400',
  },
});
