import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '../../store/slices/authSlice';
import { COLORS } from '../../constants';

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => dispatch(clearError());
  }, []);

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🇰🇼</Text>
          <Text style={styles.appName}>Kuwait Now</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Create your account</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => update('name', v)}
              placeholder="Your name"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={[styles.input, styles.usernameInput]}
                value={form.username}
                onChangeText={(v) => update('username', v.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="your_username"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            <Text style={styles.hint}>Letters, numbers, underscores only. Min 3 characters.</Text>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => update('email', v)}
              placeholder="email@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={form.password}
                onChangeText={(v) => update('password', v)}
                placeholder="Min. 6 characters"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showBtn}>
                <Text style={styles.showBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, (!isValid || isLoading) && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={!isValid || isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.registerBtnText}>Create Account</Text>
            }
          </TouchableOpacity>

          <View style={styles.termsRow}>
            <Text style={styles.termsText}>
              By signing up you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' and '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 48 },
  appName: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginTop: 6 },
  form: {},
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 14 },
  inputWrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 16, color: COLORS.text, backgroundColor: '#FAFAFA' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  atSign: { paddingHorizontal: 12, fontSize: 18, color: COLORS.textLight, fontWeight: '600' },
  usernameInput: { flex: 1, borderWidth: 0, borderRadius: 0 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: { marginLeft: 8, padding: 8 },
  showBtnText: { color: COLORS.primary, fontWeight: '600' },
  registerBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  disabledBtn: { opacity: 0.6 },
  registerBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  termsRow: { marginTop: 12, paddingHorizontal: 4 },
  termsText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
  termsLink: { color: COLORS.primary, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { color: COLORS.textLight, fontSize: 15 },
  loginLinkBold: { color: COLORS.primary, fontWeight: '700' },
});
