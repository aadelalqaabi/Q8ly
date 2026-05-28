import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { locationRequestsAPI } from '../../services/api';
import {
  BrutNav, BrutHero, BrutRule, BrutInput, useBrutColors, isAr, ls, shout,
} from '../../components/Brut';

const KUWAIT_REGION = {
  latitude: 29.3759,
  longitude: 47.9774,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

export default function RequestLocationScreen({ route, navigation }) {
  const { initialCoords } = route.params || {};
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, ACCENT, BG } = useBrutColors();

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
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BrutNav
        onBack={() => navigation.goBack()}
        leftLabel={t('common.cancel')}
        right={
          <TouchableOpacity onPress={submit} disabled={submitting || !name.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[
              styles.submitLink, { color: ACCENT },
              (submitting || !name.trim()) && { opacity: 0.35 },
              { letterSpacing: ls(2, ar) },
            ]}>
              {submitting ? '...' : shout(t('radar.submit'), ar)}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.body}>
        <BrutHero title={t('radar.requestTitle')} label={ar ? 'مكان جديد' : 'NEW PLACE'} size={42} />
        <BrutRule mt={22} mb={20} />

        {/* Map */}
        <View style={[styles.mapWrap, { borderColor: TEXT }]}>
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={
              initialCoords
                ? { latitude: initialCoords.lat, longitude: initialCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                : KUWAIT_REGION
            }
            onPress={(e) => setPin(e.nativeEvent.coordinate)}
            showsUserLocation
            showsMyLocationButton={false}
          >
            <Marker coordinate={pin} draggable onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}>
              <View style={[styles.pinDot, { backgroundColor: ACCENT }]} />
            </Marker>
          </MapView>
          <View pointerEvents="none" style={[styles.mapHint, { backgroundColor: TEXT }]}>
            <Text style={[styles.mapHintText, { letterSpacing: ls(1.5, ar) }]}>
              {shout(t('radar.tapToPin'), ar)}
            </Text>
          </View>
        </View>

        <View style={{ paddingTop: 20 }}>
          <BrutInput
            label={t('radar.placeName')}
            value={name}
            onChangeText={setName}
            placeholder={t('radar.placeNamePlaceholder')}
            maxLength={80}
            autoCapitalize="words"
            accent
          />
          <BrutInput
            label={t('radar.noteOptional')}
            value={note}
            onChangeText={setNote}
            placeholder={t('radar.notePlaceholder')}
            multiline
            maxLength={200}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24 },
  submitLink: { fontSize: 12, fontWeight: '900' },
  mapWrap: { height: 260, borderWidth: 2, overflow: 'hidden' },
  mapHint: { position: 'absolute', top: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  mapHintText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  pinDot: { width: 22, height: 22, borderWidth: 3, borderColor: '#fff' },
});
