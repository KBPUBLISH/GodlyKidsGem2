import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

/**
 * Route guard that checks if the user has one of the allowed roles.
 * Redirects to appropriate login page if not authenticated or not authorized.
 */
const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, role } = useAuth();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Not authorized for this role
  if (!role || !allowedRoles.includes(role)) {
    // If they're a creator trying to access admin pages, redirect to creator dashboard
    if (role === 'creator') {
      return <Navigate to="/creator" replace />;
    }
    // If they're an admin trying to access creator pages, redirect to admin dashboard
    if (role === 'admin') {
      return <Navigate to="/" replace />;
    }
    // Otherwise, redirect to login
    return <Navigate to="/login" replace />;
  }

  // Authorized - render children or outlet
  return children ? <>{children}</> : <Outlet />;
};

export default RoleGuard;
