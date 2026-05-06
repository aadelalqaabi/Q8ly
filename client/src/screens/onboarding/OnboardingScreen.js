import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import * as Haptics from 'expo-haptics';
import { useBrutColors, isAr, ls, shout } from '../../components/Brut';

let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: SW } = Dimensions.get('window');
export const ONBOARDING_KEY = '@kn_onboarding_done';

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, BG } = useBrutColors();
  const flatRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const goNext = useCallback(() => {
    if (idx < 2) {
      flatRef.current?.scrollToIndex({ index: idx + 1, animated: true });
    }
  }, [idx]);

  const handleLocation = useCallback(async () => {
    if (!Location) { goNext(); return; }
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('onboarding.locationDeniedTitle'), t('onboarding.locationDeniedMsg'));
      }
    } catch {} finally { setBusy(false); }
    goNext();
  }, [goNext, t]);

  const handleFinish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone?.();
  }, [onDone]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setIdx(viewableItems[0].index);
  }).current;

  const pages = [
    {
      key: 'pulse',
      number: '01',
      title: t('onboarding.circlesTitle'),
      body: t('onboarding.circlesBody'),
      cta: t('onboarding.next'),
      action: goNext,
    },
    {
      key: 'location',
      number: '02',
      title: t('onboarding.locationTitle'),
      body: t('onboarding.locationBody'),
      cta: t('onboarding.enableLocation'),
      action: handleLocation,
    },
    {
      key: 'enter',
      number: '03',
      title: t('onboarding.pointsTitle'),
      body: t('onboarding.pointsBody'),
      cta: ar ? 'الدخول' : 'ENTER',
      action: handleFinish,
    },
  ];

  const renderPage = ({ item }) => (
    <View style={[styles.page, { width: SW, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}>
      <View style={[styles.pageInner, { alignItems: ar ? 'flex-end' : 'flex-start' }]}>
        <Text style={[styles.number, { color: MUTED, letterSpacing: ls(2, ar) }]}>{item.number}</Text>
        <View style={[styles.numberRule, { backgroundColor: TEXT }]} />
        <Text
          style={[styles.title, { color: TEXT, textAlign: ar ? 'right' : 'left', letterSpacing: ls(-2, ar) }]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {shout(item.title, ar)}
        </Text>
        <Text style={[styles.body, { color: MUTED, textAlign: ar ? 'right' : 'left' }]}>{item.body}</Text>
      </View>
      <TouchableOpacity
        style={[styles.cta, { alignSelf: ar ? 'flex-end' : 'flex-start' }]}
        onPress={item.action}
        disabled={busy}
        activeOpacity={0.6}
      >
        {busy && idx === 1 && item.key === 'location'
          ? <ActivityIndicator color={ACCENT} />
          : <Text style={[styles.ctaText, { color: ACCENT, letterSpacing: ls(2, ar) }]}>
              {ar ? `← ${item.cta}` : `${shout(item.cta, false)} →`}
            </Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        ref={flatRef}
        data={pages}
        keyExtractor={(p) => p.key}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyboardShouldPersistTaps="handled"
      />
      {/* Page indicator */}
      <View style={[styles.dots, { bottom: insets.bottom + 20 }]}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && { backgroundColor: TEXT, width: 18 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  pageInner: { flex: 1, justifyContent: 'center' },
  number: { fontSize: 12, fontWeight: '900' },
  numberRule: { width: 36, height: 2, marginTop: 10, marginBottom: 28 },
  title: { fontSize: 56, fontWeight: '900', lineHeight: 60, maxWidth: '95%' },
  body: { fontSize: 16, fontWeight: '500', lineHeight: 24, marginTop: 22, maxWidth: '90%' },
  cta: { paddingVertical: 16 },
  ctaText: { fontSize: 16, fontWeight: '900' },
  dots: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, backgroundColor: '#D8D8DD' },
});
