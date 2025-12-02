/**
 * RevenueCat Service for DeSpia Native Integration
 * 
 * This service provides hooks for DeSpia's built-in RevenueCat integration.
 * DeSpia handles the actual native SDK calls - we just provide the interface.
 */

// Entitlement identifier for premium access
export const PREMIUM_ENTITLEMENT_ID = 'premium';

// Product identifiers (these should match your RevenueCat product IDs)
export const PRODUCT_IDS = {
  ANNUAL: 'godlykids_annual',
  MONTHLY: 'godlykids_monthly',
};

// DeSpia bridge interface (DeSpia injects this into window)
declare global {
  interface Window {
    // DeSpia RevenueCat bridge
    Despia?: {
      purchases?: {
        getCustomerInfo: () => Promise<any>;
        getOfferings: () => Promise<any>;
        purchase: (packageId: string) => Promise<any>;
        restorePurchases: () => Promise<any>;
        checkEntitlement: (entitlementId: string) => Promise<boolean>;
      };
      // Alternative naming conventions DeSpia might use
      RevenueCat?: {
        getCustomerInfo: () => Promise<any>;
        getOfferings: () => Promise<any>;
        purchasePackage: (packageId: string) => Promise<any>;
        restorePurchases: () => Promise<any>;
        isPremium: () => Promise<boolean>;
      };
    };
    // Direct RevenueCat bridge (some wrappers use this)
    RevenueCatBridge?: {
      purchase: (productId: string) => Promise<any>;
      restore: () => Promise<any>;
      checkPremium: () => Promise<boolean>;
    };
  }
}

// Check if running in DeSpia native environment
const isNativeApp = (): boolean => {
  return !!(window.Despia || window.RevenueCatBridge);
};

// Get the DeSpia purchases interface
const getDeSpiaPurchases = () => {
  if (window.Despia?.purchases) return window.Despia.purchases;
  if (window.Despia?.RevenueCat) return window.Despia.RevenueCat;
  if (window.RevenueCatBridge) return window.RevenueCatBridge;
  return null;
};

export const RevenueCatService = {
  /**
   * Check if running in native app context
   */
  isNativeApp,

  /**
   * Initialize - DeSpia handles this automatically
   */
  init: async (): Promise<boolean> => {
    if (isNativeApp()) {
      console.log('✅ Running in DeSpia native environment - RevenueCat handled by DeSpia');
      return true;
    }
    console.log('ℹ️ Running in web browser - native purchases not available');
    return false;
  },

  /**
   * Check if user has premium access
   */
  checkPremiumAccess: async (): Promise<boolean> => {
    const bridge = getDeSpiaPurchases();
    
    if (!bridge) {
      // Fallback to localStorage for web testing
      const localPremium = localStorage.getItem('godlykids_premium');
      return localPremium === 'true';
    }

    try {
      // Try different method names that DeSpia might use
      if ('checkEntitlement' in bridge) {
        return await bridge.checkEntitlement(PREMIUM_ENTITLEMENT_ID);
      }
      if ('isPremium' in bridge) {
        return await (bridge as any).isPremium();
      }
      if ('checkPremium' in bridge) {
        return await (bridge as any).checkPremium();
      }
      
      // Fallback: get customer info and check entitlements
      const customerInfo = await bridge.getCustomerInfo();
      return customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID] !== undefined;
    } catch (error) {
      console.error('❌ Error checking premium access:', error);
      return false;
    }
  },

  /**
   * Purchase a subscription
   * @param productId - 'annual' or 'monthly'
   */
  purchase: async (productId: 'annual' | 'monthly'): Promise<{ success: boolean; error?: string }> => {
    const bridge = getDeSpiaPurchases();
    
    if (!bridge) {
      console.warn('⚠️ Native purchases not available - running in web browser');
      // For web testing, simulate success
      localStorage.setItem('godlykids_premium', 'true');
      return { success: true };
    }

    try {
      const rcProductId = productId === 'annual' ? PRODUCT_IDS.ANNUAL : PRODUCT_IDS.MONTHLY;
      console.log('🛒 Initiating purchase for:', rcProductId);
      
      // Try different method names
      if ('purchase' in bridge) {
        await bridge.purchase(rcProductId);
      } else if ('purchasePackage' in bridge) {
        await (bridge as any).purchasePackage(rcProductId);
      }
      
      console.log('✅ Purchase successful!');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      
      // Check if user cancelled
      if (error?.userCancelled || error?.code === 'USER_CANCELLED') {
        return { success: false, error: 'Purchase cancelled' };
      }
      
      return { success: false, error: error?.message || 'Purchase failed' };
    }
  },

  /**
   * Restore previous purchases
   */
  restorePurchases: async (): Promise<{ success: boolean; isPremium: boolean; error?: string }> => {
    const bridge = getDeSpiaPurchases();
    
    if (!bridge) {
      console.warn('⚠️ Native restore not available - running in web browser');
      const localPremium = localStorage.getItem('godlykids_premium') === 'true';
      return { success: true, isPremium: localPremium };
    }

    try {
      console.log('🔄 Restoring purchases...');
      
      // Try different method names
      if ('restorePurchases' in bridge) {
        await bridge.restorePurchases();
      } else if ('restore' in bridge) {
        await (bridge as any).restore();
      }
      
      // Check if premium was restored
      const isPremium = await RevenueCatService.checkPremiumAccess();
      
      console.log('✅ Restore complete. Premium:', isPremium);
      return { success: true, isPremium };
    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      return { success: false, isPremium: false, error: error?.message || 'Restore failed' };
    }
  },

  /**
   * Get available offerings/packages
   */
  getOfferings: async (): Promise<any | null> => {
    const bridge = getDeSpiaPurchases();
    
    if (!bridge || !('getOfferings' in bridge)) {
      return null;
    }

    try {
      return await bridge.getOfferings();
    } catch (error) {
      console.error('❌ Error getting offerings:', error);
      return null;
    }
  },

  /**
   * For web testing - manually set premium status
   */
  setTestPremium: (isPremium: boolean): void => {
    localStorage.setItem('godlykids_premium', isPremium ? 'true' : 'false');
    console.log('🧪 Test premium status set to:', isPremium);
  },
};

export default RevenueCatService;

