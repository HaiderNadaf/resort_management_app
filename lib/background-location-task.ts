import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { BASE_URL } from '@/lib/api';
import {
  LOCATION_TASK_NAME,
  TRACKING_ACTIVE_KEY,
  TRACKING_PING_QUEUE_KEY,
  TRACKING_TOKEN_KEY,
} from '@/lib/tracking-config';

type QueuedPing = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
};

async function loadQueue(): Promise<QueuedPing[]> {
  const raw = await AsyncStorage.getItem(TRACKING_PING_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedPing[];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedPing[]) {
  await AsyncStorage.setItem(TRACKING_PING_QUEUE_KEY, JSON.stringify(items));
}

async function flushQueue(token: string) {
  const queue = await loadQueue();
  if (queue.length === 0) return;

  try {
    const response = await fetch(`${BASE_URL}/api/tracking/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pings: queue }),
    });
    if (response.ok) {
      await saveQueue([]);
    }
  } catch {
    // keep queue for next attempt
  }
}

async function enqueuePing(ping: QueuedPing) {
  const queue = await loadQueue();
  queue.push(ping);
  if (queue.length > 200) {
    queue.splice(0, queue.length - 200);
  }
  await saveQueue(queue);
}

async function sendPing(token: string, ping: QueuedPing) {
  await flushQueue(token);
  try {
    const response = await fetch(`${BASE_URL}/api/tracking/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(ping),
    });
    if (!response.ok) {
      await enqueuePing(ping);
    }
  } catch {
    await enqueuePing(ping);
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[tracking] Background task error:', error.message);
    return;
  }

  const active = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
  if (active !== '1') return;

  const token = await AsyncStorage.getItem(TRACKING_TOKEN_KEY);
  if (!token) return;

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations?.length) return;

  for (const location of locations) {
    await sendPing(token, {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      capturedAt: new Date(location.timestamp).toISOString(),
    });
  }
});
