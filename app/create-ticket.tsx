import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { EMPLOYEE_DEPARTMENTS, useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';
import { apiRequest } from '@/lib/api';

type Priority = 'low' | 'medium' | 'high';
type Employee = {
  _id: string;
  name: string;
  phone: string;
  role: 'admin' | 'employee';
  department?: string | null;
};

export default function CreateTicketScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { createTicket } = useTickets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [imageUri, setImageUri] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [department, setDepartment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (!department && user?.department) {
      setDepartment(user.department);
    }
  }, [department, user?.department]);

  useEffect(() => {
    const loadAssignableUsers = async () => {
      if (!token || !department) {
        setEmployees([]);
        return;
      }

      try {
        setIsLoadingEmployees(true);
        setError('');
        const response = await apiRequest<{ users: Employee[] }>(
          `/api/tickets/assignable-users?department=${encodeURIComponent(department)}`,
          { token }
        );
        setEmployees(response.users.filter((item) => item._id !== user?.id));
      } catch (e) {
        setEmployees([]);
        setError(e instanceof Error ? e.message : 'Failed to fetch assignable users');
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    loadAssignableUsers();
  }, [token, department, user?.id]);

  const normalizeDepartment = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
  const departments =
    user?.role === 'admin' && !user?.isMainAdmin && user?.department
      ? [user.department]
      : [...EMPLOYEE_DEPARTMENTS];
  const filteredEmployees = employees.filter((item) => normalizeDepartment(item.department) === normalizeDepartment(department));

  const pickImage = async () => {
    try {
      if (!cameraPermission?.granted) {
        const requested = await requestCameraPermission();
        if (!requested.granted) {
          setError('Camera permission is required to capture image.');
          return;
        }
      }
      setError('');
      setShowCamera(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open camera');
    }
  };

  const captureImage = async () => {
    try {
      if (!cameraRef.current) {
        setError('Camera not ready yet.');
        return;
      }
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setError('Failed to capture photo.');
        return;
      }
      setImageUri(photo.uri);
      setShowCamera(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to capture image');
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    if (!imageUri) {
      setError('Image is mandatory.');
      return;
    }
    if (!department) {
      setError('Please select a department.');
      return;
    }
    if (!assignedTo) {
      setError('Please select a user to assign this ticket.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        imageUri,
        department,
        assignedTo,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showCamera) {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.pageCenter}>
          <Text style={styles.blockTitle}>Camera permission is required.</Text>
          <TouchableOpacity style={styles.submitButton} onPress={pickImage}>
            <Text style={styles.submitText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraPage}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={captureImage}>
            <Text style={styles.captureBtnText}>Capture</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>{user?.role === 'admin' ? 'ADMIN ACTION' : 'EMPLOYEE ACTION'}</Text>
        <Text style={styles.title}>Create Ticket</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Ticket title" />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.textArea]}
          placeholder="Ticket description"
          multiline
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.segmentRow}>
          {(['low', 'medium', 'high'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.segmentButton, priority === item ? styles.segmentActive : null]}
              onPress={() => setPriority(item)}>
              <Text style={[styles.segmentText, priority === item ? styles.segmentTextActive : null]}>
                {item.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Department</Text>
        {isLoadingEmployees ? <Text style={styles.helper}>Loading departments...</Text> : null}
        <View style={styles.segmentWrap}>
          {departments.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.choiceChip, department === item ? styles.choiceChipActive : null]}
              onPress={() => {
                setDepartment(item);
                setAssignedTo('');
              }}>
              <Text style={[styles.choiceChipText, department === item ? styles.choiceChipTextActive : null]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Assign To</Text>
        {!department ? <Text style={styles.helper}>Select department first.</Text> : null}
        {department && filteredEmployees.length === 0 ? (
          <Text style={styles.helper}>No assignable users found in selected department.</Text>
        ) : null}
        <View style={styles.segmentWrap}>
          {filteredEmployees.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[styles.choiceChip, assignedTo === item._id ? styles.choiceChipActive : null]}
              onPress={() => setAssignedTo(item._id)}>
              <Text style={[styles.choiceChipText, assignedTo === item._id ? styles.choiceChipTextActive : null]}>
                {item.name} ({item.role === 'admin' ? 'Admin' : 'Employee'})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Image (mandatory)</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{imageUri ? 'Change Image' : 'Upload Image'}</Text>
        </TouchableOpacity>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? 'Creating...' : 'Create Ticket'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  pageCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5EE' },
  blockTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  kicker: { fontSize: 12, fontWeight: '700', color: '#1D391D', letterSpacing: 0.7 },
  title: { marginTop: 4, fontSize: 36, fontWeight: '800', color: '#111827' },
  label: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '700', color: '#243047' },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#111827',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 10 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { borderColor: '#1D391D', backgroundColor: '#E7ECE1' },
  segmentText: { fontWeight: '600', color: '#111827' },
  segmentTextActive: { color: '#1D391D' },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceChipActive: { borderColor: '#1D391D', backgroundColor: '#E7ECE1' },
  choiceChipText: { fontSize: 12, color: '#27344D' },
  choiceChipTextActive: { color: '#1D391D', fontWeight: '700' },
  helper: { fontSize: 12, color: '#6D7B9A', marginBottom: 6 },
  cameraPage: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraActions: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captureBtn: {
    backgroundColor: '#1D391D',
    borderRadius: 12,
    minHeight: 46,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    minHeight: 46,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  uploadButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: { color: '#1D391D', fontWeight: '700' },
  preview: { marginTop: 10, width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E5E7EB' },
  error: { marginTop: 12, color: '#DC2626', fontSize: 13, fontWeight: '500' },
  submitButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
