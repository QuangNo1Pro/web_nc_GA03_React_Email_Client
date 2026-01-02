import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, clearProviderCache } from '../services/api';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Not authenticated:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const login = async (response?: any) => {
    // Save token to localStorage if provided (from login response)
    if (response?.access_token) {
      localStorage.setItem('access_token', response.access_token);
    }
    // After backend sets cookies, fetch profile to update state
    await fetchUserProfile();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('access_token');
      clearProviderCache(); // Clear cached provider data
      setUser(null);
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const value = { user, login, logout, setUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
