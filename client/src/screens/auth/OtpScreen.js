import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, I18nManager,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { verifyOtp, clearError } from '../../store/slices/authSlice';
import { authAPI } from '../../services/api';
import { COLORS } from '../../constants';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

function StepBar({ step, total }) {
  return (
    <View style={sb.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[sb.seg, i < step ? sb.active : sb.inactive, i < total - 1 && sb.gap]}
        />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 40 },
  seg: { flex: 1, height: 3, borderRadius: 2 },
  gap: { marginRight: 4 },
  active: { backgroundColor: COLORS.accent },
  inactive: { backgroundColor: '#E5E5EA' },
});

export default function OtpScreen({ navigation, route }) {
  const { phone, isNewUser, testMode } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isLoading, error } = useSelector((s) => s.auth);

  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    startCountdown();
    return () => {
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
    // If fulfilled: AppNavigator will handle routing (needsName → NameScreen, or → AppStack)
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
          <Ionicons name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={COLORS.accent} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>

        {/* Step bar */}
        <StepBar step={2} total={totalSteps} />

        {/* Header */}
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.otpTitle')}</Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t('auth.otpSub')}{' '}
          <Text style={styles.phoneHighlight}>{displayPhone}</Text>
        </Text>

        {testMode && (
          <View style={styles.testBanner}>
            <Ionicons name="flask-outline" size={14} color="#92400E" />
            <Text style={styles.testText}>{t('auth.testMode')}</Text>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={15} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Code boxes */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={styles.boxRow}
        >
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            style={styles.hiddenInput}
            caretHidden
          />
          {renderBoxes()}
        </TouchableOpacity>

        {/* Loading / auto-submit indicator */}
        {isLoading && (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendCountdown}>
              {t('auth.didntGet')}{' '}
              <Text style={{ fontWeight: '600', color: COLORS.text }}>{countdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={COLORS.accent} />
                : <Text style={styles.resendLink}>{t('auth.resend')}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  inner: { flex: 1, paddingHorizontal: 24 },

  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, marginStart: -4 },
  backText: { fontSize: 17, color: COLORS.accent, fontWeight: '500' },

  title: { fontSize: 30, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 28 },
  phoneHighlight: { color: COLORS.text, fontWeight: '600' },

  testBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 20,
  },
  testText: { fontSize: 13, color: '#92400E', fontWeight: '500' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF2F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
  },
  errorText: { fontSize: 14, color: COLORS.error, flex: 1 },

  boxRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  box: {
    width: 46, height: 58, borderRadius: 14,
    backgroundColor: COLORS.fill,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  boxActive: { borderColor: COLORS.accent, backgroundColor: '#EEF2FA' },
  boxFilled: { backgroundColor: '#EEF2FA', borderColor: COLORS.accent + '50' },
  boxText: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  cursor: {
    position: 'absolute', bottom: 10,
    width: 2, height: 20, borderRadius: 1,
    backgroundColor: COLORS.accent,
  },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  verifyingText: { fontSize: 14, color: COLORS.textMuted },

  resendRow: { alignItems: 'center' },
  resendCountdown: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  resendLink: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
});
