import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandColors } from '@/constants/brand';
import { EMPLOYEE_DEPARTMENTS, useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';
import { apiRequest } from '@/lib/api';

type Employee = {
  _id: string;
  name: string;
  role: 'admin' | 'employee';
  department?: string | null;
};

export default function ReassignTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const { reassignTicket } = useTickets();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [department, setDepartment] = useState(user?.department ?? '');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDepartmentAdmin = user?.role === 'admin' && !user?.isMainAdmin;

  useEffect(() => {
    if (!department && user?.department) {
      setDepartment(user.department);
    }
  }, [department, user?.department]);

  useEffect(() => {
    const load = async () => {
      if (!token || !department) {
        setEmployees([]);
        return;
      }
      try {
        setError('');
        const response = await apiRequest<{ users: Employee[] }>(
          `/api/tickets/assignable-users?department=${encodeURIComponent(department)}`,
          { token }
        );
        setEmployees(response.users.filter((item) => item._id !== user?.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load employees');
      }
    };
    load();
  }, [token, user?.id, department]);

  const submit = async () => {
    if (!id || !assignedTo) {
      setError('Please select a person to assign this ticket to.');
      return;
    }
    setIsSubmitting(true);
    try {
      await reassignTicket(String(id), assignedTo, department);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reassign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployee = employees.find((e) => e._id === assignedTo);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reassign ticket</Text>
        <Text style={styles.lead}>Choose the department first, then pick who should own this ticket.</Text>

        {isDepartmentAdmin ? (
          <View style={styles.infoBanner}>
            <Ionicons name="business-outline" size={18} color={BrandColors.primary} />
            <View style={styles.infoBannerTextWrap}>
              <Text style={styles.infoBannerLabel}>Your department</Text>
              <Text style={styles.infoBannerValue}>{department || user?.department || '—'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Department</Text>
                <Text style={styles.sectionHint}>Which team should handle this ticket?</Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              {EMPLOYEE_DEPARTMENTS.map((item) => {
                const active = department === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.deptRow, active && styles.deptRowActive]}
                    onPress={() => {
                      setDepartment(item);
                      setAssignedTo('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.deptRowLabel, active && styles.deptRowLabelActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Assign to</Text>
              <Text style={styles.sectionHint}>
                {department
                  ? `People you can assign in “${department}”.`
                  : 'Select a department above to see people here.'}
              </Text>
            </View>
          </View>
          <View style={styles.sectionBody}>
            {employees.length === 0 ? (
              <Text style={styles.emptyText}>
                {isDepartmentAdmin
                  ? 'No employees found in your department.'
                  : department
                    ? 'No assignable users for this department.'
                    : 'Choose a department in step 1.'}
              </Text>
            ) : (
              employees.map((item) => {
                const active = assignedTo === item._id;
                const roleLabel = item.role === 'admin' ? 'Admin' : 'Employee';
                return (
                  <TouchableOpacity
                    key={item._id}
                    style={[styles.userRow, active && styles.userRowActive]}
                    onPress={() => setAssignedTo(item._id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.userMeta}>
                      <Text style={[styles.userName, active && styles.userNameActive]}>{item.name}</Text>
                      <Text style={styles.userRole}>{roleLabel}</Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={BrandColors.primary} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {selectedEmployee ? (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Summary</Text>
            <Text style={styles.summaryText}>
              Ticket will go to <Text style={styles.summaryStrong}>{selectedEmployee.name}</Text>
              {department ? (
                <>
                  {' '}
                  in <Text style={styles.summaryStrong}>{department}</Text>
                </>
              ) : null}
              .
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? 'Updating…' : 'Confirm reassignment'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BrandColors.appBg },
  scrollContent: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: BrandColors.text },
  lead: { marginTop: 8, fontSize: 14, color: BrandColors.muted, fontWeight: '600', lineHeight: 20 },
  infoBanner: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.cardBg,
  },
  infoBannerTextWrap: { flex: 1 },
  infoBannerLabel: { fontSize: 11, fontWeight: '700', color: BrandColors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoBannerValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: BrandColors.text },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  sectionHeaderText: { flex: 1, paddingTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: BrandColors.text },
  sectionHint: { marginTop: 4, fontSize: 13, color: BrandColors.muted, fontWeight: '600', lineHeight: 18 },
  sectionBody: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.cardBg,
    overflow: 'hidden',
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F0',
  },
  deptRowActive: { backgroundColor: BrandColors.primarySoft },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: BrandColors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.primary },
  deptRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#374151' },
  deptRowLabelActive: { color: BrandColors.primary, fontWeight: '800' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F0',
  },
  userRowActive: { backgroundColor: BrandColors.primarySoft },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontSize: 16, fontWeight: '800', color: BrandColors.primary },
  userMeta: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: BrandColors.text },
  userNameActive: { color: BrandColors.primary },
  userRole: { marginTop: 2, fontSize: 12, fontWeight: '600', color: BrandColors.muted },
  emptyText: { padding: 16, fontSize: 14, color: BrandColors.muted, fontWeight: '600', textAlign: 'center' },
  summary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#4338CA', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryText: { marginTop: 6, fontSize: 14, color: '#312E81', fontWeight: '600', lineHeight: 20 },
  summaryStrong: { fontWeight: '800', color: '#1E1B4B' },
  error: { marginTop: 12, color: '#DC2626', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
