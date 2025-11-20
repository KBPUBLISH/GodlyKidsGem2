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
import BottomNavigation from './components/layout/BottomNavigation';
import { BooksProvider } from './context/BooksContext';

// The Panorama Background Component
const PanoramaBackground: React.FC = () => {
  const location = useLocation();
  
  // Calculate active index based on path
  // Maps each main route to a full screen width (100vw) for dramatic scene changes
  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path === '/home') return 1;
    if (path === '/listen') return 2;
    if (path === '/read') return 3;
    if (path === '/library') return 4;
    if (path.startsWith('/book/')) return 5;
    if (path === '/profile') return 5; // Reuse night scene for profile
    if (path === '/create-profile') return 5; // Reuse night scene for create profile
    return 1;
  }, [location.pathname]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0f172a]">
      {/* 
        This container is 600vw (6 screens wide).
      */}
      <div 
        className="flex h-full w-[600vw] transition-transform duration-1000 ease-in-out will-change-transform"
        style={{ transform: `translateX(-${activeIndex * 100}vw)` }}
      >
        
        {/* SEGMENT 0: LANDING (Sunrise at Sea) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-indigo-400 via-purple-300 to-orange-200 shrink-0 overflow-hidden">
           {/* Sun Rising */}
           <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-200 rounded-full blur-3xl opacity-60"></div>
           {/* Birds */}
           <div className="absolute top-1/4 left-1/3 text-black/20 text-4xl transform scale-x-150">~</div>
           <div className="absolute top-[22%] left-[35%] text-black/20 text-2xl transform scale-x-150">~</div>
           {/* Water */}
           <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#1e3a8a] to-[#3b82f6] opacity-80"></div>
           <div className="absolute bottom-[30%] w-full h-4 bg-white/10 blur-sm"></div>
        </div>

        {/* SEGMENT 1: HOME (Bright Day - Open Ocean) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-sky-400 via-sky-300 to-blue-200 shrink-0 overflow-hidden">
            {/* Clouds */}
            <div className="absolute top-20 left-20 w-48 h-16 bg-white/40 rounded-full blur-xl"></div>
            <div className="absolute top-40 right-40 w-64 h-20 bg-white/30 rounded-full blur-xl"></div>
            
            {/* Distant Small Islands */}
            <div className="absolute bottom-[32%] left-[10%] w-32 h-12 bg-[#2d6a4f] rounded-t-full opacity-60"></div>
            <div className="absolute bottom-[32%] right-[15%] w-24 h-10 bg-[#2d6a4f] rounded-t-full opacity-50"></div>
            
            {/* Water */}
            <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#0369a1] to-[#0ea5e9] opacity-90"></div>
            {/* Wave caps */}
            <div className="absolute bottom-[10%] left-0 right-0 h-px bg-white/20"></div>
        </div>

        {/* SEGMENT 2: LISTEN (Jungle Island) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-sky-500 via-cyan-400 to-blue-300 shrink-0 overflow-hidden">
            {/* Large Island Shape */}
            <div className="absolute bottom-[25%] left-[-10%] w-[70%] h-80 bg-[#1b4332] rounded-tr-[100%] transform skew-x-6"></div>
            <div className="absolute bottom-[25%] left-[20%] w-40 h-40 bg-[#081c15] rounded-full blur-2xl opacity-40"></div>
            
            {/* Palm details (abstract) */}
            <div className="absolute bottom-[40%] left-[10%] w-2 h-16 bg-[#081c15] rotate-6"></div>
            <div className="absolute bottom-[50%] left-[8%] w-16 h-16 bg-[#2d6a4f] rounded-full blur-md"></div>

            {/* Water */}
            <div className="absolute bottom-0 w-full h-[30%] bg-gradient-to-t from-[#0c4a6e] to-[#0284c7]"></div>
        </div>

        {/* SEGMENT 3: READ (Sandy Beach / Archipelago) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-cyan-300 via-sky-200 to-blue-200 shrink-0 overflow-hidden">
            {/* Beach Sand */}
            <div className="absolute bottom-[25%] right-0 w-[60%] h-24 bg-[#e9c46a] transform -skew-y-2 origin-bottom-right"></div>
            {/* Palm Trees */}
            <div className="absolute bottom-[35%] right-[10%] w-3 h-24 bg-[#6f4e37] -rotate-6"></div>
            <div className="absolute bottom-[45%] right-[5%] w-24 h-24 bg-[#38b000] rounded-full blur-sm opacity-80"></div>
            
            {/* Water */}
            <div className="absolute bottom-0 w-full h-[28%] bg-gradient-to-t from-[#0077b6] to-[#48cae4] opacity-80"></div>
        </div>

        {/* SEGMENT 4: LIBRARY (Golden Hour / Sunset) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-orange-300 via-red-200 to-purple-300 shrink-0 overflow-hidden">
            {/* Sun Setting */}
            <div className="absolute bottom-[32%] left-1/2 w-32 h-32 bg-[#ff9e00] rounded-full blur-lg"></div>
            
            {/* Rock Silhouette */}
            <div className="absolute bottom-[25%] left-[20%] w-40 h-32 bg-[#3c096c] rounded-t-3xl"></div>
            
            {/* Water Reflection */}
            <div className="absolute bottom-0 w-full h-[30%] bg-gradient-to-t from-[#240046] to-[#7b2cbf]"></div>
            <div className="absolute bottom-[15%] left-1/3 right-1/3 h-1 bg-orange-400/30 blur-sm"></div>
        </div>

        {/* SEGMENT 5: BOOK DETAIL & PROFILE (Night Sea) */}
        <div className="w-screen h-full relative bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#312e81] shrink-0 overflow-hidden">
            {/* Stars */}
            <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
                backgroundSize: '70px 70px',
                opacity: 0.5
            }}></div>
            
            {/* Moon */}
            <div className="absolute top-20 right-16 w-16 h-16 bg-yellow-100 rounded-full shadow-[0_0_30px_rgba(255,255,200,0.4)]"></div>
             
            {/* Dark Water */}
            <div className="absolute bottom-0 w-full h-[35%] bg-[#000000] opacity-60"></div>
            <div className="absolute bottom-[35%] w-full h-1 bg-white/10"></div>
        </div>

      </div>

      {/* Global Texture */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none mix-blend-overlay" 
           style={{ filter: 'contrast(120%) brightness(100%)', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isBookDetail = location.pathname.startsWith('/book/');
  const isProfile = location.pathname === '/profile';
  const isCreateProfile = location.pathname === '/create-profile';

  return (
    <div className="relative h-screen w-full overflow-hidden text-white flex flex-col">
      
      <PanoramaBackground />
      
      {/* Content Wrapper */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {children}
      </div>

      {/* Only show BottomNavigation on main tab pages */}
      {!isLanding && !isBookDetail && !isProfile && !isCreateProfile && <BottomNavigation />}
    </div>
  );
};

const App: React.FC = () => {
  return (
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
            <Route path="/profile" element={<ProfileSelectionPage />} />
            <Route path="/create-profile" element={<CreateProfilePage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </BooksProvider>
  );
};

export default App;