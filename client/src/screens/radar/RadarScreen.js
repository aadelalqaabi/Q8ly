import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Alert, Dimensions, Image,
} from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { hachiAPI } from '../../services/api';
let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: SW } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SW * 0.88, 380);
const RADAR_R    = RADAR_SIZE / 2;
const MAX_DIST   = 5000;   // metres shown at radar edge
const SWEEP_MS   = 3000;   // one full rotation
const DOT        = 8;

// ── Helpers ──────────────────────────────────────────────────────────────────

function bearingTo(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(meters, ar) {
  if (meters == null) return '';
  if (meters < 1000) return ar ? `${Math.round(meters)} م` : `${Math.round(meters)}M`;
  return ar ? `${(meters / 1000).toFixed(1)} كم` : `${(meters / 1000).toFixed(1)}KM`;
}

// ── Venue dot — positioned by bearing + distance ──────────────────────────────

function VenueDot({ pulse, userLoc, sweepAngle, onPress }) {
  if (!userLoc || pulse.lat == null || pulse.lng == null) return null;

  const dist = haversineMeters(userLoc.lat, userLoc.lng, pulse.lat, pulse.lng);
  if (dist > MAX_DIST) return null;

  const bearing = bearingTo(userLoc.lat, userLoc.lng, pulse.lat, pulse.lng);
  const r       = (dist / MAX_DIST) * (RADAR_R - 28);
  const angle   = bearing * Math.PI / 180;
  const cx      = RADAR_R + r * Math.sin(angle);
  const cy      = RADAR_R - r * Math.cos(angle);

  // Sweep within ±25° illuminates the dot
  const diff = ((sweepAngle - bearing + 540) % 360) - 180;
  const lit  = Math.abs(diff) < 25;

  const left = cx - DOT / 2;
  const top  = cy - DOT / 2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={{ position: 'absolute', left: left - 36, top, alignItems: 'center', width: DOT + 72 }}
    >
      <View style={[
        styles.dot,
        lit ? styles.dotLit : (pulse.activeHere > 0 ? styles.dotActive : styles.dotDim),
      ]} />
      <Text style={[styles.dotLabel, { color: lit ? '#fff' : '#3a3a3a' }]} numberOfLines={1}>
        {(pulse.title || pulse.venueName || '').toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigation = useNavigation();
  const { user: currentUser } = useSelector((s) => s.auth);

  const [pulses, setPulses]     = useState([]);
  const [userLoc, setUserLoc]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [nearby, setNearby]     = useState(null);
  const [sweepAngle, setSweepAngle] = useState(0);

  const watchRef      = useRef(null);
  const radarPollRef  = useRef(null);
  const nearbyPollRef = useRef(null);
  const sweepAnim     = useRef(new Animated.Value(0)).current;

  // ── Sweep animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const id = sweepAnim.addListener(({ value }) => setSweepAngle(value * 360));
    loop.start();
    return () => { loop.stop(); sweepAnim.removeListener(id); };
  }, [sweepAnim]);

  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Location ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Location) return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
        setUserLoc(loc);
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 8000 },
          (p) => { if (!cancelled) setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed }); }
        );
      } catch {}
    })();
    return () => { cancelled = true; if (watchRef.current) watchRef.current.remove(); };
  }, []);

  // ── Geofence auto-enter ─────────────────────────────────────────────────────
  const checkGeofence = useCallback(async (loc) => {
    if (!loc) return;
    for (const p of pulses) {
      if (haversineMeters(loc.lat, loc.lng, p.lat, p.lng) < 200) {
        try {
          const r = await hachiAPI.checkLocation(p._id, loc.lat, loc.lng, loc.speed || 0);
          if (r.status === 'here') { navigation.navigate('Circle', { circleId: p._id }); return; }
        } catch {}
      }
    }
  }, [pulses, navigation]);

  // ── Pulses ──────────────────────────────────────────────────────────────────
  const fetchPulses = useCallback(async () => {
    try { const res = await hachiAPI.getRadar(); setPulses(res.pulses || []); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPulses();
    radarPollRef.current = setInterval(fetchPulses, 30000);
    return () => clearInterval(radarPollRef.current);
  }, [fetchPulses]);

  useEffect(() => {
    if (userLoc && pulses.length > 0) checkGeofence(userLoc);
  }, [userLoc, pulses, checkGeofence]);

  // ── Nearby ──────────────────────────────────────────────────────────────────
  const fetchNearby = useCallback(async (loc) => {
    try { const res = await hachiAPI.getNearby(loc?.lat, loc?.lng, 5000); setNearby(res.circle || null); }
    catch {}
  }, []);

  useEffect(() => {
    fetchNearby(userLoc);
    clearInterval(nearbyPollRef.current);
    nearbyPollRef.current = setInterval(() => fetchNearby(userLoc), 30000);
    return () => clearInterval(nearbyPollRef.current);
  }, [userLoc, fetchNearby]);

  const handleNearbyTap = async () => {
    if (!nearby) return;
    if (nearby.status === 'here') { navigation.navigate('Circle', { circleId: nearby._id }); return; }
    try {
      const r = await hachiAPI.checkLocation(nearby._id, userLoc?.lat ?? 0, userLoc?.lng ?? 0, userLoc?.speed ?? 0);
      if (r.status === 'here') { navigation.navigate('Circle', { circleId: nearby._id }); return; }
    } catch {}
    Alert.alert(t('radar.travelThere'), t('radar.travelThereMsg'));
  };

  const handleDotPress = async (pulse) => {
    try {
      const r = await hachiAPI.checkLocation(pulse._id, userLoc?.lat ?? 0, userLoc?.lng ?? 0, userLoc?.speed ?? 0);
      if (r.status === 'here') { navigation.navigate('Circle', { circleId: pulse._id }); return; }
    } catch {}
    Alert.alert(t('radar.travelThere'), t('radar.travelThereMsg'));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>KUWAI</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn} activeOpacity={0.7}>
          {currentUser?.profilePic
            ? <Image source={{ uri: currentUser.profilePic }} style={styles.profileAvatar} />
            : <View style={styles.profileFallback}><Ionicons name="person" size={18} color="#fff" /></View>
          }
        </TouchableOpacity>
      </View>

      {/* Radar canvas */}
      <View style={styles.radarWrap}>
        <View style={{ width: RADAR_SIZE, height: RADAR_SIZE }}>

          {/* Static: rings + crosshairs + distance labels */}
          <Svg width={RADAR_SIZE} height={RADAR_SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Crosshairs */}
            <Line x1={0} y1={RADAR_R} x2={RADAR_SIZE} y2={RADAR_R} stroke="#fff" strokeWidth={0.5} opacity={0.05} />
            <Line x1={RADAR_R} y1={0} x2={RADAR_R} y2={RADAR_SIZE} stroke="#fff" strokeWidth={0.5} opacity={0.05} />
            {/* Rings at 25 / 50 / 75 / 100 % */}
            {[0.25, 0.5, 0.75, 1].map((f, i) => (
              <Circle key={i} cx={RADAR_R} cy={RADAR_R} r={RADAR_R * f - 1}
                fill="none" stroke="#fff" strokeWidth={i === 3 ? 1 : 0.5}
                opacity={i === 3 ? 0.18 : 0.07}
              />
            ))}
            {/* Distance labels — 3 o'clock of 25% and 75% rings */}
            <SvgText x={RADAR_R + RADAR_R * 0.25 + 5} y={RADAR_R - 4}
              fontSize={6} fontWeight="800" fill="rgba(255,255,255,0.22)" letterSpacing={1}>
              1KM
            </SvgText>
            <SvgText x={RADAR_R + RADAR_R * 0.75 + 5} y={RADAR_R - 4}
              fontSize={6} fontWeight="800" fill="rgba(255,255,255,0.22)" letterSpacing={1}>
              4KM
            </SvgText>
          </Svg>

          {/* Animated sweep */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: sweepRotate }] }]}
            pointerEvents="none"
          >
            <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
              {/* Trail: 3 ghost lines at -10 / -20 / -35 degrees */}
              <G transform={`rotate(-35, ${RADAR_R}, ${RADAR_R})`}>
                <Line x1={RADAR_R} y1={RADAR_R} x2={RADAR_R} y2={2} stroke="#fff" strokeWidth={1} opacity={0.04} />
              </G>
              <G transform={`rotate(-20, ${RADAR_R}, ${RADAR_R})`}>
                <Line x1={RADAR_R} y1={RADAR_R} x2={RADAR_R} y2={2} stroke="#fff" strokeWidth={1} opacity={0.09} />
              </G>
              <G transform={`rotate(-10, ${RADAR_R}, ${RADAR_R})`}>
                <Line x1={RADAR_R} y1={RADAR_R} x2={RADAR_R} y2={2} stroke="#fff" strokeWidth={1} opacity={0.18} />
              </G>
              {/* Main sweep line */}
              <Line x1={RADAR_R} y1={RADAR_R} x2={RADAR_R} y2={2} stroke="#fff" strokeWidth={1.5} opacity={0.85} />
            </Svg>
          </Animated.View>

          {/* Venue dots — positioned by bearing + distance */}
          {pulses.map((pulse) => (
            <VenueDot
              key={pulse._id}
              pulse={pulse}
              userLoc={userLoc}
              sweepAngle={sweepAngle}
              onPress={() => handleDotPress(pulse)}
            />
          ))}

          {/* You — center */}
          <View style={styles.centerRing} pointerEvents="none" />
          <View style={styles.centerDot} pointerEvents="none" />
        </View>

        {/* Status: N circles active */}
        <Text style={styles.statusLine}>
          {loading ? '· · ·' : `${pulses.length} ${ar ? 'دوائر نشطة' : 'CIRCLES ACTIVE'}`}
        </Text>
      </View>

      {/* Nearby card */}
      {nearby && (
        <TouchableOpacity
          style={[styles.nearbyCard, { bottom: insets.bottom + 16 }]}
          onPress={handleNearbyTap}
          activeOpacity={0.85}
        >
          <View style={[styles.nearbyRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1 }}>
              <View style={[styles.nearbyTagRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                <View style={[
                  styles.nearbyDot,
                  nearby.status === 'here'   && { backgroundColor: '#34C759' },
                  nearby.status === 'nearby' && { backgroundColor: '#FF9500' },
                ]} />
                <Text style={[styles.nearbyTag, { letterSpacing: ar ? 0 : 2 }]}>
                  {nearby.status === 'here'
                    ? (ar ? 'أنت هنا' : 'YOU ARE HERE')
                    : nearby.status === 'nearby'
                      ? (ar ? 'قريب' : 'NEARBY')
                      : (ar ? 'الأقرب لك' : 'NEAREST')}
                </Text>
              </View>
              <Text style={[styles.nearbyName, { textAlign: ar ? 'right' : 'left' }]} numberOfLines={1}>
                {nearby.title || nearby.venueName}
              </Text>
              <Text style={[styles.nearbyMeta, { letterSpacing: ar ? 0 : 1.2, textAlign: ar ? 'right' : 'left' }]}>
                {formatDist(nearby.distance, ar)}
              </Text>
            </View>
            <View style={[styles.counterBlock, { alignItems: ar ? 'flex-start' : 'flex-end' }]}>
              <Text style={styles.counterNum}>{nearby.activeHere || 0}</Text>
              <Text style={[styles.counterLabel, { letterSpacing: ar ? 0 : 1.5 }]}>
                {ar ? 'هني' : 'HERE NOW'}
              </Text>
            </View>
            <Text style={styles.nearbyArrow}>{ar ? '←' : '→'}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 8, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  profileAvatar: { width: '100%', height: '100%' },
  profileFallback: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

  radarWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  centerDot: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#fff',
    top: RADAR_R - 4, left: RADAR_R - 4,
    zIndex: 10,
  },
  centerRing: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    top: RADAR_R - 11, left: RADAR_R - 11,
    zIndex: 9,
  },

  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotDim: { backgroundColor: '#2a2a2a' },
  dotLit: {
    backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  dotActive: { backgroundColor: '#4D80FF' },
  dotLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 4, textAlign: 'center' },

  statusLine: {
    marginTop: 18,
    fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.2)', letterSpacing: 2,
  },

  nearbyCard: {
    position: 'absolute', left: 14, right: 14,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  nearbyRow: { alignItems: 'center', gap: 10 },
  nearbyTagRow: { alignItems: 'center', gap: 6, marginBottom: 4 },
  nearbyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4D80FF' },
  nearbyTag: { fontSize: 9, fontWeight: '900', color: '#555' },
  nearbyName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  counterBlock: { paddingHorizontal: 14, justifyContent: 'center' },
  counterNum: { fontSize: 32, fontWeight: '900', color: '#fff', lineHeight: 32, fontVariant: ['tabular-nums'] },
  counterLabel: { fontSize: 9, fontWeight: '900', color: '#555', marginTop: 4 },
  nearbyMeta: { fontSize: 11, fontWeight: '800', color: '#555', marginTop: 4 },
  nearbyArrow: { fontSize: 22, fontWeight: '900', color: '#fff' },
});
