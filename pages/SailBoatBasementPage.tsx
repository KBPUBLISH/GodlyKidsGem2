import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import {
  getBasementGameLockStates,
  refreshBasementGameLockStates,
} from '../utils/basementGameLocks';
import WoodBackButton from '../components/WoodBackButton';
import CrewChatPopup from '../components/crew/CrewChatPopup';
import { resolveBasementCharacters } from '../components/crew/basementCharacter';
import type { UnlockedCharacter } from '../services/rewardsService';

// Lazy — the three.js chunk only loads when a crew character has a GLB model.
const CrewDeck3D = React.lazy(() => import('../components/crew/CrewDeck3D'));

const BASEMENT_BG = '/assets/images/sail-boat-basement-bg.png';

const SPEED_POOL_GAME_PATH = '/sail/basement/game';
const DARTS_GAME_PATH = '/sail/basement/darts';

/** White fade duration for pool-table → game (and arrival reveal). */
const WHITE_FADE_MS = 480;
const TOAST_MS = 2200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Padlock + soft darkening + unlock hint over a locked game hotspot.
 * Gold badge matches the main-map story lock.
 */
const GameLockOverlay: React.FC<{ islandLabel: string }> = ({ islandLabel }) => (
  <span
    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none"
    aria-hidden
  >
    <span
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.24) 55%, rgba(0,0,0,0) 80%)',
      }}
    />
    <span
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: 42,
        height: 42,
        background: 'linear-gradient(180deg, #F0D78C 0%, #D4A017 45%, #8B6914 100%)',
        boxShadow:
          '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,240,200,0.55)',
        border: '1.5px solid #F5E6A3',
      }}
    >
      <Lock
        size={19}
        className="text-[#5c3a1a]"
        strokeWidth={2.8}
        fill="rgba(92,58,26,0.2)"
      />
    </span>
    <span
      className="relative px-2 font-display font-bold text-[11px] leading-tight text-[#FFE9B0] text-center"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)' }}
    >
      Complete {islandLabel}!
    </span>
  </span>
);

/**
 * Below-deck / sail boat basement — full-bleed lounge BG.
 * Entered from Crew deck hatch (white fade). Route: /sail/basement
 * Pool table hotspot → Speed Pool King in-app game.
 */
