import React, { useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import TutorialSpotlight from './TutorialSpotlight';
import { useTutorial, TutorialStep } from '../../context/TutorialContext';
import { Heart, Coins, Hand } from 'lucide-react';
import WoodButton from '../ui/WoodButton';
import { DespiaService } from '../../services/despiaService';
import CreateAccountModal from '../modals/CreateAccountModal';

// Check if user has an account (auth token or email stored)
const checkHasAccount = (): boolean => {
  const token = localStorage.getItem('godlykids_auth_token');
  const email = localStorage.getItem('godlykids_user_email');
  return !!(token || email);
};

// Custom popup content for specific steps
const GivePopupContent: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="text-center">
    <div className="mb-4">
      <Heart className="w-16 h-16 text-red-400 mx-auto animate-pulse" />
    </div>
    <h3 className="text-[#FFD700] font-display font-bold text-xl mb-2">
      Practice Generosity
    </h3>
    <p className="text-white/90 text-sm leading-relaxed mb-4">
      Your child's progress makes a real world impact. Every coin donated helps support children's ministries around the world.
    </p>
    <WoodButton variant="gold" onClick={onNext} className="w-full py-3">
      Let's Practice Giving!
    </WoodButton>
  </div>
);

const DonationPracticeContent: React.FC<{ 
  donatedAmount: number;
  onDonate: (amount: number) => void;
  onComplete: () => void;
}> = ({ donatedAmount, onDonate, onComplete }) => (
  <div className="text-center">
    <div className="mb-4 flex items-center justify-center gap-2">
      <Coins className="w-8 h-8 text-[#FFD700]" />
      <span className="text-2xl font-display font-bold text-[#FFD700]">
        {donatedAmount} / 10
      </span>
    </div>
    <p className="text-white/90 text-sm mb-4">
      Tap to donate coins and see generosity in action!
    </p>
    <div className="flex gap-2 justify-center mb-4">
      {[1, 5, 10 - donatedAmount].filter(v => v > 0).map((amount) => (
        <button
          key={amount}
          onClick={() => onDonate(amount)}
          disabled={donatedAmount >= 10}
          className="px-4 py-2 bg-[#FFD700] text-[#3E1F07] font-bold rounded-lg hover:bg-[#FFA500] transition-colors disabled:opacity-50"
        >
          +{amount}
        </button>
      ))}
    </div>
    {donatedAmount >= 10 && (
      <WoodButton variant="gold" onClick={onComplete} className="w-full py-3 animate-pulse">
        Amazing! Continue →
      </WoodButton>
    )}
  </div>
);

// Swipe hint content - just finger and text, positioned over image area
const SwipeHintContent: React.FC = () => (
  <div className="flex flex-col items-center">
    <p className="text-[#FFD700] font-bold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2">Swipe to Read</p>
    <span className="text-5xl animate-swipe-finger drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">👆</span>
    
    <style>{`
      @keyframes swipe-finger {
        0%, 100% { 
          transform: translateX(30px) rotate(15deg); 
          opacity: 0.9; 
        }
        50% { 
          transform: translateX(-30px) rotate(-15deg); 
          opacity: 1; 
        }
      }
      .animate-swipe-finger {
        animation: swipe-finger 1.2s ease-in-out infinite;
      }
    `}</style>
  </div>
);

// Tutorial complete content with confetti
const TutorialCompleteContent: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="text-center relative">
    {/* Confetti Animation */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-20px',
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#3498DB'][Math.floor(Math.random() * 5)],
            width: '10px',
            height: '10px',
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
    
    <div className="mb-4">
      <span className="text-6xl">🎉</span>
    </div>
    <h3 className="text-[#FFD700] font-display font-bold text-2xl mb-2">
      You Did It!
    </h3>
    <p className="text-white/90 text-sm leading-relaxed mb-4">
      You've completed the tutorial! You're ready to start your faith adventure.
    </p>
    <WoodButton variant="gold" onClick={onNext} className="w-full py-3 animate-pulse">
      Continue →
    </WoodButton>
    <style>{`
      @keyframes confetti {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
      }
      .animate-confetti {
        animation: confetti 3s ease-out forwards;
      }
    `}</style>
  </div>
);

