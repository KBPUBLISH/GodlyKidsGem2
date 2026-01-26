/**
 * RevenueCat Service for DeSpia Native + Web Billing Integration
 * 
 * Native (DeSpia) uses URL schemes:
 * - Purchase: window.despia = "revenuecat://purchase?external_id=USER_ID&product=PRODUCT_ID"
 * - Restore: window.despia = "restoreinapppurchases://"
 * - Cancel: window.despia = "cancelinapppurchase://"
 * 
 * Web uses RevenueCat Web Billing SDK
 */

// RevenueCat Web Billing API Key
// RevenueCat Web Billing configuration
// Sandbox key for testing: rcb_sb_AGCrvdIvLfIRIFAzVNnddnjQT
// Production key: rcb_mGsKFPuvjpOGRhvyyfnyTGypoHNF
const REVENUECAT_WEB_API_KEY = 'rcb_sb_AGCrvdIvLfIRIFAzVNnddnjQT'; // Using sandbox for testing
const WEB_BILLING_ENABLED = true;

// Entitlement identifier for premium access
export const PREMIUM_ENTITLEMENT_ID = 'premium';

// Product identifiers (these should match your RevenueCat product IDs)
export const PRODUCT_IDS = {
  ANNUAL: 'kbpublish.godlykids.yearly',
  MONTHLY: 'kbpublish.godlykids.monthly',
  LIFETIME: 'Lifetimepurchase',
};

// Web Billing product IDs (Stripe products linked in RevenueCat Web Billing)
const WEB_PRODUCT_IDS = {
  ANNUAL: 'prod_TeXtJJ1NvlbB02',
  MONTHLY: 'prod_TeY185r82P9lPF',
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
  // We detect this by checking if the despia URL scheme works
  // Mobile browsers should NOT be treated as native apps
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for explicit DeSpia markers
  if (ua.includes('despia')) return true;
  
  // WKWebView indicates iOS native app (not Safari)
  // But we need to distinguish from Safari on iOS
  if (ua.includes('wkwebview') && !ua.includes('safari')) return true;
  
  // Check if running in standalone PWA mode (home screen app)
  if ((window.navigator as any).standalone === true) return true;
  
  // Check for Android WebView
  if (ua.includes('wv') && ua.includes('android')) return true;
  
  // Default: assume web browser (not native)
  return false;
};

// Get the current user ID for RevenueCat external_id
// IMPORTANT: We use email as the primary identifier so users show up with their email in RevenueCat
const getUserId = (): string => {
  // First, check for email stored directly (most reliable)
  const userEmail = localStorage.getItem('godlykids_user_email');
  if (userEmail) {
    console.log('🔑 RevenueCat using email as external_id:', userEmail);
    return userEmail;
  }
  
  // Try to get user data from localStorage (set during login)
  const userDataStr = localStorage.getItem('godlykids_user');
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      // Prefer email for RevenueCat identification
      if (userData.email) {
        console.log('🔑 RevenueCat using email from user data:', userData.email);
        return userData.email;
      }
      // Fallback to _id if no email
      if (userData._id || userData.id) {
        console.log('🔑 RevenueCat using user ID:', userData._id || userData.id);
        return userData._id || userData.id;
      }
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
  console.log('🔑 RevenueCat using device ID:', deviceId);
  return deviceId;
};

// Listen for purchase completion events (DeSpia may fire custom events)
let purchaseResolve: ((value: { success: boolean; error?: string }) => void) | null = null;
let purchaseTimeout: ReturnType<typeof setTimeout> | null = null;
let purchasePollInterval: ReturnType<typeof setInterval> | null = null;
let purchaseSuccessHandled = false; // Guard against multiple callbacks

// Clean up any pending purchase state
const cleanupPurchaseState = () => {
  if (purchaseTimeout) {
    clearTimeout(purchaseTimeout);
    purchaseTimeout = null;
  }
  if (purchasePollInterval) {
    clearInterval(purchasePollInterval);
    purchasePollInterval = null;
  }
};

// Handle purchase success - with guard against multiple calls
const handlePurchaseSuccess = () => {
  if (purchaseSuccessHandled) {
    console.log('⚠️ Purchase success already handled, ignoring duplicate callback');
    return;
  }
  purchaseSuccessHandled = true;
  
  console.log('✅ Setting premium status');
  localStorage.setItem('godlykids_premium', 'true');
  
  if (purchaseResolve) {
    purchaseResolve({ success: true });
    purchaseResolve = null;
  }
  cleanupPurchaseState();
  
  // Reset the guard after a short delay (for next purchase)
  setTimeout(() => {
    purchaseSuccessHandled = false;
  }, 5000);
};

