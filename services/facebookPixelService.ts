/**
 * Facebook Pixel Service
 * 
 * IMPORTANT: This tracking is ONLY used in parent-gated areas (paywall, settings, sign-in)
 * to comply with Apple's Kids Category guidelines. Children never interact with this code.
 * 
 * Pixel/App ID: 713940524967938
 */

const PIXEL_ID = '713940524967938';

// Track if pixel is initialized
let isInitialized = false;

// Initialize Facebook Pixel (call once in parent-only areas)
const initPixel = (): void => {
  if (isInitialized) return;
  if (typeof window === 'undefined') return;
  
  try {
    // Check if already loaded
    if ((window as any).fbq) {
      isInitialized = true;
      return;
    }

    // Facebook Pixel base code
    const fbq = function(...args: any[]) {
      if ((fbq as any).callMethod) {
        (fbq as any).callMethod.apply(fbq, args);
      } else {
        (fbq as any).queue.push(args);
      }
    };
    
    if (!(window as any).fbq) {
      (window as any).fbq = fbq;
      (fbq as any).push = fbq;
      (fbq as any).loaded = true;
      (fbq as any).version = '2.0';
      (fbq as any).queue = [];
    }

    // Load the Facebook Pixel script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    // Initialize with Pixel ID
    (window as any).fbq('init', PIXEL_ID);
    
    isInitialized = true;
    console.log('📊 Facebook Pixel initialized (parent area only)');
  } catch (error) {
    console.error('Failed to initialize Facebook Pixel:', error);
  }
};

// Track page view
const trackPageView = (pageName?: string): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'PageView');
      if (pageName) {
        console.log(`📊 FB Pixel: PageView - ${pageName}`);
      }
    }
  } catch (error) {
    console.error('FB Pixel PageView error:', error);
  }
};

// Track subscription/paywall view
const trackPaywallView = (): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'ViewContent', {
        content_name: 'Paywall',
        content_category: 'Subscription',
      });
      console.log('📊 FB Pixel: Paywall View');
    }
  } catch (error) {
    console.error('FB Pixel ViewContent error:', error);
  }
};

// Track sign up completion
const trackSignUp = (method: string = 'email'): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'CompleteRegistration', {
        content_name: 'Sign Up',
        registration_method: method,
      });
      console.log('📊 FB Pixel: Sign Up Complete');
    }
  } catch (error) {
    console.error('FB Pixel CompleteRegistration error:', error);
  }
};

// Track subscription initiation (clicked subscribe button)
const trackInitiateCheckout = (plan: string, price?: number): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'InitiateCheckout', {
        content_name: plan,
        content_category: 'Subscription',
        value: price,
        currency: 'USD',
      });
      console.log(`📊 FB Pixel: Initiate Checkout - ${plan}`);
    }
  } catch (error) {
    console.error('FB Pixel InitiateCheckout error:', error);
  }
};

// Track successful purchase/subscription
const trackPurchase = (plan: string, price: number, currency: string = 'USD'): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'Purchase', {
        content_name: plan,
        content_category: 'Subscription',
        value: price,
        currency: currency,
      });
      console.log(`📊 FB Pixel: Purchase - ${plan} $${price}`);
    }
  } catch (error) {
    console.error('FB Pixel Purchase error:', error);
  }
};

// Track subscription start (after successful payment)
const trackSubscribe = (plan: string, price: number): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'Subscribe', {
        value: price,
        currency: 'USD',
        predicted_ltv: price * 12, // Assuming annual value
        subscription_id: plan,
      });
      console.log(`📊 FB Pixel: Subscribe - ${plan}`);
    }
  } catch (error) {
    console.error('FB Pixel Subscribe error:', error);
  }
};

// Track lead (e.g., email capture, trial start)
const trackLead = (source: string): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: source,
        content_category: 'Trial',
      });
      console.log(`📊 FB Pixel: Lead - ${source}`);
    }
  } catch (error) {
    console.error('FB Pixel Lead error:', error);
  }
};

// Custom event tracking
const trackCustomEvent = (eventName: string, params?: Record<string, any>): void => {
  if (!isInitialized) initPixel();
  
  try {
    if ((window as any).fbq) {
      (window as any).fbq('trackCustom', eventName, params);
      console.log(`📊 FB Pixel: Custom - ${eventName}`);
    }
  } catch (error) {
    console.error('FB Pixel Custom event error:', error);
  }
};

export const facebookPixelService = {
  init: initPixel,
  trackPageView,
  trackPaywallView,
  trackSignUp,
  trackInitiateCheckout,
  trackPurchase,
  trackSubscribe,
  trackLead,
  trackCustomEvent,
};

export default facebookPixelService;

