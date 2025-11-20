// Authentication token management
const TOKEN_KEY = 'godly_kids_auth_token';
const USER_KEY = 'godly_kids_user';

export interface AuthToken {
  token: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface User {
  _id?: string;
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  provider?: string;
  credits?: number;
  role?: string;
  age?: number;
  membership?: string;
  membershipPlan?: string;
  country?: string;
  city?: string;
  isConfirmed?: boolean;
  isTestAccount?: boolean;
  deviceId?: string;
  [key: string]: any; // Allow additional fields from API
}

export const authService = {
  // Store authentication token
  setToken: (token: string, expiresIn?: number, refreshToken?: string): void => {
    const authData: AuthToken = {
      token,
      refreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(authData));
    
    // Dispatch custom event for same-window updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('authTokenUpdated'));
    }
  },
  
  // Get refresh token
  getRefreshToken: (): string | null => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) return null;
      const authData: AuthToken = JSON.parse(stored);
      return authData.refreshToken || null;
    } catch {
      return null;
    }
  },

  // Get authentication token
  getToken: (): string | null => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) return null;

      const authData: AuthToken = JSON.parse(stored);
      
      // Check if token is expired
      if (authData.expiresAt && Date.now() > authData.expiresAt) {
        authService.clearToken();
        return null;
      }

      return authData.token;
    } catch {
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return authService.getToken() !== null;
  },

  // Clear authentication token
  clearToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Store user data
  setUser: (user: User): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  // Get user data
  getUser: (): User | null => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
};

