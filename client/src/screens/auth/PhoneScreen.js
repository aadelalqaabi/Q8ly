import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { sendOtp, clearError } from '../../store/slices/authSlice';
import { BrutHero, BrutBrick, useBrutColors, isAr } from '../../components/Brut';

export default function PhoneScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, BG, FILL, SEPARATOR, CARD } = useBrutColors();
  const { isLoading, error } = useSelector((s) => s.auth);
  const [phone, setPhone] = useState('');
  const inputRef = useRef(null);

  const formatDisplay = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  };

  const handleChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    setPhone(digits);
    if (error) dispatch(clearError());
  };

  const fullPhone = `+965${phone}`;
  const isValid = phone.length === 8;

  const handleContinue = async () => {
    if (!isValid) return;
    const result = await dispatch(sendOtp(fullPhone));
    if (result.meta.requestStatus === 'fulfilled') {
      navigation.navigate('OtpVerify', {
        phone: fullPhone,
        isNewUser: result.payload.isNewUser,
        testMode: result.payload.testMode,
      });
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.inner, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <View>
          <BrutHero title={t('auth.phoneTitle')} label={t('auth.phoneSub')} size={38} />
          <View style={{ height: 28 }} />

          <TouchableOpacity
            activeOpacity={1}
            style={[styles.inputCard, { backgroundColor: CARD, borderColor: SEPARATOR, flexDirection: ar ? 'row-reverse' : 'row' }]}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={[styles.prefix, { color: MUTED }]}>+965</Text>
            <View style={[styles.divider, { backgroundColor: SEPARATOR }]} />
            <TextInput
              ref={inputRef}
              style={[styles.phoneInput, { color: TEXT, textAlign: ar ? 'right' : 'left' }]}
              value={formatDisplay(phone)}
              onChangeText={handleChange}
              keyboardType="phone-pad"
              placeholder="0000 0000"
              placeholderTextColor={MUTED}
              maxLength={9}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </TouchableOpacity>

          {!!error && (
            <Text style={[styles.error, { textAlign: ar ? 'right' : 'left' }]}>
              {error}
            </Text>
          )}
        </View>

        <View style={{ gap: 16 }}>
          <BrutBrick
            label={t('auth.continue')}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
            loading={isLoading}
            accent
          />
          <Text style={[styles.legal, { color: MUTED, textAlign: 'center' }]}>
            {t('auth.termsPrefix')}{' '}
            <Text style={[styles.legalLink, { color: ACCENT }]} onPress={() => navigation.navigate('Terms')}>{t('auth.terms')}</Text>
            {' '}{t('auth.and')}{' '}
            <Text style={[styles.legalLink, { color: ACCENT }]} onPress={() => navigation.navigate('Terms')}>{t('auth.privacy')}</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  inputCard: {
    alignItems: 'center',
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 18, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  prefix: { fontSize: 20, fontWeight: '500', paddingVertical: 14 },
  divider: { width: StyleSheet.hairlineWidth, height: 28, marginHorizontal: 14 },
  phoneInput: { flex: 1, fontSize: 24, fontWeight: '500', paddingVertical: 14, fontVariant: ['tabular-nums'] },
  error: { fontSize: 13, fontWeight: '500', color: '#D32F2F', marginTop: 12 },
  legal: { fontSize: 12, lineHeight: 18 },
  legalLink: { fontWeight: '600' },
});
