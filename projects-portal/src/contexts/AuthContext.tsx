import React, { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * Portal authentication context.
 * Supports both admin users and creator users with role-based access.
 */

const AUTH_KEY = 'gk_portal_auth';
const ROLE_KEY = 'portal_user_role';
const USER_KEY = 'portal_user_data';
// Prefer VITE_API_BASE_URL (used by apiClient); fall back to VITE_API_URL for compatibility.
const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://backendgk2-0.onrender.com';

export type UserRole = 'admin' | 'creator';

/**
 * One storage slot per role. Admin pages read portal_admin_token directly, so
 * a creator token must never be written there or those pages would send it to
 * admin endpoints.
 */
const TOKEN_KEYS: Record<UserRole, string> = {
  admin: 'portal_admin_token',
  creator: 'portal_creator_token',
};

interface UserData {
  id: string;
  email: string;
  name?: string;
  profileImage?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: UserRole | null;
  user: UserData | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsCreator: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  activateCreatorSession: (token: string, creator: Partial<UserData>) => { success: boolean; error?: string };
  logout: () => void;
  getToken: () => string | null;
}

interface Session {
  role: UserRole;
  token: string;
  user: UserData | null;
}

/** The claims the portal cares about; every token type carries a subset. */
interface TokenClaims {
  role?: string;
  isAdmin?: boolean;
  id?: string;
  user?: { id?: string };
}

/** Reads a JWT's payload without verifying it. */
const decodeTokenPayload = (token: string): TokenClaims | null => {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch {
    return null;
  }
};

/**
 * The role a token claims for itself. Creator (and church) logins carry an
 * explicit role claim; admin logins go through /api/auth/login, which serves
 * every app user, so only its isAdmin claim separates an admin from a parent
 * signing in with their app credentials. Claims are signed, so unlike ROLE_KEY
 * a user cannot edit them.
 *
 * Tokens minted before isAdmin existed read as no role at all, which costs
 * their owner one re-login. That is the safe direction: the alternative admits
 * every app user to the portal for as long as those tokens live.
 */
const roleFromToken = (token: string): UserRole | 'church' | null => {
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  if (payload.role === 'creator' || payload.role === 'church') return payload.role;
  if (payload.isAdmin === true && (payload.user?.id || payload.id)) return 'admin';
  return null;
};

/**
 * Shown when a creator endpoint hands back a token that is not a creator one.
 * It should be unreachable, so it says what to do rather than what happened.
 */
const NOT_A_CREATOR_TOKEN =
  'That sign-in did not return a creator session. Please try again, or ask an admin to re-send your invite.';

const toCreatorUser = (creator: Partial<UserData>): UserData => ({
  id: creator?.id ?? '',
  email: creator?.email ?? '',
  name: creator?.name,
  profileImage: creator?.profileImage,
});

const readStoredUser = (): UserData | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEYS.admin);
  localStorage.removeItem(TOKEN_KEYS.creator);
};

const persistSession = (role: UserRole, token: string, user: UserData | null) => {
  // One portal session at a time, so a stale token of the other role can never
  // be picked up by pages that read its storage key directly.
  const other: UserRole = role === 'admin' ? 'creator' : 'admin';
  localStorage.removeItem(TOKEN_KEYS[other]);

  localStorage.setItem(AUTH_KEY, 'true');
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(TOKEN_KEYS[role], token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

/**
 * Rebuilds the session from storage, taking the role from the token's claims
 * rather than from ROLE_KEY. Anything it cannot match to a role is discarded:
 * a session of unknown role used to fall through the admin guard.
 */
const loadSession = (): Session | null => {
  if (localStorage.getItem(AUTH_KEY) !== 'true') return null;

  // Creator logins used to write to the admin token key. Relocate those instead
  // of trusting them, or an existing creator session still reads as an admin one.
  const adminSlot = localStorage.getItem(TOKEN_KEYS.admin);
  if (adminSlot && roleFromToken(adminSlot) === 'creator') {
    localStorage.removeItem(TOKEN_KEYS.admin);
    localStorage.setItem(TOKEN_KEYS.creator, adminSlot);
  }

  const roles: UserRole[] = ['admin', 'creator'];
  for (const role of roles) {
    const token = localStorage.getItem(TOKEN_KEYS[role]);
    if (token && roleFromToken(token) === role) {
      localStorage.setItem(ROLE_KEY, role);
      return { role, token, user: readStoredUser() };
    }
  }

  clearStoredSession();
  return null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(loadSession);

  const value = useMemo<AuthContextType>(() => {
    /**
     * Starts a session only if the token really carries the role we are about
     * to trust it with, and reports whether it did. Every guard and every page
     * keys off `role` while the request carries `token`, so a session whose two
     * halves disagree is exactly what sends an admin token to a creator
     * endpoint and gets 403 "Creator access required" back.
     */
    const startSession = (role: UserRole, token: string, user: UserData | null): boolean => {
      if (roleFromToken(token) !== role) return false;

      persistSession(role, token, user);
      setSession({ role, token, user });
      return true;
    };

    return {
      isAuthenticated: !!session,
      role: session?.role ?? null,
      user: session?.user ?? null,
      getToken: () => session?.token ?? null,
      
      // Admin login
      login: async (email: string, password: string) => {
        if (!email?.trim() || !password?.trim()) {
          return { success: false, error: 'Email and password are required' };
        }

        try {
          const response = await axios.post(`${API_URL}/api/auth/login`, {
            email: email.trim(),
            password: password.trim(),
          });

          const { token, user: userData } = response.data;
          
          if (!token) {
            return { success: false, error: 'No token received from server' };
          }

          // /api/auth/login is the app's login, not an admin one. Turning an
          // app user's credentials into a session here would show them the whole
          // admin UI while every request behind it came back 403.
          if (!startSession('admin', token, userData ?? null)) {
            return { success: false, error: "This account doesn't have portal access." };
          }
          
          return { success: true };
        } catch (error: any) {
          console.error('Login error:', error);
          
          const errorMessage = error.response?.data?.msg 
            || error.response?.data?.error 
            || 'Login failed. Please check your credentials.';
          
          return { success: false, error: errorMessage };
        }
      },
      
      // Creator login
      loginAsCreator: async (email: string, password: string) => {
        if (!email?.trim() || !password?.trim()) {
          return { success: false, error: 'Email and password are required' };
        }

        try {
          const response = await axios.post(`${API_URL}/api/creator/login`, {
            email: email.trim(),
            password: password.trim(),
          });

          const { token, creator } = response.data;
          
          if (!token) {
            return { success: false, error: 'No token received from server' };
          }

          if (!startSession('creator', token, toCreatorUser(creator))) {
            return { success: false, error: NOT_A_CREATOR_TOKEN };
          }
          
          return { success: true };
        } catch (error: any) {
          console.error('Creator login error:', error);
          
          const errorMessage = error.response?.data?.error 
            || 'Login failed. Please check your credentials.';
          
          return { success: false, error: errorMessage };
        }
      },
      
      // Used by the accept-invite page, which receives a token instead of
      // logging in, so session state is only ever written in one place.
      activateCreatorSession: (token: string, creator: Partial<UserData>) => {
        if (!startSession('creator', token, toCreatorUser(creator))) {
          return { success: false, error: NOT_A_CREATOR_TOKEN };
        }
        return { success: true };
      },
      
      logout: () => {
        clearStoredSession();
        setSession(null);
      },
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};



