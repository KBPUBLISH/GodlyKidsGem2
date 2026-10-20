import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import {
  getBasementGameLockStates,
  refreshBasementGameLockStates,
} from '../utils/basementGameLocks';
import WoodBackButton from '../components/WoodBackButton';
import CrewChatPopup from '../components/crew/CrewChatPopup';
import CrewGuideCard from '../components/crew/CrewGuideCard';
import FeatureSpotlight from '../components/crew/FeatureSpotlight';
import { resolveBasementCharacters, setCrewLocation } from '../components/crew/basementCharacter';
import { getOnDeckCrew, type UnlockedCharacter } from '../services/rewardsService';
import type { CrewDeckHandle } from '../components/crew/CrewDeck3D';
import { setLibraryMode as persistLibraryMode } from '../utils/libraryMode';
import { markLibraryFromBasement } from '../utils/libraryFromBasement';
import { useUser } from '../context/UserContext';
import {
  ADAM_TOUR_FALLBACK_VOICE_ID,
  buildAdamBasementTour,
  buildAdamTourWrap,
  buildAdamSkipTrial,
  isAdamCharacter,
  armTourWrapFromLibrary,
  hasSeenAdamTour,
  isAdamFinaleDone,
  isTourWrapPending,
  markAdamTourSeen,
  markTourWrapDone,
} from '../utils/adamTour';

// Lazy — the three.js chunk only loads when a crew character can walk (GLB or still).
const CrewDeck3D = React.lazy(() => import('../components/crew/CrewDeck3D'));

const BASEMENT_BG = '/assets/images/sail-boat-basement-bg.jpg';

const SPEED_POOL_GAME_PATH = '/sail/basement/game';
const DARTS_GAME_PATH = '/sail/basement/darts';
const ARCADE_PATH = '/sail/basement/arcade';
const LIBRARY_PATH = '/listen';

/** Source art size — hotspots sit in this frame, object-cover aligned. */
const BASEMENT_ART = { width: 686, height: 1024 };

const HOTSPOT_BTN =
  'absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

type HotspotBox = { left: string; top: string; width: string; height: string };

/** Percent of the basement painting (not the cropped viewport). */
const HOTSPOTS: Record<'pool' | 'darts' | 'arcade' | 'library', HotspotBox> = {
  pool: { left: '18%', top: '52%', width: '48%', height: '24%' },
  darts: { left: '1%', top: '32%', width: '24%', height: '20%' },
  arcade: { left: '52%', top: '35%', width: '16%', height: '19%' },
  library: { left: '50%', top: '7%', width: '32%', height: '26%' },
};

/** White fade duration for pool-table → game (and arrival reveal). */
const WHITE_FADE_MS = 480;
const TOAST_MS = 2200;

/** Adam's tour card clears the back button in the bottom-left. */
const TOUR_CARD_BOTTOM = 'max(76px, calc(var(--safe-area-bottom, 0px) + 72px))';

/**
 * Adam's basement tour staging: where he stands (painting coords, 0–1,
 * inside the walkable floor by the stairs) and which hotspot lights up.
 * Copy lives in utils/adamTour.
 */
const BASEMENT_TOUR_STAGING: Record<string, { walkTo?: { x: number; y: number }; spot?: HotspotBox }> =
  {
    // The floor left of the stairs sits behind the tour card on phones, so
    // he shifts around the stair-base pocket and the rings do the pointing.
    welcome: {},
    // Floor to the right of the table — not on the felt.
    pool: { walkTo: { x: 0.74, y: 0.8 }, spot: HOTSPOTS.pool },
    darts: { walkTo: { x: 0.6, y: 0.68 }, spot: HOTSPOTS.darts },
    arcade: { walkTo: { x: 0.71, y: 0.71 }, spot: HOTSPOTS.arcade },
    library: { walkTo: { x: 0.66, y: 0.69 }, spot: HOTSPOTS.library },
  };

type AdamTour = {
  character: UnlockedCharacter;
  beatIndex: number;
  arrived: boolean;
};

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
 * Pool → Speed Pool King, darts → Poptimez, arcade → cabinet, bookshelf → Library.
 */
const SailBoatBasementPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { kids, currentProfileId } = useUser();
  const kidName = useMemo(() => {
    const fromProfile =
      currentProfileId && kids.find((k: { id?: string }) => k.id === currentProfileId);
    const named =
      fromProfile || kids.find((k: { name?: string }) => String(k?.name || '').trim());
    const first = String(named?.name || '').trim().split(/\s+/)[0];
    return first || undefined;
  }, [kids, currentProfileId]);
  const [whiteFade, setWhiteFade] = useState(true);
  const [enteringGame, setEnteringGame] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gameLocks, setGameLocks] = useState(getBasementGameLockStates);
  // 3D crew members currently located below deck — wander by the stairs.
  const [crewCharacters, setCrewCharacters] = useState<UnlockedCharacter[]>([]);
  const [chatCharacter, setChatCharacter] = useState<UnlockedCharacter | null>(null);
  const deckRef = useRef<CrewDeckHandle>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const reduceMotion = prefersReducedMotion();
  // Adam's first-tap tour continues here after he led the kid down the hatch.
  const [tourPending] = useState(
    () => Boolean((location.state as { adamTour?: boolean } | null)?.adamTour),
  );
  const [tour, setTour] = useState<AdamTour | null>(null);
  const tourRef = useRef<AdamTour | null>(null);
  tourRef.current = tour;
  const leaveToLibraryRef = useRef<() => void>(() => undefined);
  // After the tour, keep the Library glowing with a Tap cue until a hotspot is used.
  const [libraryCue, setLibraryCue] = useState(false);
  const libraryCueRef = useRef(false);
  libraryCueRef.current = libraryCue;
  const tourBeats = useMemo(
    () => buildAdamBasementTour(kidName, { pool: gameLocks.pool, darts: gameLocks.darts }),
    [kidName, gameLocks.pool, gameLocks.darts],
  );
  const tourBeatsRef = useRef(tourBeats);
  tourBeatsRef.current = tourBeats;
  const tourBeat = tour ? tourBeats[Math.min(tour.beatIndex, tourBeats.length - 1)] : null;
  const tourStaging = tourBeat ? BASEMENT_TOUR_STAGING[tourBeat.id] : null;
  // Closing speech after they visit the library and come back.
  const [wrap, setWrap] = useState<AdamTour | null>(null);
  const wrapRef = useRef<AdamTour | null>(null);
  wrapRef.current = wrap;
  const wrapBeats = useMemo(() => buildAdamTourWrap(kidName), [kidName]);
  const skipTrialDue = Boolean(
    (location.state as { adamSkipTrial?: boolean } | null)?.adamSkipTrial,
  );
  const [skipAdam, setSkipAdam] = useState<AdamTour | null>(null);
  const skipAdamRef = useRef<AdamTour | null>(null);
  skipAdamRef.current = skipAdam;
  const skipBeats = useMemo(() => buildAdamSkipTrial(kidName), [kidName]);
  const hotspotsLocked = enteringGame || !!tour || !!wrap || !!skipAdam;

  useEffect(() => {
    setCrewCharacters(resolveBasementCharacters());
  }, []);

  // Kick the tour off once the white arrival fade has lifted.
  useEffect(() => {
    if (!tourPending) return;
    const adam =
      resolveBasementCharacters().find(isAdamCharacter) ||
      getOnDeckCrew().find(isAdamCharacter);
    if (!adam) return;
    // Drop the flag from history so a later back-navigation can't replay it.
    navigate('/sail/basement', { replace: true, state: null });
    const id = window.setTimeout(
      () => setTour({ character: adam, beatIndex: 0, arrived: false }),
      reduceMotion ? 120 : WHITE_FADE_MS + 250,
    );
    return () => window.clearTimeout(id);
  }, [tourPending, navigate, reduceMotion]);

  // Each beat: walk Adam to the spot (he faces the camera and talks on
  // arrival), or talk in place; falls back to card-only without a walker.
  useEffect(() => {
    if (!tour || tour.arrived) return;
    const staging = BASEMENT_TOUR_STAGING[tourBeats[tour.beatIndex]?.id ?? ''] ?? {};
    const id = tour.character.id;
    const beatIndex = tour.beatIndex;
    const arrive = () =>
      setTour((t) => (t && t.beatIndex === beatIndex ? { ...t, arrived: true } : t));
    let tries = 0;
    let cancelled = false;
    const attempt = () => {
      if (cancelled) return true;
      tries += 1;
      const deck = deckRef.current;
      const ok = staging.walkTo
        ? deck?.walkTo(id, staging.walkTo, arrive)
        : deck?.talk(id)
          ? (arrive(), true)
          : false;
      if (ok) return true;
      if (tries > 20 || reduceMotion) {
        arrive();
        return true;
      }
      return false;
    };
    if (attempt()) return;
    const timer = window.setInterval(() => {
      if (attempt()) window.clearInterval(timer);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tour, tourBeats, reduceMotion]);

  // They left the library and landed back here — Adam closes the tour, then the offer.
  const wrapDue =
    Boolean((location.state as { adamTourWrap?: boolean } | null)?.adamTourWrap) ||
    isTourWrapPending();
  useEffect(() => {
    if (tourPending || tour || wrapRef.current || !wrapDue) return;
    let cancelled = false;
    let timer = 0;
    const begin = (adam: UnlockedCharacter) => {
      if (cancelled || wrapRef.current) return;
      setCrewLocation(adam.id, { loc: 'basement' });
      setCrewCharacters(resolveBasementCharacters());
      setWrap({ character: adam, beatIndex: 0, arrived: false });
    };
    const findAdam = () =>
      resolveBasementCharacters().find(isAdamCharacter) ||
      getOnDeckCrew().find(isAdamCharacter) ||
      null;
    const ready = findAdam();
    if (ready) {
      timer = window.setTimeout(() => begin(ready), reduceMotion ? 120 : WHITE_FADE_MS + 250);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    let tries = 0;
    timer = window.setInterval(() => {
      tries += 1;
      const adam = findAdam();
      if (!adam && tries < 20) return;
      window.clearInterval(timer);
      if (adam) begin(adam);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tourPending, tour, reduceMotion, wrapDue, location.key]);

  useEffect(() => {
    if (!wrap || wrap.arrived) return;
    const id = wrap.character.id;
    const beatIndex = wrap.beatIndex;
    const arrive = () =>
      setWrap((w) => (w && w.beatIndex === beatIndex ? { ...w, arrived: true } : w));
    let tries = 0;
    let cancelled = false;
    const attempt = () => {
      if (cancelled) return true;
      tries += 1;
      const deck = deckRef.current;
      if (deck?.talk(id)) {
        arrive();
        return true;
      }
      if (tries > 20 || reduceMotion) {
        arrive();
        return true;
      }
      return false;
    };
    if (attempt()) return;
    const timer = window.setInterval(() => {
      if (attempt()) window.clearInterval(timer);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [wrap, reduceMotion]);

  useEffect(() => {
    if (!skipTrialDue || tourPending || tour || wrap || skipAdamRef.current) return;
    let cancelled = false;
    let timer = 0;
    const begin = (adam: UnlockedCharacter) => {
      if (cancelled || skipAdamRef.current) return;
      setCrewLocation(adam.id, { loc: 'basement' });
      setCrewCharacters(resolveBasementCharacters());
      setSkipAdam({ character: adam, beatIndex: 0, arrived: false });
    };
    const findAdam = () =>
      resolveBasementCharacters().find(isAdamCharacter) ||
      getOnDeckCrew().find(isAdamCharacter) ||
      null;
    const ready = findAdam();
    if (ready) {
      timer = window.setTimeout(() => begin(ready), reduceMotion ? 80 : 280);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    let tries = 0;
    timer = window.setInterval(() => {
      tries += 1;
      const adam = findAdam();
      if (!adam && tries < 20) return;
      window.clearInterval(timer);
      if (adam) begin(adam);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [skipTrialDue, tourPending, tour, wrap, reduceMotion, location.key]);

  useEffect(() => {
    if (!skipAdam || skipAdam.arrived) return;
    const id = skipAdam.character.id;
    const arrive = () => setSkipAdam((s) => (s ? { ...s, arrived: true } : s));
    let tries = 0;
    let cancelled = false;
    const attempt = () => {
      if (cancelled) return true;
      tries += 1;
      if (deckRef.current?.talk(id) || tries > 20 || reduceMotion) {
        arrive();
        return true;
      }
      return false;
    };
    if (attempt()) return;
    const timer = window.setInterval(() => {
      if (attempt()) window.clearInterval(timer);
    }, 150);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [skipAdam, reduceMotion]);

  const dismissSkipAdam = useCallback(() => {
    const s = skipAdamRef.current;
    if (!s) return;
    setSkipAdam(null);
    deckRef.current?.stopTalk(s.character.id);
    navigate('/sail/basement', { replace: true, state: {} });
  }, [navigate]);

  const finishWrap = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    markTourWrapDone();
    setWrap(null);
    deckRef.current?.stopTalk(w.character.id);
    navigate('/onboarding/welcome', {
      state: { returnTo: '/sail/basement', reason: 'adam-offer' },
    });
  }, [navigate]);

  const advanceWrap = useCallback(() => {
    const w = wrapRef.current;
    if (!w) return;
    const next = wrapBeats[w.beatIndex + 1];
    // The offer itself is the 4-screen challenge intro.
    if (!next || next.id === 'offer') {
      finishWrap();
      return;
    }
    setWrap({ ...w, beatIndex: w.beatIndex + 1, arrived: false });
  }, [finishWrap, wrapBeats]);

  const finishTour = useCallback((reason: 'done' | 'skip') => {
    const t = tourRef.current;
    if (!t) return;
    markAdamTourSeen();
    setTour(null);
    deckRef.current?.stopTalk(t.character.id);
    if (reason === 'skip') {
      markTourWrapDone();
      navigate('/onboarding/welcome', {
        state: { returnTo: '/sail/basement', reason: 'skip-tour' },
      });
      return;
    }
    setLibraryCue(true);
  }, [navigate]);

  const advanceTour = useCallback(() => {
    const t = tourRef.current;
    if (!t) return;
    if (t.beatIndex >= tourBeatsRef.current.length - 1) {
      leaveToLibraryRef.current();
      return;
    }
    setTour({ ...t, beatIndex: t.beatIndex + 1, arrived: false });
  }, []);

  useEffect(() => {
    if (!chatCharacter) {
      deckRef.current?.stopTalk();
      return;
    }
    if (reduceMotion) return;
    const idToTalk = chatCharacter.id;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (deckRef.current?.talk(idToTalk) || tries > 25) {
        window.clearInterval(id);
      }
    }, 120);
    return () => {
      window.clearInterval(id);
      deckRef.current?.stopTalk(idToTalk);
    };
  }, [chatCharacter, reduceMotion]);

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
      navigate('/crew');
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

  const openGame = useCallback(
    (path: string, state?: Record<string, unknown>) => {
      if (enteringGame) return;
      setEnteringGame(true);
      setLibraryCue(false);
      setToast(null);
      clearTimers();

      const go = () => (state ? navigate(path, { state }) : navigate(path));

      if (reduceMotion) {
        setWhiteFade(true);
        const id = window.setTimeout(go, 80);
        timersRef.current = [id];
        return;
      }

      setWhiteFade(true);
      const navId = window.setTimeout(go, WHITE_FADE_MS);
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

  const openArcade = useCallback(() => openGame(ARCADE_PATH), [openGame]);

  const leaveToLibrary = useCallback(() => {
    armTourWrapFromLibrary();
    const t = tourRef.current;
    if (t) {
      markAdamTourSeen();
      deckRef.current?.stopTalk(t.character.id);
      setTour(null);
    }
    setLibraryCue(false);
    persistLibraryMode('read');
    markLibraryFromBasement();
    openGame(LIBRARY_PATH, { libraryMode: 'read', from: '/sail/basement' });
  }, [openGame]);
  leaveToLibraryRef.current = leaveToLibrary;

  const openLibrary = useCallback(() => {
    const beatId = tourRef.current
      ? tourBeatsRef.current[tourRef.current.beatIndex]?.id
      : null;
    if (libraryCueRef.current || beatId === 'library') {
      leaveToLibrary();
      return;
    }
    if (!isAdamFinaleDone() && hasSeenAdamTour()) armTourWrapFromLibrary();
    persistLibraryMode('read');
    markLibraryFromBasement();
    openGame(LIBRARY_PATH, { libraryMode: 'read', from: '/sail/basement' });
  }, [leaveToLibrary, openGame]);

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
            ref={deckRef}
            zone="basement"
            characters={crewCharacters}
            paused={!!chatCharacter || enteringGame}
            onCharacterTap={(character) => {
              // Tap → chat directly (dancing is jukebox-only, up on deck);
              // parked while Adam is mid-tour.
              if (!enteringGame && !tourRef.current && !wrapRef.current) setChatCharacter(character);
            }}
          />
        </Suspense>
      )}

      <WoodBackButton
        onClick={goBack}
        disabled={hotspotsLocked}
        className="fixed z-[60] w-12 h-12"
        style={{
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          left: 'max(10px, env(safe-area-inset-left, 0px))',
        }}
        aria-label="Back to ship deck"
      />

      {/* Hotspots share the painting's object-cover frame so they stay on the glows. */}
      <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: `max(100%, calc(100vh * ${BASEMENT_ART.width / BASEMENT_ART.height}))`,
            height: `max(100%, calc(100vw * ${BASEMENT_ART.height / BASEMENT_ART.width}))`,
          }}
        >
          {/* Pool table — center (glow baked into art). */}
          <button
            type="button"
            onClick={openPoolGame}
            disabled={hotspotsLocked}
            aria-label={
              gameLocks.pool.locked ? `Locked — ${gameLocks.pool.message}` : 'Play Speed Pool King'
            }
            className={HOTSPOT_BTN}
            style={{ ...HOTSPOTS.pool, cursor: hotspotsLocked ? 'default' : 'pointer' }}
          >
            {gameLocks.pool.locked && (
              <GameLockOverlay islandLabel={gameLocks.pool.islandLabel} />
            )}
          </button>

          {/* Dartboard → Poptimez darts. */}
          <button
            type="button"
            onClick={openDartsGame}
            disabled={hotspotsLocked}
            aria-label={
              gameLocks.darts.locked ? `Locked — ${gameLocks.darts.message}` : 'Play Poptimez darts'
            }
            className={HOTSPOT_BTN}
            style={{ ...HOTSPOTS.darts, cursor: hotspotsLocked ? 'default' : 'pointer' }}
          >
            {gameLocks.darts.locked && (
              <GameLockOverlay islandLabel={gameLocks.darts.islandLabel} />
            )}
          </button>

          {/* Arcade cabinet → CMS arcade games (3×3 menu). */}
          <button
            type="button"
            onClick={openArcade}
            disabled={hotspotsLocked}
            aria-label="Play arcade"
            className={HOTSPOT_BTN}
            style={{ ...HOTSPOTS.arcade, cursor: hotspotsLocked ? 'default' : 'pointer' }}
          />

          {/* Mezzanine bookshelf → Library (Read). */}
          <button
            type="button"
            onClick={openLibrary}
            disabled={hotspotsLocked && !(tour?.arrived && tourBeat?.id === 'library')}
            aria-label="Open the library"
            className={HOTSPOT_BTN}
            style={{
              ...HOTSPOTS.library,
              cursor:
                hotspotsLocked && !(tour?.arrived && tourBeat?.id === 'library')
                  ? 'default'
                  : 'pointer',
            }}
          />

          {/* Adam's tour: ring on the feature he's describing; after the tour
              the Library keeps glowing with a Tap cue until a hotspot is used. */}
          {tourStaging?.spot && tour?.arrived && <FeatureSpotlight box={tourStaging.spot} />}
          {libraryCue && !tour && !enteringGame && (
            <FeatureSpotlight box={HOTSPOTS.library} label="Tap" />
          )}
        </div>
      </div>

      {tour && (
        <CrewGuideCard
          character={tour.character}
          voiceId={tour.character.voiceId || ADAM_TOUR_FALLBACK_VOICE_ID}
          beats={tourBeats}
          beatIndex={tour.beatIndex}
          speaking={tour.arrived}
          onAdvance={advanceTour}
          onSkip={() => finishTour('skip')}
          bottom={TOUR_CARD_BOTTOM}
          lastBeatHint="Tap to explore"
        />
      )}

      {wrap && !tour && !skipAdam && (
        <CrewGuideCard
          character={wrap.character}
          voiceId={wrap.character.voiceId || ADAM_TOUR_FALLBACK_VOICE_ID}
          beats={wrapBeats}
          beatIndex={wrap.beatIndex}
          speaking={wrap.arrived}
          onAdvance={advanceWrap}
          onSkip={finishWrap}
          bottom={TOUR_CARD_BOTTOM}
          lastBeatHint="See the offer"
        />
      )}

      {skipAdam && !tour && (
        <CrewGuideCard
          character={skipAdam.character}
          voiceId={skipAdam.character.voiceId || ADAM_TOUR_FALLBACK_VOICE_ID}
          beats={skipBeats}
          beatIndex={0}
          speaking={skipAdam.arrived}
          onAdvance={dismissSkipAdam}
          onSkip={dismissSkipAdam}
          bottom={TOUR_CARD_BOTTOM}
          lastBeatHint="Back to the ship"
        />
      )}

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
