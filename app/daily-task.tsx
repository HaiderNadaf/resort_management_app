import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

type DailyTask = {
  _id: string;
  taskTitle: string;
  status: 'started' | 'completed';
  startTime: string;
  endTime?: string | null;
  startImageUrl: string;
  endImageUrl?: string | null;
  employee?: {
    _id?: string;
    name?: string;
    department?: string | null;
  } | null;
};

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  return new Date(year, month - 1, day);
}

function prettyDate(dateKey: string) {
  const date = dateFromDateKey(dateKey);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DailyTaskScreen() {
  const { token, user } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [startImageUri, setStartImageUri] = useState('');
  const [showCameraFor, setShowCameraFor] = useState<'start' | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isDepartmentAdmin = user?.role === 'admin' && !user?.isMainAdmin;

  const todayDateKey = dateKeyFromDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayDateKey);
  const isToday = selectedDate === todayDateKey;
  const isNextDisabled = selectedDate >= todayDateKey;

  const loadTasks = async (dateKey: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const path = isDepartmentAdmin
        ? `/api/daily-tasks/admin?date=${encodeURIComponent(dateKey)}`
        : `/api/daily-tasks/my-today?date=${encodeURIComponent(dateKey)}`;
      const data = await apiRequest<{ tasks: DailyTask[] }>(path, { token });
      setTasks(data.tasks || []);
      if (isDepartmentAdmin || dateKey !== todayDateKey) {
        setActiveTaskId('');
      } else {
        const started = (data.tasks || []).find((task) => task.status === 'started');
        setActiveTaskId(started?._id || '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    loadTasks(selectedDate).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDepartmentAdmin, selectedDate]);

  const shiftDate = (days: number) => {
    const base = dateFromDateKey(selectedDate);
    base.setDate(base.getDate() + days);
    setSelectedDate(dateKeyFromDate(base));
  };

  const openCamera = async () => {
    try {
      if (!cameraPermission?.granted) {
        const granted = await requestCameraPermission();
        if (!granted.granted) {
          setError('Camera permission is required.');
          return;
        }
      }
      setError('');
      setShowCameraFor('start');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open camera');
    }
  };

  const capture = async () => {
    try {
      if (!cameraRef.current || !showCameraFor) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setError('Failed to capture image.');
        return;
      }
      setStartImageUri(photo.uri);
      setShowCameraFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to capture image');
    }
  };

  const startTask = async () => {
    if (!token) return;
    if (!taskTitle.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!startImageUri) {
      setError('Start image is mandatory.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('taskTitle', taskTitle.trim());
      formData.append('startImage', {
        uri: startImageUri,
        type: 'image/jpeg',
        name: `daily-task-start-${Date.now()}.jpg`,
      } as unknown as Blob);
      await apiRequest('/api/daily-tasks/start', {
        method: 'POST',
        body: formData,
        token,
        isFormData: true,
      });
      setTaskTitle('');
      setStartImageUri('');
      await loadTasks(selectedDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start task');
    } finally {
      setLoading(false);
    }
  };

  const endTask = async () => {
    if (!token || !activeTaskId) {
      setError('No active task found to complete.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await apiRequest(`/api/daily-tasks/${activeTaskId}/end`, {
        method: 'PATCH',
        body: {},
        token,
      });
      await loadTasks(selectedDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const activeTask = tasks.find((task) => task._id === activeTaskId && task.status === 'started');

  if (showCameraFor) {
    return (
      <View style={styles.cameraPage}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCameraFor(null)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={capture}>
            <Text style={styles.captureBtnText}>Capture</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>{user?.department || 'Department'}</Text>
        <Text style={styles.title}>Daily Task</Text>

        <View style={styles.dateBar}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => shiftDate(-1)}>
            <Text style={styles.dateBtnText}>Previous</Text>
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Text style={styles.dateLabel}>Date</Text>
            <Text style={styles.dateValue}>{prettyDate(selectedDate)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.dateBtn, isNextDisabled ? styles.dateBtnDisabled : null]}
            onPress={() => shiftDate(1)}
            disabled={isNextDisabled}>
            <Text style={styles.dateBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(todayDateKey)}>
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>

        {!isDepartmentAdmin && isToday && !activeTask ? (
          <>
            <Text style={styles.label}>Task Title</Text>
            <TextInput value={taskTitle} onChangeText={setTaskTitle} style={styles.input} placeholder="Task title" />

            <Text style={styles.label}>Start Image</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={openCamera}>
              <Text style={styles.uploadButtonText}>{startImageUri ? 'Change Start Image' : 'Upload Start Image'}</Text>
            </TouchableOpacity>
            {startImageUri ? <Image source={{ uri: startImageUri }} style={styles.preview} /> : null}

            <TouchableOpacity style={styles.submitButton} onPress={startTask} disabled={loading}>
              <Text style={styles.submitText}>{loading ? 'Starting...' : 'Start Task'}</Text>
            </TouchableOpacity>
          </>
        ) : !isDepartmentAdmin && isToday && activeTask ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{activeTask.taskTitle}</Text>
              <Text style={styles.cardSub}>Start: {new Date(activeTask.startTime).toLocaleString()}</Text>
              <Image source={{ uri: activeTask.startImageUrl }} style={styles.preview} />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={endTask} disabled={loading}>
              <Text style={styles.submitText}>{loading ? 'Completing...' : 'Complete Task'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {isDepartmentAdmin ? (
          <Text style={styles.helper}>Showing activity for your department users on {prettyDate(selectedDate)}.</Text>
        ) : !isToday ? (
          <Text style={styles.helper}>Viewing history for {prettyDate(selectedDate)}. Switch back to Today to start a new task.</Text>
        ) : null}

        <Text style={styles.listTitle}>{isToday ? 'Today Activity' : 'Activity'}</Text>
        {tasks.map((task) => (
          <View key={task._id} style={styles.listCard}>
            <Text style={styles.listHeader}>
              {task.taskTitle} ({task.status === 'completed' ? 'Completed' : 'Started'})
            </Text>
            {isDepartmentAdmin ? <Text style={styles.listText}>Employee: {task.employee?.name || '-'}</Text> : null}
            <Text style={styles.listText}>Start: {new Date(task.startTime).toLocaleString()}</Text>
            <Text style={styles.listText}>End: {task.endTime ? new Date(task.endTime).toLocaleString() : '-'}</Text>
          </View>
        ))}
        {!loading && tasks.length === 0 ? (
          <Text style={styles.helper}>No tasks logged on {prettyDate(selectedDate)}.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  kicker: { fontSize: 12, fontWeight: '700', color: '#1D391D', letterSpacing: 0.7 },
  title: { marginTop: 4, fontSize: 36, fontWeight: '800', color: '#111827' },
  dateBar: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: {
    minWidth: 86,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBtnText: { color: '#1D391D', fontWeight: '700', fontSize: 13 },
  dateBtnDisabled: { opacity: 0.45 },
  dateCenter: { alignItems: 'center' },
  dateLabel: { fontSize: 12, color: '#6B7280' },
  dateValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  todayBtn: { marginTop: 8, alignSelf: 'center' },
  todayText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
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
  uploadButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: { color: '#1D391D', fontWeight: '700' },
  submitButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  preview: { marginTop: 10, width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E5E7EB' },
  error: { marginTop: 12, color: '#DC2626', fontSize: 13, fontWeight: '500' },
  helper: { marginTop: 10, fontSize: 13, color: '#6B7280' },
  listTitle: { marginTop: 20, fontSize: 18, fontWeight: '800', color: '#111827' },
  listCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  listHeader: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  listText: { marginTop: 2, fontSize: 12, color: '#4B5563' },
  card: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSub: { marginTop: 4, fontSize: 12, color: '#4B5563' },
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
});
