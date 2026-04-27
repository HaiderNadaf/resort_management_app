import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useTickets } from '@/context/ticket-context';
import { apiRequest } from '@/lib/api';

type Employee = {
  _id: string;
  name: string;
  department?: string | null;
};

export default function ReassignTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const { reassignTicket } = useTickets();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setError('');
        const response = await apiRequest<{ employees: Employee[] }>('/api/auth/department-employees', { token });
        setEmployees(response.employees.filter((item) => item._id !== user?.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load employees');
      }
    };
    load();
  }, [token, user?.id]);

  const submit = async () => {
    if (!id || !assignedTo) {
      setError('Please select employee');
      return;
    }
    setIsSubmitting(true);
    try {
      await reassignTicket(String(id), assignedTo);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reassign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Reassign Ticket</Text>
        <Text style={styles.sub}>Department: {user?.department ?? '-'}</Text>

        <View style={styles.wrap}>
          {employees.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[styles.chip, assignedTo === item._id ? styles.chipActive : null]}
              onPress={() => setAssignedTo(item._id)}>
              <Text style={[styles.chipText, assignedTo === item._id ? styles.chipTextActive : null]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {employees.length === 0 ? (
          <Text style={styles.info}>No other employee found in your department for reassignment.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={isSubmitting}>
          <Text style={styles.submitText}>{isSubmitting ? 'Updating...' : 'Reassign'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 6, fontSize: 13, color: '#64748B' },
  wrap: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DFD1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { borderColor: '#1D391D', backgroundColor: '#E7ECE1' },
  chipText: { color: '#27344D', fontSize: 12 },
  chipTextActive: { color: '#1D391D', fontWeight: '700' },
  info: { marginTop: 12, color: '#64748B', fontWeight: '500' },
  error: { marginTop: 12, color: '#DC2626', fontWeight: '600' },
  submitBtn: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#1D391D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
