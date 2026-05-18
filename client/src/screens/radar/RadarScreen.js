import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Dimensions, Image, ActivityIndicator, TouchableOpacity, ScrollView, AppState,
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
const RADAR_R    = Math.min(W, H) * 0.41;
const RING_COUNT = 4;
const SWEEP_MS   = 5000;
const MAX_DIST_M = 20000;
const KUWAIT_LAT = 29.3;
const KUWAIT_LNG = 47.65;

const PALETTE = ['#0033A0','#007A3D','#FF6B35','#2196F3','#9C27B0','#00BCD4','#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

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

export default function RadarScreen() {
  const navigation  = useNavigation();
  const insets      = useSafeAreaInsets();
  const { i18n }    = useTranslation();
  const user        = useSelector(s => s.auth.user);
  const { colors: C, isDark } = useTheme();

  const BG        = isDark ? '#04060F' : C.background;
  const BLUE      = isDark ? '#1448FF' : C.accent;
  const DOT_COLOR = isDark ? '#fff'    : C.accent;
  const TEXT_COLOR = isDark ? '#fff'   : C.text;

  const [venues,      setVenues]      = useState([]);
  const [location,    setLocation]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [searching,   setSearching]   = useState(false);
  const [insideVenue, setInsideVenue] = useState(null);
  const locationRef = useRef(null);

  const sweepAngle   = useRef(new Animated.Value(0)).current;
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const cardSlide    = useRef(new Animated.Value(200)).current; // enter card
  const pingAnims    = useRef({});
  const activeAnims  = useRef({}); // glowing rings for inside-geofence venues
  const lastTriggered = useRef({});
  const sweepDeg     = useRef(0);
  const plottedRef   = useRef([]);
  const prevInsideId = useRef(null);

  // ── load venues ──────────────────────────────────────────────────────────────
  const fetchVenues = useCallback(() => {
    hachiAPI.getVault()
      .then(data => {
        const v = (Array.isArray(data) ? data : data?.items || []).filter(x => x.lat && x.lng);
        v.forEach(venue => {
          if (!pingAnims.current[venue._id]) {
            pingAnims.current[venue._id]     = new Animated.Value(0);
            activeAnims.current[venue._id]   = new Animated.Value(0);
            lastTriggered.current[venue._id] = -999;
          }
        });
        setVenues(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  // Poll every 15s to pick up new circles
  useEffect(() => {
    const id = setInterval(fetchVenues, 15_000);
    return () => clearInterval(id);
  }, [fetchVenues]);

  // Refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') fetchVenues();
    });
    return () => sub.remove();
  }, [fetchVenues]);

  // ── location ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Location) return;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(cur.coords);
      locationRef.current = cur.coords;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15 },
        loc => { setLocation(loc.coords); locationRef.current = loc.coords; },
      );
    })();
    return () => sub?.remove();
  }, []);

  // ── force search ─────────────────────────────────────────────────────────────
  const handleFind = useCallback(async () => {
    if (searching) return;
    setSearching(true);
    try {
      if (Location) {
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(cur.coords);
        locationRef.current = cur.coords;
      }
      await new Promise((res) => {
        hachiAPI.getVault()
          .then(data => {
            const v = (Array.isArray(data) ? data : data?.items || []).filter(x => x.lat && x.lng);
            v.forEach(venue => {
              if (!pingAnims.current[venue._id]) {
                pingAnims.current[venue._id]     = new Animated.Value(0);
                activeAnims.current[venue._id]   = new Animated.Value(0);
                lastTriggered.current[venue._id] = -999;
              }
            });
            setVenues(v);
          })
          .catch(() => {})
          .finally(res);
      });
    } finally {
      setSearching(false);
    }
  }, [searching]);

  // ── sweep arm ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(sweepAngle, { toValue: 1, duration: SWEEP_MS, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    const id = sweepAngle.addListener(({ value }) => { sweepDeg.current = value * 360; });
    return () => { anim.stop(); sweepAngle.removeListener(id); };
  }, []);

  // ── user dot pulse ───────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 2.2, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,   duration: 600,  easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      ])
    ).start();
  }, []);


  // ── geofence detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!location || !venues.length) return;
    const inside = plottedRef.current.find(v => v.dist <= (v.radius || 650)) ?? null;

    if (inside?._id !== prevInsideId.current) {
      prevInsideId.current = inside?._id ?? null;

      // Animate enter card in/out
      Animated.spring(cardSlide, {
        toValue: inside ? 0 : 200,
        damping: 18, stiffness: 220,
        useNativeDriver: true,
      }).start();

      // Animate dot + ring on venue marker
      Object.keys(activeAnims.current).forEach(id => {
        const isThis = id === inside?._id;
        Animated.timing(activeAnims.current[id], { toValue: isThis ? 1 : 0, duration: 300, useNativeDriver: true }).start();
        Animated.timing(pingAnims.current[id],   { toValue: isThis ? 1 : 0, duration: 300, useNativeDriver: true }).start();
      });

      setInsideVenue(inside ?? null);
    }
  }, [location, venues]);

  // ── positions ─────────────────────────────────────────────────────────────────
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

  // ── sweep interpolations ──────────────────────────────────────────────────────
  const rot0 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['0deg',   '360deg'] });
  const rot1 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '346deg'] });
  const rot2 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '332deg'] });
  const rot3 = sweepAngle.interpolate({ inputRange: [0, 1], outputRange: ['-44deg', '316deg'] });
  const pulseOpacity = pulseScale.interpolate({ inputRange: [1, 2.2], outputRange: [0.35, 0] });

  const enterCircle = (venue) => navigation.navigate('Circle', { circleId: venue._id });

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: BG }]}>

      {/* Distance rings */}
      {Array.from({ length: RING_COUNT }).map((_, i) => {
        const r = RADAR_R * ((i + 1) / RING_COUNT);
        return (
          <View key={i} style={[s.ring, {
            width: r * 2, height: r * 2, borderRadius: r,
            left: CX - r, top: CY - r,
            borderColor: BLUE, opacity: 0.07 + i * 0.04,
          }]} />
        );
      })}

      {/* Crosshairs */}
      <View style={[s.lineH, { top: CY - 0.5, left: CX - RADAR_R, width: RADAR_R * 2, backgroundColor: BLUE }]} />
      <View style={[s.lineV, { left: CX - 0.5, top: CY - RADAR_R, height: RADAR_R * 2, backgroundColor: BLUE }]} />

      {/* Sweep wake */}
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
        const pingAnim   = pingAnims.current[v._id];
        const activeAnim = activeAnims.current[v._id];
        if (!pingAnim) return null;
        const isInside  = insideVenue?._id === v._id;
        const dotSize   = v.visited ? 13 : 9;

        return (
          <TouchableOpacity
            key={v._id}
            activeOpacity={0.8}
            onPress={() => enterCircle(v)}
            style={[s.venueWrap, {
              left: v.x - dotSize / 2 - (isInside ? 8 : 0),
              top:  v.y - dotSize / 2 - (isInside ? 8 : 0),
              width:  dotSize + (isInside ? 16 : 0),
              height: dotSize + (isInside ? 16 : 0),
              justifyContent: 'center', alignItems: 'center',
            }]}
          >
            {/* Glowing active ring when inside geofence */}
            {activeAnim && (
              <Animated.View style={[s.activeRing, {
                width: dotSize + 20, height: dotSize + 20,
                borderRadius: (dotSize + 20) / 2,
                borderColor: BLUE,
                opacity: activeAnim,
              }]} />
            )}

            <Animated.View style={{ opacity: pingAnim }}>
              {v.visited ? (
                <View style={[s.visitedBlip, { backgroundColor: DOT_COLOR, shadowColor: DOT_COLOR }]} />
              ) : (
                <View style={[s.blip, { backgroundColor: BLUE, shadowColor: BLUE }]} />
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}

      {/* User dot */}
      <Animated.View style={[s.pulseRing, {
        left: CX - 14, top: CY - 14,
        borderColor: DOT_COLOR,
        transform: [{ scale: pulseScale }],
        opacity: pulseOpacity,
      }]} />
      <View style={[s.userDot, { left: CX - 5, top: CY - 5, backgroundColor: DOT_COLOR, shadowColor: DOT_COLOR }]} />

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <Text style={[s.wordmark, { color: TEXT_COLOR }]}>KUWAI</Text>

        <TouchableOpacity style={s.avatarBtn} onPress={() => navigation.navigate('Profile')} activeOpacity={0.75}>
          {user?.profilePic ? (
            <Image source={{ uri: cdnUrl(user.profilePic, 84) }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarImg, { backgroundColor: avatarBg(user?.name) }]}>
              <Text style={s.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>


      {/* Enter card — slides up when inside a geofence */}
      <Animated.View style={[s.enterCard, {
        bottom: insets.bottom + 24,
        backgroundColor: isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,255,0.97)',
        borderColor: BLUE,
        transform: [{ translateY: cardSlide }],
      }]}>
        {insideVenue && (
          <>
            <View style={s.enterCardLeft}>
              {insideVenue.stampUrl ? (
                <Image source={{ uri: cdnUrl(insideVenue.stampUrl, 56) }} style={s.enterStamp} resizeMode="contain" />
              ) : (
                <View style={[s.enterStampFallback, { backgroundColor: BLUE }]}>
                  <Text style={s.enterStampInitial}>{insideVenue.title?.[0] || '?'}</Text>
                </View>
              )}
              <View>
                <Text style={[s.enterVenueName, { color: TEXT_COLOR }]} numberOfLines={1}>
                  {insideVenue.title || insideVenue.venueName}
                </Text>
                <Text style={[s.enterSub, { color: isDark ? 'rgba(255,255,255,0.45)' : C.textMuted }]}>
                  {insideVenue.visited
                    ? (i18n.language === 'ar' ? 'زرت هذا المكان' : "You've been here")
                    : (i18n.language === 'ar' ? 'أنت هنا — اضغط للدخول' : "You're here — tap to unlock")}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.enterBtn, { backgroundColor: BLUE }]}
              onPress={() => enterCircle(insideVenue)}
              activeOpacity={0.85}
            >
              <Text style={s.enterBtnText}>{i18n.language === 'ar' ? 'ادخل' : 'Enter'}</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      {/* Find button — shown when not inside any geofence */}
      {!insideVenue && (
        <TouchableOpacity
          style={[s.findBtn, { bottom: insets.bottom + 24, backgroundColor: BLUE }]}
          onPress={handleFind}
          activeOpacity={0.85}
          disabled={searching}
        >
          {searching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.findBtnText}>
                {i18n.language === 'ar' ? 'ابحث عن دائرة' : 'FIND CIRCLE'}
              </Text>
          }
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator color={BLUE} style={s.loader} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  ring:  { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
  lineH: { position: 'absolute', height: StyleSheet.hairlineWidth, opacity: 0.18 },
  lineV: { position: 'absolute', width:  StyleSheet.hairlineWidth, opacity: 0.18 },

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
  visitedBlip: {
    width: 13, height: 13, borderRadius: 6.5,
    shadowOpacity: 1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  blip: {
    width: 9, height: 9, borderRadius: 4.5,
    shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  activeRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },

  pulseRing: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  wordmark: { flex: 1, fontSize: 24, fontWeight: '900' },
  findBtn: {
    position: 'absolute',
    left: 20, right: 20,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  findBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0, color: '#fff' },
  avatarBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Enter card
  enterCard: {
    position: 'absolute',
    left: 20, right: 20,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    zIndex: 20,
  },
  enterCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  enterStamp: { width: 48, height: 48 },
  enterStampFallback: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  enterStampInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  enterVenueName: { fontSize: 15, fontWeight: '700', maxWidth: W * 0.42 },
  enterSub: { fontSize: 12, marginTop: 2 },
  enterBtn: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  enterBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  loader: { position: 'absolute', bottom: 80, alignSelf: 'center' },
});
