import React, { useState } from 'react';
import { Heart, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { DespiaService } from '../../services/despiaService';

interface ReviewPromptModalProps {
  isOpen: boolean;
  onReviewSubmitted: () => void;
}

const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({ isOpen, onReviewSubmitted }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleLeaveReview = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('🌟 Review button clicked');
      
      // Check if we're in DeSpia native app
      if (DespiaService.isNative()) {
        // DeSpia native app - use the proper despia() function
        console.log('🌟 DeSpia native detected, requesting review...');
        DespiaService.requestReview();
        console.log('🌟 DeSpia review request sent!');
      } else if (Capacitor.isNativePlatform()) {
        // Capacitor native app (non-DeSpia)
        try {
          const { RateApp } = await import('capacitor-rate-app');
          console.log('🌟 RateApp plugin loaded, requesting review...');
          await RateApp.requestReview();
          console.log('🌟 Native review request sent!');
        } catch (e) {
          console.log('🌟 RateApp plugin not available:', e);
          // Try webkit as last resort for iOS
          if ((window as any).webkit?.messageHandlers?.requestReview) {
            (window as any).webkit.messageHandlers.requestReview.postMessage({});
            console.log('🌟 Webkit review request sent');
          }
        }
      } else {
        // Web - can't show native review dialog
        console.log('🌟 Web mode - no native review API available');
      }
      
      // Mark review as submitted in localStorage
      localStorage.setItem('godlykids_review_prompted', 'true');
      localStorage.setItem('godlykids_review_date', new Date().toISOString());
      
      // Show thank you message briefly
      setShowThankYou(true);
      
      // Close after short delay
      setTimeout(() => {
        setShowThankYou(false);
        onReviewSubmitted();
      }, 1500);
      
    } catch (error) {
      console.error('🌟 Error requesting review:', error);
      // Still close the modal on error
      onReviewSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
      {/* Backdrop - No click to close */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Simple Modal Content */}
      <div className="relative bg-gradient-to-b from-[#5c2e0b] to-[#3E1F07] rounded-2xl p-6 mx-4 max-w-xs w-full border-2 border-[#8B4513] shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Close X Button */}
        <button
          onClick={onReviewSubmitted}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[#d4b896] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        
        {showThankYou ? (
          /* Thank You State */
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
              <Heart className="w-8 h-8 text-[#5c2e0b]" fill="#5c2e0b" />
            </div>
            <h2 className="text-xl font-display font-bold text-[#FFD700] mb-1">
              Thank You! 💛
            </h2>
            <p className="text-[#eecaa0] text-sm">
              Your support means everything!
            </p>
          </div>
        ) : (
          /* Simple Review Request */
          <div className="text-center">
            {/* Simple emoji icon */}
            <div className="text-5xl mb-3">💛</div>

            {/* Title */}
            <h2 className="text-xl font-display font-bold text-white mb-2">
              Enjoying Godly Kids?
            </h2>

            {/* Message */}
            <p className="text-[#d4b896] text-sm mb-5">
              Your review helps other families discover us!
            </p>

            {/* Simple Review Button */}
            <button
              onClick={handleLeaveReview}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-b from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-display font-bold text-base rounded-xl shadow-lg border-b-4 border-[#B8860B] transition-all active:scale-95 active:border-b-0 disabled:opacity-70"
            >
              {isSubmitting ? 'Opening...' : 'Leave a Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPromptModal;

// Helper function to check if we should show the review prompt
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
  
  // Check if already prompted
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

