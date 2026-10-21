import React, { useState, useEffect } from 'react';
import { X, Star, CheckCircle } from 'lucide-react';
import { activityTrackingService } from '../../services/activityTrackingService';

const LAYOUT_RATING_SHOWN_KEY = 'godlykids_layout_rating_shown';

export const shouldShowLayoutRating = (): boolean => {
  if (localStorage.getItem(LAYOUT_RATING_SHOWN_KEY)) return false;
  return true;
};

export const markLayoutRatingShown = () => {
  localStorage.setItem(LAYOUT_RATING_SHOWN_KEY, new Date().toISOString());
};

interface LayoutRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  email?: string;
  platform?: string;
}

const LayoutRatingModal: React.FC<LayoutRatingModalProps> = ({
  isOpen,
  onClose,
  userId,
  email,
  platform = 'web',
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [isOpen]);

  const handleSubmit = async (r: number) => {
    if (r === null) return;
    setSubmitting(true);

    try {
      const apiUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
      const base = apiUrl.replace(/\/+$/, '').replace(/\/api$/, '');
      const apiBase = `${base}/api`;

      // Submit to survey API (content/portal analytics)
      await fetch(`${apiBase}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
          surveyType: 'layout_rating',
          rating: r,
          metadata: { platform },
        }),
      });

      // Track in onboarding analytics
      await activityTrackingService.trackOnboardingEvent('layout_rating_submitted', { rating: r });

      markLayoutRatingShown();
      setSubmitted(true);
    } catch (error) {
      console.error('Layout rating submit error:', error);
      markLayoutRatingShown();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    markLayoutRatingShown();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border-4 border-amber-600">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Quick Feedback</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6 overflow-visible">
          {!submitted ? (
            <div className="space-y-5">
              <p className="text-amber-900 text-center font-medium">
                How do you like the new layout?
              </p>
              <p className="text-amber-700 text-sm text-center">
                1 = Not at all, 5 = Love it!
              </p>

              <div className="flex justify-center items-center gap-1.5 sm:gap-2 px-4 w-full box-border">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      setRating(star);
                      handleSubmit(star);
                    }}
                    disabled={submitting}
                    className={`flex-shrink-0 p-2 sm:p-2.5 rounded-xl transition-all ${
                      rating !== null && star <= rating
                        ? 'bg-amber-500 text-white scale-105'
                        : 'bg-white border-2 border-amber-200 text-amber-900 hover:border-amber-400'
                    } ${submitting ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    <Star
                      className={`w-6 h-6 sm:w-7 sm:h-7 ${
                        rating !== null && star <= rating ? 'fill-current' : ''
                      }`}
                    />
                  </button>
                ))}
              </div>
              {submitting && (
                <p className="text-amber-600 text-sm text-center">Sending...</p>
              )}
            </div>
          ) : (
            <div className="space-y-5 text-center py-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-amber-900">Thank You!</h3>
              <p className="text-amber-700">
                Your feedback helps us make Godly Kids even better.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutRatingModal;
