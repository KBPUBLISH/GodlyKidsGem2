import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { activityTrackingService } from '../../services/activityTrackingService';

interface LifetimeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LIFETIME_ORIGINAL = 69.99;
const LIFETIME_SALE = 19.99;
const DISCOUNT = Math.round(((LIFETIME_ORIGINAL - LIFETIME_SALE) / LIFETIME_ORIGINAL) * 100);

const isDespiaNative = (): boolean => navigator.userAgent.toLowerCase().includes('despia');

const LifetimeOfferModal: React.FC<LifetimeOfferModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();

  const [timeRemaining, setTimeRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!isOpen) return;

    const DEAL_KEY = 'godlykids_lifetime_deal_start';
    const DEAL_MS = 24 * 60 * 60 * 1000;

    let start = localStorage.getItem(DEAL_KEY);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(DEAL_KEY, start);
    }

    const end = parseInt(start, 10) + DEAL_MS;

    const tick = () => {
      const left = Math.max(0, end - Date.now());
      setTimeRemaining({
        hours: Math.floor(left / 3600000),
        minutes: Math.floor((left % 3600000) / 60000),
        seconds: Math.floor((left % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      activityTrackingService.trackOnboardingEvent('lifetime_offer_shown', { source: 'timed_popup' });
    }
  }, [isOpen]);

  if (!isOpen || isPremium) return null;

  const handleGetLifetime = () => {
    activityTrackingService.trackOnboardingEvent('lifetime_offer_clicked', { source: 'timed_popup' });
    onClose();
    navigate('/paywall', { state: { selectLifetime: true } });
  };

  const handleDismiss = () => {
    activityTrackingService.trackOnboardingEvent('lifetime_offer_dismissed', { source: 'timed_popup' });
    onClose();
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/20 text-white/80 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#4c1d95] px-6 pt-8 pb-6 text-center relative overflow-hidden">
          <div className="absolute -top-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-400/10 rounded-full blur-2xl" />

          <Sparkles className="mx-auto mb-3 text-yellow-300" size={36} />
          <h2 className="text-2xl font-extrabold text-white mb-1">
            Lifetime Access
          </h2>
          <p className="text-white/80 text-sm">One payment. Yours forever.</p>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <span className="text-white/70 text-xs font-semibold">Offer ends in</span>
            {[pad(timeRemaining.hours), pad(timeRemaining.minutes), pad(timeRemaining.seconds)].map((v, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-white/60 font-bold text-sm">:</span>}
                <span className="bg-white/20 text-white font-mono font-bold text-sm px-2 py-0.5 rounded">
                  {v}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-6 pt-5 pb-6">
          {/* Price */}
          <div className="flex items-end justify-center gap-2 mb-4">
            <span className="text-gray-400 line-through text-lg">${LIFETIME_ORIGINAL}</span>
            <span className="text-4xl font-extrabold text-[#7c3aed]">${LIFETIME_SALE}</span>
            <span className="text-sm text-gray-500">USD</span>
          </div>

          <div className="mx-auto mb-5 bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full w-fit">
            SAVE {DISCOUNT}% — LIMITED TIME
          </div>

          {/* Benefits */}
          <div className="space-y-2.5 mb-6">
            {[
              'All 150+ books & stories',
              '12 free custom books',
              '15+ Bible games & exercises',
              'All future content included',
              'No recurring charges ever',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#7c3aed] flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </div>
                <span className="text-sm text-gray-700">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleGetLifetime}
            className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white font-bold text-lg rounded-2xl shadow-lg shadow-purple-300/40 active:scale-[0.98] transition-all"
          >
            Get Lifetime — ${LIFETIME_SALE}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full mt-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
};

export default LifetimeOfferModal;
