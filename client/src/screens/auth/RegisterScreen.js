import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { register, clearError } from '../../store/slices/authSlice';
import { COLORS } from '../../constants';

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { isLoading, error } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { return () => dispatch(clearError()); }, []);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const isValid = form.name.trim() && form.username.trim().length >= 3 && form.email.includes('@') && form.password.length >= 6;

  const handleRegister = () => {
    if (!isValid) return;
    dispatch(register({
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    }));
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Kuwait's conversations</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="Your name"
            placeholderTextColor={COLORS.textPlaceholder}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameWrap}>
            <View style={styles.atBadge}>
              <Text style={styles.atSign}>@</Text>
            </View>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              value={form.username}
              onChangeText={(v) => update('username', v.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="your_username"
              placeholderTextColor={COLORS.textPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>
          <Text style={styles.hint}>Letters, numbers, underscores · Min 3 characters</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(v) => update('email', v)}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textPlaceholder}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={form.password}
              onChangeText={(v) => update('password', v)}
              placeholder="Min. 6 characters"
              placeholderTextColor={COLORS.textPlaceholder}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (!isValid || isLoading) && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!isValid || isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <Text style={styles.terms}>
          By signing up you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' and '}
          <Text style={styles.termsLink}>Privacy Policy</Text>.
        </Text>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account?{' '}<Text style={styles.loginLinkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { marginBottom: 20, width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 16, color: COLORS.textMuted, marginBottom: 28 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FA', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: COLORS.error, fontSize: 14 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: { backgroundColor: COLORS.fill, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text },
  usernameWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.fill, borderRadius: 12, overflow: 'hidden' },
  atBadge: { paddingHorizontal: 14, paddingVertical: 14 },
  atSign: { fontSize: 17, color: COLORS.textMuted, fontWeight: '600' },
  usernameInput: { flex: 1, borderRadius: 0, paddingLeft: 0 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  terms: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  termsLink: { color: COLORS.primary, fontWeight: '600' },
  loginLink: { alignItems: 'center' },
  loginLinkText: { fontSize: 15, color: COLORS.textMuted },
  loginLinkBold: { color: COLORS.primary, fontWeight: '700' },
});
