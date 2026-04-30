import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { RoomInspectionChecklistItem, useRoomInspections } from '@/context/room-inspection-context';

export default function RoomChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getInspectionById, loadInspection, saveChecklist, completeRoom, pendingSyncCount } = useRoomInspections();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [checklist, setChecklist] = useState<RoomInspectionChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [progressImageUri, setProgressImageUri] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const inspection = id ? getInspectionById(id) : null;

  useEffect(() => {
    if (!id) return;
    loadInspection(id)
      .then((item) => {
        if (!item) return;
        setChecklist(item.checklist || []);
        setNotes(item.notes || '');
        setProgressImageUri(item.progressImageUrl || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load room'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!inspection) return;
    setChecklist(inspection.checklist || []);
    setNotes(inspection.notes || '');
    setProgressImageUri(inspection.progressImageUrl || '');
  }, [inspection]);

  const checkedCount = checklist.filter((item) => item.isChecked).length;
  const allChecked = checklist.length > 0 && checkedCount === checklist.length;

  const statusLabel = !inspection
    ? 'Pending'
    : inspection.status === 'completed'
    ? 'Completed'
    : inspection.status === 'in_progress'
    ? 'In Progress'
    : 'Pending';

  const toggleItem = (idx: number) => {
    setChecklist((prev) => prev.map((item, index) => (index === idx ? { ...item, isChecked: !item.isChecked } : item)));
  };

  const pickProgressImage = async () => {
    try {
      if (!cameraPermission?.granted) {
        const requested = await requestCameraPermission();
        if (!requested.granted) {
          setError('Please allow camera access to capture image.');
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
      setProgressImageUri(photo.uri);
      setShowCamera(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to capture image');
    }
  };

  const saveProgress = async () => {
    if (!id) return;
    setIsSaving(true);
    setError('');
    try {
      await saveChecklist(id, checklist, notes, progressImageUri || undefined);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save checklist');
    } finally {
      setIsSaving(false);
    }
  };

  const complete = async () => {
    if (!id) return;
    setIsSaving(true);
    setError('');
    try {
      await saveChecklist(id, checklist, notes, progressImageUri || undefined);
      await completeRoom(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete room');
    } finally {
      setIsSaving(false);
    }
  };

  if (showCamera) {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.pageCenter}>
          <Text style={styles.blockTitle}>Camera permission is required.</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={pickProgressImage}>
            <Text style={styles.saveText}>Allow Camera</Text>
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
        <Text style={styles.title}>{inspection?.roomLabel ?? 'Room Checklist'}</Text>
        <Text style={styles.subtitle}>Status: {statusLabel}</Text>
        <Text style={styles.subtitle}>
          Checklist: {checkedCount}/{checklist.length}
        </Text>

        <View style={styles.listWrap}>
          {checklist.map((item, idx) => (
            <TouchableOpacity key={`${item.label}-${idx}`} style={styles.itemRow} onPress={() => toggleItem(idx)}>
              <View style={[styles.checkbox, item.isChecked ? styles.checkboxChecked : null]}>
                {item.isChecked ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.notesLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Add issue notes (optional)"
          style={styles.notesInput}
          multiline
        />
        <TouchableOpacity style={styles.imageBtn} onPress={pickProgressImage}>
          <Text style={styles.imageBtnText}>{progressImageUri ? 'Change Image' : 'Upload Image'}</Text>
        </TouchableOpacity>
        {progressImageUri ? <Image source={{ uri: progressImageUri }} style={styles.previewImage} /> : null}

        {pendingSyncCount > 0 ? <Text style={styles.info}>Offline queue: {pendingSyncCount} pending updates</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={saveProgress} disabled={isSaving}>
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Progress'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, !allChecked ? styles.completeBtnDisabled : styles.completeBtn]} onPress={complete} disabled={!allChecked || isSaving}>
          <Text style={styles.saveText}>{isSaving ? 'Processing...' : 'Save & Complete Room'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  pageCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5EE' },
  blockTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 5, fontSize: 14, color: '#64748B', fontWeight: '600' },
  listWrap: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#16A34A', backgroundColor: '#16A34A' },
  checkboxTick: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  itemLabel: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  notesLabel: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: '700', color: '#334155' },
  notesInput: {
    minHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    color: '#111827',
  },
  imageBtn: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBtnText: { color: '#1D391D', fontWeight: '700', fontSize: 13 },
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
  previewImage: {
    marginTop: 10,
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#E5E7EB',
  },
  info: { marginTop: 10, color: '#854D0E', fontSize: 12, fontWeight: '600' },
  error: { marginTop: 10, color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  saveBtn: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D391D',
  },
  completeBtn: { backgroundColor: '#16A34A' },
  completeBtnDisabled: { backgroundColor: '#9CA3AF' },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
