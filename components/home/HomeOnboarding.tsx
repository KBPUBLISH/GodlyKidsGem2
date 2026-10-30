import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UnlockedCharacter } from '../../services/rewardsService';
import type { PlayersWorldResident } from '../../utils/playersWorld';
import { isOnboardingJourneyActive, markSailForStoryPending, resolveFirstStoryPackDestination } from '../../utils/onboardingJourney';
import { hasSeenAdamTour, markShipTourPending } from '../../utils/adamTour';
import { scopedKey } from '../../utils/profileScope';

/**
 * First visit to My Home.
 *
 * Part A lives here, on the parent page: no story friend yet → "read a story";
 * friends but nobody on the island → walk the kid through Drop off → tap the
 * grass. Once a friend is placed the island (homeworld/src/onboarding.jsx) runs
 * the guided tour; it reads and writes the same localStorage record, so the
 * flow resumes wherever it stopped and never nags a player who finished it.
 */
export const HOME_ONBOARDING_KEY = 'gk_home_onboarding_v1';
/** Per profile: every kid gets their own first visit (same scope as the island iframe). */
const onboardingKey = () => scopedKey(HOME_ONBOARDING_KEY);

export type HomeOnboardingRecord = {
  /** Where the flow is: the parent's gate steps, then the island tour, then done. */
  step?: 'story' | 'dropoff' | 'place' | 'tour' | 'done';
  /** Island tour step index (owned by the island). */
  tourStep?: number;
  done?: boolean;
  skipped?: boolean;
  /** Set when "Look around first" / Skip was tapped; the story card stays away for a while. */
  dismissedAt?: number;
  finishedAt?: number;
  updatedAt?: number;
};

export function readHomeOnboarding(): HomeOnboardingRecord | null {
  try {
    const raw = JSON.parse(localStorage.getItem(onboardingKey()) || 'null') as unknown;
    return raw && typeof raw === 'object' ? (raw as HomeOnboardingRecord) : null;
  } catch {
    return null;
  }
}

export function writeHomeOnboarding(patch: HomeOnboardingRecord): HomeOnboardingRecord {
  const next: HomeOnboardingRecord = { ...(readHomeOnboarding() || {}), ...patch, updatedAt: Date.now() };
  try {
    localStorage.setItem(onboardingKey(), JSON.stringify(next));
  } catch {
    /* private mode: remembered for this visit only */
  }
  return next;
}

/** "Look around first" hides the story card for this long. */
const STORY_CARD_SNOOZE_MS = 30 * 60 * 1000;
const CELEBRATE_MS = 1700;
const FRIENDS_AUTO_OPEN_MS = 900;

const FONT = "'Baloo 2', 'Fredoka', sans-serif";
const CARVED = '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)';
const WOOD = '/assets/images/wheel-background-wood.png';

type Props = {
  /** The island reported ready (gk-players-ready). */
  ready: boolean;
  collected: UnlockedCharacter[];
  residents: PlayersWorldResident[];
  /** A friend chosen with Drop off, waiting for a tap on the grass. */
  placing: { id: string; name: string } | null;
  friendsOpen: boolean;
  onOpenFriends: () => void;
  /** Post a message into the island iframe. */
  post: (message: Record<string, unknown>) => void;
};

type Phase = 'story' | 'dropoff' | 'place' | 'celebrate' | 'tour' | 'off';

