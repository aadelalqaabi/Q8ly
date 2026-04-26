import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../services/api';
import i18n from '../../i18n';

const BLUE = '#0033A0';
const INVITE_KEY = '@kn_invite_code';

export default function InviteCodeScreen({ onValid }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError(t('invite.invalidCode'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.validateInvite(trimmed);
      if (res.valid) {
        await AsyncStorage.setItem(INVITE_KEY, trimmed);
        onValid?.(trimmed);
      } else {
        setError(t('invite.invalidCode'));
      }
    } catch {
      setError(t('invite.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const openWaitlist = () => {
    Linking.openURL('https://kuwai.app/waitlist');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo */}
      <Text style={styles.wordmark}>KUWAI</Text>

      {/* Main content — pushed up */}
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-open-outline" size={36} color="#fff" />
        </View>
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          {t('invite.title')}
        </Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          {t('invite.subtitle')}
        </Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={code}
          onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
          placeholder={t('invite.placeholder')}
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!code.trim() || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!code.trim() || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={BLUE} />
            : <Text style={styles.btnText}>{t('invite.enter')}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Waitlist link */}
      <TouchableOpacity onPress={openWaitlist} style={styles.waitlistBtn} activeOpacity={0.8}>
        <Text style={styles.waitlistBtnText}>{t('invite.noCode')}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

export { INVITE_KEY };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLUE,
    paddingHorizontal: 32,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -2,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 40,
  },
  content: {
    flex: 0,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    marginBottom: 28,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF453A',
  },
  error: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: BLUE,
    fontSize: 18,
    fontWeight: '700',
  },
  waitlistBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  waitlistBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
});
