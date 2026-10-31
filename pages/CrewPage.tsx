import {useLivingFriendJourney,openLivingFirstFriendStory,bringLivingFirstFriendHome} from '../utils/livingFirstFriend';
import {getProfileScopeKey} from '../utils/profileScope';
import LivingJourneyGuide from '../components/onboarding/LivingJourneyGuide';
import { LIVING_TEST_BUILD } from '../utils/livingTestMode';
import { PREVIEW_SHIP_ART } from '../utils/previewAssets.mjs';
import { stopPreviewWarmup, warmPreviewNextScreen } from '../utils/previewWarmup';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import {
  CREW_WAVE_ANIMATION,
  getOnDeckCrew,
  ONBOARDING_ADAM_ID,
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
import { useLanguage } from '../context/LanguageContext';
import {
  clearDiscoverShipPending,
  clearSailForStoryPending,
  completeOnboardingJourney,
  isDiscoverShipPending,
  isOnboardingJourneyActive,
  isSailForStoryPending,
  resolveFirstStoryPackDestination,
} from '../utils/onboardingJourney';
import { noteBoatSession, noteJourneyStep } from '../utils/journeyStudy';
import { hasPremiumAccess } from '../utils/freeTierAccess';
import {
  CMS_ISLANDS_TIMEOUT_MS,
  fetchOceanMapIslands,
  fetchPublishedMapStories,
  getSailIslandArtSrc,
  withIslandStoryProgress,
  type OceanMapIsland,
  type OceanMapStoryRow,
} from '../utils/oceanMapIslands';
import { profileService } from '../services/profileService';
import {
  ADAM_TOUR_FALLBACK_VOICE_ID,
  buildAdamDeckTour,
  hasSeenAdamTour,
  isAdamCharacter,
  isShipTourPending,
  dismissLegacyTutorialForChallenge,
  markAdamTourSeen,
  markTourWrapDone,
  resetAdamTourWrap,
} from '../utils/adamTour';
import OnboardingGuideCard from '../components/onboarding/OnboardingGuideCard';
import IslandNotices from '../components/features/IslandNotices';

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
 * Wide sea panorama (repeat-x, mirror-tiled, painted horizon at
 * PANO_HORIZON_PCT, slid so it sits on the shore line). It pans with the wheel
 * so the islands feel like the ship is turning.
 */
const CREW_VOYAGE_SKY = PREVIEW_SHIP_ART.sky;
const CREW_VOYAGE_HULL = PREVIEW_SHIP_ART.hull;
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
/**
 * iPad landscape is wide, so 42% of the stage makes the islands huge behind
 * the deck. Shrink them there only. Phones and iPad portrait stay at 0.42.
 */
const ISLAND_LANDSCAPE_PAD_SCALE = 0.58;
/** Plain sky color for the strip above the panorama on tablets. */
const SKY_TOP_COLOR = '#91dff9';
/**
 * Shore line as a fraction of the stage (the hull art frame), so it keeps the
 * same relation to the painted ship on every screen. The cabin's arched top
 * is at 0.200 of the hull art and its side rails at 0.230. 20.2 puts the
 * water line level with the cabin's peak and a little above the side rails,
 * so the sea shows beside the cabin and each island's shore rests just
 * behind the rail: it sits on the water right behind the ship instead of
 * floating on a band of open sea above the bow (18.4) or sinking out of
 * sight behind the cabin (25.5). The sea panorama is slid so its painted
 * sky/sea line lands on this same y. The name pill stays anchored to each
 * island's painted top and clamps just under the safe area.
 */
const HORIZON_PCT = 20.2;
/**
 * Where the sea panorama's painted sky/sea line sits, as a fraction of the
 * stage. It is a little above the island shore (HORIZON_PCT), so the islands
 * rest on open water with the far horizon behind them rather than exactly
 * on the horizon line.
 */
const SEA_LINE_PCT = 16.2;
/** Where the sky/sea line is painted in crew-voyage-sea-pano.jpg (row 201 of 1229). */
const PANO_HORIZON_PCT = 16.35;
/**
 * Shore line = water line + this share of the stage height (~14px on a
 * phone), so the islands sit INTO the water instead of the cut-outs
 * hovering in front of it. The island band's bottom edge sits here.
 */
const ISLAND_SHORE_SINK_FRAC = 0.017;
/**
 * Fallback share of an island PNG's own height pushed below the shore line
 * (and masked out) until its pixels have been measured. CMS map-art icons
 * carry 0–15% transparent bottom padding plus a baked foam ring, so one
 * number can't seat them all — see `measureIslandArt`.
 */
const ISLAND_SINK_PCT = 13;
/**
 * CSS px of PAINTED island (foam ring + a sliver of beach) pushed under the
 * shore line once the art is measured, so every icon's land meets the water
 * at the same depth regardless of its transparent padding.
 */
const ISLAND_SUBMERGE_PX = 8;
/** Hides the sunk share and feathers the shore line just above it. */
const islandShoreMask = (sinkPct: number) =>
  `linear-gradient(to top, transparent ${sinkPct}%, rgba(0,0,0,0.5) ${sinkPct + 2}%, #000 ${sinkPct + 5.5}%)`;
/** The name pill overlays the island art: its top edge sits this share of
 * the island's painted height below the painted top, over the rainbow /
 * treetops rather than floating in the sky above them. */
const ISLAND_PILL_INSET_FRAC = 0.12;

/** Where an island PNG's paint actually is, as fractions of its height. */
type IslandArtFit = { paintedTop: number; paintedBottom: number; aspect: number };
/** Measure the image already displayed. Never download another copy for layout. */
const measureLoadedIslandArt = (img: HTMLImageElement): IslandArtFit | null => {
  try {
    const aspect = img.naturalHeight / img.naturalWidth;
    if (!Number.isFinite(aspect) || aspect <= 0) return null;
    const w = 192, h = Math.max(1, Math.round(w * aspect));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const alpha = ctx.getImageData(0, 0, w, h).data;
    const painted = (y: number) => {
      for (let x=0; x<w; x++) if (alpha[(y*w+x)*4+3] > 40) return true;
      return false;
    };
    let bottom=h-1, top=0;
    while (bottom>=0 && !painted(bottom)) bottom--;
    if (bottom<0) return null;
    while (top<bottom && !painted(top)) top++;
    return {paintedTop:top/h, paintedBottom:(bottom+1)/h, aspect};
  } catch { return null; } // Cross-origin art can use the existing default bounds.
};
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
const MAP_SKY_CLOUD_A = PREVIEW_SHIP_ART.cloudA;
const MAP_SKY_CLOUD_B = PREVIEW_SHIP_ART.cloudB;

/**
 * Viewport % of the horizon line — sky above, ocean below. Kept HIGH so the
 * background peeking around the hull (the side slivers beside the bow on
 * phone-width screens) reads unmistakably as water, not sky.
 */
const CREW_SEA_HORIZON_PCT = 24;

const CREW_SKY_GRADIENT =
  `linear-gradient(180deg, #6fbdf0 0%, #9fdcf8 ${CREW_SEA_HORIZON_PCT - 12}%, #c9ecfa ${CREW_SEA_HORIZON_PCT - 5}%, #eef9fd ${CREW_SEA_HORIZON_PCT}%, #2eb8e6 ${CREW_SEA_HORIZON_PCT}%, #0d9bd8 34%, #0674b6 55%, #0a568e 78%, #0d4674 100%)`;

/** Distant palm islands on the horizon — cropped from the sail-page bg art. */
const CREW_HORIZON_ISLAND_A = PREVIEW_SHIP_ART.horizonA;
const CREW_HORIZON_ISLAND_B = PREVIEW_SHIP_ART.horizonB;

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
const SAIL_STEERING_WHEEL = PREVIEW_SHIP_ART.wheel;
const CREW_TAB_BAR = PREVIEW_SHIP_ART.bow;
/**
 * Bow art (2048×1360): curved rails, lanterns, and ropes. The full-width
 * plank behind the wheel (61.3%–88.5% of the art) is transparent. Those
 * fractions still place the wheel and the four tiles.
 */
const BOW_ASPECT = 2048 / 1360;
const BOW_BOTTOM_PAD = 0.093;
const BOW_STRIP_TOP = 0.613;
const BOW_STRIP_BOTTOM = 0.885;
/** Word-free tiles; the label is live text so it can be translated. All four share one icon size. */
const CREW_TAB_ART: Record<string, string> = {
  crew: PREVIEW_SHIP_ART.crew,
  profile: PREVIEW_SHIP_ART.profile,
  home: PREVIEW_SHIP_ART.home,
  library: PREVIEW_SHIP_ART.library,
};
const SHIP_TAB_WOOD = PREVIEW_SHIP_ART.tabWood;
/** Shared wood texture — matches Sail “Travel Here” plaque. */
const WOOD_TEX = PREVIEW_SHIP_ART.wood;
/** Dark rounded plank behind the four bow buttons. Matches the headboard. */
const CREW_BUTTON_PLANK = PREVIEW_SHIP_ART.plank;

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
const CREW_HATCH_SPRITE = PREVIEW_SHIP_ART.hatch;
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
  {
    walkTo?: { x: number; y: number };
    spot?: React.CSSProperties;
    /** Spotlight a tab-bar control instead: measured from its `data-tour-id` button. */
    control?: string;
    shape?: 'circle' | 'rounded';
  }
> = {
  hello: {},
  // Standing spots keep him beside the feature (not on top of it), off the
  // open hatch (0.38–0.62 × 0.395–0.495 is a no-walk hole), and above the
  // tour card, which covers roughly the bottom 30% of the screen.
  jukebox: {
    walkTo: { x: 0.64, y: 0.56 },
    spot: JUKEBOX_BOX,
  },
  door: {
    walkTo: { x: 0.31, y: 0.47 },
    spot: SHOP_DOOR_BOX,
  },
  home: {
    walkTo: { x: 0.20, y: 0.62 },
    control: 'home',
  },
  library: {
    walkTo: { x: 0.36, y: 0.60 },
    control: 'library',
  },
  crew: {
    walkTo: { x: 0.64, y: 0.60 },
    control: 'crew',
  },
  profile: {
    walkTo: { x: 0.80, y: 0.62 },
    control: 'profile',
  },
  journey: {
    walkTo: { x: 0.50, y: 0.60 },
    control: 'wheel',
    shape: 'circle',
  },
  hatch: {
    walkTo: { x: 0.34, y: 0.52 },
    spot: HATCH_BOX,
  },
};
/** Tour beats that point at the wooden tab bar (it stays hidden until Adam reaches one). */
const TAB_BAR_TOUR_BEATS = new Set(['home', 'crew', 'profile', 'library', 'journey']);

/** Viewport box of a tab-bar control, padded a little for the gold ring. */
const useControlBox = (control: string | null | undefined, ready: boolean): React.CSSProperties | null => {
  const [box, setBox] = useState<React.CSSProperties | null>(null);
  useEffect(() => {
    if (!control || !ready) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${control}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = Math.round(Math.min(r.width, r.height) * 0.12);
      setBox({ left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    };
    measure();
    const t = window.setTimeout(measure, 350); // after the bar's pop-in settles
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [control, ready]);
  return box;
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
const ISLAND_DETENT = 50;
/** How closely the wheel follows the hand before the click (1 = exactly). */
const WHEEL_FOLLOW = 1;
/** Rubber-band follow when there is no island further in that direction. */
const WHEEL_END_FOLLOW = 0.15;
/**
 * Inside this fraction of the radius the hand is on the hub, where the
 * angle to the center is meaningless — a plain horizontal swipe turns the
 * wheel instead (kids swipe straight across it), scaled as if the finger
 * were on a rim this far out.
 */
const WHEEL_HUB_FRAC = 0.3;
/** Movement under this (deg) is finger jitter. */
const WHEEL_DEAD_DEG = 0.1;
// The hub supports a short left/right swipe; the rim turns with the hand.
// A short straight swipe can also select an island when no turn was committed.
const WHEEL_SWIPE_MIN_PX = 24;
const WHEEL_SWIPE_DEG_PER_PX = 1.5;
const WHEEL_IDLE_TRANSITION = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';

type VoyageIsland = {
  id: string;
  title: string;
  src: string;
  hasMainMap: boolean;
  storiesComplete: number;
  storiesTotal: number;
};

const toVoyageIsland = (island: OceanMapIsland): VoyageIsland | null => {
  const src = getSailIslandArtSrc(island) || (LIVING_TEST_BUILD ? PREVIEW_SHIP_ART.horizonA : undefined);
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

/**
 * Live tab label drawn over the bottom band of the tile (where the words used
 * to be painted). Runs through the app translator so it follows the family's
 * language; two-word labels wrap to two lines inside the tile.
 */
const ShipTabLabel: React.FC<{ text: string; cell: number }> = ({ text, cell }) => {
  const { currentLanguage, translateText } = useLanguage();
  const [shown, setShown] = useState(text);
  useEffect(() => {
    let live = true;
    if (currentLanguage === 'en') { setShown(text); return undefined; }
    translateText(text).then((t) => { if (live) setShown(t || text); }).catch(() => { if (live) setShown(text); });
    return () => { live = false; };
  }, [text, currentLanguage, translateText]);
  const long = shown.length > 8;
  return (
    <span
      className="absolute inset-x-[8%] flex items-center justify-center text-center font-black leading-[0.95] text-white"
      style={{
        bottom: cell * 0.085,
        height: cell * 0.26,
        fontFamily: "'Baloo 2', 'Fredoka', sans-serif",
        fontSize: Math.max(10, Math.round(cell * (long ? 0.13 : 0.165))),
        letterSpacing: '0.01em',
        textShadow: '0 1px 0 rgba(40,18,6,0.55), 0 2px 4px rgba(0,0,0,0.35)',
      }}
    >
      {shown}
    </span>
  );
};

const ShipDeckTabBar: React.FC<{
  tabs: ShipTab[];
  disabled?: boolean;
  wheelRef: React.RefObject<HTMLButtonElement | null>;
  rotation: number;
  wheelTransition?: string;
  /** Pointer down on the wheel; move/up are tracked on window with capture. */
  onWheelDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onArtReady?: () => void;
  stage: StageRect;
}> = ({ tabs, disabled, wheelRef, rotation, wheelTransition, onWheelDown, onArtReady, stage }) => {
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
  // Plank reaches the wooden ends of the headboard, not the screen edges.
  const plankW = Math.min(barW * 0.9, stage.pageW - 24);
  const plankH = cell * 1.38;
  return (
  <div
    className="pointer-events-none absolute inset-x-0 z-30"
    style={{ height: barH, bottom: `calc(var(--safe-area-bottom, 0px) - ${Math.round(barH * BOW_BOTTOM_PAD)}px)` }}
  >
    {/* Dark rounded plank behind the four buttons, only as wide as the headboard. */}
    <img
      src={CREW_BUTTON_PLANK}
      alt=""
      draggable={false}
      className="pointer-events-none absolute left-1/2 z-0 max-w-none -translate-x-1/2 select-none"
      style={{
        width: plankW,
        height: plankH,
        bottom: stripBottom - cell * 0.18,
        filter: 'drop-shadow(0 6px 8px rgba(40, 16, 4, 0.35))',
      }}
    />
    <img
      src={CREW_TAB_BAR}
      fetchPriority="high"
      onLoad={onArtReady}
      alt=""
      draggable={false}
      className="pointer-events-none absolute bottom-0 left-1/2 z-[1] max-w-none -translate-x-1/2 select-none"
      style={{ width: barW, height: barH }}
    />
    <button
      ref={wheelRef}
      type="button"
      disabled={disabled}
      aria-label="Turn the wheel to change island"
      data-tour-id="wheel"
      className="pointer-events-auto absolute left-1/2 z-[2] m-0 touch-none select-none border-0 bg-transparent p-0 disabled:opacity-60"
      style={{
        bottom: barH * (1 - BOW_STRIP_TOP) - wheelD * 0.06,
        width: wheelD,
        transform: 'translateX(-50%)',
        filter: 'drop-shadow(0 8px 10px rgba(60, 24, 8, 0.45))',
        // iOS: no save-image callout / selection loupe on a long slow turn.
        touchAction: 'none',
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
      className="pointer-events-auto absolute left-1/2 z-[3] flex -translate-x-1/2 items-end justify-between"
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
          data-tour-id={tab.id}
          className="shrink-0 border-0 bg-transparent p-0 disabled:opacity-60"
          style={{ width: cell, height: cell }}
        >
          <span className="pointer-events-none relative block h-full w-full">
            <img
              src={CREW_TAB_ART[tab.id]}
              alt=""
              draggable={false}
              className="block h-full w-full select-none object-contain object-bottom drop-shadow-[0_4px_4px_rgba(40,18,6,0.35)]"
            />
            <ShipTabLabel text={tab.label} cell={cell} />
          </span>
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
  const livingJourney=useLivingFriendJourney();
  const firstFriendVoyage=!!livingJourney&&['ship','pack','reading','reward'].includes(livingJourney.phase);
  const firstFriendHome=!!livingJourney&&['aboard','placing'].includes(livingJourney.phase);
  const livingJourneyActive=firstFriendVoyage||firstFriendHome;
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
  const sailForStory =
    Boolean((location.state as { sailForStory?: boolean } | null)?.sailForStory) ||
    isSailForStoryPending();
  const sailForStoryRef = useRef(sailForStory);
  sailForStoryRef.current = sailForStory;
  const shipTourNow = isShipTourPending() && !hasSeenAdamTour();
  const tapAdamRequested = Boolean((location.state as { tapAdam?: boolean } | null)?.tapAdam);

  useEffect(() => {
    if (arrivingOnboarding) noteJourneyStep('crew');
  }, [arrivingOnboarding]);

  useEffect(() => {
    noteBoatSession();
  }, []);

  const [crewGuide, setCrewGuide] = useState(
    () => !livingJourneyActive&&(discoverShip || sailForStory || (shipTourNow && !tapAdamRequested)),
  );
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
  const navHidden = livingJourneyActive || firstTimeLock || !!tour;
  const tabBarTourBeat = !!tourBeat && TAB_BAR_TOUR_BEATS.has(tourBeat.id);
  const showJourneyBtn = !navHidden || tabBarTourBeat;
  const showCrewBtn = showJourneyBtn;
  const tourControlBox = useControlBox(tourStaging?.control, !!tour?.arrived && !tour?.leaving);

  const finishCrewGuide = useCallback(() => {
    if (discoverShipRef.current) {
      clearDiscoverShipPending();
      setCrewGuide(false);
      navigate('/my-home', { replace: true, state: { onboardingJourney: true } });
      return;
    }
    if (sailForStoryRef.current) {
      if (enteringRef.current) return;
      enteringRef.current = true;
      clearSailForStoryPending();
      setCrewGuide(false);
      void resolveFirstStoryPackDestination()
        .then((dest) => {
          navigate(dest.path, { replace: true, state: dest.state });
        })
        .catch(() => {
          enteringRef.current = false;
          if (LIVING_TEST_BUILD) setStoryError('Stories are taking a moment. Please try again.');
          else navigate('/map', { replace: true, state: { onboardingJourney: true } });
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
    const atHome=LIVING_TEST_BUILD&&['placed','unlocked'].includes(livingJourney?.phase);
    setCrew(getOnDeckCrew().filter(c=>!atHome||(c.id!==ONBOARDING_ADAM_ID&&!/^adam$/i.test(c.name.trim()))));
  }, [livingJourney?.phase]);

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
    swipe: false,
    shifted: false,
    startX: 0,
    startY: 0,
    pickupOffset: 0,
    cx: 0,
    cy: 0,
    radius: 1,
    /** Last hand angle about the center (deg). */
    angle: 0,
    lastX: 0,
    lastY: 0,
    /** Hand travel since the last click (deg, carried over past clicks). */
    accum: 0,
    /** Creep (deg) the wheel should draw on top of the notch. */
    creep: 0,
    /** Rotation currently drawn. */
    shown: 0,
    frame: 0,
  });
  const sailingRef = useRef(false);
  voyageRef.current = voyageIslands;
  lookRef.current = lookIndex;

  // CMS islands arrive with `storiesComplete: 0`; the published story list
  // plus islandStoryProgressService (what the reader / quiz pages write)
  // give the real "N/M stories complete" count on the horizon pill.
  const [oceanIslands, setOceanIslands] = useState<OceanMapIsland[]>([]);
  const [storyError, setStoryError] = useState('');
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyRetry, setStoryRetry] = useState(0);
  useEffect(() => { if (LIVING_TEST_BUILD) stopPreviewWarmup(); }, []);

  const [mapStories, setMapStories] = useState<OceanMapStoryRow[] | null>(null);
  const [progressTick, setProgressTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(() => controller.abort(), CMS_ISLANDS_TIMEOUT_MS);
    setStoryLoading(true);setStoryError('');
    void fetchOceanMapIslands(controller.signal)
      .then((mapped) => {
        if (cancelled) return;
        if (!mapped?.length) throw new Error('No story islands available');
        if (mapped.length) setOceanIslands(mapped);
      })
      .catch(() => {
        if (!cancelled) setStoryError('Stories are taking a moment. Please try again.');
      })
      .finally(() => { window.clearTimeout(failSafe); if (!cancelled) setStoryLoading(false); });
    void fetchPublishedMapStories(controller.signal)
      .then((stories) => {
        if (!cancelled && stories) setMapStories(stories);
      })
      .catch(() => {
        /* pill falls back to local read counts */
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, [storyRetry]);

  // Re-count after a story completes in another tab / cloud hydrate / profile switch.
  useEffect(() => {
    const onProgress = () => setProgressTick((t) => t + 1);
    window.addEventListener('islandStoryProgressUpdated', onProgress);
    const unsub = profileService.onProfileChange(onProgress);
    return () => {
      window.removeEventListener('islandStoryProgressUpdated', onProgress);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!oceanIslands.length) return;
    const next = withIslandStoryProgress(oceanIslands, mapStories)
      .map(toVoyageIsland)
      .filter((row): row is VoyageIsland => row != null);
    if (next.length) setVoyageIslands(next);
    // progressTick re-reads islandStoryProgressService.
  }, [oceanIslands, mapStories, progressTick]);

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

  const drawVoyage = (position: number, dragging: boolean) => {
    pageRef.current?.querySelectorAll<HTMLElement>('[data-voyage-index]').forEach((el) => {
      const offset = Number(el.dataset.voyageIndex) - position;
      const distance = Math.abs(offset);
      const scale = Math.max(0.46, 1 - distance * 0.3);
      const shadow = el.dataset.voyageSink === undefined;
      el.style.transition = dragging ? 'none' : 'left 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease';
      el.style.left = `${50 - offset * 50}%`;
      el.style.transform = shadow ? `translateX(-50%) translateY(58%) scale(${scale})` : `translateX(-50%) scale(${scale}) translateY(${el.dataset.voyageSink}%)`;
      el.style.opacity = String(distance > 2.4 ? 0 : Math.max(0.4, 1 - distance * 0.28) * (shadow ? 0.9 : 1));
    });
  };

  const wheelImg = () => wheelRef.current?.querySelector('img') ?? null;

  /** Draw once per frame, directly following the hand without a second easing lag. */
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
      drawVoyage(target / ISLAND_STEP_DEG, true);
      // Later islands sit to the left: positive progress turns the wheel left.
      g.shown = g.pickupOffset - g.creep;
      img.style.transform = `rotate(${g.shown}deg)`;
      g.frame = requestAnimationFrame(tick);
    };
    g.frame = requestAnimationFrame(tick);
  }, []);

  const onWheelPointerMove = useCallback(
    (e: PointerEvent) => {
      const g = wheelGestureRef.current;
      if (!g.active || e.pointerId !== g.pointerId || sailingRef.current) return;
      if (g.swipe) {
        // A left swipe always means next island, wherever the thumb starts.
        // The islands follow continuously and settle on release.
        const travel = -(e.clientX - g.startX) * WHEEL_SWIPE_DEG_PER_PX;
        const base = lookRef.current * ISLAND_STEP_DEG;
        const position = Math.max(0, Math.min(Math.max(0, voyageRef.current.length - 1) * ISLAND_STEP_DEG,
          base + travel));
        g.creep = position - base;
        return;
      }
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Ignore a chord through the hub: its polar angle jumps by 180 degrees.
      // Keep the rim gesture locked instead of changing formulas mid-turn.
      const prevX = g.lastX - g.cx;
      const prevY = g.lastY - g.cy;
      const stepX = dx - prevX;
      const stepY = dy - prevY;
      const lengthSq = stepX * stepX + stepY * stepY;
      const t = lengthSq ? Math.max(0, Math.min(1, -(prevX * stepX + prevY * stepY) / lengthSq)) : 0;
      const crossesHub = Math.hypot(prevX + t * stepX, prevY + t * stepY) < g.radius * WHEEL_HUB_FRAC;
      let delta = angle - g.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      g.angle = angle;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      if (crossesHub || Math.abs(delta) < WHEEL_DEAD_DEG) return;
      const base = lookRef.current * ISLAND_STEP_DEG;
      const position = Math.max(0, Math.min(Math.max(0, voyageRef.current.length - 1) * ISLAND_STEP_DEG,
        base + g.creep - delta));
      g.creep = position - base;
      g.accum = g.creep;

    },
    [shiftIsland],
  );

  const onWheelPointerUp = useCallback((e: PointerEvent) => {
    const g = wheelGestureRef.current;
    if (!g.active || e.pointerId !== g.pointerId) return;
    if (e.type === 'pointerup' && !sailingRef.current) {
      onWheelPointerMove(e);
      const next = Math.max(0, Math.min(voyageRef.current.length - 1,
        Math.round(lookRef.current + g.creep / ISLAND_STEP_DEG)));
      lookRef.current = next;
      setLookIndex(next);
    }
    drawVoyage(lookRef.current, false);
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
    // Center the wheel independently of the selected island. Explicitly write
    // the transform because React's resting value may already be zero.
    const img = wheelImg();
    if (img) {
      img.style.transition = WHEEL_IDLE_TRANSITION;
      img.style.transform = 'rotate(0deg)';
    }
    setWheelDrag(false);
  }, [onWheelPointerMove, shiftIsland]);

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
      g.startX = e.clientX;
      g.startY = e.clientY;
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      // Touch, pen and mouse all retain real circular turning on the rim.
      // Only a gesture starting inside the hub is treated as a straight swipe.
      g.swipe = Math.hypot(dx, dy) < g.radius * WHEEL_HUB_FRAC;
      g.shifted = false;
      g.angle = Math.atan2(dy, dx) * (180 / Math.PI);
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      g.accum = 0;
      g.creep = 0;
      g.pointerId = e.pointerId;
      g.active = true;
      // Keep visual pickup independent of island selection during a return to center.
      const base = 0;
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
      // Re-grabbing during the snap animation starts at the visible angle.
      g.pickupOffset = g.shown - base;
      g.creep = 0;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic / already captured — window listeners still track it */
      }
      window.addEventListener('pointermove', onWheelPointerMove);
      window.addEventListener('pointerup', onWheelPointerUp);
      window.addEventListener('pointercancel', onWheelPointerUp);
      setWheelHold(g.shown);
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

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const keepWheelTouch = (event: TouchEvent) => {
      if (wheelGestureRef.current.active && event.cancelable) event.preventDefault();
    };
    wheel.addEventListener('touchmove', keepWheelTouch, { passive: false });
    // A WebView may lose capture without delivering pointerup. Release the
    // gesture so the next touch can start, without treating it as a swipe.
    wheel.addEventListener('lostpointercapture', onWheelPointerUp);
    return () => {
      wheel.removeEventListener('touchmove', keepWheelTouch);
      wheel.removeEventListener('lostpointercapture', onWheelPointerUp);
    };
  }, [showJourneyBtn, showCrewBtn, onWheelPointerUp]);

  const openVoyageIsland = useCallback((island: VoyageIsland) => {
    if (sailingRef.current) return;
    if(firstFriendVoyage){
      if(voyageRef.current[0]?.id!==island.id)return;
      sailingRef.current=true;setSailingIsland(true);setStoryError('');
      const voyageScope=getProfileScopeKey();
      void openLivingFirstFriendStory(voyageScope).then(dest=>{
        const go=()=>{if(getProfileScopeKey()===voyageScope)navigate(dest.path,{state:dest.state});};
        if(reduceMotion){go();return;}
        timersRef.current.push(window.setTimeout(go,SAIL_IN_MS));
      }).catch(()=>{sailingRef.current=false;setSailingIsland(false);setStoryError('Try the island again.');});
      return;
    }
    if (LIVING_TEST_BUILD && voyageRef.current[0]?.id === island.id) {
      sailingRef.current = true; setSailingIsland(true); setStoryError('');
      void resolveFirstStoryPackDestination().then(dest => {
        const state: Record<string, unknown> = {...dest.state, fromSail: true};
        delete state.onboardingJourney;
        navigate(dest.path, {state});
      }).catch(() => {
        sailingRef.current = false; setSailingIsland(false);
        setStoryError('Stories are taking a moment. Please try again.');
      });
      return;
    }
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
  }, [navigate,firstFriendVoyage,reduceMotion]);

  const activeVoyage = voyageIslands[lookIndex] ?? voyageIslands[0];
  const voyageUnlocked = !!activeVoyage && (voyageIslands[0]?.id === activeVoyage.id || firstIslandDone(voyageIslands));
  /** Sky/sea line of the panorama, and the y where island shores rest. */
  const islandWidthFrac =
    stage.pageW > stage.pageH && Math.min(stage.pageW, stage.pageH) >= 700
      ? ISLAND_WIDTH_FRAC * ISLAND_LANDSCAPE_PAD_SCALE
      : ISLAND_WIDTH_FRAC;
  const waterlineY = stage.top + (stage.height * HORIZON_PCT) / 100;
  const islandBaseY = waterlineY + stage.height * ISLAND_SHORE_SINK_FRAC;
  /** Page y of the panorama's painted sky/sea line (above the island shore). */
  const seaLineY = stage.top + (stage.height * SEA_LINE_PCT) / 100;
  /** Painted sky band of the panorama tile, in px at this stage height. */
  const panoSkyPx = (stage.height * PANO_HORIZON_PCT) / 100;
  /** Top edge of the sea panorama tile: its painted horizon meets seaLineY. */
  const panoTop = seaLineY - panoSkyPx;
  /**
   * The strip above the tile mirrors the tile's top sky. It can only mirror
   * as much as the sky band is tall; past that it would flip water up into
   * the sky, so cap it and let the flat sky color fill the rest.
   */
  const skyMirrorH = Math.min(Math.ceil(panoTop) + 1, Math.floor(panoSkyPx) - 1);
  /** Paint bounds measured from each displayed island, without extra requests. */
  const [islandFits, setIslandFits] = useState<Record<string, IslandArtFit>>({});
  const [loadedIslandArt, setLoadedIslandArt] = useState<Set<string>>(() => new Set());
  const [deckArtReady, setDeckArtReady] = useState({hull:false, bow:false});
  useEffect(() => {
    if (LIVING_TEST_BUILD && deckArtReady.hull && deckArtReady.bow && loadedIslandArt.has(voyageIslands[lookIndex]?.src)) {
      warmPreviewNextScreen('island');
    }
  }, [deckArtReady, loadedIslandArt, voyageIslands, lookIndex]);
  /**
   * How an island seats on the shore line: the share of its own height sunk
   * below it (so ISLAND_SUBMERGE_PX of paint go under, whatever the PNG's
   * padding) and how far its painted top rises above the shore at scale 1.
   */
  const islandSeat = (island: VoyageIsland) => {
    const fit = islandFits[island.src];
    const renderedH = stage.width * islandWidthFrac * (fit?.aspect ?? 1);
    const sinkPct = fit
      ? Math.min(60, (1 - fit.paintedBottom) * 100 + (ISLAND_SUBMERGE_PX / Math.max(1, renderedH)) * 100)
      : ISLAND_SINK_PCT;
    const topAboveShore = (1 - sinkPct / 100 - (fit?.paintedTop ?? 0)) * renderedH;
    return { sinkPct, topAboveShore };
  };
  // While a drag owns the wheel the prop stays frozen at its start value so
  // React never overwrites the per-frame transform; on release it eases to
  // upright position (see onWheelPointerUp).
  const wheelRotation =
    (wheelDrag ? wheelHold : 0) + (wheelSpinOut ? WHEEL_SPIN_OUT_DEG : 0);
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
    if(firstFriendHome&&!bringLivingFirstFriendHome()){setStoryError('Try again.');return;}
    const go = () => navigate('/my-home', { state: { from: '/crew',livingFirstFriend:firstFriendHome } });
    if (reduceMotion || LIVING_TEST_BUILD) {
      go();
      return;
    }
    enteringRef.current = true;
    clearTimers();
    setWheelSpinOut(true);
    const fadeId = window.setTimeout(() => setWhiteFade(true), WHEEL_SPIN_FADE_DELAY_MS);
    const navId = window.setTimeout(go, WHEEL_SPIN_FADE_DELAY_MS + WHITE_FADE_MS);
    timersRef.current = [fadeId, navId];
  }, [clearTimers, enteringGame, navigate, reduceMotion,firstFriendHome]);

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

      {/* Everything beyond the rail — sky, sea, and the islands on it —
          rolls and heaves a touch while the ship (and the camera on it)
          stays put: that is what a gentle rock looks like from the deck. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[2]${reduceMotion ? '' : ' crew-horizon-rock'}${pageHidden ? ' crew-sea-paused' : ''}`}
        style={{ transformOrigin: `50% ${Math.round(seaLineY)}px` }}
      >
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
          backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) ${Math.round(panoTop)}px`,
          transform: sailingIsland && !reduceMotion ? `scale(${SAIL_IN_SEA_SCALE})` : 'none',
          transformOrigin: `50% ${Math.round(seaLineY)}px`,
          transition: reduceMotion
            ? 'none'
            : sailingIsland
              ? `background-position 0.32s cubic-bezier(0.22, 1, 0.36, 1), ${SAIL_IN_EASE}`
              : 'background-position 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
      {/* Tablets: the ship sits lower, so mirror the panorama's top sky into
          the strip above it instead of showing a flat color seam. */}
      {panoTop > 0 && skyMirrorH > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-0"
          style={{
            top: Math.ceil(panoTop) + 1 - skyMirrorH,
            height: skyMirrorH,
            transform: 'scaleY(-1)',
            backgroundImage: `url(${CREW_VOYAGE_SKY})`,
            backgroundRepeat: 'repeat-x',
            backgroundSize: `${Math.round(stage.height * SEA_PANO_ASPECT)}px ${Math.round(stage.height)}px`,
            backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) 0`,
            transition: reduceMotion ? 'none' : 'background-position 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
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
            top: seaLineY,
            height: stage.height * (1 - PANO_HORIZON_PCT / 100),
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
              backgroundPosition: `calc(50% - ${Math.round(lookIndex * stage.width * SEA_PAN_PER_NOTCH)}px) ${-Math.round((stage.height * PANO_HORIZON_PCT) / 100) - 6}px`,
              transition: 'background-position 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
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
          wheel carousel does. The band's bottom edge IS the shore line
          (water line + ISLAND_SHORE_SINK_FRAC), so it tracks the panorama's
          horizon on every aspect ratio; each PNG is sunk ISLAND_SINK_PCT of
          its own height below that edge and masked there, so transparent
          padding and baked foam go under the water and the land meets it. */}
      <div
        className="pointer-events-none absolute z-[2]"
        style={{
          left: stage.left,
          width: stage.width,
          top: stage.top,
          height: islandBaseY - stage.top,
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

          // Paint the active island before requesting its neighbors. Distant
          // destinations must not compete for a child's mobile connection.
          if (distance > 1.1 || (distance > 0 && !loadedIslandArt.has(voyageIslands[lookIndex]?.src))) return null;

          const scale = Math.max(0.46, 1 - distance * 0.3);
          const slide = 'left 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.42s ease';
          const fade = Math.max(0.4, 1 - distance * 0.28);
          const { sinkPct } = islandSeat(island);
          const shoreMask = islandShoreMask(sinkPct);
          return (
            <React.Fragment key={island.id}>
              {/* Soft contact shadow / reflection on the water under the shore */}
              <div
                data-voyage-index={i}
                className="absolute bottom-0"
                style={{
                  left: `${50 - offset * 50}%`,
                  width: `${islandWidthFrac * 92}%`,
                  height: Math.max(10, Math.round(stage.height * 0.024)),
                  transform: `translateX(-50%) translateY(58%) scale(${scale})`,
                  transformOrigin: '50% 50%',
                  background:
                    'radial-gradient(ellipse at 50% 50%, rgba(6,52,98,0.34) 0%, rgba(6,52,98,0.18) 42%, rgba(6,52,98,0) 70%)',
                  opacity: distance > 2.4 ? 0 : fade * 0.9,
                  transition: slide,
                  zIndex: 0,
                }}
              />
              <img
                data-voyage-index={i}
                data-voyage-sink={sinkPct}
                src={island.src}
                fetchPriority={i === lookIndex ? 'high' : 'low'}
                decoding="async"
                onLoad={event => {
                  const fit = measureLoadedIslandArt(event.currentTarget);
                  if (fit) setIslandFits(previous => ({...previous, [island.src]:fit}));
                  setLoadedIslandArt(previous => new Set(previous).add(island.src));
                }}
                onError={event => { const img = event.currentTarget; if (LIVING_TEST_BUILD && !img.dataset.fallback) { img.dataset.fallback = "1"; img.src = PREVIEW_SHIP_ART.horizonA; } }}
                alt=""
                draggable={false}
                className="absolute bottom-0 h-auto max-w-none select-none"
                style={{
                  left: `${50 - offset * 50}%`,
                  width: `${islandWidthFrac * 100}%`,
                  // translateY runs inside scale() so the sink is a share of
                  // the island's rendered height (per island, from its
                  // measured paint bounds); the mask hides that share and
                  // feathers the next few % so the shore melts into the
                  // water instead of ending on a hard cut-out edge.
                  transform: `translateX(-50%) scale(${scale}) translateY(${sinkPct}%)`,
                  transformOrigin: '50% 100%',
                  WebkitMaskImage: shoreMask,
                  maskImage: shoreMask,
                  opacity: distance > 2.4 ? 0 : fade,
                  filter: voyageIslands[0]?.id === island.id || firstIslandDone(voyageIslands) ? undefined : 'grayscale(1) brightness(0.9)',
                  transition: slide,
                  zIndex: 4 - Math.round(distance),
                }}
              />
            </React.Fragment>
          );
        })}
        </div>
      </div>
      </div>
      {LIVING_TEST_BUILD && !crewGuide && !tour && (storyError || !voyageIslands.length) && <section
        role="status" className="absolute z-[7] left-1/2 -translate-x-1/2 rounded-2xl bg-[#fff8e8] px-5 py-3 text-center text-[#3e2414] shadow-lg"
        style={{top: 'max(80px, calc(var(--safe-area-top, 0px) + 60px))', width: 'min(85vw, 340px)'}}>
        <p className="font-bold">{storyError || (storyLoading ? 'Finding your story islands…' : 'Your stories are ready to explore.')}</p>
        {storyError && <button className="mt-2 rounded-full bg-[#ffc43d] px-5 py-2 font-bold" onClick={() => setStoryRetry(n => n + 1)}>Try stories again</button>}
      </section>}
      {/* Tap layer over the islands (above the 3D canvas): the whole island
          is the target, its name floats centered above it. Tapping the
          island you are looking at sails there; a neighbor turns to it. */}
      {voyageIslands.map((island, i) => {
        const offset = i - lookIndex;
        const distance = Math.abs(offset);
        if (distance > 1.6) return null;
        const scale = Math.max(0.46, 1 - distance * 0.3);
        const size = stage.width * islandWidthFrac * scale;
        const cx = stage.left + stage.width * (0.5 - offset * 0.5);
        const bottom = islandBaseY;
        const isActive = offset === 0;
        const unlocked = voyageIslands[0]?.id === island.id || firstIslandDone(voyageIslands);
        const label = isActive && sailingIsland ? 'Sailing…' : unlocked ? island.title : `Complete ${voyageIslands[0]?.title || 'Beginnings'}`;
        const progress = unlocked && !(isActive && sailingIsland)
          ? `${Math.min(island.storiesComplete, island.storiesTotal)}/${island.storiesTotal} stories complete`
          : null;
        // Neighbors whose center is off the phone screen keep the tap target
        // (a sliver of island peeks in) but not a half-visible label.
        const showLabel = cx > 24 && cx < stage.pageW - 24;
        // Page y of the island's painted top (its box top is often padding),
        // so the label hugs the art instead of a fixed offset above the square.
        const seat = islandSeat(island);
        const islandTopY = bottom - scale * seat.topAboveShore;
        // Pill top rides inside the art, but never under the safe area.
        const pillTopY = Math.max(
          islandTopY + scale * seat.topAboveShore * ISLAND_PILL_INSET_FRAC,
          0,
        );
        return (
          <button
            key={`tap-${island.id}`}
            type="button"
            aria-label={isActive ? `Sail to ${island.title}` : `Look at ${island.title}`}
            onClick={() => (isActive ? openVoyageIsland(island) : lookAtIsland(i))}
            disabled={sailingIsland || wheelDrag}
            className="absolute z-[6] m-0 border-0 bg-transparent p-0"
            style={{
              left: cx - size / 2,
              top: bottom - size,
              width: size,
              height: size,
              opacity: wheelDrag || (sailingIsland && !isActive) ? 0 : 1,
              transition: 'left 0.32s cubic-bezier(0.22, 1, 0.36, 1), top 0.32s cubic-bezier(0.22, 1, 0.36, 1), width 0.32s cubic-bezier(0.22, 1, 0.36, 1), height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
            }}
          >
            {firstFriendVoyage&&isActive&&i===0&&<span className="living-island-point" aria-hidden="true">👇</span>}
            <span
              className="pointer-events-none absolute left-1/2 flex flex-col items-center gap-1"
              style={{
                // Top edge a little way into the painted island, so the pill
                // overlays the art; clamped at least 4px under the safe area.
                top: Math.round(pillTopY - (bottom - size)),
                transform: `translate(-50%, max(0px, calc(var(--safe-area-top, 0px) + 4px - ${Math.round(pillTopY)}px)))`,
                opacity: !showLabel ? 0 : isActive ? 1 : 0.8,
                transition: 'opacity 0.3s ease, top 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
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
        fetchPriority="high"
        onLoad={() => setDeckArtReady(previous => ({...previous, hull:true}))}
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
            onCharacterTap={(character) => firstFriendHome?goMyHome():openChat(character)}
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
      {tourControlBox && tour?.arrived && (
        <FeatureSpotlight box={tourControlBox} shape={tourStaging?.shape} zIndex={34} />
      )}

      {/* Wooden tab bar. Hidden until Adam's tour reaches Crew or Journey,
          then the whole board stays so his spotlight has a target. */}
      {(showJourneyBtn || showCrewBtn) && (
        <ShipDeckTabBar
          onArtReady={() => setDeckArtReady(previous => ({...previous, bow:true}))}
          disabled={chromeLocked || sailingIsland || wheelSpinOut}
          stage={stage}
          wheelRef={wheelRef}
          rotation={wheelRotation}
          wheelTransition={wheelTransition}
          onWheelDown={onWheelDown}
          tabs={[
            {
              id: 'home',
              label: 'My Friends',
              aria: 'My Friends island',
              onClick: goMyHome,
              icon: <MyHomeIcon />,
            },
            {
              id: 'library',
              label: 'Library',
              aria: 'Library',
              onClick: goLibrary,
              icon: <LibraryBookIcon />,
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

      {/* Top-left island news: what the friends did on the island map since
          the last visit (fed by homeworld/src/island-feed.mjs). */}
      <IslandNotices />

      {livingJourneyActive&&!sailingIsland&&<LivingJourneyGuide line={firstFriendHome?'Bring Adam home!':'Tap the first island.'} spoken={firstFriendHome?'You found Adam! Let’s bring him to your community.':'Tap the first island. Let’s find a story friend!'} onAction={firstFriendHome?goMyHome:undefined} label="My community"/>}
      {/* White fade → basement or Canon Golf */}
      <OnboardingGuideCard
        variant={discoverShip ? 'discoverShip' : sailForStory ? 'sailForStory' : 'crewShip'}
        active={crewGuide && !chatCharacter && !livingJourneyActive}
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
        /* The world outside the ship rolls ±0.6° and heaves a few px on a
           slow swell; scaled a hair so the tilt never shows a corner gap. */
        .crew-horizon-rock {
          will-change: transform;
          animation: crew-horizon-rock 7.5s ease-in-out infinite;
        }
        @keyframes crew-horizon-rock {
          0%   { transform: rotate(-0.6deg) translate3d(0, 0px, 0) scale(1.03); }
          28%  { transform: rotate(0.15deg) translate3d(0, 3px, 0) scale(1.03); }
          52%  { transform: rotate(0.6deg) translate3d(0, 1px, 0) scale(1.03); }
          78%  { transform: rotate(-0.1deg) translate3d(0, -2px, 0) scale(1.03); }
          100% { transform: rotate(-0.6deg) translate3d(0, 0px, 0) scale(1.03); }
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
        .crew-sea-paused, .crew-sea-paused * {
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
