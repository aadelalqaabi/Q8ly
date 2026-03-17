import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../store/slices/authSlice';
import { useTheme } from '../../context/ThemeContext';

export default function NameScreen() {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { colors: C } = useTheme();
  const { isLoading } = useSelector((s) => s.auth);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  const styles = useMemo(() => makeStyles(C, isRTL), [C, isRTL]);

  const isValid = name.trim().length >= 2;

  const handleJoin = async () => {
    if (!isValid || isLoading) return;
    await dispatch(updateProfile({ name: name.trim() }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>

        {/* Step bar */}
        <View style={styles.stepRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.stepSeg, styles.stepSegActive, i < 2 && styles.stepGap]}
            />
          ))}
        </View>

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
            placeholderTextColor={C.textPlaceholder}
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
                <Text style={styles.btnArrow}>{isRTL ? '←' : '→'}</Text>
              </View>
            )
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  inner: { flex: 1, paddingHorizontal: 24 },

  stepRow: { flexDirection: 'row', marginBottom: 40 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },
  stepSegActive: { backgroundColor: C.accent },
  stepGap: { marginEnd: 4 },

  title: { fontSize: 32, fontWeight: '700', color: C.text, letterSpacing: -0.8, marginBottom: 10 },
  subtitle: { fontSize: 15, color: C.textMuted, lineHeight: 22, marginBottom: 36 },

  inputCard: {
    backgroundColor: C.fill, borderRadius: 14,
    paddingHorizontal: 18, height: 60, justifyContent: 'center', marginBottom: 10,
  },
  input: { fontSize: 20, fontWeight: '500', color: C.text, textAlign: isRTL ? 'right' : 'left' },

  btn: {
    backgroundColor: C.accent, borderRadius: 14,
    height: 56, justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnArrow: { color: '#fff', fontSize: 18, fontWeight: '400' },
});
