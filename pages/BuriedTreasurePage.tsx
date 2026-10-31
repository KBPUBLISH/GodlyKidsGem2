import {livingFriendRecord,collectLivingFirstFriend} from '../utils/livingFirstFriend';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import {
  ensureOnboardingAdam,
  rewardsService,
  type RewardDefinition,
} from '../services/rewardsService';
import { useUser } from '../context/UserContext';
import WoodBackButton from '../components/WoodBackButton';
import OnboardingGuideCard from '../components/onboarding/OnboardingGuideCard';
import { completeOnboardingJourney, isOnboardingJourneyActive } from '../utils/onboardingJourney';
import { noteJourneyStep } from '../utils/journeyStudy';
import { safeAppReturnPath } from '../utils/treasureNav';

const WHITE_FADE_MS = 480;
// Local, ad-free digging game bundled with the app — no external site.
const TREASURE_GAME_URL = '/games/buried-treasure.html';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nav state passed from the story pack (IslandScenePage rewards activity). */
type TreasureNavState = {
  islandId?: string;
  storyId?: string;
  storyTitle?: string;
  pool?: RewardDefinition[];
  /** Story pack path to return to when history is empty. */
  returnTo?: string;
  /** First-time path: after the dig, HS invites them to meet the unlocked crew. */
  onboardingJourney?: boolean;
  packRequirements?:{hasQuizContent:boolean;hasTryIt:boolean};
};

/** Card shape sent into the game iframe (shown when the chest opens). */
type RewardCard = { name: string; imageUrl?: string };

/**
 * Buried Treasure digging game — reward reveal for story packs.
 * Route: /sail/treasure — entered from the island scene REWARDS activity.
 * When the in-game chest opens, the iframe posts `gk-chest-opened`; we collect
 * the unlocked rewards (persist + grant coins) and post `gk-treasure-rewards`
 * cards back so the game can show them. Opened directly (no nav state), the
 * game plays standalone with its generic treasure card.
 *
 * After the chest is claimed, the win card's "Continue" *replaces* this route
 * with the story pack the kid came from, so Back cannot remount a fresh dig.
 * If this page is reached again for an already-claimed story, bounce to the
 * story pack immediately.
 *
 * The screen is locked against the browser / webview refresh gestures: every
 * touch move on the shell is cancelled (the game does the same inside its
 * iframe), so a pull-down while digging can't reload the page.
 */
const BuriedTreasurePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addCoins } = useUser();
  const navState = (location.state || {}) as TreasureNavState;
  const friend= livingFriendRecord();
  const livingFriend=!!friend&&friend.islandId===navState.islandId&&friend.storyId===navState.storyId&&['pack','reading','reward','aboard'].includes(friend.phase);
  const onboardingJourney =
    !livingFriend&&(Boolean(navState.onboardingJourney) || isOnboardingJourneyActive());

  useEffect(() => {
    if (onboardingJourney) noteJourneyStep('treasure');
  }, [onboardingJourney]);

  // Snapshot on first mount only — collectCards() writes claimedKeys during
  // this visit, and that must not bounce the kid off the win screen.
  const [arrivedAlreadyClaimed] = useState(() => {
    const sid = (navState.storyId || '').trim();
    return Boolean(sid && rewardsService.hasCollectedStoryRewards(sid));
  });
  const [meetCrewGuide, setMeetCrewGuide] = useState(false);
  const [whiteFade, setWhiteFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timersRef = useRef<number[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const cardsRef = useRef<RewardCard[] | null>(null);
  const navStateRef = useRef(navState);
  navStateRef.current = navState;
  const reduceMotion = prefersReducedMotion();

  usePreventPullToRefresh(true);

  // Hard lock: overscroll-behavior alone doesn't stop iOS WebKit's pull-down
  // (Despia reload / rubber-band). Cancel every touch move that reaches the
  // shell — the back button and overlays don't scroll, so nothing is lost.
  // Touches inside the iframe are handled by the game's own touchmove guard.
  useEffect(() => {
    const cancel = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', cancel, { passive: false });
    return () => document.removeEventListener('touchmove', cancel);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setWhiteFade(false);
      return;
    }
    const id = window.setTimeout(() => setWhiteFade(false), 40);
    timersRef.current.push(id);
    return () => clearTimers();
  }, [clearTimers, reduceMotion]);

  /** Collect the story pack rewards once and build display cards. */
  const collectCards = useCallback((): RewardCard[] => {
    if (cardsRef.current) return cardsRef.current;
    const { storyId, storyTitle, pool } = navStateRef.current;
    const cards: RewardCard[] = [];
    if(livingFriend&&!islandStoryProgressService.arePackBeatsComplete(navStateRef.current.islandId!,storyId!,navStateRef.current.packRequirements||{hasQuizContent:true,hasTryIt:true}))return cards;
    if (storyId && Array.isArray(pool)) {
      for (const def of pool) {
        if (!def?.id) continue;
        const result = rewardsService.collectReward(storyId, def);
        let name = def.title || 'Reward';
        if (def.type === 'coins') {
          if (result.coinsGranted && result.coinsGranted > 0) {
            addCoins(
              result.coinsGranted,
              `Buried treasure — ${storyTitle || 'story pack'}`,
              'other',
            );
            name = `${result.coinsGranted} Gold Coins`;
          }
        }
        cards.push({
          name,
          imageUrl:
            def.type === 'coins'
              ? '/assets/ui/coin.png'
              : def.type === 'book_template'
                ? def.bookCoverUrl || def.imageUrl
                : def.imageUrl,
        });
      }
      const islandId =
        (navStateRef.current.islandId || '').trim() ||
        (/\/sail\/([^/?]+)/.exec(navStateRef.current.returnTo || '')?.[1] || '').trim();
      if (islandId) {
        islandStoryProgressService.markLootActivities(
          islandId,
          storyId,
          pool.map((d) => d?.type).filter(Boolean) as string[],
        );
      }
    }
    if(livingFriend&&collectLivingFirstFriend(navStateRef.current.islandId!,storyId!,navStateRef.current.packRequirements||{hasQuizContent:true,hasTryIt:true})&&!cards.some(c=>/^adam$/i.test(c.name)))cards.push({name:'Adam'});
    if (onboardingJourney) {
      ensureOnboardingAdam(storyId || 'onboarding-genesis', pool);
    }
    cardsRef.current = cards;
    return cards;
  }, [addCoins, onboardingJourney,livingFriend]);

  /** Fade to white, then run the navigation. */
  const leaveWithFade = useCallback(
    (leave: () => void) => {
      if (leaving) return;
      setLeaving(true);
      clearTimers();
      setWhiteFade(true);
      const id = window.setTimeout(leave, reduceMotion ? 80 : WHITE_FADE_MS);
      timersRef.current = [id];
    },
    [clearTimers, leaving, reduceMotion],
  );

  const goMeetCrew = useCallback(() => {
    completeOnboardingJourney();
    navigate('/my-home', { replace: true, state: { onboardingJourney: true } });
  }, [navigate]);

  // Reward bridge: game says the chest opened → send back what was inside.
  // The win card's "Continue" button posts gk-continue (older cached builds
  // of the game still post gk-go-game-shelf — treat it the same).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const type = event.data?.type;
      if (type === 'gk-continue' || type === 'gk-go-game-shelf') {
        if(livingFriend){if(livingFriendRecord()?.phase==='aboard')leaveWithFade(()=>navigate('/crew',{replace:true}));return;}
        if (onboardingJourney) {
          setMeetCrewGuide(true);
          return;
        }
        // Back to the story pack. Replace so the completed dig is not left
        // in history under it.
        const returnTo = safeAppReturnPath(navStateRef.current.returnTo);
        leaveWithFade(() => navigate(returnTo, { replace: true }));
        return;
      }
      if (event.data?.type !== 'gk-chest-opened') return;
      const cards = collectCards();
      if (cards.length > 0) {
        frame.contentWindow?.postMessage(
          {
            type: 'gk-treasure-rewards',
            rewards: cards,
            hideShelf: onboardingJourney,
          },
          window.location.origin,
        );
      }
      if (onboardingJourney) {
        const id = window.setTimeout(
          () => setMeetCrewGuide(true),
          reduceMotion ? 400 : 1600,
        );
        timersRef.current.push(id);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [collectCards, leaveWithFade, navigate, onboardingJourney, reduceMotion,livingFriend]);

  const goBackToStoryPack = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    clearTimers();

    const leave = () => {
      const returnTo = safeAppReturnPath(navStateRef.current.returnTo);
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(returnTo, { replace: true });
      }
    };

    if (reduceMotion) {
      setWhiteFade(true);
      const id = window.setTimeout(leave, 80);
      timersRef.current = [id];
      return;
    }

    setWhiteFade(true);
    const navId = window.setTimeout(leave, WHITE_FADE_MS);
    timersRef.current = [navId];
  }, [clearTimers, leaving, navigate, reduceMotion]);

  if(arrivedAlreadyClaimed&&livingFriend&&friend?.phase==='aboard')return <Navigate to="/crew" replace/>;
  if (arrivedAlreadyClaimed && !onboardingJourney&&!livingFriend) {
    return <Navigate to={safeAppReturnPath(navState.returnTo)} replace />;
  }

  return (
    <div
      className="relative h-[100dvh] min-h-0 bg-[#0b7fa6] flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {!onboardingJourney && (
        <WoodBackButton
          onClick={goBackToStoryPack}
          disabled={leaving}
          className="fixed z-[60] w-12 h-12"
          style={{
            bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
            left: 'max(10px, env(safe-area-inset-left, 0px))',
          }}
          aria-label="Back to story pack"
        />
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b7fa6] z-10">
          <div className="text-center">
            <Loader2 size={48} className="text-[#FFD166] animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Grabbing the shovel...</p>
          </div>
        </div>
      )}

      <div className="flex-1 relative min-h-0 overscroll-none" style={{ overscrollBehavior: 'none' }}>
        <iframe
          ref={iframeRef}
          src={TREASURE_GAME_URL}
          title="Buried Treasure"
          className="w-full h-full border-0 overscroll-none"
          allow="autoplay"
          onLoad={() => setLoading(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overscrollBehavior: 'none',
          }}
        />
      </div>

      {meetCrewGuide && (
        <div className="fixed inset-0 z-[80] bg-black/25" aria-hidden />
      )}
      <OnboardingGuideCard
        variant="quizComplete"
        active={meetCrewGuide}
        onContinue={goMeetCrew}
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 99980,
          background: '#fff',
          opacity: whiteFade ? 1 : 0,
          transition: reduceMotion ? 'none' : `opacity ${WHITE_FADE_MS}ms ease-in-out`,
        }}
        aria-hidden
      />
    </div>
  );
};

export default BuriedTreasurePage;
