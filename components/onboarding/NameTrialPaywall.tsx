import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronLeft } from 'lucide-react';
import ParentGateModal from '../features/ParentGateModal';
import { useSubscription } from '../../context/SubscriptionContext';
import { useUser } from '../../context/UserContext';
import { ANNUAL_PRICE_USD, MONTHLY_PRICE_USD, TRIAL_DAYS } from '../../utils/pricing';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";

/**
 * The pitch before the trial: real gameplay hero shots (4:5 WebP, bottom
 * gradient baked in so the copy below stays legible) with the hook rendered
 * in React. Leads with the strongest hook and ends on the value prop right
 * before the trial step.
 */
type Slide = { src: string; eyebrow: string; title: string; body: string };

const SLIDES: Slide[] = [
  {
    src: '/assets/images/onboarding/slide-1-adventure.webp',
    eyebrow: 'Stories',
    title: 'Adventure to Bible Islands',
    body: 'Sail from island to island and live the stories of the Bible.',
  },
  {
    src: '/assets/images/onboarding/slide-2-collect.webp',
    eyebrow: 'Collect',
    title: 'Collect Characters',
    body: 'Finish a story to meet its hero. Adam, Eve, Noah and more join your crew.',
  },
  {
    src: '/assets/images/onboarding/slide-3-community.webp',
    eyebrow: 'Build',
    title: 'Build a Community',
    body: 'Bring your friends home. Build houses, plant gardens, share meals.',
  },
  {
    src: '/assets/images/onboarding/slide-4-pray.webp',
    eyebrow: 'Grow',
    title: 'Pray & Grow',
    body: 'Tired? Kneel and pray. Hungry? Cook together. Every day teaches something.',
  },
  {
    src: '/assets/images/onboarding/slide-5-fishing.webp',
    eyebrow: 'Play',
    title: 'Your Island, Your Story',
    body: 'Chop, build, fish, farm — and watch your world grow.',
  },
  {
    src: '/assets/images/onboarding/slide-6-live-it.webp',
    eyebrow: 'Learn by playing',
    title: 'Live It, Don’t Just Read It',
    body: 'Kids learn to live a Christian life through play: work hard, be kind, pray, care for others.',
  },
];

/** A horizontal drag this long (and mostly sideways) flips the slide. */
const SWIPE_PX = 40;

