import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Dimensions, Image, ActivityIndicator, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { hachiAPI } from '../../services/api';

let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;
const RADAR_R = Math.min(W, H) * 0.41;
const RING_COUNT = 4;
const SWEEP_MS = 5000;
const MAX_DIST_M = 20000; // 20 km = full radius

const KUWAIT_LAT = 29.3;
const KUWAIT_LNG = 47.65;

const PALETTE = ['#0033A0','#007A3D','#FF6B35','#2196F3','#9C27B0','#00BCD4','#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── geo helpers ─────────────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
          - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function cdnUrl(url, px) {
  if (!url) return null;
  return url.replace('/upload/', `/upload/w_${px},h_${px},c_fit,f_webp,q_auto:good/`);
}

// ─── main component ───────────────────────────────────────────────────────────

export default function RadarScreen() {
  const navigation = useNavigation();
  const insets  = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const user = useSelector(s => s.auth.user);
  const { colors: C, isDark } = useTheme();

  // Theme-aware radar colors
  const BG   = isDark ? '#04060F' : C.background;
  const BLUE = isDark ? '#1448FF' : C.accent;
  const DOT_COLOR  = isDark ? '#fff' : C.accent;
  const TEXT_COLOR = isDark ? '#fff' : C.text;
  const SUB_COLOR  = isDark ? 'rgba(255,255,255,0.35)' : C.textMuted;
  const [venues, setVenues]   = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Animated values
  const sweepAngle = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pingAnims  = useRef({});
  const lastTriggered = useRef({});
  const sweepDeg   = useRef(0);
  const plottedRef = useRef([]);

  // ── load venues ────────────────────────────────────────────────────────────
  useEffect(() => {
    hachiAPI.getVault()
      .then(data => {
        const v = (data || []).filter(x => x.lat && x.lng);
        v.forEach(venue => {
          pingAnims.current[venue._id]    = new Animated.Value(venue.visited ? 1 : 0);
          lastTriggered.current[venue._id] = -999;
        });
        setVenues(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── location ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Location) return;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(cur.coords);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        loc => setLocation(loc.coords),
      );
    })();
    return () => sub?.remove();
  }, []);

  // ── sweep arm animation ────────────────────────────────────────────────────
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(sweepAngle, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    const id = sweepAngle.addListener(({ value }) => { sweepDeg.current = value * 360; });
    return () => { anim.stop(); sweepAngle.removeListener(id); };
  }, []);

  // ── user dot pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 2.2, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,   duration: 600,  easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── ping detector ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const sweep = sweepDeg.current;
      plottedRef.current.forEach(v => {
        if (v.visited || v.brg == null) return;
        const diff      = ((sweep - v.brg) + 360) % 360;
        const sinceLast = ((sweep - (lastTriggered.current[v._id] ?? -999)) + 360) % 360;
        if (diff < 5 && sinceLast > 60) {
          lastTriggered.current[v._id] = sweep;
          const anim = pingAnims.current[v._id];
          if (!anim) return;
          anim.stopAnimation();
          Animated.sequence([
            Animated.timing(anim, { toValue: 1,    duration: 160, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.06, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]).start();
        }
      });
    }, 40);
    return () => clearInterval(id);
  }, []);

  // ── compute screen positions ───────────────────────────────────────────────
  const refLat = location?.latitude  ?? KUWAIT_LAT;
  const refLng = location?.longitude ?? KUWAIT_LNG;

  const plotted = venues.map(v => {
    const dist = haversine(refLat, refLng, v.lat, v.lng);
    const brg  = bearingDeg(refLat, refLng, v.lat, v.lng);
    const r    = Math.min(dist / MAX_DIST_M, 0.96) * RADAR_R;
    const rad  = brg * Math.PI / 180;
    return { ...v, dist, brg, x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
  });
  plottedRef.current = plotted;

  const visitedCount = venues.filter(v => v.visited).length;
  const nearest = plotted.filter(v => !v.visited && v.dist < 500).sort((a, b) => a.dist - b.dist)[0] ?? null;

  // ── sweep interpolations (main arm + 3 wake lines) ─────────────────────────
  const rot0 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['0deg',   '360deg'] });
  const rot1 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '346deg'] });
  const rot2 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '332deg'] });
  const rot3 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-44deg', '316deg'] });

  const pulseOpacity = pulseScale.interpolate({ inputRange: [1, 2.2], outputRange: [0.35, 0] });

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: BG }]}>

      {/* Distance rings */}
      {Array.from({ length: RING_COUNT }).map((_, i) => {
        const r = RADAR_R * ((i + 1) / RING_COUNT);
        return (
          <View key={i} style={[s.ring, {
            width: r * 2, height: r * 2, borderRadius: r,
            left: CX - r, top: CY - r,
            borderColor: BLUE,
            opacity: 0.07 + i * 0.04,
          }]} />
        );
      })}

      {/* Crosshairs */}
      <View style={[s.lineH, { top: CY - 0.5, left: CX - RADAR_R, width: RADAR_R * 2, backgroundColor: BLUE }]} />
      <View style={[s.lineV, { left: CX - 0.5, top: CY - RADAR_R, height: RADAR_R * 2, backgroundColor: BLUE }]} />

      {/* Sweep wake (trailing glow) */}
      {[{ rot: rot3, op: 0.05 }, { rot: rot2, op: 0.12 }, { rot: rot1, op: 0.28 }].map(({ rot, op }, i) => (
        <Animated.View key={i} style={[s.sweepWrap, { transform: [{ rotate: rot }] }]}>
          <View style={[s.sweepLine, { opacity: op, backgroundColor: BLUE }]} />
        </Animated.View>
      ))}

      {/* Main sweep arm */}
      <Animated.View style={[s.sweepWrap, { transform: [{ rotate: rot0 }] }]}>
        <View style={[s.sweepLine, { opacity: 0.95, backgroundColor: BLUE }]} />
      </Animated.View>

      {/* Venue markers */}
      {plotted.map(v => {
        const anim = pingAnims.current[v._id];
        if (!anim) return null;
        const dotSize = v.visited ? 46 : 9;
        return (
          <Animated.View
            key={v._id}
            style={[s.venueWrap, {
              left: v.x - dotSize / 2,
              top:  v.y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              opacity: anim,
            }]}
          >
            {v.visited ? (
              v.stampUrl
                ? <Image source={{ uri: cdnUrl(v.stampUrl, 46) }} style={s.stamp} resizeMode="contain" />
                : <View style={[s.blip, { width: 10, height: 10, borderRadius: 5, backgroundColor: DOT_COLOR }]} />
            ) : (
              <View style={[s.blip, { backgroundColor: BLUE, shadowColor: BLUE }]} />
            )}
          </Animated.View>
        );
      })}

      {/* User dot — pulsing core */}
      <Animated.View style={[s.pulseRing, {
        left: CX - 14, top: CY - 14,
        borderColor: DOT_COLOR,
        transform: [{ scale: pulseScale }],
        opacity: pulseOpacity,
      }]} />
      <View style={[s.userDot, { left: CX - 5, top: CY - 5, backgroundColor: DOT_COLOR, shadowColor: DOT_COLOR }]} />

      {/* Top bar: avatar + KUWAI wordmark */}
      <View style={[s.topBar, { paddingTop: insets.top + 6, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
          style={s.avatarBtn}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.75}
        >
          {user?.profilePic ? (
            <Image source={{ uri: cdnUrl(user.profilePic, 68) }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarImg, { backgroundColor: avatarBg(user?.name) }]}>
              <Text style={s.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[s.wordmark, { color: TEXT_COLOR }]}>KUWAI</Text>

        <View style={s.topBarRight}>
          {venues.length > 0 && (
            <Text style={[s.sub, { color: SUB_COLOR }]}>{visitedCount}/{venues.length}</Text>
          )}
        </View>
      </View>

      {/* Collected stamps strip — sits below the top bar */}
      {venues.filter(v => v.visited && v.stampUrl).length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={[s.stampStrip, { top: insets.top + 58 }]}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 10 }}
        >
          {venues.filter(v => v.visited && v.stampUrl).map(v => (
            <View key={v._id} style={[s.stampThumb, {
              borderColor: isDark ? 'rgba(20,72,255,0.3)' : 'rgba(0,51,160,0.2)',
              backgroundColor: isDark ? 'rgba(20,72,255,0.08)' : 'rgba(0,51,160,0.05)',
            }]}>
              <Image source={{ uri: cdnUrl(v.stampUrl, 46) }} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Nearby hint */}
      {!!nearest && (
        <View style={[s.nearbyBadge, {
          bottom: insets.bottom + 36,
          backgroundColor: isDark ? 'rgba(20,72,255,0.1)' : 'rgba(0,51,160,0.06)',
          borderColor: isDark ? 'rgba(20,72,255,0.35)' : 'rgba(0,51,160,0.2)',
        }]}>
          <View style={[s.nearbyDot, { backgroundColor: BLUE }]} />
          <Text style={[s.nearbyText, { color: BLUE }]}>
            {nearest.venueName || nearest.title} · {Math.round(nearest.dist)}m
          </Text>
        </View>
      )}

      {loading && <ActivityIndicator color={BLUE} style={s.loader} />}
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  ring: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  lineH: { position: 'absolute', height: StyleSheet.hairlineWidth, opacity: 0.18 },
  lineV: { position: 'absolute', width: StyleSheet.hairlineWidth, opacity: 0.18 },

  sweepWrap: {
    position: 'absolute',
    left: CX - RADAR_R, top: CY - RADAR_R,
    width: RADAR_R * 2, height: RADAR_R * 2,
  },
  sweepLine: {
    position: 'absolute',
    left: RADAR_R, top: RADAR_R - 1,
    width: RADAR_R, height: 2,
  },

  venueWrap: { position: 'absolute' },
  stamp: { width: 46, height: 46 },
  blip: {
    width: 9, height: 9, borderRadius: 4.5,
    shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  pulseRing: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
  },
  userDot: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    shadowOpacity: 1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  avatarBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  wordmark: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  topBarRight: { width: 44, alignItems: 'center' },
  sub: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },

  stampStrip: { position: 'absolute', left: 0, right: 0, zIndex: 9 },
  stampThumb: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },

  nearbyBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  nearbyDot: { width: 6, height: 6, borderRadius: 3 },
  nearbyText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  loader: { position: 'absolute', bottom: 80, alignSelf: 'center' },
});
