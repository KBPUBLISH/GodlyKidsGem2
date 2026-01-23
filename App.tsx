
import React, { useMemo, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ReferralPromptModal from './components/features/ReferralPromptModal';
import CreateAccountModal from './components/modals/CreateAccountModal';
import { useUser } from './context/UserContext';

// Diagnostic: Log when the entire app JS module is evaluated (WebView recreation)
if (!(window as any).__GK_APP_BOOTED__) {
  (window as any).__GK_APP_BOOTED__ = true;
  console.log('🚀 APP BOOT (WebView created)', new Date().toISOString());

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
              const currentHash = window.location.hash || '#/home';
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
  window.onerror = (message, source, lineno, colno, error) => {
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
    } catch {}

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
      localStorage.setItem('gk_last_errors', JSON.stringify(existing.slice(-5)));
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
            <button onclick="(function(){try{var t=JSON.stringify(window.__GK_LAST_ERROR_DETAILS__||{}, null, 2); var done=false; try{navigator.clipboard&&navigator.clipboard.writeText&&navigator.clipboard.writeText(t).then(function(){done=true; alert('Copied! Paste it into chat.');}).catch(function(){});}catch(e){} try{if(done) return; var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); var ok=false; try{ok=document.execCommand('copy');}catch(e){} document.body.removeChild(ta); if(ok){alert('Copied! Paste it into chat.'); return;} }catch(e){} try{prompt('Copy the crash details below:', t);}catch(e){} }catch(e){}})()"
              style="background:rgba(255,255,255,0.25);color:white;font-weight:bold;padding:10px 18px;border-radius:9999px;border:none;">
              Copy details
            </button>
            <button onclick="var el=document.getElementById('gk_err'); if(el) el.style.display='block';"
              style="background:rgba(255,255,255,0.15);color:white;font-weight:bold;padding:10px 18px;border-radius:9999px;border:none;">
              Show details
            </button>
          </div>

          <pre id="gk_err" style="display:none;white-space:pre-wrap;text-align:left;max-width:380px;max-height:240px;overflow:auto;background:rgba(0,0,0,0.35);color:rgba(255,255,255,0.85);padding:12px;border-radius:12px;font-size:12px;">${escapeHtml(JSON.stringify(details, null, 2))}</pre>

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
import BookDetailPage from './pages/BookDetailPage';
import ProfileSelectionPage from './pages/ProfileSelectionPage';
import CreateProfilePage from './pages/CreateProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import AudioPlayerPage from './pages/AudioPlayerPage';
import PaywallPage from './pages/PaywallPage';
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
import GivingPage from './pages/GivingPage';

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
  '/home': ['coins_highlight', 'coins_popup_open', 'report_card_highlight', 'report_card_open', 'shop_highlight', 'shop_open', 'navigate_to_give', 'navigate_to_explore', 'devotional_highlight', 'navigate_to_books', 'navigate_to_audio', 'tutorial_complete', 'explore_pause', 'paywall'],
  '/giving': ['navigate_to_give', 'campaign_highlight', 'give_button_highlight', 'donation_complete'],
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

// Protected route wrapper - shows account creation modal if no account
// Exception: allows full access during active tutorial for tutorial-first flow
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasAccount, setHasAccount] = useState(() => hasUserAccount());
  const navigate = useNavigate();
  
  // Allow FULL access during ANY active tutorial (don't interrupt tutorial flow)
  const tutorialActive = isTutorialInProgress();
  
  // If user has account or tutorial is active, allow access
  if (hasAccount || tutorialActive) {
    return <>{children}</>;
  }
  
  // No account and no tutorial - show account creation modal (don't render children yet)
  return (
    <CreateAccountModal
      isOpen={true}
      navigateToOnboarding={false} // Don't auto-navigate, let ProtectedRoute handle it
      onClose={() => {
        // Go back to previous page
        window.history.back();
      }}
      onAccountCreated={() => {
        setHasAccount(true);
      }}
      onSignIn={() => {
        navigate('/signin', { state: { returnTo: window.location.hash.replace('#', '') || '/home' } });
      }}
    />
  );
};

