import { createContext, useContext, useState, useEffect } from 'react';
import {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  removeTokens,
} from '../services/token';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState({
    access_token: getAccessToken(),
    refresh_token: getRefreshToken(),
  });
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (tokens.access_token) {
        await fetchUserProfile();
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  const login = async (newTokens) => {
    setAccessToken(newTokens.access_token);
    setRefreshToken(newTokens.refresh_token);
    setTokens({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
    });
    await fetchUserProfile();
  };

  const logout = () => {
    setUser(null);
    removeTokens();
    setTokens({ access_token: null, refresh_token: null });
  };

  const value = { user, tokens, login, logout, setUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};