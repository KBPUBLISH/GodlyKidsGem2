import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Check, Heart, Sparkles, Star, Users, X } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';
import { isJourneyStudyOpen, noteJourneyStep } from '../utils/journeyStudy';
import { startSevenDayChallenge } from '../utils/sevenDayChallenge';
import { useSubscription } from '../context/SubscriptionContext';
import { useUser } from '../context/UserContext';
import ParentGateModal from '../components/features/ParentGateModal';
import { ANNUAL_PRICE_USD, MONTHLY_PRICE_USD } from '../utils/pricing';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";

const ANNUAL_PRICE = ANNUAL_PRICE_USD;
const MONTHLY_PRICE = MONTHLY_PRICE_USD;

const BENEFITS = [
  { Icon: BookOpen, title: 'Unlock all Story Packs', body: 'Every island, story, and activity.' },
  { Icon: Users, title: 'Collect Bible Characters', body: 'Meet the people of the Bible along the way.' },
  { Icon: Heart, title: 'Build Faith', body: 'Short lessons that stick after the story ends.' },
  { Icon: Sparkles, title: 'Games, puzzles, and quizzes', body: 'Play that points kids back to Scripture.' },
  { Icon: Star, title: 'New stories every week', body: 'Fresh adventures keep the journey going.' },
];

const ChallengeIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { purchase } = useSubscription();
  const { subscribe } = useUser();
  const reason = (location.state as { reason?: string } | null)?.reason || '';
  const continueJourney = reason === 'continue-journey';
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/sail/basement';
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    if (!isJourneyStudyOpen()) return;
    const source = reason || 'challenge';
    if (reason === 'adam-offer' || reason === 'skip-tour') {
      noteJourneyStep('offer_shown', { source: reason });
    }
    noteJourneyStep('paywall_shown', { source });
  }, [reason]);

  const track = (event: string) => {
    activityTrackingService.trackOnboardingEvent(event, { plan }).catch(() => {});
  };

  const later = () => {
    track('challenge_intro_later');
    noteJourneyStep('paywall_dismissed', { source: reason || 'challenge' });
    const fromAdam =
      reason === 'adam-offer' ||
      reason === 'skip-tour' ||
      (!reason && returnTo === '/sail/basement');
    if (fromAdam) {
      navigate('/sail/basement', { replace: true, state: { adamSkipTrial: true } });
      return;
    }
    navigate(returnTo, { replace: true });
  };

  const join = () => {
    track('challenge_intro_join');
    noteJourneyStep('paywall_clicked', { source: reason || 'challenge' });
    setPayError('');
    setShowParentGate(true);
  };

  const startPurchase = async () => {
    setPaying(true);
    setPayError('');
    try {
      const result = await purchase(plan);
      if (result.success) {
        noteJourneyStep('trial_started', { source: reason || 'challenge' });
        startSevenDayChallenge();
        subscribe();
        navigate(returnTo, { replace: true });
        return;
      }
      if (result.error === 'REDIRECT_TO_STRIPE') return;
      if (result.error && result.error !== 'Purchase cancelled') setPayError(result.error);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Could not start checkout');
    } finally {
      setPaying(false);
    }
  };

  const trialLine =
    plan === 'annual'
      ? `14-day free trial, then $${ANNUAL_PRICE}/year. Cancel anytime.`
      : `14-day free trial, then $${MONTHLY_PRICE}/month. Cancel anytime.`;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#7EC8E8] text-[#12264A]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #9ad8f5 0%, #e8f6ff 42%, #fff8e8 100%)',
        }}
      />
      <button
        type="button"
        aria-label="Close"
        onClick={later}
        className="absolute z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#12264A] shadow-sm active:scale-95"
        style={{
          top: 'max(10px, var(--safe-area-top, env(safe-area-inset-top, 0px)))',
          right: 'max(12px, var(--safe-area-right, env(safe-area-inset-right, 0px)))',
        }}
      >
        <X size={22} strokeWidth={2.6} />
      </button>

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5"
        style={{
          paddingTop: 'max(56px, calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 44px))',
          paddingBottom: 'max(16px, var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <h1
          className="text-center font-black leading-[0.95]"
          style={{ fontFamily: BUBBLE, fontSize: 'clamp(1.8rem, 7.4vw, 2.35rem)', color: NAVY }}
        >
          Start your 14-day
          <br />
          free trial
        </h1>
        {continueJourney && (
          <p
            className="mx-auto mt-3 max-w-sm rounded-2xl bg-white/95 px-4 py-3 text-center text-[0.95rem] font-black leading-snug"
            style={{ color: NAVY, fontFamily: BUBBLE }}
          >
            Start your free trial to continue your journey.
          </p>
        )}

        <ul className="mx-auto mt-5 w-full max-w-sm space-y-3">
          {BENEFITS.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                style={{ color: '#C4840A' }}
              >
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span>
                <span className="block font-black leading-tight" style={{ fontFamily: BUBBLE, color: NAVY }}>
                  {title}
                </span>
                <span className="block text-sm font-semibold leading-snug text-[#3d5278]">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
          <PlanCard
            selected={plan === 'annual'}
            onSelect={() => setPlan('annual')}
            badge="Best value"
            name="Annual"
            price={`$${ANNUAL_PRICE}`}
            detail="$3.33/month"
            trial="14-day free trial"
          />
          <PlanCard
            selected={plan === 'monthly'}
            onSelect={() => setPlan('monthly')}
            name="Monthly"
            price={`$${MONTHLY_PRICE}`}
            detail="per month"
            trial="14-day free trial"
          />
        </div>

        {payError && (
          <p className="mx-auto mt-3 max-w-sm text-center text-sm font-bold text-[#9a3412]">{payError}</p>
        )}

        <button
          type="button"
          onClick={join}
          disabled={paying}
          className="mx-auto mt-5 flex w-full max-w-sm min-h-[58px] items-center justify-center rounded-full text-[1.2rem] font-black active:translate-y-0.5 disabled:opacity-70"
          style={{
            fontFamily: BUBBLE,
            background: GOLD,
            color: NAVY,
            boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
          }}
        >
          {paying ? 'Opening checkout…' : 'Start 14-day free trial'}
        </button>
        <p className="mx-auto mt-2 max-w-sm text-center text-xs font-semibold text-[#3d5278]">{trialLine}</p>
        <button
          type="button"
          onClick={later}
          className="mx-auto mt-2 w-full max-w-sm py-2 text-center text-[0.95rem] font-bold text-[#12264A] active:opacity-70"
        >
          Not now
        </button>
      </div>

      <ParentGateModal
        isOpen={showParentGate}
        onClose={() => setShowParentGate(false)}
        onSuccess={startPurchase}
        isPurchasing={paying}
      />
    </div>
  );
};

const PlanCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  badge?: string;
  name: string;
  price: string;
  detail: string;
  trial: string;
}> = ({ selected, onSelect, badge, name, price, detail, trial }) => (
  <button
    type="button"
    onClick={onSelect}
    className="relative flex flex-col items-start rounded-2xl border-2 bg-white px-3 py-3 text-left active:scale-[0.98]"
    style={{
      borderColor: selected ? '#E0A21A' : 'rgba(18,38,74,0.12)',
      boxShadow: selected ? '0 0 0 3px rgba(255,196,61,0.45)' : 'none',
    }}
  >
    <span
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
      style={{ background: selected ? GOLD : 'transparent', border: selected ? 'none' : '2px solid rgba(18,38,74,0.2)' }}
    >
      {selected && <Check size={14} strokeWidth={3} color={NAVY} />}
    </span>
    {badge && (
      <span
        className="mb-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
        style={{ background: GOLD, color: NAVY, fontFamily: BUBBLE }}
      >
        {badge}
      </span>
    )}
    <span className="font-black" style={{ fontFamily: BUBBLE, color: NAVY }}>
      {name}
    </span>
    <span className="mt-1 text-xl font-black leading-none" style={{ color: NAVY }}>
      {price}
    </span>
    <span className="mt-1 text-xs font-semibold text-[#3d5278]">{detail}</span>
    <span className="mt-2 text-xs font-black" style={{ color: '#0f766e' }}>
      {trial}
    </span>
  </button>
);

export default ChallengeIntroPage;
