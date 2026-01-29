import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import RevenueCatService, { PREMIUM_ENTITLEMENT_ID } from '../services/revenueCatService';
import { authService } from '../services/authService';

interface ReverseTrialStatus {
  hasReverseTrial: boolean;
  isActive: boolean;
  daysRemaining: number;
  trialEndDate: Date | null;
  eligible: boolean;
}

interface SubscriptionContextType {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isPremium: boolean;
  isNativeApp: boolean;
  
  // Reverse Trial State
  reverseTrial: ReverseTrialStatus;
  
  // Actions
  checkPremiumStatus: () => Promise<boolean>;
  purchase: (plan: 'annual' | 'monthly' | 'lifetime') => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;
  startReverseTrial: () => Promise<{ success: boolean; error?: string }>;
  checkReverseTrialStatus: () => Promise<ReverseTrialStatus>;
  markReverseTrialConverted: () => Promise<void>;
  
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
  
  // Reverse Trial State
  const [reverseTrial, setReverseTrial] = useState<ReverseTrialStatus>({
    hasReverseTrial: false,
    isActive: false,
    daysRemaining: 0,
    trialEndDate: null,
    eligible: true,
  });

  // Check subscription status from localStorage and backend (NO automatic restore - that shows UI)
  const checkSubscriptionFromAllSources = useCallback(async (): Promise<boolean> => {
    console.log('🔍 Checking subscription status...');
    
    // 1. Check localStorage first (fastest)
    const localPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (localPremium) {
      console.log('✅ Premium found in localStorage');
      return true;
    }
    
    // 1.5. Check for active reverse trial in localStorage
    const localReverseTrial = localStorage.getItem('godlykids_reverse_trial') === 'true';
    if (localReverseTrial) {
      console.log('🎁 Reverse trial found in localStorage - will verify with backend');
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

  // Check reverse trial status from backend
  const checkReverseTrialStatus = useCallback(async (): Promise<ReverseTrialStatus> => {
    try {
      const userIds = getAllUserIds();
      const apiBaseUrl = getApiBaseUrl();
      
      for (const userId of userIds) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/app-user/reverse-trial-status/${encodeURIComponent(userId)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const status: ReverseTrialStatus = {
                hasReverseTrial: data.hasReverseTrial,
                isActive: data.isActive,
                daysRemaining: data.daysRemaining || 0,
                trialEndDate: data.trialEndDate ? new Date(data.trialEndDate) : null,
                eligible: data.eligible,
              };
              setReverseTrial(status);
              
              // If reverse trial is active, grant premium access locally
              if (status.isActive) {
                localStorage.setItem('godlykids_reverse_trial', 'true');
                localStorage.setItem('godlykids_premium', 'true');
                setIsPremium(true);
              } else if (status.hasReverseTrial && !status.isActive) {
                // Trial expired
                localStorage.removeItem('godlykids_reverse_trial');
              }
              
              return status;
            }
          }
        } catch (error) {
          console.log(`⚠️ Reverse trial check failed for ${userId}`);
        }
      }
      
      return { hasReverseTrial: false, isActive: false, daysRemaining: 0, trialEndDate: null, eligible: true };
    } catch (error) {
      console.error('Error checking reverse trial:', error);
      return { hasReverseTrial: false, isActive: false, daysRemaining: 0, trialEndDate: null, eligible: true };
    }
  }, []);

  // Start a reverse trial
  const startReverseTrial = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const userIds = getAllUserIds();
      const apiBaseUrl = getApiBaseUrl();
      const deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
      const email = userIds.find(id => id.includes('@'));
      
      const response = await fetch(`${apiBaseUrl}/api/app-user/start-reverse-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, email }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        localStorage.setItem('godlykids_reverse_trial', 'true');
        localStorage.setItem('godlykids_premium', 'true');
        setIsPremium(true);
        
        // Safely parse trial end date
        let trialEndDate: Date | null = null;
        try {
          if (data.trialEndDate) {
            trialEndDate = new Date(data.trialEndDate);
            // Check for Invalid Date
            if (isNaN(trialEndDate.getTime())) {
              trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Fallback: 7 days from now
            }
          } else {
            trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days from now
          }
        } catch {
          trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Fallback on error
        }
        
        setReverseTrial({
          hasReverseTrial: true,
          isActive: true,
          daysRemaining: 7,
          trialEndDate,
          eligible: false,
        });
        
        console.log('🎁 Reverse trial started successfully');
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Failed to start trial' };
    } catch (error: any) {
      console.error('Error starting reverse trial:', error);
      return { success: false, error: error.message || 'Failed to start trial' };
    }
  }, []);

  // Mark reverse trial as converted (user subscribed)
  const markReverseTrialConverted = useCallback(async (): Promise<void> => {
    try {
      const userIds = getAllUserIds();
      const apiBaseUrl = getApiBaseUrl();
      const deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
      const email = userIds.find(id => id.includes('@'));
      
      await fetch(`${apiBaseUrl}/api/app-user/reverse-trial-converted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, email }),
      });
      
      localStorage.removeItem('godlykids_reverse_trial');
      console.log('🎉 Reverse trial marked as converted');
    } catch (error) {
      console.error('Error marking reverse trial converted:', error);
    }
  }, []);

  const value: SubscriptionContextType = {
    isInitialized,
    isLoading,
    isPremium,
    isNativeApp,
    reverseTrial,
    checkPremiumStatus,
    purchase,
    restorePurchases,
    startReverseTrial,
    checkReverseTrialStatus,
    markReverseTrialConverted,
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
