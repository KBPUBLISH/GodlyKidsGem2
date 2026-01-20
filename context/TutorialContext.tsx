import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Tutorial step definitions
// FLOW: Welcome book → Swipe pages → Quiz → Coins → Report Card → Shop → Giving
export type TutorialStep = 
  | 'idle'
  | 'welcome_book_tap'    // On welcome page, finger points to a book
  | 'book_swipe_intro'    // In book reader, show swipe gesture hint
  | 'book_swipe_1'        // First page turn
  | 'book_swipe_2'        // Second page turn  
  | 'book_swipe_3'        // Third page turn - then auto-skip to end
  | 'book_end_quiz'       // End modal with quiz button highlighted
  | 'quiz_in_progress'    // User is taking the quiz
  | 'coins_highlight'     // After quiz, highlight coins earned
  | 'coins_popup_open'
  | 'report_card_highlight'
  | 'report_card_open'
  | 'shop_highlight'
  | 'shop_open'
  | 'navigate_to_give'
  | 'give_popup'
  | 'donation_practice'
  | 'review_prompt'
  | 'paywall'
  | 'complete';

// Step metadata for UI
export const TUTORIAL_STEP_CONFIG: Record<TutorialStep, {
  title: string;
  description: string;
  targetElement?: string;
  requiresClick?: boolean;
  autoAdvanceDelay?: number;
}> = {
  idle: { title: '', description: '' },
  welcome_book_tap: {
    title: 'Tap to Start!',
    description: 'Choose any story to begin your adventure!',
    requiresClick: false,
  },
  book_swipe_intro: {
    title: 'Swipe to Read',
    description: 'Swipe left to turn the page!',
    requiresClick: false,
  },
  book_swipe_1: {
    title: 'Great Job!',
    description: 'Keep swiping to continue the story!',
    requiresClick: false,
  },
  book_swipe_2: {
    title: 'Almost There!',
    description: 'One more swipe!',
    requiresClick: false,
  },
  book_swipe_3: {
    title: 'Perfect!',
    description: 'Let\'s take a quiz to earn coins!',
    autoAdvanceDelay: 1500,
  },
  book_end_quiz: {
    title: 'Take the Quiz!',
    description: 'Tap to test what you learned and earn coins!',
    targetElement: 'quiz-button',
    requiresClick: true,
  },
  quiz_in_progress: {
    title: 'Answer the Questions',
    description: 'Complete the quiz to earn your coins!',
    requiresClick: false,
  },
  coins_highlight: {
    title: 'You Earned Coins! 🎉',
    description: 'Great job! Tap here to see your coin rewards!',
    targetElement: 'coins-button',
    requiresClick: true,
  },
  coins_popup_open: {
    title: 'Coin History',
    description: 'See all your coin earnings and rewards here!',
    requiresClick: false,
  },
  report_card_highlight: {
    title: 'Report Card',
    description: 'Track your child\'s progress and achievements here!',
    targetElement: 'report-card-button',
    requiresClick: true,
  },
  report_card_open: {
    title: 'Your Progress',
    description: 'See reading stats, lessons completed, and more!',
    requiresClick: false,
  },
  shop_highlight: {
    title: 'The Shop',
    description: 'Spend your coins on fun avatars, animations, and voices!',
    targetElement: 'shop-button',
    requiresClick: true,
  },
  shop_open: {
    title: 'Explore the Shop',
    description: 'Customize your character with avatars and more!',
    requiresClick: false,
  },
  navigate_to_give: {
    title: 'Practice Generosity',
    description: 'Watch the wheel spin to the Give section...',
    autoAdvanceDelay: 2000,
  },
  give_popup: {
    title: 'Practice Generosity',
    description: 'Your child\'s progress makes a real world impact. Let\'s practice giving!',
    requiresClick: true,
  },
  donation_practice: {
    title: 'Donate 10 Coins',
    description: 'Practice generosity by donating 10 coins to see how it works.',
    requiresClick: true,
  },
  review_prompt: {
    title: 'What Do You Think?',
    description: 'We\'d love to hear your feedback!',
    requiresClick: true,
  },
  paywall: {
    title: 'Start Your Adventure',
    description: 'Start Free 14 Day Adventure - only $3.33/mo with annual plan (50% off)',
    requiresClick: true,
  },
  complete: { title: '', description: '' },
};

// Step order for progression
// FLOW: Welcome book → Swipe 3 pages → Quiz → Coins → Report Card → Shop → Giving
const STEP_ORDER: TutorialStep[] = [
  'welcome_book_tap',     // 1. On welcome page, tap a book
  'book_swipe_intro',     // 2. In reader, show swipe hint
  'book_swipe_1',         // 3. First page turn
  'book_swipe_2',         // 4. Second page turn
  'book_swipe_3',         // 5. Third page turn - auto advances
  'book_end_quiz',        // 6. End modal, quiz highlighted
  'quiz_in_progress',     // 7. Taking the quiz
  'coins_highlight',      // 8. Show coins earned
  'coins_popup_open',     // 9. Coin history modal
  'report_card_highlight',// 10. Highlight report card
  'report_card_open',     // 11. Report card modal
  'shop_highlight',       // 12. Highlight shop
  'shop_open',            // 13. Shop modal
  'navigate_to_give',     // 14. Navigate wheel to give
  'give_popup',           // 15. Give section intro
  'donation_practice',    // 16. Practice donating
  'review_prompt',        // 17. Ask for review
  'paywall',              // 18. Show subscription
  'complete',
];

