import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { verifyOtp, clearError } from '../../store/slices/authSlice';
import { authAPI } from '../../services/api';
import {
  BrutNav, BrutHero, BrutRule, useBrutColors, isAr, ls, shout,
} from '../../components/Brut';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpScreen({ navigation, route }) {
  const { phone, isNewUser, testMode } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, MUTED, ACCENT, BG, FILL } = useBrutColors();
  const { isLoading, error } = useSelector((s) => s.auth);

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  const hiddenRef = useRef(null);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startCountdown();
    return () => { clearInterval(timerRef.current); dispatch(clearError()); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const timer = setTimeout(() => hiddenRef.current?.focus(), 500);
      return () => clearTimeout(timer);
    }, [])
  );

  const startCountdown = () => {
    setCountdown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authAPI.sendOtp(phone);
      startCountdown();
      setDigits(Array(CODE_LENGTH).fill(''));
      hiddenRef.current?.focus();
    } catch {}
    setResending(false);
  };

  const submit = async (code) => {
    if (code.length !== CODE_LENGTH || submittedRef.current) return;
    submittedRef.current = true;
    const result = await dispatch(verifyOtp({ phone, code }));
    if (result.meta.requestStatus === 'rejected') {
      setDigits(Array(CODE_LENGTH).fill(''));
      submittedRef.current = false;
      setTimeout(() => hiddenRef.current?.focus(), 100);
    }
  };

  const handleChange = (text) => {
    if (submittedRef.current) return;
    const cleaned = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill('');
    cleaned.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    if (cleaned.length === CODE_LENGTH) submit(cleaned);
  };

  const displayPhone = phone.replace('+965', '+965 ');
  const filled = digits.join('');

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <BrutNav onBack={() => navigation.goBack()} />
      <View style={[styles.inner, { paddingBottom: insets.bottom + 28 }]}>
        <View>
          <BrutHero title={t('auth.otpTitle')} label={isNewUser ? '02 / 03' : '02 / 02'} size={42} />
          <BrutRule mt={24} mb={24} />

          <Text style={[styles.subtitle, { color: MUTED, textAlign: ar ? 'right' : 'left' }]}>
            {t('auth.otpSub')} <Text style={[styles.phoneHighlight, { color: TEXT }]}>{displayPhone}</Text>
          </Text>

          {testMode && (
            <Text style={[styles.testTag, { color: ACCENT, letterSpacing: ls(2, ar), textAlign: ar ? 'right' : 'left' }]}>
              ● {shout(t('auth.testMode'), ar)}
            </Text>
          )}

          {!!error && (
            <Text style={[styles.error, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
              {shout(error, ar)}
            </Text>
          )}

          {/* Single hidden input — owns keyboard + iOS autofill */}
          <TextInput
            ref={hiddenRef}
            value={filled}
            onChangeText={handleChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            style={styles.hidden}
            caretHidden
          />

          {/* Visual digit boxes — tapping any focuses the hidden input */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => hiddenRef.current?.focus()}
            style={styles.boxRow}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    backgroundColor: FILL,
                    borderColor: digits[i] ? ACCENT : 'transparent',
                    // cursor indicator on the next empty box
                    borderBottomColor: !digits[i] && i === filled.length ? ACCENT : undefined,
                    borderBottomWidth: !digits[i] && i === filled.length ? 2 : undefined,
                  },
                ]}
              >
                <Text style={[styles.boxText, { color: TEXT }]}>{digits[i]}</Text>
              </View>
            ))}
          </TouchableOpacity>
        </View>

        <View>
          {countdown > 0 ? (
            <Text style={[styles.resendDim, { color: MUTED, textAlign: 'center' }]}>
              {ar ? `إعادة الإرسال خلال ${countdown}s` : `Resend in ${countdown}s`}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ alignItems: 'center' }}>
              <Text style={[styles.resend, { color: ACCENT }]}>
                {resending ? '...' : t('auth.resend')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  subtitle: { fontSize: 14, marginBottom: 16 },
  phoneHighlight: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  testTag: { fontSize: 11, fontWeight: '900', marginBottom: 12 },
  error: { fontSize: 11, fontWeight: '800', color: '#D32F2F', marginBottom: 14 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  boxRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  box: { flex: 1, height: 60, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  boxText: { fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  resend: { fontSize: 15, fontWeight: '600' },
  resendDim: { fontSize: 13, fontWeight: '400' },
});
