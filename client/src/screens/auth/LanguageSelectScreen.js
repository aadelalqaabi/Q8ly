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
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR, CARD } = useBrutColors();

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
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
      {/* Wordmark */}
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: TEXT }]}>KUWAI</Text>
        <Text style={[styles.taglineAr, { color: MUTED }]}>هنا تتكلم الكويت</Text>
        <Text style={[styles.taglineEn, { color: MUTED }]}>Kuwait speaks here</Text>
      </View>

      {/* Language cards */}
      <View style={styles.bottom}>
        <Text style={[styles.prompt, { color: MUTED }]}>اختر لغتك · Choose your language</Text>

        <TouchableOpacity
          onPress={() => pick('ar')}
          disabled={!!selecting}
          activeOpacity={0.7}
          style={[styles.langCard, { backgroundColor: CARD, borderColor: SEPARATOR }]}
        >
          <Text style={[styles.langLabel, { color: TEXT }]}>العربية</Text>
          <Text style={[styles.langSub, { color: MUTED }]}>Arabic</Text>
          {selecting === 'ar'
            ? <ActivityIndicator color={ACCENT} style={styles.langIcon} />
            : <Text style={[styles.langIcon, { color: ACCENT }]}>‹</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => pick('en')}
          disabled={!!selecting}
          activeOpacity={0.7}
          style={[styles.langCard, { backgroundColor: CARD, borderColor: SEPARATOR }]}
        >
          <Text style={[styles.langLabel, { color: TEXT }]}>English</Text>
          <Text style={[styles.langSub, { color: MUTED }]}>الإنجليزية</Text>
          {selecting === 'en'
            ? <ActivityIndicator color={ACCENT} style={styles.langIcon} />
            : <Text style={[styles.langIcon, { color: ACCENT }]}>›</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  top: { alignItems: 'flex-start' },
  wordmark: { fontSize: 48, fontWeight: '700', letterSpacing: -1 },
  taglineAr: { fontSize: 16, fontWeight: '500', marginTop: 10 },
  taglineEn: { fontSize: 12, fontWeight: '500', marginTop: 4, letterSpacing: 0.5 },
  bottom: { gap: 12 },
  prompt: { fontSize: 13, fontWeight: '400', marginBottom: 8 },
  langCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: 20,
    borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  langLabel: { fontSize: 22, fontWeight: '600', flex: 1 },
  langSub: { fontSize: 13, fontWeight: '400', marginRight: 12 },
  langIcon: { fontSize: 20, fontWeight: '400' },
});
