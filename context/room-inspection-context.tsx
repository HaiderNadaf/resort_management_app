import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { apiRequest } from '@/lib/api';

type InspectionStatus = 'pending' | 'in_progress' | 'completed';

export type RoomInspectionChecklistItem = {
  label: string;
  isChecked: boolean;
};

export type RoomInspection = {
  _id: string;
  inspectionDate: string;
  categoryKey: string;
  categoryName: string;
  roomNumber: number;
  roomLabel: string;
  department: string;
  status: InspectionStatus;
  assignedTo?: { _id: string; name: string; role: string; department?: string | null } | null;
  checklist: RoomInspectionChecklistItem[];
  notes?: string;
  progressImageUrl?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
};

export type RoomCategoryCard = {
  categoryKey: string;
  categoryName: string;
  totalRooms: number;
  completedRooms: number;
  progress: string;
  assignedTo?: { _id: string; name: string; role: string; department?: string | null } | null;
};

export type RoomCalendarDay = {
  date: string;
  total: number;
  completed: number;
  color: 'green' | 'yellow' | 'red';
};

type PendingAction =
  | { type: 'checklist'; id: string; payload: { checklist: RoomInspectionChecklistItem[]; notes?: string } }
  | { type: 'complete'; id: string };

type RoomInspectionContextValue = {
  isLoading: boolean;
  pendingSyncCount: number;
  getDashboard: (date: string) => RoomCategoryCard[];
  loadDashboard: (date: string) => Promise<void>;
  getRooms: (date: string, categoryKey: string) => RoomInspection[];
  loadRooms: (date: string, categoryKey: string) => Promise<void>;
  getInspectionById: (id: string) => RoomInspection | null;
  loadInspection: (id: string) => Promise<RoomInspection | null>;
  saveChecklist: (id: string, checklist: RoomInspectionChecklistItem[], notes?: string, imageUri?: string) => Promise<void>;
  completeRoom: (id: string) => Promise<void>;
  assignCategory: (date: string, categoryKey: string, assignedTo: string) => Promise<void>;
  loadAssignableUsers: () => Promise<Array<{ _id: string; name: string; role: string; department?: string | null }>>;
  getCalendarDays: (month: string) => RoomCalendarDay[];
  loadCalendar: (month: string) => Promise<void>;
  syncPendingActions: () => Promise<void>;
};

const RoomInspectionContext = createContext<RoomInspectionContextValue | null>(null);
const QUEUE_KEY = 'room_inspection_pending_queue';

function roomsKey(date: string, categoryKey: string) {
  return `${date}__${categoryKey}`;
}

