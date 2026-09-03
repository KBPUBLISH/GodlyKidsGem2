import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page, but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is a creator, redirect them to their own dashboard
  // They should not access the admin portal
  if (role === 'creator') {
    return <Navigate to="/creator" replace />;
  }

  // Anything other than a confirmed admin is sent back to the login screen
  // rather than admitted: an unrecognised role must not open the admin portal.
  if (role !== 'admin') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;