interface TutorialContextType {
  currentStep: TutorialStep;
  isTutorialActive: boolean;
  isStepActive: (step: TutorialStep) => boolean;
  startTutorial: () => void;
  nextStep: () => void;
  goToStep: (step: TutorialStep) => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  onPageSwipe: () => void;          // Called on each page swipe in book reader
  onBookEndModalOpen: () => void;   // Called when book end modal opens
  onQuizStart: () => void;          // Called when user taps quiz button
  onBookQuizComplete: () => void;   // Called when user finishes book quiz
  getStepConfig: () => typeof TUTORIAL_STEP_CONFIG[TutorialStep];
  donatedCoins: number;
  setDonatedCoins: (amount: number) => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const TUTORIAL_STORAGE_KEY = 'godlykids_tutorial_complete';
const TUTORIAL_STEP_KEY = 'godlykids_tutorial_step';

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if tutorial was already completed
  const [isComplete, setIsComplete] = useState(() => {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  });

  const [currentStep, setCurrentStep] = useState<TutorialStep>(() => {
    if (isComplete) return 'idle';
    const savedStep = localStorage.getItem(TUTORIAL_STEP_KEY) as TutorialStep | null;
    return savedStep && STEP_ORDER.includes(savedStep) ? savedStep : 'idle';
  });

  const [donatedCoins, setDonatedCoins] = useState(0);

  const isTutorialActive = currentStep !== 'idle' && currentStep !== 'complete' && !isComplete;

  const isStepActive = useCallback((step: TutorialStep) => {
    return currentStep === step && isTutorialActive;
  }, [currentStep, isTutorialActive]);

  const startTutorial = useCallback(() => {
    if (!isComplete) {
      setCurrentStep('welcome_book_tap');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'welcome_book_tap');
    }
  }, [isComplete]);

  // Called when user swipes a page in book reader
  const onPageSwipe = useCallback(() => {
    if (currentStep === 'book_swipe_intro') {
      setCurrentStep('book_swipe_1');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'book_swipe_1');
    } else if (currentStep === 'book_swipe_1') {
      setCurrentStep('book_swipe_2');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'book_swipe_2');
    } else if (currentStep === 'book_swipe_2') {
      setCurrentStep('book_swipe_3');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'book_swipe_3');
    }
  }, [currentStep]);

  // Called when user completes the book quiz to advance to coins
  const onBookQuizComplete = useCallback(() => {
    if (currentStep === 'quiz_in_progress') {
      setCurrentStep('coins_highlight');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'coins_highlight');
    }
  }, [currentStep]);

  // Called when book end modal opens (after 3 swipes)
  const onBookEndModalOpen = useCallback(() => {
    if (currentStep === 'book_swipe_3') {
      setCurrentStep('book_end_quiz');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'book_end_quiz');
    }
  }, [currentStep]);

  // Called when user taps quiz button
  const onQuizStart = useCallback(() => {
    if (currentStep === 'book_end_quiz') {
      setCurrentStep('quiz_in_progress');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'quiz_in_progress');
    }
  }, [currentStep]);

  const nextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1) {
      const next = STEP_ORDER[currentIndex + 1];
      setCurrentStep(next);
      localStorage.setItem(TUTORIAL_STEP_KEY, next);
      
      if (next === 'complete') {
        setIsComplete(true);
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
        localStorage.removeItem(TUTORIAL_STEP_KEY);
      }
    }
  }, [currentStep]);

  const goToStep = useCallback((step: TutorialStep) => {
    if (STEP_ORDER.includes(step) || step === 'idle') {
      setCurrentStep(step);
      if (step !== 'idle') {
        localStorage.setItem(TUTORIAL_STEP_KEY, step);
      }
    }
  }, []);

  const skipTutorial = useCallback(() => {
    setCurrentStep('complete');
    setIsComplete(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  const completeTutorial = useCallback(() => {
    setCurrentStep('complete');
    setIsComplete(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  const getStepConfig = useCallback(() => {
    return TUTORIAL_STEP_CONFIG[currentStep];
  }, [currentStep]);

  // Auto-advance for steps with autoAdvanceDelay
  useEffect(() => {
    const config = TUTORIAL_STEP_CONFIG[currentStep];
    if (config.autoAdvanceDelay && isTutorialActive) {
      const timer = setTimeout(() => {
        nextStep();
      }, config.autoAdvanceDelay);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isTutorialActive, nextStep]);

  return (
    <TutorialContext.Provider
      value={{
        currentStep,
        isTutorialActive,
        isStepActive,
        startTutorial,
        nextStep,
        goToStep,
        skipTutorial,
        completeTutorial,
        onPageSwipe,
        onBookEndModalOpen,
        onQuizStart,
        onBookQuizComplete,
        getStepConfig,
        donatedCoins,
        setDonatedCoins,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

export default TutorialContext;