export function RoomInspectionProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardByDate, setDashboardByDate] = useState<Record<string, RoomCategoryCard[]>>({});
  const [roomsByDateCategory, setRoomsByDateCategory] = useState<Record<string, RoomInspection[]>>({});
  const [inspectionById, setInspectionById] = useState<Record<string, RoomInspection>>({});
  const [calendarByMonth, setCalendarByMonth] = useState<Record<string, RoomCalendarDay[]>>({});
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const pendingSyncCount = pendingActions.length;

  useEffect(() => {
    const hydrateQueue = async () => {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      setPendingActions(raw ? (JSON.parse(raw) as PendingAction[]) : []);
    };
    hydrateQueue();
  }, []);

  const persistQueue = async (items: PendingAction[]) => {
    setPendingActions(items);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  };

  const updateInspectionCache = (inspection: RoomInspection) => {
    setInspectionById((prev) => ({ ...prev, [inspection._id]: inspection }));
    setRoomsByDateCategory((prev) => {
      const key = roomsKey(inspection.inspectionDate, inspection.categoryKey);
      const existing = prev[key] || [];
      const next = existing.map((item) => (item._id === inspection._id ? inspection : item));
      return { ...prev, [key]: next };
    });
  };

  const loadDashboard = async (date: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await apiRequest<{ categories: RoomCategoryCard[] }>(
        `/api/room-inspections/dashboard?date=${encodeURIComponent(date)}`,
        { token }
      );
      setDashboardByDate((prev) => ({ ...prev, [date]: response.categories }));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRooms = async (date: string, categoryKey: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await apiRequest<{ inspections: RoomInspection[] }>(
        `/api/room-inspections?date=${encodeURIComponent(date)}&category=${encodeURIComponent(categoryKey)}`,
        { token }
      );
      const key = roomsKey(date, categoryKey);
      setRoomsByDateCategory((prev) => ({ ...prev, [key]: response.inspections }));
      setInspectionById((prev) => {
        const merged = { ...prev };
        response.inspections.forEach((item) => {
          merged[item._id] = item;
        });
        return merged;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadInspection = async (id: string) => {
    if (!token) return inspectionById[id] ?? null;
    const inspection = await apiRequest<RoomInspection>(`/api/room-inspections/${id}`, { token });
    setInspectionById((prev) => ({ ...prev, [id]: inspection }));
    return inspection;
  };

  const runOrQueue = async (action: PendingAction) => {
    if (!token) throw new Error('Not authenticated');
    try {
      if (action.type === 'checklist') {
        const updated = await apiRequest<RoomInspection>(`/api/room-inspections/${action.id}/checklist`, {
          method: 'PATCH',
          token,
          body: action.payload,
        });
        updateInspectionCache(updated);
      } else {
        const updated = await apiRequest<RoomInspection>(`/api/room-inspections/${action.id}/complete`, {
          method: 'PATCH',
          token,
        });
        updateInspectionCache(updated);
      }
      return true;
    } catch {
      const next = [...pendingActions, action];
      await persistQueue(next);
      return false;
    }
  };

  const saveChecklist = async (id: string, checklist: RoomInspectionChecklistItem[], notes?: string, imageUri?: string) => {
    const existing = inspectionById[id];
    if (existing) {
      updateInspectionCache({
        ...existing,
        checklist,
        notes,
        status: existing.status === 'pending' ? 'in_progress' : existing.status,
      });
    }
    if (imageUri && token) {
      const formData = new FormData();
      formData.append('checklist', JSON.stringify(checklist));
      formData.append('notes', notes ?? '');
      formData.append('image', {
        uri: imageUri,
        name: `inspection-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      const updated = await apiRequest<RoomInspection>(`/api/room-inspections/${id}/checklist`, {
        method: 'PATCH',
        token,
        body: formData,
        isFormData: true,
      });
      updateInspectionCache(updated);
      return;
    }
    await runOrQueue({ type: 'checklist', id, payload: { checklist, notes } });
  };

  const completeRoom = async (id: string) => {
    await runOrQueue({ type: 'complete', id });
  };

  const syncPendingActions = async () => {
    if (!token || pendingActions.length === 0) return;
    const remaining: PendingAction[] = [];
    for (const action of pendingActions) {
      try {
        if (action.type === 'checklist') {
          const updated = await apiRequest<RoomInspection>(`/api/room-inspections/${action.id}/checklist`, {
            method: 'PATCH',
            token,
            body: action.payload,
          });
          updateInspectionCache(updated);
        } else {
          const updated = await apiRequest<RoomInspection>(`/api/room-inspections/${action.id}/complete`, {
            method: 'PATCH',
            token,
          });
          updateInspectionCache(updated);
        }
      } catch {
        remaining.push(action);
      }
    }
    await persistQueue(remaining);
  };

  const assignCategory = async (date: string, categoryKey: string, assignedTo: string) => {
    if (!token) throw new Error('Not authenticated');
    await apiRequest('/api/room-inspections/assign-category', {
      method: 'PATCH',
      token,
      body: { inspectionDate: date, categoryKey, assignedTo },
    });
    await loadDashboard(date);
    await loadRooms(date, categoryKey);
  };

  const loadAssignableUsers = async () => {
    if (!token) return [];
    const response = await apiRequest<{ users: Array<{ _id: string; name: string; role: string; department?: string | null }> }>(
      '/api/room-inspections/assignable-users',
      { token }
    );
    if (response.users.length > 0) return response.users;

    // Fallback to auth users listing in case inspection-specific filter returns empty unexpectedly.
    const dept = user?.department ? `&department=${encodeURIComponent(user.department)}` : '';
    const fallback = await apiRequest<{ users: Array<{ _id: string; name: string; role: string; department?: string | null }> }>(
      `/api/auth/users?role=employee${dept}`,
      { token }
    );
    return fallback.users || [];
  };

  const loadCalendar = async (month: string) => {
    if (!token) return;
    const response = await apiRequest<{ days: RoomCalendarDay[] }>(
      `/api/room-inspections/calendar?month=${encodeURIComponent(month)}`,
      { token }
    );
    setCalendarByMonth((prev) => ({ ...prev, [month]: response.days }));
  };

  useEffect(() => {
    if (isAuthenticated && token && pendingActions.length > 0) {
      syncPendingActions().catch(() => {});
    }
  }, [isAuthenticated, token]);

  const value = useMemo<RoomInspectionContextValue>(
    () => ({
      isLoading,
      pendingSyncCount,
      getDashboard: (date) => dashboardByDate[date] ?? [],
      loadDashboard,
      getRooms: (date, categoryKey) => roomsByDateCategory[roomsKey(date, categoryKey)] ?? [],
      loadRooms,
      getInspectionById: (id) => inspectionById[id] ?? null,
      loadInspection,
      saveChecklist,
      completeRoom,
      assignCategory,
      loadAssignableUsers,
      getCalendarDays: (month) => calendarByMonth[month] ?? [],
      loadCalendar,
      syncPendingActions,
    }),
    [isLoading, pendingSyncCount, dashboardByDate, roomsByDateCategory, inspectionById, calendarByMonth, token, user?.department]
  );

  return <RoomInspectionContext.Provider value={value}>{children}</RoomInspectionContext.Provider>;
}

export function useRoomInspections() {
  const context = useContext(RoomInspectionContext);
  if (!context) {
    throw new Error('useRoomInspections must be used inside RoomInspectionProvider');
  }
  return context;
}
