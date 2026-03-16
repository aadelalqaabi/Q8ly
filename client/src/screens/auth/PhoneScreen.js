import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, I18nManager,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { sendOtp, clearError, enterGuestMode } from '../../store/slices/authSlice';
import { useTheme } from '../../context/ThemeContext';

export default function PhoneScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: C, isDark } = useTheme();
  const { isLoading, error } = useSelector((s) => s.auth);
  const handleGuest = () => dispatch(enterGuestMode());
  const [phone, setPhone] = useState('');
  const inputRef = useRef(null);

  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const formatDisplay = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  };

  const handleChangeText = (text) => {
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

  const TRUST_ITEMS = [
    { icon: 'lock-closed-outline', key: 'trustSecure' },
    { icon: 'shield-checkmark-outline', key: 'trustKuwait' },
    { icon: 'key-outline', key: 'trustNoPassword' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>

        {/* Wordmark */}
        <View style={styles.logoWrap}>
          <Text style={styles.wordmark}>KUWAI</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* Trust pills */}
        <View style={styles.trustRow}>
          {TRUST_ITEMS.map(({ icon, key }) => (
            <View key={key} style={styles.trustPill}>
              <Ionicons name={icon} size={12} color={C.accent} />
              <Text style={styles.trustText}>{t(`auth.${key}`)}</Text>
            </View>
          ))}
        </View>

        {/* Step progress */}
        <View style={styles.stepRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.stepSeg, i === 0 && styles.stepSegActive, i < 2 && styles.stepGap]}
            />
          ))}
        </View>

        {/* Heading */}
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.phoneTitle')}</Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.phoneSub')}</Text>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Phone input */}
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.inputCard, isValid && styles.inputCardActive]}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={styles.prefix}>
            <Text style={styles.prefixFlag}>🇰🇼</Text>
            <Text style={styles.prefixCode}>+965</Text>
          </View>
          <View style={styles.divider} />
          <TextInput
            ref={inputRef}
            style={styles.phoneInput}
            value={formatDisplay(phone)}
            onChangeText={handleChangeText}
            keyboardType="phone-pad"
            placeholder="0000 0000"
            placeholderTextColor={C.textPlaceholder}
            maxLength={9}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          {isValid && (
            <Ionicons name="checkmark-circle" size={22} color={C.accent} />
          )}
        </TouchableOpacity>

        <Text style={[styles.hint, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.phoneHint')}</Text>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || isLoading) && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!isValid || isLoading}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>{t('auth.continue')}</Text>
                <Text style={styles.btnArrow}>{I18nManager.isRTL ? '←' : '→'}</Text>
              </View>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGuest} activeOpacity={0.6} style={styles.guestBtn}>
          <Text style={styles.guestText}>{t('guest.browseAsGuest')}</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {t('auth.termsPrefix')}{' '}
          <Text style={styles.legalLink} onPress={() => navigation.navigate('Terms')}>
            {t('auth.terms')}
          </Text>
          {' '}{t('auth.and')}{' '}
          <Text style={styles.legalLink} onPress={() => navigation.navigate('Terms')}>
            {t('auth.privacy')}
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  inner: { flex: 1, paddingHorizontal: 24 },

  logoWrap: { alignItems: 'center', marginBottom: 20 },
  wordmark: { fontSize: 44, letterSpacing: -2, marginBottom: 6, fontWeight: '800', color: C.text },
  tagline: { fontSize: 14, color: C.textMuted, letterSpacing: 0.3 },

  trustRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, marginBottom: 36,
  },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: isDark ? 'rgba(0,51,160,0.2)' : '#EEF2FA',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  trustText: { fontSize: 11, fontWeight: '600', color: C.accent },

  stepRow: { flexDirection: 'row', marginBottom: 40 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.separator },
  stepSegActive: { backgroundColor: C.accent },
  stepGap: { marginRight: 4 },

  title: { fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.textMuted, lineHeight: 22, marginBottom: 28 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FFF2F2',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { fontSize: 14, color: C.error, flex: 1 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.fill, borderRadius: 14,
    paddingHorizontal: 16, height: 60, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputCardActive: {
    borderColor: C.accent,
    backgroundColor: isDark ? 'rgba(0,51,160,0.15)' : '#EEF2FA',
  },
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefixFlag: { fontSize: 20 },
  prefixCode: { fontSize: 17, fontWeight: '600', color: C.text },
  divider: {
    width: StyleSheet.hairlineWidth, height: 22,
    backgroundColor: C.separator, marginHorizontal: 14,
  },
  phoneInput: { flex: 1, fontSize: 22, fontWeight: '500', color: C.text, letterSpacing: 2 },
  hint: { fontSize: 12, color: C.textMuted },

  btn: {
    backgroundColor: C.accent, borderRadius: 14,
    height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  btnDisabled: { opacity: 0.4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnArrow: { color: '#fff', fontSize: 18 },

  guestBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  guestText: { fontSize: 15, color: C.textMuted },

  legal: { fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: C.accent, fontWeight: '500' },
});
