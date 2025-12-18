// OneSignal is dynamically imported to prevent loading Web SDK in Despia native app
// The native app uses the Despia native OneSignal SDK instead

// OneSignal App ID - set via environment variable
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

let isInitialized = false;
let OneSignal: any = null;

const isDespia = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('despia');
};

const shouldDisableOneSignal = (): boolean => {
  try {
    // Always disable the OneSignal *web* SDK inside our native wrapper UA.
    // Notifications are handled by the native wrapper (OneSignal iOS/Android SDK via Despia).
    if (isDespia()) return true;

    const ua = navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      // iPadOS reports as Mac sometimes
      ((navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as any).standalone === true;

    // If push isn't supported, don't initialize.
    const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!pushSupported) return true;

    // Disable on iOS standalone (most crash-prone).
    if (isIOS && isStandalone) return true;

    return false;
  } catch {
    // If detection fails, default to safe behavior (do not initialize).
    return true;
  }
};

// Dynamically load OneSignal only when needed (not in Despia)
const loadOneSignal = async (): Promise<any> => {
  if (OneSignal) return OneSignal;
  if (isDespia()) return null;
  
  try {
    const module = await import('react-onesignal');
    OneSignal = module.default;
    return OneSignal;
  } catch (error) {
    console.error('Failed to load OneSignal:', error);
    return null;
  }
};

export const NotificationService = {
  /**
   * Initialize OneSignal
   * Call this once when the app loads
   * 
   * In Despia: This does nothing - native SDK handles push via DespiaService.setOneSignalUserId()
   * On Web: Loads and initializes the OneSignal Web SDK
   */
  init: async (): Promise<boolean> => {
    // Log trace for debugging
    try { (window as any).__GK_TRACE__?.('notifications_init_start'); } catch {}

    // Skip entirely in Despia - native SDK handles push
    if (isDespia()) {
      console.log('📱 Despia detected - using native OneSignal SDK (skipping web SDK)');
      try { (window as any).__GK_TRACE__?.('notifications_init_done', { reason: 'despia_native' }); } catch {}
      return false;
    }

    if (isInitialized || !ONESIGNAL_APP_ID) {
      if (!ONESIGNAL_APP_ID) {
        console.warn('⚠️ OneSignal App ID not configured. Set VITE_ONESIGNAL_APP_ID environment variable.');
      }
      try { (window as any).__GK_TRACE__?.('notifications_init_done', { reason: 'already_init_or_no_appid' }); } catch {}
      return false;
    }

    if (shouldDisableOneSignal()) {
      console.warn('⚠️ OneSignal init skipped (unsupported or crash-prone environment).');
      try { (window as any).__GK_TRACE__?.('notifications_init_done', { reason: 'disabled_env' }); } catch {}
      return false;
    }

    try {
      // Dynamically import OneSignal only when needed
      const OS = await loadOneSignal();
      if (!OS) {
        console.warn('⚠️ OneSignal could not be loaded');
        return false;
      }

      await OS.init({
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
      console.log('✅ OneSignal Web SDK initialized successfully');
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
    if (isDespia()) return; // Native SDK handles this
    try {
      const OS = await loadOneSignal();
      if (OS) await OS.Slidedown.promptPush();
    } catch (error) {
      console.error('Error prompting for notification permission:', error);
    }
  },

  /**
   * Check if user is subscribed
   */
  isSubscribed: async (): Promise<boolean> => {
    if (isDespia()) return false; // Can't check native subscription from web
    try {
      const OS = await loadOneSignal();
      if (!OS) return false;
      return await OS.User.PushSubscription.optedIn;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  },

  /**
   * Get the user's OneSignal Player ID (for targeting specific users)
   */
  getPlayerId: async (): Promise<string | null> => {
    if (isDespia()) return null; // Native SDK handles player ID
    try {
      const OS = await loadOneSignal();
      if (!OS) return null;
      return await OS.User.PushSubscription.id || null;
    } catch (error) {
      console.error('Error getting player ID:', error);
      return null;
    }
  },

  /**
   * Set external user ID (link to your user system)
   */
  setExternalUserId: async (userId: string): Promise<void> => {
    if (isDespia()) return; // Use DespiaService.setOneSignalUserId() instead
    try {
      const OS = await loadOneSignal();
      if (!OS) return;
      await OS.login(userId);
      console.log('✅ External user ID set:', userId);
    } catch (error) {
      console.error('Error setting external user ID:', error);
    }
  },

  /**
   * Add tags to the user (for segmentation)
   */
  setTags: async (tags: Record<string, string>): Promise<void> => {
    if (isDespia()) return;
    try {
      const OS = await loadOneSignal();
      if (!OS) return;
      await OS.User.addTags(tags);
      console.log('✅ Tags set:', tags);
    } catch (error) {
      console.error('Error setting tags:', error);
    }
  },

  /**
   * Remove tags from the user
   */
  removeTags: async (tagKeys: string[]): Promise<void> => {
    if (isDespia()) return;
    try {
      const OS = await loadOneSignal();
      if (!OS) return;
      await OS.User.removeTags(tagKeys);
    } catch (error) {
      console.error('Error removing tags:', error);
    }
  },

  /**
   * Opt out of notifications
   */
  optOut: async (): Promise<void> => {
    if (isDespia()) return;
    try {
      const OS = await loadOneSignal();
      if (!OS) return;
      await OS.User.PushSubscription.optOut();
      console.log('✅ User opted out of notifications');
    } catch (error) {
      console.error('Error opting out:', error);
    }
  },

  /**
   * Opt back in to notifications
   */
  optIn: async (): Promise<void> => {
    if (isDespia()) return;
    try {
      const OS = await loadOneSignal();
      if (!OS) return;
      await OS.User.PushSubscription.optIn();
      console.log('✅ User opted in to notifications');
    } catch (error) {
      console.error('Error opting in:', error);
    }
  },

  /**
   * Register push notification player ID with backend for targeted notifications
   * Call this after user signs in or when referral code is generated
   */
  registerPushWithBackend: async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      let playerId: string | null = null;
      
      if (isDespia()) {
        // In Despia, the player ID is set via native SDK
        // We can't get it from JS, but the backend will receive it
        // when Despia calls setonesignalplayerid
        console.log('📱 Despia detected - player ID set via native SDK');
        return true;
      } else {
        // On web, get player ID from OneSignal web SDK
        playerId = await NotificationService.getPlayerId();
      }
      
      if (!playerId) {
        console.log('📵 No player ID available yet (user may not have subscribed to notifications)');
        return false;
      }
      
      // Register with backend
      const response = await fetch('https://backendgk2-0.onrender.com/api/referrals/register-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oneSignalPlayerId: playerId })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ Push notification registered with backend');
        return true;
      } else {
        console.warn('⚠️ Failed to register push with backend:', data.message);
        return false;
      }
    } catch (error) {
      console.error('Error registering push with backend:', error);
      return false;
    }
  }
};

export default NotificationService;
