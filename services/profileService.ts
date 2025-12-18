// Profile Service - Helps other services use per-profile localStorage keys
// Also handles cloud sync of profile data

const CURRENT_PROFILE_KEY = 'godly_kids_current_profile';

// Backend profile data structure
export interface CloudProfile {
  parentName: string;
  kids: Array<{
    id: string;
    name: string;
    age: number;
    avatar: any;
    avatarSeed?: string;
  }>;
  coins: number;
  equippedAvatar: any;
  equippedShip: string | null;
  equippedWheel: string | null;
  equippedPet: string | null;
  unlockedAvatarItems: string[];
  unlockedShips: string[];
  unlockedWheels: string[];
  unlockedPets: string[];
  unlockedVoices: string[];
  defaultVoiceId: string | null;
  referralCode: string;
  subscriptionStatus: string;
}

class ProfileService {
  private currentProfileId: string | null = null;
  private listeners: Array<(profileId: string | null) => void> = [];
  private lastSaveTime: number = 0;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize from localStorage
    const stored = localStorage.getItem(CURRENT_PROFILE_KEY);
    this.currentProfileId = stored || null;

    // Listen for profile switches from UserContext
    if (typeof window !== 'undefined') {
      window.addEventListener('profileSwitched', ((e: CustomEvent) => {
        this.setCurrentProfile(e.detail.profileId);
      }) as EventListener);
    }
  }

  getCurrentProfileId(): string | null {
    return this.currentProfileId;
  }

  setCurrentProfile(profileId: string | null) {
    this.currentProfileId = profileId;
    if (profileId) {
      localStorage.setItem(CURRENT_PROFILE_KEY, profileId);
    } else {
      localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
    // Notify listeners
    this.listeners.forEach(listener => listener(profileId));
  }

  /**
   * Generate a localStorage key that includes the current profile ID
   * @param baseKey - The base key name (e.g., 'reading_progress')
   * @returns A profile-specific key (e.g., 'reading_progress_kid123' or 'reading_progress_parent')
   */
  getProfileKey(baseKey: string): string {
    const suffix = this.currentProfileId || 'parent';
    return `${baseKey}_${suffix}`;
  }

  /**
   * Get data from localStorage for the current profile
   */
  getProfileData<T>(baseKey: string, defaultValue: T): T {
    const key = this.getProfileKey(baseKey);
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set data in localStorage for the current profile
   */
  setProfileData<T>(baseKey: string, data: T): void {
    const key = this.getProfileKey(baseKey);
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Subscribe to profile changes
   */
  onProfileChange(callback: (profileId: string | null) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Get API base URL
   */
  private getApiBase(): string {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:5001' 
      : 'https://backendgk2-0.onrender.com';
  }

  /**
   * Save profile to cloud (debounced to avoid too many requests)
   */
  async saveToCloud(userId: string, profileData: Partial<CloudProfile>): Promise<boolean> {
    // Debounce: don't save more than once every 5 seconds
    const now = Date.now();
    if (now - this.lastSaveTime < 5000) {
      // Schedule a save for later
      if (this.saveDebounceTimer) {
        clearTimeout(this.saveDebounceTimer);
      }
      this.saveDebounceTimer = setTimeout(() => {
        this.saveToCloud(userId, profileData);
      }, 5000);
      return true;
    }

    this.lastSaveTime = now;

    try {
      const response = await fetch(`${this.getApiBase()}/api/referrals/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...profileData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log('☁️ Profile saved to cloud');
        return true;
      } else {
        console.warn('☁️ Failed to save profile:', data.message);
        return false;
      }
    } catch (error) {
      console.warn('☁️ Cloud save error:', error);
      return false;
    }
  }

  /**
   * Load profile from cloud (called on login to new device)
   */
  async loadFromCloud(userId: string): Promise<CloudProfile | null> {
    try {
      const response = await fetch(`${this.getApiBase()}/api/referrals/profile/load/${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success && data.profile) {
        console.log('☁️ Profile loaded from cloud:', data.profile.parentName);
        return data.profile;
      } else {
        console.log('☁️ No cloud profile found for user');
        return null;
      }
    } catch (error) {
      console.warn('☁️ Cloud load error:', error);
      return null;
    }
  }

  /**
   * Sync kid profile to backend (called when adding a new kid)
   */
  async syncKidProfile(userId: string, kid: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.getApiBase()}/api/referrals/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          kids: [kid], // Backend will merge with existing kids
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.warn('☁️ Kid sync error:', error);
      return false;
    }
  }
}

export const profileService = new ProfileService();