// Book controls intro - shows key reader controls with tap animation
const BookControlsIntroContent: React.FC = () => (
  <div className="text-center">
    <h3 className="text-[#FFD700] font-display font-bold text-lg mb-3">
      📖 Reader Controls
    </h3>
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-3 bg-white/10 rounded-lg p-2">
        <span className="text-2xl">▶️</span>
        <div>
          <p className="text-white font-semibold text-sm">Play Button</p>
          <p className="text-white/70 text-xs">Tap to hear the story read aloud</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-white/10 rounded-lg p-2">
        <span className="text-2xl">🌐</span>
        <div>
          <p className="text-white font-semibold text-sm">Language</p>
          <p className="text-white/70 text-xs">Change the reading language</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-[#FFD700]/20 border border-[#FFD700]/50 rounded-lg p-2 relative">
        <span className="text-2xl">📏</span>
        <div>
          <p className="text-white font-semibold text-sm">Tap Page</p>
          <p className="text-white/70 text-xs">Adjust text position on screen</p>
        </div>
        {/* Animated tap finger */}
        <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-3xl animate-tap-bounce">👆</span>
      </div>
    <style>{`
      @keyframes tap-bounce {
        0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.7; }
        50% { transform: translateY(-50%) scale(0.85); opacity: 1; }
      }
      .animate-tap-bounce {
        animation: tap-bounce 0.8s ease-in-out infinite;
      }
    `}</style>
    </div>
    <p className="text-white/60 text-xs mt-3">Starting in a moment...</p>
  </div>
);

const OnboardingTutorial: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentStep,
    isTutorialActive,
    isStepActive,
    startTutorial,
    nextStep,
    goToStep,
    completeTutorial,
    getStepConfig,
    donatedCoins,
    setDonatedCoins,
    showAccountCreation,
    setShowAccountCreation,
    onAccountCreated,
  } = useTutorial();
  
  // State to hide swipe hint after timeout
  const [hideSwipeHint, setHideSwipeHint] = useState(false);
  
  // Hide swipe hint popup after 5 seconds (only for book_swipe_intro)
  useEffect(() => {
    if (currentStep === 'book_swipe_intro') {
      setHideSwipeHint(false); // Reset when entering swipe intro
      const timer = setTimeout(() => {
        setHideSwipeHint(true);
      }, 5000); // Hide after 5 seconds
      return () => clearTimeout(timer);
    } else {
      setHideSwipeHint(false); // Reset for other steps
    }
  }, [currentStep]);

  // Start tutorial if coming from ReadyToJumpInPage
  useEffect(() => {
    const state = location.state as { startTutorial?: boolean } | null;
    if (state?.startTutorial) {
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
      // Small delay to let the page render
      setTimeout(() => {
        startTutorial();
      }, 500);
    }
  }, [location.state, startTutorial]);

  // Handle wheel navigation steps - must be before any conditional returns!
  useEffect(() => {
    if (currentStep === 'navigate_to_give') {
      window.dispatchEvent(new CustomEvent('tutorial_navigate_wheel', { detail: { target: 'give' } }));
    } else if (currentStep === 'navigate_to_explore') {
      window.dispatchEvent(new CustomEvent('tutorial_navigate_wheel', { detail: { target: 'explore' } }));
    } else if (currentStep === 'navigate_to_books') {
      window.dispatchEvent(new CustomEvent('tutorial_navigate_wheel', { detail: { target: 'read' } }));
    } else if (currentStep === 'navigate_to_audio') {
      window.dispatchEvent(new CustomEvent('tutorial_navigate_wheel', { detail: { target: 'listen' } }));
    }
  }, [currentStep]);

  // Handle donation
  const handleDonate = (amount: number) => {
    const newTotal = Math.min(donatedCoins + amount, 10);
    setDonatedCoins(newTotal);
  };

  // Track when quiz button is available (for book_end_quiz step)
  const [quizButtonReady, setQuizButtonReady] = useState(false);
  
  useEffect(() => {
    if (currentStep !== 'book_end_quiz') {
      setQuizButtonReady(false);
      return;
    }
    
    // Poll for quiz button to appear (after page jump to The End)
    const checkForQuizButton = () => {
      const quizButton = document.getElementById('quiz-button') || document.querySelector('[data-tutorial="quiz-button"]');
      if (quizButton) {
        setQuizButtonReady(true);
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (checkForQuizButton()) return;
    
    // Poll every 100ms for up to 3 seconds
    const interval = setInterval(() => {
      if (checkForQuizButton()) {
        clearInterval(interval);
      }
    }, 100);
    
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 3000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentStep]);

  if (!isTutorialActive) return null;

  // Don't show tutorial overlay on these pages - allow full interaction
  const currentPath = location.pathname;
  const excludedPaths = ['/settings', '/paywall', '/profile', '/create-profile', '/edit-profile', '/onboarding', '/ready'];
  if (excludedPaths.includes(currentPath)) {
    return null;
  }

  // Validate tutorial step matches current page to prevent mismatched states
  const isOnWelcomePage = currentPath === '/welcome';
  const isOnBookReader = currentPath.startsWith('/read/');
  const isOnHomePage = currentPath === '/home';
  const isOnGivePage = currentPath === '/giving';

  // Book-related steps should only show on book reader
  const bookSteps: TutorialStep[] = ['book_controls_intro', 'book_swipe_intro', 'book_swipe_1', 'book_swipe_2', 'book_swipe_3', 'book_end_quiz', 'quiz_in_progress'];
  if (bookSteps.includes(currentStep) && !isOnBookReader) {
    return null; // Don't show book tutorial steps on wrong page
  }

  // Welcome step should only show on welcome page
  if (currentStep === 'welcome_book_tap' && !isOnWelcomePage) {
    return null;
  }

  // Home-based steps (coins, report card, shop) should only show on home page
  const homeSteps: TutorialStep[] = ['coins_highlight', 'coins_popup_open', 'report_card_highlight', 'report_card_open', 'shop_highlight', 'shop_open', 'devotional_highlight'];
  if (homeSteps.includes(currentStep) && !isOnHomePage) {
    return null;
  }

  // Give-related steps should only show on give page
  const giveSteps: TutorialStep[] = ['campaign_highlight', 'give_button_highlight', 'donation_complete'];
  if (giveSteps.includes(currentStep) && !isOnGivePage) {
    return null;
  }
  
  // Listen page steps (including review which shows when returning from audio detail)
  const listenSteps: TutorialStep[] = ['audiobook_highlight', 'review_prompt'];
  if (listenSteps.includes(currentStep) && currentPath !== '/listen') {
    return null;
  }
  
  // Tutorial complete should only show on explore/home page
  if (currentStep === 'tutorial_complete' && !isOnHomePage) {
    return null;
  }

  const config = getStepConfig();

  // Render appropriate spotlight based on current step
  const renderSpotlight = () => {
    switch (currentStep) {
      // STEP 1: On welcome page, let user choose any book
      case 'welcome_book_tap':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="bottom-screen"
            requiresElementClick={false}
            hideOverlay={true}
            compactPopup={true}
          />
        );

      // STEP 2: Quick controls intro in book reader
      case 'book_controls_intro':
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
            hideOverlay={true}
            customContent={<BookControlsIntroContent />}
          />
        );

      // STEP 3: Book swipe intro hint - shown on first page
      // Hide after 5 seconds to not obstruct the reading experience
      // Persistent "Skip to Quiz" button is shown separately at bottom of screen
      case 'book_swipe_intro':
        if (hideSwipeHint) {
          return null; // Hide the swipe hint after 5 seconds
        }
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
            hideOverlay={true}
            customContent={<SwipeHintContent />}
          />
        );

      // STEP 4-6: Subsequent swipes - no popup, just track progress silently
      case 'book_swipe_1':
      case 'book_swipe_2':
      case 'book_swipe_3':
        return null; // No visual hint on subsequent swipes

      // STEP 6: End modal with quiz button highlighted
      // Only show when the quiz-button element exists (user is on The End page)
      case 'book_end_quiz':
        // Wait for quiz button to be ready (page jumped to The End)
        if (!quizButtonReady) {
          return null;
        }
        return (
          <TutorialSpotlight
            targetElement="quiz-button"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="bottom"
            popupPosition="bottom-screen"
            compactPopup={true}
            requiresElementClick={true}
          />
        );

      // STEP 7: Quiz in progress (no overlay, just wait)
      case 'quiz_in_progress':
        return null; // Let user complete quiz without overlay

      // STEP 8: After quiz - coins highlight
      case 'coins_highlight':
        return (
          <TutorialSpotlight
            targetElement="coins-button"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="bottom"
            popupPosition="bottom"
            requiresElementClick={true}
          />
        );

      case 'coins_popup_open':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            onNext={nextStep}
            popupPosition="bottom-screen"
            requiresElementClick={false}
            compactPopup={true}
            showContinueButton={true}
            hideOverlay={true}
          />
        );

      case 'report_card_highlight':
        return (
          <TutorialSpotlight
            targetElement="report-card-button"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="bottom"
            popupPosition="bottom"
            requiresElementClick={true}
          />
        );

      case 'report_card_open':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            onNext={nextStep}
            popupPosition="bottom-screen"
            requiresElementClick={false}
            compactPopup={true}
            showContinueButton={true}
            hideOverlay={true}
          />
        );

      case 'shop_highlight':
        return (
          <TutorialSpotlight
            targetElement="shop-button"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="bottom"
            popupPosition="bottom"
            requiresElementClick={true}
          />
        );

      case 'shop_open':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            onNext={nextStep}
            popupPosition="bottom-screen"
            requiresElementClick={false}
            compactPopup={true}
            showContinueButton={true}
            hideOverlay={true}
          />
        );

      case 'navigate_to_give':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
          />
        );

      case 'campaign_highlight':
        return (
          <TutorialSpotlight
            targetElement="give-button-0"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="top"
            popupPosition="top"
            requiresElementClick={true}
          />
        );

      case 'give_button_highlight':
        // Target the donate button in the donation modal
        return (
          <TutorialSpotlight
            targetElement="donate-coins-button"
            title="Tap to Donate!"
            description="Tap to give your coins and help people in need!"
            isVisible={true}
            fingerPosition="top"
            popupPosition="top-screen"
            compactPopup={true}
            requiresElementClick={true}
          />
        );

      case 'donation_complete':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="top-screen"
            requiresElementClick={false}
            hideOverlay={true}
            compactPopup={true}
          />
        );

      case 'navigate_to_explore':
      case 'navigate_to_books':
      case 'navigate_to_audio':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
          />
        );

      case 'devotional_highlight':
        return (
          <TutorialSpotlight
            targetElement="devotional-section"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="right"
            popupPosition="bottom"
            requiresElementClick={false}
            hideOverlay={true}
          />
        );

      case 'audiobook_highlight':
        return (
          <TutorialSpotlight
            targetElement="audiobook-card-0"
            title={config.title}
            description={config.description}
            isVisible={true}
            fingerPosition="left"
            popupPosition="bottom-screen"
            compactPopup={true}
            requiresElementClick={true}
          />
        );

      case 'tutorial_complete':
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
            hideOverlay={true}
            customContent={<TutorialCompleteContent onNext={nextStep} />}
          />
        );

      case 'review_prompt':
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            customContent={
              <ReviewPromptContent onNext={() => {
                nextStep(); // Advance to tutorial_complete
                navigate('/home'); // Navigate to explore page
              }} />
            }
            requiresElementClick={false}
          />
        );

      case 'explore_pause':
        // No popup - let user explore freely for 10 seconds
        return null;

      case 'paywall':
        // NEW FLOW: Check if user has account first
        // If no account, show account creation modal
        // After account creation, continue to onboarding flow
        setTimeout(() => {
          if (!checkHasAccount()) {
            // Show account creation modal
            setShowAccountCreation(true);
          } else {
            // User has account, go to onboarding to continue setup (add kids, etc.)
            completeTutorial();
            navigate('/onboarding', { state: { fromTutorial: true, skipAccountStep: true } });
          }
        }, 100);
        return null;

      default:
        return null;
    }
  };

  // Determine if we should show the persistent Skip to Quiz button
  // Show during book reading steps (except when already at quiz or taking quiz)
  const bookReadingSteps: TutorialStep[] = ['book_controls_intro', 'book_swipe_intro', 'book_swipe_1', 'book_swipe_2', 'book_swipe_3'];
  const showSkipToQuizButton = isOnBookReader && bookReadingSteps.includes(currentStep);

  return (
    <>
      {renderSpotlight()}
      
      {/* Persistent Skip to Quiz button - top right corner, separate from swipe hint */}
      {showSkipToQuizButton && (
        <div 
          className="fixed right-4 z-[200] animate-in fade-in slide-in-from-right-4 duration-300"
          style={{ top: 'calc(var(--safe-area-top, 0px) + 16px)' }}
        >
          <button
            onClick={() => goToStep('book_end_quiz')}
            className="px-4 py-2 bg-[#FFD700] text-[#3E1F07] font-bold rounded-full shadow-lg hover:bg-[#FFC107] active:scale-95 transition-all flex items-center gap-2 border-2 border-[#B8860B]"
          >
            <span>Skip to Quiz</span>
            <span>→</span>
          </button>
        </div>
      )}
      
      {/* Account Creation Modal - shown after tutorial when user doesn't have account */}
      <CreateAccountModal
        isOpen={showAccountCreation}
        onClose={() => {
          setShowAccountCreation(false);
          // If they close without creating account, still go to onboarding
          // They can create account there
          completeTutorial();
          navigate('/onboarding', { state: { fromTutorial: true } });
        }}
        onAccountCreated={() => {
          onAccountCreated();
          // Navigate to onboarding to continue with kid setup, etc.
          navigate('/onboarding', { state: { fromTutorial: true, skipAccountStep: true } });
        }}
        onSignIn={() => {
          setShowAccountCreation(false);
          completeTutorial();
          navigate('/signin', { state: { returnTo: '/onboarding' } });
        }}
      />
    </>
  );
};

