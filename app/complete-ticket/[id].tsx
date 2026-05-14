import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTickets } from '@/context/ticket-context';

export default function CompleteTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { completeTicket } = useTickets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [imageUri, setImageUri] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const capture = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission is required.');
        return;
      }
    }

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setError('Failed to capture image.');
        return;
      }
      setImageUri(photo.uri);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to capture image.');
    }
  };

  const submit = async () => {
    if (!id) {
      setError('Invalid ticket.');
      return;
    }
    if (!imageUri) {
      setError('Completion image is mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeTicket(String(id), imageUri);
      router.replace('/(tabs)/completed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollBottomPad = Math.max(insets.bottom, 12) + 28;
  const cameraHeight = Math.round(Math.min(320, Math.max(200, windowHeight * 0.32)));
  const previewHeight = Math.round(Math.min(160, Math.max(120, windowHeight * 0.18)));

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        bounces>
        <Text style={styles.title}>Complete Ticket</Text>
        <Text style={styles.sub}>Capture completion photo before submitting.</Text>

        <CameraView ref={cameraRef} style={[styles.camera, { height: cameraHeight }]} facing="back" />

        <TouchableOpacity style={styles.captureBtn} onPress={capture}>
          <Text style={styles.captureText}>Capture Image</Text>
        </TouchableOpacity>

        {imageUri ? <Image source={{ uri: imageUri }} style={[styles.preview, { height: previewHeight }]} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? 'Submitting...' : 'Mark as Completed'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 6, color: '#6D7B9A', fontSize: 13 },
  camera: { marginTop: 16, width: '100%', borderRadius: 14, overflow: 'hidden' },
  captureBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { color: '#FFFFFF', fontWeight: '700' },
  preview: { marginTop: 12, width: '100%', borderRadius: 12, backgroundColor: '#E5E7EB' },
  error: { marginTop: 10, color: '#DC2626', fontWeight: '600' },
  submitBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#CDAB2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontWeight: '800' },
});
