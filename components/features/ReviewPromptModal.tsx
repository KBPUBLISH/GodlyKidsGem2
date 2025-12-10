import React, { useState } from 'react';
import { Star, Heart, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

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
      console.log('🌟 Is native platform:', Capacitor.isNativePlatform());
      console.log('🌟 Platform:', Capacitor.getPlatform());
      
      // Check if running on native platform (DeSpia wraps as native)
      const isNative = Capacitor.isNativePlatform() || 
                       window.hasOwnProperty('webkit') || 
                       (window as any).despia;
      
      if (isNative) {
        console.log('🌟 Attempting native review request...');
        
        // Try Capacitor Rate App plugin
        try {
          const { RateApp } = await import('capacitor-rate-app');
          console.log('🌟 RateApp plugin loaded, requesting review...');
          await RateApp.requestReview();
          console.log('🌟 Native review request sent!');
        } catch (e) {
          console.log('🌟 RateApp plugin not available, trying DeSpia...', e);
          
          // Try DeSpia URL scheme for reviews (if DeSpia supports it)
          if ((window as any).despia !== undefined) {
            (window as any).despia = 'requestreview://';
            console.log('🌟 DeSpia review request sent');
          } else {
            // Final fallback - iOS StoreKit review via webkit
            if ((window as any).webkit?.messageHandlers?.requestReview) {
              (window as any).webkit.messageHandlers.requestReview.postMessage({});
              console.log('🌟 Webkit review request sent');
            } else {
              console.log('🌟 No native review API available');
            }
          }
        }
      } else {
        // Web fallback - just show thank you
        console.log('🌟 Review requested (web mode - no native API)');
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
      }, 2000);
      
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop - No click to close */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div className="relative bg-gradient-to-b from-[#5c2e0b] to-[#3E1F07] rounded-3xl p-6 mx-4 max-w-sm w-full border-4 border-[#FFD700] shadow-2xl animate-in zoom-in-95 duration-300">
        
        {/* Decorative top stars */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className="w-8 h-8 text-[#FFD700] animate-pulse" 
                fill="#FFD700"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>

        {showThankYou ? (
          /* Thank You State */
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center animate-bounce">
              <Heart className="w-10 h-10 text-[#5c2e0b]" fill="#5c2e0b" />
            </div>
            <h2 className="text-2xl font-display font-bold text-[#FFD700] mb-2">
              Thank You! 💛
            </h2>
            <p className="text-[#eecaa0] text-sm">
              Your support means the world to us!
            </p>
          </div>
        ) : (
          /* Review Request State */
          <>
            {/* Character/Icon */}
            <div className="w-24 h-24 mx-auto mt-4 mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg border-4 border-[#f3e5ab]">
              <Sparkles className="w-12 h-12 text-[#5c2e0b]" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-display font-bold text-center text-[#FFD700] mb-2">
              Enjoying Godly Kids?
            </h2>

            {/* Message */}
            <p className="text-center text-[#eecaa0] text-sm mb-2">
              We'd love to hear from you! 🙏
            </p>
            <p className="text-center text-[#d4b896] text-xs mb-6">
              Your review helps other Christian families discover faith-building content for their kids.
            </p>

            {/* Stars Display */}
            <div className="flex justify-center gap-2 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className="w-10 h-10 text-[#FFD700] transition-transform hover:scale-110" 
                  fill="#FFD700"
                />
              ))}
            </div>

            {/* Review Button - The ONLY way to exit */}
            <button
              onClick={handleLeaveReview}
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-b from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-display font-bold text-lg rounded-2xl shadow-lg border-b-4 border-[#B8860B] transition-all active:scale-95 active:border-b-0 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#3E1F07] border-t-transparent rounded-full animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5" fill="#3E1F07" />
                  Leave a Review
                </>
              )}
            </button>

            {/* Subtle encouragement */}
            <p className="text-center text-[#8B7355] text-[10px] mt-4">
              It only takes a moment and helps us grow! ✨
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewPromptModal;

// Helper function to check if we should show the review prompt
export const shouldShowReviewPrompt = (): boolean => {
  // Check if already prompted
  const alreadyPrompted = localStorage.getItem('godlykids_review_prompted');
  if (alreadyPrompted === 'true') {
    // Check if it's been more than 30 days since last prompt
    const lastPromptDate = localStorage.getItem('godlykids_review_date');
    if (lastPromptDate) {
      const daysSincePrompt = (Date.now() - new Date(lastPromptDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < 30) {
        return false; // Don't show again within 30 days
      }
    }
  }
  
  // Check if user has completed enough activities
  const lessonsCompleted = parseInt(localStorage.getItem('godlykids_lessons_completed') || '0', 10);
  const booksRead = parseInt(localStorage.getItem('godlykids_books_read') || '0', 10);
  const daysActive = parseInt(localStorage.getItem('godlykids_days_active') || '0', 10);
  
  // Show review prompt if user has engaged enough
  // (completed at least 3 lessons OR read 2 books OR been active for 3+ days)
  return lessonsCompleted >= 3 || booksRead >= 2 || daysActive >= 3;
};

// Helper to increment activity counters
export const incrementActivityCounter = (type: 'lesson' | 'book' | 'day') => {
  const key = type === 'lesson' 
    ? 'godlykids_lessons_completed' 
    : type === 'book' 
      ? 'godlykids_books_read' 
      : 'godlykids_days_active';
  
  const current = parseInt(localStorage.getItem(key) || '0', 10);
  localStorage.setItem(key, String(current + 1));
};

