import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Dimensions, Image, PixelRatio,
} from 'react-native';
import MapView, { UrlTile, Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { hachiAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: SW, height: SH } = Dimensions.get('window');

// Kuwait — center + tight bounds
const KUWAIT_REGION = {
  latitude:      29.3,
  longitude:     47.65,
  latitudeDelta: 1.85,
  longitudeDelta: 1.85,
};

// Big bounding box for the fog polygon (well outside Kuwait)
const FOG_BOX = [
  { latitude: 24, longitude: 43 },
  { latitude: 24, longitude: 52 },
  { latitude: 33, longitude: 52 },
  { latitude: 33, longitude: 43 },
];

const REVEAL_RADIUS_M = 650; // metres revealed around each visited venue

// Generate a circle polygon (array of LatLng) around a point
function circlePolygon(lat, lng, radiusM, steps = 36) {
  const R = 6371000;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM * Math.cos(angle)) / R * (180 / Math.PI);
    const dLng = (radiusM * Math.sin(angle)) / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);
    pts.push({ latitude: lat + dLat, longitude: lng + dLng });
  }
  return pts;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m, ar) {
  if (m == null) return '';
  if (m < 1000) return ar ? `${Math.round(m)} م` : `${Math.round(m)} m`;
  return ar ? `${(m / 1000).toFixed(1)} كم` : `${(m / 1000).toFixed(1)} km`;
}

