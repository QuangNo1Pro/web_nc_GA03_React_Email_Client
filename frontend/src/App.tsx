import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
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


  return (
    <div className="min-h-screen flex flex-col">
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
            path="/inbox"
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}