const SailBoatBasementPage: React.FC = () => {
  const navigate = useNavigate();
  const [whiteFade, setWhiteFade] = useState(true);
  const [enteringGame, setEnteringGame] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gameLocks, setGameLocks] = useState(getBasementGameLockStates);
  // 3D crew members currently located below deck — wander by the stairs.
  const [crewCharacters, setCrewCharacters] = useState<UnlockedCharacter[]>([]);
  const [chatCharacter, setChatCharacter] = useState<UnlockedCharacter | null>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    setCrewCharacters(resolveBasementCharacters());
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Arrive under white, then fade out to reveal the basement.
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

  // Refresh island story lists from the CMS so lock state stays accurate.
  useEffect(() => {
    const controller = new AbortController();
    refreshBasementGameLockStates(controller.signal)
      .then((states) => setGameLocks(states))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Fade to white, then return to the top deck (same pattern as the darts page).
  const goBack = useCallback(() => {
    if (enteringGame) return;
    setEnteringGame(true);
    setToast(null);
    clearTimers();

    const leave = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/crew');
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
  }, [clearTimers, enteringGame, navigate, reduceMotion]);

  const showPlaque = useCallback(
    (message: string) => {
      if (enteringGame) return;
      setToast(message);
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
    },
    [enteringGame],
  );

  const showComingSoon = useCallback(() => showPlaque('Coming soon!'), [showPlaque]);

  const openGame = useCallback(
    (path: string) => {
      if (enteringGame) return;
      setEnteringGame(true);
      setToast(null);
      clearTimers();

      if (reduceMotion) {
        setWhiteFade(true);
        const id = window.setTimeout(() => navigate(path), 80);
        timersRef.current = [id];
        return;
      }

      setWhiteFade(true);
      const navId = window.setTimeout(() => navigate(path), WHITE_FADE_MS);
      timersRef.current = [navId];
    },
    [clearTimers, enteringGame, navigate, reduceMotion],
  );

  const openPoolGame = useCallback(() => {
    if (gameLocks.pool.locked) {
      showPlaque(gameLocks.pool.message);
      return;
    }
    openGame(SPEED_POOL_GAME_PATH);
  }, [gameLocks.pool, openGame, showPlaque]);

  const openDartsGame = useCallback(() => {
    if (gameLocks.darts.locked) {
      showPlaque(gameLocks.darts.message);
      return;
    }
    openGame(DARTS_GAME_PATH);
  }, [gameLocks.darts, openGame, showPlaque]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <img
        src={BASEMENT_BG}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />

      {/* Crew members located below deck wander near the stairs.
          Tap → wood action menu (talk / dance), same as the deck. */}
      {crewCharacters.length > 0 && (
        <Suspense fallback={null}>
          <CrewDeck3D
            zone="basement"
            characters={crewCharacters}
            paused={!!chatCharacter || enteringGame}
            onCharacterTap={(character) => {
              // Tap → chat directly (dancing is jukebox-only, up on deck)
              if (!enteringGame) setChatCharacter(character);
            }}
          />
        </Suspense>
      )}

      <WoodBackButton
        onClick={goBack}
        disabled={enteringGame}
        className="fixed z-[60] w-12 h-12"
        style={{
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          left: 'max(10px, env(safe-area-inset-left, 0px))',
        }}
        aria-label="Back to ship deck"
      />

      {/* Pool table hotspot — center-left / lower half (glow baked into art). */}
      <button
        type="button"
        onClick={openPoolGame}
        disabled={enteringGame}
        aria-label={
          gameLocks.pool.locked ? `Locked — ${gameLocks.pool.message}` : 'Play Speed Pool King'
        }
        className="absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          left: '15%',
          top: '58%',
          width: '40%',
          height: '22%',
          cursor: enteringGame ? 'default' : 'pointer',
        }}
      >
        {gameLocks.pool.locked && (
          <GameLockOverlay islandLabel={gameLocks.pool.islandLabel} />
        )}
      </button>

      {/* Dartboard hotspot → Poptimez darts in-app game. */}
      <button
        type="button"
        onClick={openDartsGame}
        disabled={enteringGame}
        aria-label={
          gameLocks.darts.locked ? `Locked — ${gameLocks.darts.message}` : 'Play Poptimez darts'
        }
        className="absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          left: '1%',
          top: '37%',
          width: '23%',
          height: '19%',
          cursor: enteringGame ? 'default' : 'pointer',
        }}
      >
        {gameLocks.darts.locked && (
          <GameLockOverlay islandLabel={gameLocks.darts.islandLabel} />
        )}
      </button>

      {/* Arcade machine — placeholder */}
      <button
        type="button"
        onClick={showComingSoon}
        disabled={enteringGame}
        aria-label="Arcade — coming soon"
        className="absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          left: '55%',
          top: '40%',
          width: '14%',
          height: '18%',
          cursor: enteringGame ? 'default' : 'pointer',
        }}
      />

      {chatCharacter && (
        <CrewChatPopup character={chatCharacter} onClose={() => setChatCharacter(null)} />
      )}

      {toast && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 px-4 py-2.5 rounded-2xl font-display font-bold text-sm text-[#3d2414] text-center max-w-[85vw]"
          style={{
            bottom: 'max(28px, calc(var(--safe-area-bottom, 0px) + 16px))',
            background: 'linear-gradient(180deg, #F5E6C8 0%, #E8D4A8 100%)',
            boxShadow:
              '0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: '2px solid #8B6914',
          }}
          role="status"
        >
          {toast}
        </div>
      )}

      {/* White fade — arrival reveal + exit to game */}
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

export default SailBoatBasementPage;
