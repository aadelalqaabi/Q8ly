import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n';
import { AppRestartContext } from '../../context/AppRestartContext';
import { useBrutColors } from '../../components/Brut';

const LANG_EXPLICIT_KEY = '@kn_lang_explicit';

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const [selecting, setSelecting] = useState(null);
  const restartApp = useContext(AppRestartContext);
  const { TEXT, MUTED, ACCENT, BG, SEPARATOR } = useBrutColors();

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
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: TEXT }]}>KUWAI</Text>
        <Text style={[styles.taglineAr, { color: MUTED }]}>هنا تتكلم الكويت</Text>
        <Text style={[styles.taglineEn, { color: MUTED }]}>KUWAIT SPEAKS HERE</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={[styles.prompt, { color: MUTED }]}>اختر لغتك / CHOOSE LANGUAGE</Text>
        <View style={[styles.rule, { backgroundColor: TEXT }]} />

        <TouchableOpacity onPress={() => pick('ar')} disabled={!!selecting} activeOpacity={0.6} style={styles.langRow}>
          <Text style={[styles.langArabic, { color: TEXT }]}>العربية</Text>
          <View style={{ flex: 1 }} />
          {selecting === 'ar'
            ? <ActivityIndicator color={ACCENT} />
            : <Text style={[styles.langArrow, { color: ACCENT }]}>←</Text>}
        </TouchableOpacity>
        <View style={[styles.rowDivider, { backgroundColor: SEPARATOR }]} />
        <TouchableOpacity onPress={() => pick('en')} disabled={!!selecting} activeOpacity={0.6} style={styles.langRow}>
          <Text style={[styles.langEnglish, { color: TEXT }]}>ENGLISH</Text>
          <View style={{ flex: 1 }} />
          {selecting === 'en'
            ? <ActivityIndicator color={ACCENT} />
            : <Text style={[styles.langArrow, { color: ACCENT }]}>→</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 28 },
  top: { alignItems: 'flex-start', marginTop: 12 },
  wordmark: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  taglineAr: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  taglineEn: { fontSize: 11, fontWeight: '900', marginTop: 6, letterSpacing: 2 },
  bottom: {},
  prompt: { fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 14 },
  rule: { height: 2, marginBottom: 8 },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 22 },
  langArabic: { fontSize: 36, fontWeight: '900' },
  langEnglish: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  langArrow: { fontSize: 26, fontWeight: '900' },
  rowDivider: { height: StyleSheet.hairlineWidth },
});
