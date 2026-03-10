import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { updateProfile } from '../../store/slices/authSlice';
import { uploadAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = ['#0033A0', '#007A3D', '#FF6B35', '#2196F3', '#9C27B0', '#00BCD4', '#FF9800'];
function avatarBg(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s) => s.auth);
  const { t } = useTranslation();
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profilePicUri, setProfilePicUri] = useState(user?.profilePic || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // pendingPicUrl is the Cloudinary URL after upload, null = no change
  const [pendingPicUrl, setPendingPicUrl] = useState(null);

  const isLoading = isUploading || isSaving;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('post.permRequired'), t('post.photoPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setProfilePicUri(asset.uri); // show preview immediately
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });
      const res = await uploadAPI.profilePic(formData);
      setPendingPicUrl(res.url);
    } catch {
      Alert.alert(t('common.error'), t('profile.uploadError'));
      // revert preview
      setProfilePicUri(user?.profilePic || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('profile.nameRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const payload = { name: name.trim(), bio: bio.trim() };
      if (pendingPicUrl) payload.profilePic = pendingPicUrl;
      await dispatch(updateProfile(payload)).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('profile.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerSide}
        >
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('profile.editProfile')}</Text>

        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading || !name.trim()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.saveBtn, (isLoading || !name.trim()) && styles.saveBtnDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Text style={[styles.saveText, (isLoading || !name.trim()) && styles.saveTextDisabled]}>
                {t('common.save')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ───────────────────────────────────────────── */}
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={pickImage}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            {profilePicUri ? (
              <Image source={{ uri: profilePicUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: avatarBg(user?.name) }]}>
                <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}

            {/* Camera badge */}
            <View style={styles.cameraBadge}>
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>
            {isUploading ? 'جاري الرفع...' : 'تغيير الصورة'}
          </Text>
        </View>

        {/* NAME */}
        <Text style={styles.sectionLabel}>{t('profile.nameSection')}</Text>
        <View style={styles.sectionCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('profile.fullName')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* BIO */}
        <Text style={styles.sectionLabel}>{t('profile.bioSection')}</Text>
        <View style={styles.sectionCard}>
          <View style={[styles.fieldRow, styles.fieldRowNoBorder]}>
            <Text style={styles.fieldLabel}>{t('profile.aboutYou')}</Text>
            <TextInput
              style={[styles.fieldInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder={t('profile.bioPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={160}
              textAlignVertical="top"
            />
          </View>
        </View>
        <Text style={styles.charCounter}>{bio.length}/160</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },

  // ── Header
  header: {
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.separator,
  },
  headerSide: { width: 72 },
  cancelText: { fontSize: 16, color: C.accent },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  saveBtn: { alignItems: 'flex-end' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, fontWeight: '600', color: C.accent },
  saveTextDisabled: { color: C.accent },

  // ── Body
  body: { flex: 1 },

  // ── Avatar picker
  avatarSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.accent,
  },

  // ── Section label
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.2,
  },

  // ── Section card
  sectionCard: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Field row
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
  fieldRowNoBorder: { borderTopWidth: 0 },
  fieldLabel: { fontSize: 13, color: C.textMuted, marginBottom: 4 },
  fieldInput: { fontSize: 16, color: C.text, padding: 0 },
  bioInput: { minHeight: 80 },
  charCounter: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'right',
    marginRight: 20,
    marginTop: 4,
  },
});
