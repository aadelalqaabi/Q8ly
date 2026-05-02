import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { locationRequestsAPI } from '../../services/api';

const KUWAIT_REGION = {
  latitude: 29.3759,
  longitude: 47.9774,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3a4880' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f1628' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000714' }] },
];

export default function RequestLocationScreen({ route, navigation }) {
  const { initialCoords } = route.params || {};
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [pin, setPin] = useState(
    initialCoords
      ? { latitude: initialCoords.lat, longitude: initialCoords.lng }
      : { latitude: KUWAIT_REGION.latitude, longitude: KUWAIT_REGION.longitude }
  );
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(t('radar.requestNameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await locationRequestsAPI.create(name.trim(), pin.latitude, pin.longitude, note.trim());
      Alert.alert(t('radar.requestSent'), t('radar.requestSentMsg'));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('radar.requestTitle')}</Text>
        <TouchableOpacity onPress={submit} disabled={submitting || !name.trim()}>
          <Text style={[styles.submitBtn, (submitting || !name.trim()) && { opacity: 0.4 }]}>
            {submitting ? '...' : t('radar.submit')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={
            initialCoords
              ? { latitude: initialCoords.lat, longitude: initialCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              : KUWAIT_REGION
          }
          customMapStyle={DARK_MAP_STYLE}
          onPress={(e) => setPin(e.nativeEvent.coordinate)}
          showsUserLocation
        >
          <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}>
            <View style={styles.pinDot} />
          </Marker>
        </MapView>
        <View pointerEvents="none" style={styles.mapHintWrap}>
          <Text style={styles.mapHint}>{t('radar.tapToPin')}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t('radar.placeName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('radar.placeNamePlaceholder')}
          placeholderTextColor="#6c7a99"
          maxLength={80}
        />
        <Text style={[styles.label, { marginTop: 16 }]}>{t('radar.noteOptional')}</Text>
        <TextInput
          style={[styles.input, { height: 64 }]}
          value={note}
          onChangeText={setNote}
          placeholder={t('radar.notePlaceholder')}
          placeholderTextColor="#6c7a99"
          multiline
          maxLength={200}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#fff' },
  submitBtn: { paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: '#4D80FF' },
  mapWrap: { height: 280, position: 'relative' },
  mapHintWrap: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  mapHint: { color: '#fff', fontSize: 12, fontWeight: '600' },
  pinDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4D80FF',
    borderWidth: 3, borderColor: '#fff',
  },
  form: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#6c7a99', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#fff',
  },
});
