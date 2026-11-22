import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { installUnauthorizedHandler } from '../services/authInterceptor';

const LOGIN_PATHS = ['/login', '/creator/login'];

/**
 * Renders nothing. Watches API responses for a 401 and, when the stored token has
 * gone stale, clears the session and drops the user on the login page for their
 * role — otherwise the admin UI keeps rendering while every request quietly fails.
 */
const SessionExpiryHandler: React.FC = () => {
  const { logout, role, getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirecting = useRef(false);

  // A dead token usually produces a burst of 401s at once; only the first redirects.
  useEffect(() => {
    redirecting.current = false;
  }, [location.pathname]);

  useEffect(() => {
    return installUnauthorizedHandler(() => {
      // No stored token means there is no session to expire (public pages, or a
      // login attempt that has not stored anything yet).
      if (!getToken()) return;
      if (redirecting.current || LOGIN_PATHS.includes(window.location.pathname)) return;

      redirecting.current = true;
      const loginPath = role === 'creator' ? '/creator/login' : '/login';
      logout();
      navigate(loginPath, { replace: true, state: { sessionExpired: true } });
    });
  }, [getToken, logout, navigate, role]);

  return null;
};

export default SessionExpiryHandler;
