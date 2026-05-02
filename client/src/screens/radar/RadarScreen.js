import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated,
  Easing, Platform, Alert, Dimensions, Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { hachiAPI } from '../../services/api';
let Location = null;
try { Location = require('expo-location'); } catch {}

const { width: SW, height: SH } = Dimensions.get('window');

// Default to Kuwait City when no user location
const KUWAIT_REGION = {
  latitude: 29.3759,
  longitude: 47.9774,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

// Dark map style — minimal, navigation-free
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#1a2440' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f1628' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000714' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
];

function HeatPulse({ pulse, onPress }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const intensity = pulse.intensity || 0.3;
  const size = 16 + intensity * 16; // 16-32

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: size * 2.2,
            height: size * 2.2,
            borderRadius: size * 1.1,
            backgroundColor: '#4D80FF',
            opacity,
            transform: [{ scale }],
          }}
        />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#4D80FF',
            shadowColor: '#4D80FF',
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {pulse.activeHere > 0 && (
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{pulse.activeHere}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user: currentUser } = useSelector((s) => s.auth);
  const [pulses, setPulses] = useState([]);
  const [region, setRegion] = useState(KUWAIT_REGION);
  const [userLoc, setUserLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(true);
  const watchRef = useRef(null);
  const mapRef = useRef(null);
  const radarPollRef = useRef(null);

  // Location watch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Location) return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('radar.locationNeeded'), t('radar.locationNeededMsg'));
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
        setUserLoc(loc);
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: loc.lat, longitude: loc.lng,
            latitudeDelta: 0.05, longitudeDelta: 0.05,
          }, 600);
        }
        // Continuous watch for geofence detection
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 8000 },
          (p) => {
            const next = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed };
            setUserLoc(next);
          }
        );
      } catch (e) { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      if (watchRef.current) watchRef.current.remove();
    };
  }, []);

  // Auto-detect when user enters a venue's geofence → navigate to circle
  const checkGeofence = useCallback(async (loc) => {
    if (!loc) return;
    // Find any pulse the user is inside (within ~80-400m depending on venue)
    for (const p of pulses) {
      const dist = haversineMeters(loc.lat, loc.lng, p.lat, p.lng);
      // Use a generous default check (200m) — server will do precise confidence check
      if (dist < 200) {
        try {
          const result = await hachiAPI.checkLocation(p._id, loc.lat, loc.lng, loc.speed || 0);
          if (result.status === 'here') {
            navigation.navigate('Circle', { circleId: p._id });
            return;
          }
        } catch {}
      }
    }
  }, [pulses, navigation]);

  // Fetch radar pulses + auto-refresh every 30s
  const fetchPulses = useCallback(async () => {
    try {
      const res = await hachiAPI.getRadar();
      setPulses(res.pulses || []);
    } catch (e) { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchPulses();
    radarPollRef.current = setInterval(fetchPulses, 30000);
    return () => clearInterval(radarPollRef.current);
  }, [fetchPulses]);

  // Run geofence check when location changes
  useEffect(() => {
    if (userLoc && pulses.length > 0) checkGeofence(userLoc);
  }, [userLoc, pulses, checkGeofence]);

  const handleRecenter = () => {
    if (!userLoc || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: userLoc.lat, longitude: userLoc.lng,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 600);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={KUWAIT_REGION}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        loadingEnabled={false}
        rotateEnabled={true}
        pitchEnabled={false}
      >
        {pulses.map((pulse) => (
          <Marker
            key={pulse._id}
            coordinate={{ latitude: pulse.lat, longitude: pulse.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <HeatPulse
              pulse={pulse}
              onPress={() => {
                Alert.alert(t('radar.travelThere'), t('radar.travelThereMsg'));
              }}
            />
          </Marker>
        ))}
      </MapView>

      {/* Top header — wordmark left, profile right */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{t('radar.title')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {currentUser?.profilePic ? (
            <Image source={{ uri: currentUser.profilePic }} style={styles.profileAvatar} />
          ) : (
            <View style={styles.profileFallback}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Floating action: Request location */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => navigation.navigate('RequestLocation', { initialCoords: userLoc })}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#0a0e1a" />
      </TouchableOpacity>

      {/* Recenter */}
      <TouchableOpacity
        style={[styles.recenter, { bottom: insets.bottom + 24 }]}
        onPress={handleRecenter}
        activeOpacity={0.7}
      >
        <Ionicons name="locate" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Pulse count indicator — moved below header */}
      {!loading && (
        <View style={[styles.pulseBadge, { top: insets.top + 64 }]}>
          <View style={styles.pulseDot} />
          <Text style={styles.pulseBadgeText}>
            {pulses.length} {t('radar.live')}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4D80FF" />
        </View>
      )}
    </View>
  );
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  profileAvatar: { width: '100%', height: '100%' },
  profileFallback: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(20,28,50,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  pulseBadge: {
    position: 'absolute', left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,28,50,0.85)',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(77,128,255,0.3)',
  },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4D80FF',
    shadowColor: '#4D80FF', shadowOpacity: 0.9, shadowRadius: 4,
  },
  pulseBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute', right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#4D80FF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4D80FF', shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  recenter: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(20,28,50,0.85)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(10,14,26,0.6)',
  },
});
