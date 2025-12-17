
import React, { useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';

// Diagnostic: Log when the entire app JS module is evaluated (WebView recreation)
if (!(window as any).__GK_APP_BOOTED__) {
  (window as any).__GK_APP_BOOTED__ = true;
  console.log('🚀 APP BOOT (WebView created)', new Date().toISOString());

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
    });
  } catch {}

  // Crash recovery: detect if we crashed recently and are in a crash loop
  try {
    const CRASH_KEY = 'gk_crash_timestamps';
    const CRASH_WINDOW_MS = 30000; // 30 seconds
    const MAX_CRASHES = 3;
    
    const now = Date.now();
    let crashes: number[] = [];
    try {
      crashes = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]');
    } catch {}
    
    // Clean old crash timestamps
    crashes = crashes.filter((t: number) => now - t < CRASH_WINDOW_MS);
    
    // If we crashed too many times recently, enter recovery mode
    if (crashes.length >= MAX_CRASHES) {
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
    }
  } catch {}

  // DeSpia detection for tracing (URL normalization is now done in index.tsx BEFORE React mounts)
  try {
    const ua = navigator.userAgent || '';
    const isCustomAppUA = /despia/i.test(ua);
    if (isCustomAppUA) {
      try { (window as any).__GK_TRACE__?.('despia_detected', { ua }); } catch {}
      // NOTE: URL stripping moved to index.tsx to avoid conflicts with React Router
    }
  } catch {}

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
      featureTrace,
      ts: new Date().toISOString(),
    };
    console.error('💥 GLOBAL ERROR:', details);
    try {
      (window as any).__GK_LAST_ERROR_DETAILS__ = details;
    } catch {}

    // Record crash timestamp for crash loop detection
    try {
      const CRASH_KEY = 'gk_crash_timestamps';
      let crashes: number[] = [];
      try { crashes = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]'); } catch {}
      crashes.push(Date.now());
      // Keep only last 10 crash timestamps
      localStorage.setItem(CRASH_KEY, JSON.stringify(crashes.slice(-10)));
    } catch {}

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
import BookSeriesDetailPage from './pages/BookSeriesDetailPage';
import LessonsPage from './pages/LessonsPage';
import LessonPlayerPage from './pages/LessonPlayerPage';
import VideoLessonDemo from './pages/VideoLessonDemo';
import GameWebViewPage from './pages/GameWebViewPage';
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
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0f172a]">
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  useEffect(() => {
    try {
      (window as any).__GK_TRACE__?.('route_change', { path: location.pathname, hash: location.hash, search: location.search });
    } catch {}
  }, [location.pathname, location.hash, location.search]);
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

  return (
    <div className="relative h-screen w-full overflow-hidden text-white flex flex-col">

      <PanoramaBackground />

      {/* Content Wrapper */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {children}
      </div>

      {/* Mini Player */}
      <MiniPlayer />

      {/* Only show BottomNavigation on main tab pages */}
      {!isLanding && !isSignIn && !isOnboarding && !isBookDetail && !isPlayer && !isProfile && !isCreateProfile && !isEditProfile && !isPaywall && !isSettings && !isBookReader && !isAudioPage && !isLessonPage && !isGamePage && !isResetPassword && !isBookSeries && <BottomNavigation />}
    </div>
  );
};

const App: React.FC = () => {
  // Check if we're in DeSpia wrapper - if so, skip risky initializations
  const isDespia = DespiaService.isNative();

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

  // Initialize activity tracking for Report Card (skip in DeSpia to avoid visibility handler issues)
  useEffect(() => {
    if (isDespia) {
      console.log('⏭️ Skipping activity tracking in DeSpia');
      try { (window as any).__GK_TRACE__?.('activity_tracking_skip', { reason: 'despia' }); } catch {}
      return;
    }
    try { (window as any).__GK_TRACE__?.('activity_tracking_start'); } catch {}
    activityTrackingService.startTimeTracking();
    
    return () => {
      try { (window as any).__GK_TRACE__?.('activity_tracking_stop'); } catch {}
      activityTrackingService.stopTimeTracking();
    };
  }, [isDespia]);

  return (
    <ErrorBoundary>
      <LanguageProvider>
      <AudioProvider>
        <UserProvider>
          <SubscriptionProvider>
            <BooksProvider>
              <HashRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signin" element={<SignInPage />} />
                  <Route path="/sign-in" element={<SignInPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/listen" element={<ListenPage />} />
                  <Route path="/read" element={<ReadPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/book/:id" element={<BookDetailPage />} />
                  <Route path="/read/:bookId" element={<BookReaderPage />} />
                  <Route path="/player/:bookId/:chapterId" element={<AudioPlayerPage />} />
                  <Route path="/audio" element={<AudioPage />} />
                  <Route path="/audio/playlist/:playlistId" element={<PlaylistDetailPage />} />
                  <Route path="/audio/playlist/:playlistId/play/:itemIndex" element={<PlaylistPlayerPage />} />
                  <Route path="/book-series/:seriesId" element={<BookSeriesDetailPage />} />
                  <Route path="/lessons" element={<LessonsPage />} />
                  <Route path="/lesson/:lessonId" element={<LessonPlayerPage />} />
                  <Route path="/profile" element={<ProfileSelectionPage />} />
                  <Route path="/create-profile" element={<CreateProfilePage />} />
                  <Route path="/edit-profile" element={<EditProfilePage />} />
                  <Route path="/paywall" element={<PaywallPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/demo/video-lesson" element={<VideoLessonDemo />} />
                  <Route path="/game" element={<GameWebViewPage />} />
                  {/* Catch-all route - prevents white screen when route doesn't match */}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </Layout>
            </HashRouter>
            </BooksProvider>
          </SubscriptionProvider>
        </UserProvider>
      </AudioProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
