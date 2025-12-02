import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded credentials
const VALID_CREDENTIALS = {
  email: 'admin@gk.com',
  password: 'GodlyKids2024!'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check localStorage on initial load
    return localStorage.getItem('portal_authenticated') === 'true';
  });

  useEffect(() => {
    // Persist auth state
    localStorage.setItem('portal_authenticated', isAuthenticated.toString());
  }, [isAuthenticated]);

  const login = (email: string, password: string): boolean => {
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('portal_authenticated');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