const Plaque: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div
    className={`rounded-[22px] px-5 pb-4 pt-4 text-center ${className}`}
    style={{
      backgroundImage: `url(${WOOD})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      border: '3px solid #6B4423',
      boxShadow: '0 3px 0 #5c3a1a, 0 14px 36px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,230,180,0.35), inset 0 -4px 10px rgba(0,0,0,0.35)',
      ...style,
    }}
  >
    {children}
  </div>
);

const GoldButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', style, ...rest }) => (
  <button
    type="button"
    className={`min-h-[56px] rounded-full px-7 text-[19px] font-black text-[#7A3E12] active:translate-y-[3px] active:shadow-none ${className}`}
    style={{
      background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)',
      boxShadow: '0 4px 0 #E09020, 0 8px 18px rgba(0,0,0,0.3)',
      fontFamily: FONT,
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);

const HomeOnboarding: React.FC<Props> = ({ ready, collected, residents, placing, friendsOpen, onOpenFriends, post }) => {
  const navigate = useNavigate();
  const [record, setRecord] = useState<HomeOnboardingRecord | null>(() => {
    const existing = readHomeOnboarding();
    // Players who already have a few friends living here never asked for a tour: mark them done once.
    if (!existing && residents.length > 1) return writeHomeOnboarding({ step: 'done', done: true, skipped: true, finishedAt: Date.now() });
    return existing;
  });
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [dropRect, setDropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const prevResidents = useRef(residents.length);
  const autoOpened = useRef(false);
  const tourPosted = useRef(false);
  const openFriendsRef = useRef(onOpenFriends);
  openFriendsRef.current = onOpenFriends;

  const save = useCallback((patch: HomeOnboardingRecord) => setRecord(writeHomeOnboarding(patch)), []);

  // The island owns the tour; it writes done to the shared record and tells us.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === 'gk-onboarding-done') setRecord(readHomeOnboarding() || { step: 'done', done: true });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // A friend just came ashore: a short cheer, then the island tour begins.
  useEffect(() => {
    const before = prevResidents.current;
    prevResidents.current = residents.length;
    if (before === 0 && residents.length === 1 && !record?.done) {
      if (!hasSeenAdamTour()) markShipTourPending();
      const name = residents[0]?.name || 'Your friend';
      setCelebrating(name);
      const id = window.setTimeout(() => setCelebrating(null), CELEBRATE_MS);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [residents, record?.done]);

  const snoozed = !!record?.dismissedAt && Date.now() - record.dismissedAt < STORY_CARD_SNOOZE_MS;
  let phase: Phase = 'off';
  if (!record?.done) {
    if (collected.length === 0) phase = snoozed ? 'off' : 'story';
    else if (residents.length === 0) phase = placing ? 'place' : 'dropoff';
    else if (celebrating) phase = 'celebrate';
    else phase = 'tour';
  }

  // Keep the record's step in sync so a reload lands on the same guidance.
  useEffect(() => {
    if (phase === 'off' || phase === 'celebrate' || record?.done) return;
    if (record?.step !== phase) save({ step: phase, done: false });
  }, [phase, record?.step, save]);

  // Dropping off: open the Friends sheet for them once the island is up.
  useEffect(() => {
    if (phase !== 'dropoff' || !ready || friendsOpen || autoOpened.current) return;
    autoOpened.current = true;
    const id = window.setTimeout(() => openFriendsRef.current(), FRIENDS_AUTO_OPEN_MS);
    return () => window.clearTimeout(id);
  }, [phase, ready, friendsOpen]);

  // Follow the Drop off button so the pointer sits right on it (the sheet animates in and scrolls).
  useEffect(() => {
    if (phase !== 'dropoff' || !friendsOpen) {
      setDropRect(null);
      return;
    }
    let frame = 0;
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      const el = document.querySelector<HTMLElement>('[data-gk-dropoff]');
      const r = el?.getBoundingClientRect();
      const next = r && r.width ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
      setDropRect((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, friendsOpen]);

  // Start (or resume) the island tour once a friend lives here.
  useEffect(() => {
    if (phase !== 'tour' || !ready || tourPosted.current) return;
    tourPosted.current = true;
    post({ type: 'gk-onboarding', phase: 'tour' });
  }, [phase, ready, post]);

  const goGetACharacter = () => {
    markSailForStoryPending();
    navigate('/crew', { replace: true, state: { onboardingJourney: true, sailForStory: true } });
  };

  const readStory = async () => {
    if (opening) return;
    setOpening(true);
    save({ step: 'story', done: false });
    try {
      const dest = await resolveFirstStoryPackDestination();
      // Not the sign-up voyage: drop its flag so the story opens as a normal read.
      const state: Record<string, unknown> = { ...dest.state, fromMyHome: true };
      delete state.onboardingJourney;
      navigate(dest.path, { state });
    } catch {
      navigate('/map/beginnings/main', { state: { fromMyHome: true } });
    }
  };

  const lookAround = () => save({ step: 'story', done: false, dismissedAt: Date.now() });
  const skipAll = () => {
    save({ step: 'done', done: true, skipped: true, dismissedAt: Date.now() });
    if (!hasSeenAdamTour() && collected.length > 0) markShipTourPending();
    post({ type: 'gk-onboarding', phase: 'skip' });
  };

  if (phase === 'off' || phase === 'tour') return null;

  const nextFriend = collected.find((c) => !residents.some((r) => r.id === c.id)) || collected[0];
  const friendName = nextFriend?.name || 'your friend';
  const safeBottom = 'max(18px, calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 18px))';
  const safeTop = 'max(14px, calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 14px))';

  if (phase === 'story' && isOnboardingJourneyActive()) {
    return (
      <div
        className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, rgba(10,40,60,0.55) 0%, rgba(10,40,60,0.72) 100%)', paddingTop: safeTop, paddingBottom: safeBottom }}
        role="dialog"
        aria-label="You need a character"
      >
        <Plaque className="w-[min(88vw,360px)]">
          <span
            className="rounded-full px-3 py-0.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#7A3E12]"
            style={{ background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)', boxShadow: '0 3px 0 #E09020', fontFamily: FONT }}
          >
            Your island
          </span>
          <p className="mt-3 text-[26px] font-black leading-[1.1] text-[#F5E6C8]" style={{ fontFamily: FONT, textShadow: CARVED }}>
            You need a character.
          </p>
          <p className="mt-2 text-[17px] font-bold leading-snug text-[#F5E6C8]" style={{ fontFamily: FONT, textShadow: '0 1px 0 #3E1F07' }}>
            You wanna go get one?
          </p>
          <GoldButton className="mt-5 w-full" onClick={goGetACharacter}>
            Yeah, let’s go!
          </GoldButton>
        </Plaque>
      </div>
    );
  }

  if (phase === 'story') {
    return (
      <div
        className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, rgba(10,40,60,0.55) 0%, rgba(10,40,60,0.72) 100%)', paddingTop: safeTop, paddingBottom: safeBottom }}
        role="dialog"
        aria-label="Your island needs a friend"
      >
        <Plaque className="w-[min(88vw,360px)]">
          <span
            className="rounded-full px-3 py-0.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#7A3E12]"
            style={{ background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)', boxShadow: '0 3px 0 #E09020', fontFamily: FONT }}
          >
            My Friends
          </span>
          <p className="mt-3 text-[26px] font-black leading-[1.1] text-[#F5E6C8]" style={{ fontFamily: FONT, textShadow: CARVED }}>
            Your island needs a friend!
          </p>
          <p className="mt-2 text-[17px] font-bold leading-snug text-[#F5E6C8]" style={{ fontFamily: FONT, textShadow: '0 1px 0 #3E1F07' }}>
            Read your first story to meet one.
          </p>
          <GoldButton className="mt-5 w-full" onClick={() => void readStory()} disabled={opening} aria-busy={opening}>
            {opening ? 'Setting sail…' : '📖 Read a story'}
          </GoldButton>
          <button
            type="button"
            className="mt-3 min-h-[44px] px-4 text-[15px] font-bold text-[#F5E6C8]/85 underline underline-offset-4"
            style={{ fontFamily: FONT }}
            onClick={lookAround}
          >
            Look around first
          </button>
        </Plaque>
      </div>
    );
  }

  if (phase === 'celebrate') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center px-6" aria-live="polite" role="status">
        <style>{`@keyframes gk-home-cheer{0%{opacity:0;transform:scale(.7)}25%{opacity:1;transform:scale(1.06)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-14px)}}`}</style>
        <Plaque className="w-[min(84vw,330px)]" style={{ animation: `gk-home-cheer ${CELEBRATE_MS}ms ease-out both` }}>
          <p className="text-[30px]" aria-hidden>🎉</p>
          <p className="mt-1 text-[26px] font-black leading-tight text-[#F5E6C8]" style={{ fontFamily: FONT, textShadow: CARVED }}>
            {celebrating} is home!
          </p>
          <p className="mt-1 text-[15px] font-bold text-[#F5E6C8]/90" style={{ fontFamily: FONT }}>
            Let’s look around the island.
          </p>
        </Plaque>
      </div>
    );
  }

  // Drop-off coaching: a caption plus a pointer on the real Drop off button when the sheet is up.
  const caption =
    phase === 'place'
      ? `Tap the grass where ${placing?.name || friendName} should live.`
      : friendsOpen
        ? `Tap Drop off to bring ${friendName} to the island.`
        : `Tap Friends, then Drop off ${friendName}.`;
  const pointer = phase === 'dropoff' && friendsOpen && dropRect;
  return (
    <>
      <style>{`
        @keyframes gk-home-point{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-9px)}}
        @keyframes gk-home-ring{0%,100%{box-shadow:0 0 0 4px rgba(255,211,106,.55),0 0 22px rgba(255,178,61,.8)}50%{box-shadow:0 0 0 8px rgba(255,211,106,.25),0 0 30px rgba(255,178,61,.9)}}
        @keyframes gk-home-caption-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
      `}</style>
      {pointer && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed z-[85] rounded-full border-[3px] border-[#FFD36A]"
            style={{ left: dropRect.x - 6, top: dropRect.y - 6, width: dropRect.w + 12, height: dropRect.h + 12, animation: 'gk-home-ring 1.4s ease-in-out infinite' }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed z-[86] text-[34px] leading-none"
            style={{ left: dropRect.x + dropRect.w / 2, top: dropRect.y - 44, animation: 'gk-home-point 1s ease-in-out infinite', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.4))' }}
          >
            👇
          </div>
        </>
      )}
      <section
        className="fixed left-1/2 z-[86] w-[min(92vw,360px)] rounded-[18px] px-4 py-3 text-center text-[#3d2414]"
        style={{
          top: pointer ? undefined : safeTop,
          bottom: pointer ? `max(${window.innerHeight - dropRect.y + 56}px, 24px)` : undefined,
          background: '#fff8ee',
          border: '3px solid #e8d7ae',
          boxShadow: '0 5px 0 #8f9b7245, 0 10px 26px rgba(27,62,51,0.3)',
          animation: 'gk-home-caption-in .25s ease-out',
          transform: 'translateX(-50%)',
        }}
        role="status"
        aria-live="polite"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#8a5a32]" style={{ fontFamily: FONT }}>
          {phase === 'place' ? 'Almost home' : 'First friend'}
        </p>
        <p className="mt-1 text-[18px] font-black leading-snug" style={{ fontFamily: FONT }}>
          {caption}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {phase === 'dropoff' && !friendsOpen && (
            <GoldButton className="min-h-[46px] px-5 text-[16px]" onClick={onOpenFriends}>
              Open Friends
            </GoldButton>
          )}
          <button type="button" className="min-h-[44px] px-3 text-[14px] font-bold text-[#8a5a32] underline underline-offset-4" style={{ fontFamily: FONT }} onClick={skipAll}>
            Skip
          </button>
        </div>
      </section>
    </>
  );
};

export default HomeOnboarding;
