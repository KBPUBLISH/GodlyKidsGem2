import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
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
  clearDiscoverShipPending,
  completeOnboardingJourney,
  isDiscoverShipPending,
  isOnboardingJourneyActive,
  resolveFirstStoryPackDestination,
} from '../utils/onboardingJourney';
import { noteBoatSession, noteJourneyStep } from '../utils/journeyStudy';
import { hasPremiumAccess } from '../utils/freeTierAccess';
import {
  CMS_ISLANDS_TIMEOUT_MS,
  fetchOceanMapIslands,
  getSailIslandArtSrc,
  type OceanMapIsland,
} from '../utils/oceanMapIslands';
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
/**
 * Wide sea panorama (repeat-x, mirror-tiled, horizon at HORIZON_PCT). It
 * pans with the wheel so the islands feel like the ship is turning.
 */
const CREW_VOYAGE_SKY = '/assets/images/crew-voyage-sea-pano.jpg?v=2';
const CREW_VOYAGE_HULL = '/assets/images/sail-voyage-hull.png?v=7';
/**
 * Scene stage: the hull art frame. It is fitted by HEIGHT and centered, so
 * the same fractions hold on phones (edges crop a little) and tablets
 * (water shows beside the ship). CrewDeck3D maps the walk zone the same way.
 */
const STAGE_ASPECT = 1520 / 2688;
/**
 * Stage = object-cover of the hull art. Phones (narrower than the art) crop
 * the sides; tablets (wider) fill the width. On every layout the ship is
 * pushed DOWN by a share of the screen height so more sky and island show
 * above the cabin; the extra planks go under the bow bar. CrewDeck3D uses
 * the same offsets (topPct / wideTopPct).
 */
const STAGE_TOP_PCT = 0.11;
const STAGE_WIDE_TOP_PCT = 0.07;
/** Island art width as a fraction of the stage width (active island). */
const ISLAND_WIDTH_FRAC = 0.42;
/** Plain sky color for the strip above the panorama on tablets. */
const SKY_TOP_COLOR = '#91dff9';
/** Water line, as a fraction of the stage height (islands sit on it). */
const HORIZON_PCT = 16.5;
/** Sea panorama tile (crew-voyage-sea-pano.jpg) width ÷ height. */
const SEA_PANO_ASPECT = 3840 / 1229;
/** How far the panorama pans per island notch, as a fraction of stage width. */
const SEA_PAN_PER_NOTCH = 0.16;

type StageRect = { left: number; top: number; width: number; height: number; pageW: number; pageH: number };

const stageFor = (w: number, h: number): StageRect => {
  const sw = Math.max(w, h * STAGE_ASPECT);
  const sh = sw / STAGE_ASPECT;
  const top = h * (sh > h + 1 ? STAGE_WIDE_TOP_PCT : STAGE_TOP_PCT);
  return { left: (w - sw) / 2, top, width: sw, height: sh, pageW: w, pageH: h };
};

