import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n';
import { AppRestartContext } from '../../context/AppRestartContext';
import { BG, TEXT, MUTED, ACCENT, SEPARATOR } from '../../components/Brut';

const LANG_EXPLICIT_KEY = '@kn_lang_explicit';

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const [selecting, setSelecting] = useState(null);
  const restartApp = useContext(AppRestartContext);

  const pick = async (lang) => {
    if (selecting) return;
    setSelecting(lang);
    await AsyncStorage.setItem(LANG_EXPLICIT_KEY, lang);
    await i18n.changeLanguage(lang);
    try {
      const Updates = require('expo-updates');
      await Updates.reloadAsync();
    } catch {
      restartApp();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.top}>
        <Text style={styles.wordmark}>KUWAI</Text>
        <Text style={styles.taglineAr}>هنا تتكلم الكويت</Text>
        <Text style={styles.taglineEn}>KUWAIT SPEAKS HERE</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.prompt}>اختر لغتك / CHOOSE LANGUAGE</Text>
        <View style={styles.rule} />

        <TouchableOpacity onPress={() => pick('ar')} disabled={!!selecting} activeOpacity={0.6} style={styles.langRow}>
          <Text style={styles.langArabic}>العربية</Text>
          <View style={{ flex: 1 }} />
          {selecting === 'ar'
            ? <ActivityIndicator color={ACCENT} />
            : <Text style={styles.langArrow}>←</Text>}
        </TouchableOpacity>
        <View style={styles.rowDivider} />
        <TouchableOpacity onPress={() => pick('en')} disabled={!!selecting} activeOpacity={0.6} style={styles.langRow}>
          <Text style={styles.langEnglish}>ENGLISH</Text>
          <View style={{ flex: 1 }} />
          {selecting === 'en'
            ? <ActivityIndicator color={ACCENT} />
            : <Text style={styles.langArrow}>→</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, justifyContent: 'space-between', paddingHorizontal: 28 },
  top: { alignItems: 'flex-start', marginTop: 12 },
  wordmark: { fontSize: 56, fontWeight: '900', color: TEXT, letterSpacing: -2 },
  taglineAr: { fontSize: 16, fontWeight: '700', color: MUTED, marginTop: 12 },
  taglineEn: { fontSize: 11, fontWeight: '900', color: MUTED, marginTop: 6, letterSpacing: 2 },
  bottom: {},
  prompt: {
    fontSize: 11, fontWeight: '800', color: MUTED,
    letterSpacing: 1.8, marginBottom: 14,
  },
  rule: { height: 2, backgroundColor: TEXT, marginBottom: 8 },
  langRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 22,
  },
  langArabic: { fontSize: 36, fontWeight: '900', color: TEXT },
  langEnglish: { fontSize: 36, fontWeight: '900', color: TEXT, letterSpacing: -1 },
  langArrow: { fontSize: 26, fontWeight: '900', color: ACCENT },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: SEPARATOR },
});
