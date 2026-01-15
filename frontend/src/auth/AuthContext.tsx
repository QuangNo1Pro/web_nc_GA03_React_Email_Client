import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken, getAccessToken, refreshAccessToken } from '../services/api';
import { logoutSync } from '../services/logoutSync';
import { multiDeviceLogoutSync } from '../services/multiDeviceLogoutSync';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      // PROACTIVELY REFRESH if no token (prevents 401 on first load)
      if (!getAccessToken()) {
        try {
          await refreshAccessToken();
        } catch (refreshErr) {
          // If refresh fails, we are not logged in. Stop here.
          // Do not call profile, do not log error.
          setUser(null);
          return;
        }
      }

      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      // Don't log 401s as errors, they are expected when session expired/not logged in
      if ((error as any)?.response?.status !== 401) {
        console.error('Not authenticated:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize logout sync listeners on mount
  useEffect(() => {
    console.log('[AuthContext] 📡 Setting up logout sync listeners');

    // ========== Same-Tab Sync (BroadcastChannel) ==========
    // Listen for logout events from other tabs
    logoutSync.onLogout(() => {
      console.log('[AuthContext] 🔓 Received logout event from another tab');
      // Clear user state without calling API (other tab already called it)
      setAccessToken(null);
      setUser(null);
    });

    // Listen for login events from other tabs
    logoutSync.onLogin((userId: string) => {
      console.log('[AuthContext] 🔐 Received login event from another tab. User:', userId);
      // Refresh user profile from the other tab's login
      fetchUserProfile();
    });

    // ========== Multi-Device Sync (Polling) ==========
    // Listen for logout events from other devices
    multiDeviceLogoutSync.onLogout(() => {
      console.log('[AuthContext] 🔓 Received logout event from another device');
      // Clear user state
      setAccessToken(null);
      setUser(null);

      // Stop polling since we're logged out
      multiDeviceLogoutSync.stopPolling();

      console.warn('[AuthContext] ⚠️ You have been logged out from another device');
    });

    // Cleanup on unmount
    return () => {
      logoutSync.cleanup();
      multiDeviceLogoutSync.cleanup();
    };
  }, [fetchUserProfile]);

  // Listen for tab visibility changes and sync logout state if needed
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If we have an access token in memory, verify it
        // If not, fetchUserProfile might trigger a refresh flow via api interceptor
        console.log('[AuthContext] 👁️ Tab became visible, verifying auth state');
        fetchUserProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUserProfile]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const login = async (response?: any) => {
    // Set loading to true to prevent flash of login page during OAuth callback
    setLoading(true);

    // Save token to memory logic if provided (from login response)
    if (response?.access_token) {
      setAccessToken(response.access_token);
    }
    // After backend sets cookies, fetch profile to update state
    await fetchUserProfile();

    if (response?.user?.id) {
      const userId = response.user.id;

      // Start polling for multi-device logout
      multiDeviceLogoutSync.startPolling();

      // Broadcast login to other tabs
      logoutSync.broadcastLogin(userId);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setAccessToken(null);
      setUser(null);

      // Stop polling multi-device logout
      multiDeviceLogoutSync.stopPolling();

      // Broadcast logout to other tabs (same browser)
      logoutSync.broadcastLogout();
    }
  };

  const value = { user, login, logout, setUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};