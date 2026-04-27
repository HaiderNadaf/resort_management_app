import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { BrandColors } from '@/constants/brand';
import { useAuth } from '@/context/auth-context';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BrandColors.primary,
        tabBarInactiveTintColor: '#7A869A',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: BrandColors.border,
          borderTopWidth: 1,
          height: 76,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#111827',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="completed"
        options={{
          title: 'Completed',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
