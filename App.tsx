
import React, { useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInPage from './pages/SignInPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';

// Diagnostic: Log when the entire app JS module is evaluated (WebView recreation)
if (!(window as any).__GK_APP_BOOTED__) {
  (window as any).__GK_APP_BOOTED__ = true;
  console.log('🚀 APP BOOT (WebView created)', new Date().toISOString());
  
  // GLOBAL ERROR HANDLERS - catch ALL JS errors, not just React ones
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('💥 GLOBAL ERROR:', { message, source, lineno, colno, error: error?.stack });
    // Prevent white screen - show alert so user knows what happened
    try {
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML = `
        <div style="position:fixed;inset:0;background:#1a3a52;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;padding:20px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">🌊</div>
          <h1 style="color:white;font-size:20px;font-weight:bold;margin-bottom:8px;">Oops! Something went wrong</h1>
          <p style="color:rgba(255,255,255,0.7);margin-bottom:16px;max-width:280px;">The app hit a wave. Tap to refresh.</p>
          <button onclick="location.reload()" style="background:linear-gradient(to right,#FFD700,#FFA500);color:#3E1F07;font-weight:bold;padding:12px 32px;border-radius:9999px;border:none;">Refresh</button>
        </div>
      `;
      document.body.appendChild(errorDiv);
    } catch {}
    return true; // Prevent default error handling
  };
  
  window.onunhandledrejection = (event) => {
    console.error('💥 UNHANDLED PROMISE REJECTION:', event.reason);
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
  // Initialize OneSignal notifications
  useEffect(() => {
    NotificationService.init();
  }, []);

  // Initialize activity tracking for Report Card
  useEffect(() => {
    activityTrackingService.startTimeTracking();
    
    return () => {
      activityTrackingService.stopTimeTracking();
    };
  }, []);

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
