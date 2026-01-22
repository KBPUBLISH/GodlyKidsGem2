/**
 * Meta Attribution Service
 * 
 * Tracks app installs and events via Meta Conversions API for
 * attribution from Facebook/Instagram ad campaigns.
 * 
 * Key features:
 * - Captures fbclid from ad click URLs
 * - Stores attribution data for deferred deep linking
 * - Sends install event on first app launch
 * - Tracks purchases server-side for better ROAS reporting
 */

// Normalize API base URL - remove trailing /api or slashes to prevent double /api//api/
const rawApiBase = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
const API_BASE_URL = rawApiBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

// Storage keys
const STORAGE_KEYS = {
  INSTALL_TRACKED: 'meta_install_tracked',
  FBCLID: 'meta_fbclid',
  FBP: '_fbp',
  FBC: '_fbc',
  ATTRIBUTION_DATA: 'meta_attribution',
};

// Get Facebook browser ID from cookie
const getFbp = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/_fbp=([^;]+)/);
  return match ? match[1] : null;
};

// Get Facebook click ID from cookie
const getFbc = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/_fbc=([^;]+)/);
  return match ? match[1] : null;
};

// Get device/platform info
const getPlatformInfo = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  let platform = 'web';
  if (userAgent.includes('despia')) {
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      platform = 'ios';
    } else if (userAgent.includes('android')) {
      platform = 'android';
    }
  }

  return {
    platform,
    userAgent: navigator.userAgent,
    appVersion: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
  };
};

// Capture attribution data from URL (call on app launch)
const captureAttributionFromUrl = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    
    // Capture fbclid (Facebook Click ID) - critical for attribution
    const fbclid = params.get('fbclid');
    if (fbclid) {
      localStorage.setItem(STORAGE_KEYS.FBCLID, fbclid);
      console.log('📊 Meta: Captured fbclid from URL');
      
      // Also set _fbc cookie format: fb.1.timestamp.fbclid
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      document.cookie = `_fbc=${fbc}; max-age=7776000; path=/`; // 90 days
    }

    // Capture UTM parameters for additional context
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');

    if (utmSource || utmCampaign) {
      const attributionData = {
        fbclid,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        capturedAt: Date.now(),
        landingUrl: window.location.href,
      };
      localStorage.setItem(STORAGE_KEYS.ATTRIBUTION_DATA, JSON.stringify(attributionData));
      console.log('📊 Meta: Captured attribution data', attributionData);
    }
  } catch (error) {
    console.error('Error capturing attribution:', error);
  }
};

// Track app install (call once on first launch)
const trackAppInstall = async (email?: string): Promise<boolean> => {
  // Check if already tracked
  if (localStorage.getItem(STORAGE_KEYS.INSTALL_TRACKED)) {
    console.log('📊 Meta: Install already tracked');
    return false;
  }

  try {
    const { platform, userAgent, appVersion } = getPlatformInfo();
    
    // Get stored attribution data
    const storedFbclid = localStorage.getItem(STORAGE_KEYS.FBCLID);
    const attributionJson = localStorage.getItem(STORAGE_KEYS.ATTRIBUTION_DATA);
    const attribution = attributionJson ? JSON.parse(attributionJson) : {};

    const payload = {
      // User identifiers
      email,
      // Device info
      userAgent,
      platform,
      appVersion,
      deviceId: getDeviceId(),
      // Facebook tracking parameters
      fbclid: storedFbclid || attribution.fbclid,
      fbp: getFbp(),
      fbc: getFbc(),
    };

    console.log('📊 Meta: Tracking app install...', { platform, hasFbclid: !!payload.fbclid });

    const response = await fetch(`${API_BASE_URL}/api/meta/app-install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem(STORAGE_KEYS.INSTALL_TRACKED, Date.now().toString());
      console.log('✅ Meta: App install tracked successfully');
      return true;
    } else {
      console.warn('⚠️ Meta: Install tracking failed', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Meta: Install tracking error', error);
    return false;
  }
};

// Track purchase event (for ROAS optimization)
const trackPurchase = async (params: {
  email?: string;
  userId?: string;
  value: number;
  currency?: string;
  plan: string;
  transactionId?: string;
}): Promise<boolean> => {
  try {
    const payload = {
      ...params,
      fbp: getFbp(),
      fbc: getFbc(),
      userAgent: navigator.userAgent,
    };

    console.log('📊 Meta: Tracking purchase...', { plan: params.plan, value: params.value });

    const response = await fetch(`${API_BASE_URL}/api/meta/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Meta: Purchase tracked successfully');
      return true;
    } else {
      console.warn('⚠️ Meta: Purchase tracking failed', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Meta: Purchase tracking error', error);
    return false;
  }
};

// Track custom event
const trackEvent = async (eventName: string, customData?: Record<string, any>): Promise<boolean> => {
  try {
    const payload = {
      eventName,
      fbp: getFbp(),
      fbc: getFbc(),
      userAgent: navigator.userAgent,
      customData,
    };

    const response = await fetch(`${API_BASE_URL}/api/meta/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Meta event tracking error:', error);
    return false;
  }
};

// Generate or retrieve device ID
const getDeviceId = (): string => {
  const DEVICE_ID_KEY = 'godlykids_device_id';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

// Get stored attribution data (for debugging/analytics)
const getAttributionData = () => {
  const json = localStorage.getItem(STORAGE_KEYS.ATTRIBUTION_DATA);
  return json ? JSON.parse(json) : null;
};

// Check if install has been tracked
const isInstallTracked = (): boolean => {
  return !!localStorage.getItem(STORAGE_KEYS.INSTALL_TRACKED);
};

// Initialize attribution tracking (call on app start)
const initialize = (): void => {
  captureAttributionFromUrl();
  
  // Auto-track install if not already tracked (delayed to not block startup)
  setTimeout(() => {
    if (!isInstallTracked()) {
      trackAppInstall();
    }
  }, 2000);
};

export const metaAttributionService = {
  initialize,
  captureAttributionFromUrl,
  trackAppInstall,
  trackPurchase,
  trackEvent,
  getAttributionData,
  isInstallTracked,
  getDeviceId,
};

export default metaAttributionService;
