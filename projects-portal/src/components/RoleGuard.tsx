import React from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

const HOME_PATHS: Record<UserRole, string> = {
  admin: '/',
  creator: '/creator',
};

const LOGIN_PATHS: Record<UserRole, string> = {
  admin: '/login',
  creator: '/creator/login',
};

const AREA_LABELS: Record<UserRole, string> = {
  admin: 'The admin portal',
  creator: 'The creator portal',
};

const ACCOUNT_LABELS: Record<UserRole, string> = {
  admin: 'an admin',
  creator: 'a creator',
};

/**
 * Shown instead of bouncing the user somewhere else, because the two portals
 * look alike enough that a silent redirect reads as the app losing the page.
 * Saying which account they are on is also the only warning before the
 * backend refuses the work with a bare 403.
 */
const WrongRoleNotice: React.FC<{ signedInAs: UserRole; required: UserRole }> = ({
  signedInAs,
  required,
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          You're signed in as {ACCOUNT_LABELS[signedInAs]}
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          {AREA_LABELS[required]} needs {ACCOUNT_LABELS[required]} account. Content must be
          created from {ACCOUNT_LABELS[required]} account, so anything saved from here would be
          rejected.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={() => navigate(LOGIN_PATHS[required])}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Sign in as {ACCOUNT_LABELS[required]}
          </button>
          <button
            onClick={() => navigate(HOME_PATHS[signedInAs])}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Back to {AREA_LABELS[signedInAs].toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Route guard that checks if the user has one of the allowed roles.
 * Redirects to appropriate login page if not authenticated or not authorized.
 */
const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, role } = useAuth();

  // Not authenticated - redirect to the login page for the area being guarded,
  // so a creator is not dropped on the admin sign-in form.
  if (!isAuthenticated) {
    return <Navigate to={LOGIN_PATHS[allowedRoles[0]] ?? '/login'} replace />;
  }

  // Signed in as the wrong role - explain it rather than redirecting, so the
  // user learns why this area is closed to them instead of watching the app
  // throw them back to a dashboard they did not ask for.
  if (!role || !allowedRoles.includes(role)) {
    if (!role) return <Navigate to="/login" replace />;
    return <WrongRoleNotice signedInAs={role} required={allowedRoles[0]} />;
  }

  // Authorized - render children or outlet
  return children ? <>{children}</> : <Outlet />;
};

export default RoleGuard;