function cdnUrl(url, px) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const w = PixelRatio.getPixelSizeForLayoutSize(px);
  return url.replace('/upload/', `/upload/w_${w},h_${w},c_fit,f_webp,q_auto:good/`);
}

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function RadarScreen() {
  const insets       = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL        = i18n.language === 'ar';
  const navigation   = useNavigation();
  const { colors: COLORS } = useTheme();
  const { user: currentUser } = useSelector((s) => s.auth);

  const [venues, setVenues]   = useState([]);   // from vault — has visited + stampUrl + lat/lng
  const [userLoc, setUserLoc] = useState(null);
  const [nearby, setNearby]   = useState(null);

  const watchRef      = useRef(null);
  const nearbyPollRef = useRef(null);

  // ── Load venues from vault ────────────────────────────────────────────────
  const loadVenues = useCallback(async () => {
    try {
      const res = await hachiAPI.getVault();
      setVenues((res.items || []).filter(v => v.lat != null && v.lng != null));
    } catch {}
  }, []);

  useEffect(() => { loadVenues(); }, [loadVenues]);

  // ── Location ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Location) return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed });
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 8000 },
          (p) => { if (!cancelled) setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed }); }
        );
      } catch {}
    })();
    return () => { cancelled = true; if (watchRef.current) watchRef.current.remove(); };
  }, []);

  // ── Nearby card ───────────────────────────────────────────────────────────
  const fetchNearby = useCallback(async (loc) => {
    if (!loc) return;
    try { const res = await hachiAPI.getNearby(loc.lat, loc.lng, 5000); setNearby(res.circle || null); }
    catch {}
  }, []);

  useEffect(() => {
    fetchNearby(userLoc);
    clearInterval(nearbyPollRef.current);
    nearbyPollRef.current = setInterval(() => fetchNearby(userLoc), 30000);
    return () => clearInterval(nearbyPollRef.current);
  }, [userLoc, fetchNearby]);

  // ── Auto-enter geofence ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userLoc || venues.length === 0) return;
    (async () => {
      for (const v of venues) {
        if (haversineMeters(userLoc.lat, userLoc.lng, v.lat, v.lng) < 250) {
          try {
            const r = await hachiAPI.checkLocation(v._id, userLoc.lat, userLoc.lng, userLoc.speed || 0);
            if (r.status === 'here') { navigation.navigate('Circle', { circleId: v._id }); return; }
          } catch {}
        }
      }
    })();
  }, [userLoc, venues, navigation]);

  const handleVenueTap = async (venue) => {
    if (!venue.visited) {
      Alert.alert(
        venue.title,
        isRTL ? 'توجه إلى هذا المكان لتفتحه' : 'Visit this place to unlock it',
      );
      return;
    }
    try {
      const r = await hachiAPI.checkLocation(venue._id, userLoc?.lat ?? 0, userLoc?.lng ?? 0, userLoc?.speed ?? 0);
      if (r.status === 'here') { navigation.navigate('Circle', { circleId: venue._id }); return; }
    } catch {}
    navigation.navigate('Circle', { circleId: venue._id });
  };

  const handleNearbyTap = async () => {
    if (!nearby) return;
    if (nearby.status === 'here') { navigation.navigate('Circle', { circleId: nearby._id }); return; }
    try {
      const r = await hachiAPI.checkLocation(nearby._id, userLoc?.lat ?? 0, userLoc?.lng ?? 0, userLoc?.speed ?? 0);
      if (r.status === 'here') { navigation.navigate('Circle', { circleId: nearby._id }); return; }
    } catch {}
    Alert.alert(t('radar.travelThere'), t('radar.travelThereMsg'));
  };

  // Holes in the fog = one circle polygon per visited venue
  const fogHoles = venues
    .filter(v => v.visited && v.lat != null && v.lng != null)
    .map(v => circlePolygon(v.lat, v.lng, REVEAL_RADIUS_M));

  const nearbyStatusColor = () => {
    if (!nearby) return COLORS.accent;
    if (nearby.status === 'here') return '#34C759';
    if (nearby.status === 'nearby') return '#FF9500';
    return COLORS.accent;
  };

  const nearbyStatusLabel = () => {
    if (!nearby) return '';
    if (nearby.status === 'here') return t('hachi.youreHere');
    return t('hachi.nearby');
  };

  return (
    <View style={styles.container}>

      {/* ── Full-screen Map ── */}
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={KUWAIT_REGION}
        region={KUWAIT_REGION}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        showsIndoors={false}
        mapType="mutedStandard"
      >
        {/* CartoDB Dark Matter tiles */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
          maximumZ={14}
          flipY={false}
          tileSize={256}
        />

        {/* Fog of war — dark overlay with holes at visited venues */}
        {fogHoles.length >= 0 && (
          <Polygon
            coordinates={FOG_BOX}
            holes={fogHoles}
            fillColor="rgba(6,8,14,0.88)"
            strokeWidth={0}
          />
        )}

        {/* Venue markers */}
        {venues.map((v) => (
          v.visited ? (
            // Visited — stamp image marker
            <Marker
              key={v._id}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => handleVenueTap(v)}
            >
              <View style={styles.stampMarker}>
                {v.stampUrl ? (
                  <Image
                    source={{ uri: cdnUrl(v.stampUrl, 44) }}
                    style={styles.stampImg}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.stampFallback, { backgroundColor: COLORS.accent }]}>
                    <Text style={styles.stampFallbackText}>{v.title?.[0] || '?'}</Text>
                  </View>
                )}
              </View>
            </Marker>
          ) : (
            // Unvisited — faint dot
            <Marker
              key={v._id}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => handleVenueTap(v)}
            >
              <View style={styles.dimDot} />
            </Marker>
          )
        ))}
      </MapView>

      {/* ── Header ── */}
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

      {/* ── Nearby card ── */}
      {nearby && (
        <TouchableOpacity
          style={[styles.nearbyCard, { bottom: insets.bottom + 20, backgroundColor: COLORS.surface }]}
          onPress={handleNearbyTap}
          activeOpacity={0.85}
        >
          <View style={[styles.nearbyInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.statusDot, { backgroundColor: nearbyStatusColor() }]} />
                <Text style={[styles.statusLabel, { color: nearbyStatusColor() }]}>{nearbyStatusLabel()}</Text>
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
            <View style={[styles.nearbyRight, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
              {(nearby.activeHere || 0) > 0 && (
                <View style={styles.hereNowPill}>
                  <View style={styles.hereNowDot} />
                  <Text style={styles.hereNowText}>{nearby.activeHere} {t('radar.hereNow')}</Text>
                </View>
              )}
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={COLORS.textMuted} style={{ marginTop: 4 }} />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06080E' },

  // Header
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

  // Stamp marker
  stampMarker: {
    width: 46, height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#fff',
    backgroundColor: '#111',
    shadowColor: '#fff',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  stampImg: { width: '100%', height: '100%' },
  stampFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stampFallbackText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Unvisited dim dot
  dimDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  // Nearby card
  nearbyCard: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 20, elevation: 10,
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
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  hereNowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  hereNowText: { fontSize: 12, fontWeight: '600', color: '#34C759' },
});