const HeroSlide: React.FC<{ slide: Slide; index: number; count: number }> = ({ slide, index, count }) => (
  <figure
    className="relative h-full w-full overflow-hidden rounded-[28px] bg-[#dfeaf5]"
    style={{ boxShadow: '0 14px 34px rgba(18,38,74,0.22)', animation: 'gk-pitch-in 320ms ease-out both' }}
  >
    <img
      src={slide.src}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-cover object-top"
    />
    <figcaption
      className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-12 text-left text-white"
      style={{ background: 'linear-gradient(180deg, rgba(14,30,58,0) 0%, rgba(14,30,58,0.55) 45%, rgba(14,30,58,0.8) 100%)' }}
    >
      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.14em]"
        style={{ background: GOLD, color: NAVY, fontFamily: BUBBLE }}
      >
        {slide.eyebrow}
      </span>
      <h2
        className="mt-2 font-black leading-[1.05]"
        style={{ fontFamily: BUBBLE, fontSize: 'clamp(1.6rem, 7.4vw, 2.15rem)', textShadow: '0 2px 10px rgba(0,0,0,0.45)' }}
      >
        {slide.title}
      </h2>
      <p
        className="mt-1.5 font-semibold leading-snug text-white/90"
        style={{ fontSize: 'clamp(0.95rem, 4.1vw, 1.1rem)', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
      >
        {slide.body}
      </p>
      <span className="sr-only">
        Slide {index + 1} of {count}
      </span>
    </figcaption>
  </figure>
);

const TRIAL_STEP = SLIDES.length;
const PLAN_STEP = SLIDES.length + 1;

type Plan = 'annual' | 'monthly';

type Props = {
  childName: string;
  onTakeTour: () => void;
  onTrialStarted: (plan: Plan) => void;
};

const NameTrialPaywall: React.FC<Props> = ({ childName, onTakeTour, onTrialStarted }) => {
  const { purchase } = useSubscription();
  const { subscribe } = useUser();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<Plan>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const first = childName.trim().split(/\s+/)[0] || 'Your child';
  const onSlides = step < TRIAL_STEP;
  const onTrial = step === TRIAL_STEP;
  const onPlans = step === PLAN_STEP;

  // The next hero is fetched while this one is on screen so advancing never pops.
  useEffect(() => {
    const next = SLIDES[step + 1];
    if (!next) return;
    const img = new Image();
    img.src = next.src;
  }, [step]);

  // Swipe left/right on the hero flips slides; vertical drags are left to the page.
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    setPayError('');
    if (dx < 0) setStep((current) => Math.min(current + 1, TRIAL_STEP));
    else setStep((current) => Math.max(0, current - 1));
  };

  const startPurchase = async () => {
    setPaying(true);
    setPayError('');
    try {
      const result = await purchase(plan);
      if (result.success) {
        subscribe();
        onTrialStarted(plan);
        return;
      }
      if (result.error === 'REDIRECT_TO_STRIPE') return;
      if (result.error && result.error !== 'Purchase cancelled') setPayError(result.error);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Could not start the trial');
    } finally {
      setPaying(false);
    }
  };

  const continueForward = () => {
    setPayError('');
    if (onPlans) {
      setShowParentGate(true);
      return;
    }
    setStep((current) => Math.min(current + 1, PLAN_STEP));
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      <div
        className="flex shrink-0 items-center px-3"
        style={{ paddingTop: 'max(10px, var(--safe-area-top, env(safe-area-inset-top, 0px)))' }}
      >
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="flex items-center gap-0.5 py-2 pr-3 font-black active:opacity-70"
            style={{ fontFamily: BUBBLE, color: NAVY }}
            aria-label="Back"
          >
            <ChevronLeft size={26} strokeWidth={2.6} />
            Back
          </button>
        ) : (
          <span className="h-11" />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {onSlides && (
          <div
            className="flex min-h-0 flex-1 items-center justify-center bg-white px-4 pb-2 pt-1"
            role="region"
            aria-roledescription="carousel"
            aria-label="What the trial includes"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { swipe.current = null; }}
            style={{ touchAction: 'pan-y' }}
          >
            <style>{`
              @keyframes gk-pitch-in{from{opacity:0;transform:scale(0.985)}to{opacity:1;transform:none}}
              .gk-pitch-stage{container-type:size}
              .gk-pitch-hero{width:100%;max-height:100%;aspect-ratio:4/5}
              .gk-pitch-hero{width:min(100%,80cqh)}
              @media (prefers-reduced-motion:reduce){.gk-pitch-hero figure{animation:none!important}}
            `}</style>
            <p className="sr-only" aria-live="polite">
              Slide {step + 1} of {SLIDES.length}: {SLIDES[step].title}. {SLIDES[step].body}
            </p>
            {/* 4:5 hero: as large as the stage allows without leaving the screen or losing its shape. */}
            <div className="gk-pitch-stage flex h-full w-full items-center justify-center">
              <div className="gk-pitch-hero">
                <HeroSlide key={SLIDES[step].src} slide={SLIDES[step]} index={step} count={SLIDES.length} />
              </div>
            </div>
          </div>
        )}

        {onTrial && (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4CC] text-[#C4840A]">
              <Bell size={36} strokeWidth={2.2} />
            </span>
            <h2
              className="font-black leading-tight"
              style={{ fontFamily: BUBBLE, color: NAVY, fontSize: 'clamp(1.7rem, 7vw, 2.2rem)' }}
            >
              {first}, we offer a {TRIAL_DAYS}-day free trial
            </h2>
            <p className="mt-4 max-w-sm text-lg font-semibold leading-relaxed text-[#3d5278]">
              We&apos;ll let you know 2 days before you&apos;re charged, so there are no surprises.
            </p>
          </div>
        )}

        {onPlans && (
          <div className="flex flex-1 flex-col items-center justify-center px-5">
            <h2
              className="text-center font-black leading-tight"
              style={{ fontFamily: BUBBLE, color: NAVY, fontSize: 'clamp(1.6rem, 6.5vw, 2.1rem)' }}
            >
              Choose yearly or monthly
            </h2>
            <p className="mt-2 text-center text-sm font-semibold text-[#3d5278]">
              Both plans start with a {TRIAL_DAYS}-day free trial.
            </p>
            <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
              <PlanCard
                selected={plan === 'annual'}
                onSelect={() => setPlan('annual')}
                badge="Best value"
                name="Yearly"
                price={`$${ANNUAL_PRICE_USD}`}
                detail={`$${(ANNUAL_PRICE_USD / 12).toFixed(2)}/month`}
              />
              <PlanCard
                selected={plan === 'monthly'}
                onSelect={() => setPlan('monthly')}
                name="Monthly"
                price={`$${MONTHLY_PRICE_USD}`}
                detail="per month"
              />
            </div>
          </div>
        )}
      </div>

      <div
        className="shrink-0 px-5 pt-3"
        style={{
          paddingBottom: 'max(16px, calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 12px))',
        }}
      >
        <div className="mb-3 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: PLAN_STEP + 1 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#E0A21A]' : 'w-1.5 bg-[#12264A]/20'}`}
            />
          ))}
        </div>
        {payError && (
          <p className="mb-2 text-center text-sm font-bold text-[#9a3412]">{payError}</p>
        )}
        <button
          type="button"
          onClick={continueForward}
          disabled={paying}
          className="flex w-full min-h-[56px] items-center justify-center rounded-full text-[1.15rem] font-black active:translate-y-0.5 disabled:opacity-70"
          style={{
            fontFamily: BUBBLE,
            background: GOLD,
            color: NAVY,
            boxShadow: '0 6px 0 #E0A21A',
          }}
        >
          {paying ? 'Opening checkout…' : onPlans ? 'Continue with Trial' : 'Continue'}
        </button>
        {onPlans && (
          <p className="mt-2 text-center text-xs font-semibold text-[#3d5278]">
            {TRIAL_DAYS}-day free trial, then $
            {plan === 'annual' ? `${ANNUAL_PRICE_USD}/year` : `${MONTHLY_PRICE_USD}/month`}. Cancel anytime.
          </p>
        )}
        <button
          type="button"
          onClick={onTakeTour}
          className="mt-1 w-full py-2.5 text-center text-[1.05rem] font-black active:opacity-70"
          style={{ fontFamily: BUBBLE, color: NAVY }}
        >
          Take a Tour
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
}> = ({ selected, onSelect, badge, name, price, detail }) => (
  <button
    type="button"
    onClick={onSelect}
    className="relative flex min-h-[132px] flex-col items-start rounded-2xl border-2 bg-white px-3 py-3 text-left active:scale-[0.98]"
    style={{
      borderColor: selected ? '#E0A21A' : 'rgba(18,38,74,0.12)',
      boxShadow: selected ? '0 0 0 3px rgba(255,196,61,0.45)' : 'none',
    }}
  >
    <span
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
      style={{
        background: selected ? GOLD : 'transparent',
        border: selected ? 'none' : '2px solid rgba(18,38,74,0.2)',
      }}
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
  </button>
);

export default NameTrialPaywall;
