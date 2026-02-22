
import React, { useMemo, useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import WorldPage, { PersistentWorldIsland } from './pages/WorldPage';
import ReferralPromptModal from './components/features/ReferralPromptModal';
import LifetimeOfferModal from './components/features/LifetimeOfferModal';
import CreateAccountModal from './components/modals/CreateAccountModal';
import ReverseTrialExpiredModal from './components/modals/ReverseTrialExpiredModal';
import SaveProgressModal from './components/modals/SaveProgressModal';
import { useUser } from './context/UserContext';

// Guest content tracking - tracks what content guests have consumed
const GUEST_CONTENT_KEY = 'godlykids_guest_content';
const GUEST_PROMPT_SHOWN_KEY = 'godlykids_guest_prompt_shown';

const getGuestContentStats = () => {
  try {
    const data = localStorage.getItem(GUEST_CONTENT_KEY);
    if (!data) return { booksRead: 0, audioPlayed: 0 };
    return JSON.parse(data);
  } catch {
    return { booksRead: 0, audioPlayed: 0 };
  }
};

const trackGuestContent = (type: 'book' | 'audio') => {
  try {
    const current = getGuestContentStats();
    if (type === 'book') {
      current.booksRead = (current.booksRead || 0) + 1;
    } else {
      current.audioPlayed = (current.audioPlayed || 0) + 1;
    }
    localStorage.setItem(GUEST_CONTENT_KEY, JSON.stringify(current));
    // Dispatch event so components can react
    window.dispatchEvent(new CustomEvent('guestContentConsumed', { detail: current }));
  } catch {}
};

const hasGuestConsumedContent = () => {
  const stats = getGuestContentStats();
  return stats.booksRead > 0 || stats.audioPlayed > 0;
};

const hasGuestPromptBeenShown = () => {
  return localStorage.getItem(GUEST_PROMPT_SHOWN_KEY) === 'true';
};

const markGuestPromptShown = () => {
  localStorage.setItem(GUEST_PROMPT_SHOWN_KEY, 'true');
};

// Export for use in content pages
(window as any).trackGuestContent = trackGuestContent;

// Diagnostic: Log when the entire app JS module is evaluated (WebView recreation)
if (!(window as any).__GK_APP_BOOTED__) {
  (window as any).__GK_APP_BOOTED__ = true;
  console.log('🚀 APP BOOT (WebView created)', new Date().toISOString());

  // Generate deviceId immediately on app boot (before any React renders)
  // This ensures deviceId exists for link-email during signup
  let generatedDeviceId: string | null = null;
  try {
    if (!localStorage.getItem('godlykids_device_id')) {
      generatedDeviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('godlykids_device_id', generatedDeviceId);
      console.log('🔑 Generated device ID on boot:', generatedDeviceId);
    }
  } catch {}
  
  // Register device with backend immediately on app open
  // This ensures we track all app opens for accurate install counts
  const registerDevice = async () => {
    try {
      const deviceId = localStorage.getItem('godlykids_device_id');
      if (!deviceId) return;
      
      // Detect platform
      const ua = navigator.userAgent.toLowerCase();
      let platform = 'web';
      if (/despia/i.test(ua)) {
        platform = ua.includes('iphone') || ua.includes('ipad') ? 'ios' : 'android';
      } else if (/iphone|ipad|ipod/i.test(ua)) {
        platform = 'ios';
      } else if (/android/i.test(ua)) {
        platform = 'android';
      }
      
      const apiBase = window.location.hostname === 'localhost' 
        ? 'http://localhost:5001' 
        : 'https://backendgk2-0.onrender.com';
      
      const response = await fetch(`${apiBase}/api/app-user/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, platform }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📱 Device registered:', data.isNewUser ? 'NEW USER' : 'returning user');
      }
    } catch (err) {
      console.warn('📱 Device registration failed:', err);
    }
  };
  
  // Register device after a short delay (don't block app startup)
  setTimeout(registerDevice, 1000);

  // Detect Despia early - we need this for crash detection logic
  const ua = navigator.userAgent || '';
  const isDespia = /despia/i.test(ua);
  (window as any).__GK_IS_DESPIA__ = isDespia;

  // Feature trace ring buffer: records high-level steps that ran leading up to a crash.
  // Stored in localStorage so opaque iOS "Script error." crashes still include context.
  try {
    const TRACE_KEY = 'gk_feature_trace';
    const trace = (event: string, data?: any) => {
      try {
        const entry = {
          event,
          data: data ?? null,
          url: window.location.href,
          vis: document.visibilityState,
          ts: new Date().toISOString(),
        };
        const existing = JSON.parse(localStorage.getItem(TRACE_KEY) || '[]');
        existing.push(entry);
        localStorage.setItem(TRACE_KEY, JSON.stringify(existing.slice(-60)));
      } catch {}
    };

    (window as any).__GK_TRACE__ = trace;
    trace('app_boot');
    document.addEventListener('visibilitychange', () => {
      trace('visibility_change', { visibility: document.visibilityState });
      // Track when app goes to background for Despia WebView recreation detection
      if (document.visibilityState === 'hidden') {
        try {
          localStorage.setItem('gk_last_hidden_ts', String(Date.now()));
        } catch {}
      }
    });
    
    // DESPIA FIX: Add focusin/focusout handlers for proper state reconstruction
    // These have full WebKit WebView support and help prevent race conditions with React Router
    // when the app returns from background in Despia
    if (isDespia) {
      let focusDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      let lastFocusState: 'in' | 'out' | null = null;
      
      // Track focus state to detect when app is regaining focus
      (window as any).__GK_FOCUS_STATE__ = 'unknown';
      
      document.addEventListener('focusin', (e) => {
        // Debounce rapid focusin events
        if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
        
        focusDebounceTimer = setTimeout(() => {
          if (lastFocusState === 'out') {
            // App is regaining focus after being unfocused
            console.log('📱 Despia focusin: App regained focus');
            trace('despia_focusin', { target: (e.target as HTMLElement)?.tagName || 'unknown' });
            (window as any).__GK_FOCUS_STATE__ = 'in';
            
            // Signal to React components that they should reconstruct state
            // This helps prevent race conditions with React Router
            (window as any).__GK_FOCUS_RESTORED_AT__ = Date.now();
            
            // Dispatch a custom event that components can listen for
            try {
              window.dispatchEvent(new CustomEvent('gk:focusrestored', { 
                detail: { timestamp: Date.now() } 
              }));
            } catch {}
          }
          lastFocusState = 'in';
        }, 50); // Small debounce to prevent rapid firing
      });
      
      document.addEventListener('focusout', (e) => {
        // Only track if focus is truly leaving the document
        // (not just moving between elements)
        if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
        
        focusDebounceTimer = setTimeout(() => {
          // Check if focus is still within the document
          if (!document.hasFocus()) {
            console.log('📱 Despia focusout: App lost focus');
            trace('despia_focusout', { target: (e.target as HTMLElement)?.tagName || 'unknown' });
            (window as any).__GK_FOCUS_STATE__ = 'out';
            lastFocusState = 'out';
            
            // Store the current route so we can restore it properly
            // Skip game routes - they have query params that won't survive force quit
            try {
              const currentHash = window.location.hash || '#/world';
              if (!currentHash.includes('/game')) {
                localStorage.setItem('gk_last_route', currentHash);
              }
            } catch {}
          }
        }, 100); // Longer debounce for focusout to ensure it's a real app blur
      });
      
      // Also handle window blur/focus as backup
      window.addEventListener('blur', () => {
        trace('despia_window_blur');
        (window as any).__GK_FOCUS_STATE__ = 'out';
        lastFocusState = 'out';
      });
      
      window.addEventListener('focus', () => {
        trace('despia_window_focus');
        if (lastFocusState === 'out') {
          (window as any).__GK_FOCUS_STATE__ = 'in';
          (window as any).__GK_FOCUS_RESTORED_AT__ = Date.now();
          try {
            window.dispatchEvent(new CustomEvent('gk:focusrestored', { 
              detail: { timestamp: Date.now() } 
            }));
          } catch {}
        }
        lastFocusState = 'in';
      });
    }
  } catch {}

  // Crash recovery: detect if we crashed recently and are in a crash loop
  // BUT: In Despia, WebView recreations after soft-close are EXPECTED, not crashes
  try {
    const CRASH_KEY = 'gk_crash_timestamps';
    const CRASH_WINDOW_MS = 30000; // 30 seconds
    const MAX_CRASHES = 3;
    const DESPIA_REBOOT_GRACE_MS = 5000; // Despia WebView recreations within 5s of hidden are expected
    
    const now = Date.now();
    let crashes: number[] = [];
    try {
      crashes = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]');
    } catch {}
    
    // In Despia, check if this is a WebView recreation (not a crash)
    // If app_boot happens shortly after visibility_hidden, it's a Despia soft-close/reopen
    let isExpectedDespiaReboot = false;
    if (isDespia) {
      try {
        const lastHiddenTs = parseInt(localStorage.getItem('gk_last_hidden_ts') || '0', 10);
        const timeSinceHidden = now - lastHiddenTs;
        // If we rebooted within 5 seconds of going hidden, this is expected Despia behavior
        // Despia recreates the WebView on soft-close/reopen, this is NOT a crash
        if (lastHiddenTs > 0 && timeSinceHidden < DESPIA_REBOOT_GRACE_MS) {
          isExpectedDespiaReboot = true;
          console.log('📱 Despia WebView recreation detected (normal soft-close/reopen)');
          try { (window as any).__GK_TRACE__?.('despia_reboot_expected', { timeSinceHidden }); } catch {}
        }
      } catch {}
    }
    
    // Clean old crash timestamps
    crashes = crashes.filter((t: number) => now - t < CRASH_WINDOW_MS);
    
    // Only enter recovery mode if these are REAL crashes, not Despia reboots
    // For Despia, we also require more crashes since some are false positives
    const effectiveMaxCrashes = isDespia ? MAX_CRASHES + 2 : MAX_CRASHES;
    if (crashes.length >= effectiveMaxCrashes && !isExpectedDespiaReboot) {
      console.warn('⚠️ CRASH RECOVERY MODE - too many recent crashes, clearing state');
      (window as any).__GK_RECOVERY_MODE__ = true;
      try { (window as any).__GK_TRACE__?.('crash_recovery_mode', { crashes: crashes.length }); } catch {}
      
      // Clear potentially problematic state
      localStorage.removeItem('godlykids_home_last_fetch');
      localStorage.removeItem('godlykids_lessons');
      localStorage.removeItem(CRASH_KEY);
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name).catch(() => {}));
        });
      }
    } else {
      // Record that we're starting (we'll remove this on successful render)
      (window as any).__GK_BOOT_TIMESTAMP__ = now;
      
      // In Despia, clear crash history on expected reboots to prevent false accumulation
      if (isExpectedDespiaReboot && crashes.length > 0) {
        console.log('🧹 Clearing crash history (expected Despia reboot)');
        localStorage.removeItem(CRASH_KEY);
      }
    }
  } catch {}

  // DeSpia tracing (URL normalization is now done in index.tsx BEFORE React mounts)
  // Note: isDespia is already detected and stored in __GK_IS_DESPIA__ above
  if (isDespia) {
    try { (window as any).__GK_TRACE__?.('despia_detected', { ua }); } catch {}
  }

  // Capture resource load failures (chunk/script/css) which often show as "Script error."
  try {
    window.addEventListener(
      'error',
      (event: any) => {
        const target = event?.target;
        const isResourceError =
          target &&
          (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG');
        if (!isResourceError) return;

        const details = {
          type: 'resource',
          tagName: target.tagName,
          src: target.src || target.href || '',
          url: window.location.href,
          userAgent: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          devicePixelRatio: window.devicePixelRatio,
          visibility: document.visibilityState,
          ts: new Date().toISOString(),
        };
        console.error('💥 RESOURCE LOAD ERROR:', details);
        try {
          const existing = JSON.parse(localStorage.getItem('gk_last_errors') || '[]');
          existing.push(details);
          localStorage.setItem('gk_last_errors', JSON.stringify(existing.slice(-5)));
        } catch {}
      },
      true
    );
  } catch {}

  // On iOS standalone/custom app shells, proactively unregister ALL service workers 
  // and clear caches to avoid stale-cache chunk failures and "Script error." crashes.
  try {
    const ua = navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      ((navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as any).standalone === true;
    const isCustomAppUA = /despia/i.test(ua);

    // In DeSpia wrapper, be VERY aggressive about cleanup
    if (isCustomAppUA && 'serviceWorker' in navigator) {
      // Unregister ALL service workers (not just OneSignal)
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs?.forEach((reg) => {
          console.log('🧹 Unregistering service worker:', reg.scope);
          reg.unregister().catch(() => {});
        });
      });
      
      // Clear ALL caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            console.log('🧹 Clearing cache:', name);
            caches.delete(name).catch(() => {});
          });
        });
      }
      
      // Clear OneSignal localStorage keys
      try {
        const keysToRemove = Object.keys(localStorage).filter(k => 
          /onesignal|idcc/i.test(k)
        );
        keysToRemove.forEach(k => {
          console.log('🧹 Removing localStorage key:', k);
          localStorage.removeItem(k);
        });
      } catch {}
    } else if ((isIOS && isStandalone) && 'serviceWorker' in navigator) {
      // For non-DeSpia iOS standalone, just unregister OneSignal SWs
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs?.forEach((reg) => {
          const scriptURL = (reg as any)?.active?.scriptURL || '';
          if (scriptURL.includes('OneSignal') || scriptURL.includes('onesignal')) {
            reg.unregister().catch(() => {});
          }
        });
      });
    }
  } catch {}
  
  // GLOBAL ERROR HANDLERS - catch ALL JS errors, not just React ones
  // Re-entrancy guard to prevent infinite loops when error handler itself causes errors
  let isHandlingError = false;
  
  window.onerror = (message, source, lineno, colno, error) => {
    // Prevent re-entrancy - if we're already handling an error, don't recurse
    if (isHandlingError) {
      console.warn('⚠️ Prevented recursive error handler');
      return true;
    }
    isHandlingError = true;
    // Opaque "Script error." with no details (lineno=0, colno=0) are cross-origin errors
    // that provide NO useful debugging information
    const isOpaqueScriptError = 
      String(message || '').toLowerCase().includes('script error') && 
      (lineno === 0 || !lineno) && 
      (colno === 0 || !colno) && 
      (!error?.stack || error.stack === '');
    
    const isDespia = (window as any).__GK_IS_DESPIA__;
    
    // Check if this is happening during a Despia WebView recreation (for logging)
    let isDespiaTransition = false;
    if (isDespia) {
      try {
        const bootTimestamp = (window as any).__GK_BOOT_TIMESTAMP__ || 0;
        const timeSinceBoot = Date.now() - bootTimestamp;
        // If error happens within 5 seconds of boot, it's likely a transition error
        isDespiaTransition = timeSinceBoot < 5000;
      } catch {}
    }
    
    // In Despia, ALWAYS suppress opaque script errors - they're cross-origin CDN errors
    // that provide no useful information and would just confuse users
    // These come from: aistudiocdn.com, analytics scripts, etc.
    if (isDespia && isOpaqueScriptError) {
      console.log('📱 Ignoring opaque script error in Despia (cross-origin)', isDespiaTransition ? '(during transition)' : '(post-transition)');
      try { 
        (window as any).__GK_TRACE__?.('despia_opaque_error_ignored', { 
          message: String(message || ''),
          isDespiaTransition 
        }); 
      } catch {}
      return true; // Suppress the error - don't show overlay or count as crash
    }
    
    let featureTrace: any[] = [];
    try {
      featureTrace = JSON.parse(localStorage.getItem('gk_feature_trace') || '[]');
      // Limit featureTrace to prevent huge error payloads
      if (featureTrace.length > 20) {
        featureTrace = featureTrace.slice(-20);
      }
    } catch {}
    
    // Safe JSON.stringify that handles circular references
    const safeStringify = (obj: any, maxDepth = 5): string => {
      const seen = new WeakSet();
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
    };

    const details = {
      name: error?.name || 'Error',
      message: String(message || ''),
      source: String(source || ''),
      lineno: Number(lineno || 0),
      colno: Number(colno || 0),
      stack: String(error?.stack || ''),
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      visibility: document.visibilityState,
      isDespiaTransition,
      isOpaqueScriptError,
      featureTrace,
      ts: new Date().toISOString(),
    };
    console.error('💥 GLOBAL ERROR:', details);
    try {
      (window as any).__GK_LAST_ERROR_DETAILS__ = details;
      // Also store the safe stringify function globally for the copy button
      (window as any).__GK_SAFE_STRINGIFY__ = safeStringify;
    } catch {}

    // Record crash timestamp for crash loop detection
    // BUT: Don't count opaque errors in Despia as real crashes
    if (!(isDespia && isOpaqueScriptError)) {
      try {
        const CRASH_KEY = 'gk_crash_timestamps';
        let crashes: number[] = [];
        try { crashes = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]'); } catch {}
        crashes.push(Date.now());
        // Keep only last 10 crash timestamps
        localStorage.setItem(CRASH_KEY, JSON.stringify(crashes.slice(-10)));
      } catch {}
    }

    // Persist last errors so we can inspect on-device
    try {
      const existing = JSON.parse(localStorage.getItem('gk_last_errors') || '[]');
      existing.push(details);
      localStorage.setItem('gk_last_errors', safeStringify(existing.slice(-5)));
    } catch {}

    // Prevent white screen - show overlay so user knows what happened
    try {
      const escapeHtml = (s: any) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const errorDiv = document.createElement('div');
      errorDiv.id = 'gk_global_error_overlay';
      errorDiv.innerHTML = `
        <div style="position:fixed;inset:0;background:#1a3a52;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;padding:20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🌊</div>
          <h1 style="color:white;font-size:20px;font-weight:bold;margin-bottom:8px;">Oops! Something went wrong</h1>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:12px;max-width:340px;">Tap “Copy details” and paste it into chat (or tap “Show details”).</p>

          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;">
            <button onclick="(function(){try{var fn=window.__GK_SAFE_STRINGIFY__||JSON.stringify; var t=fn(window.__GK_LAST_ERROR_DETAILS__||{}); var done=false; try{navigator.clipboard&&navigator.clipboard.writeText&&navigator.clipboard.writeText(t).then(function(){done=true; alert('Copied! Paste it into chat.');}).catch(function(){});}catch(e){} try{if(done) return; var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); var ok=false; try{ok=document.execCommand('copy');}catch(e){} document.body.removeChild(ta); if(ok){alert('Copied! Paste it into chat.'); return;} }catch(e){} try{prompt('Copy the crash details below:', t);}catch(e){} }catch(e){}})()"
              style="background:rgba(255,255,255,0.25);color:white;font-weight:bold;padding:10px 18px;border-radius:9999px;border:none;">
              Copy details
            </button>
            <button onclick="var el=document.getElementById('gk_err'); if(el) el.style.display='block';"
              style="background:rgba(255,255,255,0.15);color:white;font-weight:bold;padding:10px 18px;border-radius:9999px;border:none;">
              Show details
            </button>
          </div>

          <pre id="gk_err" style="display:none;white-space:pre-wrap;text-align:left;max-width:380px;max-height:240px;overflow:auto;background:rgba(0,0,0,0.35);color:rgba(255,255,255,0.85);padding:12px;border-radius:12px;font-size:12px;">${escapeHtml(safeStringify(details))}</pre>

          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;justify-content:center;">
            <button onclick="try{localStorage.removeItem('gk_api_lessons');}catch(e){}; try{sessionStorage.clear();}catch(e){}; location.reload();"
              style="background:rgba(255,255,255,0.2);color:white;font-weight:bold;padding:12px 18px;border-radius:9999px;border:none;">
              Clear cache & reload
            </button>
            <button onclick="location.reload()" style="background:linear-gradient(to right,#FFD700,#FFA500);color:#3E1F07;font-weight:bold;padding:12px 24px;border-radius:9999px;border:none;">Refresh</button>
          </div>
        </div>
      `;
      document.body.appendChild(errorDiv);
    } catch {}
    
    // Reset re-entrancy guard
    setTimeout(() => { isHandlingError = false; }, 100);
    return true; // Prevent default error handling
  };
  
  window.onunhandledrejection = (event) => {
    const reason = (event as any)?.reason;
    const details = {
      type: 'unhandledrejection',
      message: String(reason?.message || reason || ''),
      stack: String(reason?.stack || ''),
      url: window.location.href,
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      visibility: document.visibilityState,
      ts: new Date().toISOString(),
    };
    console.error('💥 UNHANDLED PROMISE REJECTION:', details);
    try {
      const existing = JSON.parse(localStorage.getItem('gk_last_errors') || '[]');
      existing.push(details);
      localStorage.setItem('gk_last_errors', JSON.stringify(existing.slice(-5)));
    } catch {}
  };
} else {
  console.log('♻️ APP module re-evaluated but already booted');
}
import ListenPage from './pages/ListenPage';
import ReadPage from './pages/ReadPage';
import LibraryPage from './pages/LibraryPage';
import BookCreatingPage from './pages/BookCreatingPage';
import CreateYourStoryPage from './pages/CreateYourStoryPage';
import BookDetailPage from './pages/BookDetailPage';
import ProfileSelectionPage from './pages/ProfileSelectionPage';
import CreateProfilePage from './pages/CreateProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import AudioPlayerPage from './pages/AudioPlayerPage';
import PaywallPage from './pages/PaywallPage';
import PremiumOnboardingPage from './pages/PremiumOnboardingPage';
import TrialStatsPage from './pages/TrialStatsPage';
import SettingsPage from './pages/SettingsPage';
import BookReaderPage from './pages/BookReaderPage';
import AudioPage from './pages/AudioPage';
import PlaylistPlayerPage from './pages/PlaylistPlayerPage';
import PlaylistDetailPage from './pages/PlaylistDetailPage';
import UserPlaylistPage from './pages/UserPlaylistPage';
import CreatePlaylistPage from './pages/CreatePlaylistPage';
import BookSeriesDetailPage from './pages/BookSeriesDetailPage';
import LessonsPage from './pages/LessonsPage';
import LessonPlayerPage from './pages/LessonPlayerPage';
import VideoLessonDemo from './pages/VideoLessonDemo';
import GameWebViewPage from './pages/GameWebViewPage';
import NewUserWelcomePage, { shouldShowWelcome } from './pages/NewUserWelcomePage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import SharePlaylistPage from './pages/SharePlaylistPage';
import ShareBookPage from './pages/ShareBookPage';
import ParentQuizPage from './pages/ParentQuizPage';
import GamesPage from './pages/GamesPage';
import InterestSelectionPage from './pages/InterestSelectionPage';
import DailySessionPage from './pages/DailySessionPage';

// Check if user has an account (auth token or email stored)
const hasUserAccount = (): boolean => {
  const token = localStorage.getItem('godlykids_auth_token');
  const email = localStorage.getItem('godlykids_user_email');
  return !!(token || email);
};

// Check if user is authenticated (has completed onboarding or has user data)
const isUserAuthenticated = (): boolean => {
  // Check for auth token first
  const token = localStorage.getItem('godlykids_auth_token');
  if (token) return true;
  
  // Check for user data from onboarding
  const savedData = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
  if (!savedData) return false;
  
  try {
    const data = JSON.parse(savedData);
    // User has completed onboarding if they have a parent name or kids
    return (data.parentName && data.parentName !== 'Parent' && data.parentName !== '') || 
           (data.kids && data.kids.length > 0);
  } catch { return false; }
};

// Tutorial steps that are valid for specific routes
const TUTORIAL_VALID_ROUTES: Record<string, string[]> = {
  '/welcome': ['welcome_book_tap'],
  '/read': ['book_controls_intro', 'book_swipe_intro', 'book_swipe_1', 'book_swipe_2', 'book_swipe_3', 'book_end_quiz', 'quiz_in_progress'],
  '/home': ['coins_highlight', 'coins_popup_open', 'report_card_highlight', 'report_card_open', 'shop_highlight', 'shop_open', 'navigate_to_games', 'navigate_to_explore', 'devotional_highlight', 'navigate_to_books', 'navigate_to_audio', 'tutorial_complete', 'explore_pause', 'paywall'],
  '/world': ['coins_highlight', 'coins_popup_open', 'report_card_highlight', 'report_card_open', 'shop_highlight', 'shop_open', 'navigate_to_games', 'navigate_to_explore', 'devotional_highlight', 'navigate_to_books', 'navigate_to_audio', 'tutorial_complete', 'explore_pause', 'paywall'],
  '/games': ['navigate_to_games'],
  '/listen': ['navigate_to_audio', 'audiobook_highlight', 'review_prompt'],
  '/read-page': ['navigate_to_books'], // /read page (book list)
};

// Check if tutorial is currently active AND valid for the given route
const isTutorialInProgressForRoute = (currentPath: string): boolean => {
  const tutorialStep = localStorage.getItem('godlykids_tutorial_step');
  const tutorialComplete = localStorage.getItem('godlykids_tutorial_complete');
  
  // Tutorial not in progress if complete or no step
  if (!tutorialStep || tutorialComplete === 'true') return false;
  
  // Check if current step is valid for the current route
  // /read/:bookId -> check /read
  // /home -> check /home
  const pathBase = currentPath.split('/').slice(0, 2).join('/') || currentPath;
  
  // Special case: /read page (book list) vs /read/:bookId (reader)
  const isBookReader = /^\/read\/[^/]+/.test(currentPath);
  const routeKey = isBookReader ? '/read' : (pathBase === '/read' ? '/read-page' : pathBase);
  
  const validSteps = TUTORIAL_VALID_ROUTES[routeKey];
  if (!validSteps) {
    // Route not in tutorial flow - tutorial doesn't apply here
    return false;
  }
  
  return validSteps.includes(tutorialStep);
};

// Legacy check for backward compatibility (used in some places)
const isTutorialInProgress = (): boolean => {
  const tutorialStep = localStorage.getItem('godlykids_tutorial_step');
  const tutorialComplete = localStorage.getItem('godlykids_tutorial_complete');
  return !!(tutorialStep && tutorialComplete !== 'true');
};

// Check if user has completed onboarding (has parent name or kids set up)
const hasCompletedOnboarding = (): boolean => {
  const savedData = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
  if (!savedData) return false;
  try {
    const data = JSON.parse(savedData);
    return (data.parentName && data.parentName !== 'Parent' && data.parentName !== '') || 
           (data.kids && data.kids.length > 0);
  } catch { return false; }
};

// Guest-friendly route wrapper - allows guests to consume content without account
// Tracks their activity so we can prompt them to save progress later
const GuestFriendlyRoute: React.FC<{ children: React.ReactNode; contentType?: 'book' | 'audio' }> = ({ children, contentType }) => {
  const hasAccount = hasUserAccount();
  
  // Track guest content consumption when they access this route
  useEffect(() => {
    if (!hasAccount && contentType) {
      // Small delay to ensure they're actually consuming content, not just browsing
      const timer = setTimeout(() => {
        trackGuestContent(contentType);
      }, 5000); // Track after 5 seconds of being on the page
      return () => clearTimeout(timer);
    }
  }, [hasAccount, contentType]);
  
  // Always allow access - guests can consume content!
  return <>{children}</>;
};

// Protected route wrapper - requires account AND completed onboarding for content access
// Exceptions: 
// 1. Allows full access during active tutorial
// 2. Allows first daily session without account (first-time user experience)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasAccount, setHasAccount] = useState(() => hasUserAccount());
  const navigate = useNavigate();
  const location = useLocation();
  
  // Allow FULL access during ANY active tutorial (don't interrupt tutorial flow)
  const tutorialActive = isTutorialInProgress();
  if (tutorialActive) {
    return <>{children}</>;
  }
  
  // Allow access during first daily session (user hasn't completed any session yet)
  // Check if coming from daily session flow
  const fromDailySession = (location.state as any)?.fromDailySession === true;
  if (fromDailySession) {
    // Import dynamically to avoid circular dependency
    const sessionHistoryKey = 'godlykids_session_history';
    const hasCompletedPreviousSession = (() => {
      try {
        const history = localStorage.getItem(sessionHistoryKey);
        if (!history) return false;
        const sessions = JSON.parse(history);
        return sessions.some((s: any) => s.completed);
      } catch { return false; }
    })();
    
    // If this is user's first session (no completed sessions), allow access without account
    if (!hasCompletedPreviousSession) {
      return <>{children}</>;
    }
  }
  
  // Check if user has completed onboarding
  const onboardingComplete = hasCompletedOnboarding();
  
  // If user has account AND completed onboarding, allow access
  if (hasAccount && onboardingComplete) {
    return <>{children}</>;
  }
  
  // If user has account but NOT completed onboarding, redirect to onboarding
  if (hasAccount && !onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  
  // No account - show account creation modal
  return (
    <CreateAccountModal
      isOpen={true}
      navigateToOnboarding={true} // After account creation, go to onboarding
      onClose={() => {
        // Go back to previous page
        window.history.back();
      }}
      onAccountCreated={() => {
        setHasAccount(true);
        // Will redirect to onboarding via navigateToOnboarding={true}
      }}
      onSignIn={() => {
        navigate('/signin', { state: { returnTo: window.location.hash.replace('#', '') || '/world' } });
      }}
    />
  );
};

// Explore page wrapper - shows welcome screen for new users, save progress prompt for guests
// Renders WorldPage (island buttons) as the main explore view
const WorldPageWithWelcomeCheck: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSaveProgressModal, setShowSaveProgressModal] = useState(false);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const [hasAccount, setHasAccount] = useState(() => hasUserAccount());
  const [guestStats, setGuestStats] = useState(() => getGuestContentStats());
  const [checkTrigger, setCheckTrigger] = useState(0); // Used to re-trigger checks
  
  // Check if user completed onboarding
  const savedData = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
  const userCompletedOnboarding = (() => {
    if (!savedData) return false;
    try {
      const data = JSON.parse(savedData);
      return (data.parentName && data.parentName !== 'Parent' && data.parentName !== '') || 
             (data.kids && data.kids.length > 0);
    } catch { return false; }
  })();
  
  // Check if tutorial is still in progress
  const tutorialActive = isTutorialInProgress();
  
  // Listen for guest content consumption events to re-check when user returns
  useEffect(() => {
    const handleContentConsumed = () => {
      console.log('📚 Guest consumed content, will check for prompt on next visit');
    };
    
    window.addEventListener('guestContentConsumed', handleContentConsumed);
    return () => window.removeEventListener('guestContentConsumed', handleContentConsumed);
  }, []);
  
  // Re-check for save progress modal whenever user navigates to this page
  useEffect(() => {
    // Trigger a check when location changes (user navigates here)
    setCheckTrigger(prev => prev + 1);
  }, [location.key]);
  
  // Check for expired reverse trial on mount
  useEffect(() => {
    const checkReverseTrial = async () => {
      const hadReverseTrial = localStorage.getItem('godlykids_reverse_trial') === 'true';
      const isPremium = localStorage.getItem('godlykids_premium') === 'true';
      
      // Only check if they had a reverse trial
      if (!hadReverseTrial) return;
      
      // Check trial status from backend
      try {
        const deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
        if (!deviceId) return;
        
        const apiBaseUrl = localStorage.getItem('godlykids_api_url') || 
          (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
        
        const response = await fetch(`${apiBaseUrl}/api/app-user/reverse-trial-status/${encodeURIComponent(deviceId)}`);
        if (response.ok) {
          const data = await response.json();
          
          // If trial has expired (had trial but no longer active), show modal
          if (data.hasReverseTrial && !data.isActive && !data.converted) {
            // Check if we already showed this modal in this session
            const shownKey = 'godlykids_trial_expired_shown';
            if (!sessionStorage.getItem(shownKey)) {
              sessionStorage.setItem(shownKey, 'true');
              localStorage.removeItem('godlykids_reverse_trial');
              localStorage.removeItem('godlykids_premium');
              setShowTrialExpiredModal(true);
            }
          }
        }
      } catch (error) {
        console.log('Error checking reverse trial:', error);
      }
    };
    
    checkReverseTrial();
  }, []);
  
  // Show save progress modal for guests who have consumed content
  // This triggers on mount AND whenever user navigates back to explore page
  useEffect(() => {
    // Re-read hasAccount in case it changed
    const currentHasAccount = hasUserAccount();
    const currentTutorialActive = isTutorialInProgress();
    
    // Only show if: no account, not in tutorial, has consumed content, hasn't been shown this session
    if (!currentHasAccount && !currentTutorialActive && hasGuestConsumedContent() && !hasGuestPromptBeenShown()) {
      console.log('📚 Guest has consumed content, showing save progress modal');
      // Small delay to let page render first
      const timer = setTimeout(() => {
        setGuestStats(getGuestContentStats());
        setShowSaveProgressModal(true);
        markGuestPromptShown();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [checkTrigger]); // Re-run when checkTrigger changes (on navigation)
  
  // NOTE: We intentionally do NOT show CreateAccountModal immediately for new users!
  // The flow is: explore → try content → SaveProgressModal prompts to create account
  // This gives users a chance to experience the app before asking them to sign up
  
  // Only show welcome screen if user completed onboarding AND hasn't seen welcome yet
  if (userCompletedOnboarding && shouldShowWelcome()) {
    return <NewUserWelcomePage />;
  }
  
  return (
    <>
      <WorldPage />
      {showSaveProgressModal && (
        <SaveProgressModal
          isOpen={true}
          consumedContent={guestStats}
          onClose={() => {
            setShowSaveProgressModal(false);
          }}
          onCreateAccount={() => {
            setShowSaveProgressModal(false);
            navigate('/onboarding');
          }}
          onSignIn={() => {
            setShowSaveProgressModal(false);
            navigate('/signin', { state: { returnTo: '/world' } });
          }}
        />
      )}
      {/* CreateAccountModal is NOT shown automatically for new users */}
      {/* Users explore freely → try content → SaveProgressModal prompts them */}
      {showTrialExpiredModal && (
        <ReverseTrialExpiredModal
          isOpen={true}
          onClose={() => setShowTrialExpiredModal(false)}
        />
      )}
    </>
  );
};

import MiniPlayer from './components/audio/MiniPlayer';
import BottomNavigation from './components/layout/BottomNavigation';
import ErrorBoundary from './components/ErrorBoundary';
import { BooksProvider } from './context/BooksContext';
import { UserProvider } from './context/UserContext';
import { AudioProvider } from './context/AudioContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { LanguageProvider } from './context/LanguageContext';
import NotificationService from './services/notificationService';
import { activityTrackingService } from './services/activityTrackingService';
import { DespiaService } from './services/despiaService';
import { authService } from './services/authService';
import { metaAttributionService } from './services/metaAttributionService';
import DemoTimer from './components/features/DemoTimer';
import ReadyToJumpInPage from './pages/ReadyToJumpInPage';
import OnboardingTutorial from './components/features/OnboardingTutorial';
import LayoutRatingModal, { shouldShowLayoutRating } from './components/features/LayoutRatingModal';
import { TutorialProvider, useTutorial } from './context/TutorialContext';

// --- ASSETS & HELPERS ---

// 1. The 4-Point "Diamond" Star - Optimized (No filters)
const StarSVG: React.FC<{ className?: string; size?: number; color?: string; opacity?: number }> = ({ className, size = 24, color = "#FFD700", opacity = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ overflow: 'visible', opacity }}
  >
    {/* Core Diamond Shape - No drop shadow filter for mobile perf */}
    <path
      d="M12 0 C12 0 15 9 24 12 C15 15 12 24 12 24 C12 24 9 15 0 12 C9 9 12 0 12 0 Z"
      fill={color}
    />
    {/* Center Glow - Opacity instead of blur */}
    <circle cx="12" cy="12" r="3" fill="white" opacity="0.6" />
  </svg>
);

// 2. Stylized "Toy Story" Cloud - Optimized
const CloudSVG: React.FC<{ width: number; opacity?: number; flip?: boolean }> = ({ width, opacity = 0.9, flip = false }) => (
  <svg
    width={width}
    viewBox="0 0 200 120"
    fill="none"
    style={{ opacity, transform: flip ? 'scaleX(-1)' : 'none' }}
  >
    {/* Soft Bottom Shadow - Opacity instead of blur */}
    <path d="M20,85 Q40,115 90,105 Q140,120 180,85" stroke="rgba(20, 50, 100, 0.2)" strokeWidth="12" strokeLinecap="round" opacity="0.5" />

    {/* Main Cloud Shape - Union of circles with gradients */}
    <g>
      <circle cx="50" cy="75" r="35" fill="url(#cloudBody)" />
      <circle cx="90" cy="55" r="50" fill="url(#cloudBody)" />
      <circle cx="145" cy="75" r="40" fill="url(#cloudBody)" />
      <rect x="50" y="65" width="95" height="40" fill="url(#cloudBody)" />
    </g>

    {/* Rim Highlight (Top) */}
    <path d="M25,60 Q50,20 90,10 Q140,20 175,60" fill="none" stroke="white" strokeWidth="3" opacity="0.6" strokeLinecap="round" />

    <defs>
      <linearGradient id="cloudBody" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#eef2ff" />
        <stop offset="100%" stopColor="#bfdbfe" />
      </linearGradient>
    </defs>
  </svg>
);

const PRELOAD_IMAGES = [
  '/assets/images/daily-adventure-island.webp',
  '/assets/images/volcano-island.webp',
  '/assets/images/wooden-raft.webp',
  '/assets/images/island-button.webp',
  '/assets/images/headphone-island.webp',
  '/assets/images/music-island.webp',
  '/assets/images/music-note-orange.webp',
  '/assets/images/music-note-purple.webp',
  '/assets/images/music-note-yellow.webp',
  '/assets/images/audio-adventure-button.webp',
  '/assets/images/scholar-island.webp',
  '/assets/images/scholar-island-button.webp',
  '/assets/images/whirlpool.webp',
  '/assets/images/book-island.webp',
  '/assets/images/bible-raft.webp',
];

const AssetPreloader: React.FC = () => {
  useEffect(() => {
    PRELOAD_IMAGES.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);
  return null;
};

// The Panorama Background Component
const PanoramaBackground: React.FC = () => {
  const location = useLocation();
  const { equippedBackground } = useUser();

  // active index logic remains same
  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path === '/signin') return 0;
    if (path === '/onboarding') return 0;
    if (path === '/home' || path === '/world') return 1;
    if (path === '/listen') return 2;
    if (path === '/read') return 3;
    if (path === '/library') return 4;
    if (path === '/games') return 5;
    if (path === '/audio' || path.startsWith('/audio/')) return 2; // Use same as listen
    if (path === '/lessons' || path.startsWith('/lesson/')) return 1; // Use same as home/explore
    if (path.startsWith('/book/')) return 5;
    if (path === '/profile') return 5;
    if (path === '/create-profile') return 5;
    if (path.startsWith('/player/')) return 5;
    if (path === '/paywall') return 5;
    if (path === '/settings') return 5;
    return 1;
  }, [location.pathname]);

  return (
    <div 
      className="z-0 pointer-events-none overflow-hidden bg-[#1a3a52]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* 
        The "World" Container - 600vw wide.
        Translates horizontally based on current page.
      */}
      <div
        className="absolute top-0 bottom-0 left-0 w-[600vw] h-full will-change-transform"
        style={{
          transform: `translateX(-${activeIndex * 100}vw)`,
          transition: 'transform 2.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        {/* ==============================================
             BACKGROUND IMAGE LAYER
             Customizable via shop - users can purchase different backgrounds
         ============================================== */}
        <div
          className="absolute inset-0 w-[600vw] h-full transition-opacity duration-500"
          style={{
            backgroundImage: `url(${equippedBackground})`,
            backgroundSize: 'auto 100%',
            backgroundPosition: 'left top',
            backgroundRepeat: 'repeat-x'
          }}
        >
        </div>

        {/* Optional: Overlay for depth/vignette if needed */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_60%,rgba(0,0,0,0.1)_100%)] pointer-events-none"></div>

      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  );
};

// Wrapper component to show referral prompt AFTER shop interaction
const ReferralPromptWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { referralCode } = useUser();
  const { isTutorialActive } = useTutorial();
  const [showReferralPrompt, setShowReferralPrompt] = useState(false);
  const [promptTrigger, setPromptTrigger] = useState<'first_open' | 'zero_coins' | 'manual'>('first_open');
  
  // Listen for shop close event to trigger referral prompt
  useEffect(() => {
    const handleShopClosed = () => {
      // Skip during tutorial - don't interrupt the flow
      if (isTutorialActive) return;
      
      // Only show if user hasn't seen the referral prompt yet
      const hasSeenReferralPrompt = localStorage.getItem('godlykids_seen_referral_prompt');
      if (!hasSeenReferralPrompt && referralCode) {
        // Small delay after shop closes
        setTimeout(() => {
          setPromptTrigger('first_open');
          setShowReferralPrompt(true);
          localStorage.setItem('godlykids_seen_referral_prompt', 'true');
        }, 500);
      }
    };
    
    // Listen for custom event dispatched when shop modal closes
    window.addEventListener('godlykids_shop_closed', handleShopClosed);
    return () => window.removeEventListener('godlykids_shop_closed', handleShopClosed);
  }, [referralCode, isTutorialActive]);
  
  return (
    <>
      {children}
      <ReferralPromptModal
        isOpen={showReferralPrompt}
        onClose={() => setShowReferralPrompt(false)}
        trigger={promptTrigger}
      />
    </>
  );
};

const MAIN_NAV_PAGES = ['/world', '/home', '/listen', '/read', '/games'];

const LIFETIME_OFFER_STAGE_KEY = 'godlykids_lifetime_offer_stage';
const LIFETIME_OFFER_SESSION_KEY = 'godlykids_lifetime_offer_session_checked';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLayoutRating, setShowLayoutRating] = useState(false);
  const [lifetimeOfferVariant, setLifetimeOfferVariant] = useState<'first' | 'final' | null>(null);
  const lifetimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathForOfferRef = useRef(location.pathname);

  // Show "How do you like the new layout?" pop-up on first visit to /world or /home
  useEffect(() => {
    const isNewLayoutPage = location.pathname === '/world' || location.pathname === '/home';
    if (!isNewLayoutPage || !shouldShowLayoutRating()) return;
    const timer = setTimeout(() => {
      setShowLayoutRating(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // --- Lifetime offer popup: first offer (30s after paywall close) ---
  useEffect(() => {
    const wasPrevPaywall = prevPathForOfferRef.current === '/paywall';
    prevPathForOfferRef.current = location.pathname;

    const isPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (isPremium) return;

    const stage = localStorage.getItem(LIFETIME_OFFER_STAGE_KEY);
    if (wasPrevPaywall && location.pathname !== '/paywall' && stage === 'ready') {
      if (lifetimeTimerRef.current) clearTimeout(lifetimeTimerRef.current);
      lifetimeTimerRef.current = setTimeout(() => {
        if (localStorage.getItem('godlykids_premium') === 'true') return;
        if (localStorage.getItem(LIFETIME_OFFER_STAGE_KEY) !== 'ready') return;
        setLifetimeOfferVariant('first');
      }, 30000);
    }
    return () => {
      if (lifetimeTimerRef.current) clearTimeout(lifetimeTimerRef.current);
    };
  }, [location.pathname]);

  // --- Lifetime offer popup: final offer (on fresh app open) ---
  useEffect(() => {
    const isPremium = localStorage.getItem('godlykids_premium') === 'true';
    if (isPremium) return;
    if (sessionStorage.getItem(LIFETIME_OFFER_SESSION_KEY)) return;
    sessionStorage.setItem(LIFETIME_OFFER_SESSION_KEY, 'true');

    const stage = localStorage.getItem(LIFETIME_OFFER_STAGE_KEY);
    if (stage === 'shown_first') {
      const timer = setTimeout(() => {
        if (localStorage.getItem('godlykids_premium') === 'true') return;
        setLifetimeOfferVariant('final');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for Header timer tap to show the lifetime offer modal at root level
  useEffect(() => {
    const handler = () => setLifetimeOfferVariant('first');
    window.addEventListener('show_lifetime_offer', handler);
    return () => window.removeEventListener('show_lifetime_offer', handler);
  }, []);

  // Transition detection runs in useLayoutEffect so the new page starts hidden
  // before the browser paints — prevents the one-frame flash of incoming content.
  useLayoutEffect(() => {
    const wasMainPage = MAIN_NAV_PAGES.includes(prevPathRef.current);
    const isMainPage = MAIN_NAV_PAGES.includes(location.pathname);
    const pathChanged = prevPathRef.current !== location.pathname;
    prevPathRef.current = location.pathname;

    if (wasMainPage && isMainPage && pathChanged) {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      setIsTransitioning(true);
      fadeTimerRef.current = setTimeout(() => setIsTransitioning(false), 1000);
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [location.pathname]);

  useEffect(() => {
    try {
      (window as any).__GK_TRACE__?.('route_change', { path: location.pathname, hash: location.hash, search: location.search });
      activityTrackingService.trackPageVisit(location.pathname);
      if ((window as any).__GK_IS_DESPIA__ && location.pathname && location.pathname !== '/') {
        if (location.pathname.startsWith('/game')) {
          console.log('📱 Despia: Skipping route save for game page');
          localStorage.removeItem('gk_last_route');
        } else {
          const routeToSave = `#${location.pathname}${location.search || ''}`;
          localStorage.setItem('gk_last_route', routeToSave);
        }
      }
    } catch {}
  }, [location.pathname, location.hash, location.search]);
  
  // Check if running in Despia native runtime for safe area handling
  const isDespiaNative = (window as any).__GK_IS_DESPIA__ || false;
  const isLanding = location.pathname === '/';
  const isSignIn = location.pathname === '/signin';
  const isOnboarding = location.pathname === '/onboarding';
  const isBookDetail = location.pathname.startsWith('/book/');
  const isPlayer = location.pathname.startsWith('/player/');
  const isProfile = location.pathname === '/profile';
  const isCreateProfile = location.pathname === '/create-profile';
  const isEditProfile = location.pathname === '/edit-profile';
  const isPaywall = location.pathname === '/paywall';
  const isSettings = location.pathname === '/settings';
  const isBookReader = location.pathname.startsWith('/read/');
  const isAudioPage = location.pathname.startsWith('/audio/');
  const isLessonPage = location.pathname.startsWith('/lesson/');
  const isLessonsPage = location.pathname === '/lessons';
  const isGamePage = location.pathname === '/game';
  const isResetPassword = location.pathname === '/reset-password';
  const isBookSeries = location.pathname.startsWith('/book-series/');
  const isWelcome = location.pathname === '/welcome';
  const isReadyToJumpIn = location.pathname === '/ready';
  const isCreatePlaylist = location.pathname === '/create-playlist';
  const isMyPlaylist = location.pathname.startsWith('/my-playlist/');
  const isParentQuiz = location.pathname === '/parentquiz';
  const isSharePage = location.pathname.startsWith('/share/') || location.pathname.startsWith('/s/') || (location.pathname.startsWith('/playlist/') && !location.pathname.startsWith('/playlist-detail'));
  const isDailySession = location.pathname === '/daily-session';
  const isPremiumOnboarding = location.pathname === '/premium-onboarding';
  const isTrialStats = location.pathname === '/trial-stats';
  const isBookCreating = location.pathname.startsWith('/library/creating/');

  // Standalone pages that don't need the app chrome (background, navigation, etc.)
  const isStandalonePage = isParentQuiz || isSharePage || isReadyToJumpIn || isDailySession || isPremiumOnboarding || isTrialStats;

  // For standalone pages, render just the children without app styling
  if (isStandalonePage) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden text-white flex flex-col">

      <PanoramaBackground />
      <AssetPreloader />

      {/* Persistent island layer — always mounted, visibility toggled by route */}
      <div style={{ opacity: isTransitioning ? 0 : 1, transition: isTransitioning ? 'none' : 'opacity 0.4s ease-in-out' }}>
        <PersistentWorldIsland />
      </div>

      {/* Content Wrapper - safe area padding applied here so background is unaffected */}
      <div 
        className="relative z-10 flex-1 overflow-hidden"
        style={{
          paddingLeft: 'var(--safe-area-left, 0px)',
          paddingRight: 'var(--safe-area-right, 0px)',
          pointerEvents: (location.pathname === '/world' || location.pathname === '/home') ? 'none' : 'auto',
          opacity: isTransitioning ? 0 : 1,
          transition: isTransitioning ? 'none' : 'opacity 0.4s ease-in-out',
        }}
      >
        {children}
      </div>

      {/* Mini Player */}
      <MiniPlayer />

      {/* Only show BottomNavigation on main tab pages */}
      {(location.pathname === '/world' || location.pathname === '/home' || location.pathname === '/listen' || location.pathname === '/read' || location.pathname === '/games') && <BottomNavigation />}

      {/* Onboarding Tutorial Overlay */}
      <OnboardingTutorial />

      {/* Layout rating pop-up - "How do you like the new layout?" */}
      <LayoutRatingModal
        isOpen={showLayoutRating}
        onClose={() => setShowLayoutRating(false)}
        userId={localStorage.getItem('godlykids_user_email') || localStorage.getItem('godlykids_device_id') || 'anonymous'}
        email={localStorage.getItem('godlykids_user_email') || undefined}
        platform={/despia/i.test(navigator.userAgent) ? (/iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'android') : 'web'}
      />

      {/* Lifetime offer popup (shown after paywall dismissal) */}
      {lifetimeOfferVariant && (
        <LifetimeOfferModal
          variant={lifetimeOfferVariant}
          onClose={() => setLifetimeOfferVariant(null)}
        />
      )}
      
      {/* Bottom Safe Area Spacer - for pages without BottomNavigation */}
      {(isBookDetail || isPlayer || isProfile || isCreateProfile || isEditProfile || isPaywall || isSettings || isBookReader || isAudioPage || isLessonPage || isLessonsPage || isBookSeries || isCreatePlaylist || isMyPlaylist || isBookCreating) && (
        <div 
          className="w-full bg-transparent pointer-events-none" 
          style={{ height: 'var(--safe-area-bottom, 0px)' }}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  // Check if we're in DeSpia wrapper - if so, skip risky initializations
  const isDespia = DespiaService.isNative();

  // DESPIA FIX: Handle focus restoration to prevent race conditions with React Router
  // When the app regains focus after being in background, we need to ensure React
  // state is properly reconstructed before any routing or state updates happen
  useEffect(() => {
    if (!isDespia) return;
    
    const handleFocusRestored = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('📱 Despia: Focus restored, ensuring state consistency', detail);
      
      // Mark that we're in focus restoration mode - prevents other handlers
      // from causing issues during the transition
      (window as any).__GK_FOCUS_RESTORING__ = true;
      
      // Small delay to let React complete any pending updates
      setTimeout(() => {
        (window as any).__GK_FOCUS_RESTORING__ = false;
        
        // Verify the current route is valid
        try {
          const currentHash = window.location.hash;
          const lastRoute = localStorage.getItem('gk_last_route');
          
          // Check if user is authenticated before restoring to protected route
          const isAuthenticated = isUserAuthenticated();
          
          // If hash is empty or malformed, restore to last known good route
          if (!currentHash || currentHash === '#' || currentHash === '#/') {
            // If not authenticated, go to landing page
            if (!isAuthenticated) {
              console.log('📱 Despia: User not authenticated, going to landing page');
              window.location.hash = '#/';
            } else {
              const targetRoute = lastRoute || '#/world';
              console.log('📱 Despia: Restoring route to:', targetRoute);
              window.location.hash = targetRoute;
            }
          }
        } catch {}
        
        // Dispatch event to notify components focus restoration is complete
        try {
          window.dispatchEvent(new CustomEvent('gk:focusrestorecomplete'));
        } catch {}
      }, 100);
    };
    
    window.addEventListener('gk:focusrestored', handleFocusRestored);
    return () => window.removeEventListener('gk:focusrestored', handleFocusRestored);
  }, [isDespia]);

  // Link user ID to DeSpia native OneSignal SDK on app boot (if already logged in)
  // Use getUserIdForBackend() so it matches the id we send when creating a book (email/deviceId);
  // backend sends "your story is ready" to this same id so app users get the notification.
  useEffect(() => {
    if (!isDespia) return;
    
    const userId = authService.getUserIdForBackend();
    if (userId) {
      console.log('📱 Linking existing user to native OneSignal:', userId);
      DespiaService.setOneSignalUserId(userId);
    }
  }, [isDespia]);

  // Schedule daily 9am notification for Daily Verse (DeSpia only)
  useEffect(() => {
    if (!isDespia) return;
    
    // Small delay to let app initialize first
    const timer = setTimeout(() => {
      DespiaService.ensureDailyVerseNotificationScheduled();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isDespia]);

  // Initialize OneSignal notifications (skip in DeSpia)
  useEffect(() => {
    if (isDespia) {
      console.log('⏭️ Skipping NotificationService in DeSpia');
      try { (window as any).__GK_TRACE__?.('notifications_init_done', { reason: 'despia_skip' }); } catch {}
      return;
    }
    (async () => {
      try {
        try { (window as any).__GK_TRACE__?.('notifications_init_start'); } catch {}
        await NotificationService.init();
        const webUserId = authService.getUserIdForBackend();
        if (webUserId) await NotificationService.setExternalUserId(webUserId);
        try { (window as any).__GK_TRACE__?.('notifications_init_done'); } catch {}
      } catch (e) {
        try { (window as any).__GK_TRACE__?.('notifications_init_error', { message: (e as any)?.message || String(e) }); } catch {}
        console.error('❌ NotificationService.init crashed:', e);
      }
    })();
  }, [isDespia]);

  // Initialize activity tracking for Report Card
  // In DeSpia, we still track sessions and sync, just skip visibility handlers
  useEffect(() => {
    try { (window as any).__GK_TRACE__?.('activity_tracking_start', { isDespia }); } catch {}
    
    // Always increment session count (works in both web and Despia)
    activityTrackingService.incrementSessionCount();
    
    // Always start the backend sync (important for dashboard stats)
    activityTrackingService.startBackendSync();
    
    // Always start time tracking (needed for dashboard stats)
    // In Despia, we'll use a simplified version without visibility handlers
    activityTrackingService.startTimeTracking(isDespia);
    
    if (isDespia) {
      console.log('📱 Activity tracking (Despia mode - with simplified time tracking)');
    } else {
      console.log('📱 Activity tracking (Web mode - full time tracking)');
    }
    
    return () => {
      try { (window as any).__GK_TRACE__?.('activity_tracking_stop'); } catch {}
      activityTrackingService.stopTimeTracking();
      activityTrackingService.stopBackendSync();
    };
  }, [isDespia]);

  // Initialize Meta Attribution tracking for app install campaigns
  useEffect(() => {
    metaAttributionService.initialize();
  }, []);

  // iOS Audio Session Unlock - REMOVED
  // After investigation, iOS silent mode cannot be overridden from web code.
  // Audio playing when ringer is off requires native iOS configuration:
  // AVAudioSession.sharedInstance().setCategory(.playback)
  // This must be configured in the Despia native iOS project settings.

  return (
    <ErrorBoundary>
      <LanguageProvider>
      <AudioProvider>
        <UserProvider>
          <SubscriptionProvider>
            <TutorialProvider>
            <BooksProvider>
              <HashRouter>
              {/* <DemoTimer /> - Disabled for now */}
              <ReferralPromptWrapper>
              <Layout>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  {/* Parent Quiz Funnel - web-to-app conversion */}
                  <Route path="/parentquiz" element={<ParentQuizPage />} />
                  {/* Public shareable links - no authentication required */}
                  <Route path="/share/playlist/:playlistId" element={<SharePlaylistPage />} />
                  <Route path="/share/playlist/:playlistId/:trackIndex" element={<SharePlaylistPage />} /> {/* Share specific track */}
                  <Route path="/share/book/:bookId" element={<ShareBookPage />} />
                  <Route path="/s/p/:playlistId" element={<SharePlaylistPage />} /> {/* Short URL */}
                  <Route path="/s/p/:playlistId/:trackIndex" element={<SharePlaylistPage />} /> {/* Short URL with track */}
                  <Route path="/s/b/:bookId" element={<ShareBookPage />} /> {/* Short URL */}
                  <Route path="/playlist/:playlistId/:trackIndex" element={<SharePlaylistPage />} /> {/* Legacy share URL format */}
                  <Route path="/playlist/:playlistId" element={<SharePlaylistPage />} /> {/* Legacy share URL format */}
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/sign-in" element={<SignInPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/ready" element={<ReadyToJumpInPage />} />
                  <Route path="/welcome" element={<NewUserWelcomePage />} />
                  <Route path="/payment-success" element={<PaymentSuccessPage />} />
                  <Route path="/interests" element={<InterestSelectionPage />} />
                  <Route path="/daily-session" element={<DailySessionPage />} />
                  {/* BROWSING PAGES - No account required, users can explore freely */}
                  <Route path="/world" element={<WorldPageWithWelcomeCheck />} />
                  {/* /home redirects to /world so island buttons are the main explore view */}
                  <Route path="/home" element={<Navigate to="/world" replace />} />
                  <Route path="/listen" element={<ListenPage />} />
                  <Route path="/read" element={<ReadPage />} />
                  <Route path="/library/creating/:customMonthlyBookId" element={<BookCreatingPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/create-your-story" element={<CreateYourStoryPage />} />
                  <Route path="/audio" element={<AudioPage />} />
                  <Route path="/book/:id" element={<BookDetailPage />} />
                  <Route path="/audio/playlist/:playlistId" element={<PlaylistDetailPage />} />
                  <Route path="/book-series/:seriesId" element={<BookSeriesDetailPage />} />
                  
                  {/* CONTENT CONSUMPTION - Allow guests to try content, prompt to save progress later */}
                  <Route path="/read/:bookId" element={<GuestFriendlyRoute contentType="book"><BookReaderPage /></GuestFriendlyRoute>} />
                  <Route path="/player/:bookId/:chapterId" element={<GuestFriendlyRoute contentType="audio"><AudioPlayerPage /></GuestFriendlyRoute>} />
                  <Route path="/audio/playlist/:playlistId/play/:itemIndex" element={<GuestFriendlyRoute contentType="audio"><PlaylistPlayerPage /></GuestFriendlyRoute>} />
                  <Route path="/my-playlist/:id" element={<ProtectedRoute><UserPlaylistPage /></ProtectedRoute>} />
                  <Route path="/create-playlist" element={<ProtectedRoute><CreatePlaylistPage /></ProtectedRoute>} />
                  <Route path="/lessons" element={<ProtectedRoute><LessonsPage /></ProtectedRoute>} />
                  <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonPlayerPage /></ProtectedRoute>} />
                  <Route path="/games" element={<GamesPage />} />
                  <Route path="/profile" element={<ProfileSelectionPage />} />
                  <Route path="/create-profile" element={<CreateProfilePage />} />
                  <Route path="/edit-profile" element={<EditProfilePage />} />
                  <Route path="/paywall" element={<PaywallPage />} />
                  <Route path="/premium-onboarding" element={<PremiumOnboardingPage />} />
                  <Route path="/trial-stats" element={<TrialStatsPage />} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/demo/video-lesson" element={<VideoLessonDemo />} />
                  <Route path="/game" element={<ProtectedRoute><GameWebViewPage /></ProtectedRoute>} />
                  {/* Catch-all route - redirect to landing if not authenticated, world (explore) if authenticated */}
                  <Route path="*" element={isUserAuthenticated() ? <Navigate to="/world" replace /> : <Navigate to="/" replace />} />
                </Routes>
              </Layout>
              </ReferralPromptWrapper>
            </HashRouter>
            </BooksProvider>
            </TutorialProvider>
          </SubscriptionProvider>
        </UserProvider>
      </AudioProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