const useStageRect = (ref: React.RefObject<HTMLElement | null>): StageRect => {
  const [rect, setRect] = useState<StageRect>(() =>
    stageFor(
      typeof window !== 'undefined' ? window.innerWidth : 390,
      typeof window !== 'undefined' ? window.innerHeight : 844,
    ),
  );
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      setRect((prev) => (prev.pageW === w && prev.pageH === h ? prev : stageFor(w, h)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return rect;
};

/** Stage-fraction box (`left/top/width/height` in % of the stage) → viewport px. */
const onStage = (stage: StageRect, box: React.CSSProperties): React.CSSProperties => {
  const pct = (v: unknown) => (typeof v === 'string' && v.endsWith('%') ? parseFloat(v) / 100 : null);
  const out: React.CSSProperties = { ...box };
  const l = pct(box.left);
  const w = pct(box.width);
  const t = pct(box.top);
  const h = pct(box.height);
  if (l !== null) out.left = stage.left + l * stage.width;
  if (w !== null) out.width = w * stage.width;
  if (t !== null) out.top = stage.top + t * stage.height;
  if (h !== null) out.height = h * stage.height;
  return out;
};
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
const SAIL_STEERING_WHEEL = '/assets/images/sail-voyage-wheel.png?v=2';
const CREW_TAB_BAR = '/assets/images/crew-voyage-bow.png?v=2';
/**
 * Bow art (2048×1360): arch peak at 30% of its height, lanterns at x 14% /
 * 86%, plank strip from 61.3% to 88.5%, last opaque row at 90.7%.
 */
const BOW_ASPECT = 2048 / 1360;
const BOW_BOTTOM_PAD = 0.093;
const BOW_STRIP_TOP = 0.613;
const BOW_STRIP_BOTTOM = 0.885;
const CREW_TAB_ART: Record<string, string> = {
  crew: '/assets/images/sail-voyage-btn-crew.png?v=4',
  profile: '/assets/images/sail-voyage-btn-profile.png?v=1',
  home: '/assets/images/sail-voyage-btn-home.png?v=5',
  library: '/assets/images/sail-voyage-btn-library.png?v=4',
};
const SHIP_TAB_WOOD = '/assets/images/sail-tab-wood.png';
/** Shared wood texture — matches Sail “Travel Here” plaque. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const DECK_NAV_BOTTOM = 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))';
/** Adam's tour card sits just above the wheel, clear of the button bow. */
const TOUR_CARD_BOTTOM = 'max(300px, calc(var(--safe-area-bottom, 0px) + 280px))';

/* Hotspots are fractions of the STAGE (hull art frame), see onStage(). */
/**
 * Jukebox is parked for now: the deck art no longer paints it (tablets crop
 * the deck too short for both it and the hatch). Flip to bring the party
 * hotspot and Adam's tour beat back.
 */
const JUKEBOX_ENABLED = false;
/** Where the jukebox stood, mid deck center (hotspot when enabled). */
const JUKEBOX_BOX: React.CSSProperties = {
  left: '35%',
  top: '40%',
  width: '22%',
  height: '19%',
};
/** Hatch sprite (drawn by us, not the hull art) — just below the cabin stairs. */
const CREW_HATCH_SPRITE = '/assets/images/crew-voyage-hatch.png?v=1';
/** Left-rail barrels stand in for the cannon tap on this deck. */
const CANNON_BOX: React.CSSProperties = {
  left: '3%',
  top: '37%',
  width: '22%',
  height: '14%',
};
/**
 * Open hatch — mid deck center, right under the cabin stairs so it stays
 * above the wheel on tablets (which crop the lower deck).
 */
const HATCH_BOX: React.CSSProperties = {
  left: '38%',
  top: '40.5%',
  width: '24%',
  height: '8.5%',
};

/** Band for 2D crew plaques — the open mid deck. */
const PLAQUE_BAND_BOX: React.CSSProperties = {
  left: '6%',
  width: '88%',
  top: '42%',
  height: '20%',
};

/** Glowing dove door on the cabin. */
const SHOP_DOOR_BOX: React.CSSProperties = {
  left: '37%',
  top: '28%',
  width: '26%',
  height: '10%',
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
    walkTo: { x: 0.28, y: 0.53 },
    spot: CANNON_BOX,
  },
  jukebox: {
    walkTo: { x: 0.64, y: 0.56 },
    spot: JUKEBOX_BOX,
  },
  door: {
    walkTo: { x: 0.50, y: 0.42 },
    spot: SHOP_DOOR_BOX,
  },
  crew: {
    walkTo: { x: 0.22, y: 0.64 },
    spot: {
      left: 'calc(50vw - 42vw)',
      bottom: 'calc(var(--safe-area-bottom, 0px) + 3vh)',
      width: '20vw',
      height: '9vh',
    },
  },
  journey: {
    walkTo: { x: 0.50, y: 0.62 },
    spot: {
      left: '50vw',
      transform: 'translateX(-50%)',
      bottom: 'calc(var(--safe-area-bottom, 0px) + 11vh)',
      width: 'min(50vw, 29vh)',
      height: 'min(50vw, 29vh)',
    },
  },
  hatch: {
    walkTo: { x: 0.34, y: 0.52 },
    spot: HATCH_BOX,
  },
};

type ShipTab = {
  id: string;
  label: string;
  aria: string;
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
};

/** Little sailboat, cottage, and bible — painted to match the gable mock. */
const CrewBoatIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden>
    <path d="M14 40 L32 16 L32 40 Z" fill="#F7F1E4" />
    <path d="M34 24 L34 40 L50 40 Z" fill="#E4534A" />
    <path d="M32 12 V40" stroke="#8A5A32" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M30 14 L36 14 L33 7 Z" fill="#3E8FD4" />
    <path d="M8 42 H56 L50 50 Q32 56 14 50 Z" fill="#C4843C" />
    <path d="M12 44 H52" stroke="#8A5424" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MyHomeIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden>
    <path d="M10 30 L32 12 L54 30 V52 H10 Z" fill="#F4E2C4" />
    <path d="M6 32 L32 8 L58 32 L52 32 L32 16 L12 32 Z" fill="#E4534A" />
    <rect x="27" y="36" width="10" height="16" rx="1.5" fill="#8A5424" />
    <rect x="16" y="34" width="8" height="8" rx="1.5" fill="#7EC8F0" />
    <rect x="40" y="34" width="8" height="8" rx="1.5" fill="#7EC8F0" />
    <rect x="42" y="16" width="6" height="10" fill="#C4843C" />
  </svg>
);

const LibraryBookIcon = () => (
  <svg viewBox="0 0 64 64" aria-hidden>
    <path d="M14 12 H46 Q52 12 52 18 V52 H18 Q14 52 14 48 Z" fill="#8A5424" />
    <path d="M18 12 H48 V48 H18 Q14 48 14 44 V16 Q14 12 18 12 Z" fill="#C4843C" />
    <path d="M18 16 H44 V46 H18 Z" fill="#F7F1E4" />
    <path d="M31 22 H33 V42 H31 Z" fill="#E0B33A" />
    <path d="M24 31 H40 V33 H24 Z" fill="#E0B33A" />
  </svg>
);

/** Peaked wood board: wheel on the crest, two tiles, a gap, two tiles. */
/** Wheel turns a quarter turn per island… */
const ISLAND_STEP_DEG = 90;
/** …and the hand has to drag this far before it clicks to the next one. */
const ISLAND_DETENT = 62;
/** How closely the wheel follows the hand before the click (1 = exactly). */
const WHEEL_FOLLOW = 0.85;
/** Rubber-band follow when there is no island further in that direction. */
const WHEEL_END_FOLLOW = 0.15;
/** Shortest gap between two clicks, so one hard flick is still one island. */
const WHEEL_SETTLE_MS = 120;
/**
 * Inside this fraction of the radius the hand is on the hub, where the
 * angle to the center is meaningless — a plain horizontal swipe turns the
 * wheel instead (kids swipe straight across it), scaled as if the finger
 * were on a rim this far out.
 */
const WHEEL_HUB_FRAC = 0.45;
const WHEEL_SWIPE_RIM_FRAC = 0.7;
/** Movement under this (deg) is finger jitter. */
const WHEEL_DEAD_DEG = 0.1;
/** Per-frame catch-up of the drawn wheel toward the hand (1 = instant). */
const WHEEL_LERP = 0.45;
const WHEEL_IDLE_TRANSITION = 'transform 0.78s cubic-bezier(0.22, 0.9, 0.28, 1)';

type VoyageIsland = {
  id: string;
  title: string;
  src: string;
  hasMainMap: boolean;
  storiesComplete: number;
  storiesTotal: number;
};

const toVoyageIsland = (island: OceanMapIsland): VoyageIsland | null => {
  const src = getSailIslandArtSrc(island);
  if (!src) return null;
  const title = (island.book && island.book.trim()) || island.title;
  return {
    id: island.id,
    title,
    src,
    hasMainMap: Boolean(island.mainMapUrl || island.mainMapVideoUrl),
    storiesComplete: island.storiesComplete,
    storiesTotal: island.storiesTotal || 5,
  };
};

