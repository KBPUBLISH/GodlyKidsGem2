import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { UnlockedCharacter } from '../../services/rewardsService';
import { danceMusic } from '../../services/danceMusicService';
import { getCrewLocation, setCrewLocation } from './basementCharacter';

/**
 * Fullscreen transparent WebGL overlay for 3D crew characters over painted
 * scene art (ship deck or basement, selected via the `zone` prop).
 *
 * Characters with a GLB modelUrl (or a still imageUrl) alternate naturally
 * between standing idle (~4–10s, occasionally playing a one-shot variation
 * clip) and strolling 1–3 destinations. Built-in GLBs play their authored
 * walk/idle clips. Uploaded stills (PNG or a static mesh with no walk clip)
 * use a procedural translate + bob/lean so they still look like they walk.
 * Destinations are sampled inside a walkable polygon traced
 * over the scene painting, minus obstacle cut-outs; every 2nd stroll is a
 * "tour" biased toward a deck region he hasn't visited recently, so over a
 * few minutes he covers the whole ship — including climbing the quarterdeck
 * stairs. Raised platforms are reachable ONLY via their traced stair paths
 * (never straight through the railing); routes are built as leg queues:
 * walk → climb → walk. Movement pauses while the action menu / chat is open
 * (`paused`) and during dances.
 *
 * Autonomous basement trips: every few minutes a deck character decides on
 * his own to walk to the hatch and sink below (no navigation — the page
 * stays put). His location persists per character in sessionStorage; the
 * basement page shows characters located below, and after a stay he either
 * departs the basement scene (fade at the stairs) or, if the deck page is
 * mounted when his return is due, rises back out of the hatch and resumes
 * wandering.
 *
 * Grounding: each character has a soft warm-tinted blob shadow under their
 * feet that follows position and scales with the perspective depth factor.
 * The walk clip's playback rate is tied to actual ground speed (with a
 * cartoon cadence boost) so feet don't skate. Occluder strips (railings
 * redrawn from the art as DOM overlays above the canvas) hide him correctly
 * when he stands behind them.
 *
 * Tapping a character (raycast) reports its on-screen anchor via
 * onCharacterTap; tapping empty art fires onDeckTap. The parent can trigger:
 * - deckRef.current.danceAll(ms) — jukebox party: everyone dances (looping).
 * - deckRef.current.descendIntoHatch(id, onDone) — scripted walk to the deck
 *   hatch (down the stairs first if he's on the quarterdeck), then sink +
 *   fade below the deck line, then onDone (deck zone only).
 *
 * Coordinates: an orthographic camera maps world units 1:1 to CSS pixels
 * (origin center-screen). Zone polygons are authored in normalized IMAGE
 * coordinates over the background painting and mapped to screen space through
 * the same `object-cover` transform the background <img> uses, so they stay
 * aligned with the art at any viewport aspect.
 */

export type CrewDeckHandle = {
  /**
   * Scripted hatch descent (deck zone): walk fast to the hatch, sink + fade,
   * then call onDone. Returns false if unavailable (character not loaded /
   * zone has no hatch) so the caller can fall back to an instant transition.
   */
  descendIntoHatch: (characterId: string, onDone: () => void) => boolean;
  /**
   * Raycast for a tappable character under a viewport point (CSS px).
   * Lets HTML overlays that sit above the canvas (e.g. the hatch tap target)
   * yield to the character when he's standing inside their hit rect.
   */
  characterAt: (
    clientX: number,
    clientY: number,
  ) => { character: UnlockedCharacter; anchor: { x: number; y: number } } | null;
  /**
   * Jukebox party: EVERY available character stops and dances (looping) for
   * durationMs, with the dance tune playing; they return to idle when it ends.
   * Returns false if no character could join (none loaded yet) so the caller
   * can still run music/lights on its own.
   */
  danceAll: (durationMs: number) => boolean;
  /**
   * Arrival greeting: every loaded character plays a wave/hello clip once
   * (falls back to a variation clip). Returns false if nobody is ready yet.
   */
  waveAll: () => boolean;
  /**
   * Tap-to-talk: this character faces the camera and loops a talking clip
   * until stopTalk(). Returns false if they aren't loaded yet.
   */
  talk: (characterId: string) => boolean;
  /** End talking (chat closed) and return to idle. Omit id to stop everyone. */
  stopTalk: (characterId?: string) => void;
  /** Cancel a running party early (chat opened / hatch descent / cleanup). */
  stopParty: () => void;
  /**
   * Guided tour: walk this character to a spot (zone image coords, 0–1),
   * then turn to the camera and hold in the talking pose until stopTalk().
   * onArrive fires once he's there. Returns false if he can't be steered
   * right now (not loaded / mid-exit / flyer).
   */
  walkTo: (
    characterId: string,
    spot: { x: number; y: number },
    onArrive: () => void,
  ) => boolean;
  /**
   * Screen-space foot positions (CSS px) of every visible character — lets
   * DOM props on the page (e.g. the jukebox) re-layer themselves so a
   * character standing in front of them draws on top.
   */
  feetPositions: () => { x: number; y: number }[];
  /** Top-of-head screen position (CSS px in the deck container). */
  characterAnchor: (characterId?: string) => { x: number; y: number } | null;
};

type Props = {
  /** Characters with a modelUrl and/or a still imageUrl. */
  characters: UnlockedCharacter[];
  /** Which painted scene this overlay sits on. Default 'deck'. */
  zone?: 'deck' | 'basement';
  /** True while the action menu or chat popup is open — stops strolling. */
  paused?: boolean;
  /** Tap on a character — anchor is the top-of-head position in CSS px. */
  onCharacterTap?: (
    character: UnlockedCharacter,
    anchor: { x: number; y: number },
  ) => void;
  /** Tap on empty scene (no character hit) — dismiss any open menu. */
  onDeckTap?: () => void;
};

type Pt = { x: number; y: number };
const P = (x: number, y: number): Pt => ({ x, y });

/** Raised area reachable only via its stair (image coords). */
type PlatformConfig = {
  id: string;
  poly: Pt[];
  /**
   * Stair ramp polyline ordered deck → platform, traced along the painted
   * tread centers (first point on the main deck, last on the platform).
   * Multiple anchors let the path follow a staircase that isn't a straight
   * line in screen space, keeping feet on the step surfaces.
   */
  stair: Pt[];
};

/** Region used to bias wandering toward unvisited parts of the scene. */
type RegionConfig =
  | { name: string; platform: string }
  | { name: string; bbox: [minX: number, minY: number, maxX: number, maxY: number] };

type ZoneConfig = {
  img: { width: number; height: number };
  /**
   * Wide screens (art taller than the viewport after object-cover): push the
   * art's top down by this share of the viewport height instead of centering
   * the overflow. The deck page positions its hull art the same way
   * (STAGE_WIDE_TOP_PCT).
   */
  wideTopPct?: number;
  /** Same, for layouts where the art is height-fit (phones): push its top down. */
  topPct?: number;
  /** Background art path — needed to redraw occluder strips. */
  bg: string;
  /** Extra character size multiplier for this scene (basement runs larger). */
  characterScale?: number;
  walkable: Pt[];
  obstacles: { name: string; poly: Pt[] }[];
  platforms?: PlatformConfig[];
  /**
   * Art strips redrawn ABOVE the canvas (image-coord rects) so characters
   * standing behind them (e.g. the quarterdeck railing) are hidden correctly.
   */
  occluders?: { x: number; y: number; w: number; h: number }[];
  regions?: RegionConfig[];
  /** Preferred spawn for the first character (image coords). */
  spawn?: Pt;
  /** Hatch descent points (image coords) — deck only. */
  hatch?: { approach: Pt; center: Pt };
};

/* ------------------------------------------------------------------------ *
 * Ship deck — traced over public/assets/images/crew-ship-deck-v2.jpg
 * (1008×1344, opaque sky). Raised quarterdeck at the TOP with a cabin door
 * behind the mast and two staircases flanking it, painted jukebox at the
 * mast foot, cannon on the left rail, glowing open hatch right-mid, chest +
 * rope coils down the right rail, stern beam + rail across the bottom.
 * ------------------------------------------------------------------------ */
const DECK_ZONE: ZoneConfig = {
  // sail-voyage-hull.png — perspective deck: cabin + stairs at the top,
  // barrels left, crates right, open deck below. The hatch is a sprite the
  // page draws mid-center just under the stairs (HATCH_BOX in CrewPage).
  img: { width: 1520, height: 2688 },
  wideTopPct: 0.07,
  topPct: 0.11,
  bg: '/assets/images/sail-voyage-hull.png?v=7',
  // Open planks from the stair landings down to the top of the wheel/bow.
  walkable: [
    P(0.10, 0.395),
    P(0.90, 0.395),
    P(0.99, 0.50),
    P(0.99, 0.665),
    P(0.01, 0.665),
    P(0.01, 0.50),
  ],
  obstacles: [
    {
      name: 'hatch',
      poly: [P(0.38, 0.395), P(0.62, 0.395), P(0.62, 0.495), P(0.38, 0.495)],
    },
    {
      name: 'left-barrels',
      poly: [P(0.00, 0.37), P(0.26, 0.37), P(0.26, 0.52), P(0.00, 0.52)],
    },
    {
      name: 'right-crates',
      poly: [P(0.70, 0.37), P(1.00, 0.37), P(1.00, 0.545), P(0.70, 0.545)],
    },
    {
      name: 'wheel',
      poly: [P(0.27, 0.635), P(0.73, 0.635), P(0.73, 0.90), P(0.27, 0.90)],
    },
  ],
  regions: [
    { name: 'fore', bbox: [0.10, 0.395, 0.90, 0.47] },
    { name: 'mid', bbox: [0.02, 0.47, 0.98, 0.58] },
    { name: 'stern', bbox: [0.02, 0.58, 0.98, 0.665] },
  ],
  spawn: P(0.24, 0.58),
  hatch: {
    approach: P(0.50, 0.53),
    center: P(0.50, 0.45),
  },
};

/* ------------------------------------------------------------------------ *
 * Basement lounge — traced over sail-boat-basement-bg.jpg (686×1024).
 * ------------------------------------------------------------------------ */
const BASEMENT_ZONE: ZoneConfig = {
  img: { width: 686, height: 1024 },
  bg: '/assets/images/sail-boat-basement-bg.jpg',
  // Below deck he stands closer to the camera — render clearly larger.
  characterScale: 1.4,
  walkable: [
    P(0.48, 0.645), // stair-base entry, below the arcade
    P(0.70, 0.675), // in front of the lowest steps
    P(0.78, 0.78),
    P(0.80, 0.92),
    P(0.60, 0.97),
    P(0.24, 0.97),
    P(0.10, 0.88),
    P(0.28, 0.79), // below the pool table
    P(0.47, 0.75),
  ],
  obstacles: [
    {
      name: 'pool-table',
      poly: [P(0.12, 0.55), P(0.66, 0.56), P(0.68, 0.68), P(0.58, 0.8), P(0.38, 0.84), P(0.1, 0.72)],
    },
    {
      name: 'barrels-bottom-right',
      poly: [P(0.82, 0.72), P(1.0, 0.72), P(1.0, 1.0), P(0.82, 1.0)],
    },
  ],
  spawn: P(0.60, 0.70), // right at the stair base — arrivals and departures
};

