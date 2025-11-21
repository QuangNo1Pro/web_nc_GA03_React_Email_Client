import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import { useQueryClient } from '@tanstack/react-query';

import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './auth/auth';

export default function App() {
  const { tokens, logout, loading } = useAuth();
  const queryClient = useQueryClient();
  const handleLogout = () => {
    logout();
    queryClient.invalidateQueries();
  };

  const isAuthenticated = !!tokens.access_token;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-30 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-white font-bold">
              M
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Mailbox</h1>
              <p className="text-xs text-slate-500">A React + NestJS Demo</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/inbox"
                  className="text-sm text-slate-700 hover:text-blue-600"
                >
                  Inbox
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded shadow-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-700 hover:text-blue-600"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded shadow-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/inbox" /> : <Home />}
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
