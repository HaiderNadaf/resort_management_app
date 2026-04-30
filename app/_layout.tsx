import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/auth-context';
import { RoomInspectionProvider } from '@/context/room-inspection-context';
import { TicketProvider } from '@/context/ticket-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const setupNotificationHandler = async () => {
      if (Constants.appOwnership === 'expo') return;
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    };
    setupNotificationHandler().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <TicketProvider>
        <RoomInspectionProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="create-ticket" options={{ title: 'Create Ticket' }} />
              <Stack.Screen name="complete-ticket/[id]" options={{ title: 'Complete Ticket' }} />
              <Stack.Screen name="reassign-ticket/[id]" options={{ title: 'Reassign Ticket' }} />
              <Stack.Screen name="room-list/[category]" options={{ title: 'Room List' }} />
              <Stack.Screen name="room-checklist/[id]" options={{ title: 'Room Checklist' }} />
              <Stack.Screen name="inspection-calendar" options={{ title: 'Inspection Calendar' }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </RoomInspectionProvider>
      </TicketProvider>
    </AuthProvider>
  );
}
