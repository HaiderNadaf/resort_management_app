import * as Updates from 'expo-updates';
import { useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Checks for EAS Update bundles on launch and when the app returns to foreground.
 * No-ops in __DEV__ or when Updates.isEnabled is false (e.g. Expo Go, or until `eas update:configure` sets updates.url).
 */
export function useAppUpdates() {
  const checkAndApply = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      // Network or server errors — keep running the current bundle
    }
  }, []);

  useEffect(() => {
    void checkAndApply();
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void checkAndApply();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [checkAndApply]);
}
