import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Crown, Sparkles, ShoppingBag, Coins, FileText, X, ChevronRight } from 'lucide-react';

/**
 * DemoTimer Component
 * 
 * Shows a visible countdown timer during the 5-minute demo period.
 * Includes animated welcome modal and feature tutorial highlights.
 * When timer expires, redirects user back to onboarding paywall.
 */

// Tutorial steps data
const TUTORIAL_STEPS = [
  {
    id: 'coins',
    title: '💰 Your Gold Coins',
    description: 'Earn gold by completing quizzes, devotions, and books! Spend them in the shop.',
    position: 'coins', // Reference to element position
    icon: Coins,
  },
  {
    id: 'report',
    title: '📊 Report Card',
    description: 'Track your child\'s progress! See completed activities, streaks, and achievements.',
    position: 'report',
    icon: FileText,
  },
  {
    id: 'shop',
    title: '🛍️ The Shop',
    description: 'Customize your avatar with new body parts, unlock voices, and discover more!',
    position: 'shop',
    icon: ShoppingBag,
  },
];

const DemoTimer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  
  // Welcome modal and tutorial state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(-1); // -1 = not started, 0-2 = steps
  const [tutorialComplete, setTutorialComplete] = useState(false);

  useEffect(() => {
    // Check if this is a fresh demo start and user has completed initial welcome flow
    const checkDemoStart = () => {
      const demoActive = localStorage.getItem('godlykids_demo_active');
      const demoWelcomeShown = sessionStorage.getItem('godlykids_demo_welcome_shown');
      const isPremium = localStorage.getItem('godlykids_premium') === 'true';
      
      // Check if user has completed the initial welcome/book selection flow
      const welcomeSeenBefore = localStorage.getItem('godlykids_welcome_seen') === 'true';
      
      // Track if user has visited content (book/playlist/lesson) during this demo
      const hasVisitedContent = sessionStorage.getItem('godlykids_demo_visited_content') === 'true';
      
      // Show welcome modal only if:
      // 1. Demo is active
      // 2. We haven't shown demo welcome this session
      // 3. Not premium
      // 4. On home page
      // 5. User has seen the initial welcome page AND has visited content (returned from book)
      if (demoActive === 'true' && 
          !demoWelcomeShown && 
          !isPremium && 
          location.pathname === '/home' &&
          welcomeSeenBefore &&
          hasVisitedContent) {
        setShowWelcomeModal(true);
        sessionStorage.setItem('godlykids_demo_welcome_shown', 'true');
      }
    };
    
    // Check after a short delay to let the page render
    const timeout = setTimeout(checkDemoStart, 500);
    return () => clearTimeout(timeout);
  }, [location.pathname]);
  
  // Track when user visits content pages (books, playlists, lessons)
  useEffect(() => {
    const demoActive = localStorage.getItem('godlykids_demo_active');
    if (demoActive === 'true') {
      // Check if current path is a content page
      const isContentPage = 
        location.pathname.startsWith('/book/') ||
        location.pathname.startsWith('/read/') ||
        location.pathname.startsWith('/audio/playlist/') ||
        location.pathname.startsWith('/lesson/');
      
      if (isContentPage) {
        sessionStorage.setItem('godlykids_demo_visited_content', 'true');
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    // Check if demo mode is active
    const checkDemoStatus = () => {
      const demoActive = localStorage.getItem('godlykids_demo_active');
      const demoEndTimeStr = localStorage.getItem('godlykids_demo_end_time');
      const isPremium = localStorage.getItem('godlykids_premium') === 'true';
      
      // Don't show timer if premium or not in demo mode
      if (isPremium || demoActive !== 'true' || !demoEndTimeStr) {
        setIsVisible(false);
        return;
      }
      
      const demoEndTime = parseInt(demoEndTimeStr, 10);
      const remaining = demoEndTime - Date.now();
      
      if (remaining <= 0) {
        handleDemoExpired();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
        setIsVisible(true);
      }
    };

    // Initial check
    checkDemoStatus();

    // Update every second
    const interval = setInterval(() => {
      const demoEndTimeStr = localStorage.getItem('godlykids_demo_end_time');
      const demoActive = localStorage.getItem('godlykids_demo_active');
      
      if (demoActive !== 'true' || !demoEndTimeStr) {
        setIsVisible(false);
        return;
      }
      
      const demoEndTime = parseInt(demoEndTimeStr, 10);
      const remaining = demoEndTime - Date.now();
      
      if (remaining <= 0) {
        handleDemoExpired();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDemoExpired = () => {
    localStorage.setItem('godlykids_demo_used', 'true');
    localStorage.removeItem('godlykids_demo_active');
    localStorage.removeItem('godlykids_demo_end_time');
    
    setIsExpired(true);
    setIsVisible(true);
    
    // Redirect to onboarding step 1 (not paywall)
    setTimeout(() => {
      navigate('/onboarding');
    }, 2000);
  };

  const handleSubscribeClick = () => {
    localStorage.setItem('godlykids_demo_used', 'true');
    localStorage.removeItem('godlykids_demo_active');
    localStorage.removeItem('godlykids_demo_end_time');
    // Redirect to onboarding step 1
    navigate('/onboarding');
  };

  const handleStartTutorial = () => {
    setIsMinimizing(true);
    // Wait for minimize animation, then start tutorial
    setTimeout(() => {
      setShowWelcomeModal(false);
      setIsMinimizing(false);
      setCurrentTutorialStep(0);
    }, 600);
  };

  const handleSkipTutorial = () => {
    setIsMinimizing(true);
    setTimeout(() => {
      setShowWelcomeModal(false);
      setIsMinimizing(false);
      setTutorialComplete(true);
      sessionStorage.setItem('godlykids_demo_tutorial_complete', 'true');
    }, 600);
  };

  const handleNextTutorialStep = () => {
    if (currentTutorialStep < TUTORIAL_STEPS.length - 1) {
      setCurrentTutorialStep(prev => prev + 1);
    } else {
      // Tutorial complete
      setCurrentTutorialStep(-1);
      setTutorialComplete(true);
      sessionStorage.setItem('godlykids_demo_tutorial_complete', 'true');
    }
  };

  const handleSkipAllTutorial = () => {
    setCurrentTutorialStep(-1);
    setTutorialComplete(true);
    sessionStorage.setItem('godlykids_demo_tutorial_complete', 'true');
  };

  // Don't show on onboarding page, landing, or welcome page
  if (location.pathname === '/onboarding' || location.pathname === '/' || location.pathname === '/welcome') {
    return null;
  }

  // Format time as M:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine urgency color
  const getTimerColor = () => {
    if (isExpired) return 'from-red-500 to-red-600';
    if (timeLeft && timeLeft <= 60) return 'from-red-500 to-orange-500';
    if (timeLeft && timeLeft <= 120) return 'from-orange-500 to-yellow-500';
    return 'from-[#7c4dff] to-[#536dfe]';
  };

  // Get tutorial highlight style (using inline styles for precise positioning)
  // Header buttons are: Coins (rightmost-3rd) | Report (rightmost-2nd) | Shop (rightmost)
  // Accounting for safe area inset on iPhone (env safe-area-inset-top)
  const getHighlightStyle = (position: string): React.CSSProperties => {
    // Base top position: safe-area + header padding (~52px on iPhone with notch, ~36px without)
    // Using a value that works for most devices
    const baseTop = 'calc(env(safe-area-inset-top, 0px) + 28px)';
    
    switch (position) {
      case 'coins':
        // Gold coins button - 3rd from right
        return { top: baseTop, right: '106px' };
      case 'report':
        // Report card button - 2nd from right  
        return { top: baseTop, right: '58px' };
      case 'shop':
        // Shop button - rightmost
        return { top: baseTop, right: '12px' };
      default:
        return { top: baseTop, right: '12px' };
    }
  };

  // Get tooltip position
  const getTooltipStyle = (position: string): React.CSSProperties => {
    const baseTop = 'calc(env(safe-area-inset-top, 0px) + 90px)';
    
    switch (position) {
      case 'coins':
        return { top: baseTop, right: '16px', left: '16px' };
      case 'report':
        return { top: baseTop, right: '16px', left: '16px' };
      case 'shop':
        return { top: baseTop, right: '16px', left: '16px' };
      default:
        return { top: baseTop, right: '16px', left: '16px' };
    }
  };

  // Tutorial highlight overlay
  const renderTutorialHighlight = () => {
    if (currentTutorialStep < 0 || currentTutorialStep >= TUTORIAL_STEPS.length) return null;
    
    const step = TUTORIAL_STEPS[currentTutorialStep];
    const Icon = step.icon;
    
    return (
      <>
        {/* Dark overlay with hole */}
        <div className="fixed inset-0 z-[200] pointer-events-auto">
          {/* Semi-transparent overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={handleSkipAllTutorial} />
          
          {/* Highlight ring around the target element */}
          <div 
            className="absolute w-12 h-12 pointer-events-none"
            style={getHighlightStyle(step.position)}
          >
            {/* Pulsing ring */}
            <div className="absolute inset-[-4px] rounded-xl border-4 border-[#FFD700] animate-ping opacity-50" />
            <div className="absolute inset-[-4px] rounded-xl border-4 border-[#FFD700] animate-pulse" />
            {/* Clear hole in overlay */}
            <div className="absolute inset-0 bg-transparent rounded-lg" />
          </div>
        </div>
        
        {/* Tutorial tooltip card */}
        <div 
          className="fixed z-[201] max-w-sm animate-in slide-in-from-top-4 duration-300"
          style={getTooltipStyle(step.position)}
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#FFD700] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#3E1F07] font-bold text-lg">{step.title}</h3>
              </div>
              <button 
                onClick={handleSkipAllTutorial}
                className="text-[#3E1F07]/50 hover:text-[#3E1F07]"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <p className="text-gray-600 text-sm mb-4">{step.description}</p>
              
              {/* Progress dots */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {TUTORIAL_STEPS.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === currentTutorialStep ? 'bg-[#FFD700]' : 
                        idx < currentTutorialStep ? 'bg-[#FFD700]/50' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                
                <button
                  onClick={handleNextTutorialStep}
                  className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold px-4 py-2 rounded-xl flex items-center gap-1 hover:opacity-90 transition-opacity"
                >
                  {currentTutorialStep < TUTORIAL_STEPS.length - 1 ? (
                    <>Next <ChevronRight size={18} /></>
                  ) : (
                    <>Got it! <Sparkles size={18} /></>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Arrow pointing up */}
          <div className="absolute -top-2 right-8 w-4 h-4 bg-[#FFD700] rotate-45 border-l-2 border-t-2 border-[#FFD700]" />
        </div>
      </>
    );
  };

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Demo Time's Up! ⏱️
          </h2>
          <p className="text-gray-600 mb-6">
            Your 5-minute demo has ended. Subscribe now to continue your child's faith journey!
          </p>
          <button
            onClick={handleSubscribeClick}
            className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold py-4 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <Crown className="w-5 h-5" />
            Unlock Full Access
          </button>
          <p className="text-gray-400 text-xs mt-3">
            14-day free trial • Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Welcome Modal with minimize animation */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            className={`bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full transition-all duration-500 ${
              isMinimizing 
                ? 'scale-0 opacity-0 translate-x-[calc(50vw-3rem)] -translate-y-[calc(50vh-4rem)]' 
                : 'scale-100 opacity-100 animate-in zoom-in-95'
            }`}
          >
            {/* Animated Header */}
            <div className="bg-gradient-to-br from-[#7c4dff] via-[#536dfe] to-[#448aff] p-6 text-center relative overflow-hidden">
              {/* Floating sparkles */}
              <div className="absolute top-2 left-4 animate-bounce" style={{ animationDelay: '0ms' }}>✨</div>
              <div className="absolute top-4 right-6 animate-bounce" style={{ animationDelay: '200ms' }}>⭐</div>
              <div className="absolute bottom-2 left-8 animate-bounce" style={{ animationDelay: '400ms' }}>🌟</div>
              <div className="absolute bottom-4 right-4 animate-bounce" style={{ animationDelay: '100ms' }}>✨</div>
              
              {/* Timer icon with pulse */}
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" />
                <Clock className="w-10 h-10 text-white relative z-10" />
              </div>
              
              <h2 className="text-white font-bold text-2xl mb-1">
                🎉 Demo Mode Active!
              </h2>
              <p className="text-white/80 text-sm">
                You have <span className="font-bold text-[#FFD700]">5 minutes</span> to explore
              </p>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-gray-600 text-center mb-6">
                Let's take a quick tour of the app's best features!
              </p>
              
              {/* Feature preview */}
              <div className="space-y-3 mb-6">
                {TUTORIAL_STEPS.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-gray-800 font-semibold text-sm">{step.title}</h4>
                    </div>
                    <span className="text-gray-400 text-xs">{idx + 1}/3</span>
                  </div>
                ))}
              </div>
              
              {/* Buttons */}
              <button
                onClick={handleStartTutorial}
                className="w-full bg-gradient-to-r from-[#7c4dff] to-[#536dfe] text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 mb-3 hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-5 h-5" />
                Start Quick Tour
              </button>
              
              <button
                onClick={handleSkipTutorial}
                className="w-full text-gray-500 font-medium py-2 hover:text-gray-700 transition-colors"
              >
                Skip tour, start exploring →
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Tutorial highlights */}
      {currentTutorialStep >= 0 && renderTutorialHighlight()}
      
      {/* Floating timer badge - always visible during demo (in header area) */}
      {isVisible && !showWelcomeModal && currentTutorialStep < 0 && (
        <button
          onClick={handleSubscribeClick}
          className={`fixed z-[100] bg-gradient-to-r ${getTimerColor()} text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border-2 border-white/30`}
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <Clock className="w-4 h-4" />
          <span className="font-bold text-sm">
            {formatTime(timeLeft || 0)}
          </span>
          {timeLeft && timeLeft <= 60 && (
            <span className="animate-pulse">⚡</span>
          )}
        </button>
      )}
    </>
  );
};

export default DemoTimer;
