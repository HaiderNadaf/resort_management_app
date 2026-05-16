import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { AppState, Linking, Platform } from 'react-native';

import {
  BACKGROUND_LOCATION_OPTIONS,
  BATTERY_OPT_PROMPTED_KEY,
  LOCATION_TASK_NAME,
  TRACKING_ACTIVE_KEY,
  TRACKING_INTERVAL_MS,
  TRACKING_PING_QUEUE_KEY,
  TRACKING_TOKEN_KEY,
} from '@/lib/tracking-config';
import { apiRequest } from '@/lib/api';

type QueuedPing = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
};

let foregroundInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

async function loadQueue(): Promise<QueuedPing[]> {
  const raw = await AsyncStorage.getItem(TRACKING_PING_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedPing[];
  } catch {
    return [];
  }
}

export async function flushQueuedPings(token: string) {
  const queue = await loadQueue();
  if (queue.length === 0) return;
  try {
    await apiRequest('/api/tracking/ping', {
      method: 'POST',
      token,
      body: { pings: queue },
    });
    await AsyncStorage.setItem(TRACKING_PING_QUEUE_KEY, JSON.stringify([]));
  } catch {
    // keep queue
  }
}

async function sendForegroundPing(token: string) {
  const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
  if (active !== '1') return;

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await apiRequest('/api/tracking/ping', {
      method: 'POST',
      token,
      body: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
        capturedAt: new Date().toISOString(),
      },
    });
    await flushQueuedPings(token);
  } catch {
    const queue = await loadQueue();
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      queue.push({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
        capturedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem(TRACKING_PING_QUEUE_KEY, JSON.stringify(queue.slice(-200)));
    } catch {
      // ignore
    }
  }
}

function clearForegroundInterval() {
  if (foregroundInterval) {
    clearInterval(foregroundInterval);
    foregroundInterval = null;
  }
}

function clearHealthCheckInterval() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

function startForegroundInterval(token: string) {
  clearForegroundInterval();
  void sendForegroundPing(token);
  foregroundInterval = setInterval(() => {
    void sendForegroundPing(token);
  }, TRACKING_INTERVAL_MS);
}

function startHealthCheckInterval(token: string) {
  clearHealthCheckInterval();
  healthCheckInterval = setInterval(() => {
    void verifyTrackingHealth(token);
  }, 5 * 60 * 1000);
}

export async function isBackgroundTrackingRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}

export async function ensureBackgroundLocationStarted(): Promise<boolean> {
  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return false;
  }

  const running = await isBackgroundTrackingRunning();
  if (running) {
    return true;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, BACKGROUND_LOCATION_OPTIONS);
  return true;
}

/**
 * Re-start background task if Android killed it while employee is still on shift.
 */
export async function verifyTrackingHealth(token?: string | null) {
  const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
  if (active !== '1') {
    const running = await isBackgroundTrackingRunning();
    if (running) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    }
    clearForegroundInterval();
    clearHealthCheckInterval();
    return;
  }

  const authToken = token || (await AsyncStorage.getItem(TRACKING_TOKEN_KEY));
  if (!authToken) return;

  const backgroundGranted = (await Location.getBackgroundPermissionsAsync()).status === 'granted';
  if (backgroundGranted) {
    const started = await ensureBackgroundLocationStarted().catch(() => false);
    if (!started) {
      console.warn('[tracking] Failed to restart background location updates');
    }
  }

  startForegroundInterval(authToken);
  await flushQueuedPings(authToken);
}

/**
 * Ask Android to exempt app from battery optimization (one-time after check-in).
 */
export async function promptBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') return;

  const already = await AsyncStorage.getItem(BATTERY_OPT_PROMPTED_KEY);
  if (already === '1') return;

  const pkg = Application.applicationId;
  if (!pkg) return;

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${pkg}` }
    );
    await AsyncStorage.setItem(BATTERY_OPT_PROMPTED_KEY, '1');
  } catch {
    try {
      await Linking.openSettings();
      await AsyncStorage.setItem(BATTERY_OPT_PROMPTED_KEY, '1');
    } catch {
      // user can set manually
    }
  }
}

export async function startShiftTracking(token: string) {
  await AsyncStorage.setItem(TRACKING_TOKEN_KEY, token);
  await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, '1');

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Location permission is required for shift tracking.');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    console.warn('[tracking] Background location not granted; foreground-only fallback.');
  } else {
    await ensureBackgroundLocationStarted();
  }

  startForegroundInterval(token);
  startHealthCheckInterval(token);
  await flushQueuedPings(token);

  void promptBatteryOptimizationExemption();
}

export async function stopShiftTracking() {
  clearForegroundInterval();
  clearHealthCheckInterval();

  const token = await AsyncStorage.getItem(TRACKING_TOKEN_KEY);
  await AsyncStorage.multiRemove([TRACKING_TOKEN_KEY, TRACKING_ACTIVE_KEY]);

  const running = await isBackgroundTrackingRunning();
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  if (token) {
    await flushQueuedPings(token);
  }
}

export async function resumeShiftTrackingIfNeeded(
  token: string,
  attendance: {
    checkedIn: boolean;
    checkedOut: boolean;
    checkIn?: { capturedAt?: string } | null;
    checkOut?: { capturedAt?: string } | null;
  }
) {
  const inAt = attendance.checkIn?.capturedAt ? new Date(attendance.checkIn.capturedAt).getTime() : 0;
  const outAt = attendance.checkOut?.capturedAt ? new Date(attendance.checkOut.capturedAt).getTime() : 0;
  const onShift = attendance.checkedIn && (!outAt || outAt <= inAt);

  if (!onShift) {
    await stopShiftTracking();
    return;
  }

  try {
    await startShiftTracking(token);
  } catch {
    await verifyTrackingHealth(token);
  }
}

/** Call once at app root — restarts tracking when user returns to the app. */
export function registerTrackingAppStateRecovery(getToken: () => string | null) {
  const onChange = (state: string) => {
    if (state !== 'active') return;
    const token = getToken();
    if (!token) return;
    void verifyTrackingHealth(token);
  };

  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}
