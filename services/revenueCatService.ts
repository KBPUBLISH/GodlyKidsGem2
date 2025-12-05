/**
 * RevenueCat Service for DeSpia Native Integration
 * 
 * DeSpia uses URL schemes to trigger RevenueCat actions:
 * - Purchase: window.despia = "revenuecat://purchase?external_id=USER_ID&product=PRODUCT_ID"
 * - Restore: window.despia = "restoreinapppurchases://"
 * - Cancel: window.despia = "cancelinapppurchase://"
 */

// Entitlement identifier for premium access
export const PREMIUM_ENTITLEMENT_ID = 'premium';

// Product identifiers (these should match your RevenueCat product IDs)
export const PRODUCT_IDS = {
  ANNUAL: 'kbpublish.godlykids.yearly',
  MONTHLY: 'kbpublish.godlykids.monthly',
};

// DeSpia URL scheme interface
declare global {
  interface Window {
    despia?: string;
  }
}

// Check if running in DeSpia native environment
const isNativeApp = (): boolean => {
  // DeSpia apps run inside a native wrapper
  // We can detect this by checking user agent or if despia property exists
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('despia') || ua.includes('wkwebview') || ua.includes('mobile');
};

// Get the current user ID for RevenueCat external_id
const getUserId = (): string => {
  // Try to get user ID from localStorage (set during login)
  const userDataStr = localStorage.getItem('godlykids_user');
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      // Prefer MongoDB _id, fallback to email
      return userData._id || userData.id || userData.email || `user_${Date.now()}`;
    } catch {
      // JSON parse error
    }
  }
  
  // Fallback: generate or retrieve a device-based ID
  let deviceId = localStorage.getItem('godlykids_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('godlykids_device_id', deviceId);
  }
  return deviceId;
};

// Listen for purchase completion events (DeSpia may fire custom events)
let purchaseResolve: ((value: { success: boolean; error?: string }) => void) | null = null;
let purchaseTimeout: ReturnType<typeof setTimeout> | null = null;

// Set up listener for purchase completion
const setupPurchaseListener = () => {
  // Listen for custom events that DeSpia might fire
  window.addEventListener('despia-purchase-success', () => {
    console.log('✅ DeSpia purchase success event received');
    localStorage.setItem('godlykids_premium', 'true');
    if (purchaseResolve) {
      purchaseResolve({ success: true });
      purchaseResolve = null;
    }
    if (purchaseTimeout) {
      clearTimeout(purchaseTimeout);
      purchaseTimeout = null;
    }
  });

  window.addEventListener('despia-purchase-failed', (event: any) => {
    console.log('❌ DeSpia purchase failed event received');
    if (purchaseResolve) {
      purchaseResolve({ success: false, error: event?.detail?.message || 'Purchase failed' });
      purchaseResolve = null;
    }
    if (purchaseTimeout) {
      clearTimeout(purchaseTimeout);
      purchaseTimeout = null;
    }
  });

  window.addEventListener('despia-purchase-cancelled', () => {
    console.log('⚠️ DeSpia purchase cancelled event received');
    if (purchaseResolve) {
      purchaseResolve({ success: false, error: 'Purchase cancelled' });
      purchaseResolve = null;
    }
    if (purchaseTimeout) {
      clearTimeout(purchaseTimeout);
      purchaseTimeout = null;
    }
  });
};

// Initialize listeners
if (typeof window !== 'undefined') {
  setupPurchaseListener();
}

