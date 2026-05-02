import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { sendOtp, clearError } from '../../store/slices/authSlice';
import {
  BrutHero, BrutRule, BrutBrick, BG, TEXT, MUTED, ACCENT, SEPARATOR, isAr, ls, shout,
} from '../../components/Brut';

export default function PhoneScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.inner, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>
        <View>
          <BrutHero title={t('auth.phoneTitle')} label="01 / 02" size={42} />
          <BrutRule mt={24} mb={28} />

          <Text style={[styles.label, { letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
            {shout(t('auth.phoneSub'), ar)}
          </Text>

          {/* Brutalist phone input — flat 2pt baseline, +965 prefix */}
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.inputRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={styles.prefix}>+965</Text>
            <View style={styles.divider} />
            <TextInput
              ref={inputRef}
              style={[styles.phoneInput, { textAlign: ar ? 'right' : 'left' }]}
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
          <View style={styles.inputUnderline} />

          {!!error && (
            <Text style={[styles.error, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
              {shout(error, ar)}
            </Text>
          )}
        </View>

        <View>
          <BrutBrick
            label={t('auth.continue')}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
            loading={isLoading}
            accent
          />
          <Text style={[styles.legal, { textAlign: 'center' }]}>
            {t('auth.termsPrefix')}{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('Terms')}>{t('auth.terms')}</Text>
            {' '}{t('auth.and')}{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('Terms')}>{t('auth.privacy')}</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },

  label: { fontSize: 11, fontWeight: '800', color: MUTED, marginBottom: 12 },

  inputRow: { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  prefix: { fontSize: 26, fontWeight: '900', color: TEXT, paddingRight: 12, paddingLeft: 0 },
  divider: { width: 2, height: 28, backgroundColor: TEXT, marginHorizontal: 6 },
  phoneInput: {
    flex: 1, fontSize: 26, fontWeight: '700', color: TEXT,
    paddingVertical: 6, fontVariant: ['tabular-nums'],
  },
  inputUnderline: { height: 2, backgroundColor: TEXT, marginTop: 4 },

  error: { fontSize: 11, fontWeight: '800', color: '#D32F2F', marginTop: 14 },

  legal: { fontSize: 11, color: MUTED, marginTop: 20, lineHeight: 18 },
  legalLink: { color: ACCENT, fontWeight: '800' },
});
