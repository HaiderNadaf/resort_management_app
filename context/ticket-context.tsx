import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

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
  createdAt: string;
  updatedAt: string;
};

type TicketContextValue = {
  tickets: Ticket[];
  isLoading: boolean;
  assignedNotificationCount: number;
  refreshTickets: () => Promise<void>;
  createTicket: (payload: CreateTicketPayload) => Promise<void>;
  startTicket: (ticketId: string) => Promise<void>;
  completeTicket: (ticketId: string, imageUri: string) => Promise<void>;
  reassignTicket: (ticketId: string, assignedTo: string) => Promise<void>;
  markAssignedNotificationsRead: () => Promise<void>;
};

type CreateTicketPayload = {
  title: string;
  description: string;
  imageUri: string;
  priority: TicketPriority;
  assignedTo: string;
};

const TicketContext = createContext<TicketContextValue | null>(null);

export function TicketProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assignedNotificationCount, setAssignedNotificationCount] = useState(0);

  const getSeenKey = () => `seen_assigned_tickets_${user?.id ?? 'guest'}`;

  const refreshTickets = async () => {
    if (!token) {
      setTickets([]);
      setAssignedNotificationCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiRequest<{ count: number; tickets: Ticket[] }>('/api/tickets', {
        token,
      });
      const scopedTickets =
        user?.role === 'employee' && user.id
          ? response.tickets.filter((ticket) => ticket.assignedTo?._id === user.id)
          : response.tickets;
      setTickets(scopedTickets);

      if (user?.id) {
        const seenKey = getSeenKey();
        const seenRaw = await AsyncStorage.getItem(seenKey);
        const seenIds = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);

        const assignedToMe = scopedTickets.filter(
          (ticket) => ticket.assignedTo?._id === user.id && ticket.status !== 'completed'
        );
        const unseen = assignedToMe.filter((ticket) => !seenIds.has(ticket._id));
        setAssignedNotificationCount(unseen.length);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createTicket = async (payload: CreateTicketPayload) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('priority', payload.priority);
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

  const reassignTicket = async (ticketId: string, assignedTo: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await apiRequest<Ticket>(`/api/tickets/${ticketId}/reassign`, {
      method: 'PATCH',
      body: { assignedTo },
      token,
    });
    await refreshTickets();
  };

  const markAssignedNotificationsRead = async () => {
    if (!user?.id) return;
    const assignedIds = tickets
      .filter((ticket) => ticket.assignedTo?._id === user.id && ticket.status !== 'completed')
      .map((ticket) => ticket._id);
    await AsyncStorage.setItem(getSeenKey(), JSON.stringify(assignedIds));
    setAssignedNotificationCount(0);
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshTickets();
    } else {
      setTickets([]);
      setAssignedNotificationCount(0);
    }
  }, [isAuthenticated, token]);

  const value = {
    tickets,
    isLoading,
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
