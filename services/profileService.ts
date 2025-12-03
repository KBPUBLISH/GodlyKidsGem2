// Profile Service - Helps other services use per-profile localStorage keys

const CURRENT_PROFILE_KEY = 'godly_kids_current_profile';

class ProfileService {
  private currentProfileId: string | null = null;
  private listeners: Array<(profileId: string | null) => void> = [];

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
}

export const profileService = new ProfileService();

