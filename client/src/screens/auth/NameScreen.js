import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, I18nManager,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../store/slices/authSlice';
import { COLORS } from '../../constants';

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

export default function NameScreen() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isLoading } = useSelector((s) => s.auth);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  const isValid = name.trim().length >= 2;

  const handleJoin = async () => {
    if (!isValid || isLoading) return;
    await dispatch(updateProfile({ name: name.trim() }));
    // needsName → false in authSlice, AppNavigator auto-routes to AppStack
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>

        {/* Step bar */}
        <StepBar step={3} total={3} />

        {/* Header */}
        <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.nameTitle')}</Text>
        <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.nameSub')}</Text>

        {/* Name input */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.inputCard}
          onPress={() => inputRef.current?.focus()}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.namePlaceholder')}
            placeholderTextColor={COLORS.textPlaceholder}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleJoin}
            maxLength={50}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || isLoading) && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={!isValid || isLoading}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>{t('auth.join')}</Text>
                <Text style={styles.btnArrow}>{I18nManager.isRTL ? '←' : '→'}</Text>
              </View>
            )
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  inner: { flex: 1, paddingHorizontal: 24 },

  title: {
    fontSize: 32, fontWeight: '700', color: COLORS.text,
    letterSpacing: -0.8, marginBottom: 10,
  },
  subtitle: {
    fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 36,
  },

  inputCard: {
    backgroundColor: COLORS.fill, borderRadius: 14,
    paddingHorizontal: 18, height: 60, justifyContent: 'center', marginBottom: 10,
  },
  input: {
    fontSize: 20, fontWeight: '500', color: COLORS.text,
  },
  hint: { fontSize: 13, color: COLORS.textMuted },

  btn: {
    backgroundColor: COLORS.accent, borderRadius: 14,
    height: 56, justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnArrow: { color: '#fff', fontSize: 18, fontWeight: '400' },
});
