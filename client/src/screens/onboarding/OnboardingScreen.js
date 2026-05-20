import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import * as Haptics from 'expo-haptics';
import { useBrutColors, isAr } from '../../components/Brut';
import { useTheme } from '../../context/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');
export const ONBOARDING_KEY = '@kn_onboarding_done';

const UNDRAW = require('../../assets/Undraw.png');

const STEPS = [
  { icon: '📍', en: 'Go out', ar: 'اخرج' },
  { icon: '⭕', en: 'Join a circle', ar: 'انضم لدائرة' },
  { icon: '🏅', en: 'Collect stamps', ar: 'جمّع الطوابع' },
];

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { i18n: i18nHook } = useTranslation();
  const ar = isAr(i18nHook);
  const { TEXT, ACCENT, BG } = useBrutColors();
  const { isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDone = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone?.();
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1C1A18' : '#fff',
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Illustration */}
        <Image
          source={UNDRAW}
          style={styles.illustration}
          resizeMode="contain"
        />

        {/* Steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.stepRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              <Text style={styles.stepIcon}>{step.icon}</Text>
              <Text style={[styles.stepText, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}>
                {ar ? step.ar : step.en}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: ACCENT }]}
          onPress={handleDone}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>
            {ar ? 'يالله 🚀' : "Let's go 🚀"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: SW,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  illustration: {
    width: SW * 0.85,
    height: SH * 0.38,
  },
  steps: {
    width: '100%',
    gap: 20,
  },
  stepRow: {
    alignItems: 'center',
    gap: 16,
  },
  stepIcon: {
    fontSize: 28,
    lineHeight: 36,
  },
  stepText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  btn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
