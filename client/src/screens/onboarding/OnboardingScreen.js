import { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { isAr } from '../../components/Brut';
import { useTheme } from '../../context/ThemeContext';

const { width: SW } = Dimensions.get('window');
export const ONBOARDING_KEY = '@kn_onboarding_done';

// Map section always stays dark — maps look intentional dark
const MAP_BG   = '#080E1C';
const MAP_GRID = 'rgba(77,128,255,0.09)';
const RADAR_H  = SW * 0.52;
const DOT_SIZE = 10;

const STEPS = [
  {
    label_en: '01', label_ar: '٠١',
    en: 'Go out',         ar: 'اخرج',
    sub_en: 'leave home', sub_ar: 'اترك المنزل',
  },
  {
    label_en: '02', label_ar: '٠٢',
    en: 'Join a circle',       ar: 'انضم لدائرة',
    sub_en: 'at a nearby spot', sub_ar: 'في مكان قريب',
  },
  {
    label_en: '03', label_ar: '٠٣',
    en: 'Collect stamps',    ar: 'جمّع الطوابع',
    sub_en: 'visit, explore', sub_ar: 'زر واستكشف',
  },
];

function RadarPing({ accent }) {
  const rings = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    rings.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={radar.wrap}>
      {/* Grid */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <View key={`h${f}`} style={[radar.gridH, { top: `${f * 100}%` }]} />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={`v${f}`} style={[radar.gridV, { left: `${f * 100}%` }]} />
        ))}
      </View>

      {/* Expanding rings */}
      {rings.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            radar.ring,
            { borderColor: accent },
            {
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 2.6] }) }],
              opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0] }),
            },
          ]}
        />
      ))}

      {/* Center */}
      <View style={[radar.centerOuter, { backgroundColor: accent + '30' }]}>
        <View style={[radar.centerInner, { backgroundColor: accent }]} />
      </View>

      {/* Crosshair */}
      <View style={[radar.crossH, { backgroundColor: accent + '40' }]} />
      <View style={[radar.crossV, { backgroundColor: accent + '40' }]} />

      {/* Kuwait coords */}
      <Text style={[radar.coords, { color: accent + 'AA' }]}>
        29.3759° N  ·  47.9774° E
      </Text>
    </View>
  );
}

const radar = StyleSheet.create({
  wrap: {
    width: '100%', height: RADAR_H,
    backgroundColor: MAP_BG,
    borderRadius: 20, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center',
  },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: MAP_GRID },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: MAP_GRID },
  ring: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 1.5 },
  centerOuter: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  centerInner: { width: 8, height: 8, borderRadius: 4 },
  crossH: { position: 'absolute', left: '30%', right: '30%', height: StyleSheet.hairlineWidth },
  crossV: { position: 'absolute', top: '30%', bottom: '30%', width: StyleSheet.hairlineWidth },
  coords: { position: 'absolute', bottom: 12, alignSelf: 'center', fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
});

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const [forceAr, setForceAr] = useState(isAr(i18n));
  const ar = forceAr;
  const { isDark } = useTheme();

  // Theme-aware colors
  const ACCENT   = isDark ? '#4D80FF' : '#0033A0';
  const CARD_BG  = isDark ? '#0D1526' : '#FFFFFF';
  const TEXT_CLR = isDark ? '#F0EDE8' : '#0A0E1A';
  const MUTED    = isDark ? 'rgba(240,237,232,0.45)' : 'rgba(10,14,26,0.45)';
  const CONNECTOR = isDark ? ACCENT + '35' : ACCENT + '25';

  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone?.();
  };

  return (
    <View style={styles.backdrop}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: CARD_BG,
            paddingBottom: insets.bottom + 28,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Language toggle — for testing */}
        <View style={styles.langRow}>
          {['en', 'ar'].map((lng) => {
            const active = (lng === 'ar') === ar;
            return (
              <TouchableOpacity
                key={lng}
                onPress={() => setForceAr(lng === 'ar')}
                style={[styles.langPill, { backgroundColor: active ? ACCENT : 'transparent', borderColor: ACCENT }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.langPillText, { color: active ? '#fff' : ACCENT }]}>
                  {lng === 'ar' ? 'عربي' : 'EN'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <RadarPing accent={ACCENT} />

        {/* Waypoint steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.stepRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              {/* Dot + connector */}
              <View style={[styles.dotCol, ar && { alignItems: 'flex-end' }]}>
                <View style={[styles.dot, { backgroundColor: ACCENT }]} />
                {i < STEPS.length - 1 && <View style={[styles.connector, { backgroundColor: CONNECTOR }]} />}
              </View>

              {/* Text */}
              <View style={[styles.stepTextWrap, { alignItems: ar ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.stepLabel, { color: MUTED }]}>
                  {ar ? step.label_ar : step.label_en}
                </Text>
                <Text style={[styles.stepMain, { color: TEXT_CLR, textAlign: ar ? 'right' : 'left' }]}>
                  {ar ? step.ar : step.en}
                </Text>
                <Text style={[styles.stepSub, { color: MUTED, textAlign: ar ? 'right' : 'left' }]}>
                  {ar ? step.sub_ar : step.sub_en}
                </Text>
              </View>
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
            {ar ? '← يالله' : "Let's go →"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  card: {
    width: SW,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
  },
  steps: { gap: 0 },
  stepRow: { alignItems: 'flex-start', gap: 16, minHeight: 58 },
  dotCol: { alignItems: 'center', width: DOT_SIZE, paddingTop: 5 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  connector: { width: 1.5, flex: 1, minHeight: 28, marginTop: 4, marginBottom: -4 },
  stepTextWrap: { flex: 1, paddingBottom: 18 },
  stepLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  stepMain: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  stepSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  btn: {
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  langPill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  langPillText: { fontSize: 12, fontWeight: '700' },
});
