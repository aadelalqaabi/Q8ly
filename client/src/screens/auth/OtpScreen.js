import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { verifyOtp, clearError } from '../../store/slices/authSlice';
import { authAPI } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpScreen({ navigation, route }) {
  const { phone, isNewUser, testMode } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: C, isDark } = useTheme();
  const { isLoading, error } = useSelector((s) => s.auth);

  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startCountdown();
    // Delay focus so navigation animation finishes first — autoFocus alone
    // can fire before the screen is fully visible, causing iOS to ignore it
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => {
      clearTimeout(focusTimer);
      clearInterval(timerRef.current);
      dispatch(clearError());
    };
  }, []);

  const startCountdown = () => {
    setCountdown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    try { await authAPI.sendOtp(phone); startCountdown(); } catch (_) {}
    setResending(false);
  };

  const handleVerify = async (c = code) => {
    if (c.length !== CODE_LENGTH || submittedRef.current) return;
    submittedRef.current = true;
    const result = await dispatch(verifyOtp({ phone, code: c }));
    if (result.meta.requestStatus === 'rejected') {
      setCode('');
      submittedRef.current = false;
    }
  };

  const handleCodeChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  };

  const displayPhone = phone.replace('+965', '+965 ');
  const totalSteps = isNewUser ? 3 : 2;

  const renderBoxes = () =>
    Array.from({ length: CODE_LENGTH }).map((_, i) => {
      const char = code[i] ?? '';
      const isCurrent = code.length === i;
      return (
        <View
          key={i}
          style={[styles.box, isCurrent && styles.boxActive, !!char && styles.boxFilled]}
        >
          <Text style={styles.boxText}>{char}</Text>
          {isCurrent && <View style={styles.cursor} />}
        </View>
      );
    });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>

        {/* Back */}
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={C.accent} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        {/* Step bar */}
        <View style={styles.stepRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.stepSeg, i < 2 ? styles.stepSegActive : styles.stepSegInactive, i < totalSteps - 1 && styles.stepGap]}
            />
          ))}
        </View>

        {/* Header */}
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.otpTitle')}</Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t('auth.otpSub')}{' '}
          <Text style={styles.phoneHighlight}>{displayPhone}</Text>
        </Text>

        {testMode && (
          <View style={styles.testBanner}>
            <Ionicons name="flask-outline" size={14} color={isDark ? '#FCD34D' : '#92400E'} />
            <Text style={styles.testText}>{t('auth.testMode')}</Text>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Code boxes */}
        <View style={styles.boxRow}>
          {renderBoxes()}
          {/* Input sits on top at full opacity — required for iOS OTP autofill banner */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            caretHidden
            style={styles.hiddenInput}
          />
        </View>

        {isLoading && (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendCountdown}>
              {t('auth.didntGet')}{' '}
              <Text style={{ fontWeight: '600', color: C.text }}>{countdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={styles.resendLink}>{t('auth.resend')}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  inner: { flex: 1, paddingHorizontal: 24 },

  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, marginStart: -4 },
  backText: { fontSize: 17, color: C.accent, fontWeight: '500' },

  stepRow: { flexDirection: 'row', marginBottom: 40 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },
  stepSegActive: { backgroundColor: C.accent },
  stepSegInactive: { backgroundColor: C.separator },
  stepGap: { marginEnd: 4 },

  title: { fontSize: 30, fontWeight: '700', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: C.textMuted, lineHeight: 22, marginBottom: 28 },
  phoneHighlight: { color: C.text, fontWeight: '600' },

  testBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(251,191,36,0.15)' : '#FEF3C7',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 20,
  },
  testText: { fontSize: 13, color: isDark ? '#FCD34D' : '#92400E', fontWeight: '500' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FFF2F2',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
  },
  errorText: { fontSize: 14, color: C.error, flex: 1 },

  boxRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', backgroundColor: 'transparent', fontSize: 24 },
  box: {
    width: 46, height: 58, borderRadius: 14,
    backgroundColor: C.fill,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  boxActive: {
    borderColor: C.accent,
    backgroundColor: isDark ? 'rgba(0,51,160,0.15)' : '#EEF2FA',
  },
  boxFilled: {
    backgroundColor: isDark ? 'rgba(0,51,160,0.15)' : '#EEF2FA',
    borderColor: C.accent + '50',
  },
  boxText: { fontSize: 24, fontWeight: '700', color: C.text },
  cursor: {
    position: 'absolute', bottom: 10,
    width: 2, height: 20, borderRadius: 1, backgroundColor: C.accent,
  },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  verifyingText: { fontSize: 14, color: C.textMuted },

  resendRow: { alignItems: 'center' },
  resendCountdown: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  resendLink: { fontSize: 15, color: C.accent, fontWeight: '600' },
});
