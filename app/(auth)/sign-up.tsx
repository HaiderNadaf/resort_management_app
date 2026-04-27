import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          </View>
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
            placeholderTextColor="#8A94A6"
          />

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
              placeholder="Create password"
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
  departmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  deptChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  deptChipActive: { borderColor: '#1D391D', backgroundColor: '#E7ECE1' },
  deptChipText: { fontSize: 13, color: '#27344D' },
  deptChipTextActive: { color: '#1D391D', fontWeight: '700' },
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
  imagePickerBtn: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D391D',
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerBtnText: {
    color: '#1D391D',
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
