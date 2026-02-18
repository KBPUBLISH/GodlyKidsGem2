import { Capacitor } from '@capacitor/core';
import { DespiaService } from '../../services/despiaService';

/**
 * Trigger the native iOS/Android in-app review dialog directly.
 * No custom modal - just the system review prompt.
 */
export const requestNativeReview = async (): Promise<void> => {
  try {
    if (DespiaService.isNative()) {
      console.log('🌟 DeSpia native: requesting review...');
      DespiaService.requestReview();
    } else if (Capacitor.isNativePlatform()) {
      try {
        const { RateApp } = await import('capacitor-rate-app');
        await RateApp.requestReview();
      } catch (e) {
        if ((window as any).webkit?.messageHandlers?.requestReview) {
          (window as any).webkit.messageHandlers.requestReview.postMessage({});
        }
      }
    }
    localStorage.setItem('godlykids_review_prompted', 'true');
    localStorage.setItem('godlykids_review_date', new Date().toISOString());
  } catch (error) {
    console.warn('Review request:', error);
  }
};

// Helper function to check if we should trigger the native review prompt
// NOTE: This is for the standalone review prompt (NOT the tutorial review step)
// The tutorial has its own review prompt at the 'review_prompt' step
export const shouldShowReviewPrompt = (): boolean => {
  // Check if we're in a native app (DeSpia or Capacitor)
  const isDespiaNative = DespiaService.isNative();
  const isCapacitorNative = Capacitor.isNativePlatform();
  
  // Don't show review prompt on web - only show in native apps
  // Web users can't leave app store reviews
  if (!isDespiaNative && !isCapacitorNative) {
    console.log('🌟 Review prompt: Not showing (web mode)');
    return false;
  }
  
  // Don't show during onboarding tutorial - let the tutorial handle its own review prompt
  const tutorialStep = localStorage.getItem('godlykids_tutorial_step');
  const tutorialComplete = localStorage.getItem('godlykids_tutorial_complete');
  if (tutorialStep && tutorialComplete !== 'true') {
    console.log('🌟 Review prompt: Not showing (tutorial in progress)');
    return false;
  }
  
  // Don't show during demo mode
  const demoActive = localStorage.getItem('godlykids_demo_active');
  if (demoActive === 'true') {
    console.log('🌟 Review prompt: Not showing (demo mode active)');
    return false;
  }
  
  // Don't show if demo tutorial is still in progress
  const demoWelcomeShown = sessionStorage.getItem('godlykids_demo_welcome_shown');
  const demoTutorialComplete = sessionStorage.getItem('godlykids_demo_tutorial_complete');
  if (demoWelcomeShown === 'true' && demoTutorialComplete !== 'true') {
    console.log('🌟 Review prompt: Not showing (demo tutorial in progress)');
    return false;
  }
  
  // Check if user dismissed (clicked X) - don't show for 2 weeks
  const dismissed = localStorage.getItem('godlykids_review_dismissed');
  if (dismissed === 'true') {
    const dismissedDate = localStorage.getItem('godlykids_review_dismissed_date');
    if (dismissedDate) {
      const daysSinceDismissed = (Date.now() - new Date(dismissedDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 14) {
        console.log('🌟 Review prompt: Not showing (dismissed within 2 weeks)');
        return false; // Don't show again within 2 weeks of dismissal
      } else {
        // 2 weeks have passed, clear the dismissed flag
        localStorage.removeItem('godlykids_review_dismissed');
        localStorage.removeItem('godlykids_review_dismissed_date');
      }
    }
  }
  
  // Check if already reviewed/prompted
  const alreadyPrompted = localStorage.getItem('godlykids_review_prompted');
  if (alreadyPrompted === 'true') {
    // Check if it's been more than 30 days since last prompt
    const lastPromptDate = localStorage.getItem('godlykids_review_date');
    if (lastPromptDate) {
      const daysSincePrompt = (Date.now() - new Date(lastPromptDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < 30) {
        console.log('🌟 Review prompt: Not showing (prompted within 30 days)');
        return false; // Don't show again within 30 days
      }
    }
  }
  
  // Show immediately when user enters home page (no activity requirement)
  console.log('🌟 Review prompt: Ready to show!', { isDespiaNative, isCapacitorNative });
  return true;
};

// Helper to increment activity counters
export const incrementActivityCounter = (type: 'lesson' | 'book' | 'song') => {
  const key = type === 'lesson' 
    ? 'godlykids_lessons_watched' 
    : type === 'book' 
      ? 'godlykids_books_opened' 
      : 'godlykids_songs_played';
  
  const current = parseInt(localStorage.getItem(key) || '0', 10);
  localStorage.setItem(key, String(current + 1));
};

