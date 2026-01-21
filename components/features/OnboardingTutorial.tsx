import React, { useEffect, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TutorialSpotlight from './TutorialSpotlight';
import { useTutorial, TutorialStep } from '../../context/TutorialContext';
import { Heart, Coins, Hand } from 'lucide-react';
import WoodButton from '../ui/WoodButton';

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

// Swipe hint content - shows animated finger with swipe gesture
const SwipeHintContent: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-4 bg-black/70 backdrop-blur-md rounded-2xl">
    <p className="text-[#FFD700] font-bold text-base">Swipe to Read</p>
    <div className="flex items-center gap-2">
      {/* Animated finger pointer */}
      <span className="text-3xl animate-swipe-finger">👆</span>
      <p className="text-white/90 text-sm">{message}</p>
    </div>
    <style>{`
      @keyframes swipe-finger {
        0%, 100% { 
          transform: translateX(15px) rotate(10deg); 
          opacity: 0.7; 
        }
        50% { 
          transform: translateX(-15px) rotate(-10deg); 
          opacity: 1; 
        }
      }
      .animate-swipe-finger {
        animation: swipe-finger 1s ease-in-out infinite;
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

// Book controls intro - shows key reader controls
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
      <div className="flex items-center gap-3 bg-white/10 rounded-lg p-2">
        <span className="text-2xl">📏</span>
        <div>
          <p className="text-white font-semibold text-sm">Tap Page</p>
          <p className="text-white/70 text-xs">Adjust text position on screen</p>
        </div>
      </div>
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
    completeTutorial,
    getStepConfig,
    donatedCoins,
    setDonatedCoins,
  } = useTutorial();

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

      // STEP 3-6: Book swipe hints (shown in book reader)
      case 'book_swipe_intro':
      case 'book_swipe_1':
      case 'book_swipe_2':
        return (
          <TutorialSpotlight
            title={config.title}
            description=""
            isVisible={true}
            popupPosition="bottom-screen"
            requiresElementClick={false}
            compactPopup={true}
            hideOverlay={true}
            customContent={<SwipeHintContent message={config.description} />}
          />
        );

      case 'book_swipe_3':
        // Brief "Perfect!" message before auto-advancing
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="center"
            requiresElementClick={false}
            hideOverlay={true}
          />
        );

      // STEP 6: End modal with quiz button highlighted
      case 'book_end_quiz':
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
            title={config.title}
            description={config.description}
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
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            customContent={
              <PaywallContent 
                onSubscribe={() => {
                  // Clear any existing timer
                  localStorage.removeItem('godlykids_offer_timer');
                  
                  // Check if user already has an account
                  const userEmail = localStorage.getItem('godlykids_user_email');
                  const hasAccount = !!userEmail;
                  
                  if (hasAccount) {
                    // User has account - go straight to payment-only paywall
                    navigate('/paywall', { state: { fromTutorial: true } });
                  } else {
                    // No account - go to onboarding to create account first
                    navigate('/onboarding', { state: { skipToPaywall: true } });
                  }
                  completeTutorial();
                }}
                onContinue={completeTutorial}
              />
            }
            requiresElementClick={false}
          />
        );

      default:
        return null;
    }
  };

  return renderSpotlight();
};

// Review prompt content
const ReviewPromptContent: React.FC<{ onNext: () => void }> = ({ onNext }) => (
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
    <WoodButton variant="gold" onClick={onNext} className="w-full py-3">
      Continue
    </WoodButton>
  </div>
);

// Paywall content for tutorial with "One time offer"
const PaywallContent: React.FC<{ onSubscribe: () => void; onContinue: () => void }> = ({ 
  onSubscribe, 
  onContinue
}) => {
  return (
    <div className="text-center">
      {/* One Time Offer Badge */}
      <div className="bg-red-500 text-white text-xs font-bold px-4 py-1 rounded-full mb-3 inline-block animate-pulse">
        ⚡ ONE TIME OFFER ⚡
      </div>
      
      <div className="mb-3">
        <span className="text-4xl">🎉</span>
      </div>
      <h3 className="text-[#FFD700] font-display font-bold text-2xl mb-2">
        Start Your Adventure!
      </h3>
      <p className="text-white/90 text-sm leading-relaxed mb-2">
        Start Free 14 Day Adventure
      </p>
      
      <div className="bg-white/10 rounded-xl p-4 mb-3">
        <p className="text-[#FFD700] font-bold text-3xl mb-1">
          $3.33<span className="text-lg">/mo</span>
        </p>
        <p className="text-white/70 text-sm">
          with annual plan
        </p>
        <div className="inline-block bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mt-2">
          50% OFF
        </div>
      </div>
      
      {/* 10% Proceeds Info */}
      <div className="bg-pink-500/20 border border-pink-400/30 rounded-lg px-3 py-2 mb-4">
        <p className="text-pink-200 text-xs flex items-center justify-center gap-1">
          💝 <span className="font-semibold">10% of proceeds</span> goes towards our Giving Feature
        </p>
      </div>
      
      <WoodButton variant="gold" onClick={onSubscribe} className="w-full py-4 mb-3">
        Start Free Trial
      </WoodButton>
      <button
        onClick={() => {
          // Start the 5-minute timer and save to localStorage
          const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
          localStorage.setItem('godlykids_offer_timer', expiryTime.toString());
          onContinue();
        }}
        className="text-white/50 text-sm hover:text-white/70 transition-colors"
      >
        Continue exploring
      </button>
    </div>
  );
};

export default OnboardingTutorial;
