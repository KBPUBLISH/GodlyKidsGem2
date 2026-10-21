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

  // Sign out - clear all auth data
  signOut: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Dispatch event for any listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('authSignOut'));
    }
  },

  // Store user data
  setUser: (user: User): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Back-compat / shared keys used by other services (RevenueCat, SubscriptionContext)
    try {
      if (user?.email) {
        localStorage.setItem('godlykids_user_email', user.email);
        // Future: if DeSpia exposes RevenueCat setAttribute ($email), call it here so
        // webhooks get email for any existing device-id purchases and restore works by email.
      }
      localStorage.setItem('godlykids_user', JSON.stringify(user));
    } catch {
      // ignore
    }
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

  /**
   * Single source of truth for the identifier sent to backend (monthly-book create, my-books, etc.).
   * Prefer email then deviceId so backend resolveUserId() can find AppUser (it looks up by email or deviceId only).
   * Fallbacks: localStorage (godlykids_user_email, device ids), then user._id / user.id.
   */
  getUserIdForBackend: (): string | null => {
    const user = authService.getUser();
    const raw =
      user?.email
      || (user as any)?.deviceId
      || (typeof localStorage !== 'undefined' && localStorage.getItem('godlykids_user_email'))
      || (typeof localStorage !== 'undefined' && localStorage.getItem('godlykids_device_id'))
      || (typeof localStorage !== 'undefined' && localStorage.getItem('device_id'))
      || (user as any)?._id
      || (user as any)?.id;
    if (raw == null || String(raw).trim() === '') return null;
    return String(raw).trim();
  },
};