const firstIslandDone = (islands: VoyageIsland[]) => {
  const first = islands[0];
  if (!first) return false;
  return first.storiesTotal > 0 && first.storiesComplete >= first.storiesTotal;
};

const ShipDeckTabBar: React.FC<{
  tabs: ShipTab[];
  disabled?: boolean;
  wheelRef: React.RefObject<HTMLButtonElement | null>;
  rotation: number;
  wheelTransition?: string;
  /** Pointer down on the wheel; move/up are tracked on window with capture. */
  onWheelDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  stage: StageRect;
}> = ({ tabs, disabled, wheelRef, rotation, wheelTransition, onWheelDown, stage }) => {
  // Bow spans the screen width on phones. On tablets (the deck art is taller
  // than the screen, so the lower deck is already cropped) the bow is kept
  // smaller so the hatch and walkable planks stay in view. Wheel sits on the
  // strip's gold edge, its top third over the planks; the four tiles share
  // the plank strip in equal cells.
  const wideCrop = stage.height > stage.pageH + 1;
  const barW = Math.min(stage.pageW * 1.12, stage.pageH * (wideCrop ? 0.52 : 0.66));
  const barH = barW / BOW_ASPECT;
  const wheelD = barW * 0.45;
  const cell = Math.min(barW * 0.19, barH * (BOW_STRIP_BOTTOM - BOW_STRIP_TOP) * 0.86);
  const stripW = Math.min(cell * 4 + 3 * Math.round(cell * 0.16), stage.pageW - 12);
  const stripBottom = barH * (1 - BOW_STRIP_BOTTOM) + (barH * (BOW_STRIP_BOTTOM - BOW_STRIP_TOP) - cell) / 2;
  return (
  <div
    className="pointer-events-none absolute inset-x-0 z-30"
    style={{ height: barH, bottom: `calc(var(--safe-area-bottom, 0px) - ${Math.round(barH * BOW_BOTTOM_PAD)}px)` }}
  >
    {/* Dark wood under the strip so the home-indicator inset is never sky. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-full"
      style={{ height: 'var(--safe-area-bottom, 0px)', marginTop: -Math.round(barH * BOW_BOTTOM_PAD), background: '#4a2a12' }}
    />
    {/* Wide screens: plank-colored fill so the strip reaches both edges
        when the bow art is narrower than the page. */}
    {barW < stage.pageW && (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: barH * (BOW_STRIP_TOP + 0.01),
          height: barH * (BOW_STRIP_BOTTOM - BOW_STRIP_TOP - 0.02),
          background: 'linear-gradient(180deg, #B8743F 0%, #9A5A2C 55%, #6E3B16 100%)',
          boxShadow: 'inset 0 3px 0 #E0A552, inset 0 -3px 0 #4a2a12',
        }}
      />
    )}
    <img
      src={CREW_TAB_BAR}
      alt=""
      draggable={false}
      className="pointer-events-none absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 select-none"
      style={{ width: barW, height: barH }}
    />
    <button
      ref={wheelRef}
      type="button"
      disabled={disabled}
      aria-label="Turn the wheel to change island"
      className="pointer-events-auto absolute left-1/2 z-[2] m-0 touch-none select-none border-0 bg-transparent p-0 disabled:opacity-60"
      style={{
        bottom: barH * (1 - BOW_STRIP_TOP) - wheelD * 0.06,
        width: wheelD,
        transform: 'translateX(-50%)',
        filter: 'drop-shadow(0 8px 10px rgba(60, 24, 8, 0.45))',
        // iOS: no save-image callout / selection loupe on a long slow turn.
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        WebkitUserDrag: 'none',
      } as React.CSSProperties}
      onPointerDown={onWheelDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={SAIL_STEERING_WHEEL}
        alt=""
        draggable={false}
        className="pointer-events-none block h-auto w-full select-none"
        style={{ transform: `rotate(${rotation}deg)`, transition: wheelTransition, willChange: 'transform' }}
      />
    </button>
    <div
      className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-end justify-between"
      style={{ bottom: stripBottom, width: stripW }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={tab.onClick}
          disabled={disabled}
          aria-label={tab.aria}
          aria-current={tab.active ? 'page' : undefined}
          className="shrink-0 border-0 bg-transparent p-0 disabled:opacity-60"
          style={{ width: cell, height: cell }}
        >
          <img
            src={CREW_TAB_ART[tab.id]}
            alt=""
            draggable={false}
            className={`pointer-events-none block h-full w-full select-none object-contain object-bottom drop-shadow-[0_4px_4px_rgba(40,18,6,0.35)] ${tab.active ? 'scale-[1.06]' : ''}`}
          />
        </button>
      ))}
    </div>
  </div>
  );
};

