import '@/lib/background-location-task';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { GlobalApiLoader } from '@/components/global-api-loader';
import { ShiftTrackingRecovery } from '@/components/shift-tracking-recovery';
import { TicketPushNotificationHandler } from '@/components/ticket-push-notification-handler';
import { AuthProvider } from '@/context/auth-context';
import { RoomInspectionProvider } from '@/context/room-inspection-context';
import { TicketProvider } from '@/context/ticket-context';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useAppUpdates();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const setupNotificationHandler = async () => {
      if (Constants.appOwnership === 'expo') return;
      const Notifications = await import('expo-notifications');
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
      await Notifications.setNotificationChannelAsync('location-tracking', {
        name: 'Shift location tracking',
        description: 'Shows while your location is tracked during a checked-in shift',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        enableVibrate: false,
        showBadge: false,
      });
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    };
    setupNotificationHandler().catch((error) => {
      console.error('[notifications] Handler setup failed:', error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TicketProvider>
          <TicketPushNotificationHandler />
          <ShiftTrackingRecovery />
          <RoomInspectionProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="create-ticket" options={{ title: 'Create Ticket' }} />
                <Stack.Screen name="daily-task" options={{ title: 'Daily Task' }} />
                <Stack.Screen name="complete-ticket/[id]" options={{ title: 'Complete Ticket' }} />
                <Stack.Screen name="reassign-ticket/[id]" options={{ title: 'Reassign Ticket' }} />
                <Stack.Screen name="room-list/[category]" options={{ title: 'Room List' }} />
                <Stack.Screen name="room-checklist/[id]" options={{ title: 'Room Checklist' }} />
                <Stack.Screen name="inspection-calendar" options={{ title: 'Inspection Calendar' }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <GlobalApiLoader />
              <StatusBar style="auto" />
            </ThemeProvider>
          </RoomInspectionProvider>
        </TicketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
