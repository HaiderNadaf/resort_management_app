import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VoicePlaybackButton } from '@/components/voice-playback-button';
import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';
import { apiRequest } from '@/lib/api';
import { prettyDateKey, shiftDateKey, todayDateKey } from '@/lib/date-key';
import { resumeShiftTrackingIfNeeded, startShiftTracking, stopShiftTracking } from '@/lib/location-tracking';

type AttendanceType = 'check-in' | 'check-out';
type AttendanceSnapshot = {
  dateKey?: string;
  serverTodayKey?: string;
  checkedIn: boolean;
  checkedOut: boolean;
  checkIn?: { capturedAt?: string; capturedAtLabel?: string } | null;
  checkOut?: { capturedAt?: string; capturedAtLabel?: string } | null;
};
type TeamAttendanceResponse = {
  dateKey: string;
  serverTodayKey: string;
  attendance: TeamAttendanceRow[];
};
type PendingAttendanceAction = {
  type: AttendanceType;
  latitude: number;
  longitude: number;
  capturedAt: string;
};
type AdminDailyTaskItem = {
  _id: string;
  taskTitle: string;
  status: 'started' | 'completed';
  startTime: string;
  endTime?: string | null;
  startImageUrl?: string | null;
  startVoiceUrl?: string | null;
  endImageUrl?: string | null;
  employee?: { name?: string | null } | null;
};
type TeamAttendanceRow = {
  _id: string;
  dateKey: string;
  user: {
    _id: string;
    name: string;
    phone?: string;
    department?: string;
    role?: string;
  } | null;
  checkIn: { capturedAt?: string; capturedAtLabel?: string } | null;
  checkOut: { capturedAt?: string; capturedAtLabel?: string } | null;
};
type AdminHomeView = 'daily' | 'tickets' | 'attendance';

function getTeamAttendanceStatus(row: TeamAttendanceRow) {
  const inAt = row.checkIn?.capturedAt ? new Date(row.checkIn.capturedAt).getTime() : 0;
  const outAt = row.checkOut?.capturedAt ? new Date(row.checkOut.capturedAt).getTime() : 0;
  if (!inAt) {
    return { label: 'Not marked', tone: 'pending' as const };
  }
  if (!outAt || outAt <= inAt) {
    return { label: 'On shift', tone: 'in' as const };
  }
  return { label: 'Checked out', tone: 'done' as const };
}