// Extend window to include DeSpia callbacks
declare global {
  interface Window {
    onRevenueCatPurchase?: () => void;
    onRevenueCatRestore?: () => void;
    iapSuccess?: (data?: any) => void; // Alternative callback from Despia RevenueCat Custom docs
  }
}

// Set up listener for purchase completion
const setupPurchaseListener = () => {
  // DeSpia purchase callbacks - these fire when Apple confirms the purchase
  (window as any).onRevenueCatPurchase = () => {
    console.log('📱✅ DeSpia onRevenueCatPurchase() called');
    handlePurchaseSuccess();
  };
  
  // Also register restore callback
  (window as any).onRevenueCatRestore = () => {
    console.log('📱✅ DeSpia onRevenueCatRestore() called');
    handlePurchaseSuccess();
  };
  
  // iapSuccess callback (alternative from Despia RevenueCat Custom docs)
  (window as any).iapSuccess = (data?: any) => {
    console.log('📱✅ DeSpia iapSuccess() called with data:', data);
    handlePurchaseSuccess();
  };

  // Listen for custom events that DeSpia might fire
  window.addEventListener('despia-purchase-success', () => {
    console.log('📱✅ DeSpia despia-purchase-success event received');
    handlePurchaseSuccess();
  });

  window.addEventListener('despia-purchase-failed', (event: any) => {
    console.log('❌ DeSpia purchase failed event received');
    if (purchaseResolve) {
      purchaseResolve({ success: false, error: event?.detail?.message || 'Purchase failed' });
      purchaseResolve = null;
    }
    cleanupPurchaseState();
  });

  window.addEventListener('despia-purchase-cancelled', () => {
    console.log('⚠️ DeSpia purchase cancelled event received');
    if (purchaseResolve) {
      purchaseResolve({ success: false, error: 'Purchase cancelled' });
      purchaseResolve = null;
    }
    cleanupPurchaseState();
  });
  
  // Listen for DeSpia callback when payment sheet completes (success or failure)
  window.addEventListener('message', (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (data?.type === 'revenuecat_purchase_success' || data?.type === 'despia_purchase_complete') {
        console.log('📱✅ Purchase complete message received:', data);
        handlePurchaseSuccess();
      } else if (data?.type === 'revenuecat_purchase_failed' || data?.type === 'despia_purchase_failed') {
        console.log('❌ Purchase failed message received:', data);
        if (purchaseResolve) {
          purchaseResolve({ success: false, error: data?.error || 'Purchase failed' });
          purchaseResolve = null;
        }
        cleanupPurchaseState();
      }
    } catch {
      // Not a JSON message, ignore
    }
  });
  
  // Listen for localStorage changes from backend webhook confirmation
  // Only handle if we're in the middle of a purchase flow
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === 'godlykids_premium' && event.newValue === 'true' && purchaseResolve) {
      console.log('✅ Premium status confirmed via storage event');
      handlePurchaseSuccess();
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
   * @param productId - 'annual', 'monthly', or 'lifetime'
   * @param quickMode - if true, returns success quickly after triggering Apple sheet (optimistic)
   */
  purchase: async (productId: 'annual' | 'monthly' | 'lifetime', quickMode: boolean = true): Promise<{ success: boolean; error?: string }> => {
    const rcProductId = productId === 'lifetime' 
      ? PRODUCT_IDS.LIFETIME 
      : productId === 'annual' 
        ? PRODUCT_IDS.ANNUAL 
        : PRODUCT_IDS.MONTHLY;
    const userId = getUserId();
    
    console.log('🛒 Initiating purchase via DeSpia URL scheme');
    console.log('   Product:', rcProductId);
    console.log('   User ID:', userId);
    console.log('   isNativeApp:', isNativeApp());
    console.log('   quickMode:', quickMode);

    // CRITICAL: Clear any existing premium status FIRST before anything else
    // This prevents stale localStorage from granting instant premium
    console.log('🧹 Clearing any existing premium status before purchase...');
    localStorage.removeItem('godlykids_premium');
    
    if (!isNativeApp()) {
      // Web-based billing via RevenueCat Web SDK
      console.log('🌐 Web mode - using RevenueCat web billing');
      return RevenueCatService.purchaseWeb(productId);
    }
    
    // Trigger DeSpia purchase via URL scheme
    const purchaseUrl = `revenuecat://purchase?external_id=${encodeURIComponent(userId)}&product=${encodeURIComponent(rcProductId)}`;
    console.log('🔗 Setting window.despia to:', purchaseUrl);
    
    window.despia = purchaseUrl;
    
    // Poll backend for purchase confirmation (via RevenueCat webhook)
    // User stays on unlock screen until payment is confirmed
    if (quickMode) {
      console.log('⏳ Waiting for Apple payment confirmation via webhook...');
      console.log('📱 Apple payment sheet should appear now - user must complete payment');
      
      // Get API base URL
      const apiBaseUrl = localStorage.getItem('godlykids_api_url') || 
        (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
      
      return new Promise((resolve) => {
        // Store resolve for event listeners
        purchaseResolve = resolve;
        
        let resolved = false;
        let pollCount = 0;
        const maxPolls = 60; // 60 seconds max wait - RevenueCat webhooks can be slow
        const minWaitBeforeCheck = 2; // 2 seconds to let Apple sheet appear
        
        // Poll faster initially (every 500ms for first 15 seconds), then slower
        const getPollInterval = () => pollCount < 30 ? 500 : 1000;
        
        const doPoll = async () => {
          pollCount++;
          const elapsedSeconds = pollCount * 0.5; // Approximate seconds (500ms intervals initially)
          
          // Don't check for the first second - let Apple sheet appear
          if (elapsedSeconds < minWaitBeforeCheck) {
            if (pollCount === 1) {
              console.log('⏳ Apple payment sheet appearing...');
            }
            schedulePoll();
            return;
          }
          
          // Check if already resolved by event listener
          if (purchaseResolve !== resolve) {
            cleanupPurchaseState();
            return;
          }
          
          // Check if already handled by DeSpia callback
          if (purchaseSuccessHandled && !resolved) {
            resolved = true;
            console.log('✅ Purchase already handled by callback');
            cleanupPurchaseState();
            resolve({ success: true });
            purchaseResolve = null;
            return;
          }
          
          // Check localStorage first (fastest)
          const localPremium = localStorage.getItem('godlykids_premium') === 'true';
          if (localPremium && !resolved) {
            resolved = true;
            console.log('✅ Premium detected in localStorage after', elapsedSeconds.toFixed(1), 'seconds');
            cleanupPurchaseState();
            resolve({ success: true });
            purchaseResolve = null;
            return;
          }
          
          // Poll backend for webhook confirmation
          try {
            const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
            const data = await response.json();
            
            if (data.isPremium && !resolved) {
              resolved = true;
              console.log('✅ Premium confirmed by backend webhook after', elapsedSeconds.toFixed(1), 'seconds');
              localStorage.setItem('godlykids_premium', 'true');
              cleanupPurchaseState();
              resolve({ success: true });
              purchaseResolve = null;
              return;
            }
            
            // Log progress every 5 seconds
            if (Math.floor(elapsedSeconds) % 5 === 0 && elapsedSeconds > 1) {
              console.log(`⏳ Waiting for payment confirmation... (${elapsedSeconds.toFixed(0)}s)`);
            }
          } catch (error) {
            // Network error - just continue polling
            if (Math.floor(elapsedSeconds) % 5 === 0) {
              console.log(`⚠️ Backend check failed, continuing...`);
            }
          }
          
          // Timeout after maxPolls (30 seconds)
          if (elapsedSeconds >= maxPolls && !resolved) {
            resolved = true;
            cleanupPurchaseState();
            console.log('⏱️ Polling timeout after', maxPolls, 'seconds');
            
            // Final check of localStorage
            const finalPremium = localStorage.getItem('godlykids_premium') === 'true';
            if (finalPremium) {
              console.log('✅ Premium found in final check');
              resolve({ success: true });
              purchaseResolve = null;
              return;
            }
            
            // Not premium yet - tell user it's still processing
            console.log('⚠️ Payment still processing - user may need to wait or restore');
            resolve({ 
              success: false, 
              error: 'Payment is processing. If you completed the payment, please wait a moment or tap "Restore Purchases".' 
            });
            purchaseResolve = null;
            return;
          }
          
          // Schedule next poll
          schedulePoll();
        };
        
        // Schedule a poll with variable interval (faster at first)
        const schedulePoll = () => {
          const interval = pollCount < 30 ? 500 : 1000; // 500ms for first 15s, then 1s
          purchasePollInterval = setTimeout(doPoll, interval) as unknown as ReturnType<typeof setInterval>;
        };
        
        // Start polling
        schedulePoll();
      });
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
   * Restore previous purchases
   * @param triggerNative - If true, triggers Apple's StoreKit popup. Default false for silent check.
   */
  restorePurchases: async (triggerNative: boolean = false): Promise<{ success: boolean; isPremium: boolean; error?: string }> => {
    console.log('🔄 Restoring purchases...');
    console.log('🔄 isNativeApp:', isNativeApp());
    console.log('🔄 triggerNative:', triggerNative);

    const userId = getUserId();
    const userEmail = localStorage.getItem('godlykids_user_email');
    const apiBaseUrl = localStorage.getItem('godlykids_api_url') || 
      (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');

    // Step 1: Check localStorage first (instant)
    const localPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (localPremium) {
      console.log('✅ Premium found in localStorage');
      return { success: true, isPremium: true };
    }

    // Step 2: Check backend for subscription status
    console.log('🔄 Checking backend for subscription...');
    if (userId) {
      try {
        const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔄 Backend response:', data);
          if (data.isPremium) {
            console.log('✅ Premium confirmed by backend!');
            localStorage.setItem('godlykids_premium', 'true');
            return { success: true, isPremium: true };
          }
        }
      } catch (error) {
        console.log('⚠️ Backend check failed:', error);
      }
    }

    // Step 3: If native app and triggerNative is true, trigger Apple's restore
    if (isNativeApp() && triggerNative) {
      console.log('🔗 Triggering native Apple restore...');
      window.despia = 'restoreinapppurchases://';
      
      // Wait for Apple's response
      return new Promise((resolve) => {
        let pollCount = 0;
        const maxPolls = 15; // 15 seconds max for native restore
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          // Check if DeSpia set premium status
          const isPremiumNow = localStorage.getItem('godlykids_premium') === 'true';
          if (isPremiumNow) {
            clearInterval(pollInterval);
            console.log('✅ Premium restored via Apple!');
            resolve({ success: true, isPremium: true });
            return;
          }
          
          // Also check backend periodically
          if (pollCount % 3 === 0 && userId) {
            try {
              const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
              if (response.ok) {
                const data = await response.json();
                if (data.isPremium) {
                  clearInterval(pollInterval);
                  localStorage.setItem('godlykids_premium', 'true');
                  resolve({ success: true, isPremium: true });
                  return;
                }
              }
            } catch (e) {
              // Ignore backend errors during polling
            }
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            resolve({ 
              success: true, 
              isPremium: false, 
              error: `No active subscription found. If you believe this is an error, please contact hello@kbpublish.org with your Apple ID email${userEmail ? ` (${userEmail})` : ''}.`
            });
          }
        }, 1000);
      });
    }

    // No subscription found anywhere
    console.log('❌ No subscription found');
    return { 
      success: true, 
      isPremium: false, 
      error: `No active subscription found for this device${userEmail ? ` or email (${userEmail})` : ''}. If you have an active subscription, please contact hello@kbpublish.org for assistance.`
    };
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
   * Web-based purchase via Stripe Checkout
   * Redirects directly to Stripe's hosted checkout page
   */
  purchaseWeb: async (productId: 'annual' | 'monthly' | 'lifetime'): Promise<{ success: boolean; error?: string }> => {
    const userId = getUserId();
    const userEmail = localStorage.getItem('godlykids_user_email') || '';
    
    console.log('🌐 Starting web purchase via Stripe Checkout');
    console.log('   Plan:', productId);
    console.log('   User ID:', userId);
    console.log('   Email:', userEmail);
    
    try {
      // Get API base URL - strip any /api suffix to avoid double /api//api/
      let API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
      // Remove trailing slashes and /api suffix
      API_BASE = API_BASE.replace(/\/+$/, '').replace(/\/api$/, '');
      
      // Create Stripe checkout session via backend
      const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: productId,
          userId: userId,
          email: userEmail,
          successUrl: `${window.location.origin}${window.location.pathname}#/payment-success`,
          cancelUrl: `${window.location.origin}${window.location.pathname}#/paywall`,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      console.log('🔗 Redirecting to Stripe checkout:', data.url);
      
      // Redirect directly to Stripe checkout
      // User will be redirected back to success/cancel URL after checkout
      // IMPORTANT: Return "pending" - don't grant premium until payment is confirmed!
      // The redirect will happen, and when user returns to /payment-success, 
      // that page will verify the payment and grant premium
      window.location.href = data.url;
      
      // Return pending - DO NOT return success here!
      // Premium should only be granted after Stripe confirms payment
      return { success: false, error: 'REDIRECT_TO_STRIPE' };
      
    } catch (error: any) {
      console.error('Web purchase error:', error);
      return { success: false, error: error.message || 'Failed to start checkout' };
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
    handlePurchaseSuccess();
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
