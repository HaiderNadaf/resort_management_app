import { useEffect } from 'react';

import { useAuth } from '@/context/auth-context';
import { registerTrackingAppStateRecovery, verifyTrackingHealth } from '@/lib/location-tracking';

/**
 * Keeps background location alive: re-checks when app returns to foreground
 * and periodically while tracking is active.
 */
export function ShiftTrackingRecovery() {
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token || user?.role !== 'employee') return;
    return registerTrackingAppStateRecovery(() => token);
  }, [token, user?.role]);

  useEffect(() => {
    if (!token || user?.role !== 'employee') return;
    void verifyTrackingHealth(token);
  }, [token, user?.role]);

  return null;
}
