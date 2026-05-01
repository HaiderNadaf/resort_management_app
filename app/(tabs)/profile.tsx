import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, pushTokenSyncError } = useAuth();
  const { tickets } = useTickets();
  const assignedToMeCount = tickets.filter((ticket) => ticket.assignedTo?._id === user?.id).length;

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <Text style={styles.kicker}>ACCOUNT</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
          <Image source={require('@/assets/images/logo.png')} style={styles.titleLogo} />
        </View>
        <Text style={styles.subtitle}>Manage your account and ticket overview.</Text>

        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            {user?.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name ?? 'User')}</Text>
              </View>
            )}
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.name}>{user?.name ?? '-'}</Text>
            <Text style={styles.email}>{user?.phone ?? '-'}</Text>
            <View style={styles.infoRow}>
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark-outline" size={12} color="#1D391D" />
                <Text style={styles.roleText}>{user?.role === 'employee' ? 'Employee' : 'Admin'}</Text>
              </View>
              {user?.department ? (
                <View style={styles.departmentPill}>
                  <Ionicons name="business-outline" size={12} color="#1D391D" />
                  <Text style={styles.departmentPillText}>{user.department}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{assignedToMeCount}</Text>
            <Text style={styles.metricLabel}>Assigned to me</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{tickets.length}</Text>
            <Text style={styles.metricLabel}>Total in system</Text>
          </View>
        </View>

        {pushTokenSyncError ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Push notifications may not work</Text>
            <Text style={styles.warnText}>{pushTokenSyncError}</Text>
          </View>
        ) : null}

        <View style={styles.menuCard}>
          <MenuItem icon="notifications-outline" label="Notifications" />
          <MenuItem icon="settings-outline" label="Preferences" />
          <MenuItem icon="help-circle-outline" label="Help & Support" isLast />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
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

function MenuItem({
  icon,
  label,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.menuItem, isLast ? styles.menuItemLast : null]}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconWrap}>
          <Ionicons name={icon} size={15} color="#1D391D" />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8A94A6" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BrandColors.appBg,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 20,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.primary,
    letterSpacing: 0.7,
  },
  title: {
    marginTop: 0,
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  titleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6D7B9A',
  },
  userCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarWrap: {
    width: 70,
    height: 70,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#E5E7EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  userMeta: {
    flex: 1,
    paddingTop: 2,
  },
  name: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: '#111827',
  },
  email: {
    marginTop: 3,
    fontSize: 14,
    color: '#6D7B9A',
  },
  infoRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E7ECE1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 12,
    color: '#1D391D',
    fontWeight: '700',
  },
  departmentPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  departmentPillText: {
    fontSize: 12,
    color: '#1D391D',
    fontWeight: '700',
  },
  metricsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  metricNumber: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#111827',
  },
  metricLabel: {
    marginTop: 5,
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '600',
  },
  warnBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warnTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  warnText: {
    marginTop: 2,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  menuCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DFD1',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  menuItem: {
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7ECE1',
  },
  menuLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#701011',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
