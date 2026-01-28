import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityTrackingService } from '../services/activityTrackingService';

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
    activityTrackingService.trackOnboardingEvent('splash_start_lesson_clicked');
    // Go directly to daily session for the "10-minute daily routine" flow
    navigate('/daily-session', { state: { freshStart: true } });
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
        
        {/* Ocean wave overlay */}
        <div className="absolute bottom-0 left-0 right-0">
          {/* Gradient fade */}
          <div className="h-24 bg-gradient-to-t from-[#E8F4F6] to-transparent" />
          
          {/* Multiple wave layers for depth */}
          <svg 
            className="absolute bottom-0 left-0 right-0 w-full" 
            viewBox="0 0 1440 180" 
            preserveAspectRatio="none"
            style={{ height: '90px' }}
          >
            {/* Back wave - lighter */}
            <path 
              d="M0,100 C120,120 240,80 360,100 C480,120 600,80 720,100 C840,120 960,80 1080,100 C1200,120 1320,80 1440,100 L1440,180 L0,180 Z" 
              fill="#B8D4E3"
              opacity="0.6"
            />
            {/* Middle wave */}
            <path 
              d="M0,120 C180,150 360,100 540,130 C720,160 900,110 1080,140 C1200,160 1320,120 1440,140 L1440,180 L0,180 Z" 
              fill="#9CC5D8"
              opacity="0.7"
            />
            {/* Front wave - main */}
            <path 
              d="M0,140 C240,170 480,130 720,155 C960,180 1200,140 1440,160 L1440,180 L0,180 Z" 
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
        <p className="text-[#5A7A8A] text-center text-base mb-6">
          Today's Lesson – 10 minutes
        </p>
        
        {/* Start Lesson Button - Wood Theme */}
        <button
          onClick={handleStartLesson}
          className="w-full max-w-sm mx-auto block bg-gradient-to-b from-[#C4884A] via-[#A56B3A] to-[#8B5A2B] hover:from-[#D4975A] hover:via-[#B57A4A] hover:to-[#9B6A3B] text-white font-display font-bold text-lg py-4 px-8 rounded-full shadow-lg transition-all active:scale-[0.98] border-2 border-[#8B5A2B]"
          style={{
            boxShadow: '0 4px 0 #5C3D1E, 0 6px 12px rgba(0,0,0,0.2)'
          }}
        >
          Start Lesson
        </button>
        
        {/* Sign in link */}
        <button
          onClick={handleSignIn}
          className="w-full text-center text-[#8B5A2B] font-medium text-base mt-5 hover:underline active:opacity-70 transition-all"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
