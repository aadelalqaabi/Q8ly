import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { updateProfile } from '../../store/slices/authSlice';
import {
  BrutNav, BrutHero, BrutRule, BrutInput, BG, ACCENT, isAr, ls, shout,
} from '../../components/Brut';

export default function EditProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useSelector((s) => s.auth);
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('profile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      await dispatch(updateProfile({ name: name.trim() })).unwrap();
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e.message || t('profile.updateError'));
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BrutNav
        onBack={() => navigation.goBack()}
        leftLabel={t('common.cancel')}
        right={
          <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[
              styles.saveLink,
              (saving || !name.trim()) && { opacity: 0.35 },
              { letterSpacing: ls(2, ar) },
            ]}>
              {saving ? '...' : shout(t('common.save'), ar)}
            </Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <BrutHero title={t('profile.editProfile')} label={ar ? 'تعديل' : 'IDENTITY'} />
        <BrutRule mt={26} mb={26} />
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
  saveLink: { fontSize: 12, fontWeight: '900', color: ACCENT },
});
