import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { activityTrackingService } from '../services/activityTrackingService';

// Tutorial step definitions
// FLOW: Lesson button → Daily Session → Return to Explore → Coins → Report Card → Shop → Explore → Books → Audio → Complete
export type TutorialStep = 
  | 'idle'
  | 'lesson_button_highlight' // On explore page, highlight the Start Lesson button
  | 'daily_session_active'    // User is in the daily session (guided experience)
  | 'welcome_book_tap'    // On welcome page, finger points to a book (legacy, kept for compatibility)
  | 'book_controls_intro' // Quick overview of reader controls
  | 'book_swipe_intro'    // In book reader, show swipe gesture hint
  | 'book_swipe_1'        // First page turn
  | 'book_swipe_2'        // Second page turn  
  | 'book_swipe_3'        // Third page turn - then auto-skip to end
  | 'book_end_quiz'       // End modal with quiz button highlighted
  | 'quiz_in_progress'    // User is taking the quiz
  | 'coins_highlight'     // After daily session, highlight coins earned
  | 'coins_popup_open'
  | 'report_card_highlight'
  | 'report_card_open'
  | 'shop_highlight'
  | 'shop_open'
  | 'navigate_to_explore' // Go to explore/home
  | 'devotional_highlight' // Highlight daily devotional videos
  | 'navigate_to_books'   // Turn wheel to books page
  | 'navigate_to_audio'   // Turn wheel to audio page
  | 'audiobook_highlight' // Highlight an audiobook
  | 'tutorial_complete'   // Confetti + celebration
  | 'review_prompt'       // Ask for review
  | 'explore_pause'       // Let user explore for 10 seconds
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
  lesson_button_highlight: {
    title: 'Start Your Daily Lesson!',
    description: 'Tap here to begin your faith adventure with Scripture, stories, and more!',
    targetElement: 'lesson-button',
    requiresClick: true,
  },
  daily_session_active: {
    title: 'Complete Your Daily Lesson',
    description: 'Follow the guided lesson to earn coins!',
    requiresClick: false,
  },
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
    description: 'Keep reading or tap Skip to Quiz!',
    requiresClick: false,
    // No auto-advance - user must click Skip to Quiz button or reach The End naturally
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
  explore_pause: {
    title: '', // No popup shown - let user explore freely
    description: '',
    autoAdvanceDelay: 10000, // 10 seconds to explore before paywall
  },
  paywall: {
    title: 'Start Your Adventure',
    description: 'Start Free 14 Day Adventure - only $3.33/mo with annual plan (50% off)',
    requiresClick: true,
  },
  complete: { title: '', description: '' },
};

// Step order for progression
// FLOW: Lesson button → Daily Session → Coins → Report Card → Shop → Explore → Books → Audio → Review → Complete
const STEP_ORDER: TutorialStep[] = [
  'lesson_button_highlight', // 1. On explore page, highlight lesson button
  'daily_session_active',    // 2. User is in daily session (guided experience)
  'coins_highlight',         // 3. After session, show coins earned
  'coins_popup_open',        // 4. Coin history modal
  'report_card_highlight',   // 5. Highlight report card
  'report_card_open',        // 6. Report card modal
  'shop_highlight',          // 7. Highlight shop
  'shop_open',               // 8. Shop modal
  'navigate_to_explore',     // 9. Navigate to explore/home
  'devotional_highlight',    // 10. Highlight devotionals
  'navigate_to_books',       // 11. Navigate to books
  'navigate_to_audio',       // 12. Navigate to audio
  'audiobook_highlight',     // 13. Highlight audiobook
  'review_prompt',           // 14. Show review
  'tutorial_complete',       // 15. Confetti celebration
  'explore_pause',           // 16. Let user explore
  'paywall',                 // 17. Show subscription
  'complete',
];

