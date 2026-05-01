import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/brand';
import { EMPLOYEE_DEPARTMENTS, MAIN_ADMIN_DEPARTMENT, useAuth } from '@/context/auth-context';

type UserRole = 'admin' | 'employee';
type UserRoleSelection = UserRole | null;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRoleSelection>(null);
  const [department, setDepartment] = useState<string>('');
  const [isMainAdmin, setIsMainAdmin] = useState<boolean | null>(null);
  const [profileImage, setProfileImage] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Please allow media access to upload profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setProfileImage({
      uri: asset.uri,
      name: asset.fileName ?? `employee-profile-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Please enter name, phone number, and password.');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!role) {
      setError('Please select role.');
      return;
    }
    if (role === 'admin' && isMainAdmin === null) {
      setError('Please select admin type.');
      return;
    }
    if ((role === 'employee' || (role === 'admin' && isMainAdmin === false)) && !department) {
      setError('Please select a department.');
      return;
    }
    if (role === 'employee' && !profileImage?.uri) {
      setError('Please upload employee profile image.');
      return;
    }

    setError('');
    try {
      setIsSubmitting(true);
      await signUp({
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim(),
        role,
        department: role === 'employee' ? department : isMainAdmin ? MAIN_ADMIN_DEPARTMENT : department || undefined,
        isMainAdmin: role === 'admin' ? Boolean(isMainAdmin) : false,
        profileImage: role === 'employee' ? profileImage : null,
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
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
        <View style={styles.logoWrap}>
        <View style={styles.logoRing}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            </View>
            <Text style={styles.logoTag}>Since 1994</Text>
        </View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join and manage your tickets with ease.</Text>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign up</Text>
          <Text style={styles.formSubtitle}>A few details to get you started.</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            style={styles.input}
            placeholderTextColor={BrandColors.muted}
          />

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
              placeholder="Create password"
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
              onPress={() => {
                setRole('admin');
                setDepartment('');
                setIsMainAdmin(null);
              }}>
              <Text style={[styles.segmentText, role === 'admin' ? styles.segmentTextActive : null]}>
                Admin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentButton, role === 'employee' ? styles.segmentActive : null]}
              onPress={() => {
                setRole('employee');
                setDepartment('');
                setIsMainAdmin(null);
              }}>
              <Text style={[styles.segmentText, role === 'employee' ? styles.segmentTextActive : null]}>
                Employee
              </Text>
            </TouchableOpacity>
          </View>

          {role === 'admin' ? (
            <>
              <Text style={styles.label}>Admin Type</Text>
              <View style={styles.segmentRow}>
                <TouchableOpacity
                  style={[styles.segmentButton, isMainAdmin === false ? styles.segmentActive : null]}
                  onPress={() => setIsMainAdmin(false)}>
                  <Text style={[styles.segmentText, isMainAdmin === false ? styles.segmentTextActive : null]}>
                    Department Admin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentButton, isMainAdmin === true ? styles.segmentActive : null]}
                  onPress={() => setIsMainAdmin(true)}>
                  <Text style={[styles.segmentText, isMainAdmin === true ? styles.segmentTextActive : null]}>Main Admin</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {(role === 'employee' || (role === 'admin' && isMainAdmin === false)) ? (
            <>
              <Text style={styles.label}>Department</Text>
              <View style={styles.departmentWrap}>
                {EMPLOYEE_DEPARTMENTS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.deptChip, department === item ? styles.deptChipActive : null]}
                    onPress={() => setDepartment(item)}>
                    <Text style={[styles.deptChipText, department === item ? styles.deptChipTextActive : null]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {role === 'employee' ? (
            <>
              <Text style={styles.label}>Profile Image</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickProfileImage}>
                <Text style={styles.imagePickerBtnText}>
                  {profileImage ? 'Change Profile Image' : 'Upload Profile Image'}
                </Text>
              </TouchableOpacity>
              {profileImage ? <Image source={{ uri: profileImage.uri }} style={styles.profilePreview} /> : null}
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Creating...' : 'Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={styles.footerText}>
              Already have account? <Text style={styles.footerLink}>Sign in</Text>
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
  logoWrap: { alignItems: 'center', marginBottom: 0 },
  
  logo: { width: 80, height: 80, borderRadius: 16 },
  title: { marginTop: 18, textAlign: 'center', fontSize: 28, fontWeight: '800', color: BrandColors.text },
  subtitle: { marginTop: 8, textAlign: 'center', fontSize: 15, lineHeight: 22, color: BrandColors.muted, marginBottom: 16 },
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
  logoText:{
    fontSize: 12,
    color: BrandColors.mustard,
    marginTop: 0,
    marginLeft:7,
  },
  logoTag: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: BrandColors.mustard,
    textTransform: 'uppercase',
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
  departmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  deptChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.primarySoft,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  deptChipActive: { borderColor: BrandColors.primary, backgroundColor: BrandColors.cardBg },
  deptChipText: { fontSize: 13, color: BrandColors.text },
  deptChipTextActive: { color: BrandColors.primary, fontWeight: '700' },
  error: { marginTop: 12, color: BrandColors.danger, fontSize: 13, fontWeight: '600' },
  submitButton: {
    marginTop: 18,
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  footerText: { marginTop: 16, textAlign: 'center', color: BrandColors.muted, fontSize: 14 },
  footerLink: { color: BrandColors.primary, fontWeight: '700' },
  imagePickerBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  imagePickerBtnText: {
    color: BrandColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  profilePreview: {
    marginTop: 10,
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#E5E7EB',
  },
});
