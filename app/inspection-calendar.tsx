import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useRoomInspections } from '@/context/room-inspection-context';

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function label(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function dayColor(color: 'green' | 'yellow' | 'red') {
  if (color === 'green') return '#16A34A';
  if (color === 'yellow') return '#EAB308';
  return '#DC2626';
}

export default function InspectionCalendarScreen() {
  const { loadCalendar, getCalendarDays } = useRoomInspections();
  const [cursor, setCursor] = useState(new Date());
  const key = monthKey(cursor);
  const days = getCalendarDays(key);

  useEffect(() => {
    loadCalendar(key).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sorted = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days]);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Monthly Tracking</Text>
        <View style={styles.monthRow}>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() - 1);
              setCursor(d);
            }}>
            <Text style={styles.monthBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{label(cursor)}</Text>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => {
              const d = new Date(cursor);
              d.setMonth(d.getMonth() + 1);
              setCursor(d);
            }}>
            <Text style={styles.monthBtnText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legendRow}>
          <Legend color="#16A34A" label="All rooms checked" />
          <Legend color="#EAB308" label="Partially done" />
          <Legend color="#DC2626" label="Not done" />
        </View>

        {sorted.length === 0 ? <Text style={styles.helper}>No data for this month.</Text> : null}
        {sorted.map((day) => (
          <View key={day.date} style={styles.dayCard}>
            <View style={[styles.dot, { backgroundColor: dayColor(day.color) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dayText}>{day.date}</Text>
              <Text style={styles.daySub}>
                {day.completed}/{day.total} completed
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F2F5EE' },
  container: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  monthRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: {
    minWidth: 70,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#E7ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { color: '#1D391D', fontWeight: '700', fontSize: 13 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: '#111827' },
  legendRow: { marginTop: 12, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  helper: { marginTop: 16, color: '#64748B', fontSize: 13 },
  dayCard: {
    marginTop: 10,
    borderRadius: 12,
    borderColor: '#D8DFD1',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dot: { width: 14, height: 14, borderRadius: 999 },
  dayText: { color: '#111827', fontSize: 15, fontWeight: '700' },
  daySub: { marginTop: 3, color: '#6B7280', fontSize: 12, fontWeight: '600' },
});