// Legacy steps kept for backwards compatibility (users mid-tutorial)
const LEGACY_BOOK_STEPS: TutorialStep[] = [
  'welcome_book_tap',
  'book_controls_intro',
  'book_swipe_intro',
  'book_swipe_1',
  'book_swipe_2',
  'book_swipe_3',
  'book_end_quiz',
  'quiz_in_progress',
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
  onDailySessionStart: () => void;  // Called when user starts daily session
  onDailySessionComplete: () => void; // Called when daily session finishes
  onReturnToExplore: () => void;    // Called when user returns to explore page
  getStepConfig: () => typeof TUTORIAL_STEP_CONFIG[TutorialStep];
  donatedCoins: number;
  setDonatedCoins: (amount: number) => void;
  // New: Account creation flow
  showAccountCreation: boolean;
  setShowAccountCreation: (show: boolean) => void;
  onAccountCreated: () => void;     // Called after user creates account post-tutorial
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
  
  // New: Account creation state for post-tutorial flow
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  
  // Called when user creates account after tutorial
  const onAccountCreated = useCallback(() => {
    setShowAccountCreation(false);
    // Mark tutorial as complete and navigate to onboarding to continue setup
    setCurrentStep('complete');
    setIsComplete(true);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    localStorage.removeItem(TUTORIAL_STEP_KEY);
  }, []);

  const isTutorialActive = currentStep !== 'idle' && currentStep !== 'complete' && !isComplete;

  const isStepActive = useCallback((step: TutorialStep) => {
    return currentStep === step && isTutorialActive;
  }, [currentStep, isTutorialActive]);

  const startTutorial = useCallback(() => {
    // Reset complete state so tutorial can start fresh
    setIsComplete(false);
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    // Start at the first tutorial step - highlight the lesson button
    setCurrentStep('lesson_button_highlight');
    localStorage.setItem(TUTORIAL_STEP_KEY, 'lesson_button_highlight');
  }, []);

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

  // Called when user starts the daily session (from lesson button)
  const onDailySessionStart = useCallback(() => {
    if (currentStep === 'lesson_button_highlight') {
      setCurrentStep('daily_session_active');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'daily_session_active');
    }
  }, [currentStep]);

  // Called when daily session completes
  const onDailySessionComplete = useCallback(() => {
    if (currentStep === 'daily_session_active') {
      setCurrentStep('coins_highlight');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'coins_highlight');
    }
  }, [currentStep]);

  // Called when user returns to explore page - continue tutorial if active
  const onReturnToExplore = useCallback(() => {
    // If user was in daily session step and returns to explore, advance to coins
    if (currentStep === 'daily_session_active') {
      setCurrentStep('coins_highlight');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'coins_highlight');
    }
    // If user was in any legacy book step and returns, skip to coins
    if (LEGACY_BOOK_STEPS.includes(currentStep)) {
      setCurrentStep('coins_highlight');
      localStorage.setItem(TUTORIAL_STEP_KEY, 'coins_highlight');
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
        // Reset isComplete so the tutorial becomes active again
        setIsComplete(false);
        localStorage.removeItem(TUTORIAL_STORAGE_KEY);
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

  // Track tutorial steps for analytics
  const lastTrackedStep = useRef<TutorialStep | null>(null);
  useEffect(() => {
    // Only track if step changed and tutorial is active
    if (currentStep !== 'idle' && currentStep !== lastTrackedStep.current) {
      lastTrackedStep.current = currentStep;
      
      // Track step asynchronously
      activityTrackingService.trackTutorialStep(currentStep, {
        coinsDonated: donatedCoins > 0 ? donatedCoins : undefined,
      }).catch(console.error);
      
      // Reset tutorial session when complete
      if (currentStep === 'complete') {
        activityTrackingService.resetTutorialSession();
      }
    }
  }, [currentStep, donatedCoins]);

  // Listen for tutorial abandoned event (fired when user exits tutorial to non-tutorial route)
  useEffect(() => {
    const handleTutorialAbandoned = () => {
      console.log('📢 Tutorial abandoned event received - syncing state');
      setCurrentStep('complete');
      setIsComplete(true);
    };
    
    window.addEventListener('tutorial_abandoned', handleTutorialAbandoned);
    return () => window.removeEventListener('tutorial_abandoned', handleTutorialAbandoned);
  }, []);

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
        onDailySessionStart,
        onDailySessionComplete,
        onReturnToExplore,
        getStepConfig,
        donatedCoins,
        setDonatedCoins,
        showAccountCreation,
        setShowAccountCreation,
        onAccountCreated,
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
