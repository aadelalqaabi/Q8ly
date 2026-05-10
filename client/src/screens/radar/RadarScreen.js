import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Alert, Dimensions, Image,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { hachiAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: SW } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SW * 0.86, 360);
const RADAR_R    = RADAR_SIZE / 2;
const MAX_DIST   = 5000;
const SWEEP_MS   = 3000;
const DOT        = 9;

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

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
  if (meters < 1000) return ar ? `${Math.round(meters)} م` : `${Math.round(meters)} m`;
  return ar ? `${(meters / 1000).toFixed(1)} كم` : `${(meters / 1000).toFixed(1)} km`;
}

// ── Venue dot ─────────────────────────────────────────────────────────────────
function VenueDot({ pulse, userLoc, sweepAngle, onPress }) {
  if (!userLoc || pulse.lat == null || pulse.lng == null) return null;

  const dist = haversineMeters(userLoc.lat, userLoc.lng, pulse.lat, pulse.lng);
  if (dist > MAX_DIST) return null;

  const bearing = bearingTo(userLoc.lat, userLoc.lng, pulse.lat, pulse.lng);
  const r       = (dist / MAX_DIST) * (RADAR_R - 28);
  const angle   = bearing * Math.PI / 180;
  const cx      = RADAR_R + r * Math.sin(angle);
  const cy      = RADAR_R - r * Math.cos(angle);

  const diff = ((sweepAngle - bearing + 540) % 360) - 180;
  const lit  = Math.abs(diff) < 25;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={{ position: 'absolute', left: cx - DOT / 2 - 36, top: cy - DOT / 2, alignItems: 'center', width: DOT + 72 }}
    >
      <View style={[
        dotStyles.dot,
        lit ? dotStyles.dotLit : (pulse.activeHere > 0 ? dotStyles.dotActive : dotStyles.dotDim),
      ]} />
      <Text style={[dotStyles.label, { color: lit ? '#fff' : 'rgba(255,255,255,0.35)' }]} numberOfLines={1}>
        {pulse.title || pulse.venueName || ''}
      </Text>
    </TouchableOpacity>
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotDim: { backgroundColor: 'rgba(255,255,255,0.15)' },
  dotLit: {
    backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  dotActive: { backgroundColor: '#4D80FF' },
  label: { fontSize: 8, fontWeight: '500', marginTop: 5, textAlign: 'center' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigation = useNavigation();
  const { colors: COLORS } = useTheme();
  const { user: currentUser } = useSelector((s) => s.auth);

  const [pulses, setPulses]       = useState([]);
  const [userLoc, setUserLoc]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [nearby, setNearby]       = useState(null);
  const [sweepAngle, setSweepAngle] = useState(0);

  const watchRef      = useRef(null);
  const radarPollRef  = useRef(null);
  const nearbyPollRef = useRef(null);
  const sweepAnim     = useRef(new Animated.Value(0)).current;

  // ── Sweep animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: SWEEP_MS, easing: Easing.linear, useNativeDriver: true })
    );
    const id = sweepAnim.addListener(({ value }) => setSweepAngle(value * 360));
    loop.start();
    return () => { loop.stop(); sweepAnim.removeListener(id); };
  }, [sweepAnim]);

  const sweepRotate = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ── Location ─────────────────────────────────────────────────────────────
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

  // ── Geofence auto-enter ──────────────────────────────────────────────────
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

  // ── Pulses ───────────────────────────────────────────────────────────────
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

  // ── Nearby ───────────────────────────────────────────────────────────────
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

  const nearbyStatusLabel = () => {
    if (!nearby) return '';
    if (nearby.status === 'here') return t('hachi.youreHere');
    if (nearby.status === 'nearby') return t('hachi.nearby');
    return t('hachi.nearby');
  };

  const nearbyStatusColor = () => {
    if (!nearby) return COLORS.accent;
    if (nearby.status === 'here') return '#34C759';
    if (nearby.status === 'nearby') return '#FF9500';
    return COLORS.accent;
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.wordmark}>KUWAI</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileBtn} activeOpacity={0.7}>
          {currentUser?.profilePic
            ? <Image source={{ uri: currentUser.profilePic }} style={styles.profileAvatar} />
            : <View style={[styles.profileFallback, { backgroundColor: avatarBg(currentUser?.name) }]}>
                <Text style={styles.profileInitial}>{currentUser?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
          }
        </TouchableOpacity>
      </View>

      {/* Radar canvas */}
      <View style={styles.radarWrap}>
        <View style={{ width: RADAR_SIZE, height: RADAR_SIZE }}>

          {/* Static rings */}
          <Svg width={RADAR_SIZE} height={RADAR_SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Line x1={0} y1={RADAR_R} x2={RADAR_SIZE} y2={RADAR_R} stroke="#fff" strokeWidth={0.4} opacity={0.04} />
            <Line x1={RADAR_R} y1={0} x2={RADAR_R} y2={RADAR_SIZE} stroke="#fff" strokeWidth={0.4} opacity={0.04} />
            {[0.25, 0.5, 0.75, 1].map((f, i) => (
              <Circle key={i} cx={RADAR_R} cy={RADAR_R} r={RADAR_R * f - 1}
                fill="none" stroke="#fff" strokeWidth={i === 3 ? 1 : 0.5}
                opacity={i === 3 ? 0.15 : 0.06}
              />
            ))}
          </Svg>

          {/* Animated sweep */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: sweepRotate }] }]} pointerEvents="none">
            <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
              {/* Filled sector trail — overlapping paths from -70° to 0° (north) */}
              {[[-70, 0.012], [-50, 0.025], [-35, 0.045], [-20, 0.07], [-10, 0.11]].map(([deg, opacity], i) => {
                const r = RADAR_R - 4;
                const rad = deg * Math.PI / 180;
                const x1 = RADAR_R + r * Math.sin(rad);
                const y1 = RADAR_R - r * Math.cos(rad);
                return (
                  <Path
                    key={i}
                    d={`M ${RADAR_R} ${RADAR_R} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${RADAR_R} ${RADAR_R - r} Z`}
                    fill={`rgba(77,128,255,${opacity})`}
                  />
                );
              })}
              {/* Main sweep line */}
              <Line x1={RADAR_R} y1={RADAR_R} x2={RADAR_R} y2={2} stroke="#4D80FF" strokeWidth={2} opacity={1} />
            </Svg>
          </Animated.View>

          {/* Venue dots */}
          {pulses.map((pulse) => (
            <VenueDot
              key={pulse._id}
              pulse={pulse}
              userLoc={userLoc}
              sweepAngle={sweepAngle}
              onPress={() => handleDotPress(pulse)}
            />
          ))}

          {/* Center */}
          <View style={styles.centerRing} pointerEvents="none" />
          <View style={styles.centerDot} pointerEvents="none" />
        </View>

        {/* Status */}
        <Text style={styles.statusLine}>
          {loading ? '· · ·' : isRTL ? `${pulses.length} دوائر نشطة` : `${pulses.length} active circles`}
        </Text>
      </View>

      {/* Nearby card */}
      {nearby && (
        <TouchableOpacity
          style={[styles.nearbyCard, { bottom: insets.bottom + 20, backgroundColor: COLORS.surface }]}
          onPress={handleNearbyTap}
          activeOpacity={0.85}
        >
          <View style={[styles.nearbyInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {/* Left: status + name + distance */}
            <View style={{ flex: 1 }}>
              <View style={[styles.statusRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.statusDot, { backgroundColor: nearbyStatusColor() }]} />
                <Text style={[styles.statusLabel, { color: nearbyStatusColor() }]}>
                  {nearbyStatusLabel()}
                </Text>
              </View>
              <Text style={[styles.nearbyName, { color: COLORS.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                {nearby.title || nearby.venueName}
              </Text>
              {nearby.distance > 0 && (
                <Text style={[styles.nearbyDist, { color: COLORS.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>
                  {formatDist(nearby.distance, isRTL)}
                </Text>
              )}
            </View>

            {/* Right: count + arrow */}
            <View style={[styles.nearbyRight, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
              {(nearby.activeHere || 0) > 0 && (
                <View style={styles.hereNowPill}>
                  <View style={styles.hereNowDot} />
                  <Text style={styles.hereNowText}>
                    {nearby.activeHere} {t('radar.hereNow')}
                  </Text>
                </View>
              )}
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={COLORS.textMuted}
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14', alignItems: 'center' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 10, zIndex: 20,
    alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  profileAvatar: { width: '100%', height: '100%' },
  profileFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },

  radarWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  centerDot: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#4D80FF',
    top: RADAR_R - 5, left: RADAR_R - 5,
    zIndex: 10,
    shadowColor: '#4D80FF', shadowOpacity: 0.8, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  centerRing: {
    position: 'absolute',
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(77,128,255,0.4)',
    top: RADAR_R - 13, left: RADAR_R - 13,
    zIndex: 9,
  },

  statusLine: {
    marginTop: 20,
    fontSize: 12, fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
  },

  // Nearby card
  nearbyCard: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 8,
  },
  nearbyInner: { alignItems: 'center', gap: 12 },
  statusRow: { alignItems: 'center', gap: 6, marginBottom: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  nearbyName: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  nearbyDist: { fontSize: 13, fontWeight: '400', marginTop: 2 },
  nearbyRight: { justifyContent: 'center', paddingStart: 4 },
  hereNowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  hereNowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  hereNowText: { fontSize: 12, fontWeight: '600', color: '#34C759' },
});
