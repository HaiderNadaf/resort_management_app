import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [introDone, setIntroDone] = useState(false);
  const logoScale = useSharedValue(0.82);
  const logoOpacity = useSharedValue(0);
  const brushX = useSharedValue(-120);
  const brushOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.exp) });

    brushOpacity.value = withTiming(0.42, { duration: 240, easing: Easing.linear });
    brushX.value = withTiming(120, { duration: 780, easing: Easing.out(Easing.cubic) }, () => {
      brushOpacity.value = withTiming(0, { duration: 220 });
    });

    const timer = setTimeout(() => setIntroDone(true), 1000);
    return () => clearTimeout(timer);
  }, [brushOpacity, brushX, logoOpacity, logoScale]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const brushAnimStyle = useAnimatedStyle(() => ({
    opacity: brushOpacity.value,
    transform: [{ translateX: brushX.value }, { rotate: '18deg' }],
  }));

  if (!introDone || isLoading) {
    return (
      <View style={styles.boot}>
        <Animated.View style={[styles.logoWrap, logoAnimStyle]}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          <Animated.View pointerEvents="none" style={[styles.brush, brushAnimStyle]} />
        </Animated.View>
        <ActivityIndicator size="large" color={BrandColors.primary} style={styles.spinner} />
        <Text style={styles.caption}>{introDone ? 'Loading your workspace…' : 'Preparing app…'}</Text>
      </View>
    );
  }
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: BrandColors.appBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 22,
    overflow: 'hidden',
  },
  brush: {
    position: 'absolute',
    top: -20,
    left: -90,
    width: 46,
    height: 136,
    backgroundColor: '#FFFFFF',
  },
  spinner: {
    marginTop: 28,
  },
  caption: {
    marginTop: 16,
    fontSize: 15,
    color: BrandColors.muted,
    fontWeight: '600',
  },
});
