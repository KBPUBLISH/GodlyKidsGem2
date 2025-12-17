import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Lightweight portal auth.
 * This repo previously referenced an AuthContext that wasn't committed; Netlify builds fail without it.
 * For now we use a simple localStorage flag. Replace with real backend auth when ready.
 */

const AUTH_KEY = 'gk_portal_auth';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem(AUTH_KEY) === 'true');

  const value = useMemo<AuthContextType>(() => {
    return {
      isAuthenticated,
      login: (email: string, password: string) => {
        // Minimal gate: require non-empty fields. Swap to real auth later.
        if (!email?.trim() || !password?.trim()) return false;
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        return true;
      },
      logout: () => {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
      },
    };
  }, [isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};