export const RevenueCatService = {
  /**
   * Check if running in native app context
   */
  isNativeApp,

  /**
   * Get current user ID
   */
  getUserId,

  /**
   * Initialize - nothing needed for DeSpia URL scheme approach
   */
  init: async (): Promise<boolean> => {
    if (isNativeApp()) {
      console.log('✅ Running in DeSpia native environment - using URL scheme for purchases');
      return true;
    }
    console.log('ℹ️ Running in web browser - native purchases not available');
    return false;
  },

  /**
   * Check if user has premium access
   */
  checkPremiumAccess: async (): Promise<boolean> => {
    // Check localStorage for premium status
    // This should be updated by webhook or after successful purchase
    const localPremium = localStorage.getItem('godlykids_premium');
    return localPremium === 'true';
  },

  /**
   * Purchase a subscription using DeSpia URL scheme
   * @param productId - 'annual' or 'monthly'
   * @param quickMode - if true, returns success quickly after triggering Apple sheet (optimistic)
   */
  purchase: async (productId: 'annual' | 'monthly', quickMode: boolean = true): Promise<{ success: boolean; error?: string }> => {
    const rcProductId = productId === 'annual' ? PRODUCT_IDS.ANNUAL : PRODUCT_IDS.MONTHLY;
    const userId = getUserId();
    
    console.log('🛒 Initiating purchase via DeSpia URL scheme');
    console.log('   Product:', rcProductId);
    console.log('   User ID:', userId);
    console.log('   isNativeApp:', isNativeApp());
    console.log('   quickMode:', quickMode);

    if (!isNativeApp()) {
      console.warn('⚠️ Not in native app - simulating purchase for web testing');
      localStorage.setItem('godlykids_premium', 'true');
      return { success: true };
    }
    
    // Trigger DeSpia purchase via URL scheme
    const purchaseUrl = `revenuecat://purchase?external_id=${encodeURIComponent(userId)}&product=${encodeURIComponent(rcProductId)}`;
    console.log('🔗 Setting window.despia to:', purchaseUrl);
    
    window.despia = purchaseUrl;

    // Quick mode: Instantly return success after triggering Apple sheet.
    // User gets into the app immediately - purchase verification happens via webhooks.
    if (quickMode) {
      console.log('⚡ Quick mode: Instant success - letting user into app immediately');
      localStorage.setItem('godlykids_premium', 'true');
      return { success: true };
    }

    // Legacy mode: Wait for DeSpia to process and user to complete purchase
    // DeSpia should fire 'despia-purchase-success' event or set localStorage
    return new Promise((resolve) => {
      purchaseResolve = resolve;
      let pollCount = 0;
      const maxPolls = 120; // 2 minutes max wait (user might take time to confirm)
      
      console.log('⏳ Waiting for purchase confirmation...');
      
      const pollInterval = setInterval(() => {
        pollCount++;
        const isPremium = localStorage.getItem('godlykids_premium') === 'true';
        
        if (isPremium) {
          console.log('✅ Purchase SUCCESS detected after', pollCount, 'seconds');
          clearInterval(pollInterval);
          if (purchaseTimeout) clearTimeout(purchaseTimeout);
          resolve({ success: true });
          purchaseResolve = null;
          return;
        }
        
        // Check every 10 seconds if still waiting
        if (pollCount % 10 === 0) {
          console.log(`⏳ Still waiting for purchase... (${pollCount}s)`);
        }
        
        if (pollCount >= maxPolls) {
          console.log('⏱️ Purchase timeout after 2 minutes');
          clearInterval(pollInterval);
          resolve({ success: false, error: 'Purchase timed out - please try again' });
          purchaseResolve = null;
        }
      }, 1000);
      
      // Backup timeout at 2.5 minutes
      purchaseTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        const isPremium = localStorage.getItem('godlykids_premium') === 'true';
        if (isPremium) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Purchase was not completed' });
        }
        purchaseResolve = null;
      }, 150000);
    });
  },

  /**
   * Restore previous purchases using DeSpia URL scheme
   */
  restorePurchases: async (): Promise<{ success: boolean; isPremium: boolean; error?: string }> => {
    console.log('🔄 Restoring purchases via DeSpia URL scheme');

    if (!isNativeApp()) {
      console.warn('⚠️ Not in native app - checking local premium status');
      const localPremium = localStorage.getItem('godlykids_premium') === 'true';
      return { success: true, isPremium: localPremium };
    }

    // Trigger DeSpia restore via URL scheme
    window.despia = 'restoreinapppurchases://';
    console.log('🔗 Set window.despia to: restoreinapppurchases://');

    // Wait a moment for the native app to process
    return new Promise((resolve) => {
      setTimeout(() => {
        // Check if premium was restored
        const isPremium = localStorage.getItem('godlykids_premium') === 'true';
        console.log('✅ Restore complete. Premium:', isPremium);
        resolve({ success: true, isPremium });
      }, 3000);
    });
  },

  /**
   * Cancel an ongoing purchase
   */
  cancelPurchase: (): void => {
    console.log('❌ Cancelling purchase via DeSpia URL scheme');
    window.despia = 'cancelinapppurchase://';
    
    if (purchaseResolve) {
      purchaseResolve({ success: false, error: 'Purchase cancelled' });
      purchaseResolve = null;
    }
    if (purchaseTimeout) {
      clearTimeout(purchaseTimeout);
      purchaseTimeout = null;
    }
  },

  /**
   * Get available offerings/packages - not available via URL scheme
   */
  getOfferings: async (): Promise<any | null> => {
    console.log('ℹ️ Offerings not available via DeSpia URL scheme');
    return null;
  },

  /**
   * Mark purchase as successful (call this from webhook handler or after verification)
   */
  markPurchaseSuccess: (): void => {
    console.log('✅ Marking purchase as successful');
    localStorage.setItem('godlykids_premium', 'true');
    
    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('despia-purchase-success'));
  },

  /**
   * For web testing - manually set premium status
   */
  setTestPremium: (isPremium: boolean): void => {
    localStorage.setItem('godlykids_premium', isPremium ? 'true' : 'false');
    console.log('🧪 Test premium status set to:', isPremium);
  },

  /**
   * Clear premium status (for testing or logout)
   */
  clearPremium: (): void => {
    localStorage.removeItem('godlykids_premium');
    console.log('🧹 Premium status cleared');
  },
};

export default RevenueCatService;