/** Hatch open hint before white fade. */
const HATCH_OPEN_MS = 320;
/** White fade-out duration before basement / cannon navigate. */
const WHITE_FADE_MS = 480;
const NAVIGATE_AFTER_MS = HATCH_OPEN_MS + WHITE_FADE_MS;
/** Sail-to-island: the island grows toward the ship this long, white fade overlapping its end. */
const SAIL_IN_MS = 1250;
const SAIL_IN_EASE = `transform ${SAIL_IN_MS}ms cubic-bezier(0.55, 0.05, 0.75, 0.6)`;
/** How much the island and sea swell as the ship closes in. */
const SAIL_IN_ISLAND_SCALE = 1.9;
const SAIL_IN_SEA_SCALE = 1.14;
/** My Home exit: the wheel spins this far while the white fade starts. */
const WHEEL_SPIN_OUT_DEG = 540;
const WHEEL_SPIN_OUT_MS = 1100;
/** White fade begins partway through the spin so they overlap. */
const WHEEL_SPIN_FADE_DELAY_MS = 380;
const CANON_GAME_PATH = '/crew/canon';

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
 * Wheel (bottom-left) returns to sail; glowing cannon → Canon Golf;
 * open hatch → white fade → basement.
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
  const enteringRef = useRef(false);
  const reduceMotion = prefersReducedMotion();
  const arrivingOnboarding = isOnboardingJourneyActive();
  const discoverShip =
    Boolean((location.state as { discoverShip?: boolean } | null)?.discoverShip) ||
    isDiscoverShipPending();
  const discoverShipRef = useRef(discoverShip);
  discoverShipRef.current = discoverShip;

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
    () => buildAdamDeckTour(kidName).filter((b) => JUKEBOX_ENABLED || b.id !== 'jukebox'),
    [kidName],
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
    if (discoverShipRef.current) {
      if (enteringRef.current) return;
      enteringRef.current = true;
      clearDiscoverShipPending();
      setCrewGuide(false);
      void resolveFirstStoryPackDestination()
        .then((dest) => {
          navigate(dest.path, { replace: true, state: dest.state });
        })
        .catch(() => {
          enteringRef.current = false;
          navigate('/map', { replace: true, state: { onboardingJourney: true } });
        });
      return;
    }
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

  const goProfile = useCallback(() => {
    if (enteringRef.current || enteringGame) return;
    navigate('/profile', { state: { returnTo: '/crew' } });
  }, [enteringGame, navigate]);

  const [voyageIslands, setVoyageIslands] = useState<VoyageIsland[]>([]);
  const [lookIndex, setLookIndex] = useState(0);
  const [wheelDrag, setWheelDrag] = useState(false);
  /** Rotation React keeps on the img while a drag owns the transform. */
  const [wheelHold, setWheelHold] = useState(0);
  const [sailingIsland, setSailingIsland] = useState(false);
  const [wheelSpinOut, setWheelSpinOut] = useState(false);
  const voyageRef = useRef<VoyageIsland[]>([]);
  const lookRef = useRef(0);
  const wheelRef = useRef<HTMLButtonElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stage = useStageRect(pageRef);
  /**
   * Live wheel drag. Everything per-move lives here (no React state per
   * pointermove — a CrewPage re-render per touch sample lagged the thumb on
   * phones); the img transform is written straight from a rAF loop.
   */
  const wheelGestureRef = useRef({
    active: false,
    pointerId: -1,
    cx: 0,
    cy: 0,
    radius: 1,
    /** Last hand angle about the center (deg). */
    angle: 0,
    lastX: 0,
    /** Hub swipe: which rim the hand is "on" (+1 top rim, -1 bottom rim). */
    swipeSign: -1,
    /** Hand travel since the last click (deg, carried over past clicks). */
    accum: 0,
    /** Creep (deg) the wheel should draw on top of the notch. */
    creep: 0,
    /** Rotation currently drawn. */
    shown: 0,
    settleUntil: 0,
    frame: 0,
  });
  const sailingRef = useRef(false);
  voyageRef.current = voyageIslands;
  lookRef.current = lookIndex;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(() => controller.abort(), CMS_ISLANDS_TIMEOUT_MS);
    void fetchOceanMapIslands(controller.signal)
      .then((mapped) => {
        if (cancelled || !mapped) return;
        const next = mapped.map(toVoyageIsland).filter((row): row is VoyageIsland => row != null);
        if (next.length) setVoyageIslands(next);
      })
      .catch(() => {
        /* horizon stays open water */
      })
      .finally(() => window.clearTimeout(failSafe));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, []);

  const shiftIsland = useCallback((direction: 1 | -1) => {
    const count = voyageRef.current.length;
    const next = Math.max(0, Math.min(count - 1, lookRef.current + direction));
    if (next === lookRef.current) return false;
    lookRef.current = next;
    setLookIndex(next);
    return true;
  }, []);

  /** Tap on a neighbor island: turn the wheel to it. */
  const lookAtIsland = useCallback((index: number) => {
    if (sailingRef.current || index === lookRef.current) return;
    lookRef.current = index;
    setLookIndex(index);
  }, []);

  const wheelImg = () => wheelRef.current?.querySelector('img') ?? null;

  /** rAF loop: ease the drawn wheel toward notch + creep while a drag owns it. */
  const startWheelLoop = useCallback(() => {
    const g = wheelGestureRef.current;
    if (g.frame) return;
    const tick = () => {
      const img = wheelImg();
      if (!g.active || !img) {
        g.frame = 0;
        return;
      }
      const target = lookRef.current * ISLAND_STEP_DEG + g.creep;
      g.shown += (target - g.shown) * WHEEL_LERP;
      if (Math.abs(target - g.shown) < 0.05) g.shown = target;
      img.style.transform = `rotate(${g.shown}deg)`;
      g.frame = requestAnimationFrame(tick);
    };
    g.frame = requestAnimationFrame(tick);
  }, []);

  const onWheelPointerMove = useCallback(
    (e: PointerEvent) => {
      const g = wheelGestureRef.current;
      if (!g.active || e.pointerId !== g.pointerId || sailingRef.current) return;
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      let delta: number;
      if (Math.hypot(dx, dy) < g.radius * WHEEL_HUB_FRAC) {
        // On the hub: sideways finger travel turns the wheel.
        delta = ((e.clientX - g.lastX) / (g.radius * WHEEL_SWIPE_RIM_FRAC)) * (180 / Math.PI) * g.swipeSign;
      } else {
        delta = angle - g.angle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
      }
      g.angle = angle;
      g.lastX = e.clientX;
      if (Math.abs(delta) < WHEEL_DEAD_DEG) return;
      let accum = g.accum + delta;
      if (Math.abs(accum) >= ISLAND_DETENT) {
        const dir: 1 | -1 = accum > 0 ? 1 : -1;
        const now = performance.now();
        if (now >= g.settleUntil && shiftIsland(dir)) {
          // Carry the hand past the click so continuous turning keeps
          // clicking every quarter turn instead of restarting each notch.
          accum -= dir * ISLAND_STEP_DEG;
          g.settleUntil = now + WHEEL_SETTLE_MS;
          navigator.vibrate?.(6);
        } else {
          accum = dir * ISLAND_DETENT;
        }
      }
      g.accum = accum;
      const count = voyageRef.current.length;
      const atEnd = (accum > 0 && lookRef.current >= count - 1) || (accum < 0 && lookRef.current <= 0);
      g.creep = accum * (atEnd ? WHEEL_END_FOLLOW : WHEEL_FOLLOW);
    },
    [shiftIsland],
  );

  const onWheelPointerUp = useCallback((e: PointerEvent) => {
    const g = wheelGestureRef.current;
    if (!g.active || e.pointerId !== g.pointerId) return;
    g.active = false;
    g.accum = 0;
    g.creep = 0;
    if (g.frame) cancelAnimationFrame(g.frame);
    g.frame = 0;
    window.removeEventListener('pointermove', onWheelPointerMove);
    window.removeEventListener('pointerup', onWheelPointerUp);
    window.removeEventListener('pointercancel', onWheelPointerUp);
    const btn = wheelRef.current;
    try {
      if (btn?.hasPointerCapture(g.pointerId)) btn.releasePointerCapture(g.pointerId);
    } catch {
      /* capture already gone */
    }
    // Hand the transform back to React: ease onto the notch from wherever
    // the drag left it (React only rewrites the style when its value changes).
    const img = wheelImg();
    if (img) {
      img.style.transition = WHEEL_IDLE_TRANSITION;
      img.style.transform = `rotate(${lookRef.current * ISLAND_STEP_DEG}deg)`;
    }
    setWheelDrag(false);
  }, [onWheelPointerMove]);

  const onWheelDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = wheelGestureRef.current;
      if (sailingRef.current || g.active || e.currentTarget.disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Keep the touch: no compat mouse events, focus ring, or deck taps.
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      g.cx = rect.left + rect.width / 2;
      g.cy = rect.top + rect.height / 2;
      g.radius = Math.max(1, rect.width / 2);
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      g.angle = Math.atan2(dy, dx) * (180 / Math.PI);
      g.lastX = e.clientX;
      // Start on the top rim: a sideways swipe drags that rim. Anywhere else
      // (lower half, hub) the bottom rim follows the finger.
      g.swipeSign = dy < -g.radius * WHEEL_HUB_FRAC ? 1 : -1;
      g.accum = 0;
      g.creep = 0;
      g.settleUntil = 0;
      g.pointerId = e.pointerId;
      g.active = true;
      // Pick up from the wheel's current drawn angle (it may be mid-ease).
      const base = lookRef.current * ISLAND_STEP_DEG;
      g.shown = base;
      const img = wheelImg();
      if (img) {
        const m = getComputedStyle(img).transform.match(/matrix\(([^)]+)\)/);
        if (m) {
          const [a, b] = m[1].split(',').map(Number);
          let off = Math.atan2(b, a) * (180 / Math.PI) - base;
          off = ((((off + 180) % 360) + 360) % 360) - 180;
          g.shown = base + off;
        }
        img.style.transition = 'none';
      }
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic / already captured — window listeners still track it */
      }
      window.addEventListener('pointermove', onWheelPointerMove);
      window.addEventListener('pointerup', onWheelPointerUp);
      window.addEventListener('pointercancel', onWheelPointerUp);
      setWheelHold(base);
      setWheelDrag(true);
      startWheelLoop();
    },
    [onWheelPointerMove, onWheelPointerUp, startWheelLoop],
  );

  useEffect(
    () => () => {
      const g = wheelGestureRef.current;
      if (g.frame) cancelAnimationFrame(g.frame);
      g.frame = 0;
      g.active = false;
      window.removeEventListener('pointermove', onWheelPointerMove);
      window.removeEventListener('pointerup', onWheelPointerUp);
      window.removeEventListener('pointercancel', onWheelPointerUp);
    },
    [onWheelPointerMove, onWheelPointerUp],
  );

  const openVoyageIsland = useCallback((island: VoyageIsland) => {
    if (sailingRef.current) return;
    const islands = voyageRef.current;
    const unlocked = islands[0]?.id === island.id || firstIslandDone(islands);
    if (!unlocked) {
      if (!hasPremiumAccess()) {
        navigate('/onboarding/welcome', { state: { returnTo: '/map', reason: 'continue-journey' } });
      }
      return;
    }
    sailingRef.current = true;
    setSailingIsland(true);
    const dest = island.hasMainMap
      ? `/map/${encodeURIComponent(island.id)}/main`
      : `/sail/${encodeURIComponent(island.id)}/lesson`;
    const go = () => navigate(dest, { state: { title: island.title, fromSail: true } });
    if (prefersReducedMotion()) {
      setWhiteFade(true);
      window.setTimeout(go, 80);
      return;
    }
    // The island swells toward the bow, then the deck fades to white.
    window.setTimeout(() => setWhiteFade(true), SAIL_IN_MS - WHITE_FADE_MS);
    window.setTimeout(go, SAIL_IN_MS);
  }, [navigate]);

  const activeVoyage = voyageIslands[lookIndex] ?? voyageIslands[0];
  const voyageUnlocked = !!activeVoyage && (voyageIslands[0]?.id === activeVoyage.id || firstIslandDone(voyageIslands));
  // While a drag owns the wheel the prop stays frozen at its start value so
  // React never overwrites the per-frame transform; on release it eases to
  // the notch (see onWheelPointerUp).
  const wheelRotation =
    (wheelDrag ? wheelHold : lookIndex * ISLAND_STEP_DEG) + (wheelSpinOut ? WHEEL_SPIN_OUT_DEG : 0);
  const wheelTransition = wheelSpinOut
    ? `transform ${WHEEL_SPIN_OUT_MS}ms cubic-bezier(0.3, 0.1, 0.35, 1)`
    : wheelDrag
      ? 'none'
      : WHEEL_IDLE_TRANSITION;

  const goLibrary = useCallback(() => {
    if (enteringRef.current || enteringGame) return;
    navigate('/listen');
  }, [enteringGame, navigate]);

  /** My Home: the wheel spins hard, the deck fades to white, then we land. */
  const goMyHome = useCallback(() => {
    if (enteringRef.current || enteringGame) return;
    const go = () => navigate('/my-home', { state: { from: '/crew' } });
    if (reduceMotion) {
      go();
      return;
    }
    enteringRef.current = true;
    clearTimers();
    setWheelSpinOut(true);
    const fadeId = window.setTimeout(() => setWhiteFade(true), WHEEL_SPIN_FADE_DELAY_MS);
    const navId = window.setTimeout(go, WHEEL_SPIN_FADE_DELAY_MS + WHITE_FADE_MS);
    timersRef.current = [fadeId, navId];
  }, [clearTimers, enteringGame, navigate, reduceMotion]);

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

  const openCanonGame = useCallback(() => {
    if (enteringRef.current || hatchOpen || enteringGame) return;
    enteringRef.current = true;
    setEnteringGame(true);
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
      openCanonGame();
    },
    [enteringGame, hatchOpen, openCanonGame, openChat],
  );

  return (
    <div ref={pageRef} className="relative w-full h-screen overflow-hidden">
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

      {/* Sea panorama: one tall tile repeated sideways, panning a little
          with every wheel notch (islands move faster — parallax). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-0"
        style={{
          top: 0,
          height: stage.top + stage.height,
          backgroundColor: SKY_TOP_COLOR,
          backgroundImage: `url(${CREW_VOYAGE_SKY})`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: `${Math.round(stage.height * SEA_PANO_ASPECT)}px ${Math.round(stage.height)}px`,
          backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) ${Math.round(stage.top)}px`,
          transform: sailingIsland && !reduceMotion ? `scale(${SAIL_IN_SEA_SCALE})` : 'none',
          transformOrigin: `50% ${Math.round(stage.top + (stage.height * HORIZON_PCT) / 100)}px`,
          transition: reduceMotion
            ? 'none'
            : sailingIsland
              ? `background-position 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), ${SAIL_IN_EASE}`
              : 'background-position 0.62s cubic-bezier(0.16, 1.45, 0.32, 1)',
        }}
      />
      {/* Tablets: the ship sits lower, so mirror the panorama's top sky into
          the strip above it instead of showing a flat color seam. */}
      {stage.top > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0"
          style={{
            height: Math.ceil(stage.top) + 1,
            transform: 'scaleY(-1)',
            backgroundImage: `url(${CREW_VOYAGE_SKY})`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: `${Math.round(stage.height * SEA_PANO_ASPECT)}px ${Math.round(stage.height)}px`,
            backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) 0`,
            transition: reduceMotion ? 'none' : 'background-position 0.62s cubic-bezier(0.16, 1.45, 0.32, 1)',
          }}
        />
      )}
      {/* Living water: the same panorama water, drifting a few px against
          the base copy (soft-light) so ripples and glints move, plus a slow
          sparkle marquee. Skipped under prefers-reduced-motion. */}
      {!reduceMotion && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[1] overflow-hidden"
          style={{
            top: stage.top + (stage.height * HORIZON_PCT) / 100,
            height: stage.height * (1 - HORIZON_PCT / 100),
            // Ripple copy can't follow the sail-in zoom; let it go.
            opacity: sailingIsland ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        >
          <div
            className="crew-sea-ripple absolute"
            style={{
              inset: '-6px -14px',
              backgroundImage: `url(${CREW_VOYAGE_SKY})`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: `${Math.round(stage.height * SEA_PANO_ASPECT)}px ${Math.round(stage.height)}px`,
              backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) ${-Math.round((stage.height * HORIZON_PCT) / 100) - 6}px`,
              transition: 'background-position 0.62s cubic-bezier(0.16, 1.45, 0.32, 1)',
              mixBlendMode: 'soft-light',
              opacity: 0.85,
            }}
          />
          <div className="crew-sea-wave-bob absolute inset-x-0 inset-y-0" style={{ opacity: 0.45, animationDuration: '11s' }}>
            <div
              className="crew-sea-wave-track crew-sea-wave-reverse"
              style={{
                backgroundImage: CREW_SEA_SPARKLE_TILE,
                backgroundRepeat: 'repeat',
                backgroundSize: '12.5% 64px',
                animationDuration: '46s',
              }}
            />
          </div>
        </div>
      )}
      {/* Real voyage islands on the water line, sliding the way the world
          wheel carousel does. Bases sit just below the horizon. */}
      <div
        className="pointer-events-none absolute z-[2]"
        style={{
          left: stage.left,
          width: stage.width,
          top: stage.top,
          height: (stage.height * (HORIZON_PCT + 5)) / 100,
          // Sail-in: the whole band swells toward the bow (bob lives on the
          // inner wrapper so the keyframes don't fight this transform).
          transform: sailingIsland && !reduceMotion ? `scale(${SAIL_IN_ISLAND_SCALE})` : 'scale(1)',
          transformOrigin: '50% 100%',
          transition: reduceMotion ? 'none' : SAIL_IN_EASE,
        }}
        aria-hidden
      >
        <div className={`absolute inset-0${reduceMotion ? '' : ' crew-sea-bob-far'}`}>
        {voyageIslands.map((island, i) => {
          const offset = i - lookIndex;
          const distance = Math.abs(offset);
          if (distance > 2.4) return null;
          const scale = Math.max(0.46, 1 - distance * 0.3);
          return (
            <img
              key={island.id}
              src={island.src}
              alt=""
              draggable={false}
              className="absolute bottom-0 h-auto max-w-none select-none"
              style={{
                left: `${50 - offset * 50}%`,
                width: `${ISLAND_WIDTH_FRAC * 100}%`,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: '50% 100%',
                opacity: Math.max(0.4, 1 - distance * 0.28),
                filter: voyageIslands[0]?.id === island.id || firstIslandDone(voyageIslands) ? undefined : 'grayscale(1) brightness(0.9)',
                transition: 'left 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), transform 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), opacity 0.42s ease',
                zIndex: 4 - Math.round(distance),
              }}
            />
          );
        })}
        </div>
      </div>
      {/* Tap layer over the islands (above the 3D canvas): the whole island
          is the target, its name floats centered above it. Tapping the
          island you are looking at sails there; a neighbor turns to it. */}
      {voyageIslands.map((island, i) => {
        const offset = i - lookIndex;
        const distance = Math.abs(offset);
        if (distance > 1.6) return null;
        const scale = Math.max(0.46, 1 - distance * 0.3);
        const size = stage.width * ISLAND_WIDTH_FRAC * scale;
        const cx = stage.left + stage.width * (0.5 - offset * 0.5);
        const bottom = stage.top + (stage.height * (HORIZON_PCT + 5)) / 100;
        const isActive = offset === 0;
        const unlocked = voyageIslands[0]?.id === island.id || firstIslandDone(voyageIslands);
        const label = isActive && sailingIsland ? 'Sailing…' : unlocked ? island.title : `Complete ${voyageIslands[0]?.title || 'Beginnings'}`;
        const progress = unlocked && !(isActive && sailingIsland)
          ? `${Math.min(island.storiesComplete, island.storiesTotal)}/${island.storiesTotal} stories complete`
          : null;
        // Neighbors whose center is off the phone screen keep the tap target
        // (a sliver of island peeks in) but not a half-visible label.
        const showLabel = cx > 24 && cx < stage.pageW - 24;
        return (
          <button
            key={`tap-${island.id}`}
            type="button"
            aria-label={isActive ? `Sail to ${island.title}` : `Look at ${island.title}`}
            onClick={() => (isActive ? openVoyageIsland(island) : lookAtIsland(i))}
            disabled={sailingIsland}
            className="absolute z-[6] m-0 border-0 bg-transparent p-0"
            style={{
              left: cx - size / 2,
              top: bottom - size,
              width: size,
              height: size,
              opacity: sailingIsland && !isActive ? 0 : 1,
              transition: 'left 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), top 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), width 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), height 0.62s cubic-bezier(0.16, 1.45, 0.32, 1), opacity 0.3s ease',
            }}
          >
            <span
              className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
              style={{
                top: `max(calc(var(--safe-area-top, 0px) + 6px - ${Math.round(bottom - size)}px), 0px)`,
                opacity: !showLabel ? 0 : isActive ? 1 : 0.8,
                transition: 'opacity 0.3s ease',
              }}
            >
              <span
                className="whitespace-nowrap rounded-full px-2.5 py-0.5 font-black leading-tight text-[#7A3E12]"
                style={{
                  fontSize: isActive ? 12 : 10,
                  background: 'linear-gradient(180deg, #FFD36A 0%, #FFB23D 100%)',
                  boxShadow: '0 3px 0 #E09020',
                  fontFamily: "'Baloo 2', 'Fredoka', sans-serif",
                  transition: 'font-size 0.3s ease',
                }}
              >
                {label}
              </span>
              {progress && (
                <span
                  className="whitespace-nowrap rounded-full px-2 py-[1px] font-bold leading-tight text-[#FFF4D6]"
                  style={{
                    fontSize: isActive ? 10 : 8,
                    background: 'rgba(42, 22, 12, 0.72)',
                    boxShadow: '0 1px 0 rgba(255,230,180,0.25) inset, 0 2px 4px rgba(0,0,0,0.35)',
                    fontFamily: "'Baloo 2', 'Fredoka', sans-serif",
                    transition: 'font-size 0.3s ease',
                  }}
                >
                  {progress}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {/* Hull fills the stage frame — same mapping as the 3D walk zone. */}
      <img
        src={CREW_VOYAGE_HULL}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute z-[3] max-w-none select-none"
        style={{ left: stage.left, top: stage.top, width: stage.width, height: stage.height }}
      />
      {/* Hatch art sits on the planks (under the 3D crew, who walk over it). */}
      <img
        src={CREW_HATCH_SPRITE}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute z-[3] max-w-none select-none object-fill"
        style={{
          ...onStage(stage, HATCH_BOX),
          filter: hatchOpen ? 'brightness(1.25) drop-shadow(0 0 14px rgba(255, 214, 102, 0.85))' : undefined,
          transition: 'filter 0.3s ease',
        }}
      />
      {/* Jukebox party: night falls over the painted scene (sky + deck);
          the 3D crew canvas renders above this so the dancers stay lit. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 4,
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
          style={onStage(stage, PLAQUE_BAND_BOX)}
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

      {/* Painted cannon — left rail. Tap opens Canon Golf. Taps first
          raycast for a character so a walker on the rail still opens chat. */}
      <button
        type="button"
        onClick={onCannonTap}
        disabled={chromeLocked}
        aria-label="Play Canon Golf"
        className="absolute z-20 p-0 m-0 border-0 appearance-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{ ...onStage(stage, CANNON_BOX), cursor: deckBusy ? 'default' : 'pointer' }}
      />

      {/* Cabin door at the bow — painted in the deck art. Tap opens the
          Builder Shop. A walker standing on the landing still opens chat. */}
      <button
        type="button"
        onClick={onShopDoorTap}
        disabled={chromeLocked}
        aria-label="Cabin door — open the Builder Shop"
        className="absolute z-30 m-0 p-0 border-0 bg-transparent appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
        style={{ ...onStage(stage, SHOP_DOOR_BOX), cursor: deckBusy ? 'default' : 'pointer' }}
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
          ...onStage(stage, HATCH_BOX),
          borderRadius: '12%',
          cursor: deckBusy ? 'default' : 'pointer',
          background: 'transparent',
        }}
      />

      {/* Jukebox — painted at the mast foot in the deck art. Invisible tap
          target (character raycast keeps Talk working if someone stands in
          front). Tap → 8s dance party: everyone dances, night falls, disco
          ball. */}
      {JUKEBOX_ENABLED && (
        <button
          type="button"
          onClick={onJukeboxTap}
          disabled={chromeLocked && !jukeboxTourReady}
          aria-label="Jukebox — start a dance party"
          className="absolute z-30 m-0 p-0 border-0 bg-transparent appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
          style={{
            ...onStage(stage, JUKEBOX_BOX),
            cursor: deckBusy || (chromeLocked && !jukeboxTourReady) ? 'default' : 'pointer',
          }}
        />
      )}

      {/* Adam's tour: gold ring on the feature he's describing. */}
      {tourStaging?.spot && tour?.arrived && (
        <FeatureSpotlight box={onStage(stage, tourStaging.spot)} shape={tourStaging.shape} zIndex={34} />
      )}

      {/* Wooden tab bar. Hidden until Adam's tour reaches Crew or Journey,
          then the whole board stays so his spotlight has a target. */}
      {(showJourneyBtn || showCrewBtn) && (
        <ShipDeckTabBar
          disabled={chromeLocked || sailingIsland || wheelSpinOut}
          stage={stage}
          wheelRef={wheelRef}
          rotation={wheelRotation}
          wheelTransition={wheelTransition}
          onWheelDown={onWheelDown}
          tabs={[
            {
              id: 'home',
              label: 'My Home',
              aria: 'My Home',
              onClick: goMyHome,
              icon: <MyHomeIcon />,
            },
            {
              id: 'crew',
              label: 'Crew',
              aria: 'Pick your crew',
              active: true,
              onClick: () => setPickerOpen(true),
              icon: <CrewBoatIcon />,
            },
            {
              id: 'profile',
              label: 'Profile',
              aria: 'Profiles',
              onClick: goProfile,
              icon: <CrewBoatIcon />,
            },
            {
              id: 'library',
              label: 'Library',
              aria: 'Library',
              onClick: goLibrary,
              icon: <LibraryBookIcon />,
            },
          ]}
        />
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

      {/* White fade → basement or Canon Golf */}
      <OnboardingGuideCard
        variant={discoverShip ? 'discoverShip' : 'crewShip'}
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
        /* Water drift — the blended water copy slides a few px so ripples move */
        .crew-sea-ripple {
          will-change: transform;
          animation: crew-sea-ripple 9s ease-in-out infinite alternate;
        }
        @keyframes crew-sea-ripple {
          0% { transform: translate3d(-10px, -3px, 0); }
          50% { transform: translate3d(2px, 3px, 0); }
          100% { transform: translate3d(10px, -2px, 0); }
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
        .ship-tabbar {
          position: absolute;
          z-index: 30;
          left: max(6px, env(safe-area-inset-left, 0px));
          right: max(6px, env(safe-area-inset-right, 0px));
          pointer-events: none;
        }
        .ship-tabbar-inner {
          position: relative;
          max-width: 460px;
          height: 214px;
          margin: 0 auto;
          pointer-events: none;
        }
        .ship-tabbar-gable-rim,
        .ship-tabbar-gable {
          position: absolute;
          left: 0;
          right: 0;
          clip-path: polygon(50% 0, 100% 36%, 100% 100%, 0 100%, 0 36%);
          pointer-events: none;
        }
        .ship-tabbar-gable-rim {
          top: 34px;
          bottom: -4px;
          background: #5C3310;
          filter: drop-shadow(0 8px 10px rgba(0,0,0,0.4));
        }
        .ship-tabbar-gable {
          top: 40px;
          bottom: 0;
          background-color: #C4894A;
          background-image:
            linear-gradient(180deg, rgba(255, 214, 160, 0.28), rgba(90, 42, 12, 0.18)),
            url('${SHIP_TAB_WOOD}');
          background-size: cover;
          background-position: center;
          box-shadow: inset 0 0 0 3px rgba(92, 48, 16, 0.35);
        }
        .ship-tabbar-wheel {
          position: absolute;
          left: 50%;
          top: 0;
          z-index: 2;
          width: min(26vw, 104px);
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          transform: translateX(-50%);
          filter: drop-shadow(0 8px 8px rgba(0,0,0,0.45));
          cursor: pointer;
          pointer-events: auto;
        }
        .ship-tabbar-wheel:disabled { opacity: 0.55; cursor: default; }
        .ship-tabbar-wheel img {
          display: block;
          width: 100%;
          height: auto;
          pointer-events: none;
          user-select: none;
        }
        .ship-tabbar-tiles {
          position: absolute;
          z-index: 1;
          left: 10px;
          right: 10px;
          bottom: 10px;
          height: 84px;
          display: grid;
          grid-template-columns: 1fr 1fr 22px 1fr 1fr;
          gap: 8px;
          pointer-events: auto;
        }
        .ship-tabbar-gap { display: block; }
        .ship-tabbar-tile {
          min-width: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 0;
          padding: 4px 2px 6px;
          border-radius: 14px;
          border: 3px solid #E6C98A;
          background: linear-gradient(180deg, #FFF6E4 0%, #F3D7A2 100%);
          box-shadow: 0 2px 0 rgba(92, 48, 16, 0.35), inset 0 1px 0 rgba(255,255,255,0.8);
          color: #7A4A1E;
          cursor: pointer;
        }
        .ship-tabbar-tile.is-active {
          background: linear-gradient(180deg, #FFF3C4 0%, #F6C445 100%);
          border-color: #F0B429;
          box-shadow:
            0 0 0 2px #FFE08A,
            0 2px 0 rgba(92, 48, 16, 0.35),
            inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .ship-tabbar-tile:disabled { opacity: 0.55; cursor: default; }
        .ship-tabbar-tile:not(:disabled):active { transform: translateY(1px); }
        .ship-tabbar-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 70%;
          flex: 1 1 auto;
          min-height: 0;
          pointer-events: none;
        }
        .ship-tabbar-icon img,
        .ship-tabbar-icon svg {
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
        }
        .ship-tabbar-label {
          font-family: Nunito, system-ui, sans-serif;
          font-weight: 800;
          font-size: clamp(9px, 2.5vw, 12px);
          line-height: 1.05;
          letter-spacing: -0.01em;
          color: #7A4A1E;
          white-space: nowrap;
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
