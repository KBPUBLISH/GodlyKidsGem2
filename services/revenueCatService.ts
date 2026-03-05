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

/**
 * Product identifiers sent to RevenueCat.
 * iOS (App Store) and Android (Google Play) use different product IDs — each platform must use its own.
 */

/** Default / web — used when platform is not iOS or Android native. */
export const PRODUCT_IDS = {
  ANNUAL: 'yearlymember:yearly',
  MONTHLY: 'godlykidsmonthly:monthly',
  LIFETIME: 'lifetime',
};

/**
 * iOS (App Store): Product IDs from App Store Connect / RevenueCat.
 * Must exactly match RevenueCat → App Store (e.g. Monthly Member, Yearly Member).
 */
export const PRODUCT_IDS_IOS: Record<string, string> = {
  MONTHLY: 'kbpublish.godlykids.monthly',
  ANNUAL: 'kbpublish.godlykids.yearly',
  LIFETIME: 'Lifetimepurchase',
};

/**
 * Android (Google Play): Subscription IDs with base plan (subscriptionId:basePlanId).
 * Must exactly match RevenueCat → Google Play and Play Console.
 */
export const PRODUCT_IDS_ANDROID = {
  ANNUAL: 'yearlymember:yearly',
  MONTHLY: 'godlykidsmonthly:monthly',
  LIFETIME: 'lifetime',
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

// Handle DeSpia purchase callback — ONLY sets a flag.
// The purchase poll loop verifies with the backend before granting premium.
// DeSpia fires this callback even when the user cancels the Apple sheet,
// so we MUST NOT set localStorage or resolve here.
const handlePurchaseSuccess = () => {
  if (purchaseSuccessHandled) {
    console.log('⚠️ Purchase callback already received, ignoring duplicate');
    return;
  }
  purchaseSuccessHandled = true;
  console.log('📱 DeSpia purchase callback received — will verify with backend');
  
  // Reset the guard after a delay (for next purchase attempt)
  setTimeout(() => {
    purchaseSuccessHandled = false;
  }, 90000);
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
  
  // Note: localStorage storage event listener removed — backend polling is the
  // only trusted confirmation source. DeSpia callbacks and localStorage writes
  // cannot be trusted because DeSpia fires success even on cancel.
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
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes('android');
    const isIOS = (ua.includes('iphone') || ua.includes('ipad')) && (ua.includes('despia') || ua.includes('wkwebview'));
    const ids = isAndroid ? PRODUCT_IDS_ANDROID : isIOS ? PRODUCT_IDS_IOS : PRODUCT_IDS;
    const rcProductId = productId === 'lifetime'
      ? ids.LIFETIME
      : productId === 'annual'
        ? ids.ANNUAL
        : ids.MONTHLY;
    const userId = getUserId();
    
    console.log('🛒 Initiating purchase via DeSpia URL scheme');
    console.log('   Platform:', isAndroid ? 'Android' : isIOS ? 'iOS' : 'Web/default');
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
    
    // Get API base URL
    const apiBaseUrl = localStorage.getItem('godlykids_api_url') || 
      (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
    
    // IMPORTANT: Snapshot backend premium status BEFORE triggering the purchase.
    // The purchase-status endpoint returns true for ANY premium source (reverse trial,
    // old subscription, etc.). We must not treat a pre-existing premium as a "new purchase".
    let wasPremiumBefore = false;
    try {
      const preCheck = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
      if (preCheck.ok) {
        const preData = await preCheck.json();
        wasPremiumBefore = !!preData.isPremium;
        console.log('📋 Backend premium status BEFORE purchase:', wasPremiumBefore);
      }
    } catch {
      console.log('⚠️ Could not pre-check backend premium status');
    }
    
    // Signal that a purchase is in progress (prevents visibility handler from interfering)
    (window as any).__GK_PURCHASE_IN_PROGRESS__ = true;
    
    // Trigger DeSpia/RevenueCat purchase (Android → Google Play, iOS → App Store)
    const purchaseUrl = `revenuecat://purchase?external_id=${encodeURIComponent(userId)}&product=${encodeURIComponent(rcProductId)}`;
    console.log(isAndroid ? '🔗 [Android] Sending product to RevenueCat → Google Play:' : '🔗 Sending product to RevenueCat:', rcProductId, purchaseUrl);
    
    window.despia = purchaseUrl;
    
    // Poll backend for purchase confirmation (via RevenueCat webhook)
    // User stays on unlock screen until payment is confirmed
    if (quickMode) {
      console.log('⏳ Waiting for Apple payment confirmation via webhook...');
      console.log('📱 Apple payment sheet should appear now - user must complete payment');
      
      return new Promise((resolve) => {
        // Store resolve for event listeners
        purchaseResolve = resolve;
        
        const cleanupAndResolve = (result: { success: boolean; error?: string }) => {
          (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
          cleanupPurchaseState();
          purchaseResolve = null;
          resolve(result);
        };
        
        let resolved = false;
        let pollCount = 0;
        const maxPolls = 60; // 60 seconds max wait - RevenueCat webhooks can be slow
        const minWaitBeforeCheck = 2; // 2 seconds to let Apple sheet appear
        
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
            (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
            cleanupPurchaseState();
            return;
          }
          
          // Always verify with the backend — this is the ONLY source of truth.
          // DeSpia callbacks fire even when the user cancels, so we never trust
          // them alone. We poll the backend regardless of callback status.
          try {
            const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
            const data = await response.json();
            
            if (data.isPremium && !wasPremiumBefore && !resolved) {
              resolved = true;
              console.log('✅ Premium confirmed by backend after', elapsedSeconds.toFixed(1), 'seconds');
              localStorage.setItem('godlykids_premium', 'true');
              cleanupAndResolve({ success: true });
              return;
            }
          } catch (error) {
            if (Math.floor(elapsedSeconds) % 5 === 0) {
              console.log(`⚠️ Backend check failed, continuing...`);
            }
          }
          
          // Log progress every 5 seconds
          if (Math.floor(elapsedSeconds) % 5 === 0 && elapsedSeconds > 1) {
            console.log(`⏳ Waiting for payment confirmation... (${elapsedSeconds.toFixed(0)}s)`, wasPremiumBefore ? '(backend poll skipped — was already premium)' : '');
          }
          
          // Timeout after maxPolls
          if (elapsedSeconds >= maxPolls && !resolved) {
            resolved = true;
            console.log('⏱️ Polling timeout after', maxPolls, 'seconds');
            
            console.log('⚠️ Payment not confirmed by backend — user may need to wait or restore');
            cleanupAndResolve({ 
              success: false, 
              error: 'Payment is processing. If you completed the payment, please wait a moment or tap "Restore Purchases".' 
            });
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
    // Legacy mode: poll backend for confirmation (never trust DeSpia callbacks alone)
    return new Promise((resolve) => {
      purchaseResolve = resolve;
      let pollCount = 0;
      const maxPolls = 120;
      
      console.log('⏳ Waiting for purchase confirmation (legacy mode)...');
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // Verify with backend — the only source of truth
        try {
          const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
          const data = await response.json();
          if (data.isPremium && !wasPremiumBefore) {
            console.log('✅ Premium confirmed by backend after', pollCount, 'seconds');
            localStorage.setItem('godlykids_premium', 'true');
            clearInterval(pollInterval);
            if (purchaseTimeout) clearTimeout(purchaseTimeout);
            (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
            resolve({ success: true });
            purchaseResolve = null;
            return;
          }
        } catch {
          // continue polling
        }
        
        if (pollCount % 10 === 0) {
          console.log(`⏳ Still waiting for purchase... (${pollCount}s)`);
        }
        
        if (pollCount >= maxPolls) {
          console.log('⏱️ Purchase timeout after 2 minutes');
          clearInterval(pollInterval);
          (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
          resolve({ success: false, error: 'Purchase timed out - please try again' });
          purchaseResolve = null;
        }
      }, 1000);
      
      purchaseTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
        resolve({ success: false, error: 'Purchase was not completed' });
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
    (window as any).__GK_PURCHASE_IN_PROGRESS__ = false;
    
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
