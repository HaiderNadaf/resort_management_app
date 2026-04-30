import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useRoomInspections } from '@/context/room-inspection-context';

function prettyCategory(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function RoomListScreen() {
  const router = useRouter();
  const { category, date } = useLocalSearchParams<{ category: string; date: string }>();
  const { getRooms, loadRooms, isLoading } = useRoomInspections();

  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const categoryKey = category || '';
  const rooms = getRooms(selectedDate, categoryKey);

  useEffect(() => {
    if (!categoryKey) return;
    loadRooms(selectedDate, categoryKey).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, categoryKey]);

  const completed = rooms.filter((item) => item.status === 'completed').length;
  const progress = rooms.length === 0 ? 0 : (completed / rooms.length) * 100;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{prettyCategory(categoryKey)}</Text>
        <Text style={styles.subtitle}>Date: {selectedDate}</Text>
        <Text style={styles.subtitle}>
          Progress: {completed}/{rooms.length}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>

        {isLoading && rooms.length === 0 ? <Text style={styles.helper}>Loading rooms...</Text> : null}
        {!isLoading && rooms.length === 0 ? <Text style={styles.helper}>No rooms found.</Text> : null}

        {rooms.map((room) => {
          const isDone = room.status === 'completed';
          const isInProgress = room.status === 'in_progress';
          return (
            <TouchableOpacity
              key={room._id}
              style={[styles.roomCard, isDone ? styles.doneCard : styles.pendingCard]}
              onPress={() => router.push(`/room-checklist/${room._id}`)}>
              <View>
                <Text style={styles.roomTitle}>{room.roomLabel}</Text>
                <Text style={styles.roomMeta}>Assigned: {room.assignedTo?.name ?? 'Not assigned'}</Text>
              </View>
              <View style={[styles.statusPill, isDone ? styles.donePill : isInProgress ? styles.inProgressPill : styles.pendingPill]}>
                <Text style={[styles.statusText, isDone ? styles.doneText : isInProgress ? styles.inProgressText : styles.pendingText]}>
                  {isDone ? 'Completed' : room.status === 'in_progress' ? 'In Progress' : 'Pending'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#64748B', fontWeight: '600' },
  track: { marginTop: 8, height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#22C55E' },
  helper: { marginTop: 14, color: '#6B7280', fontSize: 13 },
  roomCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  doneCard: { backgroundColor: '#ECFDF5', borderColor: '#34D399' },
  pendingCard: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  roomTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  roomMeta: { marginTop: 3, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  donePill: { backgroundColor: '#DCFCE7' },
  inProgressPill: { backgroundColor: '#FEF3C7' },
  pendingPill: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '700' },
  doneText: { color: '#166534' },
  inProgressText: { color: '#B45309' },
  pendingText: { color: '#991B1B' },
});
