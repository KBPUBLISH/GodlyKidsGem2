import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import WoodBackButton from '../components/WoodBackButton';
import { ApiService } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { rewardsService } from '../services/rewardsService';
import { type ArcadeTile, mergeArcadeCatalog } from '../utils/arcadeCatalog';
import { goldCoinCost } from '../utils/arcadeGoldPrice';
import { toKidSafeGameUrl } from '../utils/kidSafeGameIframe';
import { isGamePurchased, markGamePurchased } from '../utils/purchasedGames';

const BASEMENT_PATH = '/sail/basement';
const CREW_PATH = '/crew';
const WHITE_FADE_MS = 480;
const MIN_SLOTS = 9;
const COIN_IMG = '/assets/ui/coin.png';

type ArcadeNavState = {
  fromShip?: boolean;
  fromCompletedTreasure?: boolean;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pixel arcade cabinet — CMS arcade titles plus story-pack unlocks.
 * Gold-coin priced CMS titles stay locked until purchased (or earned in a pack).
 * Route: /sail/basement/arcade
 */
const SailBoatArcadePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as ArcadeNavState;
  const visitCrewOnBack = Boolean(navState.fromShip || navState.fromCompletedTreasure);
  const { coins, spendCoins } = useUser();
  const [whiteFade, setWhiteFade] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [tiles, setTiles] = useState<ArcadeTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUnlock, setPendingUnlock] = useState<ArcadeTile | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const reduceMotion = prefersReducedMotion();

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

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    ApiService.getArcadeGames({ forceRefresh: true })
      .then((data) => {
        if (cancelled) return;
        setTiles(
          mergeArcadeCatalog(
            Array.isArray(data) ? data : [],
            rewardsService.getUnlockedGames(),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTiles(mergeArcadeCatalog([], rewardsService.getUnlockedGames()));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = useMemo(() => {
    const out: Array<ArcadeTile | null> = [...tiles];
    while (out.length < MIN_SLOTS) out.push(null);
    return out;
  }, [tiles]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const goBack = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setPendingUnlock(null);
    clearTimers();

    const leave = () => {
      if (visitCrewOnBack) {
        navigate(CREW_PATH, { replace: true, state: { greetWave: true } });
        return;
      }
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(BASEMENT_PATH, { replace: true });
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
  }, [clearTimers, leaving, navigate, reduceMotion, visitCrewOnBack]);

  const playGame = useCallback(
    (game: ArcadeTile) => {
      if (!game.url) {
        showToast('This cabinet is empty!');
        return;
      }
      if (game.rewardId) {
        rewardsService.markGameSeen(game.rewardId);
        setTiles((prev) =>
          prev.map((t) => (t.rewardId === game.rewardId ? { ...t, isNew: false } : t)),
        );
      }
      if (game.gameId || game._id) {
        markGamePurchased(game.gameId, game._id);
      }
      const playUrl = toKidSafeGameUrl(game.url);
      navigate(`/game?url=${encodeURIComponent(playUrl)}&name=${encodeURIComponent(game.name)}`);
    },
    [navigate, showToast],
  );

  const coinCost = (game: ArcadeTile) => goldCoinCost(game);

  const onTileTap = (game: ArcadeTile) => {
    if (leaving) return;
    const cost = coinCost(game);
    const locked =
      game.source === 'cms' &&
      cost > 0 &&
      !isGamePurchased(game.gameId, game._id);
    if (locked) {
      setPendingUnlock(game);
      return;
    }
    playGame(game);
  };

  const confirmUnlock = () => {
    if (!pendingUnlock) return;
    const cost = coinCost(pendingUnlock);
    if (cost > coins) {
      showToast(`Need ${cost} gold coins! You have ${coins}.`);
      setPendingUnlock(null);
      return;
    }
    const spent = spendCoins(cost, `Unlocked arcade game: ${pendingUnlock.name}`);
    if (!spent) {
      showToast('Not enough gold coins!');
      setPendingUnlock(null);
      return;
    }
    markGamePurchased(pendingUnlock.gameId, pendingUnlock._id);
    setPendingUnlock(null);
    playGame(pendingUnlock);
  };

  return (
    <div
      className="relative h-[100dvh] min-h-0 flex flex-col overflow-hidden overscroll-none arcade-pixel"
      style={{ overscrollBehavior: 'none', background: '#0b0718' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        .arcade-pixel, .arcade-pixel button, .arcade-pixel p, .arcade-pixel h1 {
          font-family: 'Press Start 2P', ui-monospace, monospace;
        }
        .arcade-scanlines {
          background: repeating-linear-gradient(
            to bottom,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0) 2px,
            rgba(0,0,0,0.18) 3px
          );
          pointer-events: none;
        }
        .arcade-crt {
          box-shadow:
            inset 0 0 40px rgba(0,255,140,0.12),
            inset 0 0 80px rgba(0,0,0,0.45),
            0 0 0 4px #1a1230,
            0 0 0 8px #3d2a14,
            0 8px 0 #24180c;
        }
      `}</style>

      <WoodBackButton
        onClick={goBack}
        disabled={leaving}
        className="fixed z-[60] w-12 h-12"
        style={{
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          left: 'max(10px, env(safe-area-inset-left, 0px))',
        }}
        aria-label={visitCrewOnBack ? 'Back to crew' : 'Back to basement'}
      />

      <div
        className="flex items-center justify-between px-4 pt-3 pb-2"
        style={{ paddingTop: 'max(12px, var(--safe-area-top, 0px))' }}
      >
        <h1
          className="text-[#7CFFB2] text-[11px] sm:text-xs tracking-widest"
          style={{ textShadow: '0 0 8px #3dff9a, 0 2px 0 #063' }}
        >
          ARCADE
        </h1>
        <div className="flex items-center gap-1.5 bg-black/40 border-2 border-[#7CFFB2]/40 px-2 py-1">
          <img src={COIN_IMG} alt="" className="w-5 h-5" draggable={false} />
          <span className="text-[#FFD24A] text-[10px]">{coins}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-20 flex items-center justify-center">
        <div className="arcade-crt relative w-full max-w-[420px] aspect-square bg-[#05140e] p-3 sm:p-4">
          <div className="arcade-scanlines absolute inset-0 z-10 rounded-sm" aria-hidden />
          {loading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <p className="text-[#7CFFB2] text-[10px] animate-pulse">LOADING...</p>
            </div>
          ) : (
            <div className="relative z-20 h-full w-full overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-3 gap-2 min-h-full">
              {slots.map((game, i) => {
                if (!game) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square bg-[#03100b] border-2 border-[#0d3a28] flex items-center justify-center"
                      aria-hidden
                    >
                      <span className="text-[#0d3a28] text-[8px]">---</span>
                    </div>
                  );
                }
                const cost = coinCost(game);
                const isLocked =
                  game.source === 'cms' &&
                  cost > 0 &&
                  !isGamePurchased(game.gameId, game._id);
                return (
                  <button
                    key={game.key}
                    type="button"
                    onClick={() => onTileTap(game)}
                    disabled={leaving}
                    aria-label={
                      isLocked
                        ? `${game.name} — ${cost} gold coins to unlock`
                        : `Play ${game.name}`
                    }
                    className="relative aspect-square overflow-hidden border-2 border-[#7CFFB2]/70 bg-[#0a1f16] p-0 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD24A]"
                    style={{ imageRendering: 'pixelated' }}
                  >
                    {game.art ? (
                      <img
                        src={game.art}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[#7CFFB2] text-[8px] px-1 text-center leading-tight">
                        {game.name}
                      </span>
                    )}
                    <span
                      className="absolute bottom-0 inset-x-0 bg-black/75 text-[#FFEEA8] text-[7px] leading-tight px-0.5 py-0.5 truncate"
                    >
                      {game.name}
                    </span>
                    {game.isNew && !isLocked && (
                      <span className="absolute top-0.5 right-0.5 bg-[#FF2D6A] text-white text-[6px] px-0.5 leading-tight">
                        NEW
                      </span>
                    )}
                    {isLocked && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55">
                        <Lock size={16} className="text-[#FFD24A]" strokeWidth={2.6} />
                        <span className="flex items-center gap-0.5 text-[#FFD24A] text-[8px]">
                          <img src={COIN_IMG} alt="" className="w-3 h-3" />
                          {cost}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingUnlock && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/70">
          <div className="w-full max-w-xs bg-[#12081c] border-4 border-[#7CFFB2] p-4 text-center">
            <p className="text-[#7CFFB2] text-[10px] leading-relaxed mb-3">
              Unlock {pendingUnlock.name} for {coinCost(pendingUnlock)} gold coins?
            </p>
            <p className="text-[#FFD24A] text-[9px] mb-4">You have {coins}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingUnlock(null)}
                className="flex-1 py-2 bg-[#2a2038] text-[#ccc] text-[9px] border-2 border-[#554]"
              >
                NO
              </button>
              <button
                type="button"
                onClick={confirmUnlock}
                className="flex-1 py-2 bg-[#145c38] text-[#7CFFB2] text-[9px] border-2 border-[#7CFFB2]"
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="absolute left-1/2 z-40 -translate-x-1/2 px-3 py-2 bg-[#12081c] border-2 border-[#FFD24A] text-[#FFD24A] text-[9px] text-center max-w-[85vw] leading-relaxed"
          style={{ bottom: 'max(28px, calc(var(--safe-area-bottom, 0px) + 16px))' }}
          role="status"
        >
          {toast}
        </div>
      )}

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

export default SailBoatArcadePage;