const ZONES: Record<NonNullable<Props['zone']>, ZoneConfig> = {
  deck: DECK_ZONE,
  basement: BASEMENT_ZONE,
};

/* ------------------------------------------------------------------------ */

/** Draco decoder is bundled offline — copied into public/draco at build time. */
const DRACO_DECODER_PATH = '/draco/';

/** Character on-screen height (px) at the *front* (bottom) of the walk area. */
const baseCharacterHeight = (viewportH: number) =>
  Math.min(165, Math.max(66, viewportH * 0.15));

/** Base stroll speed in normalized-screen-units/sec (scaled by depth). */
const WALK_SPEED = 0.055;
/** Stair legs are slower — climbing looks labored, not skatey. */
const STAIR_SPEED_MULT = 0.7;
/** Scripted hatch-approach speed (normalized/s) — keeps the descent snappy. */
const DESCEND_SPEED = 0.18;
/** Guided-tour walking speed — purposeful, but slower than a hatch dash. */
const GUIDE_SPEED = 0.11;
/** Sink-into-hatch / rise-out / stairs-fade duration (ms). */
const SINK_MS = 800;
/** Heading smoothing time constant (s) — ~0.3s to settle on a new direction. */
const TURN_SMOOTHING = 0.12;
/** Crossfade duration between clips (s). */
const FADE_S = 0.3;
/** Idle dwell between strolls (ms). */
const IDLE_RANGE_MS: [number, number] = [4000, 10000];
/** Gap between spontaneous one-shot idle-variation clips (ms). */
const VARIATION_GAP_MS: [number, number] = [8000, 16000];
/**
 * Fallback walk-cycle ground coverage when the clip has no root motion to
 * measure: a natural human stride covers ~0.6 body heights per second.
 */
const FALLBACK_STRIDE_HEIGHTS_PER_SEC = 0.6;
/**
 * Cartoon cadence boost: legs churn briskly relative to ground covered —
 * busy-little-character energy rather than a strict physical stride match.
 */
const WALK_CADENCE_BOOST = 2.6;
/** Procedural step rate (rad/s) for still uploads with no walk clip. */
const PROC_WALK_CADENCE = 14;
/** Vertical bob as a fraction of on-screen height (procedural walk). */
const PROC_WALK_BOB = 0.07;
/** Side lean (rad) at peak step (procedural walk). */
const PROC_WALK_SWAY = 0.1;
/** Forward lean (rad) while locomoting without a walk clip. */
const PROC_WALK_LEAN = 0.12;
/** How many recent stroll destinations to remember for wander biasing. */
const REGION_MEMORY = 3;
/** Time on deck before an autonomous hatch trip (ms). */
const TRIP_DELAY_RANGE_MS: [number, number] = [120_000, 240_000];
/** How long an autonomous basement visit lasts (ms). */
const BASEMENT_STAY_RANGE_MS: [number, number] = [90_000, 150_000];

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/* ---------------------------- 2D geometry ------------------------------- */

function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const cross2 = (o: Pt, a: Pt, b: Pt) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function segsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross2(p3, p4, p1);
  const d2 = cross2(p3, p4, p2);
  const d3 = cross2(p1, p2, p3);
  const d4 = cross2(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segmentHitsPoly(a: Pt, b: Pt, poly: Pt[]): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segsIntersect(a, b, poly[i], poly[j])) return true;
  }
  return pointInPoly({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, poly);
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ----------------------------- clip helpers ----------------------------- */

/** In-place flight (the ship parrot) counts as locomotion, same as walk/run. */
const isFlyClip = (c: THREE.AnimationClip) => /\bfly|flight/i.test(c.name);
const isLocomotion = (c: THREE.AnimationClip) =>
  /walk|run/i.test(c.name) || isFlyClip(c);
/** One-shot emotes — must not loop as a stand-in idle. */
const isGestureClip = (c: THREE.AnimationClip) =>
  /scratch|confused|stretch|yawn/i.test(c.name);

const isWaveClip = (c: THREE.AnimationClip) =>
  /wav(e|ing)|hello|greet|hi\b|salut|bye/i.test(c.name);
const isTalkClip = (c: THREE.AnimationClip) =>
  /talk|speak|speech|chat|dialog|mouth|say/i.test(c.name);
const isDanceClip = (c: THREE.AnimationClip) =>
  /dance|beat|groove|party|hip.?hop|boogie|disco|ymca|jig|salsa|funky|funny/i.test(
    c.name,
  );

const pickIdleClip = (clips: THREE.AnimationClip[]) =>
  clips.find((c) => /idle/i.test(c.name)) ||
  clips.find(
    (c) => /stand|breath/i.test(c.name) && !isTalkClip(c) && !isDanceClip(c),
  ) ||
  // Mixamo packs without a real idle (Noah) — walk is safer than a talk/move
  // clip whose scale tracks can shrink the mesh after we measure height.
  clips.find((c) => /^walk(ing)?$/i.test(c.name)) ||
  clips.find(
    (c) =>
      !isLocomotion(c) &&
      !isTalkClip(c) &&
      !isWaveClip(c) &&
      !isDanceClip(c) &&
      !isGestureClip(c),
  ) ||
  clips.find((c) => !isLocomotion(c) && !isTalkClip(c) && !isGestureClip(c)) ||
  clips.find((c) => !isLocomotion(c) && !isGestureClip(c)) ||
  // Parrot pack has no perch idle — hover on the in-place Flying cycle.
  clips.find((c) => /^flying$/i.test(c.name)) ||
  clips[0] ||
  null;

const pickWalkClip = (clips: THREE.AnimationClip[]) =>
  clips.find((c) => /^walk(ing)?$/i.test(c.name)) ||
  clips.find((c) => /walk/i.test(c.name)) ||
  clips.find((c) => /run/i.test(c.name)) ||
  clips.find((c) => /^flying$/i.test(c.name)) ||
  clips.find((c) => isFlyClip(c) && !/left|right|path/i.test(c.name)) ||
  null;

const pickDanceClip = (clips: THREE.AnimationClip[], idle: THREE.AnimationClip | null) =>
  clips.find(isDanceClip) ||
  clips.find(
    (c) => c !== idle && !isLocomotion(c) && !isWaveClip(c) && !isTalkClip(c),
  ) ||
  null;

const pickWaveClip = (clips: THREE.AnimationClip[]) =>
  clips.find(isWaveClip) || null;

const pickTalkClip = (clips: THREE.AnimationClip[]) =>
  clips.find(isTalkClip) || null;

/**
 * Spots on the ship the parrot actually lands on (image coords). Feet sit
 * at `x,y` — the cannon barrel, the top of the jukebox, the bow rail, and
 * the port rail. `heading` is the sit pose (radians, 0 faces the camera).
 */
const PARROT_PERCHES: { x: number; y: number; heading: number }[] = [
  { x: 0.2, y: 0.5, heading: -0.2 }, // on the cannon barrel
  { x: 0.5, y: 0.33, heading: 0.05 }, // standing on top of the jukebox
  { x: 0.5, y: 0.152, heading: 0 }, // bow railing
  { x: 0.06, y: 0.57, heading: 0.9 }, // port rail, below the cannon
];
/** How long the parrot stays perched before taking off again. */
const PARROT_SIT_MS = 8000;
const PARROT_ZOOM = 0.4;
/** Cruise height between landings, in body-heights above the spot. */
const PARROT_CRUISE_ALT = 1.05;

const parrotPerch = (index: number) =>
  PARROT_PERCHES[((index % PARROT_PERCHES.length) + PARROT_PERCHES.length) % PARROT_PERCHES.length];

/** Pull dull PBR exports toward the painted deck — more chroma, less gray sheen. */
function brightenCrewMaterial(mat: THREE.Material) {
  const pbr = mat as THREE.MeshStandardMaterial;
  if (!pbr.isMeshStandardMaterial && !(pbr as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    return;
  }
  const hsl = { h: 0, s: 0, l: 0 };
  pbr.color.getHSL(hsl);
  pbr.color.setHSL(
    hsl.h,
    Math.min(1, hsl.s * 1.55 + 0.18),
    Math.min(0.68, hsl.l * 1.2 + 0.08),
  );
  pbr.metalness = 0;
  pbr.roughness = Math.min(pbr.roughness, 0.42);
  if (pbr.map) pbr.emissiveMap = pbr.map;
  pbr.emissive.set(0xffffff);
  pbr.emissiveIntensity = 0.72;
  const phys = pbr as THREE.MeshPhysicalMaterial;
  if (phys.isMeshPhysicalMaterial) {
    phys.sheen = 0;
    phys.clearcoat = Math.min(phys.clearcoat ?? 0, 0.12);
  }
}

const strippedClips = new WeakSet<THREE.AnimationClip>();
/** Authored root XZ travel per clip loop (local hips units), pre-strip. */
const clipStrideLocal = new WeakMap<THREE.AnimationClip, number>();

/**
 * Strip horizontal root motion: zero the root bone's X/Z position keys
 * (keeping Y for bobbing). Different clips park the hips at different XZ
 * offsets, which made the character visibly pop sideways on every clip
 * change / rotation — after this, code fully owns position and heading.
 * The authored XZ travel is recorded first so walk playback rate can be
 * matched to actual ground speed (foot-skating fix).
 */
function stripRootXZ(clips: THREE.AnimationClip[], rootBoneName: string) {
  for (const clip of clips) {
    // The parrot's Flight Path carries the swoop on the armature. Stripping
    // it would pin the bird in place and throw away the updated path.
    if (/flight\s*path/i.test(clip.name)) continue;
    if (strippedClips.has(clip)) continue;
    strippedClips.add(clip);
    for (const track of clip.tracks) {
      if (track.name === `${rootBoneName}.position`) {
        const values = track.values;
        const last = values.length - 3;
        clipStrideLocal.set(
          clip,
          Math.hypot(values[last] - values[0], values[last + 2] - values[2]),
        );
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0;
          values[i + 2] = 0;
        }
      }
    }
  }
}

/* --------------------------- blob shadow -------------------------------- */

/** Soft warm-dark radial blob, ~40% core opacity fading to transparent. */
function makeShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, 'rgba(48, 26, 12, 0.42)');
  g.addColorStop(0.55, 'rgba(48, 26, 12, 0.26)');
  g.addColorStop(1, 'rgba(48, 26, 12, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------------ */

/** One straight segment of a route; stairs get slower speed + climb look. */
type Leg = { to: Pt; stair: boolean };

/** Scripted exit: walk legs, then fade while sinking (hatch) / rising (stairs). */
type Exit = {
  phase: 'approach' | 'fade';
  legs: Leg[];
  /** Drift toward this point while fading (hatch center), or fade in place. */
  driftTo: Pt | null;
  /** 1 = sink below the floor line (hatch), -1 = rise away (basement stairs). */
  dir: 1 | -1;
  fadeFrom: Pt;
  fadeStart: number;
  p: number;
  onDone: (() => void) | null;
};

type Figure = {
  character: UnlockedCharacter;
  group: THREE.Group;
  /** Visual root inside `group` — procedural bob/lean is applied here. */
  inner: THREE.Group;
  mixer: THREE.AnimationMixer;
  materials: THREE.Material[];
  shadow: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  danceAction: THREE.AnimationAction | null;
  waveAction: THREE.AnimationAction | null;
  talkAction: THREE.AnimationAction | null;
  variationActions: THREE.AnimationAction[];
  currentAction: THREE.AnimationAction | null;
  /** Authored walk coverage as body-heights per second (for timeScale). */
  walkStrideHeightsPerSec: number;
  /** True when the GLB/image has no walk clip — use bob/lean instead. */
  usesProceduralWalk: boolean;
  /** Accumulated step phase for procedural walk (radians). */
  walkPhase: number;
  /** Normalized screen position of the feet. */
  pos: Pt;
  /** Remaining route legs for the current destination. */
  legs: Leg[];
  heading: number;
  targetHeading: number;
  mode:
    | 'idle'
    | 'variation'
    | 'walking'
    | 'dancing'
    | 'talking'
    | 'guided' // tour: walking to a feature before talking about it
    | 'exiting' // scripted hatch descent or basement departure
    | 'away' // below deck while this (deck) page stays mounted
    | 'emerging' // rising back out of the hatch
    | 'gone';
  idleUntil: number;
  nextVariationAt: number;
  /** Destinations left in the current stroll (each may be multiple legs). */
  strollStopsLeft: number;
  /** Total strolls taken — every 2nd is a far-region "tour". */
  strollCount: number;
  /** Names of the last few visited regions (for wander biasing). */
  recentRegions: string[];
  /** Deck: when the next autonomous hatch trip starts (epoch ms). */
  tripAt: number;
  /** Deck: when to rise back out of the hatch while 'away' (epoch ms). */
  emergeAt: number;
  emergeT0: number;
  /** Basement: when to head back up the stairs (epoch ms). */
  departAt: number;
  exit: Exit | null;
  /** Guided-tour walk in progress (see CrewDeckHandle.walkTo). */
  guide: { legs: Leg[]; onArrive: (() => void) | null } | null;
  /** True while waiting at a stair base for another climber (single-file). */
  stairHolding: boolean;
  /** Ship parrot: flies between ship spots, then stays perched. */
  flyer: boolean;
  /** Current height above the landing spot, in body-heights. */
  flightAlt: number;
  /** Smoothed pitch; +π/2 lays the belly toward the deck. */
  flightPitch: number;
  flightLeg: number;
  /** performance.now() deadline while perched. */
  flightPerchedUntil: number;
  /** Authored Flight Path clip. Null on crew who walk. */
  flightPathAction: THREE.AnimationAction | null;
  /** Deck point the current Flight Path lap started from. */
  flightFrom: { x: number; y: number } | null;
};

const gltfCache = new Map<string, Promise<GLTF>>();

function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  let cached = gltfCache.get(url);
  if (!cached) {
    cached = loader.loadAsync(url);
    cached.catch(() => gltfCache.delete(url));
    gltfCache.set(url, cached);
  }
  return cached;
}

