import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityTrackingService } from '../services/activityTrackingService';
import { hasCompletedInterestSelection } from './InterestSelectionPage';

const STORAGE_KEY = 'godly_kids_data_v6';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

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

  const handleStartLesson = () => {
    activityTrackingService.trackOnboardingEvent('splash_explore_clicked');
    if (hasCompletedInterestSelection()) {
      navigate('/home');
    } else {
      navigate('/interests');
    }
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
        
        {/* Gradient fade to white at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/90 to-transparent" />
        
        {/* Wavy edge transition */}
        <svg 
          className="absolute bottom-0 left-0 right-0 w-full" 
          viewBox="0 0 1440 120" 
          preserveAspectRatio="none"
          style={{ height: '60px' }}
        >
          <path 
            d="M0,60 C360,120 1080,0 1440,60 L1440,120 L0,120 Z" 
            fill="white"
          />
        </svg>
      </div>
      
      {/* Content Section - White Background */}
      <div className="bg-white px-6 pb-8 flex-shrink-0" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 2rem)' }}>
        {/* Main Headline */}
        <h1 className="text-[#2D3748] font-display font-bold text-3xl md:text-4xl text-center leading-tight mb-3">
          A 10-Minute Daily{'\n'}Faith Routine for Kids
        </h1>
        
        {/* Subtitle */}
        <p className="text-[#718096] text-center text-base mb-6">
          Today's Lesson – 10 minutes
        </p>
        
        {/* Start Lesson Button */}
        <button
          onClick={handleStartLesson}
          className="w-full max-w-sm mx-auto block bg-[#3D8B8B] hover:bg-[#357878] text-white font-semibold text-lg py-4 px-8 rounded-full shadow-lg transition-all active:scale-[0.98]"
        >
          Start Lesson
        </button>
        
        {/* No clutter text */}
        <p className="text-[#A0AEC0] text-center text-sm mt-4">
          No clutter
        </p>
        
        {/* Sign in link */}
        <button
          onClick={handleSignIn}
          className="w-full text-center text-[#3D8B8B] text-sm mt-4 hover:underline"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
