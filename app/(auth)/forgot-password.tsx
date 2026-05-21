import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/brand';
import { apiRequest } from '@/lib/api';

type UserRole = 'admin' | 'employee';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('admin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const trimmedPhone = phone.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedPhone || !trimmedPassword || !confirmPassword.trim()) {
      setError('Please fill in phone, new password, and confirm password.');
      setSuccess('');
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setSuccess('');
      return;
    }
    if (trimmedPassword !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      setSuccess('');
      return;
    }

    setError('');
    setSuccess('');

    try {
      setIsSubmitting(true);
      await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: {
          phone: trimmedPhone,
          role,
          newPassword: trimmedPassword,
        },
      });
      setSuccess('Password updated. You can sign in now.');
      setTimeout(() => router.replace('/(auth)/sign-in'), 1500);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reset password';
      setError(message);
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={BrandColors.text} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={styles.logoRing}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            </View>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your phone and role. If an account exists, you can set a new password.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor={BrandColors.muted}
            />

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
                <Text style={[styles.segmentText, role === 'employee' ? styles.segmentTextActive : null]}>
                  Employee
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                placeholderTextColor={BrandColors.muted}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={BrandColors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              style={styles.input}
              secureTextEntry={!showPassword}
              placeholderTextColor={BrandColors.muted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={submit}
              disabled={isSubmitting}
              activeOpacity={0.85}>
              <Text style={styles.submitButtonText}>{isSubmitting ? 'Updating…' : 'Update password'}</Text>
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
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 15, fontWeight: '600', color: BrandColors.text },
  hero: { alignItems: 'center', marginBottom: 22 },
  logoRing: {
    padding: 10,
    borderRadius: 28,
    backgroundColor: BrandColors.cardBg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  logo: { width: 64, height: 64, borderRadius: 14 },
  title: { marginTop: 16, textAlign: 'center', fontSize: 26, fontWeight: '800', color: BrandColors.text },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
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
  },
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
  success: { marginTop: 12, color: BrandColors.primary, fontSize: 13, fontWeight: '600' },
  submitButton: {
    marginTop: 18,
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
