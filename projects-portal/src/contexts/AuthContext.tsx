import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Portal authentication context.
 * Supports both admin users and creator users with role-based access.
 */

const AUTH_KEY = 'gk_portal_auth';
const TOKEN_KEY = 'portal_admin_token';
const ROLE_KEY = 'portal_user_role';
const USER_KEY = 'portal_user_data';
const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';

export type UserRole = 'admin' | 'creator';

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
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(AUTH_KEY) === 'true' && !!localStorage.getItem(TOKEN_KEY);
  });
  
  const [role, setRole] = useState<UserRole | null>(() => {
    return localStorage.getItem(ROLE_KEY) as UserRole | null;
  });
  
  const [user, setUser] = useState<UserData | null>(() => {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  });

  const value = useMemo<AuthContextType>(() => {
    return {
      isAuthenticated,
      role,
      user,
      getToken: () => localStorage.getItem(TOKEN_KEY),
      
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

          // Store auth state
          localStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(ROLE_KEY, 'admin');
          if (userData) {
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
            setUser(userData);
          }
          
          setIsAuthenticated(true);
          setRole('admin');
          
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

          // Store auth state
          localStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(ROLE_KEY, 'creator');
          
          const userData: UserData = {
            id: creator.id,
            email: creator.email,
            name: creator.name,
            profileImage: creator.profileImage,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          
          setIsAuthenticated(true);
          setRole('creator');
          setUser(userData);
          
          return { success: true };
        } catch (error: any) {
          console.error('Creator login error:', error);
          
          const errorMessage = error.response?.data?.error 
            || 'Login failed. Please check your credentials.';
          
          return { success: false, error: errorMessage };
        }
      },
      
      logout: () => {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ROLE_KEY);
        localStorage.removeItem(USER_KEY);
        setIsAuthenticated(false);
        setRole(null);
        setUser(null);
      },
    };
  }, [isAuthenticated, role, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};



