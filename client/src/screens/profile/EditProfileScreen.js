import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  Alert, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from '../../store/slices/authSlice';
import { uploadAPI } from '../../services/api';
import {
  BrutNav, BrutHero, BrutRule, BrutInput, useBrutColors, isAr, ls, shout,
} from '../../components/Brut';
import { Ionicons } from '@expo/vector-icons';

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s) => s.auth);
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { ACCENT, BG, MUTED, FILL } = useBrutColors();

  const [name, setName] = useState(user?.name || '');
  const [avatarUri, setAvatarUri] = useState(null); // local URI after picking
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), ar ? 'نحتاج إذن الصور' : 'Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setAvatarUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('profile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      let profilePic = user?.profilePic;

      if (avatarUri) {
        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('image', {
          uri: avatarUri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });
        const res = await uploadAPI.profilePic(formData);
        profilePic = res.url;
        setUploadingAvatar(false);
      }

      await dispatch(updateProfile({ name: name.trim(), profilePic })).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('profile.updateError'));
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const displayAvatar = avatarUri || user?.profilePic;
  const busy = saving || uploadingAvatar;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BrutNav
        onBack={() => navigation.goBack()}
        leftLabel={t('common.cancel')}
        right={
          <TouchableOpacity onPress={handleSave} disabled={busy || !name.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[
              styles.saveLink, { color: ACCENT },
              (busy || !name.trim()) && { opacity: 0.35 },
              { letterSpacing: ls(2, ar) },
            ]}>
              {busy ? '...' : shout(t('common.save'), ar)}
            </Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <BrutHero title={t('profile.editProfile')} label={ar ? 'تعديل' : 'IDENTITY'} />
        <BrutRule mt={26} mb={26} />

        {/* Avatar picker */}
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8} disabled={busy}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: FILL }]}>
              <Ionicons name="person" size={40} color={MUTED} />
            </View>
          )}
          <View style={[styles.editBadge, { backgroundColor: ACCENT }]}>
            {uploadingAvatar
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera" size={14} color="#fff" />
            }
          </View>
        </TouchableOpacity>

        <BrutRule mt={28} mb={26} />

        <BrutInput
          label={t('profile.namePlaceholder') || (ar ? 'الاسم' : 'NAME')}
          value={name}
          onChangeText={setName}
          placeholder={ar ? 'اسمك' : 'Your name'}
          maxLength={40}
          autoCapitalize="words"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  saveLink: { fontSize: 12, fontWeight: '900' },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: 8,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
});
