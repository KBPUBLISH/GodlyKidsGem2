import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Tutorial step definitions
// FLOW: Welcome book → Swipe pages → Quiz → Coins → Report Card → Shop → Giving → Explore → Books → Audio → Complete
export type TutorialStep = 
  | 'idle'
  | 'welcome_book_tap'    // On welcome page, finger points to a book
  | 'book_controls_intro' // Quick overview of reader controls
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
  | 'campaign_highlight'  // Highlight a campaign to click
  | 'give_button_highlight' // Highlight the Give button
  | 'donation_complete'   // After donation is made
  | 'navigate_to_explore' // Go back to explore/home
  | 'devotional_highlight' // Highlight daily devotional videos
  | 'navigate_to_books'   // Turn wheel to books page
  | 'navigate_to_audio'   // Turn wheel to audio page
  | 'audiobook_highlight' // Highlight an audiobook
  | 'tutorial_complete'   // Confetti + celebration
  | 'review_prompt'       // Ask for review
  | 'paywall'             // Show subscription
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
  book_controls_intro: {
    title: 'Quick Tips!',
    description: 'Here are some helpful controls for reading.',
    requiresClick: false,
    autoAdvanceDelay: 4000, // Show for 4 seconds then advance
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
  campaign_highlight: {
    title: 'Practice Giving!',
    description: 'Tap the Give button to donate coins!',
    targetElement: 'give-button-0',
    requiresClick: true,
  },
  give_button_highlight: {
    title: 'Tap to Donate!',
    description: 'Tap to give your coins and help people in need!',
    targetElement: 'donate-coins-button',
    requiresClick: true,
  },
  donation_complete: {
    title: 'Amazing! 🎉',
    description: 'You just practiced generosity! Your coins help real people.',
    autoAdvanceDelay: 4500, // Give user more time to appreciate the message
  },
  navigate_to_explore: {
    title: 'Let\'s Explore More!',
    description: 'Watch the wheel spin to the Explore section...',
    autoAdvanceDelay: 3000, // Give time for wheel animation
  },
  devotional_highlight: {
    title: 'Daily Devotionals',
    description: 'Watch fun video lessons to grow in faith every day!',
    targetElement: 'devotional-section',
    requiresClick: false,
    autoAdvanceDelay: 3000,
  },
  navigate_to_books: {
    title: 'Books Section',
    description: 'Watch the wheel spin to the Books section...',
    autoAdvanceDelay: 2000,
  },
  navigate_to_audio: {
    title: 'Audio Adventures',
    description: 'Watch the wheel spin to the Audio section...',
    autoAdvanceDelay: 2000,
  },
  audiobook_highlight: {
    title: 'Audio Stories',
    description: 'Tap to listen to exciting audio dramas - perfect for car rides and screen-free time!',
    targetElement: 'audiobook-card-0',
    requiresClick: true,
  },
  tutorial_complete: {
    title: 'You Did It! 🎊',
    description: 'You\'ve completed the tutorial! Time to start your faith adventure!',
    autoAdvanceDelay: 4000, // Give user time to enjoy the celebration
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
// FLOW: Welcome book → Swipe 3 pages → Quiz → Coins → Report Card → Shop → Giving → Explore → Books → Audio → Review → Complete
const STEP_ORDER: TutorialStep[] = [
  'welcome_book_tap',     // 1. On welcome page, tap a book
  'book_controls_intro',  // 2. Quick controls overview
  'book_swipe_intro',     // 3. In reader, show swipe hint
  'book_swipe_1',         // 4. First page turn
  'book_swipe_2',         // 5. Second page turn
  'book_swipe_3',         // 6. Third page turn - auto advances
  'book_end_quiz',        // 7. End modal, quiz highlighted
  'quiz_in_progress',     // 8. Taking the quiz
  'coins_highlight',      // 9. Show coins earned
  'coins_popup_open',     // 10. Coin history modal
  'report_card_highlight',// 11. Highlight report card
  'report_card_open',     // 12. Report card modal
  'shop_highlight',       // 13. Highlight shop
  'shop_open',            // 14. Shop modal
  'navigate_to_give',     // 15. Navigate wheel to give
  'campaign_highlight',   // 16. Highlight a campaign
  'give_button_highlight',// 17. Highlight give button
  'donation_complete',    // 18. Donation done celebration
  'navigate_to_explore',  // 19. Navigate to explore/home
  'devotional_highlight', // 20. Highlight devotionals
  'navigate_to_books',    // 21. Navigate to books
  'navigate_to_audio',    // 22. Navigate to audio
  'audiobook_highlight',  // 23. Highlight audiobook (user clicks → navigates away)
  'review_prompt',        // 24. Show review when returning to listen page
  'tutorial_complete',    // 25. Confetti celebration on explore page
  'paywall',              // 26. Show subscription
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
