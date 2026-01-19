import React, { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * Portal authentication context.
 * Authenticates with the backend and stores JWT token for admin API access.
 */

const AUTH_KEY = 'gk_portal_auth';
const TOKEN_KEY = 'portal_admin_token';
const API_URL = import.meta.env.VITE_API_URL || 'https://godlykids-backend.onrender.com';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(AUTH_KEY) === 'true' && !!localStorage.getItem(TOKEN_KEY);
  });

  const value = useMemo<AuthContextType>(() => {
    return {
      isAuthenticated,
      login: async (email: string, password: string) => {
        if (!email?.trim() || !password?.trim()) {
          return { success: false, error: 'Email and password are required' };
        }

        try {
          // Authenticate with the backend
          const response = await axios.post(`${API_URL}/api/auth/login`, {
            email: email.trim(),
            password: password.trim(),
          });

          const { token } = response.data;
          
          if (!token) {
            return { success: false, error: 'No token received from server' };
          }

          // Store auth state and token
          localStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(TOKEN_KEY, token);
          setIsAuthenticated(true);
          
          return { success: true };
        } catch (error: any) {
          console.error('Login error:', error);
          
          const errorMessage = error.response?.data?.msg 
            || error.response?.data?.error 
            || 'Login failed. Please check your credentials.';
          
          return { success: false, error: errorMessage };
        }
      },
      logout: () => {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
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



