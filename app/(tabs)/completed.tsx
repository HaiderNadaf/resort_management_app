import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandColors } from '@/constants/brand';
import { useTickets } from '@/context/ticket-context';

export default function CompletedScreen() {
  const {
    completedTickets,
    isLoadingCompleted,
    completedPage,
    completedTotalPages,
    completedTotalCount,
    setCompletedPage,
  } = useTickets();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>DONE & DUSTED</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Completed</Text>
          <Text style={styles.bigCount}>{completedTotalCount}</Text>
        </View>

        <Text style={styles.subtitle}>
          tickets resolved · page {completedPage} of {completedTotalPages}
        </Text>

        {isLoadingCompleted ? <Text style={styles.emptyText}>Loading completed tickets...</Text> : null}
        {!isLoadingCompleted && completedTickets.length === 0 ? (
          <Text style={styles.emptyText}>No completed tickets yet.</Text>
        ) : null}

        {completedTickets.map((ticket) => {
          const priority = getPriorityMeta(ticket.priority);
          const assigneeName = ticket.assignedTo?.name ?? 'Unassigned';
          const initials = getInitials(assigneeName);
          return (
            <View key={ticket._id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.donePill}>
                <Ionicons name="checkmark-circle-outline" size={13} color="#CDAB2C" />
                <Text style={styles.doneText}>Completed</Text>
              </View>
              <View style={styles.priorityWrap}>
                <View style={[styles.priorityDot, { backgroundColor: priority.dotColor }]} />
                <Text style={styles.priorityText}>{priority.label}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{ticket.title}</Text>
            <Text style={styles.cardDescription}>{ticket.description}</Text>
            <View style={styles.imageRow}>
              <View style={styles.imageCol}>
                <Text style={styles.imageLabel}>Before</Text>
                <Image source={{ uri: ticket.imageUrl }} style={styles.ticketImage} />
              </View>
              <View style={styles.imageCol}>
                <Text style={styles.imageLabel}>After</Text>
                {ticket.completionImageUrl ? (
                  <Image source={{ uri: ticket.completionImageUrl }} style={styles.ticketImage} />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Text style={styles.placeholderText}>No image</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cardBottom}>
              <View style={styles.assigneeWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <Text style={styles.assigneeName}>{assigneeName}</Text>
              </View>
              <Text style={styles.timeText}>{formatDate(ticket.createdAt)}</Text>
              <View style={styles.reassignBtn}>
                <Ionicons name="git-branch-outline" size={12} color="#1D391D" />
                <Text style={styles.reassignText}>Reassign</Text>
              </View>
            </View>
          </View>
          );
        })}

        {completedTotalPages > 1 ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, completedPage <= 1 ? styles.pageBtnDisabled : null]}
              disabled={completedPage <= 1 || isLoadingCompleted}
              onPress={() => setCompletedPage(completedPage - 1)}>
              <Ionicons name="chevron-back" size={18} color={completedPage <= 1 ? '#9CA3AF' : '#1D391D'} />
              <Text style={[styles.pageBtnText, completedPage <= 1 ? styles.pageBtnTextDisabled : null]}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {completedPage} / {completedTotalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, completedPage >= completedTotalPages ? styles.pageBtnDisabled : null]}
              disabled={completedPage >= completedTotalPages || isLoadingCompleted}
              onPress={() => setCompletedPage(completedPage + 1)}>
              <Text
                style={[styles.pageBtnText, completedPage >= completedTotalPages ? styles.pageBtnTextDisabled : null]}>
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={completedPage >= completedTotalPages ? '#9CA3AF' : '#1D391D'}
              />
            </TouchableOpacity>
          </View>
        ) : null}
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

function getPriorityMeta(priority: 'low' | 'medium' | 'high') {
  if (priority === 'high') return { label: 'High', dotColor: BrandColors.danger };
  if (priority === 'medium') return { label: 'Medium', dotColor: BrandColors.mustard };
  return { label: 'Low', dotColor: BrandColors.success };
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
  title: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  titleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bigCount: {
    marginTop: 0,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: -2,
    fontSize: 14,
    color: '#6D7B9A',
  },
  card: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DFD1',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#F3EFC1',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CDAB2C',
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
  cardTitle: {
    marginTop: 12,
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  cardDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#61708A',
  },
  cardBottom: {
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
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6D7B9A',
  },
  paginationRow: {
    marginTop: 20,
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
  imageRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  imageCol: {
    flex: 1,
  },
  ticketImage: {
    marginTop: 6,
    width: '100%',
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  placeholderImage: {
    marginTop: 6,
    width: '100%',
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
