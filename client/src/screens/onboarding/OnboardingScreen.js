import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useBrutColors, isAr } from '../../components/Brut';
import { useTheme } from '../../context/ThemeContext';

const { width: SW } = Dimensions.get('window');
export const ONBOARDING_KEY = '@kn_onboarding_done';

const UNDRAW = require('../../assets/Undraw.png');

const STEPS = [
  { icon: '📍', en: 'Go out', ar: 'اخرج' },
  { icon: '⭕', en: 'Join a circle', ar: 'انضم لدائرة' },
  { icon: '🏅', en: 'Collect stamps', ar: 'جمّع الطوابع' },
];

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, ACCENT } = useBrutColors();
  const { isDark } = useTheme();

  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone?.();
  };

  const cardBg = isDark ? '#1C1A18' : '#fff';

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            paddingBottom: insets.bottom + 28,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Illustration */}
        <Image
          source={UNDRAW}
          style={[styles.illustration, { backgroundColor: cardBg }]}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  card: {
    width: SW,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 32,
    gap: 28,
    // shadow
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  illustration: {
    width: '100%',
    height: SW * 0.6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  steps: {
    gap: 18,
  },
  stepRow: {
    alignItems: 'center',
    gap: 16,
  },
  stepIcon: {
    fontSize: 26,
    lineHeight: 32,
  },
  stepText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  btn: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 28,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
