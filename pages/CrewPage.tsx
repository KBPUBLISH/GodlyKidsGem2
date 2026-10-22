import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Users } from 'lucide-react';
import {
  CREW_WAVE_ANIMATION,
  getOnDeckCrew,
  rewardsService,
  type UnlockedCharacter,
} from '../services/rewardsService';
import CrewPickerDropdown from '../components/rewards/CrewPickerDropdown';
import CrewChatPopup from '../components/crew/CrewChatPopup';
import CrewGuideCard from '../components/crew/CrewGuideCard';
import FeatureSpotlight from '../components/crew/FeatureSpotlight';
import type { CrewDeckHandle } from '../components/crew/CrewDeck3D';
import { BASEMENT_CHARACTER_KEY, canWalkOnDeck } from '../components/crew/basementCharacter';
import { danceMusic } from '../services/danceMusicService';
import { useUser } from '../context/UserContext';
import {
  getBasementGameLockStates,
  refreshBasementGameLockStates,
} from '../utils/basementGameLocks';
import {
  completeOnboardingJourney,
  isOnboardingJourneyActive,
} from '../utils/onboardingJourney';
import { noteBoatSession, noteJourneyStep } from '../utils/journeyStudy';
import {
  ADAM_TOUR_FALLBACK_VOICE_ID,
  buildAdamDeckTour,
  hasSeenAdamTour,
  isAdamCharacter,
  dismissLegacyTutorialForChallenge,
  markAdamTourSeen,
  markTourWrapDone,
  resetAdamTourWrap,
} from '../utils/adamTour';
import OnboardingGuideCard from '../components/onboarding/OnboardingGuideCard';

// three.js deck is lazy-loaded so the ~600KB 3D chunk only downloads when a
// crew character has a GLB or a still image that can walk as a billboard.
const CrewDeck3D = React.lazy(() => import('../components/crew/CrewDeck3D'));
// Avatar Builder Shop — opened from the cabin door at the bow.
const ShopModal = React.lazy(() => import('../components/features/ShopModal'));

/**
 * Ship deck art (1008×1344). This version paints its own sky, jukebox,
 * cannon, hatch, and cabin door, so the DOM only adds tap targets.
 * Hotspot percentages below assume a phone-portrait object-cover crop.
 */
const CREW_SHIP_DECK_SHIP = '/assets/images/crew-ship-deck-v2.jpg';
/** The art is opaque — skip the animated CSS sky/ocean slot behind it. */
const SHIP_ART_HAS_SKY = true;

/* --------------------------------------------------------------------------
 * Animated sky + ocean backdrop (fills the slot behind the transparent ship;
 * a real sky <video> can still replace this whole block later).
 * Clouds reuse the stylized map sky assets; waves are inline-SVG scallop
 * bands on transform-only marquee loops (same seamless duplicate-strip
 * pattern as MainMapPage's cloud marquee). Ocean colors match the sail map
 * ocean art (map-ocean-bg.png blues).
 * ------------------------------------------------------------------------ */
const MAP_SKY_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const MAP_SKY_CLOUD_B = '/assets/images/map-sky-cloud-b.png';

/**
 * Viewport % of the horizon line — sky above, ocean below. Kept HIGH so the
 * background peeking around the hull (the side slivers beside the bow on
 * phone-width screens) reads unmistakably as water, not sky.
 */
const CREW_SEA_HORIZON_PCT = 24;

const CREW_SKY_GRADIENT =
  `linear-gradient(180deg, #6fbdf0 0%, #9fdcf8 ${CREW_SEA_HORIZON_PCT - 12}%, #c9ecfa ${CREW_SEA_HORIZON_PCT - 5}%, #eef9fd ${CREW_SEA_HORIZON_PCT}%, #2eb8e6 ${CREW_SEA_HORIZON_PCT}%, #0d9bd8 34%, #0674b6 55%, #0a568e 78%, #0d4674 100%)`;

/** Distant palm islands on the horizon — cropped from the sail-page bg art. */
const CREW_HORIZON_ISLAND_A = '/assets/images/crew-horizon-island-a.png';
const CREW_HORIZON_ISLAND_B = '/assets/images/crew-horizon-island-b.png';

type CrewSkyCloudSpec = {
  id: string;
  src: string;
  widthPct: number;
  leftPct: number;
  topPct: number;
  opacity: number;
};

/** Far clouds — small + faint, slow drift. */
const CREW_CLOUDS_FAR: CrewSkyCloudSpec[] = [
  { id: 'far-b1', src: MAP_SKY_CLOUD_B, widthPct: 24, leftPct: 6, topPct: 30, opacity: 0.55 },
  { id: 'far-a1', src: MAP_SKY_CLOUD_A, widthPct: 28, leftPct: 46, topPct: 10, opacity: 0.5 },
  { id: 'far-b2', src: MAP_SKY_CLOUD_B, widthPct: 18, leftPct: 82, topPct: 40, opacity: 0.5 },
];

/** Near clouds — big + bright, faster drift (parallax over the far layer). */
const CREW_CLOUDS_NEAR: CrewSkyCloudSpec[] = [
  { id: 'near-a1', src: MAP_SKY_CLOUD_A, widthPct: 42, leftPct: -8, topPct: 0, opacity: 0.95 },
  { id: 'near-b1', src: MAP_SKY_CLOUD_B, widthPct: 32, leftPct: 44, topPct: 34, opacity: 0.9 },
  { id: 'near-a2', src: MAP_SKY_CLOUD_A, widthPct: 24, leftPct: 74, topPct: 8, opacity: 0.85 },
];

