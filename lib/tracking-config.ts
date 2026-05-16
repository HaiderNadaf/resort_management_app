import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'gcc-background-location';

/** How often to send GPS while on shift (ms). */
export const TRACKING_INTERVAL_MS = 2 * 60 * 1000;

/** Minimum movement before Android reports a new point (meters). */
export const TRACKING_DISTANCE_METERS = 25;

export const TRACKING_TOKEN_KEY = 'tracking_auth_token';
export const TRACKING_ACTIVE_KEY = 'tracking_active';
export const TRACKING_PING_QUEUE_KEY = 'tracking_ping_queue';
export const BATTERY_OPT_PROMPTED_KEY = 'tracking_battery_opt_prompted';

/**
 * Android foreground-service + background location options.
 * killServiceOnDestroy: false keeps the service alive when the app is swiped away.
 */
export const BACKGROUND_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: TRACKING_INTERVAL_MS,
  distanceInterval: TRACKING_DISTANCE_METERS,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.OtherNavigation,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Gold Coins Ops — On shift',
    notificationBody: 'Location tracking is active while you are checked in.',
    notificationColor: '#1D391D',
    killServiceOnDestroy: false,
  },
};
