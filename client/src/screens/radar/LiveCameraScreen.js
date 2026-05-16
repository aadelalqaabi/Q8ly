import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { uploadAPI } from '../../services/api';
import { sendHachiMessage } from '../../services/socket';
let Location = null;
try { Location = require('expo-location'); } catch {}

export default function LiveCameraScreen({ route, navigation }) {
  const { circleId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const camRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [captured, setCaptured] = useState(null); // local URI of captured photo
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  if (!permission || !permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color="#fff" />
        <Text style={styles.permissionText}>{t('radar.cameraPermission')}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>{t('radar.grantPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      setCaptured(photo.uri);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setBusy(false); }
  };

  const handleSend = async () => {
    if (!captured || busy) return;
    setBusy(true);
    try {
      // Upload via existing image upload endpoint
      const formData = new FormData();
      formData.append('images', {
        uri: captured,
        name: `live-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      const res = await uploadAPI.images(formData);
      const url = res.urls?.[0];
      if (!url) throw new Error('Upload failed');

      // Get current location and send via socket
      let loc = null;
      if (Location) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
        } catch {}
      }
      // Send as image message — extend hachiSendImage payload
      const { getSocket } = require('../../services/socket');
      const socket = getSocket();
      if (socket) {
        socket.emit('hachiSendImage', { roomId: circleId, imageUrl: url, isLive: true, ...(loc || {}) });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Send failed');
    } finally { setBusy(false); }
  };

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));

  if (captured) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Image source={{ uri: captured }} style={{ flex: 1 }} resizeMode="contain" />
        <View style={[styles.previewControls, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={() => setCaptured(null)} style={styles.iconBtn}>
            <Ionicons name="close" size={28} color="#fff" />
            <Text style={styles.iconBtnLabel}>{t('radar.retake')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSend} disabled={busy} style={styles.sendBtn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={26} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{t('radar.liveOnly')}</Text>
        </View>
      </View>
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        <View style={{ width: 44 }} />
        <TouchableOpacity onPress={handleCapture} style={styles.shutterOuter} disabled={busy}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>
        <TouchableOpacity onPress={flip} style={styles.iconBtn}>
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: { fontSize: 16, color: '#fff', marginVertical: 18, textAlign: 'center' },
  permBtn: { backgroundColor: '#4D80FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 22 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  iconBtn: { padding: 10, alignItems: 'center' },
  iconBtnLabel: { fontSize: 11, color: '#fff', marginTop: 2 },
  shutterOuter: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  previewControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  sendBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#4D80FF',
    justifyContent: 'center', alignItems: 'center',
  },
});
