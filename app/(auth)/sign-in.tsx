import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';

type UserRole = 'admin' | 'employee';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('admin');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password.trim()) {
      setError('Please enter phone number and password.');
      return;
    }

    setError('');
    try {
      setIsSubmitting(true);
      await signIn({
        phone: phone.trim(),
        role,
        password: password.trim(),
      });
      router.replace('/(tabs)');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign in failed';
      if (
        message.toLowerCase().includes('user not found') ||
        message.toLowerCase().includes('invalid password') ||
        message.toLowerCase().includes('invalid role')
      ) {
        setError('User not exist');
        return;
      }
      setError('User not exist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            </View>
            <Text style={styles.logoTag}>Since 1994</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to manage tickets and attendance.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Account</Text>
            <Text style={styles.formSubtitle}>Phone, password, and role.</Text>

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor={BrandColors.muted}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                placeholderTextColor={BrandColors.muted}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={BrandColors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Role</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentButton, role === 'admin' ? styles.segmentActive : null]}
                onPress={() => setRole('admin')}>
                <Text style={[styles.segmentText, role === 'admin' ? styles.segmentTextActive : null]}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, role === 'employee' ? styles.segmentActive : null]}
                onPress={() => setRole('employee')}>
                <Text style={[styles.segmentText, role === 'employee' ? styles.segmentTextActive : null]}>Employee</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={submit}
              disabled={isSubmitting}
              activeOpacity={0.85}>
              <Text style={styles.submitButtonText}>{isSubmitting ? 'Signing in…' : 'Continue'}</Text>
              {!isSubmitting ? <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.submitIcon} /> : null}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.footerText}>
                New user? <Text style={styles.footerLink}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BrandColors.appBg },
  keyboardWrap: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 22 },
  logoRing: {
    padding: 10,
    borderRadius: 28,
    backgroundColor: BrandColors.cardBg,
    borderWidth: 1,
    borderColor: BrandColors.border,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  logo: { width: 80, height: 80, borderRadius: 16 },
  logoTag: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: BrandColors.mustard,
    textTransform: 'uppercase',
  },
  title: { marginTop: 18, textAlign: 'center', fontSize: 28, fontWeight: '800', color: BrandColors.text },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: BrandColors.muted,
    paddingHorizontal: 8,
  },
  formCard: {
    backgroundColor: BrandColors.cardBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  formTitle: { fontSize: 18, fontWeight: '800', color: BrandColors.text },
  formSubtitle: { marginTop: 4, fontSize: 14, color: BrandColors.muted, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: BrandColors.text, marginBottom: 6, marginTop: 12 },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.primarySoft,
    paddingHorizontal: 14,
    color: BrandColors.text,
    fontSize: 16,
  },
  passwordWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.primarySoft,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: BrandColors.text,
    fontSize: 16,
    minHeight: 48,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primarySoft,
  },
  segmentActive: { borderColor: BrandColors.primary, backgroundColor: BrandColors.cardBg },
  segmentText: { color: BrandColors.text, fontWeight: '600', fontSize: 15 },
  segmentTextActive: { color: BrandColors.primary },
  error: { marginTop: 12, color: BrandColors.danger, fontSize: 13, fontWeight: '600' },
  submitButton: {
    marginTop: 18,
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  submitIcon: { marginLeft: 2 },
  footerText: { marginTop: 16, textAlign: 'center', color: BrandColors.muted, fontSize: 14 },
  footerLink: { color: BrandColors.primary, fontWeight: '700' },
});
