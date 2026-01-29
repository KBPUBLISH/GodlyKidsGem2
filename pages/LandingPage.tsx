import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityTrackingService } from '../services/activityTrackingService';
import { hasCompletedAnySession } from '../services/dailySessionService';
import CreateAccountModal from '../components/modals/CreateAccountModal';
import { useBooks } from '../context/BooksContext';

const STORAGE_KEY = 'godly_kids_data_v6';

// Auto-scrolling carousel component
const ContentCarousel: React.FC<{ bookCovers: string[] }> = ({ bookCovers }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Default covers if no books loaded
  const defaultCovers = [
    '/assets/images/books/david-goliath.jpg',
    '/assets/images/books/noahs-ark.jpg',
    '/assets/images/books/daniel-lions.jpg',
    '/assets/images/books/jonah-whale.jpg',
    '/assets/images/books/moses-red-sea.jpg',
    '/assets/images/books/joseph-dreams.jpg',
  ];
  
  const covers = bookCovers.length > 0 ? bookCovers : defaultCovers;
  // Triple the covers for seamless infinite scroll
  const tripleCovers = [...covers, ...covers, ...covers];
  
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    let animationId: number;
    let scrollPos = 0;
    const scrollSpeed = 0.5; // pixels per frame
    
    const animate = () => {
      scrollPos += scrollSpeed;
      
      // Reset to middle section when we've scrolled past the first set
      const singleSetWidth = scrollContainer.scrollWidth / 3;
      if (scrollPos >= singleSetWidth) {
        scrollPos = 0;
      }
      
      scrollContainer.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationId);
  }, [covers.length]);
  
  return (
    <div className="w-full overflow-hidden">
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tripleCovers.map((cover, i) => (
          <div 
            key={i}
            className="flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden shadow-md bg-gradient-to-br from-[#7C3AED]/30 to-[#3D8B8B]/30"
          >
            <img 
              src={cover} 
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                // Hide broken image, gradient background shows through
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Check if user has an account
const hasUserAccount = (): boolean => {
  const token = localStorage.getItem('godlykids_auth_token');
  const email = localStorage.getItem('godlykids_user_email');
  return !!(token || email);
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { books } = useBooks();
  
  // Get book covers for carousel
  const bookCovers = books
    .filter(b => b.coverImage)
    .slice(0, 12)
    .map(b => b.coverImage);

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

  // Track splash page view (only once per session)
  useEffect(() => {
    const splashViewedKey = 'godlykids_splash_viewed_session';
    if (!sessionStorage.getItem(splashViewedKey) && !isChecking) {
      sessionStorage.setItem(splashViewedKey, 'true');
      activityTrackingService.trackOnboardingEvent('splash_page_viewed');
    }
  }, [isChecking]);

  const handleStartExplore = () => {
    activityTrackingService.trackOnboardingEvent('splash_explore_clicked');
    
    // Check if user has completed at least one session but doesn't have an account
    // If so, require account creation before continuing
    const hasCompletedFirstLesson = hasCompletedAnySession();
    const hasAccount = hasUserAccount();
    
    if (hasCompletedFirstLesson && !hasAccount) {
      // Show account creation modal
      setShowAccountModal(true);
      return;
    }
    
    // Go to the explore/home page
    navigate('/home');
  };

  const handleSignIn = () => {
    activityTrackingService.trackOnboardingEvent('splash_signin_clicked');
    navigate('/signin');
  };

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#E8F4F6]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#3D8B8B]/30 border-t-[#3D8B8B] rounded-full animate-spin"></div>
          <p className="text-[#3D8B8B] mt-4 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#E8F4F6] overflow-hidden">
      {/* Safe area top spacer */}
      <div style={{ height: 'var(--safe-area-top, 0px)' }} className="bg-[#E8F4F6] flex-shrink-0" />
      
      {/* Hero Image Section */}
      <div className="relative flex-1 min-h-0">
        {/* Image placeholder while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#E8F4F6] to-[#D0E8EA] animate-pulse" />
        )}
        
        {/* Family Image */}
        <img 
          src="/splash-family.jpg" 
          alt="Parent and child learning together"
          className={`w-full h-full object-cover object-top transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
        />
        
        {/* Content Carousel - Top of Image */}
        <div className="absolute top-3 left-0 right-0 z-10 px-2">
          <ContentCarousel bookCovers={bookCovers} />
        </div>
        
        {/* Rating Badge - Below carousel */}
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-lg z-10">
          <div className="flex items-center gap-2">
            <span className="text-[#FFB800] text-2xl tracking-tight">★★★★★</span>
            <span className="text-[#2D3748] font-bold text-lg">4.9</span>
          </div>
          <p className="text-[#5A7A8A] text-xs text-center mt-0.5">
            200+ reviews on Apple & Google Play
          </p>
        </div>
        
        {/* Ocean wave overlay */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden">
          {/* Gradient fade */}
          <div className="h-24 bg-gradient-to-t from-[#E8F4F6] to-transparent" />
          
          {/* Wave animation styles */}
          <style>{`
            @keyframes wave-slow {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes wave-medium {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes wave-fast {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .wave-back {
              animation: wave-slow 8s linear infinite;
            }
            .wave-middle {
              animation: wave-medium 6s linear infinite;
            }
            .wave-front {
              animation: wave-fast 4s linear infinite;
            }
          `}</style>
          
          {/* Multiple wave layers for depth - doubled width for seamless loop */}
          <svg 
            className="absolute bottom-0 left-0 w-[200%]" 
            viewBox="0 0 2880 180" 
            preserveAspectRatio="none"
            style={{ height: '90px' }}
          >
            {/* Back wave - lighter (doubled for seamless animation) */}
            <path 
              className="wave-back"
              d="M0,100 C120,120 240,80 360,100 C480,120 600,80 720,100 C840,120 960,80 1080,100 C1200,120 1320,80 1440,100 C1560,120 1680,80 1800,100 C1920,120 2040,80 2160,100 C2280,120 2400,80 2520,100 C2640,120 2760,80 2880,100 L2880,180 L0,180 Z" 
              fill="#B8D4E3"
              opacity="0.6"
            />
            {/* Middle wave (doubled for seamless animation) */}
            <path 
              className="wave-middle"
              d="M0,120 C180,150 360,100 540,130 C720,160 900,110 1080,140 C1260,160 1440,120 1620,140 C1800,160 1980,110 2160,140 C2340,160 2520,120 2700,140 C2880,160 2880,180 2880,180 L0,180 Z" 
              fill="#9CC5D8"
              opacity="0.7"
            />
            {/* Front wave - main (doubled for seamless animation) */}
            <path 
              className="wave-front"
              d="M0,140 C240,170 480,130 720,155 C960,180 1200,140 1440,160 C1680,180 1920,140 2160,165 C2400,180 2640,150 2880,170 L2880,180 L0,180 Z" 
              fill="#E8F4F6"
            />
          </svg>
        </div>
      </div>
      
      {/* Content Section - Light Blue Background */}
      <div className="bg-[#E8F4F6] px-6 pb-8 flex-shrink-0" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 2rem)' }}>
        {/* Main Headline */}
        <h1 className="text-[#2D3748] font-display font-bold text-3xl md:text-4xl text-center leading-tight mb-3">
          A 10-Minute Daily{'\n'}Faith Routine for Kids
        </h1>
        
        {/* Subtitle */}
        <p className="text-[#5A7A8A] text-center text-base mb-4">
          Stories, Videos, Games & More
        </p>
        
        {/* Social Proof */}
        <p className="text-[#5A7A8A] text-sm text-center mb-6">
          Over 1,000+ families use Godly Kids for daily faith lessons
        </p>
        
        {/* Start to Explore Button - Wood Theme */}
        <button
          onClick={handleStartExplore}
          className="w-full max-w-sm mx-auto block bg-gradient-to-b from-[#C4884A] via-[#A56B3A] to-[#8B5A2B] hover:from-[#D4975A] hover:via-[#B57A4A] hover:to-[#9B6A3B] text-white font-display font-bold text-lg py-4 px-8 rounded-full shadow-lg transition-all active:scale-[0.98] border-2 border-[#8B5A2B]"
          style={{
            boxShadow: '0 4px 0 #5C3D1E, 0 6px 12px rgba(0,0,0,0.2)'
          }}
        >
          Start to Explore
        </button>
        
        {/* Sign in link */}
        <button
          onClick={handleSignIn}
          className="w-full text-center text-[#8B5A2B] font-medium text-base mt-5 hover:underline active:opacity-70 transition-all"
        >
          Sign In
        </button>
      </div>
      
      {/* Account Creation Modal - shown after first lesson */}
      {showAccountModal && (
        <CreateAccountModal
          isOpen={true}
          navigateToOnboarding={false}
          onClose={() => {
            setShowAccountModal(false);
          }}
          onAccountCreated={() => {
            setShowAccountModal(false);
            // After creating account, go to explore page
            navigate('/home');
          }}
          onSignIn={() => {
            navigate('/signin', { state: { returnTo: '/home' } });
          }}
        />
      )}
    </div>
  );
};

export default LandingPage;
