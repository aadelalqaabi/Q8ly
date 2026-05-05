import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { TEXT, MUTED, ACCENT, BG } = useBrutColors();
  const { isLoading, error } = useSelector((s) => s.auth);

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startCountdown();
    return () => { clearInterval(timerRef.current); dispatch(clearError()); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const timer = setTimeout(() => inputRefs.current[0]?.focus(), 500);
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
      inputRefs.current[0]?.focus();
    } catch {}
    setResending(false);
  };

  const submit = async (code) => {
    if (code.length !== CODE_LENGTH || submittedRef.current) return;
    submittedRef.current = true;
    const inviteCode = await AsyncStorage.getItem('@kn_invite_code');
    const result = await dispatch(verifyOtp({ phone, code, inviteCode }));
    if (result.meta.requestStatus === 'rejected') {
      setDigits(Array(CODE_LENGTH).fill(''));
      submittedRef.current = false;
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const handleChange = (text, index) => {
    if (submittedRef.current) return;
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const full = cleaned.slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill('');
      full.split('').forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      const lastIdx = Math.min(full.length - 1, CODE_LENGTH - 1);
      inputRefs.current[lastIdx]?.focus();
      if (full.length === CODE_LENGTH) submit(full);
      return;
    }
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    const code = next.join('');
    if (code.length === CODE_LENGTH && !next.includes('')) submit(code);
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]; next[index] = ''; setDigits(next);
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ''; setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const displayPhone = phone.replace('+965', '+965 ');

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

          <View style={[styles.boxRow, { flexDirection: 'row' }]}>
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                value={digits[i]}
                onChangeText={(text) => handleChange(text, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                style={[styles.box, { borderBottomColor: TEXT, color: TEXT }, !!digits[i] && { borderBottomColor: ACCENT }]}
              />
            ))}
          </View>
        </View>

        <View>
          {countdown > 0 ? (
            <Text style={[styles.resendDim, { color: MUTED, letterSpacing: ls(1.5, ar), textAlign: 'center' }]}>
              {shout(`${t('auth.resendIn')} ${countdown}s`, ar)}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ alignItems: 'center' }}>
              <Text style={[styles.resend, { color: ACCENT, letterSpacing: ls(2, ar) }]}>
                {resending ? '...' : shout(t('auth.resendCode'), ar)}
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
  boxRow: { gap: 8, marginTop: 18 },
  box: { flex: 1, height: 64, borderBottomWidth: 2, fontSize: 32, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  resend: { fontSize: 13, fontWeight: '900' },
  resendDim: { fontSize: 11, fontWeight: '800' },
});
