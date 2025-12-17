import OneSignal from 'react-onesignal';

// OneSignal App ID - set via environment variable
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

let isInitialized = false;

const shouldDisableOneSignal = (): boolean => {
  try {
    // Some environments (iOS WKWebView / certain "app shell" wrappers) can crash on resume
    // due to OneSignal Web SDK script behavior. We prefer stability over push here.
    const ua = navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      // iPadOS reports as Mac sometimes
      ((navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as any).standalone === true;
    const isCustomAppUA = /despia/i.test(ua);

    // If push isn't supported, don't initialize.
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!pushSupported) return true;

    // Disable on iOS standalone (most crash-prone) and on our custom app UA.
    if (isIOS && (isStandalone || isCustomAppUA)) return true;

    return false;
  } catch {
    // If detection fails, default to safe behavior (do not initialize).
    return true;
  }
};

export const NotificationService = {
  /**
   * Initialize OneSignal
   * Call this once when the app loads
   */
  init: async (): Promise<boolean> => {
    if (isInitialized || !ONESIGNAL_APP_ID) {
      if (!ONESIGNAL_APP_ID) {
        console.warn('⚠️ OneSignal App ID not configured. Set VITE_ONESIGNAL_APP_ID environment variable.');
      }
      return false;
    }

    if (shouldDisableOneSignal()) {
      console.warn('⚠️ OneSignal init skipped (unsupported or crash-prone environment).');
      return false;
    }

    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true, // For development
        notifyButton: {
          enable: true, // Show the notification bell widget
          size: 'medium',
          position: 'bottom-right',
          showCredit: false,
          text: {
            'tip.state.unsubscribed': 'Get notified about new content!',
            'tip.state.subscribed': 'You\'re subscribed to notifications',
            'tip.state.blocked': 'You\'ve blocked notifications',
            'message.prenotify': 'Click to subscribe to notifications',
            'message.action.subscribed': 'Thanks for subscribing!',
            'message.action.resubscribed': 'You\'re subscribed to notifications',
            'message.action.unsubscribed': 'You won\'t receive notifications anymore',
            'dialog.main.title': 'Manage Notifications',
            'dialog.main.button.subscribe': 'Subscribe',
            'dialog.main.button.unsubscribe': 'Unsubscribe',
            'dialog.blocked.title': 'Unblock Notifications',
            'dialog.blocked.message': 'Follow these instructions to allow notifications:'
          }
        },
        welcomeNotification: {
          title: 'Welcome to Godly Kids! 🌟',
          message: 'You\'ll now receive updates about new stories and lessons!'
        }
      });

      isInitialized = true;
      console.log('✅ OneSignal initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ OneSignal initialization failed:', error);
      return false;
    }
  },

  /**
   * Prompt user to subscribe to notifications
   */
  promptForPermission: async (): Promise<void> => {
    try {
      await OneSignal.Slidedown.promptPush();
    } catch (error) {
      console.error('Error prompting for notification permission:', error);
    }
  },

  /**
   * Check if user is subscribed
   */
  isSubscribed: async (): Promise<boolean> => {
    try {
      return await OneSignal.User.PushSubscription.optedIn;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  },

  /**
   * Get the user's OneSignal Player ID (for targeting specific users)
   */
  getPlayerId: async (): Promise<string | null> => {
    try {
      return await OneSignal.User.PushSubscription.id || null;
    } catch (error) {
      console.error('Error getting player ID:', error);
      return null;
    }
  },

  /**
   * Set external user ID (link to your user system)
   */
  setExternalUserId: async (userId: string): Promise<void> => {
    try {
      await OneSignal.login(userId);
      console.log('✅ External user ID set:', userId);
    } catch (error) {
      console.error('Error setting external user ID:', error);
    }
  },

  /**
   * Add tags to the user (for segmentation)
   */
  setTags: async (tags: Record<string, string>): Promise<void> => {
    try {
      await OneSignal.User.addTags(tags);
      console.log('✅ Tags set:', tags);
    } catch (error) {
      console.error('Error setting tags:', error);
    }
  },

  /**
   * Remove tags from the user
   */
  removeTags: async (tagKeys: string[]): Promise<void> => {
    try {
      await OneSignal.User.removeTags(tagKeys);
    } catch (error) {
      console.error('Error removing tags:', error);
    }
  },

  /**
   * Opt out of notifications
   */
  optOut: async (): Promise<void> => {
    try {
      await OneSignal.User.PushSubscription.optOut();
      console.log('✅ User opted out of notifications');
    } catch (error) {
      console.error('Error opting out:', error);
    }
  },

  /**
   * Opt back in to notifications
   */
  optIn: async (): Promise<void> => {
    try {
      await OneSignal.User.PushSubscription.optIn();
      console.log('✅ User opted in to notifications');
    } catch (error) {
      console.error('Error opting in:', error);
    }
  }
};

export default NotificationService;



