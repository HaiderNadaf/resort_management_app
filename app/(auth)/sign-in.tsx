import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          </View>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue managing tickets.</Text>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSubtitle}>Use your account details.</Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            style={styles.input}
            keyboardType="phone-pad"
            placeholderTextColor="#8A94A6"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              placeholderTextColor="#8A94A6"
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Role</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentButton, role === 'admin' ? styles.segmentActive : null]}
              onPress={() => setRole('admin')}>
              <Text style={[styles.segmentText, role === 'admin' ? styles.segmentTextActive : null]}>
                Admin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, role === 'employee' ? styles.segmentActive : null]}
              onPress={() => setRole('employee')}>
              <Text style={[styles.segmentText, role === 'employee' ? styles.segmentTextActive : null]}>
                Employee
              </Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Signing In...' : 'Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={styles.footerText}>
              New user? <Text style={styles.footerLink}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 36 },
  logoWrap: { alignItems: 'center', marginBottom: 14 },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DFD1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logo: { width: 52, height: 52, borderRadius: 12 },
  title: { textAlign: 'center', fontSize: 44, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, textAlign: 'center', fontSize: 16, lineHeight: 24, color: '#5F6C84', marginBottom: 16 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  formTitle: { fontSize: 34, fontWeight: '800', color: '#111827' },
  formSubtitle: { marginTop: 4, fontSize: 15, color: '#6D7B9A', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '700', color: '#243047', marginBottom: 7, marginTop: 10 },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    color: '#111827',
  },
  passwordWrap: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: '#111827',
  },
  eyeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  segmentActive: { borderColor: '#1D391D', backgroundColor: '#E7ECE1' },
  segmentText: { color: '#111827', fontWeight: '600' },
  segmentTextActive: { color: '#1D391D' },
  error: { marginTop: 12, color: '#DC2626', fontSize: 13, fontWeight: '500' },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  footerText: { marginTop: 14, textAlign: 'center', color: '#6D7B9A', fontSize: 14 },
  footerLink: { color: '#2563EB', fontWeight: '700' },
});