// Review prompt content - triggers native review dialog
const ReviewPromptContent: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLeaveReview = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('🌟 Tutorial review button clicked');
      
      // Check if we're in DeSpia native app
      if (DespiaService.isNative()) {
        console.log('🌟 DeSpia native detected, requesting review...');
        DespiaService.requestReview();
      } else if (Capacitor.isNativePlatform()) {
        // Capacitor native app
        try {
          const { RateApp } = await import('capacitor-rate-app');
          console.log('🌟 RateApp plugin loaded, requesting review...');
          await RateApp.requestReview();
        } catch (e) {
          console.log('🌟 RateApp plugin not available:', e);
          // Try webkit for iOS
          if ((window as any).webkit?.messageHandlers?.requestReview) {
            (window as any).webkit.messageHandlers.requestReview.postMessage({});
          }
        }
      } else {
        console.log('🌟 Web mode - no native review API');
      }
      
      // Mark review as prompted
      localStorage.setItem('godlykids_review_prompted', 'true');
      localStorage.setItem('godlykids_review_date', new Date().toISOString());
      
    } catch (error) {
      console.error('🌟 Error requesting review:', error);
    } finally {
      setIsSubmitting(false);
      // Continue to next step after a brief delay
      setTimeout(onNext, 500);
    }
  };

  return (
    <div className="text-center">
      <div className="mb-4 flex justify-center gap-1">
        <span className="text-3xl">⭐</span>
        <span className="text-3xl">⭐</span>
        <span className="text-3xl">⭐</span>
        <span className="text-3xl">⭐</span>
        <span className="text-3xl">⭐</span>
      </div>
      <h3 className="text-[#FFD700] font-display font-bold text-xl mb-2">
        What Do You Think?
      </h3>
      <p className="text-white/90 text-sm leading-relaxed mb-4">
        We'd love to hear your feedback! Your review helps other families discover faith-filled content for their kids.
      </p>
      <WoodButton 
        variant="gold" 
        onClick={handleLeaveReview} 
        className="w-full py-3"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Opening...' : 'Leave a Review ⭐'}
      </WoodButton>
    </div>
  );
};

export default OnboardingTutorial;