const ATTENDANCE_QUEUE_KEY = 'attendance_pending_queue';
const ATTENDANCE_CACHE_KEY = 'attendance_today_cache';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const {
    tickets,
    isLoading,
    ticketSummary,
    openPage,
    openTotalPages,
    openTotalCount,
    setOpenPage,
    assignedNotificationCount,
    markAssignedNotificationsRead,
    startTicket,
  } = useTickets();
  const [attendance, setAttendance] = useState<{
    checkedIn: boolean;
    checkedOut: boolean;
    checkIn?: { capturedAt?: string } | null;
    checkOut?: { capturedAt?: string } | null;
  } | null>(null);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [pendingAttendanceActions, setPendingAttendanceActions] = useState<PendingAttendanceAction[]>([]);
  const [adminDailyTasks, setAdminDailyTasks] = useState<AdminDailyTaskItem[]>([]);
  const [adminDailyTasksLoading, setAdminDailyTasksLoading] = useState(false);
  const [adminView, setAdminView] = useState<AdminHomeView>('daily');
  const [adminDailyDate, setAdminDailyDate] = useState<string>('');
  const [teamAttendance, setTeamAttendance] = useState<TeamAttendanceRow[]>([]);
  const [teamAttendanceLoading, setTeamAttendanceLoading] = useState(false);
  const [teamAttendanceError, setTeamAttendanceError] = useState('');
  const [serverTodayKey, setServerTodayKey] = useState('');
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const pendingCount = ticketSummary?.pendingCount ?? 0;
  const activeCount = ticketSummary?.inProgressCount ?? 0;
  const totalInScope = ticketSummary?.listScopeTotal ?? 0;
  const isOnShift = useMemo(() => {
    const inAt = attendance?.checkIn?.capturedAt ? new Date(attendance.checkIn.capturedAt).getTime() : 0;
    const outAt = attendance?.checkOut?.capturedAt ? new Date(attendance.checkOut.capturedAt).getTime() : 0;
    return inAt > 0 && (!outAt || outAt <= inAt);
  }, [attendance]);

  const resortTodayKey = serverTodayKey || todayDateKey();

  useEffect(() => {
    if (!adminDailyDate) setAdminDailyDate(resortTodayKey);
  }, [resortTodayKey, adminDailyDate]);

  const shiftAdminDailyDate = useCallback(
    (days: number) => {
      setAdminDailyDate((prev) => shiftDateKey(prev || resortTodayKey, days));
    },
    [resortTodayKey]
  );

  const prettyAdminDailyDate = useMemo(
    () => prettyDateKey(adminDailyDate || resortTodayKey),
    [adminDailyDate, resortTodayKey]
  );

  const isAdminDailyNextDisabled = (adminDailyDate || resortTodayKey) >= resortTodayKey;
  const isDepartmentAdmin = user?.role === 'admin' && !user?.isMainAdmin;
  const showTicketList = user?.role !== 'admin' || adminView === 'tickets';

  const persistPendingAttendanceActions = useCallback(async (items: PendingAttendanceAction[]) => {
    setPendingAttendanceActions(items);
    await AsyncStorage.setItem(ATTENDANCE_QUEUE_KEY, JSON.stringify(items));
  }, []);

  const applyLocalAttendance = useCallback((prev: AttendanceSnapshot | null, type: AttendanceType, capturedAt: string): AttendanceSnapshot => {
    const base = prev ?? { checkedIn: false, checkedOut: false, checkIn: null, checkOut: null };
    if (type === 'check-in') {
      return {
        ...base,
        checkedIn: true,
        checkIn: { capturedAt },
      };
    }
    return {
      ...base,
      checkedOut: true,
      checkOut: { capturedAt },
    };
  }, []);

  const queueAttendanceAction = useCallback(async (action: PendingAttendanceAction) => {
    const next = [...pendingAttendanceActions, action];
    await persistPendingAttendanceActions(next);
    const localNext = applyLocalAttendance(attendance, action.type, action.capturedAt);
    setAttendance(localNext);
    await AsyncStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(localNext));
  }, [pendingAttendanceActions, persistPendingAttendanceActions, applyLocalAttendance, attendance]);

  const syncPendingAttendance = useCallback(async () => {
    if (!token || pendingAttendanceActions.length === 0 || isOffline) return;
    const remaining: PendingAttendanceAction[] = [];
    for (const action of pendingAttendanceActions) {
      try {
        await apiRequest(`/api/attendance/${action.type}`, {
          method: 'POST',
          token,
          body: {
            latitude: action.latitude,
            longitude: action.longitude,
          },
        });
      } catch {
        remaining.push(action);
      }
    }
    await persistPendingAttendanceActions(remaining);
    if (remaining.length === 0) {
      const refreshed = await apiRequest<AttendanceSnapshot>('/api/attendance/today', { token });
      setAttendance(refreshed);
      await AsyncStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(refreshed));
      if (user?.role === 'employee') {
        await resumeShiftTrackingIfNeeded(token, refreshed).catch(() => {});
      }
      setAttendanceError('');
    } else {
      setAttendanceError('Some attendance actions are pending sync.');
    }
  }, [token, pendingAttendanceActions, isOffline, persistPendingAttendanceActions, user?.role]);

  useEffect(() => {
    const hydrateAttendanceState = async () => {
      const [queueRaw, attendanceRaw] = await Promise.all([
        AsyncStorage.getItem(ATTENDANCE_QUEUE_KEY),
        AsyncStorage.getItem(ATTENDANCE_CACHE_KEY),
      ]);
      const queue = queueRaw ? (JSON.parse(queueRaw) as PendingAttendanceAction[]) : [];
      setPendingAttendanceActions(queue);
      if (attendanceRaw) {
        setAttendance(JSON.parse(attendanceRaw) as AttendanceSnapshot);
      }
    };
    hydrateAttendanceState().catch(() => {});
  }, []);

  const captureAndSubmitAttendance = useCallback(async (type: AttendanceType) => {
    if (!token) return;
    setAttendanceError('');
    setAttendanceLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Location permission is required.');
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const capturedAt = new Date().toISOString();

      if (isOffline) {
        await queueAttendanceAction({
          type,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          capturedAt,
        });
        setAttendanceError('Offline: attendance saved and will sync when internet is back.');
        return;
      }

      await apiRequest(`/api/attendance/${type}`, {
        method: 'POST',
        token,
        body: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
      });

      const refreshed = await apiRequest<AttendanceSnapshot>('/api/attendance/today', { token });
      setAttendance(refreshed);
      await AsyncStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(refreshed));

      if (user?.role === 'employee') {
        if (type === 'check-in') {
          await startShiftTracking(token).catch(() => {
            setAttendanceError((prev) =>
              prev ? prev : 'Checked in, but shift location tracking could not start. Allow location access.'
            );
          });
        } else {
          await stopShiftTracking();
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update attendance';
      if (/network request failed|failed to fetch|network error|internet/i.test(message)) {
        try {
          const fallbackLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const capturedAt = new Date().toISOString();
          await queueAttendanceAction({
            type,
            latitude: fallbackLocation.coords.latitude,
            longitude: fallbackLocation.coords.longitude,
            capturedAt,
          });
          setAttendanceError('Offline: attendance saved and will sync when internet is back.');
        } catch {
          setAttendanceError('Failed to update attendance');
        }
      } else {
        setAttendanceError(message);
      }
    } finally {
      setAttendanceLoading(false);
    }
  }, [token, isOffline, queueAttendanceAction, user?.role]);

  const handleAttendanceToggle = useCallback(
    (turnOn: boolean) => {
      if (attendanceLoading) return;
      void captureAndSubmitAttendance(turnOn ? 'check-in' : 'check-out');
    },
    [attendanceLoading, captureAndSubmitAttendance]
  );

  useEffect(() => {
    if (!token) return;
    if (isOffline) return;
    apiRequest<AttendanceSnapshot>('/api/attendance/today', { token })
      .then(async (result) => {
        const todayKey = result.serverTodayKey || result.dateKey;
        if (todayKey) {
          setServerTodayKey(todayKey);
          setAdminDailyDate((prev) => prev || todayKey);
        }
        setAttendance(result);
        await AsyncStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(result));
        if (user?.role === 'employee') {
          await resumeShiftTrackingIfNeeded(token, result).catch(() => {});
        }
      })
      .catch((e) => setAttendanceError(e instanceof Error ? e.message : 'Failed to load attendance status'));
  }, [token, isOffline, user?.role]);

  useEffect(() => {
    if (!token || isOffline || pendingAttendanceActions.length === 0) return;
    syncPendingAttendance().catch(() => {});
  }, [token, isOffline, pendingAttendanceActions.length, syncPendingAttendance]);

  useEffect(() => {
    const loadAdminDailyTasks = async () => {
      if (!token || user?.role !== 'admin') {
        setAdminDailyTasks([]);
        return;
      }
      const dateKey = adminDailyDate || resortTodayKey;
      setAdminDailyTasksLoading(true);
      try {
        const response = await apiRequest<{ tasks: AdminDailyTaskItem[] }>(
          `/api/daily-tasks/admin?date=${encodeURIComponent(dateKey)}`,
          { token }
        );
        setAdminDailyTasks(response.tasks || []);
      } catch {
        setAdminDailyTasks([]);
      } finally {
        setAdminDailyTasksLoading(false);
      }
    };
    loadAdminDailyTasks().catch(() => {});
  }, [token, user?.role, resortTodayKey, adminDailyDate]);

  useEffect(() => {
    const loadTeamAttendance = async () => {
      if (!token || !isDepartmentAdmin || adminView !== 'attendance') {
        setTeamAttendance([]);
        return;
      }
      const dateKey = adminDailyDate || resortTodayKey;
      setTeamAttendanceLoading(true);
      setTeamAttendanceError('');
      try {
        const response = await apiRequest<TeamAttendanceResponse>(
          `/api/attendance?date=${encodeURIComponent(dateKey)}`,
          { token }
        );
        if (response.serverTodayKey) {
          setServerTodayKey(response.serverTodayKey);
        }
        const rows = (response.attendance || [])
          .filter((row) => Boolean(row.checkIn))
          .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''));
        setTeamAttendance(rows);
      } catch (e) {
        setTeamAttendance([]);
        setTeamAttendanceError(e instanceof Error ? e.message : 'Failed to load team attendance');
      } finally {
        setTeamAttendanceLoading(false);
      }
    };
    loadTeamAttendance().catch(() => {});
  }, [token, isDepartmentAdmin, adminView, resortTodayKey, adminDailyDate]);

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.brandTextWrap}>
            <Text style={styles.goldText}>Gold</Text>
            <Text style={styles.coinText}> coins & clubs</Text>
          </View>
          <Image source={require('@/assets/images/logo.png')} style={styles.titleLogo} accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.profileBar}>
          <View style={styles.profileLeft}>
            {user?.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.profileAvatarImage} />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{getInitials(user?.name ?? 'User')}</Text>
              </View>
            )}
            <View>
              <Text style={styles.profileName}>{user?.name ?? 'User'}</Text>
              <Text style={styles.profileRole}>{user?.role === 'admin' ? 'Admin' : 'Employee'}</Text>
              <View style={styles.profileAttendanceWrap}>
                <View
                  style={[
                    styles.profileAttendanceDot,
                    isOnShift
                      ? styles.profileAttendanceDotIn
                      : attendance?.checkIn
                      ? styles.profileAttendanceDotDone
                      : styles.profileAttendanceDotPending,
                  ]}
                />
                <Text style={styles.profileAttendanceText}>{isOnShift ? 'On shift' : 'Off'}</Text>
              </View>
            </View>
           
          </View>
          <View style={styles.profileIconWrap}>
            <Ionicons name="notifications-outline" size={18} color={BrandColors.primary} />
          </View>
        </View>

        <Text style={styles.kicker}>{user?.role === 'admin' ? 'ADMIN DASHBOARD' : 'EMPLOYEE DASHBOARD'}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>All Tickets</Text>
          {user ? (
            <View
              style={[
                styles.attendanceInlineWrap,
                isOnShift ? styles.attendanceInlineWrapOn : styles.attendanceInlineWrapOff,
                attendanceLoading ? styles.attendanceInlineWrapLoading : null,
              ]}>
              <View
                style={[
                  styles.attendanceInlineDot,
                  isOnShift ? styles.attendanceInlineDotOn : styles.attendanceInlineDotOff,
                ]}
              />
              <Text
                style={[
                  styles.attendanceInlineLabel,
                  isOnShift ? styles.attendanceInlineLabelOn : styles.attendanceInlineLabelOff,
                ]}>
                {attendanceLoading ? '...' : isOnShift ? 'On' : 'Off'}
              </Text>
              <Switch
                value={isOnShift}
                onValueChange={handleAttendanceToggle}
                disabled={attendanceLoading}
                trackColor={{ false: '#CBD5E1', true: '#4ADE80' }}
                thumbColor={isOnShift ? '#15803D' : '#FFFFFF'}
                ios_backgroundColor="#E2E8F0"
                style={styles.attendanceSwitch}
              />
            </View>
          ) : null}
        </View>
        {attendanceError ? <Text style={styles.attendanceError}>{attendanceError}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#E7ECE1' }]}>
              <Ionicons name="briefcase-outline" size={14} color="#1D391D" />
            </View>
            <Text style={styles.statNumber}>{totalInScope}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#F5EBC4' }]}>
              <Ionicons name="time-outline" size={14} color="#CDAB2C" />
            </View>
            <Text style={styles.statNumber}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#E7ECE1' }]}>
              <Ionicons name="sparkles-outline" size={14} color="#3E7BFA" />
            </View>
            <Text style={styles.statNumber}>{activeCount}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
        </View>

        {user?.role === 'admin' ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {adminView === 'daily'
                ? 'Department Daily Activity'
                : adminView === 'attendance'
                ? 'Team Attendance'
                : 'Open tickets'}
            </Text>
            <Text style={styles.sectionCount}>
              {adminView === 'daily'
                ? `${adminDailyTasks.length} records`
                : adminView === 'attendance'
                ? `${teamAttendance.length} employees`
                : `${openTotalCount} open · page ${openPage} of ${openTotalPages}`}
            </Text>
          </View>
        ) : showTicketList ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Open tickets</Text>
            <Text style={styles.sectionCount}>
              {openTotalCount} open · page {openPage} of {openTotalPages}
            </Text>
          </View>
        ) : null}

        {user?.role === 'employee' && assignedNotificationCount > 0 ? (
          <TouchableOpacity style={styles.noticeCard} onPress={markAssignedNotificationsRead}>
            <Ionicons name="notifications-outline" size={16} color="#1D391D" />
            <Text style={styles.noticeText}>
              You have {assignedNotificationCount} new assigned ticket{assignedNotificationCount > 1 ? 's' : ''}.
            </Text>
          </TouchableOpacity>
        ) : null}

        {user?.role === 'admin' ? (
          <View style={[styles.adminTabRow, isDepartmentAdmin ? styles.adminTabRowCompact : null]}>
            <TouchableOpacity
              style={[styles.adminTabBtn, adminView === 'daily' ? styles.adminTabBtnActive : null]}
              onPress={() => setAdminView('daily')}
            >
              <Text style={[styles.adminTabText, adminView === 'daily' ? styles.adminTabTextActive : null]}>
                {isDepartmentAdmin ? 'Daily Activity' : 'Department Daily Activity'}
              </Text>
            </TouchableOpacity>
            {isDepartmentAdmin ? (
              <TouchableOpacity
                style={[styles.adminTabBtn, adminView === 'attendance' ? styles.adminTabBtnActive : null]}
                onPress={() => setAdminView('attendance')}
              >
                <Text style={[styles.adminTabText, adminView === 'attendance' ? styles.adminTabTextActive : null]}>
                  Attendance
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.adminTabBtn, adminView === 'tickets' ? styles.adminTabBtnActive : null]}
              onPress={() => setAdminView('tickets')}
            >
              <Text style={[styles.adminTabText, adminView === 'tickets' ? styles.adminTabTextActive : null]}>Create Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : user ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.createBtn, styles.actionHalf]} onPress={() => router.push('/create-ticket')}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create Ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dailyTaskBtn, styles.actionHalf]} onPress={() => router.push('/daily-task')}>
              <Ionicons name="time-outline" size={16} color="#1D391D" />
              <Text style={styles.dailyTaskBtnText}>Daily Task</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {user?.role === 'admin' && (adminView === 'daily' || adminView === 'attendance') ? (
          <View style={styles.adminDailyWrap}>
            <View style={styles.adminDailyDateBar}>
              <TouchableOpacity style={styles.adminDailyDateBtn} onPress={() => shiftAdminDailyDate(-1)}>
                <Text style={styles.adminDailyDateBtnText}>Previous</Text>
              </TouchableOpacity>
              <View style={styles.adminDailyDateCenter}>
                <Text style={styles.adminDailyDateLabel}>Date</Text>
                <Text style={styles.adminDailyDateValue}>{prettyAdminDailyDate}</Text>
              </View>
              <TouchableOpacity
                style={[styles.adminDailyDateBtn, isAdminDailyNextDisabled ? styles.adminDailyDateBtnDisabled : null]}
                onPress={() => shiftAdminDailyDate(1)}
                disabled={isAdminDailyNextDisabled}>
                <Text style={styles.adminDailyDateBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.adminDailyTodayBtn} onPress={() => setAdminDailyDate(resortTodayKey)}>
              <Text style={styles.adminDailyTodayText}>Today</Text>
            </TouchableOpacity>

            {adminView === 'daily' ? (
              <>
                {adminDailyTasksLoading ? <Text style={styles.emptyText}>Loading daily activity...</Text> : null}
                {!adminDailyTasksLoading && adminDailyTasks.length === 0 ? (
                  <Text style={styles.emptyText}>No daily task activity found for {prettyAdminDailyDate}.</Text>
                ) : null}
                {adminDailyTasks.map((item) => (
                  <View key={item._id} style={styles.adminDailyCard}>
                    <View style={styles.adminDailyRow}>
                      <TouchableOpacity
                        onPress={() => {
                          const uri = item.endImageUrl || item.startImageUrl || null;
                          if (uri) setPreviewImageUri(uri);
                        }}
                      >
                        {item.endImageUrl || item.startImageUrl ? (
                          <Image source={{ uri: item.endImageUrl || item.startImageUrl || '' }} style={styles.adminDailyThumb} />
                        ) : (
                          <View style={styles.adminDailyThumbPlaceholder}>
                            <Text style={styles.adminDailyThumbPlaceholderText}>No Image</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.adminDailyInfo}>
                        <Text style={styles.adminDailyTitle}>{item.taskTitle}</Text>
                        <Text style={styles.adminDailyMeta}>Employee: {item.employee?.name || '-'}</Text>
                        <Text style={styles.adminDailyMeta}>Start: {new Date(item.startTime).toLocaleString()}</Text>
                        <Text style={styles.adminDailyMeta}>End: {item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>
                        {item.startVoiceUrl ? <VoicePlaybackButton uri={item.startVoiceUrl} label="Voice note" /> : null}
                      </View>

                      <View style={[styles.adminDailyStatusPill, item.status === 'completed' ? styles.adminDailyStatusDone : styles.adminDailyStatusOpen]}>
                        <Text style={[styles.adminDailyStatusPillText, item.status === 'completed' ? styles.adminDailyStatusDoneText : styles.adminDailyStatusOpenText]}>
                          {item.status === 'completed' ? 'Completed' : 'Started'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.adminAttendanceHelper}>
                  {user?.department || 'Your department'} · {prettyAdminDailyDate}
                  {adminDailyDate && adminDailyDate !== resortTodayKey
                    ? ` (resort today: ${prettyDateKey(resortTodayKey)})`
                    : ''}
                </Text>
                {teamAttendanceError ? <Text style={styles.attendanceError}>{teamAttendanceError}</Text> : null}
                {teamAttendanceLoading ? <Text style={styles.emptyText}>Loading team attendance...</Text> : null}
                {!teamAttendanceLoading && teamAttendance.length === 0 ? (
                  <Text style={styles.emptyText}>No attendance marked for {prettyAdminDailyDate}.</Text>
                ) : null}
                {teamAttendance.map((row) => {
                  const status = getTeamAttendanceStatus(row);
                  const statusStyle =
                    status.tone === 'done'
                      ? styles.adminDailyStatusDone
                      : status.tone === 'in'
                      ? styles.adminDailyStatusOpen
                      : styles.adminAttendanceStatusPending;
                  const statusTextStyle =
                    status.tone === 'done'
                      ? styles.adminDailyStatusDoneText
                      : status.tone === 'in'
                      ? styles.adminDailyStatusOpenText
                      : styles.adminAttendanceStatusPendingText;

                  return (
                    <View key={row._id} style={styles.adminDailyCard}>
                      <View style={styles.adminDailyRow}>
                        <View style={styles.adminAttendanceAvatar}>
                          <Text style={styles.adminAttendanceAvatarText}>{getInitials(row.user?.name || 'U')}</Text>
                        </View>
                        <View style={styles.adminDailyInfo}>
                          <Text style={styles.adminDailyTitle}>{row.user?.name || 'Unknown'}</Text>
                          <Text style={styles.adminDailyMeta}>Phone: {row.user?.phone || '-'}</Text>
                          <Text style={styles.adminDailyMeta}>Date: {row.dateKey}</Text>
                          <Text style={styles.adminDailyMeta}>Check-in: {row.checkIn?.capturedAtLabel || '-'}</Text>
                          <Text style={styles.adminDailyMeta}>Check-out: {row.checkOut?.capturedAtLabel || '-'}</Text>
                        </View>
                        <View style={[styles.adminDailyStatusPill, statusStyle]}>
                          <Text style={[styles.adminDailyStatusPillText, statusTextStyle]}>{status.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {showTicketList && user?.role === 'admin' ? (
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-ticket')}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create Ticket</Text>
          </TouchableOpacity>
        ) : null}

        {showTicketList && isLoading ? <Text style={styles.emptyText}>Loading tickets...</Text> : null}
        {showTicketList && !isLoading && tickets.length === 0 ? <Text style={styles.emptyText}>No tickets found.</Text> : null}

        {showTicketList && tickets.map((ticket) => {
          const status = getStatusMeta(ticket.status);
          const priority = getPriorityMeta(ticket.priority);
          const assigneeName = ticket.assignedTo?.name ?? 'Unassigned';
          const initials = getInitials(assigneeName);
          const time = formatDate(ticket.createdAt);

          return (
            <View key={ticket._id} style={styles.ticketCard}>
            <View style={styles.ticketTop}>
              <View style={[styles.statusPill, { backgroundColor: status.bgColor }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
              <View style={styles.priorityWrap}>
                <View style={[styles.priorityDot, { backgroundColor: priority.dotColor }]} />
                <Text style={styles.priorityText}>{priority.label}</Text>
              </View>
            </View>

            <Text style={styles.ticketTitle}>{ticket.title}</Text>
            <Text style={styles.ticketDescription}>{ticket.description}</Text>
            <Image source={{ uri: ticket.imageUrl }} style={styles.ticketImage} />

            <View style={styles.ticketBottom}>
              <View style={styles.assigneeWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <Text style={styles.assigneeName}>{assigneeName}</Text>
              </View>

              <Text style={styles.timeText}>{time}</Text>

              {ticket.status === 'pending' && canCompleteTicket(user?.id, user?.role, ticket.assignedTo?._id) ? (
                <View style={styles.employeeActions}>
                  <TouchableOpacity style={styles.reassignBtn} onPress={() => router.push(`/reassign-ticket/${ticket._id}`)}>
                    <Ionicons name="git-branch-outline" size={12} color="#1D391D" />
                    <Text style={styles.reassignText}>Reassign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.startBtn} onPress={() => startTicket(ticket._id)}>
                    <Ionicons name="play-outline" size={12} color="#2563EB" />
                    <Text style={styles.startText}>Start Work</Text>
                  </TouchableOpacity>
                </View>
              ) : ticket.status === 'in_progress' && canCompleteTicket(user?.id, user?.role, ticket.assignedTo?._id) ? (
                <View style={styles.employeeActions}>
                  <TouchableOpacity style={styles.reassignBtn} onPress={() => router.push(`/reassign-ticket/${ticket._id}`)}>
                    <Ionicons name="git-branch-outline" size={12} color="#1D391D" />
                    <Text style={styles.reassignText}>Reassign</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.completeBtn} onPress={() => router.push(`/complete-ticket/${ticket._id}`)}>
                    <Ionicons name="checkmark-circle-outline" size={12} color="#CDAB2C" />
                    <Text style={styles.completeText}>Complete</Text>
                  </TouchableOpacity>
                </View>
              ) : user?.role === 'admin' && ticket.status !== 'completed' ? (
                <View style={styles.employeeActions}>
                  <TouchableOpacity style={styles.reassignBtn} onPress={() => router.push(`/reassign-ticket/${ticket._id}`)}>
                    <Ionicons name="git-branch-outline" size={12} color="#1D391D" />
                    <Text style={styles.reassignText}>Reassign</Text>
                  </TouchableOpacity>
                  <View style={styles.assignedStatusChip}>
                    <Ionicons
                      name={ticket.status === 'in_progress' ? 'play-outline' : 'time-outline'}
                      size={12}
                      color={ticket.status === 'in_progress' ? '#2563EB' : '#CDAB2C'}
                    />
                    <Text style={[styles.assignedStatusText, ticket.status === 'in_progress' ? styles.inProgressText : null]}>
                      {ticket.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.reassignBtn}>
                  <Ionicons name="git-branch-outline" size={12} color="#1D391D" />
                  <Text style={styles.reassignText}>Assigned</Text>
                </View>
              )}
            </View>
          </View>
          );
        })}

        {showTicketList && openTotalPages > 1 ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, openPage <= 1 ? styles.pageBtnDisabled : null]}
              disabled={openPage <= 1 || isLoading}
              onPress={() => setOpenPage(openPage - 1)}>
              <Ionicons name="chevron-back" size={18} color={openPage <= 1 ? '#9CA3AF' : '#1D391D'} />
              <Text style={[styles.pageBtnText, openPage <= 1 ? styles.pageBtnTextDisabled : null]}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {openPage} / {openTotalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, openPage >= openTotalPages ? styles.pageBtnDisabled : null]}
              disabled={openPage >= openTotalPages || isLoading}
              onPress={() => setOpenPage(openPage + 1)}>
              <Text style={[styles.pageBtnText, openPage >= openTotalPages ? styles.pageBtnTextDisabled : null]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={openPage >= openTotalPages ? '#9CA3AF' : '#1D391D'} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(previewImageUri)} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewBackdrop} onPress={() => setPreviewImageUri(null)} />
          <View style={styles.previewCard}>
            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImageUri(null)}>
              <Ionicons name="close" size={18} color="#0F172A" />
            </TouchableOpacity>
            {previewImageUri ? <Image source={{ uri: previewImageUri }} style={styles.previewLargeImage} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function getStatusMeta(status: 'pending' | 'in_progress' | 'completed') {
  if (status === 'completed') return { label: 'Completed', color: BrandColors.success, bgColor: BrandColors.successSoft };
  if (status === 'in_progress') return { label: 'In Progress', color: '#2563EB', bgColor: '#DBEAFE' };
  return { label: 'Pending', color: BrandColors.mustard, bgColor: BrandColors.mustardSoft };
}

function getPriorityMeta(priority: 'low' | 'medium' | 'high') {
  if (priority === 'high') return { label: 'High', dotColor: BrandColors.danger };
  if (priority === 'medium') return { label: 'Medium', dotColor: BrandColors.mustard };
  return { label: 'Low', dotColor: BrandColors.success };
}

function canCompleteTicket(currentUserId?: string, role?: string, assignedToId?: string) {
  if (!currentUserId) return false;
  if (role === 'admin') return false;
  return currentUserId === assignedToId;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BrandColors.appBg,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.primary,
    letterSpacing: 0.7,
  },
  profileBar: {
    marginBottom: 12,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.cardBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingRight: 2,
  },
  brandTextWrap: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', flex: 1, paddingRight: 8 },
  titleLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#E5E7EB',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  profileRole: {
    fontSize: 12,
    color: '#6D7B9A',
  },
  profileAttendanceWrap: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileAttendanceDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  profileAttendanceDotPending: { backgroundColor: '#DC2626' },
  profileAttendanceDotIn: { backgroundColor: '#D97706' },
  profileAttendanceDotDone: { backgroundColor: '#16A34A' },
  profileAttendanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  goldText: {
    fontSize: 13,
    fontWeight: '800',
    color: BrandColors.mustard,
    letterSpacing: 0.3,
  },
  coinText: {
    fontSize: 13,
    fontWeight: '800',
    color: BrandColors.danger,
    letterSpacing: 0.2,
  },
  profileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7ECE1',
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  titleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: BrandColors.cardBg,
    borderColor: BrandColors.border,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '800',
    color: '#101828',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#8B95A7',
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
  },
  sectionCount: {
    fontSize: 12,
    color: '#7E8798',
  },
  ticketCard: {
    backgroundColor: BrandColors.cardBg,
    borderColor: BrandColors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#1F2937',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  priorityText: {
    fontSize: 12,
    color: '#7E8798',
  },
  ticketTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  ticketDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#61708A',
  },
  ticketBottom: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopColor: '#EEF2F7',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  assigneeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D391D',
  },
  assigneeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  timeText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#E7ECE1',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  reassignText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D391D',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F3EFC1',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  completeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CDAB2C',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  startText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  employeeActions: {
    flexDirection: 'row',
    gap: 6,
  },
  assignedStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F5EBC4',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  assignedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CDAB2C',
  },
  inProgressText: {
    color: '#2563EB',
  },
  noticeCard: {
    marginBottom: 10,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  noticeText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    color: '#6D7B9A',
    marginBottom: 10,
  },
  createBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#1D391D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    marginBottom: 10,
    flexDirection: 'row',
    gap: 8,
  },
  actionHalf: {
    flex: 1,
  },
  adminTabRow: {
    marginTop: 6,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
  },
  adminTabRowCompact: {
    gap: 6,
  },
  adminTabBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  adminTabBtnActive: {
    borderColor: '#1D391D',
    backgroundColor: '#E7ECE1',
  },
  adminTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  adminAttendanceHelper: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  adminAttendanceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminAttendanceAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D391D',
  },
  adminAttendanceStatusPending: {
    backgroundColor: '#FEE2E2',
  },
  adminAttendanceStatusPendingText: {
    color: '#B91C1C',
  },
  adminTabTextActive: {
    color: '#1D391D',
  },
  dailyTaskBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#D8DFD1',
  },
  dailyTaskBtnText: {
    color: '#1D391D',
    fontWeight: '700',
    fontSize: 14,
  },
  adminDailyWrap: {
    marginBottom: 12,
  },
  adminDailyDateBar: {
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminDailyDateBtn: {
    minWidth: 86,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDailyDateBtnText: { color: '#1D391D', fontWeight: '700', fontSize: 12 },
  adminDailyDateBtnDisabled: { opacity: 0.45 },
  adminDailyDateCenter: { alignItems: 'center' },
  adminDailyDateLabel: { fontSize: 11, color: '#6B7280' },
  adminDailyDateValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  adminDailyTodayBtn: { alignSelf: 'center', marginBottom: 8 },
  adminDailyTodayText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  adminDailyCard: {
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  adminDailyTop: {
    display: 'none',
  },
  adminDailyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  adminDailyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  adminDailyInfo: {
    flex: 1,
  },
  adminDailyMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: '#4B5563',
  },
  adminDailyStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adminDailyStatusOpen: {
    backgroundColor: '#FEF3C7',
  },
  adminDailyStatusDone: {
    backgroundColor: '#DCFCE7',
  },
  adminDailyStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminDailyStatusOpenText: {
    color: '#B45309',
  },
  adminDailyStatusDoneText: {
    color: '#15803D',
  },
  adminDailyThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  adminDailyThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDailyThumbPlaceholderText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  previewClose: {
    alignSelf: 'flex-end',
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  previewLargeImage: {
    width: '100%',
    height: 360,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  attendanceInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  attendanceInlineWrapOff: {
    borderColor: '#D8DFD1',
  },
  attendanceInlineWrapOn: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  attendanceInlineWrapLoading: {
    opacity: 0.7,
  },
  attendanceInlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  attendanceInlineDotOff: {
    backgroundColor: '#94A3B8',
  },
  attendanceInlineDotOn: {
    backgroundColor: '#16A34A',
  },
  attendanceInlineLabel: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 20,
  },
  attendanceInlineLabelOff: {
    color: '#64748B',
  },
  attendanceInlineLabelOn: {
    color: '#15803D',
  },
  attendanceSwitch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
    marginRight: -4,
  },
  attendanceError: { marginTop: 4, color: '#B91C1C', fontSize: 11, fontWeight: '600' },
  ticketImage: {
    marginTop: 10,
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  paginationRow: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.cardBg,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
});
