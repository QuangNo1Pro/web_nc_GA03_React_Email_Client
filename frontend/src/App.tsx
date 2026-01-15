import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Kanban from './pages/Kanban';
import AuthCallback from './pages/AuthCallback';
import { useQueryClient } from '@tanstack/react-query';

import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './auth/AuthContext';

export default function App() {
  const { user, logout, loading } = useAuth();
  const queryClient = useQueryClient();
  const handleLogout = () => {
    logout();
    queryClient.invalidateQueries();
  };

  const isAuthenticated = !!user;

  // Show loading screen while auth state is being determined
  // This prevents flash of login page during OAuth callback
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/inbox" /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/inbox" /> : <Login />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/inbox" /> : <Register />}
          />
          <Route
            path="/auth/callback"
            element={<AuthCallback />}
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kanban"
            element={
              <ProtectedRoute>
                <Kanban />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
