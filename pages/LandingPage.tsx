import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Check, X } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useLanguage } from '../context/LanguageContext';
import { ApiService } from '../services/apiService';

const STORAGE_KEY = 'godly_kids_data_v6';
const TERMS_URL = 'https://www.godlykids.com/end-user-license-agreement';

// Optimized image component with blur-up loading
const OptimizedImage: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  if (error) return null;
  
  return (
    <div className="relative w-full h-full">
      {/* Placeholder gradient shown while loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#6a3093] to-[#3d1a5c] animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
};

// Animated carousel column that scrolls continuously
const CarouselColumn: React.FC<{
  images: string[];
  speed: number;
  direction: 'up' | 'down';
  columnIndex: number;
}> = ({ images, speed, direction, columnIndex }) => {
  const columnRef = useRef<HTMLDivElement>(null);
  
  // Double the images to create seamless loop
  const doubledImages = useMemo(() => [...images, ...images], [images]);
  
  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    
    let animationId: number;
    let position = direction === 'up' ? 0 : -column.scrollHeight / 2;
    
    const animate = () => {
      if (direction === 'up') {
        position -= speed;
        if (position <= -column.scrollHeight / 2) {
          position = 0;
        }
      } else {
        position += speed;
        if (position >= 0) {
          position = -column.scrollHeight / 2;
        }
      }
      column.style.transform = `translateY(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [speed, direction]);
  
  return (
    <div className="overflow-hidden h-full">
      <div ref={columnRef} className="flex flex-col gap-3">
        {doubledImages.map((url, idx) => (
          <div
            key={`${columnIndex}-${idx}`}
            className="w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg flex-shrink-0"
          >
            <OptimizedImage src={url} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Content Carousel - Multiple columns scrolling at different speeds
const ContentCarousel: React.FC<{ coverUrls: string[] }> = ({ coverUrls }) => {
  // Distribute images across 4 columns
  const columns = useMemo(() => {
    const cols: string[][] = [[], [], [], []];
    coverUrls.forEach((url, idx) => {
      cols[idx % 4].push(url);
    });
    return cols;
  }, [coverUrls]);
  
  // Different speeds and directions for visual interest
  const columnConfigs = [
    { speed: 0.3, direction: 'up' as const },
    { speed: 0.5, direction: 'down' as const },
    { speed: 0.4, direction: 'up' as const },
    { speed: 0.35, direction: 'down' as const },
  ];
  
  return (
    <div className="absolute inset-0 flex gap-3 px-3 py-4">
      {columns.map((colImages, idx) => (
        <div key={idx} className="flex-1 h-full">
          {colImages.length > 0 && (
            <CarouselColumn
              images={colImages}
              speed={columnConfigs[idx].speed}
              direction={columnConfigs[idx].direction}
              columnIndex={idx}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [coverUrls, setCoverUrls] = useState<string[]>([]);
  const { currentLanguage, setLanguage, supportedLanguages, t } = useLanguage();

  // Fetch cover images from published content (always use production API for splash page)
  useEffect(() => {
    const fetchCovers = async () => {
      try {
        // Use production API directly for landing page covers
        const PROD_API = 'https://backendgk2-0.onrender.com/api';
        
        const [booksRes, playlistsRes] = await Promise.all([
          fetch(`${PROD_API}/books`),
          fetch(`${PROD_API}/playlists?status=published`),
        ]);
        
        const booksData = await booksRes.json();
        const playlistsData = await playlistsRes.json();
        
        // Handle both array and wrapped responses
        const books = Array.isArray(booksData) ? booksData : (booksData.books || booksData.data || []);
        const playlists = Array.isArray(playlistsData) ? playlistsData : (playlistsData.playlists || playlistsData.data || []);
        
        // Extract cover URLs from books and playlists
        // Note: some books might not have status field, include them if they have a cover
        const bookCovers = books
          .filter((b: any) => b.coverUrl && (b.status === 'published' || !b.status))
          .map((b: any) => b.coverUrl);
        
        const playlistCovers = playlists
          .filter((p: any) => (p.coverImage || p.coverUrl) && (p.status === 'published' || !p.status))
          .map((p: any) => p.coverImage || p.coverUrl);
        
        // Combine and shuffle
        const allCovers = [...bookCovers, ...playlistCovers];
        
        console.log(`📚 Landing carousel: Found ${bookCovers.length} book covers, ${playlistCovers.length} playlist covers`);
        
        if (allCovers.length > 0) {
          // Shuffle and limit to 20 images for faster loading
          const shuffled = allCovers.sort(() => Math.random() - 0.5).slice(0, 20);
          setCoverUrls(shuffled);
        }
      } catch (error) {
        console.error('Failed to fetch cover images:', error);
      }
    };
    
    fetchCovers();
  }, []);

  // Check if user has already completed onboarding
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      console.log('🏠 LandingPage checking localStorage:', savedData ? 'Found data' : 'No data');
      
      if (savedData) {
        const userData = JSON.parse(savedData);
        console.log('🏠 LandingPage parsed data:', {
          parentName: userData.parentName,
          kidsCount: userData.kids?.length || 0,
          kidNames: userData.kids?.map((k: any) => k.name) || [],
          isSubscribed: userData.isSubscribed
        });
        
        // User has completed onboarding if they have:
        // - A parent name set (not the default 'Parent')
        // - Or have kids added
        // - Or have a subscription
        const hasCompletedOnboarding = 
          (userData.parentName && userData.parentName !== 'Parent' && userData.parentName !== '') ||
          (userData.kids && userData.kids.length > 0) ||
          userData.isSubscribed;
        
        console.log('🏠 hasCompletedOnboarding:', hasCompletedOnboarding);
        
        if (hasCompletedOnboarding) {
          // If user has kids, go to profile selection so they can choose
          // Otherwise go directly to home
          const hasKids = userData.kids && userData.kids.length > 0;
          if (hasKids) {
            console.log('👤 User has profiles, redirecting to profile selection...');
            navigate('/profile', { replace: true });
          } else {
            console.log('👤 User signed in (no kids), redirecting to home...');
            navigate('/home', { replace: true });
          }
          return;
        }
      } else {
        console.log('🏠 No saved data found in localStorage');
      }
    } catch (e) {
      console.error('Error checking user data:', e);
    }
    setIsChecking(false);
  }, [navigate]);

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="relative h-full w-full overflow-hidden flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="text-white mt-4 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Animated Content Carousel Background */}
      <div className="absolute inset-0 z-10">
        {coverUrls.length > 0 ? (
          <ContentCarousel coverUrls={coverUrls} />
        ) : (
          // Placeholder gradient while loading
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
        )}
        
        {/* Gradient overlays for smooth transitions */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-[#0a192f]/80 to-transparent z-20 pointer-events-none" style={{ height: '65%', top: '35%' }} />
      </div>

      {/* Language Selector Button - Hidden until more testing is done */}
      {false && <button
        onClick={() => setShowLanguageModal(true)}
        className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/30 backdrop-blur-md hover:bg-black/50 text-white px-3 py-2 rounded-full transition-all border border-white/20"
      >
        <span className="text-lg">{supportedLanguages[currentLanguage]?.flag || '🌐'}</span>
        <span className="text-sm font-medium">{supportedLanguages[currentLanguage]?.nativeName || 'English'}</span>
        <Globe className="w-4 h-4 opacity-70" />
      </button>}

      {/* Language Selection Modal - Hidden until more testing is done */}
      {false && showLanguageModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowLanguageModal(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm mx-4 max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#8B4513] to-[#A0522D]">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-white" />
                <h2 className="font-bold text-white text-lg">Select Language</h2>
              </div>
              <button
                onClick={() => setShowLanguageModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Language List */}
            <div className="overflow-y-auto max-h-[60vh]">
              {Object.entries(supportedLanguages).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => {
                    setLanguage(code);
                    setShowLanguageModal(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#fff8e1] transition-colors border-b border-gray-100 last:border-b-0 ${
                    currentLanguage === code ? 'bg-[#fff8e1]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="text-left">
                      <div className={`font-medium text-gray-800 ${currentLanguage === code ? 'font-bold text-[#8B4513]' : ''}`}>
                        {lang.nativeName}
                      </div>
                      <div className="text-xs text-gray-500">{lang.name}</div>
                    </div>
                  </div>
                  {currentLanguage === code && (
                    <div className="w-6 h-6 rounded-full bg-[#8bc34a] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                The app will be displayed in your selected language
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- BOTTOM UI SECTION --- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center px-6 pb-8" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 2rem)' }}>
          
          {/* App Title / Branding */}
          <div className="relative mb-5 text-center">
             <h1 className="font-display font-extrabold text-5xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] tracking-wide">
                Godly Kids
             </h1>
             <p className="text-[#FFD700] font-sans font-semibold text-sm mt-2 tracking-wide">
                Original Audio Stories, Books, Games, and More to Grow Faith
             </p>
             
             {/* Pricing Badge */}
             <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <span className="text-white font-bold text-lg">$39.99<span className="text-sm font-normal"> USD/yr</span></span>
                <span className="text-white/60 text-xs">•</span>
                <span className="text-white/80 text-sm">~$3.33/mo</span>
                <span className="text-white/60 text-xs">•</span>
                <span className="text-[#4ade80] text-sm font-semibold">14-day free trial</span>
             </div>
             
             {/* Library Access */}
             <p className="mt-2 text-white/70 text-sm">
                Unlimited access to a library of 100s
             </p>
          </div>

          {/* Sign In and Guest Buttons */}
          <div className="w-full max-w-sm space-y-3">
              {/* Get Started Button - Main CTA (Gold) */}
              <WoodButton 
                onClick={() => navigate('/onboarding')}
                fullWidth 
                variant="gold"
                className="py-4 text-lg"
              >
                Get Started
              </WoodButton>

              {/* Sign In Button - Secondary (Primary wood) */}
              <WoodButton 
                onClick={() => navigate('/signin')}
                fullWidth 
                variant="primary"
                className="py-4 text-lg"
              >
                I already have an account
              </WoodButton>

              <p className="text-center text-white/50 text-xs mt-4">
                By continuing you agree to our{' '}
                <button 
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#FFD700] underline hover:text-[#FFF8DC] transition-colors"
                >
                  Terms & Conditions
                </button>
              </p>
          </div>
      </div>

      {/* Terms & Conditions WebView Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg h-[80vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-[#8B4513] to-[#A0522D]">
              <h2 className="font-bold text-white text-lg">End-User License Agreement</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* WebView Content */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={TERMS_URL}
                className="w-full h-full border-0"
                title="End-User License Agreement"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;