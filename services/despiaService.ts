/**
 * DeSpia Native SDK Integration
 * https://npm.despia.com
 * 
 * This service handles integration with DeSpia's native iOS/Android runtime.
 * When running in DeSpia, we use native SDK features instead of web-based alternatives.
 */

import despia from 'despia-native';

// Detect if we're running in the DeSpia native runtime
export const isDespia = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('despia');
};

// Detect iOS specifically
export const isDespiaIOS = (): boolean => {
  if (!isDespia()) return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('iphone') || ua.includes('ipad');
};

// Detect Android specifically
export const isDespiaAndroid = (): boolean => {
  if (!isDespia()) return false;
  return navigator.userAgent.toLowerCase().includes('android');
};

/**
 * DeSpia Native Service
 * Provides access to native device features through the DeSpia runtime
 */
export const DespiaService = {
  /**
   * Check if running in DeSpia
   */
  isNative: isDespia,
  isIOS: isDespiaIOS,
  isAndroid: isDespiaAndroid,

  /**
   * Get the unique device UUID
   * This is automatically provided by the DeSpia runtime
   */
  getDeviceId: (): string | null => {
    if (!isDespia()) return null;
    try {
      return (despia as any).uuid || null;
    } catch {
      return null;
    }
  },

  /**
   * Link user ID to OneSignal native SDK for push notifications
   * Call this on every app load when user is logged in
   * https://npm.despia.com/default-guide/native-features/onesignal-notifications
   */
  setOneSignalUserId: async (userId: string): Promise<void> => {
    if (!isDespia() || !userId) return;
    
    try {
      console.log('📱 Linking OneSignal player ID to user:', userId);
      await despia(`setonesignalplayerid://?user_id=${userId}`);
      console.log('✅ OneSignal user ID linked successfully');
    } catch (error) {
      console.error('❌ Failed to link OneSignal user ID:', error);
    }
  },

  /**
   * Haptic Feedback
   * https://npm.despia.com/default-guide/native-features/haptic-feedback
   */
  haptics: {
    light: () => {
      if (!isDespia()) return;
      try { despia('lighthaptic://'); } catch {}
    },
    heavy: () => {
      if (!isDespia()) return;
      try { despia('heavyhaptic://'); } catch {}
    },
    success: () => {
      if (!isDespia()) return;
      try { despia('successhaptic://'); } catch {}
    },
    warning: () => {
      if (!isDespia()) return;
      try { despia('warninghaptic://'); } catch {}
    },
    error: () => {
      if (!isDespia()) return;
      try { despia('errorhaptic://'); } catch {}
    },
  },

  /**
   * Open app settings (for re-requesting notification permissions)
   * https://npm.despia.com/default-guide/native-features/app-settings
   */
  openSettings: (): void => {
    if (!isDespia()) return;
    try {
      despia('settingsapp://');
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  },

  /**
   * Social Share Dialog
   * https://npm.despia.com/default-guide/native-features/social-share-dialog
   */
  share: (message: string, url: string): void => {
    if (!isDespia()) {
      // Fallback to web share API or do nothing
      if (navigator.share) {
        navigator.share({ text: message, url }).catch(() => {});
      }
      return;
    }
    try {
      despia(`shareapp://message?=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`);
    } catch (error) {
      console.error('Failed to share:', error);
    }
  },

  /**
   * Save image to camera roll
   * https://npm.despia.com/default-guide/native-features/save-to-camera-roll
   */
  saveImageToCameraRoll: (imageUrl: string): void => {
    if (!isDespia()) return;
    try {
      despia(`savethisimage://?url=${encodeURIComponent(imageUrl)}`);
    } catch (error) {
      console.error('Failed to save image:', error);
    }
  },

  /**
   * Get tracking consent status (ATT)
   * https://npm.despia.com/default-guide/native-features/privacy-compliance
   */
  isTrackingDisabled: (): boolean => {
    if (!isDespia()) return false;
    try {
      return (despia as any).trackingDisabled || false;
    } catch {
      return false;
    }
  },

  /**
   * Get store location for regional content
   * https://npm.despia.com/default-guide/native-features/store-location-access
   */
  getStoreLocation: (): string | null => {
    if (!isDespia()) return null;
    try {
      return (despia as any).storeLocation || null;
    } catch {
      return null;
    }
  },

  /**
   * Local Push Notifications
   * https://npm.despia.com/default-guide/native-features/local-push
   */
  sendLocalNotification: (
    title: string,
    message: string,
    delaySeconds: number = 0,
    url?: string
  ): void => {
    if (!isDespia()) return;
    try {
      const urlParam = url ? encodeURIComponent(url) : '';
      despia(`sendlocalpushmsg://push.send?s=${delaySeconds}=msg!${encodeURIComponent(message)}&!#${encodeURIComponent(title)}&!#${urlParam}`);
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  },

  /**
   * RevenueCat In-App Purchases
   * https://npm.despia.com/default-guide/native-features/revenuecat-custom
   */
  purchase: (productId: string, externalUserId: string): void => {
    if (!isDespia()) {
      console.warn('In-app purchases only work in the native app');
      return;
    }
    try {
      despia(`revenuecat://purchase?external_id=${externalUserId}&product=${productId}`);
    } catch (error) {
      console.error('Failed to initiate purchase:', error);
    }
  },

  /**
   * RevenueCat Paywall
   * https://npm.despia.com/default-guide/native-features/revenuecat-paywalls
   */
  launchPaywall: (offering: string, externalUserId: string): void => {
    if (!isDespia()) {
      console.warn('Paywall only works in the native app');
      return;
    }
    try {
      despia(`revenuecat://launchPaywall?external_id=${externalUserId}&offering=${offering}`);
    } catch (error) {
      console.error('Failed to launch paywall:', error);
    }
  },

  /**
   * Restore purchases
   */
  restorePurchases: (externalUserId: string): void => {
    if (!isDespia()) {
      console.warn('Restore purchases only works in the native app');
      return;
    }
    try {
      despia(`revenuecat://restore?external_id=${externalUserId}`);
    } catch (error) {
      console.error('Failed to restore purchases:', error);
    }
  },

  /**
   * Request App Store / Play Store Review
   * https://npm.despia.com/default-guide/native-features/rate-app
   */
  requestReview: (): void => {
    if (!isDespia()) {
      console.warn('Rate app only works in the native app');
      return;
    }
    try {
      console.log('🌟 DeSpia: Requesting native review dialog');
      despia('rateapp://');
    } catch (error) {
      console.error('Failed to request review:', error);
    }
  },
};

export default DespiaService;

