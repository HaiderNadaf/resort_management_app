import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

export const TICKETS_PAGE_SIZE = 10;

type TicketStatus = 'pending' | 'in_progress' | 'completed';
type TicketPriority = 'low' | 'medium' | 'high';

export type Ticket = {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  completionImageUrl?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: {
    _id: string;
    name: string;
    role: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    role: string;
  } | null;
  assignmentHistory?: Array<{
    assignedBy?: { _id: string; name: string; role: string; department?: string | null } | null;
    assignedTo?: { _id: string; name: string; role: string; department?: string | null } | null;
    department?: string | null;
    assignedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type TicketSummary = {
  totalOpen: number;
  pendingCount: number;
  inProgressCount: number;
  listScopeTotal: number;
  employeeUnionTotal: number | null;
  assignedToYouTotal: number;
  assignedOpenTicketIds: string[];
};

type TicketsPageResponse = {
  count: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  tickets: Ticket[];
};

type TicketContextValue = {
  /** Open (non-completed) tickets for the current home page. */
  tickets: Ticket[];
  /** Completed tickets for the current completed tab page. */
  completedTickets: Ticket[];
  ticketSummary: TicketSummary | null;
  isLoading: boolean;
  isLoadingCompleted: boolean;
  openPage: number;
  openTotalPages: number;
  openTotalCount: number;
  completedPage: number;
  completedTotalPages: number;
  completedTotalCount: number;
  setOpenPage: (page: number) => void;
  setCompletedPage: (page: number) => void;
  assignedNotificationCount: number;
  refreshTickets: () => Promise<void>;
  createTicket: (payload: CreateTicketPayload) => Promise<void>;
  startTicket: (ticketId: string) => Promise<void>;
  completeTicket: (ticketId: string, imageUri: string) => Promise<void>;
  reassignTicket: (ticketId: string, assignedTo: string, department?: string) => Promise<void>;
  markAssignedNotificationsRead: () => Promise<void>;
};

type CreateTicketPayload = {
  title: string;
  description: string;
  imageUri: string;
  priority: TicketPriority;
  department: string;
  assignedTo: string;
};

const TicketContext = createContext<TicketContextValue | null>(null);

function employeeListQuery(): string {
  return `assignedToMe=true`;
}

export function TicketProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, user, signOut } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary | null>(null);
  const [assignedOpenTicketIds, setAssignedOpenTicketIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [openPage, setOpenPageState] = useState(1);
  const [openTotalPages, setOpenTotalPages] = useState(1);
  const [openTotalCount, setOpenTotalCount] = useState(0);
  const [completedPage, setCompletedPageState] = useState(1);
  const [completedTotalPages, setCompletedTotalPages] = useState(1);
  const [completedTotalCount, setCompletedTotalCount] = useState(0);
  const [assignedNotificationCount, setAssignedNotificationCount] = useState(0);

  const getSeenKey = () => `seen_assigned_tickets_${user?.id ?? 'guest'}`;

  const updateAssignedNotificationCount = useCallback(
    async (openIds: string[]) => {
      setAssignedOpenTicketIds(openIds);
      if (!user?.id) {
        setAssignedNotificationCount(0);
        return;
      }
      const seenKey = getSeenKey();
      const seenRaw = await AsyncStorage.getItem(seenKey);
      const seenIds = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);
      const unseen = openIds.filter((id) => !seenIds.has(id));
      setAssignedNotificationCount(unseen.length);
    },
    [user?.id]
  );

  const fetchSummary = useCallback(async () => {
    if (!token) {
      setTicketSummary(null);
      return;
    }
    const q = user?.role === 'employee' ? `?${employeeListQuery()}` : '';
    const data = await apiRequest<TicketSummary>(`/api/tickets/summary${q}`, { token });
    setTicketSummary(data);
    await updateAssignedNotificationCount(data.assignedOpenTicketIds || []);
  }, [token, user?.role, updateAssignedNotificationCount]);

  const fetchOpenPage = useCallback(
    async (page: number) => {
      if (!token) {
        setTickets([]);
        setOpenTotalPages(1);
        setOpenTotalCount(0);
        return;
      }
      if (user?.role === 'employee' && !user?.id) {
        return;
      }
      const p = Math.max(1, page);
      const base = `page=${p}&limit=${TICKETS_PAGE_SIZE}&openOnly=true`;
      const emp = user?.role === 'employee' ? `&${employeeListQuery()}` : '';
      const response = await apiRequest<TicketsPageResponse>(`/api/tickets?${base}${emp}`, { token });
      setTickets(response.tickets);
      setOpenTotalPages(response.totalPages);
      setOpenTotalCount(response.totalCount);
      setOpenPageState(response.page);
    },
    [token, user?.id, user?.role]
  );

  const fetchCompletedPage = useCallback(
    async (page: number) => {
      if (!token) {
        setCompletedTickets([]);
        setCompletedTotalPages(1);
        setCompletedTotalCount(0);
        return;
      }
      if (user?.role === 'employee' && !user?.id) {
        return;
      }
      const p = Math.max(1, page);
      const base = `page=${p}&limit=${TICKETS_PAGE_SIZE}&status=completed`;
      const emp = user?.role === 'employee' ? `&${employeeListQuery()}` : '';
      const response = await apiRequest<TicketsPageResponse>(`/api/tickets?${base}${emp}`, { token });
      setCompletedTickets(response.tickets);
      setCompletedTotalPages(response.totalPages);
      setCompletedTotalCount(response.totalCount);
      setCompletedPageState(response.page);
    },
    [token, user?.id, user?.role]
  );

  const refreshTickets = useCallback(async () => {
    if (!token) {
      setTickets([]);
      setCompletedTickets([]);
      setTicketSummary(null);
      setAssignedNotificationCount(0);
      setOpenPageState(1);
      setCompletedPageState(1);
      return;
    }
    if (user?.role === 'employee' && !user?.id) {
      return;
    }
    setIsLoading(true);
    setIsLoadingCompleted(true);
    try {
      await fetchSummary();
      await Promise.all([fetchOpenPage(1), fetchCompletedPage(1)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      if (/not authorized|user not found/i.test(message)) {
        await signOut();
        return;
      }
      throw error;
    } finally {
      setIsLoading(false);
      setIsLoadingCompleted(false);
    }
  }, [token, user?.id, user?.role, signOut, fetchSummary, fetchOpenPage, fetchCompletedPage]);

  const setOpenPageSafe = useCallback(
    async (page: number) => {
      if (!token) return;
      setIsLoading(true);
      try {
        await fetchOpenPage(page);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        if (/not authorized|user not found/i.test(message)) {
          await signOut();
          return;
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [token, signOut, fetchOpenPage]
  );

  const setCompletedPageSafe = useCallback(
    async (page: number) => {
      if (!token) return;
      setIsLoadingCompleted(true);
      try {
        await fetchCompletedPage(page);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        if (/not authorized|user not found/i.test(message)) {
          await signOut();
          return;
        }
        throw error;
      } finally {
        setIsLoadingCompleted(false);
      }
    },
    [token, signOut, fetchCompletedPage]
  );

  const createTicket = async (payload: CreateTicketPayload) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('priority', payload.priority);
    formData.append('department', payload.department);
    formData.append('assignedTo', payload.assignedTo);
    formData.append('image', {
      uri: payload.imageUri,
      type: 'image/jpeg',
      name: `ticket-${Date.now()}.jpg`,
    } as unknown as Blob);

    await apiRequest<Ticket>('/api/tickets', {
      method: 'POST',
      body: formData,
      token,
      isFormData: true,
    });
    await refreshTickets();
  };

  const completeTicket = async (ticketId: string, imageUri: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `ticket-complete-${Date.now()}.jpg`,
    } as unknown as Blob);

    await apiRequest<Ticket>(`/api/tickets/${ticketId}/complete`, {
      method: 'PATCH',
      body: formData,
      token,
      isFormData: true,
    });
    await refreshTickets();
  };

  const startTicket = async (ticketId: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await apiRequest<Ticket>(`/api/tickets/${ticketId}/start`, {
      method: 'PATCH',
      token,
    });
    await refreshTickets();
  };

  const reassignTicket = async (ticketId: string, assignedTo: string, department?: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await apiRequest<Ticket>(`/api/tickets/${ticketId}/reassign`, {
      method: 'PATCH',
      body: { assignedTo, department },
      token,
    });
    await refreshTickets();
  };

  const markAssignedNotificationsRead = async () => {
    if (!user?.id) return;
    const seenKey = getSeenKey();
    const seenRaw = await AsyncStorage.getItem(seenKey);
    const seen = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);
    const ids = assignedOpenTicketIds.length > 0 ? assignedOpenTicketIds : tickets.map((t) => t._id);
    ids.forEach((id) => seen.add(id));
    await AsyncStorage.setItem(seenKey, JSON.stringify([...seen]));
    setAssignedNotificationCount(0);
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      refreshTickets().catch(() => {});
    } else {
      setTickets([]);
      setCompletedTickets([]);
      setTicketSummary(null);
      setAssignedNotificationCount(0);
      setOpenPageState(1);
      setCompletedPageState(1);
    }
  }, [isAuthenticated, token, user?.id, refreshTickets]);

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        refreshTickets().catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [token, isAuthenticated, refreshTickets]);

  const value: TicketContextValue = {
    tickets,
    completedTickets,
    ticketSummary,
    isLoading,
    isLoadingCompleted,
    openPage,
    openTotalPages,
    openTotalCount,
    completedPage,
    completedTotalPages,
    completedTotalCount,
    setOpenPage: (page: number) => {
      void setOpenPageSafe(page);
    },
    setCompletedPage: (page: number) => {
      void setCompletedPageSafe(page);
    },
    assignedNotificationCount,
    refreshTickets,
    createTicket,
    startTicket,
    completeTicket,
    reassignTicket,
    markAssignedNotificationsRead,
  };

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used inside TicketProvider');
  }
  return context;
}
