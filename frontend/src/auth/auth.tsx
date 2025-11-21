import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { setAccessToken, getAccessToken } from '../services/token';

interface AuthContextType {
  user: any;
  tokens: { access_token: string | null; refresh_token: string | null };
  login: (newTokens: {
    access_token: string;
    refresh_token: string;
  }) => void;
  logout: () => void;
  setUser: (user: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState({
    access_token: getAccessToken(),
    refresh_token: localStorage.getItem('refresh_token'),
  });

  useEffect(() => {
    if (tokens.refresh_token) {
      // You might want to fetch the user profile here
    }
  }, [tokens.refresh_token]);

  const login = (newTokens: {
    access_token: string;
    refresh_token: string;
  }) => {
    setTokens(newTokens);
    setAccessToken(newTokens.access_token);
    localStorage.setItem('refresh_token', newTokens.refresh_token);
  };

  const logout = () => {
    setUser(null);
    setTokens({ access_token: null, refresh_token: null });
    setAccessToken(null);
    localStorage.removeItem('refresh_token');
  };

  const value = { user, tokens, login, logout, setUser };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </GoogleOAuthProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};