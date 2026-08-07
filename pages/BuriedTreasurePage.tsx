import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import { rewardsService, type RewardDefinition } from '../services/rewardsService';
import { useUser } from '../context/UserContext';
import WoodBackButton from '../components/WoodBackButton';

const FALLBACK_PATH = '/sail';
const GAME_SHELF_PATH = '/games/library';
const WHITE_FADE_MS = 480;
// Local, ad-free digging game bundled with the app — no external site.
const TREASURE_GAME_URL = '/games/buried-treasure.html';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nav state passed from the story pack (IslandScenePage rewards activity). */
type TreasureNavState = {
  storyId?: string;
  storyTitle?: string;
  pool?: RewardDefinition[];
  /** Story pack path to return to when history is empty. */
  returnTo?: string;
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
 */
const BuriedTreasurePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addCoins } = useUser();
  const navState = (location.state || {}) as TreasureNavState;
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
            def.type === 'book_template'
              ? def.bookCoverUrl || def.imageUrl
              : def.imageUrl,
        });
      }
    }
    cardsRef.current = cards;
    return cards;
  }, [addCoins]);

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

  // Reward bridge: game says the chest opened → send back what was inside.
  // The win card's "Go to Game Shelf" button posts gk-go-game-shelf.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'gk-go-game-shelf') {
        leaveWithFade(() => navigate(GAME_SHELF_PATH));
        return;
      }
      if (event.data?.type !== 'gk-chest-opened') return;
      const cards = collectCards();
      if (cards.length > 0) {
        frame.contentWindow?.postMessage(
          { type: 'gk-treasure-rewards', rewards: cards },
          window.location.origin,
        );
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [collectCards, leaveWithFade, navigate]);

  const goBackToStoryPack = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    clearTimers();

    const leave = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(navStateRef.current.returnTo || FALLBACK_PATH, { replace: true });
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

  return (
    <div
      className="relative h-[100dvh] min-h-0 bg-[#0b7fa6] flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
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
