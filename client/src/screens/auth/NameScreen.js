import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../store/slices/authSlice';
import {
  BrutHero, BrutRule, BrutInput, BrutBrick, useBrutColors, isAr,
} from '../../components/Brut';

export default function NameScreen() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { BG } = useBrutColors();
  const { isLoading } = useSelector((s) => s.auth);
  const [name, setName] = useState('');

  const isValid = name.trim().length >= 2;

  const handleJoin = async () => {
    if (!isValid || isLoading) return;
    await dispatch(updateProfile({ name: name.trim() }));
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.inner, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 28 }]}>
        <View>
          <BrutHero title={t('auth.nameTitle')} label="03 / 03" size={42} />
          <BrutRule mt={24} mb={28} />
          <BrutInput
            label={t('auth.namePlaceholder')}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.namePlaceholder')}
            autoCapitalize="words"
            maxLength={50}
            autoFocus
            accent
          />
        </View>
        <BrutBrick
          label={t('auth.join')}
          onPress={handleJoin}
          disabled={!isValid || isLoading}
          loading={isLoading}
          accent
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
});
