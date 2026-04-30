import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useRoomInspections } from '@/context/room-inspection-context';

const DEFAULT_ROOM_CATEGORIES = [
  { categoryKey: 'aqua_room', categoryName: 'Aqua Room', totalRooms: 20 },
  { categoryKey: 'suite_room', categoryName: 'Suite Room', totalRooms: 6 },
  { categoryKey: 'heritage_room', categoryName: 'Heritage Room', totalRooms: 18 },
  { categoryKey: 'suite_room_with_pool', categoryName: 'Suite Room with Pool', totalRooms: 4 },
] as const;

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

export default function RoomInspectionsTab() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    isLoading,
    pendingSyncCount,
    getDashboard,
    loadDashboard,
    assignCategory,
    loadAssignableUsers,
    syncPendingActions,
  } = useRoomInspections();
  const [selectedDate, setSelectedDate] = useState(dateKeyFromDate(new Date()));
  const [assignableUsers, setAssignableUsers] = useState<{ _id: string; name: string; role: string; department?: string | null }[]>(
    []
  );
  const [isAssigning, setIsAssigning] = useState<string>('');
  const [screenError, setScreenError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedAssignCard, setExpandedAssignCard] = useState<string | null>(null);

  const loadedCategories = getDashboard(selectedDate);
  const isAdmin = user?.role === 'admin';
  const categories = useMemo(() => {
    const baseCategories =
      loadedCategories.length > 0
        ? loadedCategories
        : DEFAULT_ROOM_CATEGORIES.map((item) => ({
            ...item,
            completedRooms: 0,
            progress: `0/${item.totalRooms}`,
            assignedTo: null,
          }));

    if (isAdmin) {
      return baseCategories;
    }

    return baseCategories.filter((item) => item.assignedTo?._id === user?.id);
  }, [loadedCategories, isAdmin, user?.id]);

  useEffect(() => {
    setScreenError('');
    loadDashboard(selectedDate).catch((e) => {
      setScreenError(e instanceof Error ? e.message : 'Failed to load room inspections.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAssignableUsers()
      .then(setAssignableUsers)
      .catch((e) => {
        setAssignableUsers([]);
        setScreenError((prev) => prev || (e instanceof Error ? e.message : 'Failed to load assignable employees.'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const dayCompletionLabel = useMemo(() => {
    const total = categories.reduce((sum, item) => sum + item.totalRooms, 0);
    const done = categories.reduce((sum, item) => sum + item.completedRooms, 0);
    return `${done}/${total}`;
  }, [categories]);
  const todayDateKey = dateKeyFromDate(new Date());
  const isNextDisabled = selectedDate >= todayDateKey;

  const shiftDate = (days: number) => {
    const base = dateFromDateKey(selectedDate);
    base.setDate(base.getDate() + days);
    setSelectedDate(dateKeyFromDate(base));
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Room Inspections</Text>
        <Text style={styles.subtitle}>Daily room checklist progress</Text>

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
        <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(dateKeyFromDate(new Date()))}>
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Today Progress</Text>
          <Text style={styles.summaryValue}>{dayCompletionLabel}</Text>
        </View>
        {pendingSyncCount > 0 ? (
          <TouchableOpacity style={styles.syncBanner} onPress={() => syncPendingActions()}>
            <Text style={styles.syncText}>{pendingSyncCount} offline updates pending. Tap to sync.</Text>
          </TouchableOpacity>
        ) : null}
        {screenError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{screenError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setScreenError('');
                loadDashboard(selectedDate).catch((e) => setScreenError(e instanceof Error ? e.message : 'Retry failed.'));
              }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading && categories.length === 0 ? <Text style={styles.helper}>Loading categories...</Text> : null}
        {!isLoading && !isAdmin && categories.length === 0 ? (
          <Text style={styles.helper}>No room category assigned to you for this date.</Text>
        ) : null}

        {categories.map((category) => {
          const progress = category.totalRooms === 0 ? 0 : category.completedRooms / category.totalRooms;
          return (
            <View key={category.categoryKey} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{category.categoryName}</Text>
                <Text style={styles.cardCount}>{category.progress}</Text>
              </View>
              <Text style={styles.assignedText}>Assigned: {category.assignedTo?.name ?? 'Not Assigned'}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
              </View>

              {isAdmin ? (
                <View style={styles.assignWrap}>
                  <TouchableOpacity
                    style={styles.assignActionBtn}
                    onPress={() =>
                      setExpandedAssignCard((prev) => (prev === category.categoryKey ? null : category.categoryKey))
                    }>
                    <Text style={styles.assignActionText}>
                      {expandedAssignCard === category.categoryKey ? 'Hide Assign Options' : `Assign ${category.categoryName}`}
                    </Text>
                  </TouchableOpacity>
                  {expandedAssignCard === category.categoryKey ? (
                    <>
                      <Text style={styles.assignLabel}>Select Employee</Text>
                      {assignableUsers.length === 0 ? (
                        <Text style={styles.emptyAssignText}>No employees found in your department.</Text>
                      ) : null}
                      <View style={styles.userWrap}>
                        {assignableUsers.map((staff) => (
                          <TouchableOpacity
                            key={`${category.categoryKey}-${staff._id}`}
                            style={styles.userChip}
                            disabled={Boolean(isAssigning)}
                            onPress={async () => {
                              setScreenError('');
                              setSuccessMessage('');
                              setIsAssigning(category.categoryKey);
                              try {
                                await assignCategory(selectedDate, category.categoryKey, staff._id);
                                setSuccessMessage(`${category.categoryName} assigned to ${staff.name}`);
                                setExpandedAssignCard(null);
                              } catch (e) {
                                setScreenError(e instanceof Error ? e.message : 'Failed to assign staff.');
                              } finally {
                                setIsAssigning('');
                              }
                            }}>
                            <Text style={styles.userChipText}>{staff.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.openRoomsBtn}
                onPress={() =>
                  router.push({
                    pathname: '/room-list/[category]',
                    params: { category: category.categoryKey, date: selectedDate },
                  })
                }>
                <Text style={styles.openRoomsText}>Open Room List</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <TouchableOpacity style={styles.calendarBtn} onPress={() => router.push('/inspection-calendar')}>
          <Text style={styles.calendarBtnText}>Open Monthly Calendar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#64748B' },
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
  summaryRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  summaryValue: { fontSize: 16, color: '#1D391D', fontWeight: '800' },
  syncBanner: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  syncText: { color: '#92400E', fontWeight: '600', fontSize: 12 },
  errorBanner: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  errorBannerText: { color: '#991B1B', fontWeight: '600', fontSize: 12 },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  helper: { marginTop: 12, color: '#6B7280', fontSize: 13 },
  card: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DFD1',
    borderWidth: 1,
    padding: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  cardCount: { fontSize: 15, fontWeight: '800', color: '#1D391D' },
  assignedText: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '600' },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#22C55E' },
  assignWrap: { marginTop: 10 },
  assignActionBtn: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  assignActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  assignLabel: { fontSize: 12, color: '#334155', fontWeight: '700', marginBottom: 6 },
  emptyAssignText: { marginBottom: 6, color: '#64748B', fontSize: 12, fontWeight: '600' },
  userWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userChipText: { color: '#1D391D', fontSize: 12, fontWeight: '700' },
  openRoomsBtn: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#EAF0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openRoomsText: { color: '#1E40AF', fontSize: 13, fontWeight: '700' },
  successText: { marginTop: 10, color: '#166534', fontSize: 12, fontWeight: '700' },
  calendarBtn: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