/** Scalloped wave crest tile (fills below the crest) as a CSS data URI. */
const waveTile = (fill: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 28' preserveAspectRatio='none'%3E%3Cpath d='M0 14 Q15 4 30 14 T60 14 T90 14 T120 14 V28 H0 Z' fill='${fill.replace('#', '%23')}'/%3E%3C/svg%3E")`;

/** Sparse white sparkle dots tile — drifts slowly over the ocean. */
const CREW_SEA_SPARKLE_TILE =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60'%3E%3Cg fill='white'%3E%3Ccircle cx='14' cy='18' r='1.6' opacity='0.9'/%3E%3Ccircle cx='52' cy='40' r='1.2' opacity='0.7'/%3E%3Ccircle cx='84' cy='12' r='1.4' opacity='0.8'/%3E%3Ccircle cx='104' cy='48' r='1.1' opacity='0.6'/%3E%3Ccircle cx='34' cy='52' r='1' opacity='0.5'/%3E%3C/g%3E%3C/svg%3E")`;

/**
 * Wave bands, back → front. Tile width is a % of the 200%-wide track chosen
 * so the -50% marquee shift lands on an exact tile multiple (seamless loop):
 * 50 / tilePct must be an integer.
 */
const CREW_SEA_WAVES = [
  { id: 'wave-far', fill: '#7EE0F2', topPct: CREW_SEA_HORIZON_PCT - 1, tilePct: 6.25, driftSec: 34, bobSec: 11, reverse: false, opacity: 0.9 },
  { id: 'wave-mid', fill: '#2FB9E4', topPct: CREW_SEA_HORIZON_PCT + 3, tilePct: 10, driftSec: 23, bobSec: 9, reverse: true, opacity: 0.95 },
  { id: 'wave-near', fill: '#0E8CCB', topPct: CREW_SEA_HORIZON_PCT + 9, tilePct: 12.5, driftSec: 15, bobSec: 7, reverse: false, opacity: 1 },
  // Deepening rows below — these are what shows in the side slivers along
  // the hull, so crests keep appearing all the way down the screen.
  { id: 'wave-deep', fill: '#0A70AF', topPct: 46, tilePct: 10, driftSec: 19, bobSec: 10, reverse: true, opacity: 1 },
  { id: 'wave-hull', fill: '#0A5A96', topPct: 84, tilePct: 12.5, driftSec: 18, bobSec: 8, reverse: false, opacity: 1 },
] as const;
const SAIL_STEERING_WHEEL = '/assets/images/sail-steering-wheel.png';
const SAIL_BTN_CREW = '/assets/images/sail-btn-crew.png';
const JOURNEY_MAP_ICON = '/assets/ui/tab-map.png';
/** Shared wood texture — matches Sail “Travel Here” plaque. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const DECK_NAV_ICON_W = 'min(22vw, 88px)';
const DECK_NAV_BOTTOM = 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))';
/** Adam's tour card sits just above the Home / Journey / Crew row. */
const TOUR_CARD_BOTTOM = 'max(124px, calc(var(--safe-area-bottom, 0px) + 118px))';

/** Painted jukebox at the mast foot (image ~x 0.41–0.56, y 0.30–0.47). */
const JUKEBOX_BOX: React.CSSProperties = {
  left: '34%',
  top: '29%',
  width: '27%',
  height: '19%',
};
/** Painted cannon on the left rail (image x 0–0.27, y 0.40–0.55; mostly cropped on phones). */
const CANNON_BOX: React.CSSProperties = {
  left: '0%',
  top: '39%',
  width: '22%',
  height: '17%',
};
/** Glowing open hatch, right-mid (image x 0.63–0.91, y 0.57–0.72). */
const HATCH_BOX: React.CSSProperties = {
  left: '69%',
  top: '55%',
  width: '31%',
  height: '19%',
};

/**
 * Cabin door at the bow (painted in the deck art, between the stairs).
 * Image ~x 0.42–0.58, y 0.13–0.24, expanded for the phone object-cover crop
 * the other deck hotspots use.
 */
const SHOP_DOOR_BOX: React.CSSProperties = {
  left: '37%',
  top: '13%',
  width: '26%',
  height: '12%',
};

/**
 * Where Adam walks (deck image coords, 0–1) and what lights up for each
 * beat of his first-tap tour. Copy lives in utils/adamTour.
 */
const DECK_TOUR_STAGING: Record<
  string,
  { walkTo?: { x: number; y: number }; spot?: React.CSSProperties; shape?: 'circle' | 'rounded' }
> = {
  hello: {},
  // Standing spots keep him beside the feature (not on top of it) and above
  // the tour card, which covers roughly the bottom 30% of the screen.
  cannon: {
    walkTo: { x: 0.43, y: 0.52 },
    spot: CANNON_BOX,
  },
  jukebox: {
    walkTo: { x: 0.63, y: 0.5 },
    spot: JUKEBOX_BOX,
  },
  door: {
    walkTo: { x: 0.32, y: 0.18 },
    spot: SHOP_DOOR_BOX,
  },
  crew: {
    walkTo: { x: 0.58, y: 0.7 },
    spot: {
      right: 'max(6px, calc(env(safe-area-inset-right, 0px) - 4px))',
      bottom: `calc(${DECK_NAV_BOTTOM} - 6px)`,
      width: `calc(${DECK_NAV_ICON_W} + 8px)`,
      height: `calc(${DECK_NAV_ICON_W} + 8px)`,
    },
  },
  journey: {
    walkTo: { x: 0.42, y: 0.7 },
    spot: {
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: `calc(${DECK_NAV_BOTTOM} - 6px)`,
      width: `calc(${DECK_NAV_ICON_W} + 8px)`,
      height: `calc(${DECK_NAV_ICON_W} + 8px)`,
    },
  },
  hatch: {
    walkTo: { x: 0.58, y: 0.66 },
    spot: HATCH_BOX,
  },
};

const deckPlaqueClass =
  'absolute left-1/2 flex items-center justify-center pointer-events-none select-none whitespace-nowrap font-display font-black uppercase tracking-[0.08em] text-[#F5E6C8]';
const deckPlaqueStyle: React.CSSProperties = {
  bottom: '-0.35rem',
  transform: 'translateX(-50%)',
  padding: '0.32rem 0.55rem',
  borderRadius: '0.55rem',
  fontSize: 'clamp(0.58rem, 2.6vw, 0.78rem)',
  lineHeight: 1,
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  border: '2px solid #6B4423',
  boxShadow:
    '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  textShadow: '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
};

/** Hatch open hint before white fade. */
const HATCH_OPEN_MS = 320;
/** White fade-out duration before basement / cannon navigate. */
const WHITE_FADE_MS = 480;
const NAVIGATE_AFTER_MS = HATCH_OPEN_MS + WHITE_FADE_MS;
const CANON_GAME_PATH = '/crew/canon';
const TOAST_MS = 2200;

/** Jukebox party length — everyone dances, sky darkens, disco ball drops. */
const PARTY_MS = 8000;
/** Disco ball rise-away time before the party FX layer unmounts. */
const PARTY_EXIT_MS = 800;

/** Sweeping party spotlight cones (colors + sweep timing). */
const PARTY_SPOTS = [
  { color: 'rgba(255, 82, 205, 0.45)', dur: 2.6, from: -30, to: 18 },
  { color: 'rgba(82, 208, 255, 0.42)', dur: 3.4, from: 26, to: -20 },
  { color: 'rgba(255, 214, 92, 0.4)', dur: 4.2, from: -8, to: 30 },
] as const;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Padlock + soft darkening + unlock hint over a locked deck hotspot.
 * Gold badge matches the basement / main-map story lock.
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

/** One ocean band: marching scallop crest strip + solid body to the bottom. */
const SeaWaveBand: React.FC<{ w: (typeof CREW_SEA_WAVES)[number] }> = ({ w }) => (
  <div
    className="crew-sea-wave-bob absolute inset-x-0"
    style={{
      top: `${w.topPct}%`,
      bottom: '-2%',
      opacity: w.opacity,
      animationDuration: `${w.bobSec}s`,
    }}
  >
    {/* Scallop crest strip — the only part that visibly marches sideways,
        so it alone gets the 200%-wide marquee track */}
    <div
      className={`crew-sea-wave-track${w.reverse ? ' crew-sea-wave-reverse' : ''}`}
      style={{
        height: '28px',
        backgroundImage: waveTile(w.fill),
        backgroundRepeat: 'repeat-x',
        backgroundSize: `${w.tilePct}% 100%`,
        animationDuration: `${w.driftSec}s`,
      }}
    />
    {/* Solid body below the crest (uniform color — no need to move) */}
    <div
      className="absolute inset-x-0 bottom-0"
      style={{ top: '26px', background: w.fill }}
    />
  </div>
);

/**
 * Crew ship deck — opened from Sail CREW. Shows characters unlocked from
 * story Rewards loot boxes: characters with a GLB modelUrl or a still image
 * walk in 3D (CrewDeck3D — clip walk, or bob/lean when the upload has no
 * walk frames); tapping one opens the AI chat popup directly. Nameless
 * leftovers (no model, no image) stand as 2D plaques. Dancing happens only
 * via the jukebox party (everyone dances for 8s).
 * Wheel (bottom-left) returns to sail; glowing cannon → Canon Golf (locked
 * until Genesis Island is complete); open hatch → white fade → basement.
 * Crew button (bottom-right) opens the roster picker.
 * First tap on Adam runs his guided tour (utils/adamTour) instead of chat:
 * he walks feature to feature, then leads the kid down the hatch.
 */
type AdamTour = {
  character: UnlockedCharacter;
  beatIndex: number;
  /** False while he's still walking to the beat's spot. */
  arrived: boolean;
  /** Tour copy is done; Adam is climbing down the hatch (keep chrome parked). */
  leaving?: boolean;
};

const CrewPage: React.FC = () => {
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
  const [hatchOpen, setHatchOpen] = useState(false);
  const [enteringGame, setEnteringGame] = useState(false);
  const [whiteFade, setWhiteFade] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gameLocks, setGameLocks] = useState(getBasementGameLockStates);
  const [crew, setCrew] = useState<UnlockedCharacter[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [chatCharacter, setChatCharacter] = useState<UnlockedCharacter | null>(null);
  // Jukebox party: `party` drives the night dim + dancing; the FX layer
  // (ball + spotlights) stays mounted a beat longer so the ball can rise away.
  const [party, setParty] = useState(false);
  const [partyFxMounted, setPartyFxMounted] = useState(false);
  const partyRef = useRef(false);
  const partyTimersRef = useRef<number[]>([]);
  // Backdrop animations pause while the tab is hidden (battery-friendly).
  const [pageHidden, setPageHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  );
  const deckRef = useRef<CrewDeckHandle>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const enteringRef = useRef(false);
  const reduceMotion = prefersReducedMotion();
  const arrivingOnboarding = isOnboardingJourneyActive();

  useEffect(() => {
    if (arrivingOnboarding) noteJourneyStep('crew');
  }, [arrivingOnboarding]);

  useEffect(() => {
    noteBoatSession();
  }, []);

  const [crewGuide, setCrewGuide] = useState(arrivingOnboarding);
  const [tapAdam, setTapAdam] = useState(
    () => Boolean((location.state as { tapAdam?: boolean } | null)?.tapAdam),
  );
  const [adamAnchor, setAdamAnchor] = useState<{ x: number; y: number } | null>(null);
  const [tour, setTour] = useState<AdamTour | null>(null);
  const tourRef = useRef<AdamTour | null>(null);
  tourRef.current = tour;
  const deckBusy = hatchOpen || enteringGame;
  const chromeLocked = deckBusy || crewGuide || !!tour;
  const tourBeats = useMemo(
    () => buildAdamDeckTour(kidName, gameLocks.canon),
    [kidName, gameLocks.canon],
  );
  const tourBeat =
    tour && !tour.leaving ? tourBeats[Math.min(tour.beatIndex, tourBeats.length - 1)] : null;
  const tourStaging = tourBeat ? DECK_TOUR_STAGING[tourBeat.id] : null;
  // Adam's line tells the kid to tap the jukebox. Every other deck control
  // stays locked until the tour moves on.
  const jukeboxTourReady =
    tourBeat?.id === 'jukebox' && !!tour?.arrived && !tour.leaving;
  // First-time experience: Home / Journey / Crew stay hidden until Adam has
  // walked the kid through the ship. During the tour only the button he's
  // talking about pops in.
  const firstTimeLock = (crewGuide || tapAdam) && !hasSeenAdamTour();
  const navHidden = firstTimeLock || !!tour;
  const showJourneyBtn = !navHidden || tourBeat?.id === 'journey';
  const showCrewBtn = !navHidden || tourBeat?.id === 'crew';

  const finishCrewGuide = useCallback(() => {
    setCrewGuide(false);
    completeOnboardingJourney();
    setTapAdam(true);
    // Drop onboardingJourney from this history entry so returning from the
    // basement (navigate(-1)) cannot replay the HS tour. Keep tapAdam so a
    // remount still shows the Tap cue over Adam.
    navigate('/crew', { replace: true, state: { tapAdam: true } });
  }, [navigate]);

  // Crew on deck: characters unlocked from story Rewards loot boxes.
  // If the kid picked a crew roster, show that; otherwise all unlocked.
  const loadCrew = useCallback(() => {
    setCrew(getOnDeckCrew());
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    loadCrew();
    // Rewards added in the CMS after a pack's treasure was already dug
    // (e.g. Eve on Adam & Eve) never show in the one-shot dig — grant them
    // here and seat them on the ship. Also refresh stored character fields.
    void (async () => {
      try {
        await rewardsService.syncNewRewardsForClaimedStories();
      } catch {
        /* offline */
      }
      const changed = await rewardsService.refreshUnlockedCharactersFromCms().catch(
        () => false,
      );
      loadCrew();
      return changed;
    })();
  }, [loadCrew]);

  useEffect(() => {
    const controller = new AbortController();
    refreshBasementGameLockStates(controller.signal)
      .then((states) => setGameLocks(states))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    // Re-read roster so newly picked crew appear on deck immediately.
    loadCrew();
  }, [loadCrew]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      enteringRef.current = false;
    },
    [clearTimers],
  );

  /** End the jukebox party (timer, chat opening, hatch descent, unmount). */
  const endParty = useCallback(() => {
    partyTimersRef.current.forEach((id) => window.clearTimeout(id));
    partyTimersRef.current = [];
    if (!partyRef.current) return;
    partyRef.current = false;
    setParty(false); // night dim fades out, disco ball rises away
    deckRef.current?.stopParty();
    danceMusic.stop(); // covers the no-3D-crew jukebox case
    partyTimersRef.current = [
      window.setTimeout(() => setPartyFxMounted(false), PARTY_EXIT_MS),
    ];
    // The party pulls Adam out of his tour pose. Put him back to talking
    // if the jukebox beat is still up.
    const t = tourRef.current;
    if (t?.arrived && !t.leaving) {
      const beatId = tourBeats[Math.min(t.beatIndex, tourBeats.length - 1)]?.id;
      if (beatId === 'jukebox') deckRef.current?.talk(t.character.id);
    }
  }, [tourBeats]);

  /** Jukebox tap: everyone dances 8s, sky goes dark, disco ball drops. */
  const startParty = useCallback(() => {
    if (partyRef.current || enteringRef.current) return; // re-taps ignored
    partyRef.current = true;
    const danced = deckRef.current?.danceAll(PARTY_MS) ?? false;
    if (!danced) danceMusic.start(); // no 3D crew yet — lights + tune still party
    if (!reduceMotion) setPartyFxMounted(true);
    partyTimersRef.current = [
      // FX mounts with the ball parked above the screen; flip `party` a frame
      // later so the drop / dim transitions actually animate.
      window.setTimeout(() => setParty(true), 30),
      window.setTimeout(endParty, PARTY_MS),
    ];
  }, [endParty, reduceMotion]);

  useEffect(
    () => () => {
      // Unmount: silence a party with no 3D deck (deck cleanup handles the rest)
      partyTimersRef.current.forEach((id) => window.clearTimeout(id));
      danceMusic.stop();
    },
    [],
  );

  const goHome = useCallback(() => {
    if (enteringRef.current || enteringGame) return;
    navigate('/world', { replace: true });
  }, [enteringGame, navigate]);

  /** Journey → the sail deck, where the wheel steers between islands. */
  const goToSail = useCallback(() => {
    if (enteringRef.current || enteringGame) return;
    navigate('/sail');
  }, [enteringGame, navigate]);

  /** Hatch-open hint → white fade → navigate. (Runs after any 3D descent.) */
  const beginHatchTransition = useCallback(
    (navState?: Record<string, unknown>) => {
      clearTimers();
      const go = () => navigate('/sail/basement', navState ? { state: navState } : undefined);

      if (reduceMotion) {
        setHatchOpen(true);
        setWhiteFade(true);
        const id = window.setTimeout(go, 80);
        timersRef.current = [id];
        return;
      }

      setHatchOpen(true);
      const fadeId = window.setTimeout(() => setWhiteFade(true), HATCH_OPEN_MS);
      const navId = window.setTimeout(go, NAVIGATE_AFTER_MS);
      timersRef.current = [fadeId, navId];
    },
    [clearTimers, navigate, reduceMotion],
  );

  const crew3d = crew.filter(canWalkOnDeck);

  // First boarding this session: unlock waving, then play it once models
  // are on deck. Re-entering the ship later in the same session stays idle.
  useEffect(() => {
    if (crew.length === 0) return;
    rewardsService.unlockCrewAnimation(CREW_WAVE_ANIMATION);
    if (crew3d.length === 0 || reduceMotion) return;
    try {
      if (sessionStorage.getItem('godlykids_crew_arrival_waved') === '1') return;
    } catch {
      /* private mode */
    }
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (deckRef.current?.waveAll()) {
        try {
          sessionStorage.setItem('godlykids_crew_arrival_waved', '1');
        } catch {
          /* ignore */
        }
        window.clearInterval(id);
      } else if (tries > 40) {
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [crew.length, crew3d.length, reduceMotion]);

  // Tap-to-talk: loop the talking clip while chat is open.
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

  useEffect(() => {
    if (!tapAdam || crew3d.length === 0) return;
    const adam = crew.find(isAdamCharacter) || crew[0];
    const tick = () => {
      const next = deckRef.current?.characterAnchor(adam?.id);
      if (next) setAdamAnchor(next);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [tapAdam, crew, crew3d.length]);

  /**
   * Go below deck. A plain hatch tap just opens the hatch and fades out —
   * the crew stay where they are (the basement shows whoever is already down
   * there via their persisted locations). Only when a `walkerId` is given
   * (Adam leading the way at the end of his tour) does that character walk
   * to the hatch and climb down first.
   */
  const enterBasement = useCallback(
    (opts?: { walkerId?: string; navState?: Record<string, unknown> }) => {
      if (enteringRef.current || enteringGame) return;
      enteringRef.current = true;
      endParty(); // hatch descent cancels a running jukebox party

      const onDown = () => beginHatchTransition(opts?.navState);
      const walker = opts?.walkerId ? crew3d.find((c) => c.id === opts.walkerId) : undefined;
      if (!walker) {
        onDown();
        return;
      }

      // Escorted descent: he walks to the hatch and climbs down first; the
      // white-fade transition fires once he's disappeared inside.
      if (!reduceMotion) {
        const started = deckRef.current?.descendIntoHatch(walker.id, onDown);
        if (started) {
          try {
            // Basement page shows the character who climbed down.
            sessionStorage.setItem(BASEMENT_CHARACTER_KEY, walker.id);
          } catch {
            /* storage unavailable — basement falls back to first 3D character */
          }
          return;
        }
      }
      // Reduced motion / no 3D walker yet: mark him as below deck without the
      // animation so the basement still shows him.
      try {
        sessionStorage.setItem(BASEMENT_CHARACTER_KEY, walker.id);
      } catch {
        /* ignore */
      }
      onDown();
    },
    [beginHatchTransition, crew3d, endParty, enteringGame, reduceMotion],
  );
  const crew2d = crew.filter((c) => !canWalkOnDeck(c));

  /* ---------------- Adam's first-tap tour ---------------- */

  const endTour = useCallback((reason: 'skip' | 'hatch') => {
    const t = tourRef.current;
    if (!t) return;
    markAdamTourSeen();
    if (reason === 'skip') {
      markTourWrapDone();
      dismissLegacyTutorialForChallenge();
      setTour(null);
      deckRef.current?.stopTalk(t.character.id);
      navigate('/onboarding/welcome', {
        state: { returnTo: '/crew', reason: 'skip-tour' },
      });
      return;
    }
    // Hatch: chrome stays parked until the basement navigation fires.
    setTour({ ...t, leaving: true });
  }, [navigate]);

  const startTour = useCallback((character: UnlockedCharacter) => {
    if (!hasSeenAdamTour()) noteJourneyStep('adam_tour');
    endParty();
    danceMusic.stop();
    setTapAdam(false);
    resetAdamTourWrap();
    setTour({ character, beatIndex: 0, arrived: false });
  }, [endParty]);

  // Each beat: walk Adam to its spot (he turns to the camera and talks on
  // arrival), or just talk in place when the beat has no spot.
  useEffect(() => {
    if (!tour || tour.arrived || tour.leaving) return;
    const staging = DECK_TOUR_STAGING[tourBeats[tour.beatIndex]?.id ?? ''] ?? {};
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
        // No 3D walker (2D plaque Adam / reduced motion) — just talk.
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

  const advanceTour = useCallback(() => {
    const t = tourRef.current;
    if (!t || t.leaving) return;
    const last = t.beatIndex >= tourBeats.length - 1;
    if (!last) {
      setTour({ ...t, beatIndex: t.beatIndex + 1, arrived: false });
      return;
    }
    // Last beat: Adam leads the way down the hatch; the basement picks the
    // tour back up from location.state.
    endTour('hatch');
    enterBasement({ walkerId: t.character.id, navState: { adamTour: true } });
  }, [endTour, enterBasement, tourBeats.length]);
  /**
   * Hatch tap. The invisible tap target sits above the 3D canvas, so first
   * raycast for a character under the pointer — if the walker is standing
   * on/next to the hatch, tapping him opens his action menu instead of
   * triggering the descent.
   */
  /** Tap on a character → AI chat directly (dancing is jukebox-only now). */
  const openChat = useCallback(
    (character: UnlockedCharacter) => {
      if (tourRef.current) return; // taps are parked while Adam gives the tour
      if (crewGuide) finishCrewGuide();
      // First tap on Adam ever → he plays tour guide instead of chatting.
      if (isAdamCharacter(character) && !hasSeenAdamTour()) {
        startTour(character);
        return;
      }
      setTapAdam(false);
      endParty(); // chat opening cancels a jukebox party…
      danceMusic.stop(); // …and silences any lingering tune
      setChatCharacter(character);
    },
    [crewGuide, endParty, finishCrewGuide, startTour],
  );

  const onHatchTap = useCallback(
    (e: React.MouseEvent) => {
      const hit = deckRef.current?.characterAt(e.clientX, e.clientY);
      if (hit) {
        openChat(hit.character);
        return;
      }
      enterBasement();
    },
    [enterBasement, openChat],
  );

  /** Jukebox tap always starts the party (chat is a tap on the character). */
  const onJukeboxTap = useCallback(() => {
    if (deckBusy) return;
    // The tour locks the rest of the deck, but this beat asks for the tap.
    if (chromeLocked && !jukeboxTourReady) return;
    startParty();
  }, [chromeLocked, deckBusy, jukeboxTourReady, startParty]);

  /** Cabin door → avatar Builder Shop (a walker in front still opens chat). */
  const onShopDoorTap = useCallback(
    (e: React.MouseEvent) => {
      if (enteringRef.current || deckBusy) return;
      const hit = deckRef.current?.characterAt(e.clientX, e.clientY);
      if (hit) {
        openChat(hit.character);
        return;
      }
      endParty();
      danceMusic.stop();
      setShopOpen(true);
    },
    [deckBusy, endParty, openChat],
  );

  const showPlaque = useCallback(
    (message: string) => {
      if (enteringRef.current || enteringGame) return;
      setToast(message);
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
    },
    [enteringGame],
  );

  const openCanonGame = useCallback(() => {
    if (enteringRef.current || hatchOpen || enteringGame) return;
    enteringRef.current = true;
    setEnteringGame(true);
    setToast(null);
    endParty();
    clearTimers();

    if (reduceMotion) {
      setWhiteFade(true);
      const id = window.setTimeout(() => navigate(CANON_GAME_PATH), 80);
      timersRef.current = [id];
      return;
    }

    setWhiteFade(true);
    const navId = window.setTimeout(() => navigate(CANON_GAME_PATH), WHITE_FADE_MS);
    timersRef.current = [navId];
  }, [clearTimers, endParty, enteringGame, hatchOpen, navigate, reduceMotion]);

  /**
   * Cannon tap. Same character-raycast as hatch/jukebox so a walker standing
   * on the left rail still opens chat instead of the game.
   */
  const onCannonTap = useCallback(
    (e: React.MouseEvent) => {
      if (hatchOpen || enteringGame) return;
      const hit = deckRef.current?.characterAt(e.clientX, e.clientY);
      if (hit) {
        openChat(hit.character);
        return;
      }
      if (gameLocks.canon.locked) {
        showPlaque(gameLocks.canon.message);
        return;
      }
      openCanonGame();
    },
    [enteringGame, gameLocks.canon, hatchOpen, openCanonGame, openChat, showPlaque],
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Sky/ocean slot — animated CSS scene behind a transparent-sky ship
          art (drifting cloud marquees, bobbing wave bands, sparkle drift).
          Skipped while the deck art paints its own sky. */}
      {!SHIP_ART_HAS_SKY && (
      <div
        aria-hidden
        className={`crew-sea-backdrop absolute inset-0 overflow-hidden pointer-events-none select-none${
          pageHidden ? ' crew-sea-paused' : ''
        }`}
      >
        {/* Sky above the horizon, ocean base below it */}
        <div className="absolute inset-0" style={{ background: CREW_SKY_GRADIENT }} />
        {/* Warm glow hugging the horizon line */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 130% 14% at 50% ${CREW_SEA_HORIZON_PCT}%, rgba(255,224,166,0.38) 0%, rgba(255,224,166,0.14) 45%, transparent 72%)`,
          }}
        />

        {/* Drifting clouds — two marquee layers for slow parallax, high in
            the visible sky band around the rigging */}
        {(
          [
            { clouds: CREW_CLOUDS_FAR, dur: 150, cls: 'crew-sea-clouds-far' },
            { clouds: CREW_CLOUDS_NEAR, dur: 75, cls: 'crew-sea-clouds-near' },
          ] as const
        ).map(({ clouds, dur, cls }) => (
          <div
            key={cls}
            className="absolute inset-x-0 top-0 overflow-hidden"
            style={{ height: `min(${CREW_SEA_HORIZON_PCT - 4}vh, 190px)` }}
          >
            <div
              className={`crew-sea-cloud-track ${cls}`}
              style={{ '--crew-cloud-loop': `${dur}s` } as React.CSSProperties}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="crew-sea-cloud-strip">
                  {clouds.map((cloud) => (
                    <img
                      key={`${copy}-${cloud.id}`}
                      src={cloud.src}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none h-auto"
                      style={{
                        width: `${cloud.widthPct}%`,
                        left: `${cloud.leftPct}%`,
                        top: `${cloud.topPct}%`,
                        opacity: cloud.opacity,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Wave bands — scallop crests marching sideways + a gentle bob.
            The far band renders first so the horizon islands can sit on it
            while the closer bands overlap their waterline. */}
        <SeaWaveBand w={CREW_SEA_WAVES[0]} />

        {/* Distant palm islands on the horizon (near-static — far away).
            Positioned into the phone-aspect side gaps beside the bow. */}
        <div className="crew-sea-bob-far absolute inset-0">
          <img
            src={CREW_HORIZON_ISLAND_A}
            alt=""
            draggable={false}
            className="absolute max-w-none h-auto"
            style={{
              left: '-1%',
              bottom: '74.5%',
              width: 'clamp(64px, 17vw, 130px)',
              opacity: 0.9,
              filter: 'saturate(0.72) brightness(1.05)',
            }}
          />
          <img
            src={CREW_HORIZON_ISLAND_B}
            alt=""
            draggable={false}
            className="absolute max-w-none h-auto"
            style={{
              right: '0%',
              bottom: '74.8%',
              width: 'clamp(48px, 12vw, 96px)',
              opacity: 0.88,
              filter: 'saturate(0.7) brightness(1.06)',
            }}
          />
        </div>

        {CREW_SEA_WAVES.slice(1).map((w) => (
          <SeaWaveBand key={w.id} w={w} />
        ))}

        {/* Sparkle highlights drifting across the ocean surface (runs to the
            bottom so the hull-side water slivers glint too) */}
        <div
          className="crew-sea-wave-bob absolute inset-x-0"
          style={{
            top: `${CREW_SEA_HORIZON_PCT + 3}%`,
            bottom: '-2%',
            opacity: 0.4,
            animationDuration: '13s',
          }}
        >
          <div
            className="crew-sea-wave-track crew-sea-wave-reverse"
            style={{
              backgroundImage: CREW_SEA_SPARKLE_TILE,
              backgroundRepeat: 'repeat',
              backgroundSize: '12.5% 64px',
              animationDuration: '47s',
            }}
          />
        </div>
      </div>
      )}

      {/* Ship art — same object-cover mapping the zone config in CrewDeck3D
          relies on for image→screen coordinate alignment. */}
      <img
        src={CREW_SHIP_DECK_SHIP}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
      {/* Jukebox party: night falls over the painted scene (sky + deck);
          the 3D crew canvas renders above this so the dancers stay lit. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'linear-gradient(180deg, rgba(7,9,40,0.82) 0%, rgba(6,10,36,0.62) 30%, rgba(4,12,32,0.48) 100%)',
          opacity: party ? 1 : 0,
          transition: reduceMotion ? 'none' : 'opacity 500ms ease',
        }}
      />

      {/* 3D crew — characters with a GLB model stand idle on the deck.
          Tap → AI chat popup (dancing is jukebox-only). */}
      {crew3d.length > 0 && (
        <Suspense fallback={null}>
          <CrewDeck3D
            ref={deckRef}
            characters={crew3d}
            paused={!!chatCharacter || deckBusy}
            onCharacterTap={(character) => openChat(character)}
          />
        </Suspense>
      )}

      {tapAdam && crew3d.length > 0 && adamAnchor && (
        <div
          className="absolute z-[25] pointer-events-none"
          style={{
            left: adamAnchor.x,
            top: adamAnchor.y,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <span className="ob-tap-adam" aria-hidden>
            Tap
          </span>
        </div>
      )}

      {/* Jukebox party FX — disco ball on a rod + sweeping spotlight cones.
          Mounted with the ball parked offscreen so the drop can transition in;
          stays mounted PARTY_EXIT_MS after the party so the ball rises away.
          Skipped entirely under prefers-reduced-motion (static dim only). */}
      {partyFxMounted && (
        <div
          aria-hidden
          className="absolute inset-0 z-[15] pointer-events-none overflow-hidden"
        >
          {/* Spotlight cones sweeping from the ball's spot */}
          <div
            className="absolute left-1/2"
            style={{
              top: 'calc(3vh + 66px)',
              opacity: party ? 1 : 0,
              transition: 'opacity 500ms ease',
            }}
          >
            {PARTY_SPOTS.map((s, i) => (
              <div
                key={i}
                className="crew-party-spot"
                style={
                  {
                    background: `linear-gradient(180deg, ${s.color} 0%, transparent 82%)`,
                    animationDuration: `${s.dur}s`,
                    '--spot-from': `${s.from}deg`,
                    '--spot-to': `${s.to}deg`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {/* Disco ball dropping in on its rod (bouncy ease), rising on exit */}
          <div
            className="absolute left-1/2"
            style={{
              top: 0,
              transform: party ? 'translate(-50%, 0)' : 'translate(-50%, -130%)',
              transition: party
                ? 'transform 700ms cubic-bezier(0.34, 1.7, 0.5, 1)'
                : `transform ${PARTY_EXIT_MS}ms ease-in`,
            }}
          >
            <div
              style={{
                width: 3,
                height: '3vh',
                margin: '0 auto',
                background:
                  'linear-gradient(180deg, rgba(230,235,245,0), rgba(230,235,245,0.9))',
              }}
            />
            <div className="crew-disco-ball" />
          </div>
        </div>
      )}

      {/* Crew on deck — characters unlocked from story Rewards loot boxes.
          Band sits on the mid deck, clear of the hatch (right) + wheel (bottom-left).
          Tap an avatar to chat. */}
      {crew2d.length > 0 && (
        <div
          className="absolute z-10 flex flex-wrap content-end items-end justify-center gap-x-2.5 gap-y-2 pointer-events-none"
          style={{ left: '3%', width: '58%', top: '34%', height: '44%' }}
          aria-label="Crew members on deck"
        >
          {crew2d.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openChat(c)}
              aria-label={`Chat with ${c.name}`}
              className="relative flex flex-col items-center select-none pointer-events-auto p-0 m-0 border-0 bg-transparent appearance-none cursor-pointer active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-xl"
              style={{ width: 'clamp(58px, 13vw, 84px)' }}
            >
              {tapAdam && isAdamCharacter(c) && (
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
                  <span className="ob-tap-adam" aria-hidden>
                    Tap
                  </span>
                </span>
              )}
              <div
                className="w-full aspect-square rounded-full overflow-hidden bg-[#2a160c]/85 flex items-center justify-center"
                style={{
                  border: '2.5px solid #F5E6A3',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.45)',
                }}
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <Users size={26} className="text-amber-200/80" aria-hidden />
                )}
              </div>
              <span
                className="mt-1 max-w-full truncate font-display font-black uppercase tracking-[0.06em] text-[#F5E6C8] text-center"
                style={{
                  padding: '0.22rem 0.45rem',
                  borderRadius: '0.5rem',
                  fontSize: 'clamp(0.5rem, 2.2vw, 0.68rem)',
                  lineHeight: 1,
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '2px solid #6B4423',
                  boxShadow:
                    '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
                  textShadow:
                    '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
                }}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Painted cannon — left rail. Locked until the island is complete;
          then Canon Golf. Taps first raycast for a character so a walker on
          the rail still opens chat. */}
      <button
        type="button"
        onClick={onCannonTap}
        disabled={chromeLocked}
        aria-label={
          gameLocks.canon.locked
            ? `Locked — ${gameLocks.canon.message}`
            : 'Play Canon Golf'
        }
        className="absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{ ...CANNON_BOX, cursor: deckBusy ? 'default' : 'pointer' }}
      >
        {gameLocks.canon.locked && (
          <GameLockOverlay islandLabel={gameLocks.canon.islandLabel} />
        )}
      </button>

      {/* Cabin door at the bow — painted in the deck art. Tap opens the
          Builder Shop. A walker standing on the landing still opens chat. */}
      <button
        type="button"
        onClick={onShopDoorTap}
        disabled={chromeLocked}
        aria-label="Cabin door — open the Builder Shop"
        className="absolute z-30 m-0 p-0 border-0 bg-transparent appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
        style={{ ...SHOP_DOOR_BOX, cursor: deckBusy ? 'default' : 'pointer' }}
      />

      {/* Open deck hatch — invisible tap target over the glowing hatch art
          (right-mid of deck). The glow in the art itself is the affordance.
          Taps first raycast for a character (onHatchTap) so the walker
          standing on the hatch still opens chat. */}
      <button
        type="button"
        onClick={onHatchTap}
        disabled={chromeLocked}
        aria-label="Open hatch to the basement"
        className="absolute z-20 p-0 m-0 border-0 appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          ...HATCH_BOX,
          borderRadius: '12%',
          cursor: deckBusy ? 'default' : 'pointer',
          background: 'transparent',
        }}
      />

      {/* Jukebox — painted at the mast foot in the deck art. Invisible tap
          target (character raycast keeps Talk working if someone stands in
          front). Tap → 8s dance party: everyone dances, night falls, disco
          ball. */}
      <button
        type="button"
        onClick={onJukeboxTap}
        disabled={chromeLocked && !jukeboxTourReady}
        aria-label="Jukebox — start a dance party"
        className="absolute z-30 m-0 p-0 border-0 bg-transparent appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
        style={{
          ...JUKEBOX_BOX,
          cursor: deckBusy || (chromeLocked && !jukeboxTourReady) ? 'default' : 'pointer',
        }}
      />

      {/* Adam's tour: gold ring on the feature he's describing. */}
      {tourStaging?.spot && tour?.arrived && (
        <FeatureSpotlight box={tourStaging.spot} shape={tourStaging.shape} zIndex={34} />
      )}

      {/* Home / Journey / Crew — large illustrated icons with wood labels,
          same chrome as the hatch “Open” plaque. Hidden on the first visit
          until Adam's tour has introduced them (tour beats pop in the one
          he's pointing at). */}
      {!navHidden && (
      <button
        type="button"
        onClick={goHome}
        disabled={chromeLocked}
        aria-label="Home"
        className="absolute z-30 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full crew-nav-btn"
        style={{
          left: 'max(10px, env(safe-area-inset-left, 0px))',
          bottom: DECK_NAV_BOTTOM,
          width: DECK_NAV_ICON_W,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
        }}
      >
        <img
          src={SAIL_STEERING_WHEEL}
          alt=""
          draggable={false}
          className="block w-full h-auto select-none pointer-events-none"
        />
        <span aria-hidden className={deckPlaqueClass} style={deckPlaqueStyle}>
          Home
        </span>
      </button>
      )}

      {showJourneyBtn && (
      <button
        type="button"
        onClick={goToSail}
        disabled={chromeLocked}
        aria-label="Journey — steer the ship to another island"
        className="absolute z-30 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl crew-nav-btn"
        style={{
          opacity: tour ? 1 : undefined, // spotlighted during the tour, not dimmed
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: DECK_NAV_BOTTOM,
          width: DECK_NAV_ICON_W,
          cursor: deckBusy ? 'default' : 'pointer',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
        }}
      >
        <img
          src={JOURNEY_MAP_ICON}
          alt=""
          draggable={false}
          className="block w-full h-auto select-none pointer-events-none"
        />
        <span aria-hidden className={deckPlaqueClass} style={deckPlaqueStyle}>
          Journey
        </span>
      </button>
      )}

      {showCrewBtn && (
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={chromeLocked}
        aria-label="Pick your crew"
        aria-haspopup="dialog"
        className="absolute z-30 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl crew-nav-btn"
        style={{
          opacity: tour ? 1 : undefined, // spotlighted during the tour, not dimmed
          right: 'max(10px, env(safe-area-inset-right, 0px))',
          bottom: DECK_NAV_BOTTOM,
          width: DECK_NAV_ICON_W,
          cursor: deckBusy ? 'default' : 'pointer',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
        }}
      >
        <img
          src={SAIL_BTN_CREW}
          alt=""
          draggable={false}
          className="block w-full h-auto select-none pointer-events-none"
        />
        <span aria-hidden className={deckPlaqueClass} style={deckPlaqueStyle}>
          Crew
        </span>
      </button>
      )}

      <CrewPickerDropdown open={pickerOpen} onClose={closePicker} anchor="page" />

      {/* Avatar Builder Shop — opened from the cabin door */}
      {shopOpen && (
        <Suspense fallback={null}>
          <ShopModal isOpen={shopOpen} onClose={() => setShopOpen(false)} initialBuilderMode />
        </Suspense>
      )}

      {/* Adam's first-tap tour — his portrait + spoken beat, above the nav row */}
      {tour && (
        <CrewGuideCard
          character={tour.character}
          voiceId={tour.character.voiceId || ADAM_TOUR_FALLBACK_VOICE_ID}
          beats={tourBeats}
          beatIndex={tour.beatIndex}
          speaking={tour.arrived && !tour.leaving}
          onAdvance={advanceTour}
          onSkip={() => endTour('skip')}
          bottom={TOUR_CARD_BOTTOM}
          lastBeatHint="Tap to follow Adam"
        />
      )}

      {/* Tap-to-chat popup — AI conversation with the tapped crew member */}
      {chatCharacter && (
        <CrewChatPopup
          character={chatCharacter}
          onClose={() => setChatCharacter(null)}
        />
      )}

      {toast && (
        <div
          className="absolute left-1/2 z-40 -translate-x-1/2 px-4 py-2.5 rounded-2xl font-display font-bold text-sm text-[#3d2414] text-center max-w-[85vw]"
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

      {/* White fade → basement or Canon Golf */}
      <OnboardingGuideCard
        variant="crewShip"
        active={crewGuide && !chatCharacter}
        onFinished={finishCrewGuide}
      />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 99980,
          background: '#fff',
          opacity: whiteFade ? 1 : 0,
          transition: reduceMotion ? 'none' : `opacity ${WHITE_FADE_MS}ms ease-in`,
        }}
        aria-hidden
      />

      <style>{`
        /* Cloud marquee — duplicate-strip pattern (see MainMapPage) */
        .crew-sea-cloud-track {
          display: flex;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: crew-sea-scroll var(--crew-cloud-loop, 90s) linear infinite;
        }
        .crew-sea-cloud-strip {
          position: relative;
          flex: 0 0 50%;
          width: 50%;
          height: 100%;
        }
        .crew-sea-cloud-strip img {
          filter: drop-shadow(0 2px 6px rgba(40, 80, 120, 0.18));
        }
        /* Wave crest / sparkle marquee — same seamless -50% shift */
        .crew-sea-wave-track {
          position: absolute;
          top: 0;
          left: 0;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: crew-sea-scroll linear infinite;
        }
        .crew-sea-wave-reverse {
          animation-name: crew-sea-scroll-reverse;
        }
        .crew-sea-wave-bob {
          will-change: transform;
          animation: crew-sea-bob ease-in-out infinite alternate;
        }
        /* Distant scenery barely sways — it's far away */
        .crew-sea-bob-far {
          will-change: transform;
          animation: crew-sea-bob-far 16s ease-in-out infinite alternate;
        }
        @keyframes crew-sea-bob-far {
          from { transform: translate3d(0, -2px, 0); }
          to { transform: translate3d(0, 2px, 0); }
        }
        @keyframes crew-sea-scroll {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @keyframes crew-sea-scroll-reverse {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes crew-sea-bob {
          from { transform: translate3d(0, -4px, 0); }
          to { transform: translate3d(0, 4px, 0); }
        }
        /* --- Jukebox party ------------------------------------------------ */
        /* Mirror ball — facet columns slide sideways for a slow-spin illusion */
        .crew-disco-ball {
          width: clamp(48px, 15vw, 68px);
          height: clamp(48px, 15vw, 68px);
          border-radius: 50%;
          background:
            radial-gradient(circle at 32% 26%, rgba(255,255,255,0.95), rgba(255,255,255,0) 30%),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.28) 0 2px, rgba(255,255,255,0) 2px 9px),
            repeating-linear-gradient(90deg, #E6ECF7 0 7px, #9FB0CC 7px 14px);
          box-shadow:
            0 0 16px rgba(214, 228, 255, 0.8),
            0 0 40px rgba(160, 200, 255, 0.45);
          animation: crew-ball-spin 2.4s linear infinite;
        }
        @keyframes crew-ball-spin {
          from { background-position: 0 0, 0 0, 0 0; }
          to { background-position: 0 0, 0 0, 28px 0; }
        }
        /* Sweeping spotlight cones fanned out from the disco ball */
        .crew-party-spot {
          position: absolute;
          top: 0;
          left: 0;
          width: min(64vw, 340px);
          height: 84vh;
          margin-left: calc(min(64vw, 340px) / -2);
          transform-origin: 50% 0;
          clip-path: polygon(50% 0, 100% 100%, 0 100%);
          mix-blend-mode: screen;
          animation-name: crew-party-sweep;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          will-change: transform;
        }
        @keyframes crew-party-sweep {
          from { transform: rotate(var(--spot-from, -20deg)); }
          to { transform: rotate(var(--spot-to, 20deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .crew-disco-ball, .crew-party-spot {
            animation: none !important;
          }
        }

        .ob-tap-adam {
          display: inline-flex;
          padding: 5px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.04em;
          color: #3E1F07;
          background: linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%);
          border: 2px solid #B8860B;
          box-shadow: 0 3px 0 #8B6914, 0 8px 16px rgba(0,0,0,0.35);
          text-shadow: 0 1px 0 rgba(255,255,255,0.45);
          white-space: nowrap;
          animation: ob-tap-adam-bounce 1.15s ease-in-out infinite;
        }
        @keyframes ob-tap-adam-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-tap-adam { animation: none; }
        }
        /* Nav buttons popping in once Adam introduces them. The pop runs on
           the button's children, not the button — its inline translateX
           centering must not be overridden by an animated transform. */
        .crew-nav-btn:disabled { opacity: 0.5; }
        .crew-nav-btn > * {
          animation: crew-nav-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .crew-nav-btn > span {
          /* plaque keeps its own translateX(-50%) */
          animation-name: crew-nav-pop-plaque;
        }
        @keyframes crew-nav-pop {
          from { opacity: 0; transform: translateY(14px) scale(0.85); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes crew-nav-pop-plaque {
          from { opacity: 0; transform: translateX(-50%) translateY(14px) scale(0.85); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .crew-nav-btn > * { animation: none; }
        }

        /* Tab hidden → hold every backdrop loop in place */
        .crew-sea-paused * {
          animation-play-state: paused !important;
        }
        /* Reduced motion → freeze to a static scene */
        @media (prefers-reduced-motion: reduce) {
          .crew-sea-backdrop * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CrewPage;
