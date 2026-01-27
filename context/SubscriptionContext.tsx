import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import RevenueCatService, { PREMIUM_ENTITLEMENT_ID } from '../services/revenueCatService';
import { authService } from '../services/authService';

interface SubscriptionContextType {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isPremium: boolean;
  isNativeApp: boolean;
  
  // Actions
  checkPremiumStatus: () => Promise<boolean>;
  purchase: (plan: 'annual' | 'monthly' | 'lifetime') => Promise<{ success: boolean; error?: string }>;
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

// Helper to get ALL possible user identifiers for subscription check
// Returns array of unique identifiers to check: [email, mongoId, deviceId]
const getAllUserIds = (): string[] => {
  const ids: string[] = [];
  
  // Get user from authService
  const user = authService.getUser();
  if (user) {
    // Email is most important - subscriptions are often linked by email
    if (user.email) ids.push(user.email);
    // MongoDB ID
    if ((user as any)._id) ids.push((user as any)._id);
    if ((user as any).id && (user as any).id !== (user as any)._id) ids.push((user as any).id);
  }

  // Back-compat: some older code stored this key
  const legacyUserStr = localStorage.getItem('godlykids_user');
  if (legacyUserStr) {
    try {
      const legacyUser = JSON.parse(legacyUserStr);
      if (legacyUser.email && !ids.includes(legacyUser.email)) ids.push(legacyUser.email);
      if (legacyUser._id && !ids.includes(legacyUser._id)) ids.push(legacyUser._id);
    } catch {
      // ignore
    }
  }
  
  // Email stored separately
  const storedEmail = localStorage.getItem('godlykids_user_email');
  if (storedEmail && !ids.includes(storedEmail)) ids.push(storedEmail);

  // Device ID as fallback
  const deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
  if (deviceId && !ids.includes(deviceId)) ids.push(deviceId);
  
  return ids;
};

// Legacy helper (for backwards compatibility)
const getUserId = (): string | null => {
  const ids = getAllUserIds();
  return ids.length > 0 ? ids[0] : null;
};

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  // Check subscription status from localStorage and backend (NO automatic restore - that shows UI)
  const checkSubscriptionFromAllSources = useCallback(async (): Promise<boolean> => {
    console.log('🔍 Checking subscription status...');
    
    // 1. Check localStorage first (fastest)
    const localPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (localPremium) {
      console.log('✅ Premium found in localStorage');
      return true;
    }
    
    // 2. Check backend webhook status using ALL possible identifiers
    // The subscription might be linked to email, MongoDB ID, or device ID
    const userIds = getAllUserIds();
    const apiBaseUrl = getApiBaseUrl();
    
    console.log('🔍 Checking purchase status for identifiers:', userIds);
    
    for (const userId of userIds) {
      try {
        console.log(`🔍 Checking purchase status for: ${userId}`);
        const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.isPremium) {
            console.log(`✅ Premium confirmed by backend for: ${userId}`);
            localStorage.setItem('godlykids_premium', 'true');
            // NOTE: Don't dispatch event here - caller will update state directly
            // Dispatching events here caused infinite loops (stack overflow)
            return true;
          }
        }
      } catch (error) {
        console.log(`⚠️ Backend check failed for ${userId}, continuing...`);
      }
    }
    
    // NOTE: We do NOT auto-trigger restore here because DeSpia shows a native popup
    // Users must manually tap "Restore Purchases" button if needed
    
    console.log('ℹ️ No premium subscription found in cache');
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

    // When auth token changes (login/logout), re-check subscription automatically.
    const handleAuthChange = async () => {
      try {
        const hasPremium = await checkSubscriptionFromAllSources();
        setIsPremium(hasPremium);
      } catch {
        // ignore
      }
    };

    window.addEventListener('authTokenUpdated', handleAuthChange);
    window.addEventListener('authSignOut', handleAuthChange);

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
      window.removeEventListener('authTokenUpdated', handleAuthChange);
      window.removeEventListener('authSignOut', handleAuthChange);
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
  const purchase = useCallback(async (plan: 'annual' | 'monthly' | 'lifetime'): Promise<{ success: boolean; error?: string }> => {
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

  // Restore purchases (triggered by user action, so trigger native restore)
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const result = await RevenueCatService.restorePurchases(true); // true = trigger native Apple restore
      
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
