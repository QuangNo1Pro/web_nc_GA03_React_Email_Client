import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { tokens } = useAuth();

  if (!tokens.access_token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