/** Still-image billboard for uploads that have no GLB (or whose GLB failed). */
function loadBillboard(
  url: string,
): Promise<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as { width?: number; height?: number };
        const aspect =
          img?.width && img?.height ? img.width / Math.max(img.height, 1) : 0.55;
        const material = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: true,
          alphaTest: 0.08,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), material);
        mesh.position.y = 0.5;
        resolve({ mesh, material });
      },
      undefined,
      (err) => reject(err),
    );
  });
}

const CrewDeck3D = forwardRef<CrewDeckHandle, Props>(function CrewDeck3D(
  { characters, zone = 'deck', paused = false, onCharacterTap, onDeckTap },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTapRef = useRef(onCharacterTap);
  onTapRef.current = onCharacterTap;
  const onDeckTapRef = useRef(onDeckTap);
  onDeckTapRef.current = onDeckTap;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const descendFnRef = useRef<((id: string, onDone: () => void) => boolean) | null>(
    null,
  );
  const hitTestFnRef = useRef<CrewDeckHandle['characterAt'] | null>(null);
  const danceAllFnRef = useRef<((durationMs: number) => boolean) | null>(null);
  const waveAllFnRef = useRef<(() => boolean) | null>(null);
  const talkFnRef = useRef<((id: string) => boolean) | null>(null);
  const stopTalkFnRef = useRef<((id?: string) => void) | null>(null);
  const stopPartyFnRef = useRef<(() => void) | null>(null);
  const walkToFnRef = useRef<CrewDeckHandle['walkTo'] | null>(null);
  const feetFnRef = useRef<(() => { x: number; y: number }[]) | null>(null);
  const anchorFnRef = useRef<((id?: string) => { x: number; y: number } | null) | null>(
    null,
  );

  useImperativeHandle(
    ref,
    () => ({
      descendIntoHatch: (id: string, onDone: () => void) =>
        descendFnRef.current?.(id, onDone) ?? false,
      characterAt: (x: number, y: number) => hitTestFnRef.current?.(x, y) ?? null,
      danceAll: (durationMs: number) => danceAllFnRef.current?.(durationMs) ?? false,
      waveAll: () => waveAllFnRef.current?.() ?? false,
      talk: (id: string) => talkFnRef.current?.(id) ?? false,
      stopTalk: (id?: string) => stopTalkFnRef.current?.(id),
      stopParty: () => stopPartyFnRef.current?.(),
      walkTo: (id, spot, onArrive) => walkToFnRef.current?.(id, spot, onArrive) ?? false,
      feetPositions: () => feetFnRef.current?.() ?? [],
      characterAnchor: (id?: string) => anchorFnRef.current?.(id) ?? null,
    }),
    [],
  );

  // Rebuild the scene only when the roster of 3D characters actually changes.
  const signature = `${zone}:${characters.map((c) => `${c.id}|${c.modelUrl || ''}|${c.imageUrl || ''}|${c.deckScale ?? ''}|${c.flyer ? 1 : 0}`).join(',')}`;
  const charactersRef = useRef(characters);
  charactersRef.current = characters;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || charactersRef.current.length === 0) return;
    const zoneCfg = ZONES[zone];
    const zoneScale = zoneCfg.characterScale ?? 1;

    let disposed = false;
    let rafId = 0;

    // DEV ONLY: `localStorage.debugCrewTripSeconds = '8'` shrinks both the
    // autonomous-trip delay and the basement stay to N seconds for testing.
    const debugTripSec =
      parseFloat(localStorage.getItem('debugCrewTripSeconds') || '') || 0;
    const tripDelayMs = () =>
      debugTripSec > 0 ? debugTripSec * 1000 : rand(...TRIP_DELAY_RANGE_MS);
    const stayMs = () =>
      debugTripSec > 0 ? debugTripSec * 1000 : rand(...BASEMENT_STAY_RANGE_MS);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    camera.position.z = 1000;

    // Warm lighting to match the painted art (golden deck / lantern basement).
    // Soft IBL so PBR uploads aren't muddy, kept quiet so they don't blow out.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xffeed8, 0x9a6238, 1.25));
    const sun = new THREE.DirectionalLight(0xffe9c4, 1.5);
    sun.position.set(-0.4, 1, 0.8);
    scene.add(sun);

    const shadowTexture = makeShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1, 1);

    let viewW = container.clientWidth || window.innerWidth;
    let viewH = container.clientHeight || window.innerHeight;

    /* ---- zone map: image coords → screen-normalized coords (object-cover) */
    let walkPoly: Pt[] = [];
    let obstaclePolys: Pt[][] = [];
    let platformPolys: { id: string; poly: Pt[] }[] = [];
    /** Screen-mapped stair polylines, ordered deck → platform. */
    let stairPaths: { platformId: string; path: Pt[] }[] = [];
    let regions: { name: string; platform?: string; bbox?: [number, number, number, number] }[] =
      [];
    let hatchApproach: Pt | null = null;
    let hatchCenter: Pt | null = null;
    let spawnPt: Pt | null = null;
    /** Zone image coords (0–1) → normalized screen coords (object-cover). */
    let imgToScreen: (p: Pt) => Pt = (p) => p;
    let walkYMin = 0.3;
    let walkYMax = 0.8;
    let walkBBox = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const occluderEls: HTMLDivElement[] = [];

    const rebuildZones = () => {
      const scale = Math.max(viewW / zoneCfg.img.width, viewH / zoneCfg.img.height);
      const dw = zoneCfg.img.width * scale;
      const dh = zoneCfg.img.height * scale;
      const ox = (viewW - dw) / 2;
      const oy =
        dh > viewH + 1
          ? zoneCfg.wideTopPct != null
            ? viewH * zoneCfg.wideTopPct
            : (viewH - dh) / 2
          : zoneCfg.topPct != null
            ? viewH * zoneCfg.topPct
            : (viewH - dh) / 2;
      const map = (p: Pt): Pt => ({
        x: (p.x * dw + ox) / viewW,
        y: (p.y * dh + oy) / viewH,
      });
      imgToScreen = map;
      walkPoly = zoneCfg.walkable.map(map);
      obstaclePolys = zoneCfg.obstacles.map((o) => o.poly.map(map));
      platformPolys = (zoneCfg.platforms ?? []).map((p) => ({
        id: p.id,
        poly: p.poly.map(map),
      }));
      stairPaths = (zoneCfg.platforms ?? []).map((p) => ({
        platformId: p.id,
        path: p.stair.map(map),
      }));
      regions = (zoneCfg.regions ?? []).map((r) =>
        'platform' in r
          ? { name: r.name, platform: r.platform }
          : {
              name: r.name,
              bbox: [
                map(P(r.bbox[0], r.bbox[1])).x,
                map(P(r.bbox[0], r.bbox[1])).y,
                map(P(r.bbox[2], r.bbox[3])).x,
                map(P(r.bbox[2], r.bbox[3])).y,
              ] as [number, number, number, number],
            },
      );
      hatchApproach = zoneCfg.hatch ? map(zoneCfg.hatch.approach) : null;
      hatchCenter = zoneCfg.hatch ? map(zoneCfg.hatch.center) : null;
      spawnPt = zoneCfg.spawn ? map(zoneCfg.spawn) : null;
      const allYs = [
        ...walkPoly.map((p) => p.y),
        ...platformPolys.flatMap((p) => p.poly.map((q) => q.y)),
      ];
      walkYMin = Math.min(...allYs);
      walkYMax = Math.max(...allYs);
      walkBBox = {
        minX: Math.min(...walkPoly.map((p) => p.x)),
        maxX: Math.max(...walkPoly.map((p) => p.x)),
        minY: Math.min(...walkPoly.map((p) => p.y)),
        maxY: Math.max(...walkPoly.map((p) => p.y)),
      };

      // Occluder strips: identical art pixels redrawn above the canvas.
      occluderEls.forEach((el) => el.remove());
      occluderEls.length = 0;
      for (const rect of zoneCfg.occluders ?? []) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = `${rect.x * dw + ox}px`;
        el.style.top = `${rect.y * dh + oy}px`;
        el.style.width = `${rect.w * dw}px`;
        el.style.height = `${rect.h * dh}px`;
        el.style.backgroundImage = `url(${zoneCfg.bg})`;
        el.style.backgroundSize = `${dw}px ${dh}px`;
        el.style.backgroundPosition = `${-rect.x * dw}px ${-rect.y * dh}px`;
        el.style.pointerEvents = 'none';
        el.setAttribute('aria-hidden', 'true');
        container.appendChild(el); // after the canvas → renders above it
        occluderEls.push(el);
      }
    };

    /** Painted perspective: smaller when higher on screen (further away). */
    const depthScale = (ny: number) => {
      const t = (ny - walkYMin) / Math.max(walkYMax - walkYMin, 0.001);
      return 0.5 + 0.5 * Math.max(0, Math.min(1, t));
    };

    /** On-screen character height in px at a given depth. */
    const heightAt = (ny: number) =>
      baseCharacterHeight(viewH) * zoneScale * depthScale(ny);
    /** Same height, times this crew mate's deckScale (parrot is smaller). */
    const sizedHeight = (f: Figure) => heightAt(f.pos.y) * (f.character.deckScale ?? 1);

    /** Which walk surface a point is on: a platform id or the main deck. */
    const levelOf = (p: Pt): string => {
      for (const plat of platformPolys) {
        if (pointInPoly(p, plat.poly)) return plat.id;
      }
      return 'main';
    };

    const isStandableMain = (p: Pt) =>
      pointInPoly(p, walkPoly) && !obstaclePolys.some((o) => pointInPoly(p, o));

    /** Random standable point on the MAIN deck (platforms only via stairs). */
    const sampleMainPoint = (awayFrom?: Pt): Pt | null => {
      for (let i = 0; i < 60; i++) {
        const p = P(
          rand(walkBBox.minX, walkBBox.maxX),
          rand(walkBBox.minY, walkBBox.maxY),
        );
        if (!isStandableMain(p)) continue;
        if (awayFrom && Math.hypot(p.x - awayFrom.x, p.y - awayFrom.y) < 0.1) continue;
        return p;
      }
      return null;
    };

    const samplePlatformPoint = (platformId: string): Pt | null => {
      const plat = platformPolys.find((p) => p.id === platformId);
      if (!plat) return null;
      const xs = plat.poly.map((p) => p.x);
      const ys = plat.poly.map((p) => p.y);
      for (let i = 0; i < 40; i++) {
        const p = P(
          rand(Math.min(...xs), Math.max(...xs)),
          rand(Math.min(...ys), Math.max(...ys)),
        );
        if (pointInPoly(p, plat.poly)) return p;
      }
      return null;
    };

    const legClear = (a: Pt, b: Pt) =>
      !obstaclePolys.some((o) => segmentHitsPoly(a, b, o));

    /**
     * Straight main-deck path, or a single-midpoint detour around obstacles.
     * Returns the waypoint list (excluding `from`), or null if unroutable.
     */
    const routeOnMain = (from: Pt, to: Pt): Pt[] | null => {
      if (legClear(from, to)) return [to];
      for (let i = 0; i < 14; i++) {
        const mid = sampleMainPoint();
        if (mid && legClear(from, mid) && legClear(mid, to)) return [mid, to];
      }
      return null;
    };

    /**
     * Full route between any two standable points. Stairs are the ONLY
     * connection between the main deck and platforms — platform destinations
     * always route via their stair path, never straight through the railing.
     */
    const buildRoute = (from: Pt, to: Pt): Leg[] | null => {
      const lf = levelOf(from);
      const lt = levelOf(to);
      if (lf === lt) {
        if (lf === 'main') {
          const pts = routeOnMain(from, to);
          return pts ? pts.map((p) => ({ to: p, stair: false })) : null;
        }
        return [{ to, stair: false }]; // within one platform pocket
      }
      const legs: Leg[] = [];
      let cur = from;
      if (lf !== 'main') {
        // Climb down: walk to the stair top, then follow the tread line down.
        const st = stairPaths.find((s) => s.platformId === lf);
        if (!st) return null;
        const path = st.path;
        legs.push({ to: path[path.length - 1], stair: false });
        for (let i = path.length - 2; i >= 0; i--) {
          legs.push({ to: path[i], stair: true });
        }
        cur = path[0];
      }
      if (lt !== 'main') {
        // Climb up: approach the stair base, then follow the tread line up.
        const st = stairPaths.find((s) => s.platformId === lt);
        if (!st) return null;
        const path = st.path;
        const approach = routeOnMain(cur, path[0]);
        if (!approach) return null;
        legs.push(...approach.map((p) => ({ to: p, stair: false })));
        for (let i = 1; i < path.length; i++) {
          legs.push({ to: path[i], stair: true });
        }
        legs.push({ to, stair: false });
      } else {
        const pts = routeOnMain(cur, to);
        if (!pts) return null;
        legs.push(...pts.map((p) => ({ to: p, stair: false })));
      }
      return legs;
    };

    /** Region name at a point — for the recent-visits memory. */
    const regionNameAt = (p: Pt): string | null => {
      for (const r of regions) {
        if (r.platform) {
          const plat = platformPolys.find((pl) => pl.id === r.platform);
          if (plat && pointInPoly(p, plat.poly)) return r.name;
        } else if (r.bbox) {
          const [minX, minY, maxX, maxY] = r.bbox;
          if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return r.name;
        }
      }
      return null;
    };

    /** Sample a destination inside a specific region. */
    const samplePointInRegion = (
      r: (typeof regions)[number],
    ): Pt | null => {
      if (r.platform) return samplePlatformPoint(r.platform);
      if (!r.bbox) return null;
      const [minX, minY, maxX, maxY] = r.bbox;
      for (let i = 0; i < 40; i++) {
        const p = P(rand(minX, maxX), rand(minY, maxY));
        if (isStandableMain(p)) return p;
      }
      return null;
    };

    /* ---- debug overlay: localStorage.debugCrewZones = '1' ---------------- */
    const debugZones = !!localStorage.getItem('debugCrewZones');
    const debugGroup = new THREE.Group();
    if (debugZones) scene.add(debugGroup);

    const toWorld = (nx: number, ny: number, z: number) =>
      new THREE.Vector3(nx * viewW - viewW / 2, viewH / 2 - ny * viewH, z);

    const rebuildDebugLines = () => {
      if (!debugZones) return;
      debugGroup.clear();
      const addLoop = (poly: Pt[], color: number, close = true) => {
        const pts = poly.map((p) => toWorld(p.x, p.y, 900));
        if (close) pts.push(pts[0].clone());
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        debugGroup.add(
          new THREE.Line(geo, new THREE.LineBasicMaterial({ color })),
        );
      };
      addLoop(walkPoly, 0x22ff66);
      obstaclePolys.forEach((o) => addLoop(o, 0xff4444));
      platformPolys.forEach((p) => addLoop(p.poly, 0x33aaff));
      stairPaths.forEach((s) => addLoop(s.path, 0xffee33, false));
      for (const rect of zoneCfg.occluders ?? []) {
        // occluders are authored in image coords — map like everything else
        const scale = Math.max(viewW / zoneCfg.img.width, viewH / zoneCfg.img.height);
        const dw = zoneCfg.img.width * scale;
        const dh = zoneCfg.img.height * scale;
        const ox = (viewW - dw) / 2;
        const oy = (viewH - dh) / 2;
        const m = (x: number, y: number): Pt => ({
          x: (x * dw + ox) / viewW,
          y: (y * dh + oy) / viewH,
        });
        addLoop(
          [
            m(rect.x, rect.y),
            m(rect.x + rect.w, rect.y),
            m(rect.x + rect.w, rect.y + rect.h),
            m(rect.x, rect.y + rect.h),
          ],
          0xff33ff,
        );
      }
    };

    const applySize = () => {
      viewW = container.clientWidth || window.innerWidth;
      viewH = container.clientHeight || window.innerHeight;
      renderer.setSize(viewW, viewH, false);
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      rebuildZones();
      rebuildDebugLines();
    };
    applySize();
    window.addEventListener('resize', applySize);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    const figures: Figure[] = [];
    /** Jukebox party deadline (performance.now() ms); 0 = no party running. */
    let partyUntil = 0;

    /** Top-of-head anchor in CSS px, for positioning the HTML action menu. */
    const parrotLiftPx = (f: Figure) => f.flightAlt * sizedHeight(f);
    const anchorFor = (f: Figure) => {
      const h = sizedHeight(f);
      const liftPx = f.flyer ? parrotLiftPx(f) : 0;
      return { x: f.pos.x * viewW, y: f.pos.y * viewH - h - liftPx };
    };

    const startAction = (
      f: Figure,
      action: THREE.AnimationAction | null,
      fade = FADE_S,
    ) => {
      if (!action || f.currentAction === action) return;
      action.reset();
      action.play();
      if (f.currentAction) {
        f.currentAction.crossFadeTo(action, fade, false);
      }
      f.currentAction = action;
    };

    /** Play a clip once (held on its last frame until we fade back to idle). */
    const playOneShot = (f: Figure, action: THREE.AnimationAction) => {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      startAction(f, action);
    };

    const setFigureOpacity = (f: Figure, opacity: number) => {
      const solid = opacity >= 1;
      f.materials.forEach((m) => {
        m.transparent = solid ? m.userData.wasTransparent === true : true;
        m.opacity = opacity;
        // Keep depth-write ON while fading so a half-faded character still
        // self-occludes (no limbs visible through the torso mid-descent);
        // restore the material's own setting once solid again.
        m.depthWrite = solid ? m.userData.wasDepthWrite !== false : true;
      });
      f.shadowMat.opacity = opacity;
    };

    const goIdle = (f: Figure, now: number) => {
      f.mode = 'idle';
      f.stairHolding = false;
      f.idleUntil = now + rand(...IDLE_RANGE_MS);
      f.targetHeading = 0; // settle facing the camera
      if (f.walkAction) f.walkAction.timeScale = 1;
      startAction(f, f.idleAction);
      const region = regionNameAt(f.pos);
      if (region && f.recentRegions[f.recentRegions.length - 1] !== region) {
        f.recentRegions.push(region);
        if (f.recentRegions.length > REGION_MEMORY) f.recentRegions.shift();
      }
    };

    /**
     * Pick the next stroll destination. Every 2nd stroll is a "tour": aim
     * for a region not visited recently, so random wandering doesn't cluster
     * around the deck center and he demonstrably reaches the stern and
     * climbs the quarterdeck over a few minutes of watching.
     */
    const pickDestination = (f: Figure): Pt | null => {
      // DEV ONLY: `localStorage.debugCrewFirstStop = '<platform id>'` (or a
      // raw normalized point like '0.5,0.52') forces the first stroll there
      // for fast verification.
      const forced = localStorage.getItem('debugCrewFirstStop');
      if (forced && f.strollCount === 1) {
        const pt = /^([\d.]+)\s*,\s*([\d.]+)$/.exec(forced);
        if (pt) return { x: Number(pt[1]), y: Number(pt[2]) };
        const p = samplePlatformPoint(forced);
        if (p) return p;
      }
      const tour = regions.length > 0 && f.strollCount % 2 === 0;
      if (tour) {
        const candidates = regions.filter((r) => !f.recentRegions.includes(r.name));
        const pool = candidates.length > 0 ? candidates : regions;
        for (let i = 0; i < 4; i++) {
          const r = pool[Math.floor(Math.random() * pool.length)];
          const p = samplePointInRegion(r);
          if (p) return p;
        }
      }
      return sampleMainPoint(f.pos);
    };

    /**
     * True when a candidate destination is parked on top of another
     * character (their current spot, or where their own stroll will end).
     */
    const destCrowded = (f: Figure, dest: Pt): boolean =>
      solidFigures(f).some((o) => {
        const clear = (radiusPx(f) + radiusPx(o)) * 1.4;
        const dPos = Math.hypot(
          (dest.x - o.pos.x) * viewW,
          (dest.y - o.pos.y) * viewH,
        );
        if (dPos < clear) return true;
        const oDest = o.legs.length > 0 ? o.legs[o.legs.length - 1].to : null;
        return oDest
          ? Math.hypot((dest.x - oDest.x) * viewW, (dest.y - oDest.y) * viewH) <
              clear
          : false;
      });

    /** Route to a fresh destination; false if nothing routable was found. */
    const startStrollTo = (f: Figure): boolean => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const dest = pickDestination(f);
        if (!dest) continue;
        // Don't aim at a spot someone is standing on / heading to (the
        // debug-forced first stop skips this so verification stays exact;
        // the last attempt also skips it rather than not strolling at all).
        const forcedDebug =
          f.strollCount === 1 && !!localStorage.getItem('debugCrewFirstStop');
        if (attempt < 3 && !forcedDebug && destCrowded(f, dest)) continue;
        const legs = buildRoute(f.pos, dest);
        if (!legs || legs.length === 0) continue;
        f.legs = legs;
        f.mode = 'walking';
        // A platform is a destination worth lingering at — end the stroll there
        if (levelOf(dest) !== 'main') f.strollStopsLeft = 1;
        startAction(f, f.walkAction);
        return true;
      }
      return false;
    };

    /**
     * Scripted exit: walk to the hatch (deck) or the stairs (basement), then
     * fade out — sinking into the hatch or rising away up the stairs.
     */
    const beginExit = (
      f: Figure,
      target: Pt,
      driftTo: Pt | null,
      dir: 1 | -1,
      onDone: () => void,
    ) => {
      const legs = buildRoute(f.pos, target) ?? [{ to: target, stair: false }];
      stopPartyFnRef.current?.(); // hatch descent cuts a running party short
      f.mode = 'exiting';
      f.exit = {
        phase: 'approach',
        legs,
        driftTo,
        dir,
        fadeFrom: { ...f.pos },
        fadeStart: 0,
        p: 0,
        onDone,
      };
      startAction(f, f.walkAction ?? f.idleAction);
    };

    /** Rise out of the hatch and resume deck wandering. */
    const beginEmerge = (f: Figure, now: number) => {
      if (!hatchCenter || !hatchApproach) return;
      f.pos = { ...hatchCenter };
      f.group.visible = true;
      f.shadow.visible = true;
      setFigureOpacity(f, 0);
      f.mode = 'emerging';
      f.emergeT0 = now;
      f.targetHeading = Math.atan2(
        hatchApproach.x - hatchCenter.x,
        (hatchApproach.y - hatchCenter.y) * 1.4,
      );
      f.heading = f.targetHeading;
      startAction(f, f.walkAction ?? f.idleAction);
    };

    const addFigure = (
      character: UnlockedCharacter,
      charIndex: number,
      inner: THREE.Group,
      materials: THREE.Material[],
      mixer: THREE.AnimationMixer,
      idleAction: THREE.AnimationAction | null,
      walkAction: THREE.AnimationAction | null,
      danceAction: THREE.AnimationAction | null,
      waveAction: THREE.AnimationAction | null,
      talkAction: THREE.AnimationAction | null,
      variationActions: THREE.AnimationAction[],
      walkStrideHeightsPerSec: number,
      flightPathAction: THREE.AnimationAction | null = null,
    ) => {
      if (disposed) return;
      const group = new THREE.Group();
      group.add(inner);
      group.userData.characterId = character.id;
      scene.add(group);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      scene.add(shadow);

      const now = performance.now();
      const preferred =
        charIndex === 0 && spawnPt && isStandableMain(spawnPt) ? spawnPt : null;
      const spawn = preferred ?? sampleMainPoint() ?? P(0.4, 0.7);
      const f: Figure = {
        character,
        group,
        inner,
        mixer,
        materials,
        shadow,
        shadowMat,
        idleAction,
        walkAction,
        danceAction,
        waveAction,
        talkAction,
        variationActions,
        currentAction: null,
        walkStrideHeightsPerSec,
        usesProceduralWalk: !walkAction,
        walkPhase: Math.random() * Math.PI * 2,
        pos: { ...spawn },
        legs: [],
        heading: 0,
        targetHeading: 0,
        mode: 'idle',
        idleUntil: now + rand(1500, 4000),
        nextVariationAt: now + rand(...VARIATION_GAP_MS),
        strollStopsLeft: 0,
        strollCount: 0,
        recentRegions: [],
        tripAt: Date.now() + tripDelayMs(),
        emergeAt: 0,
        emergeT0: 0,
        departAt: Date.now() + stayMs(),
        exit: null,
        guide: null,
        stairHolding: false,
        flyer: !!character.flyer,
        flightAlt: 0,
        flightPitch: 0,
        flightLeg: 0,
        flightPerchedUntil: now + (character.flyer ? PARROT_SIT_MS : 0),
        flightPathAction,
        flightFrom: null,
      };
      startAction(f, idleAction, 0);
      if (character.flyer) {
        const home = parrotPerch(0);
        f.pos = { x: home.x, y: home.y };
        f.mode = 'idle';
        f.targetHeading = home.heading;
        f.heading = home.heading;
        if (f.walkAction) f.walkAction.paused = true;
        setCrewLocation(character.id, { loc: 'deck' });
      }

      if (zone === 'deck') {
        const rec = getCrewLocation(character.id);
        if (rec.loc === 'basement') {
          f.mode = 'away';
          f.emergeAt = rec.returnAt ?? Date.now();
          f.group.visible = false;
          f.shadow.visible = false;
        }
      } else {
        const rec = getCrewLocation(character.id);
        f.departAt = rec.returnAt ?? Date.now() + stayMs();
      }

      mixer.addEventListener('finished', () => {
        if (f.mode !== 'variation') return;
        const t = performance.now();
        goIdle(f, t);
        f.nextVariationAt = t + rand(...VARIATION_GAP_MS);
      });
      mixer.update(0.001);
      figures.push(f);
      if (f.usesProceduralWalk) {
        console.info(
          `CrewDeck3D[${zone}]: "${character.name}" procedural bob/lean walk (no walk clip)`,
        );
      }
    };

    const mountBillboard = (character: UnlockedCharacter, charIndex: number) => {
      const url = character.imageUrl?.trim();
      if (!url) return Promise.resolve();
      return loadBillboard(url).then(({ mesh, material }) => {
        if (disposed) {
          material.map?.dispose();
          material.dispose();
          mesh.geometry.dispose();
          return;
        }
        const inner = new THREE.Group();
        inner.add(mesh);
        addFigure(
          character,
          charIndex,
          inner,
          [material],
          new THREE.AnimationMixer(inner),
          null,
          null,
          null,
          null,
          null,
          [],
          FALLBACK_STRIDE_HEIGHTS_PER_SEC,
        );
      });
    };

    charactersRef.current.forEach((character, charIndex) => {
      if (!character.modelUrl) {
        void mountBillboard(character, charIndex).catch((err) => {
          console.warn('CrewDeck3D: failed to load still', character.imageUrl, err);
        });
        return;
      }
      loadGltf(loader, character.modelUrl)
        .then((gltf) => {
          if (disposed) return;

          // Skinned meshes need SkeletonUtils.clone (plain .clone() breaks bones)
          const model = cloneSkeleton(gltf.scene);
          // Skinned bounding volumes stay at bind pose, so Three would cull the
          // mesh incorrectly once bones animate — disable frustum culling.
          // Materials are cloned per character so exit fades don't affect
          // other characters sharing the same GLB.
          const materials: THREE.Material[] = [];
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
              mesh.frustumCulled = false;
            }
            if (mesh.isMesh) {
              const mats = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              const clones = mats.map((m) => {
                const c = m.clone();
                // Meshy exports (and the portal optimizer's re-encode of
                // them) ship materials with alphaMode BLEND even though the
                // art is fully opaque. three.js draws BLEND with depth-write
                // OFF, so far limbs/backfaces show through the torso while
                // walking. Unless the material genuinely wants translucency
                // (authored opacity < 1), force it solid; real cutouts
                // (alphaMode MASK → alphaTest) arrive with transparent=false
                // and are untouched.
                if (c.transparent && c.opacity >= 1) {
                  c.transparent = false;
                  c.depthWrite = true;
                }
                const pbr = c as THREE.MeshStandardMaterial;
                if (pbr.isMeshStandardMaterial) {
                  pbr.metalness = Math.min(pbr.metalness, 0.35);
                }
                if (character.flyer) brightenCrewMaterial(c);
                c.userData.wasTransparent = c.transparent;
                c.userData.wasDepthWrite = c.depthWrite;
                return c;
              });
              mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
              materials.push(...clones);
            }
          });

          // Prefer hips/pelvis — Mixamo trees list leaf bones first (HeadTop_End).
          const bones: THREE.Bone[] = [];
          model.traverse((obj) => {
            if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
          });
          const rootBone =
            bones.find((b) => /^(mixamorig:)?(hips|pelvis|root)$/i.test(b.name)) ||
            bones.find((b) => /hips|pelvis/i.test(b.name)) ||
            bones[0] ||
            null;
          const clips = gltf.animations || [];
          // Hips-parent world scale converts local hips travel to model units
          model.updateMatrixWorld(true);
          const hipsParentScale = rootBone?.parent
            ? rootBone.parent.getWorldScale(new THREE.Vector3()).y
            : 1;
          if (rootBone) stripRootXZ(clips, (rootBone as THREE.Bone).name);

          const mixer = new THREE.AnimationMixer(model);
          const idleClip = pickIdleClip(clips);
          const walkClip = pickWalkClip(clips);
          const danceClip = pickDanceClip(clips, idleClip);
          const waveClip = pickWaveClip(clips);
          const talkClip = pickTalkClip(clips);
          const flightPathClip =
            clips.find((c) => /flight\s*path/i.test(c.name)) || null;
          const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
          const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
          const danceAction = danceClip ? mixer.clipAction(danceClip) : null;
          const variationActions = clips
            .filter(
              (c) =>
                c !== idleClip &&
                c !== danceClip &&
                c !== talkClip &&
                !isLocomotion(c),
            )
            .map((c) => mixer.clipAction(c));
          const waveAction = waveClip
            ? mixer.clipAction(waveClip)
            : variationActions[0] || null;
          const talkAction = talkClip
            ? mixer.clipAction(talkClip)
            : variationActions.find((a) => a !== waveAction) ||
              waveAction ||
              idleAction;
          const flightPathAction = flightPathClip
            ? mixer.clipAction(flightPathClip)
            : null;

          // Normalize to unit height, feet at y=0, centered on x/z.
          // IMPORTANT: measure the *animated* pose, not the bind pose — some
          // rigs (e.g. Meshy exports) carry scale tracks on the hips that
          // resize the skeleton at runtime, so the bind-pose bbox can be off
          // by orders of magnitude. Bone world positions after posing the idle
          // clip give reliable bounds for skinned meshes.
          if (idleAction) {
            idleAction.play();
            mixer.update(idleClip!.duration * 0.3);
          }
          model.updateMatrixWorld(true);
          const bounds = new THREE.Box3();
          let boneCount = 0;
          const v = new THREE.Vector3();
          model.traverse((obj) => {
            if ((obj as THREE.Bone).isBone) {
              boneCount += 1;
              bounds.expandByPoint(obj.getWorldPosition(v));
            }
          });
          if (boneCount === 0) bounds.setFromObject(model); // static model fallback
          const size = bounds.getSize(new THREE.Vector3());
          // Bones stop at joints (skull base, ankles) — pad for head/feet flesh
          let height = Math.max(size.y, 0.0001) * (boneCount > 0 ? 1.18 : 1);
          if (!Number.isFinite(height) || height < 1e-4) {
            bounds.setFromObject(model);
            const meshSize = bounds.getSize(new THREE.Vector3());
            height = Math.max(meshSize.y, 1);
          }
          if (idleAction) {
            mixer.stopAllAction();
            // Desync idle cycles so a full crew doesn't breathe in lockstep
            idleAction.time = Math.random() * idleClip!.duration;
          }

          // Authored walk ground coverage (body-heights/sec) for timeScale
          const strideLocal = walkClip ? clipStrideLocal.get(walkClip) ?? 0 : 0;
          const strideModelUnits = strideLocal * hipsParentScale;
          const strideFraction = strideModelUnits / height;
          const walkStrideHeightsPerSec =
            walkClip && strideFraction > 0.08
              ? strideFraction / walkClip.duration
              : FALLBACK_STRIDE_HEIGHTS_PER_SEC;
          console.info(
            `CrewDeck3D[${zone}]: "${character.name}" idle="${idleClip?.name ?? 'none'}", ` +
              `walk="${walkClip?.name ?? 'none'}" (stride ${walkStrideHeightsPerSec.toFixed(2)} heights/s` +
              `${strideFraction > 0.08 ? ', measured' : ', fallback'}), ` +
              `wave="${waveClip?.name ?? waveAction?.getClip().name ?? 'none'}", ` +
              `talk="${talkClip?.name ?? talkAction?.getClip().name ?? 'none'}", ` +
              `dance="${danceClip?.name ?? 'none'}", ` +
              `flightPath="${flightPathClip?.name ?? 'none'}"`,
          );

          const inner = new THREE.Group();
          inner.add(model);
          model.position.set(
            -(bounds.min.x + size.x / 2),
            -bounds.min.y,
            -(bounds.min.z + size.z / 2),
          );
          inner.scale.setScalar(1 / height);

          addFigure(
            character,
            charIndex,
            inner,
            materials,
            mixer,
            idleAction,
            walkAction,
            danceAction,
            waveAction,
            talkAction,
            variationActions,
            walkStrideHeightsPerSec,
            flightPathAction,
          );
        })
        .catch((err) => {
          console.warn('CrewDeck3D: failed to load model', character.modelUrl, err);
          void mountBillboard(character, charIndex).catch((stillErr) => {
            console.warn('CrewDeck3D: still fallback failed', character.imageUrl, stillErr);
          });
        });
    });

    /* ---- jukebox party: everyone dances (looping) until partyUntil ------- */

    danceAllFnRef.current = (durationMs: number) => {
      let joined = 0;
      for (const f of figures) {
        const dance =
          f.danceAction ||
          f.variationActions.find((a) => isDanceClip(a.getClip())) ||
          f.variationActions[0] ||
          null;
        if (!dance) continue;
        if (
          f.mode !== 'idle' &&
          f.mode !== 'variation' &&
          f.mode !== 'walking' &&
          f.mode !== 'dancing' &&
          f.mode !== 'talking' &&
          f.mode !== 'guided'
        ) {
          continue; // exiting/away/emerging characters sit this one out
        }
        f.legs = [];
        f.guide = null; // a tour walk must not resume mid-party
        f.mode = 'dancing';
        f.targetHeading = 0;
        // Loop the clip so everyone keeps dancing for the whole party
        dance.setLoop(THREE.LoopRepeat, Infinity);
        dance.clampWhenFinished = false;
        startAction(f, dance);
        joined += 1;
      }
      if (joined === 0) return false;
      partyUntil = performance.now() + durationMs;
      danceMusic.start();
      console.info(`CrewDeck3D[${zone}]: party started — ${joined} dancing`);
      return true;
    };

    waveAllFnRef.current = () => {
      const ready = figures.filter((f) => {
        const action = f.waveAction || f.variationActions[0] || null;
        if (!action) return false;
        return (
          f.mode === 'idle' ||
          f.mode === 'variation' ||
          f.mode === 'walking'
        );
      });
      if (ready.length === 0) return false;
      ready.forEach((f, i) => {
        const action = f.waveAction || f.variationActions[0];
        if (!action) return;
        const start = () => {
          if (
            f.mode !== 'idle' &&
            f.mode !== 'variation' &&
            f.mode !== 'walking'
          ) {
            return;
          }
          f.legs = [];
          f.mode = 'variation';
          f.targetHeading = 0;
          playOneShot(f, action);
        };
        if (i === 0) start();
        else window.setTimeout(start, i * 180);
      });
      console.info(`CrewDeck3D[${zone}]: wave greeting — ${ready.length}`);
      return true;
    };

    /** Can this figure be steered / told to talk right now? */
    const steerable = (f: Figure | undefined): f is Figure =>
      !!f &&
      f.mode !== 'gone' &&
      f.mode !== 'exiting' &&
      f.mode !== 'away' &&
      f.mode !== 'emerging';

    /** Face the camera and loop the talking clip (chat open / tour beat). */
    const beginTalking = (f: Figure): boolean => {
      const action =
        f.talkAction || f.waveAction || f.variationActions[0] || f.idleAction;
      if (!action) return false;
      f.legs = [];
      f.guide = null;
      f.strollStopsLeft = 0;
      f.mode = 'talking';
      f.targetHeading = 0;
      if (f.walkAction) f.walkAction.timeScale = 1;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      startAction(f, action);
      console.info(`CrewDeck3D[${zone}]: "${f.character.name}" talking`);
      return true;
    };

    talkFnRef.current = (characterId: string) => {
      const f = figures.find((fig) => fig.character.id === characterId);
      if (!steerable(f)) return false;
      return beginTalking(f);
    };

    stopTalkFnRef.current = (characterId?: string) => {
      const now = performance.now();
      for (const f of figures) {
        if (f.mode !== 'talking' && f.mode !== 'guided') continue;
        if (characterId && f.character.id !== characterId) continue;
        f.guide = null;
        f.legs = [];
        goIdle(f, now);
      }
    };

    walkToFnRef.current = (characterId, spot, onArrive) => {
      const f = figures.find((fig) => fig.character.id === characterId);
      if (!steerable(f) || f.flyer) return false;
      stopPartyFnRef.current?.();
      const target = imgToScreen(spot);
      if (Math.hypot(target.x - f.pos.x, target.y - f.pos.y) < 0.012) {
        // Already standing there — just turn and talk.
        beginTalking(f);
        onArrive();
        return true;
      }
      const legs = buildRoute(f.pos, target) ?? [{ to: target, stair: false }];
      f.legs = [];
      f.strollStopsLeft = 0;
      f.stairHolding = false;
      f.mode = 'guided';
      f.guide = { legs, onArrive };
      startAction(f, f.walkAction ?? f.idleAction);
      return true;
    };

    const endParty = (now: number) => {
      if (partyUntil === 0) return;
      partyUntil = 0;
      danceMusic.stop();
      for (const f of figures) {
        if (f.mode === 'dancing') goIdle(f, now);
      }
      console.info(`CrewDeck3D[${zone}]: party ended`);
    };
    stopPartyFnRef.current = () => endParty(performance.now());

    descendFnRef.current = (characterId: string, onDone: () => void) => {
      if (!hatchApproach || !hatchCenter) return false;
      const f = figures.find((fig) => fig.character.id === characterId);
      if (!f || f.flyer) return false;
      if (f.mode === 'gone' || f.mode === 'exiting' || f.mode === 'away' || f.mode === 'emerging') {
        return false;
      }
      beginExit(f, hatchApproach, hatchCenter, 1, () => {
        // Manual descent: the page navigates to the basement next, so mark
        // him below with a fresh stay window and stop simulating him here.
        setCrewLocation(f.character.id, {
          loc: 'basement',
          returnAt: Date.now() + stayMs(),
        });
        f.mode = 'gone';
        onDone();
      });
      return true;
    };

    // Tap → raycast: character hit → action menu anchor; empty art → dismiss
    const raycaster = new THREE.Raycaster();

    /** Tappable figure under a viewport point (CSS px), or null. */
    const tappable = (f: Figure | undefined): f is Figure =>
      !!f &&
      (f.mode === 'idle' ||
        f.mode === 'variation' ||
        f.mode === 'walking' ||
        f.mode === 'dancing' ||
        f.mode === 'talking');

    const figureAtPoint = (clientX: number, clientY: number): Figure | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const id = obj.userData?.characterId as string | undefined;
          if (id) {
            const f = figures.find((fig) => fig.character.id === id);
            return tappable(f) ? f : null;
          }
          obj = obj.parent;
        }
      }
      // Skinned meshes are skinny — if the ray missed, take the nearest
      // character whose on-screen body covers this tap.
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      let nearest: Figure | null = null;
      let nearestD = Infinity;
      for (const f of figures) {
        if (!tappable(f)) continue;
        const feetX = f.pos.x * viewW;
        const feetY = f.pos.y * viewH;
        const h = sizedHeight(f);
        const liftPx = f.flyer ? parrotLiftPx(f) : 0;
        const dx = localX - feetX;
        const dy = localY - (feetY - liftPx - h * 0.45);
        const d = Math.hypot(dx, dy);
        if (d < h * 0.55 && d < nearestD) {
          nearest = f;
          nearestD = d;
        }
      }
      return nearest;
    };

    hitTestFnRef.current = (clientX, clientY) => {
      const f = figureAtPoint(clientX, clientY);
      return f ? { character: f.character, anchor: anchorFor(f) } : null;
    };

    anchorFnRef.current = (characterId?: string) => {
      const f = characterId
        ? figures.find((fig) => fig.character.id === characterId)
        : figures[0];
      return f ? anchorFor(f) : null;
    };

    feetFnRef.current = () =>
      figures
        .filter((f) => f.mode !== 'away' && f.mode !== 'gone')
        .map((f) => ({ x: f.pos.x * viewW, y: f.pos.y * viewH }));

    // DEV ONLY: expose foot positions + radii so headless tests can assert
    // characters never overlap while wandering. Gated like debugCrewZones.
    if (localStorage.getItem('debugCrewFeet')) {
      (
        window as unknown as {
          __crewFeet?: () => {
            x: number;
            y: number;
            r: number;
            mode: string;
            ghost: boolean;
          }[];
        }
      ).__crewFeet = () =>
        figures
          .filter((f) => f.mode !== 'away' && f.mode !== 'gone')
          .map((f) => ({
            x: f.pos.x * viewW,
            y: f.pos.y * viewH,
            r: radiusPx(f),
            mode: f.mode,
            // Fading through the hatch / rising half-transparent — these
            // legitimately share space with solid characters briefly.
            ghost:
              f.mode === 'emerging' ||
              (f.mode === 'exiting' && f.exit?.phase !== 'approach'),
          }));
    }

    const onPointerDown = (ev: PointerEvent) => {
      const f = figureAtPoint(ev.clientX, ev.clientY);
      if (f) {
        onTapRef.current?.(f.character, anchorFor(f));
        return;
      }
      onDeckTapRef.current?.();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    /** Depth separation multiplier for z-sorting characters front-to-back. */
    const Z_DEPTH = 800;

    /** Move feet toward a target; returns [arrived, pxSpeed]. */
    const stepToward = (f: Figure, target: Pt, speedNorm: number, dt: number) => {
      const dx = target.x - f.pos.x;
      const dy = target.y - f.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.008) return { arrived: true, pxSpeed: 0 };
      const step = Math.min(speedNorm * dt, dist);
      const nx = (dx / dist) * step;
      const ny = (dy / dist) * step;
      f.pos.x += nx;
      f.pos.y += ny;
      f.targetHeading = Math.atan2(dx, dy * 1.4);
      const pxSpeed = dt > 0 ? Math.hypot(nx * viewW, ny * viewH) / dt : 0;
      return { arrived: false, pxSpeed };
    };

    /**
     * Match walk-cycle playback to actual ground speed, boosted for brisk
     * cartoon leg cadence (foot-skating fix + busy-little-character energy).
     */
    const matchStride = (f: Figure, pxSpeed: number, heightPx: number) => {
      if (!f.walkAction) return;
      const authoredPxPerSec = f.walkStrideHeightsPerSec * heightPx;
      if (authoredPxPerSec <= 0) return;
      f.walkAction.timeScale = Math.min(
        3.0,
        Math.max(0.5, (WALK_CADENCE_BOOST * pxSpeed) / authoredPxPerSec),
      );
    };

    /* ---- character-vs-character avoidance --------------------------------
     * Each character is a soft circle whose radius scales with his rendered
     * height (perspective depth). Walkers steer around anyone inside the
     * circle via a repulsion vector blended into the seek direction; mutual
     * walkers break ties deterministically (higher character id yields) so
     * two approaching characters never mirror-dance forever. Stairs are
     * single-file: a walker holds at the base while someone else is on one.
     * -------------------------------------------------------------------- */

    /** Personal-space radius in px at the character's current depth. */
    const radiusPx = (f: Figure) => sizedHeight(f) * 0.17;

    /**
     * Figures that occupy floor space — idlers block walkers, and so do
     * scripted walkers (hatch-bound 'exiting' before their fade starts, and
     * 'emerging' risers), otherwise wanderers pass straight through them.
     */
    const solidFigures = (self: Figure) =>
      figures.filter(
        (o) =>
          o !== self &&
          !o.flyer &&
          (o.mode === 'idle' ||
            o.mode === 'variation' ||
            o.mode === 'walking' ||
            o.mode === 'guided' ||
            o.mode === 'dancing' ||
            o.mode === 'talking' ||
            o.mode === 'emerging' ||
            (o.mode === 'exiting' && o.exit?.phase === 'approach')),
      );

    /** Standable check that works on both the main deck and platforms. */
    const standableAt = (p: Pt) =>
      levelOf(p) !== 'main' ? true : isStandableMain(p);

    /**
     * One walk-step of local avoidance toward realTarget. Works on a
     * BOUNDED seek vector so the repulsion can actually out-muscle it at
     * close range (adding push to the raw far-away target vector barely
     * bends the course). Each neighbor contributes a radial push away plus
     * a deterministic sideways bias (keyed off character ids) so two
     * head-on walkers curve to opposite sides instead of shoving straight
     * into each other. Returns a steered target + speed multiplier;
     * blocked=true means nose-to-nose contact with a stationary character
     * (caller ends the stroll short of them).
     */
    const avoidanceSteer = (
      f: Figure,
      realTarget: Pt,
    ): { target: Pt; speedMul: number; blocked: boolean } => {
      const px = f.pos.x * viewW;
      const py = f.pos.y * viewH;
      const txFull = realTarget.x * viewW - px;
      const tyFull = realTarget.y * viewH - py;
      const tLen = Math.hypot(txFull, tyFull) || 1;
      const D = Math.min(tLen, 140); // bounded seek magnitude (px)
      const sx = (txFull / tLen) * D;
      const sy = (tyFull / tLen) * D;
      let ax = 0;
      let ay = 0;
      let speedMul = 1;
      for (const o of solidFigures(f)) {
        const dx = px - o.pos.x * viewW;
        const dy = py - o.pos.y * viewH;
        const d = Math.hypot(dx, dy) || 0.001;
        const clearance = radiusPx(f) + radiusPx(o);
        const range = clearance * 2.2; // start bending course well early
        if (d >= range) continue;
        const ahead = -(dx * sx + dy * sy) / (d * D); // 1 = dead ahead
        if (o.mode !== 'walking' && d < clearance * 0.9 && ahead > 0.4) {
          return { target: realTarget, speedMul: 0, blocked: true };
        }
        const w = Math.min(1.2, (1 - d / range) * (ahead > 0 ? 1.6 : 0.5));
        // Radial push away from the neighbor…
        ax += (dx / d) * w * D;
        ay += (dy / d) * w * D;
        // …plus a sideways bias so head-on pairs (whose radial pushes are
        // anti-parallel to their seeks) still slide past each other.
        const side = f.character.id > o.character.id ? 1 : -1;
        ax += (-dy / d) * w * D * 0.5 * side;
        ay += (dx / d) * w * D * 0.5 * side;
        // Two walkers converging: the higher id also slows and yields.
        if (
          o.mode === 'walking' &&
          f.character.id > o.character.id &&
          d < clearance * 1.6 &&
          ahead > 0.2
        ) {
          speedMul = Math.min(speedMul, 0.35);
        }
      }
      if (ax === 0 && ay === 0) return { target: realTarget, speedMul, blocked: false };
      const nx = sx + ax;
      const ny = sy + ay;
      // Probe a short step along the steered course; if it would leave the
      // walkable area / enter a prop, keep the original line but slow down.
      const nLen = Math.hypot(nx, ny) || 1;
      const probe = {
        x: f.pos.x + ((nx / nLen) * 20) / viewW,
        y: f.pos.y + ((ny / nLen) * 20) / viewH,
      };
      if (!standableAt(probe)) {
        return { target: realTarget, speedMul: Math.min(speedMul, 0.35), blocked: false };
      }
      return {
        target: { x: f.pos.x + nx / viewW, y: f.pos.y + ny / viewH },
        speedMul,
        blocked: false,
      };
    };

    /**
     * True when another character is actively climbing a stair nearby —
     * hold at the base until they're off. `stairHolding` excludes waiting
     * characters from counting as climbers, so two arrivals can't deadlock.
     */
    const stairBusy = (f: Figure) =>
      figures.some(
        (o) =>
          o !== f &&
          o.mode === 'walking' &&
          o.legs[0]?.stair &&
          !o.stairHolding &&
          Math.hypot(
            (o.pos.x - f.pos.x) * viewW,
            (o.pos.y - f.pos.y) * viewH,
          ) <
            (radiusPx(f) + radiusPx(o)) * 3.2,
      );

    /**
     * Advance along a leg queue; returns true when the queue is finished.
     * avoid modes: 'none' (scripted straight line), 'full' (wandering —
     * steer, yield, stop short of blockers, single-file stairs), 'steer'
     * (scripted exits — bend around people but never stop or hold, so the
     * timed hatch descent always completes).
     */
    const walkLegs = (
      f: Figure,
      legs: Leg[],
      baseSpeed: number,
      dt: number,
      s: number,
      avoid: 'none' | 'full' | 'steer' = 'none',
    ) => {
      const leg = legs[0];
      if (!leg) return true;
      if (avoid === 'full' && leg.stair) {
        if (stairBusy(f)) {
          f.stairHolding = true;
          matchStride(f, 0, s); // mark time at the stair base
          return false;
        }
        f.stairHolding = false;
      }
      const speed =
        baseSpeed * depthScale(f.pos.y) * (leg.stair ? STAIR_SPEED_MULT : 1);
      let target = leg.to;
      let speedMul = 1;
      if (avoid !== 'none' && !leg.stair) {
        const steer = avoidanceSteer(f, leg.to);
        if (steer.blocked) {
          if (avoid === 'full') {
            // Someone is standing dead-center in the way at contact range —
            // stop the stroll right here, short of them (no overlap).
            legs.length = 0;
            return true;
          }
          // 'steer': scripted exits keep their timing — walk the original
          // line (a brief brush past is better than a stuck descent).
        } else {
          target = steer.target;
          speedMul = steer.speedMul;
        }
      }
      const { pxSpeed } = stepToward(f, target, speed * speedMul, dt);
      matchStride(f, pxSpeed, s);
      // Arrival is judged against the REAL waypoint (steering offsets the
      // per-frame course, not the destination).
      const arrived =
        Math.hypot(leg.to.x - f.pos.x, leg.to.y - f.pos.y) < 0.008;
      if (arrived) {
        legs.shift();
        return legs.length === 0;
      }
      return false;
    };

    const stepParrot = (f: Figure, dt: number, now: number) => {
      const flyClip = f.walkAction;
      const path = f.flightPathAction;
      const sit = (perch: { x: number; y: number; heading: number }) => {
        f.mode = 'idle';
        f.pos.x += (perch.x - f.pos.x) * Math.min(1, dt * 8);
        f.pos.y += (perch.y - f.pos.y) * Math.min(1, dt * 8);
        f.flightAlt += (0 - f.flightAlt) * Math.min(1, dt * 7);
        f.flightPitch = 0;
        f.flightFrom = null;
        f.targetHeading = perch.heading;
        if (path) {
          path.stop();
          path.time = 0;
        }
        if (flyClip) {
          flyClip.setLoop(THREE.LoopRepeat, Infinity);
          flyClip.paused = true;
          flyClip.time = 0;
          if (!flyClip.isRunning()) flyClip.play();
          f.currentAction = flyClip;
        }
      };
      // Stay perched on the current spot until the stay is over.
      if (now < f.flightPerchedUntil) {
        sit(parrotPerch(f.flightLeg));
        return;
      }
      // The stay just ended and we're still on that spot — take off for the next one.
      // flightPerchedUntil === 0 means a lap is already in progress.
      const here = parrotPerch(f.flightLeg);
      const hereDist = Math.hypot(here.x - f.pos.x, here.y - f.pos.y);
      if (f.flightPerchedUntil !== 0 && hereDist < 0.05 && f.flightAlt < 0.25 && !f.flightFrom) {
        f.flightFrom = { x: f.pos.x, y: f.pos.y };
        f.flightLeg = (f.flightLeg + 1) % PARROT_PERCHES.length;
        f.flightPerchedUntil = 0;
        if (path) {
          path.paused = false;
          path.enabled = true;
          path.setLoop(THREE.LoopOnce, 1);
          path.clampWhenFinished = true;
          path.timeScale = 1;
          path.reset();
          path.setEffectiveWeight(1);
          path.play();
          if (flyClip && flyClip !== path) flyClip.stop();
          f.currentAction = path;
        }
      }
      const dest = parrotPerch(f.flightLeg);
      // Authored Flight Path: the armature swoops and banks, then returns
      // to the origin. Slide the bird to the next perch across that lap.
      if (path && f.flightFrom) {
        const dur = Math.max(path.getClip().duration, 0.001);
        const p = Math.min(1, path.time / dur);
        f.mode = 'walking';
        f.flightAlt = 0;
        f.flightPitch = 0;
        f.pos.x = f.flightFrom.x + (dest.x - f.flightFrom.x) * p;
        f.pos.y = f.flightFrom.y + (dest.y - f.flightFrom.y) * p;
        // Keep the bird facing the camera so the authored left/right swoop
        // stays on screen instead of turning into depth.
        f.targetHeading = 0;
        if (!path.isRunning()) path.play();
        if (p >= 0.985) {
          f.pos.x = dest.x;
          f.pos.y = dest.y;
          f.flightPerchedUntil = now + PARROT_SIT_MS;
          sit(dest);
        }
        return;
      }
      const dx = dest.x - f.pos.x;
      const dy = dest.y - f.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.03 && f.flightAlt < 0.2) {
        f.flightPerchedUntil = now + PARROT_SIT_MS;
        sit(dest);
        return;
      }
      f.mode = 'walking';
      if (flyClip) {
        flyClip.paused = false;
        flyClip.setLoop(THREE.LoopRepeat, Infinity);
        flyClip.clampWhenFinished = false;
        flyClip.timeScale = 1.65;
        if (!flyClip.isRunning()) flyClip.play();
        f.currentAction = flyClip;
      }
      const nd = dist || 1;
      const step = Math.min(PARROT_ZOOM * dt, nd);
      f.pos.x += (dx / nd) * step;
      f.pos.y += (dy / nd) * step;
      f.targetHeading = Math.atan2(dx, dy * 1.4);
      // High while crossing, then drop onto the spot as it gets close.
      const wantAlt = dist > 0.12 ? PARROT_CRUISE_ALT : Math.max(0.05, dist * 8);
      const altGap = wantAlt - f.flightAlt;
      const altStep = Math.min(3.2 * dt, Math.abs(altGap));
      if (altStep > 0) f.flightAlt += Math.sign(altGap) * altStep;
    };

    const clock = new THREE.Clock();
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const now = performance.now();
      const epochNow = Date.now();
      const isPaused = pausedRef.current;

      // Jukebox party over → fade the tune and send everyone back to idle
      if (partyUntil > 0 && now >= partyUntil) endParty(now);

      for (const f of figures) {
        if (f.mode === 'gone') continue;
        if (f.mode === 'away') {
          // Below deck while this page stays put — rise when the stay ends.
          if (zone === 'deck' && hatchCenter && epochNow >= f.emergeAt) {
            beginEmerge(f, now);
          }
          continue;
        }

        const s = sizedHeight(f);
        let lift = 0; // world-y offset in px (negative = below the floor line)
        let shadowMul = 1;

        if (f.mode === 'exiting' && f.exit) {
          const e = f.exit;
          if (e.phase === 'approach') {
            if (walkLegs(f, e.legs, DESCEND_SPEED / depthScale(f.pos.y), dt, s, 'steer')) {
              e.phase = 'fade';
              e.fadeStart = now;
              e.fadeFrom = { ...f.pos };
              if (e.driftTo) {
                f.targetHeading = Math.atan2(
                  e.driftTo.x - f.pos.x,
                  (e.driftTo.y - f.pos.y) * 1.4,
                );
              }
            }
          } else {
            const p = Math.min(1, (now - e.fadeStart) / SINK_MS);
            e.p = p;
            if (e.driftTo) {
              f.pos.x = e.fadeFrom.x + (e.driftTo.x - e.fadeFrom.x) * p;
              f.pos.y = e.fadeFrom.y + (e.driftTo.y - e.fadeFrom.y) * p;
            }
            setFigureOpacity(f, 1 - p);
            lift = e.dir === 1 ? -p * s * 1.05 : p * s * 0.35;
            shadowMul = 1 - p * 0.6;
            if (p >= 1) {
              f.group.visible = false;
              f.shadow.visible = false;
              const done = e.onDone;
              e.onDone = null;
              f.exit = null;
              if (f.mode === 'exiting') f.mode = 'gone'; // onDone may override
              done?.();
            }
          }
        } else if (f.mode === 'emerging') {
          const p = Math.min(1, (now - f.emergeT0) / SINK_MS);
          const c = hatchCenter!;
          const a = hatchApproach!;
          f.pos.x = c.x + (a.x - c.x) * p;
          f.pos.y = c.y + (a.y - c.y) * p;
          setFigureOpacity(f, p);
          lift = -(1 - p) * s * 1.05;
          shadowMul = 0.4 + p * 0.6;
          if (p >= 1) {
            setFigureOpacity(f, 1);
            setCrewLocation(f.character.id, { loc: 'deck' });
            f.tripAt = epochNow + tripDelayMs();
            goIdle(f, now);
            // If someone happens to be standing at the hatch mouth, stroll
            // away quickly instead of idling on top of them.
            const crowded = solidFigures(f).some(
              (o) =>
                Math.hypot(
                  (o.pos.x - f.pos.x) * viewW,
                  (o.pos.y - f.pos.y) * viewH,
                ) <
                (radiusPx(f) + radiusPx(o)) * 1.2,
            );
            if (crowded) f.idleUntil = now + 500;
          }
        } else if (f.flyer) {
          const showingOff = f.mode === 'talking' || f.mode === 'dancing';
          if (showingOff) {
            f.flightPitch += (0 - f.flightPitch) * Math.min(1, dt * 5);
          } else if (!isPaused) {
            stepParrot(f, dt, now);
            // Flight Path carries its own bank. The extra pitch is only for
            // the in-place Flying fallback, which is authored upright.
            const airborne =
              !f.flightFrom && f.flightAlt > 0.28 && now >= f.flightPerchedUntil;
            const targetPitch = airborne ? Math.PI / 2 : 0;
            // Settle upright quickly once the feet are on the dowel.
            const pitchRate = airborne ? 5 : 14;
            f.flightPitch += (targetPitch - f.flightPitch) * Math.min(1, dt * pitchRate);
          }
          lift = parrotLiftPx(f);
          // Keep the beak on screen when the lap climbs over the bow.
          const maxLift = Math.max(0, f.pos.y * viewH - s - 28);
          lift = Math.min(lift, maxLift);
          shadowMul = 1 - Math.min(1, f.flightAlt / 2.2) * 0.72;
        } else if (f.mode === 'guided' && f.guide) {
          // Tour walk: keep timing (steer around people, never hold), then
          // turn to the camera in the talking pose and tell the page.
          if (walkLegs(f, f.guide.legs, GUIDE_SPEED, dt, s, 'steer')) {
            const onArrive = f.guide.onArrive;
            f.guide = null;
            if (!beginTalking(f)) goIdle(f, now);
            onArrive?.();
          }
        } else if (f.mode === 'walking') {
          if (isPaused) {
            // Menu/chat opened mid-stroll: stop where he is
            f.strollStopsLeft = 0;
            f.legs = [];
            goIdle(f, now);
          } else if (walkLegs(f, f.legs, WALK_SPEED, dt, s, 'full')) {
            f.strollStopsLeft -= 1;
            if (f.strollStopsLeft <= 0 || !startStrollTo(f)) {
              goIdle(f, now);
            }
          }
        } else if (f.mode === 'idle' && !isPaused) {
          if (zone === 'deck' && hatchApproach && epochNow >= f.tripAt) {
            // Autonomous basement trip: sink into the hatch, page stays put.
            beginExit(f, hatchApproach, hatchCenter, 1, () => {
              const returnAt = Date.now() + stayMs();
              setCrewLocation(f.character.id, { loc: 'basement', returnAt });
              f.mode = 'away';
              f.emergeAt = returnAt;
            });
          } else if (zone === 'basement' && spawnPt && epochNow >= f.departAt) {
            // Stay is over — head back up the stairs and fade away.
            beginExit(f, spawnPt, null, -1, () => {
              setCrewLocation(f.character.id, { loc: 'deck' });
            });
          } else if (f.variationActions.length > 0 && now >= f.nextVariationAt) {
            f.mode = 'variation';
            const variation =
              f.variationActions[
                Math.floor(Math.random() * f.variationActions.length)
              ];
            playOneShot(f, variation);
          } else if (now >= f.idleUntil) {
            f.strollCount += 1;
            f.strollStopsLeft = Math.floor(rand(1, 4)); // 1–3 destinations
            if (!startStrollTo(f)) goIdle(f, now);
          }
        }

        // Smooth heading — no snapping when direction / mode changes
        const turn = wrapAngle(f.targetHeading - f.heading);
        f.heading += turn * Math.min(1, dt / TURN_SMOOTHING);
        f.group.rotation.y = f.heading;

        if (f.flyer) {
          // Pitch around the chest so a +90° roll lays the belly on the deck
          // and the beak points along the lap, without swinging through the floor.
          const pivotY = 0.34;
          const pitch = f.flightPitch;
          const cos = Math.cos(pitch);
          const sin = Math.sin(pitch);
          f.inner.rotation.x = pitch;
          f.inner.rotation.z = 0;
          f.inner.position.set(0, pivotY * (1 - cos), -pivotY * sin);
        }

        // Still uploads (no walk clip): bob + lean + sway while the scene
        // translates them. Built-in clip walkers never enter this path.
        let procBob = 0;
        if (f.usesProceduralWalk) {
          const locomoting =
            f.mode === 'walking' ||
            f.mode === 'guided' ||
            f.mode === 'emerging' ||
            (f.mode === 'exiting' && f.exit?.phase === 'approach');
          if (locomoting) {
            f.walkPhase += dt * PROC_WALK_CADENCE;
            const step = Math.sin(f.walkPhase);
            procBob = Math.abs(step) * s * PROC_WALK_BOB;
            f.inner.rotation.z = step * PROC_WALK_SWAY;
            f.inner.rotation.x = PROC_WALK_LEAN + Math.abs(step) * 0.03;
          } else {
            f.inner.rotation.z *= 0.82;
            f.inner.rotation.x *= 0.82;
            if (Math.abs(f.inner.rotation.z) < 0.002) f.inner.rotation.z = 0;
            if (Math.abs(f.inner.rotation.x) < 0.002) f.inner.rotation.x = 0;
            if (!f.idleAction && (f.mode === 'idle' || f.mode === 'dancing')) {
              procBob = Math.sin(now * 0.0035) * s * 0.018;
            }
          }
        }

        const world = toWorld(f.pos.x, f.pos.y, f.pos.y * Z_DEPTH);
        world.y += lift + procBob;
        f.group.position.copy(world);
        f.group.scale.setScalar(s);

        // Blob shadow follows the feet and shrinks with depth / exits
        f.shadow.position.set(
          f.pos.x * viewW - viewW / 2,
          viewH / 2 - f.pos.y * viewH - s * 0.02,
          f.pos.y * Z_DEPTH - 2,
        );
        f.shadow.scale.set(s * 0.62 * shadowMul, s * 0.16 * shadowMul, 1);

        f.mixer.update(dt);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      danceMusic.stop(); // page navigation / re-mount ends any dance tune
      danceAllFnRef.current = null;
      waveAllFnRef.current = null;
      talkFnRef.current = null;
      stopTalkFnRef.current = null;
      stopPartyFnRef.current = null;
      walkToFnRef.current = null;
      descendFnRef.current = null;
      hitTestFnRef.current = null;
      feetFnRef.current = null;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', applySize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      occluderEls.forEach((el) => el.remove());
      figures.forEach((f) => {
        f.mixer.stopAllAction();
        scene.remove(f.group);
        scene.remove(f.shadow);
      });
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      shadowTexture.dispose();
      shadowGeo.dispose();
      dracoLoader.dispose();
      envMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (characters.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-[5]"
      aria-hidden
      data-testid="crew-deck-3d"
    />
  );
});

export default CrewDeck3D;
