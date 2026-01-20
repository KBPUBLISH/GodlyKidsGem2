import React, { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TutorialSpotlight from './TutorialSpotlight';
import { useTutorial } from '../../context/TutorialContext';
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

// Swipe hint content - shows animated hand gesture
const SwipeHintContent: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center">
    <div className="mb-3 relative">
      <Hand className="w-12 h-12 text-[#FFD700] mx-auto animate-swipe-left" />
    </div>
    <p className="text-white/90 text-sm">{message}</p>
    <style>{`
      @keyframes swipe-left {
        0%, 100% { transform: translateX(20px) rotate(-15deg); opacity: 0.5; }
        50% { transform: translateX(-20px) rotate(0deg); opacity: 1; }
      }
      .animate-swipe-left {
        animation: swipe-left 1.5s ease-in-out infinite;
      }
    `}</style>
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

  // Dispatch custom events for wheel navigation
  const triggerWheelNavigation = useCallback((target: 'give' | 'listen' | 'read') => {
    window.dispatchEvent(new CustomEvent('tutorial_navigate_wheel', { detail: { target } }));
  }, []);

  // Handle wheel navigation steps
  useEffect(() => {
    if (isStepActive('navigate_to_give')) {
      triggerWheelNavigation('give');
    }
  }, [currentStep, isStepActive, triggerWheelNavigation]);

  // Handle donation
  const handleDonate = (amount: number) => {
    const newTotal = Math.min(donatedCoins + amount, 10);
    setDonatedCoins(newTotal);
  };

  if (!isTutorialActive) return null;

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

      // STEP 2-5: Book swipe hints (shown in book reader)
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
            fingerPosition="top"
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

      case 'give_popup':
        return (
          <TutorialSpotlight
            title=""
            description=""
            isVisible={true}
            popupPosition="center"
            customContent={<GivePopupContent onNext={nextStep} />}
            requiresElementClick={false}
          />
        );

      case 'donation_practice':
        return (
          <TutorialSpotlight
            title="Donate 10 Coins"
            description=""
            isVisible={true}
            popupPosition="center"
            customContent={
              <DonationPracticeContent
                donatedAmount={donatedCoins}
                onDonate={handleDonate}
                onComplete={nextStep}
              />
            }
            requiresElementClick={false}
          />
        );

      case 'review_prompt':
        return (
          <TutorialSpotlight
            title={config.title}
            description={config.description}
            isVisible={true}
            popupPosition="center"
            customContent={<ReviewPromptContent onNext={nextStep} />}
            requiresElementClick={false}
          />
        );

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
                  navigate('/paywall', { state: { fromTutorial: true } });
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
    <div className="mb-4">
      <span className="text-4xl">⭐</span>
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

// Paywall content for tutorial
const PaywallContent: React.FC<{ onSubscribe: () => void; onContinue: () => void }> = ({ 
  onSubscribe, 
  onContinue 
}) => (
  <div className="text-center">
    <div className="mb-4">
      <span className="text-4xl">🎉</span>
    </div>
    <h3 className="text-[#FFD700] font-display font-bold text-2xl mb-2">
      Start Your Adventure!
    </h3>
    <p className="text-white/90 text-sm leading-relaxed mb-2">
      Start Free 14 Day Adventure
    </p>
    <div className="bg-white/10 rounded-xl p-4 mb-4">
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
    <WoodButton variant="gold" onClick={onSubscribe} className="w-full py-4 mb-3">
      Start Free Trial
    </WoodButton>
    <button
      onClick={onContinue}
      className="text-white/50 text-sm hover:text-white/70 transition-colors"
    >
      Continue exploring
    </button>
  </div>
);

export default OnboardingTutorial;
