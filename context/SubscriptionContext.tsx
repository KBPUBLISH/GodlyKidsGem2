import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import RevenueCatService, { PREMIUM_ENTITLEMENT_ID } from '../services/revenueCatService';

interface SubscriptionContextType {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isPremium: boolean;
  isNativeApp: boolean;
  
  // Actions
  checkPremiumStatus: () => Promise<boolean>;
  purchase: (plan: 'annual' | 'monthly') => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  
  // For testing in web browser
  setTestPremium: (isPremium: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

// Helper to get API base URL
const getApiBaseUrl = (): string => {
  return localStorage.getItem('godlykids_api_url') || 
    (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
};

// Helper to get user ID for subscription check
const getUserId = (): string | null => {
  const userDataStr = localStorage.getItem('godlykids_user');
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      return userData._id || userData.id || userData.email || null;
    } catch {
      return null;
    }
  }
  return localStorage.getItem('godlykids_device_id');
};

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  // Check subscription status from multiple sources
  const checkSubscriptionFromAllSources = useCallback(async (): Promise<boolean> => {
    console.log('🔍 Checking subscription status from all sources...');
    
    // 1. Check localStorage first (fastest)
    const localPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (localPremium) {
      console.log('✅ Premium found in localStorage');
      return true;
    }
    
    // 2. Check backend webhook status (in case webhook arrived)
    const userId = getUserId();
    if (userId) {
      try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.isPremium) {
            console.log('✅ Premium confirmed by backend');
            localStorage.setItem('godlykids_premium', 'true');
            window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
            return true;
          }
        }
      } catch (error) {
        console.log('⚠️ Backend check failed, continuing...');
      }
    }
    
    // 3. In native app, trigger a silent restore to check with Apple/Google
    if (RevenueCatService.isNativeApp()) {
      console.log('📱 Native app - triggering silent restore check...');
      try {
        // Trigger DeSpia restore silently
        window.despia = 'restoreinapppurchases://';
        
        // Wait briefly and check localStorage again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterRestorePremium = localStorage.getItem('godlykids_premium') === 'true';
        if (afterRestorePremium) {
          console.log('✅ Premium found after silent restore');
          window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
          return true;
        }
      } catch (error) {
        console.log('⚠️ Silent restore check failed');
      }
    }
    
    console.log('ℹ️ No premium subscription found');
    return false;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      
      try {
        // Check if running in native app
        const native = RevenueCatService.isNativeApp();
        setIsNativeApp(native);
        
        // Initialize RevenueCat (DeSpia handles this for native)
        await RevenueCatService.init();
        setIsInitialized(true);
        
        // Check premium status from all sources
        const hasPremium = await checkSubscriptionFromAllSources();
        setIsPremium(hasPremium);
        
        console.log('🔐 Subscription initialized:', { native, isPremium: hasPremium });
      } catch (error) {
        console.error('Error initializing subscription context:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Listen for premium status changes from DeSpia
    const handlePremiumChange = (event: CustomEvent) => {
      console.log('📱 Premium status changed:', event.detail);
      const newPremiumStatus = event.detail?.isPremium ?? false;
      setIsPremium(newPremiumStatus);
      // Also update localStorage
      localStorage.setItem('godlykids_premium', newPremiumStatus ? 'true' : 'false');
    };

    window.addEventListener('revenuecat:premiumChanged' as any, handlePremiumChange);
    window.addEventListener('despia:subscriptionChanged' as any, handlePremiumChange);

    return () => {
      window.removeEventListener('revenuecat:premiumChanged' as any, handlePremiumChange);
      window.removeEventListener('despia:subscriptionChanged' as any, handlePremiumChange);
    };
  }, [checkSubscriptionFromAllSources]);

  // Re-check subscription when app becomes visible (returns from background)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        console.log('📱 App became visible - checking subscription status...');
        const hasPremium = await checkSubscriptionFromAllSources();
        if (hasPremium !== isPremium) {
          console.log('🔄 Subscription status changed:', hasPremium);
          setIsPremium(hasPremium);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also check when app regains focus
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isInitialized, isPremium, checkSubscriptionFromAllSources]);

  // Check premium status from all sources
  const checkPremiumStatus = useCallback(async (): Promise<boolean> => {
    try {
      const hasPremium = await checkSubscriptionFromAllSources();
      setIsPremium(hasPremium);
      return hasPremium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  }, [checkSubscriptionFromAllSources]);

  // Purchase a subscription
  const purchase = useCallback(async (plan: 'annual' | 'monthly'): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const result = await RevenueCatService.purchase(plan);
      
      if (result.success) {
        // Re-check premium status after purchase
        const hasPremium = await RevenueCatService.checkPremiumAccess();
        setIsPremium(hasPremium);
      }
      
      return result;
    } catch (error: any) {
      return { success: false, error: error.message || 'Purchase failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const result = await RevenueCatService.restorePurchases();
      
      if (result.success) {
        setIsPremium(result.isPremium);
      }
      
      return { success: result.success, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message || 'Restore failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // For web testing
  const setTestPremium = useCallback((premium: boolean) => {
    RevenueCatService.setTestPremium(premium);
    setIsPremium(premium);
  }, []);

  const value: SubscriptionContextType = {
    isInitialized,
    isLoading,
    isPremium,
    isNativeApp,
    checkPremiumStatus,
    purchase,
    restorePurchases,
    setTestPremium,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
