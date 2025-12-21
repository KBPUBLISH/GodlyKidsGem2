import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Check, X } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useLanguage } from '../context/LanguageContext';

const STORAGE_KEY = 'godly_kids_data_v6';
const TERMS_URL = 'https://www.godlykids.com/end-user-license-agreement';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { currentLanguage, setLanguage, supportedLanguages, t } = useLanguage();

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
    <div className="relative h-full w-full overflow-hidden">
      {/* 
        NOTE: Background (Sky, Stars, Sunrise) is now handled globally in App.tsx > PanoramaBackground
        to support the swipe navigation effect.
      */}

      {/* Ship Image - FULL PAGE background */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <img 
          src="/assets/images/ship.jpg" 
          alt="" 
          className="w-full h-full object-cover"
          style={{
            objectPosition: 'center 40%', // Focus on ship
          }}
        />
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

      {/* --- OCEAN / UI SECTION --- */}
      <div className="absolute bottom-0 left-0 right-0 h-[50%] z-20">
          {/* Bubble Particles - Keep visible */}
          <div className="absolute bottom-10 left-10 w-4 h-4 rounded-full bg-white/20 animate-[bounce_3s_infinite] z-30"></div>
          <div className="absolute bottom-20 right-20 w-6 h-6 rounded-full bg-white/10 animate-[bounce_5s_infinite] z-30"></div>

          {/* Content Container - Completely transparent background */}
          <div className="absolute inset-0 top-2 flex flex-col items-center px-8 pt-4">
              
              {/* App Title (Styled to look integrated) */}
              <div className="relative mb-8 text-center z-10">
                 <h1 className="font-display font-extrabold text-4xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.2)] tracking-wider">
                    GODLY KIDS
                 </h1>
                 <p className="text-blue-100 font-sans font-bold text-sm mt-1 opacity-90">
                    {t('adventureAwaits')}
                 </p>
              </div>

              {/* Sign In and Guest Buttons */}
              <div className="w-full max-w-sm space-y-3 relative z-10">
                  <WoodButton 
                    onClick={() => navigate('/signin')}
                    fullWidth 
                    variant="primary"
                    className="py-4 text-lg"
                  >
                    {t('signIn')}
                  </WoodButton>

                  <button
                    onClick={() => navigate('/onboarding')}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-4 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    {t('continue')}
                  </button>

                  <p className="text-center text-white/60 text-xs mt-4">
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