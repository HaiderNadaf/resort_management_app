import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/lib/api';

type UserRole = 'admin' | 'employee';

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  isMainAdmin?: boolean;
  department?: string | null;
  profileImageUrl?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

type AuthResponse = {
  token: string;
  user?: AuthUser;
};

type SignInPayload = {
  phone: string;
  role: UserRole;
  password: string;
};

type UploadAsset = {
  uri: string;
  name?: string;
  type?: string;
};

type SignUpPayload = {
  name: string;
  phone: string;
  role: UserRole;
  password: string;
  department?: string;
  isMainAdmin?: boolean;
  profileImage?: UploadAsset | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'ticket_app_token';
const USER_KEY = 'ticket_app_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as AuthUser);
        }
      } finally {
        setIsLoading(false);
      }
    };

    hydrate();
  }, []);

  useEffect(() => {
    const syncPushToken = async () => {
      if (!token || !user?.id) return;
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) return;
      try {
        const Notifications = await import('expo-notifications');
        const settings = await Notifications.getPermissionsAsync();
        const finalStatus =
          settings.status === 'granted'
            ? 'granted'
            : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== 'granted') return;

        const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
        if (!expoPushToken) return;

        await apiRequest('/api/auth/push-token', {
          method: 'PATCH',
          token,
          body: { pushToken: expoPushToken },
        });
      } catch {
        // Push token registration should not block auth flow.
      }
    };

    syncPushToken();
  }, [token, user?.id]);

  const persistAuth = useCallback(async (authToken: string, authUser: AuthUser) => {
    setToken(authToken);
    setUser(authUser);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, authToken],
      [USER_KEY, JSON.stringify(authUser)],
    ]);
  }, []);

  const clearAuth = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  useEffect(() => {
    const verifyPersistedSession = async () => {
      if (isLoading || !token) return;
      try {
        const response = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
          token,
        });
        setUser(response.user);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        if (/not authorized|user not found/i.test(message)) {
          await clearAuth();
        }
      }
    };
    verifyPersistedSession().catch(() => {});
  }, [isLoading, token, clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isLoading,
      signIn: async (payload) => {
        const response = await apiRequest<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: payload,
        });
        await persistAuth(response.token, response.user);
      },
      signUp: async (payload) => {
        let response: AuthResponse;

        if (payload.profileImage?.uri) {
          const formData = new FormData();
          const payloadJson = {
            name: payload.name,
            phone: payload.phone,
            role: payload.role,
            password: payload.password,
            isMainAdmin: Boolean(payload.isMainAdmin),
            department: payload.department ?? '',
          };
          formData.append('payload', JSON.stringify(payloadJson));
          formData.append('name', payload.name);
          formData.append('phone', payload.phone);
          formData.append('role', payload.role);
          formData.append('password', payload.password);
          formData.append('isMainAdmin', String(Boolean(payload.isMainAdmin)));
          if (payload.department) {
            formData.append('department', payload.department);
          }
          formData.append('profileImage', {
            uri: payload.profileImage.uri,
            name: payload.profileImage.name ?? `profile-${Date.now()}.jpg`,
            type: payload.profileImage.type ?? 'image/jpeg',
          } as unknown as Blob);

          response = await apiRequest<AuthResponse>('/api/auth/register', {
            method: 'POST',
            body: formData,
            isFormData: true,
          });
        } else {
          response = await apiRequest<AuthResponse>('/api/auth/register', {
            method: 'POST',
            body: {
              name: payload.name,
              phone: payload.phone,
              role: payload.role,
              password: payload.password,
              department: payload.department,
              isMainAdmin: Boolean(payload.isMainAdmin),
            },
          });
        }

        if (!response.token) {
          throw new Error('Sign up failed. Please try again.');
        }

        if (response.user) {
          await persistAuth(response.token, response.user);
          return response.user;
        }

        try {
          const meResponse = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
            token: response.token,
          });
          await persistAuth(response.token, meResponse.user);
          return meResponse.user;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Sign up failed';
          if (/not authorized|user not found/i.test(message)) {
            await clearAuth();
            throw new Error('User not found after sign up. Please sign up again.');
          }
          throw error;
        }
      },
      signOut: async () => {
        await clearAuth();
      },
      refreshUser: async () => {
        if (!token) return;
        try {
          const response = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
            token,
          });
          setUser(response.user);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Request failed';
          if (/not authorized|user not found/i.test(message)) {
            await clearAuth();
            return;
          }
          throw error;
        }
      },
    }),
    [isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export const EMPLOYEE_DEPARTMENTS = [
  'House Keeping',
  'Swimming Pool Dept',
  'F&B Dept',
  'Front Office',
  'Maintenance',
] as const;

export const MAIN_ADMIN_DEPARTMENT = 'ALL';
