import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../services/api';
import i18n from '../../i18n';
import {
  BrutHero, BrutInput, BrutBrick, BrutAction, BrutRule, useBrutColors, isAr, ls, shout,
} from '../../components/Brut';

export const INVITE_KEY = '@kn_invite_code';

export default function InviteCodeScreen({ onValid }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const ar = isAr(i18n);
  const { TEXT, BG } = useBrutColors();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError(t('invite.invalidCode')); return; }
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
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: BG, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.center}>
        <View style={styles.wordmarkWrap}>
          <Text style={[styles.wordmark, { color: TEXT }]}>KUWAI</Text>
        </View>
        <View style={styles.body}>
          <BrutHero title={t('invite.title')} label={ar ? 'بالدعوة فقط' : 'INVITE ONLY'} size={48} />
          <BrutRule mt={22} mb={26} />
          <BrutInput
            label={t('invite.placeholder') || (ar ? 'الكود' : 'CODE')}
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
            placeholder="A1B2C3"
            autoCapitalize="characters"
            maxLength={10}
            accent
          />
          {!!error && (
            <Text style={[styles.error, { letterSpacing: ls(1.5, ar), textAlign: ar ? 'right' : 'left' }]}>
              {shout(error, ar)}
            </Text>
          )}
          <View style={{ height: 4 }} />
          <BrutBrick
            label={t('invite.enter')}
            onPress={handleSubmit}
            disabled={!code.trim() || loading}
            loading={loading}
            accent
          />
          <View style={{ height: 14 }} />
          <BrutAction
            label={t('invite.noCode')}
            onPress={() => Linking.openURL('https://kuwai.app/waitlist')}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  wordmarkWrap: { alignItems: 'center', paddingBottom: 22 },
  wordmark: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  body: { paddingHorizontal: 24 },
  error: { fontSize: 11, fontWeight: '800', color: '#D32F2F', marginTop: -12, marginBottom: 12 },
});
