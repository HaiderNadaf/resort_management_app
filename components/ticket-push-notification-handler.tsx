import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useTickets } from '@/context/ticket-context';

type PushData = Record<string, unknown> | undefined;

function routeForNotificationData(data: PushData): '/(tabs)' | '/(tabs)/room-inspections' | null {
  const type = data?.type;
  if (type === 'ticket_assigned' || type === 'ticket_reassigned') {
    return '/(tabs)';
  }
  if (type === 'room_inspection_assigned') {
    return '/(tabs)/room-inspections';
  }
  return null;
}

/**
 * Refreshes ticket list and navigates when the user opens the app from a ticket or inspection push.
 * Clears the last notification response after handling so a later cold start does not repeat navigation.
 */
export function TicketPushNotificationHandler() {
  const router = useRouter();
  const { refreshTickets } = useTickets();
  const processedResponseIds = useRef<Set<string>>(new Set());

  const consumeNotificationResponse = useCallback(
    async (response: import('expo-notifications').NotificationResponse) => {
      if (Constants.appOwnership === 'expo') return;
      const Notifications = await import('expo-notifications');
      const key = response.notification.request.identifier;
      if (processedResponseIds.current.has(key)) return;
      const data = response.notification.request.content.data as PushData;
      const target = routeForNotificationData(data);
      if (!target) return;

      processedResponseIds.current.add(key);
      try {
        await refreshTickets();
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          // ignore if native API unavailable
        }
        requestAnimationFrame(() => {
          router.replace(target);
        });
      } catch {
        processedResponseIds.current.delete(key);
      }
    },
    [refreshTickets, router]
  );

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        void consumeNotificationResponse(response);
      });

      try {
        const last = Notifications.getLastNotificationResponse();
        if (last && !cancelled) {
          await consumeNotificationResponse(last);
        }
      } catch {
        // native module may be unavailable in some environments
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [consumeNotificationResponse]);

  return null;
}
