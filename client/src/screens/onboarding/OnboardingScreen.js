import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { isAr } from '../../components/Brut';

const { width: SW } = Dimensions.get('window');
export const ONBOARDING_KEY = '@kn_onboarding_done';

const ACCENT   = '#4D80FF';
const MAP_BG   = '#080E1C';
const GRID     = 'rgba(77,128,255,0.09)';
const DOT_CLR  = '#4D80FF';
const TEXT_CLR = '#F0EDE8';
const MUTED    = 'rgba(240,237,232,0.45)';
const CARD_BG  = '#0D1526';

const STEPS = [
  { label: '01', en: 'Go out',         ar: 'اخرج',          sub_en: 'leave home',      sub_ar: 'اترك المنزل' },
  { label: '02', en: 'Join a circle',  ar: 'انضم لدائرة',    sub_en: 'at a nearby spot', sub_ar: 'في مكان قريب' },
  { label: '03', en: 'Collect stamps', ar: 'جمّع الطوابع',   sub_en: 'visit, explore',  sub_ar: 'زر واستكشف' },
];

// Kuwait City coordinates shown as a decorative label
const COORDS = '29.3759° N  ·  47.9774° E';

function RadarPing() {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    rings.forEach((anim, i) => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulse.start();
    });
  }, []);

  return (
    <View style={radar.wrap}>
      {/* Grid lines */}
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
            {
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 2.6] }) }],
              opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0] }),
            },
          ]}
        />
      ))}

      {/* Center dot */}
      <View style={radar.centerOuter}>
        <View style={radar.centerInner} />
      </View>

      {/* Crosshair lines */}
      <View style={radar.crossH} />
      <View style={radar.crossV} />

      {/* Coords label */}
      <Text style={radar.coords}>{COORDS}</Text>
    </View>
  );
}

const RADAR_H = SW * 0.52;
const DOT_SIZE = 10;

const radar = StyleSheet.create({
  wrap: {
    width: '100%',
    height: RADAR_H,
    backgroundColor: MAP_BG,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: GRID },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: GRID },
  ring: {
    position: 'absolute',
    width: 90, height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  centerOuter: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  centerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  crossH: { position: 'absolute', left: '30%', right: '30%', height: StyleSheet.hairlineWidth, backgroundColor: ACCENT + '40' },
  crossV: { position: 'absolute', top: '30%', bottom: '30%', width: StyleSheet.hairlineWidth, backgroundColor: ACCENT + '40' },
  coords: { position: 'absolute', bottom: 12, alignSelf: 'center', fontSize: 10, fontWeight: '600', color: ACCENT + 'AA', letterSpacing: 1.2 },
});

export default function OnboardingScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const ar = isAr(i18n);

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
            paddingBottom: insets.bottom + 28,
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Map radar header */}
        <RadarPing />

        {/* Waypoint steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.stepRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              {/* Dot + connector */}
              <View style={styles.dotCol}>
                <View style={[styles.dot, { backgroundColor: DOT_CLR }]} />
                {i < STEPS.length - 1 && <View style={styles.connector} />}
              </View>
              {/* Text */}
              <View style={[styles.stepText, { alignItems: ar ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.stepLabel, { color: MUTED }]}>{step.label}</Text>
                <Text style={[styles.stepMain, { textAlign: ar ? 'right' : 'left' }]}>
                  {ar ? step.ar : step.en}
                </Text>
                <Text style={[styles.stepSub, { textAlign: ar ? 'right' : 'left' }]}>
                  {ar ? step.sub_ar : step.sub_en}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.btn} onPress={handleDone} activeOpacity={0.82}>
          <Text style={styles.btnText}>{ar ? 'يالله ←' : "Let's go →"}</Text>
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
    backgroundColor: CARD_BG,
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
  stepRow: { alignItems: 'flex-start', gap: 16, minHeight: 56 },
  dotCol: { alignItems: 'center', width: DOT_SIZE, paddingTop: 4 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: 32,
    backgroundColor: ACCENT + '35',
    marginTop: 4,
    marginBottom: -4,
  },
  stepText: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  stepMain: { fontSize: 22, fontWeight: '800', color: TEXT_CLR, lineHeight: 28 },
  stepSub: { fontSize: 13, color: MUTED, marginTop: 2, fontWeight: '500' },
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
