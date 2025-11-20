
import React, { useMemo } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import ListenPage from './pages/ListenPage';
import ReadPage from './pages/ReadPage';
import LibraryPage from './pages/LibraryPage';
import BookDetailPage from './pages/BookDetailPage';
import ProfileSelectionPage from './pages/ProfileSelectionPage';
import CreateProfilePage from './pages/CreateProfilePage';
import AudioPlayerPage from './pages/AudioPlayerPage';
import PaywallPage from './pages/PaywallPage';
import BottomNavigation from './components/layout/BottomNavigation';
import { BooksProvider } from './context/BooksContext';
import { UserProvider } from './context/UserContext';

// --- ASSETS & HELPERS ---

// 1. The 4-Point "Diamond" Star from the reference image
const StarSVG: React.FC<{ className?: string; size?: number; color?: string; opacity?: number }> = ({ className, size = 24, color = "#FFD700", opacity = 1 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    style={{ overflow: 'visible', opacity }}
  >
    {/* Core Diamond Shape */}
    <path 
      d="M12 0 C12 0 15 9 24 12 C15 15 12 24 12 24 C12 24 9 15 0 12 C9 9 12 0 12 0 Z" 
      fill={color}
      filter="drop-shadow(0 0 3px rgba(255,255,255,0.9))"
    />
    {/* Center Glow */}
    <circle cx="12" cy="12" r="2" fill="white" filter="blur(1px)" />
  </svg>
);

// 2. Stylized "Toy Story" Cloud
const CloudSVG: React.FC<{ width: number; opacity?: number; flip?: boolean }> = ({ width, opacity = 0.9, flip = false }) => (
    <svg 
      width={width} 
      viewBox="0 0 200 120" 
      fill="none" 
      style={{ opacity, transform: flip ? 'scaleX(-1)' : 'none' }}
    >
        {/* Soft Bottom Shadow */}
        <path d="M20,85 Q40,115 90,105 Q140,120 180,85" stroke="rgba(20, 50, 100, 0.2)" strokeWidth="12" strokeLinecap="round" filter="blur(6px)" />
        
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
    if (path === '/home') return 1;
    if (path === '/listen') return 2;
    if (path === '/read') return 3;
    if (path === '/library') return 4;
    if (path.startsWith('/book/')) return 5;
    if (path === '/profile') return 5;
    if (path === '/create-profile') return 5;
    if (path.startsWith('/player/')) return 5;
    if (path === '/paywall') return 5; // Hide background or move it out of way
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
             LAYER 1: THE SKY (70% Height)
             Brighter, Logo-Inspired Blue & Yellow Gradient
             UPDATED: Removed white/pale yellows at bottom, replaced with deep gold/amber
         ============================================== */}
         <div className="absolute top-0 h-[70%] w-full overflow-hidden"
              style={{
                background: `linear-gradient(to bottom,
                   #0077be 0%,     /* Rich Blue (Top) */
                   #0ea5e9 25%,    /* Vivid Sky Blue */
                   #38bdf8 45%,    /* Bright Cyan */
                   #FFD700 70%,    /* Logo Gold */
                   #fbbf24 85%,    /* Saturated Amber */
                   #f59e0b 100%    /* Deep Amber Horizon - No White */
                )`
              }}
         >
            {/* Horizontal Gradient to shift time of day across widths */}
            <div className="absolute inset-0" 
                 style={{
                    background: `linear-gradient(to right,
                      transparent 0%, 
                      rgba(255,215,0,0.15) 25%, /* Home - Gold Tint */
                      rgba(0,0,0,0.05) 50%,     /* Listen */
                      rgba(255,140,0,0.3) 65%,  /* Read */
                      rgba(10,10,40,0.7) 85%    /* Library */
                    )`
                 }}>
            </div>

            {/* The "Golden Sunrise" Glow - Saturated */}
            <div className="absolute bottom-0 left-0 w-[200vw] h-[80%] bg-gradient-to-t from-[#f59e0b] via-[#fbbf24]/50 to-transparent opacity-80 mix-blend-screen pointer-events-none"></div>
            
            {/* Extra Bright Horizon Line - Saturated Amber */}
            <div className="absolute bottom-0 left-0 w-full h-[15%] bg-gradient-to-t from-[#f59e0b] to-transparent blur-xl opacity-90"></div>
         </div>

         {/* ==============================================
             LAYER 2: THE SUN & HEAVENLY BODIES
         ============================================== */}
         
         {/* The Sunrise Sun - Reduced white intensity */}
         <div className="absolute bottom-0 left-[120vw] w-[50vw] h-[50vw] rounded-full bg-gradient-to-b from-[#fff8e1] to-[#facc15] blur-[90px] opacity-60 mix-blend-screen transform translate-y-1/2"></div>
         
         {/* Core sun center - Cream instead of pure white */}
         <div className="absolute bottom-10 left-[135vw] w-[15vw] h-[15vw] rounded-full bg-[#fff8e1] blur-[60px] opacity-80 transform translate-y-1/4"></div>


         {/* ==============================================
             LAYER 3: THE STARS (Magical Style)
         ============================================== */}
         
         {/* Landing Page (0-100vw) */}
         <div className="absolute top-[10%] left-[10vw] animate-[pulse_4s_infinite]"><StarSVG size={36} /></div>
         <div className="absolute top-[15%] left-[35vw] animate-[pulse_5s_infinite] delay-300"><StarSVG size={28} /></div>
         <div className="absolute top-[25%] left-[65vw] animate-[pulse_6s_infinite] delay-700"><StarSVG size={32} /></div>
         <div className="absolute top-[8%] left-[25vw] animate-[pulse_3s_infinite]"><StarSVG size={18} opacity={0.8} /></div>
         <div className="absolute top-[20%] left-[50vw] animate-[pulse_4s_infinite] delay-500"><StarSVG size={20} opacity={0.9} /></div>
         <div className="absolute top-[5%] left-[80vw] animate-[pulse_5s_infinite]"><StarSVG size={22} opacity={0.8} /></div>

         {/* Home Page (100-200vw) - Fewer stars, brighter sky */}
         <div className="absolute top-[5%] left-[110vw] animate-[pulse_6s_infinite]"><StarSVG size={24} opacity={0.6} /></div>
         <div className="absolute top-[12%] left-[180vw] animate-[pulse_7s_infinite]"><StarSVG size={20} opacity={0.5} /></div>

         {/* Night/Library Stars (400vw+) */}
         <div className="absolute top-[10%] left-[420vw] animate-[pulse_4s_infinite]"><StarSVG size={24} color="#e0f2fe" /></div>
         <div className="absolute top-[20%] left-[480vw] animate-[pulse_5s_infinite]"><StarSVG size={18} color="#e0f2fe" /></div>


         {/* ==============================================
             LAYER 4: THE CLOUDS (Reference Style)
         ============================================== */}
         
         {/* Cloud 1: Top Right of Landing */}
         <div className="absolute top-[12%] left-[75vw] animate-[float_18s_infinite_alternate] opacity-90">
            <CloudSVG width={180} />
         </div>

         {/* Cloud 2: Mid Left of Landing */}
         <div className="absolute top-[28%] left-[15vw] animate-[float_25s_infinite_alternate-reverse] opacity-85 scale-90">
            <CloudSVG width={140} flip />
         </div>

         {/* Cloud 3: Low Center */}
         <div className="absolute top-[45%] left-[45vw] animate-[float_22s_infinite_alternate] opacity-80 scale-75">
            <CloudSVG width={120} />
         </div>

         {/* Home/Day Clouds - Very Visible on Main Menu */}
         <div className="absolute top-[15%] left-[110vw] opacity-95 animate-[float_25s_infinite_alternate]">
            <CloudSVG width={200} flip />
         </div>
         <div className="absolute top-[8%] left-[160vw] opacity-95 animate-[float_30s_infinite_alternate]">
            <CloudSVG width={240} />
         </div>


         {/* ==============================================
             LAYER 5: THE OCEAN (30% Height)
         ============================================== */}
         <div className="absolute bottom-0 h-[30%] w-full overflow-hidden"
              style={{
                background: `linear-gradient(to bottom,
                  #3b82f6 0%,     /* Brighter Horizon Blue */
                  #2563eb 20%,    /* Vivid Blue */
                  #1d4ed8 50%,    /* Medium Deep Blue */
                  #1e3a8a 100%    /* Deep Blue */
                )`
              }}
         >
             {/* 1. Horizon Line Blend */}
             <div className="absolute top-0 left-0 w-full h-[4px] bg-[#f59e0b]/50 blur-[2px]"></div>

             {/* 2. The "Sun Glitter" Path (Golden Reflection) */}
             <div className="absolute top-0 left-[135vw] -translate-x-1/2 w-[30vw] h-full bg-gradient-to-b from-[#FFD700]/80 via-[#F59E0B]/30 to-transparent blur-lg transform scale-x-150"></div>
             
             {/* 3. Gentle Ripples - GOLD instead of white */}
             <div className="absolute bottom-0 w-full h-full opacity-40"
                  style={{
                      backgroundImage: 'radial-gradient(ellipse at center, rgba(255,215,0,0.3) 0%, transparent 70%)',
                      backgroundSize: '60vw 10vw',
                      backgroundPosition: 'center top'
                  }}
             ></div>

             {/* 4. Island Silhouettes */}
             <div className="absolute -top-2 left-[5vw] w-[12vw] h-[4vw] bg-[#0f172a] rounded-t-[100%] opacity-80 blur-[1px]"></div>
             <div className="absolute -top-1 right-[450vw] w-[8vw] h-[3vw] bg-[#0f172a] rounded-t-[100%] opacity-80 blur-[1px]"></div>

         </div>

         {/* ==============================================
             LAYER 6: GLOBAL OVERLAYS
         ============================================== */}
         {/* Vignette for depth */}
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
  const isBookDetail = location.pathname.startsWith('/book/');
  const isPlayer = location.pathname.startsWith('/player/');
  const isProfile = location.pathname === '/profile';
  const isCreateProfile = location.pathname === '/create-profile';
  const isPaywall = location.pathname === '/paywall';

  return (
    <div className="relative h-screen w-full overflow-hidden text-white flex flex-col">
      
      <PanoramaBackground />
      
      {/* Content Wrapper */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {children}
      </div>

      {/* Only show BottomNavigation on main tab pages */}
      {!isLanding && !isBookDetail && !isPlayer && !isProfile && !isCreateProfile && !isPaywall && <BottomNavigation />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <BooksProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/listen" element={<ListenPage />} />
              <Route path="/read" element={<ReadPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/book/:id" element={<BookDetailPage />} />
              <Route path="/player/:bookId/:chapterId" element={<AudioPlayerPage />} />
              <Route path="/profile" element={<ProfileSelectionPage />} />
              <Route path="/create-profile" element={<CreateProfilePage />} />
              <Route path="/paywall" element={<PaywallPage />} />
            </Routes>
          </Layout>
        </HashRouter>
      </BooksProvider>
    </UserProvider>
  );
};

export default App;
