import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <View style={{ flex: 1, backgroundColor: '#F2F5EE' }} />;
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/sign-in'} />;
}
