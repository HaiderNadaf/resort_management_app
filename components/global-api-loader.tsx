import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/brand';
import { subscribeApiLoading } from '@/lib/api-loading';

export function GlobalApiLoader() {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeApiLoading((isLoading) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (isLoading) {
        setVisible(true);
        return;
      }
      hideTimerRef.current = setTimeout(() => setVisible(false), 180);
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator color={BrandColors.primary} size="small" />
        <Text style={styles.text}>Loading data...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 68,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  text: {
    color: BrandColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});