// Home page wrapper - shows welcome screen for new users who completed onboarding
const HomePageWithWelcomeCheck: React.FC = () => {
  // Show welcome screen AFTER onboarding is complete (user has parent name or kids)
  const savedData = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
  const hasCompletedOnboarding = (() => {
    if (!savedData) return false;
    try {
      const data = JSON.parse(savedData);
      return (data.parentName && data.parentName !== 'Parent' && data.parentName !== '') || 
             (data.kids && data.kids.length > 0);
    } catch { return false; }
  })();
  
  // Only show welcome screen if user completed onboarding AND hasn't seen welcome yet
  if (hasCompletedOnboarding && shouldShowWelcome()) {
    return <NewUserWelcomePage />;
  }
  return <HomePage />;
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

// The Panorama Background Component
const PanoramaBackground: React.FC = () => {
  const location = useLocation();

  // active index logic remains same
  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path === '/signin') return 0;
    if (path === '/onboarding') return 0;
    if (path === '/home') return 1;
    if (path === '/listen') return 2;
    if (path === '/read') return 3;
    if (path === '/library') return 4;
    if (path === '/giving') return 5;
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
        className="absolute top-0 bottom-0 left-0 w-[600vw] h-full transition-transform duration-1000 ease-in-out will-change-transform"
        style={{ transform: `translateX(-${activeIndex * 100}vw)` }}
      >
        {/* ==============================================
             BACKGROUND IMAGE LAYER
             Replace the gradient-based panorama with an image
         ============================================== */}
        <div
          className="absolute inset-0 w-[600vw] h-full"
          style={{
            backgroundImage: 'url(/assets/images/panorama-background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat'
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  useEffect(() => {
    try {
      (window as any).__GK_TRACE__?.('route_change', { path: location.pathname, hash: location.hash, search: location.search });
      
      // Track page visit for analytics (how far users get in the app)
      activityTrackingService.trackPageVisit(location.pathname);
      
      // DESPIA FIX: Save current route for restoration after soft-close/reopen
      // This allows us to restore the user to their last location when the app returns from background
      // SKIP saving game routes - they have query params that won't work after force quit
      if ((window as any).__GK_IS_DESPIA__ && location.pathname && location.pathname !== '/') {
        // Don't save game routes since they require query params
        if (location.pathname.startsWith('/game')) {
          console.log('📱 Despia: Skipping route save for game page');
          localStorage.removeItem('gk_last_route'); // Clear any previous game route
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
  const isGamePage = location.pathname === '/game';
  const isResetPassword = location.pathname === '/reset-password';
  const isBookSeries = location.pathname.startsWith('/book-series/');
  const isWelcome = location.pathname === '/welcome';
  const isReadyToJumpIn = location.pathname === '/ready';
  const isCreatePlaylist = location.pathname === '/create-playlist';
  const isMyPlaylist = location.pathname.startsWith('/my-playlist/');
  const isParentQuiz = location.pathname === '/parentquiz';
  const isSharePage = location.pathname.startsWith('/share/') || location.pathname.startsWith('/s/') || (location.pathname.startsWith('/playlist/') && !location.pathname.startsWith('/playlist-detail'));

  // Standalone pages that don't need the app chrome (background, navigation, etc.)
  const isStandalonePage = isParentQuiz || isSharePage || isReadyToJumpIn;

  // For standalone pages, render just the children without app styling
  if (isStandalonePage) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden text-white flex flex-col">

      <PanoramaBackground />

      {/* Content Wrapper - safe area padding applied here so background is unaffected */}
      <div 
        className="relative z-10 flex-1 overflow-hidden"
        style={{
          paddingLeft: 'var(--safe-area-left, 0px)',
          paddingRight: 'var(--safe-area-right, 0px)',
        }}
      >
        {children}
      </div>

      {/* Mini Player */}
      <MiniPlayer />

      {/* Only show BottomNavigation on main tab pages */}
      {!isLanding && !isSignIn && !isOnboarding && !isWelcome && !isReadyToJumpIn && !isBookDetail && !isPlayer && !isProfile && !isCreateProfile && !isEditProfile && !isPaywall && !isSettings && !isBookReader && !isAudioPage && !isLessonPage && !isGamePage && !isResetPassword && !isBookSeries && !isCreatePlaylist && !isMyPlaylist && <BottomNavigation />}

      {/* Onboarding Tutorial Overlay */}
      <OnboardingTutorial />
      
      {/* Bottom Safe Area Spacer - for pages without BottomNavigation */}
      {(isBookDetail || isPlayer || isProfile || isCreateProfile || isEditProfile || isPaywall || isSettings || isBookReader || isAudioPage || isLessonPage || isBookSeries || isCreatePlaylist || isMyPlaylist) && (
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
              const targetRoute = lastRoute || '#/home';
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
  useEffect(() => {
    if (!isDespia) return;
    
    const user = authService.getUser();
    const userId = user?._id || user?.id;
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
                  {/* BROWSING PAGES - No account required, users can explore freely */}
                  <Route path="/home" element={<HomePageWithWelcomeCheck />} />
                  <Route path="/listen" element={<ListenPage />} />
                  <Route path="/read" element={<ReadPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/audio" element={<AudioPage />} />
                  <Route path="/book/:id" element={<BookDetailPage />} />
                  <Route path="/audio/playlist/:playlistId" element={<PlaylistDetailPage />} />
                  <Route path="/book-series/:seriesId" element={<BookSeriesDetailPage />} />
                  
                  {/* CONTENT CONSUMPTION - Account required to read/play */}
                  <Route path="/read/:bookId" element={<ProtectedRoute><BookReaderPage /></ProtectedRoute>} />
                  <Route path="/player/:bookId/:chapterId" element={<ProtectedRoute><AudioPlayerPage /></ProtectedRoute>} />
                  <Route path="/audio/playlist/:playlistId/play/:itemIndex" element={<ProtectedRoute><PlaylistPlayerPage /></ProtectedRoute>} />
                  <Route path="/my-playlist/:id" element={<ProtectedRoute><UserPlaylistPage /></ProtectedRoute>} />
                  <Route path="/create-playlist" element={<ProtectedRoute><CreatePlaylistPage /></ProtectedRoute>} />
                  <Route path="/lessons" element={<ProtectedRoute><LessonsPage /></ProtectedRoute>} />
                  <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonPlayerPage /></ProtectedRoute>} />
                  <Route path="/giving" element={<ProtectedRoute><GivingPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfileSelectionPage /></ProtectedRoute>} />
                  <Route path="/create-profile" element={<ProtectedRoute><CreateProfilePage /></ProtectedRoute>} />
                  <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                  <Route path="/paywall" element={<PaywallPage />} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/demo/video-lesson" element={<VideoLessonDemo />} />
                  <Route path="/game" element={<ProtectedRoute><GameWebViewPage /></ProtectedRoute>} />
                  {/* Catch-all route - redirect to landing if not authenticated, home if authenticated */}
                  <Route path="*" element={isUserAuthenticated() ? <Navigate to="/home" replace /> : <Navigate to="/" replace />} />
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
