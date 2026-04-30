import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';
import { apiRequest } from '@/lib/api';

export default function HomeScreen() {
  const SWIPE_TRACK_WIDTH = 188;
  const SWIPE_THUMB_WIDTH = 40;
  const SWIPE_MAX_X = (SWIPE_TRACK_WIDTH - 6) / 2;
  const SWIPE_CENTER_X = SWIPE_MAX_X / 2;
  const SWIPE_TRIGGER_GAP = 20;
  const router = useRouter();
  const { user, token } = useAuth();
  const { tickets, isLoading, assignedNotificationCount, markAssignedNotificationsRead, startTicket } = useTickets();
  const [attendance, setAttendance] = useState<{
    checkedIn: boolean;
    checkedOut: boolean;
    checkIn?: { capturedAt?: string } | null;
    checkOut?: { capturedAt?: string } | null;
  } | null>(null);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const openTickets = tickets.filter((ticket) => ticket.status !== 'completed');
  const pendingCount = tickets.filter((ticket) => ticket.status === 'pending').length;
  const activeCount = tickets.filter((ticket) => ticket.status === 'in_progress').length;
  const recentTickets = openTickets.slice(0, 10);
  const attendanceStatusLabel = useMemo(() => {
    const inAt = attendance?.checkIn?.capturedAt ? new Date(attendance.checkIn.capturedAt).getTime() : 0;
    const outAt = attendance?.checkOut?.capturedAt ? new Date(attendance.checkOut.capturedAt).getTime() : 0;
    if (!inAt && !outAt) return 'Not Marked';
    return outAt > inAt ? 'Checked Out' : 'Checked In';
  }, [attendance]);
  const swipeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    swipeX.setValue(SWIPE_CENTER_X);
  }, [swipeX, SWIPE_CENTER_X]);

  const animateThumbTo = (value: number) => {
    Animated.spring(swipeX, {
      toValue: value,
      useNativeDriver: false,
      friction: 7,
      tension: 90,
    }).start();
  };

  const attendancePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          if (attendanceLoading) return;
          const next = Math.max(0, Math.min(SWIPE_MAX_X, SWIPE_CENTER_X + gestureState.dx));
          swipeX.setValue(next);
        },
        onPanResponderRelease: () => {
          if (attendanceLoading) return;
          swipeX.stopAnimation((currentX) => {
            if (currentX >= SWIPE_CENTER_X + SWIPE_TRIGGER_GAP) {
              animateThumbTo(SWIPE_MAX_X);
              captureAndSubmitAttendance('check-in');
            } else if (currentX <= SWIPE_CENTER_X - SWIPE_TRIGGER_GAP) {
              animateThumbTo(0);
              captureAndSubmitAttendance('check-out');
            } else {
              animateThumbTo(SWIPE_CENTER_X);
            }
          });
        },
      }),
    [attendanceLoading, swipeX, SWIPE_CENTER_X, SWIPE_MAX_X, SWIPE_TRIGGER_GAP]
  );

  useEffect(() => {
    if (!token) return;
    apiRequest<{ checkedIn: boolean; checkedOut: boolean; checkIn?: { capturedAt?: string } | null; checkOut?: { capturedAt?: string } | null }>(
      '/api/attendance/today',
      { token }
    )
      .then(setAttendance)
      .catch((e) => setAttendanceError(e instanceof Error ? e.message : 'Failed to load attendance status'));
  }, [token]);

  const captureAndSubmitAttendance = async (type: 'check-in' | 'check-out') => {
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

      await apiRequest(`/api/attendance/${type}`, {
        method: 'POST',
        token,
        body: {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        },
      });

      const refreshed = await apiRequest<{
        checkedIn: boolean;
        checkedOut: boolean;
        checkIn?: { capturedAt?: string } | null;
        checkOut?: { capturedAt?: string } | null;
      }>('/api/attendance/today', { token });
      setAttendance(refreshed);
    } catch (e) {
      setAttendanceError(e instanceof Error ? e.message : 'Failed to update attendance');
    } finally {
      setAttendanceLoading(false);
      animateThumbTo(SWIPE_CENTER_X);
    }
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.goldCoinRow}>
                <Text style={styles.goldText}>Gold</Text>
                <Text style={styles.coinText}> coins & clubs</Text>
                <Image source={require('@/assets/images/logo.png')} style={styles.titleLogo} />
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
                    attendance?.checkedOut
                      ? styles.profileAttendanceDotDone
                      : attendance?.checkedIn
                      ? styles.profileAttendanceDotIn
                      : styles.profileAttendanceDotPending,
                  ]}
                />
                <Text style={styles.profileAttendanceText}>{attendanceStatusLabel}</Text>
              </View>
            </View>
           
          </View>
          <View style={styles.profileIconWrap}>
            <Ionicons name="notifications-outline" size={18} color="#1D391D" />
          </View>
        </View>

        <Text style={styles.kicker}>{user?.role === 'admin' ? 'ADMIN DASHBOARD' : 'EMPLOYEE DASHBOARD'}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>All Tickets</Text>
          {user ? (
            <View style={styles.attendanceInlineWrap}>
              <View style={styles.swipeTrack}>
                <Animated.View
                  {...attendancePanResponder.panHandlers}
                  style={[
                    styles.swipeThumb,
                    {
                      transform: [{ translateX: swipeX }],
                      backgroundColor: '#334155',
                    },
                  ]}>
                  <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
                </Animated.View>
                <View pointerEvents="none" style={styles.swipeSegmentRow}>
                  <View style={styles.swipeSegment}>
                    <Text style={styles.swipeSegmentText}>Check In</Text>
                  </View>
                  <View style={styles.swipeSegment}>
                    <Text style={styles.swipeSegmentText}>Check Out</Text>
                  </View>
                </View>
              </View>
              <View style={styles.attendanceStatusRow}>
                <View
                  style={[
                    styles.attendanceStatusDot,
                    attendance?.checkedOut
                      ? styles.attendanceStatusDotDone
                      : attendance?.checkedIn
                      ? styles.attendanceStatusDotIn
                      : styles.attendanceStatusDotPending,
                  ]}
                />
                <Text style={styles.attendanceInlineStatus}>
                  {attendanceLoading ? 'Updating...' : `${attendanceStatusLabel} (swipe both ways)`}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
        {attendanceError ? <Text style={styles.attendanceError}>{attendanceError}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#E7ECE1' }]}>
              <Ionicons name="briefcase-outline" size={14} color="#1D391D" />
            </View>
            <Text style={styles.statNumber}>{tickets.length}</Text>
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tickets</Text>
          <Text style={styles.sectionCount}>{openTickets.length} open</Text>
        </View>

        {user?.role === 'employee' && assignedNotificationCount > 0 ? (
          <TouchableOpacity style={styles.noticeCard} onPress={markAssignedNotificationsRead}>
            <Ionicons name="notifications-outline" size={16} color="#1D391D" />
            <Text style={styles.noticeText}>
              You have {assignedNotificationCount} new assigned ticket{assignedNotificationCount > 1 ? 's' : ''}.
            </Text>
          </TouchableOpacity>
        ) : null}

        {user ? (
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-ticket')}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create Ticket</Text>
          </TouchableOpacity>
        ) : null}
        {isLoading ? <Text style={styles.emptyText}>Loading tickets...</Text> : null}
        {!isLoading && recentTickets.length === 0 ? <Text style={styles.emptyText}>No tickets found.</Text> : null}

        {recentTickets.map((ticket) => {
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
      </ScrollView>
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
    paddingTop: 56,
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.primary,
    letterSpacing: 0.7,
  },
  profileBar: {
    marginBottom: 10,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  titleLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 4,
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
  goldCoinRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  goldText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CDAB2C',
  },
  coinText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#701011',
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
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DFD1',
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
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DFD1',
    borderWidth: 1,
    borderRadius: 16,
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
    marginBottom: 10,
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
  attendanceInlineWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  swipeTrack: {
    width: 188,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#E8EDF4',
    borderWidth: 1,
    borderColor: '#D8DFD1',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 91,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  swipeSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
  },
  swipeSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  attendanceStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendanceStatusDot: { width: 7, height: 7, borderRadius: 999 },
  attendanceStatusDotPending: { backgroundColor: '#DC2626' },
  attendanceStatusDotIn: { backgroundColor: '#D97706' },
  attendanceStatusDotDone: { backgroundColor: '#16A34A' },
  attendanceInlineStatus: { fontSize: 11, fontWeight: '700', color: '#334155' },
  attendanceError: { marginTop: 6, color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  ticketImage: {
    marginTop: 10,
    width: '100%',
    height: 170,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
});
