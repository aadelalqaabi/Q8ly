import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
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

  // digits[0..5] — one character each
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  // One ref per input box
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startCountdown();
    return () => {
      clearInterval(timerRef.current);
      dispatch(clearError());
    };
  }, []);

  // Focus first box after navigation animation finishes
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
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authAPI.sendOtp(phone);
      startCountdown();
      // Clear boxes and refocus first
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (_) {}
    setResending(false);
  };

  const submit = async (code) => {
    if (code.length !== CODE_LENGTH || submittedRef.current) return;
    submittedRef.current = true;
    const result = await dispatch(verifyOtp({ phone, code }));
    if (result.meta.requestStatus === 'rejected') {
      setDigits(Array(CODE_LENGTH).fill(''));
      submittedRef.current = false;
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const handleChange = (text, index) => {
    if (submittedRef.current) return;
    const cleaned = text.replace(/\D/g, '');

    // ── Autofill / paste: full code arrives at once ──────────────────
    if (cleaned.length > 1) {
      const full = cleaned.slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill('');
      full.split('').forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      // Focus the last filled box
      const lastIdx = Math.min(full.length - 1, CODE_LENGTH - 1);
      inputRefs.current[lastIdx]?.focus();
      if (full.length === CODE_LENGTH) submit(full);
      return;
    }

    // ── Single digit typed ───────────────────────────────────────────
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const code = next.join('');
    if (code.length === CODE_LENGTH && !next.includes('')) submit(code);
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === 'Backspace') {
      if (digits[index]) {
        // Clear current box
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        // Move back and clear previous
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const displayPhone = phone.replace('+965', '+965 ');
  const totalSteps = isNewUser ? 3 : 2;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
              style={[
                styles.stepSeg,
                i < 2 ? styles.stepSegActive : styles.stepSegInactive,
                i < totalSteps - 1 && styles.stepGap,
              ]}
            />
          ))}
        </View>

        {/* Header */}
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t('auth.otpTitle')}
        </Text>
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

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── 6 real TextInput boxes ── */}
        <View style={styles.boxRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const isFocused = focusedIndex === i;
            const isFilled = !!digits[i];
            return (
              <TextInput
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                value={digits[i]}
                onChangeText={(text) => handleChange(text, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(-1)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}   // allow full paste on any box
                selectTextOnFocus
                caretHidden
                style={[
                  styles.box,
                  isFocused && styles.boxActive,
                  isFilled && !isFocused && styles.boxFilled,
                ]}
              />
            );
          })}
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

  boxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  box: {
    width: 46,
    height: 58,
    borderRadius: 14,
    backgroundColor: C.fill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  boxActive: {
    borderColor: C.accent,
    backgroundColor: isDark ? 'rgba(0,51,160,0.15)' : '#EEF2FA',
  },
  boxFilled: {
    backgroundColor: isDark ? 'rgba(0,51,160,0.15)' : '#EEF2FA',
    borderColor: C.accent + '50',
  },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  verifyingText: { fontSize: 14, color: C.textMuted },

  resendRow: { alignItems: 'center' },
  resendCountdown: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  resendLink: { fontSize: 15, color: C.accent, fontWeight: '600' },
});
