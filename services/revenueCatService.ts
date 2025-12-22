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

// Extend window to include DeSpia callbacks
declare global {
  interface Window {
    onRevenueCatPurchase?: () => void;
    onRevenueCatRestore?: () => void;
  }
}

// Set up listener for purchase completion
const setupPurchaseListener = () => {
  // ⚠️ IMPORTANT: We NO LONGER trust these callbacks for instant premium grant!
  // DeSpia may fire these callbacks before the Apple payment is actually confirmed.
  // We only grant premium after the backend webhook confirms the purchase.
  (window as any).onRevenueCatPurchase = () => {
    console.log('📱 DeSpia onRevenueCatPurchase() called - will verify with backend before granting premium');
    // DO NOT set premium here - wait for backend webhook confirmation!
    // The polling loop will check the backend and set premium when confirmed.
  };
  
  // Also register restore callback
  (window as any).onRevenueCatRestore = () => {
    console.log('📱 DeSpia onRevenueCatRestore() called - will verify with backend before granting premium');
    // DO NOT set premium here - the restore flow will verify with backend
  };

  // Listen for custom events that DeSpia might fire
  // ⚠️ We do NOT grant premium on these events - only after backend webhook confirms
  window.addEventListener('despia-purchase-success', () => {
    console.log('📱 DeSpia despia-purchase-success event - will verify with backend');
    // Do NOT set premium here - wait for backend confirmation
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
  // ⚠️ We do NOT grant premium on success messages - only after backend webhook confirms
  window.addEventListener('message', (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      
      if (data?.type === 'revenuecat_purchase_success' || data?.type === 'despia_purchase_complete') {
        console.log('📱 Purchase complete message received - will verify with backend:', data);
        // Do NOT set premium here - wait for backend confirmation via polling
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
  // This is safe because the backend only sets premium after Apple confirms payment
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === 'godlykids_premium' && event.newValue === 'true') {
      console.log('✅ Premium status confirmed via storage event (likely from backend webhook)');
      window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
      if (purchaseResolve) {
        purchaseResolve({ success: true });
        purchaseResolve = null;
      }
      cleanupPurchaseState();
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
        const maxPolls = 30; // 30 seconds max wait (reduced from 60)
        const minWaitBeforeCheck = 1; // Just 1 second to let Apple sheet appear
        
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
          
          // Check localStorage first (fastest)
          const localPremium = localStorage.getItem('godlykids_premium') === 'true';
          if (localPremium && !resolved) {
            resolved = true;
            console.log('✅ Premium detected in localStorage after', elapsedSeconds.toFixed(1), 'seconds');
            cleanupPurchaseState();
            window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
              window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
              window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
            window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
            window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
                  window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
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
   * Web-based purchase via RevenueCat Billing
   * Opens RevenueCat's hosted checkout page
   */
  purchaseWeb: async (productId: 'annual' | 'monthly'): Promise<{ success: boolean; error?: string }> => {
    // Use Web Billing product IDs (Stripe products) for web purchases
    const webProductId = productId === 'annual' ? WEB_PRODUCT_IDS.ANNUAL : WEB_PRODUCT_IDS.MONTHLY;
    const userId = getUserId();
    
    console.log('🌐 Starting web purchase via RevenueCat Billing');
    console.log('   Product:', webProductId);
    console.log('   User ID:', userId);
    console.log('   Web Billing Enabled:', WEB_BILLING_ENABLED);
    
    // Check if web billing is enabled
    if (!WEB_BILLING_ENABLED) {
      console.log('⚠️ Web billing not enabled - directing user to app stores');
      return { 
        success: false, 
        error: 'Web purchases are not available yet. Please download our app from the App Store or Google Play to subscribe.' 
      };
    }
    
    try {
      // RevenueCat Web Billing uses billing.revenuecat.com
      // Build the checkout URL
      const checkoutUrl = `https://billing.revenuecat.com/${REVENUECAT_WEB_API_KEY}/checkout?customer_id=${encodeURIComponent(userId)}`;
      
      console.log('🔗 Opening RevenueCat checkout:', checkoutUrl);
      
      // Open checkout in new window/tab
      const checkoutWindow = window.open(checkoutUrl, '_blank', 'width=500,height=700');
      
      if (!checkoutWindow) {
        return { success: false, error: 'Please allow popups to complete purchase' };
      }
      
      // Poll for completion (webhook will update backend)
      const apiBaseUrl = localStorage.getItem('godlykids_api_url') || 
        (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
      
      return new Promise((resolve) => {
        let pollCount = 0;
        const maxPolls = 300; // 5 minutes for web checkout (user might need time)
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          // Check if checkout window was closed
          if (checkoutWindow.closed && pollCount > 10) {
            // Window closed - check if purchase completed
            try {
              const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
              const data = await response.json();
              
              if (data.isPremium) {
                clearInterval(pollInterval);
                localStorage.setItem('godlykids_premium', 'true');
                resolve({ success: true });
                return;
              }
            } catch (e) {
              // Ignore error, will timeout
            }
            
            // Give a bit more time after window closes
            if (pollCount > 30) {
              clearInterval(pollInterval);
              resolve({ success: false, error: 'Checkout window closed. If you completed payment, please tap Restore Purchases.' });
              return;
            }
          }
          
          // Poll backend for webhook confirmation
          try {
            const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
            const data = await response.json();
            
            if (data.isPremium) {
              clearInterval(pollInterval);
              if (checkoutWindow && !checkoutWindow.closed) {
                checkoutWindow.close();
              }
              localStorage.setItem('godlykids_premium', 'true');
              resolve({ success: true });
              return;
            }
          } catch (error) {
            // Continue polling
          }
          
          // Log progress every 30 seconds
          if (pollCount % 30 === 0) {
            console.log(`⏳ Waiting for web checkout completion... (${pollCount}s)`);
          }
          
          // Timeout
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            if (checkoutWindow && !checkoutWindow.closed) {
              checkoutWindow.close();
            }
            resolve({ success: false, error: 'Checkout timeout. If you completed payment, please tap Restore Purchases.' });
          }
        }, 1000);
      });
      
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
