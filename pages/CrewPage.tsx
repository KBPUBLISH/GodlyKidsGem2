import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import {
  MAX_CREW,
  rewardsService,
  type UnlockedCharacter,
} from '../services/rewardsService';
import CrewPickerDropdown from '../components/rewards/CrewPickerDropdown';
import CrewChatPopup from '../components/crew/CrewChatPopup';
import type { CrewDeckHandle } from '../components/crew/CrewDeck3D';
import { BASEMENT_CHARACTER_KEY } from '../components/crew/basementCharacter';
import { danceMusic } from '../services/danceMusicService';

// three.js deck is lazy-loaded so the ~600KB 3D chunk only downloads when a
// crew character actually has a GLB model.
const CrewDeck3D = React.lazy(() => import('../components/crew/CrewDeck3D'));

/** Ship deck art with a transparent sky — layered over the sky slot below. */
const CREW_SHIP_DECK_SHIP = '/assets/images/crew-ship-deck-ship.png';

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
/** Shared wood texture — matches Sail “Travel Here” plaque. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

/** Hatch open hint before white fade. */
const HATCH_OPEN_MS = 320;
/** White fade-out duration before basement navigate. */
const WHITE_FADE_MS = 480;
const NAVIGATE_AFTER_MS = HATCH_OPEN_MS + WHITE_FADE_MS;

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
 * story Rewards loot boxes: characters with a GLB modelUrl stand idle in 3D
 * (CrewDeck3D); tapping one opens the AI chat popup directly. The rest stand
 * as 2D avatars (image + name plaque) that also open chat on tap. Dancing
 * happens only via the jukebox party (everyone dances for 8s).
 * Wheel (bottom-left) returns to sail; open hatch → white fade → basement.
 * Crew button (bottom-right) opens the roster picker.
 */
const CrewPage: React.FC = () => {
  const navigate = useNavigate();
  const [hatchOpen, setHatchOpen] = useState(false);
  const [whiteFade, setWhiteFade] = useState(false);
  const [crew, setCrew] = useState<UnlockedCharacter[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const jukeboxArtRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const enteringRef = useRef(false);
  const reduceMotion = prefersReducedMotion();

  // Crew on deck: characters unlocked from story Rewards loot boxes.
  // If the kid picked a crew roster, show that; otherwise all unlocked.
  const loadCrew = useCallback(() => {
    const characters = rewardsService.getUnlockedCharacters();
    const selected = rewardsService.getSelectedCrewIds();
    const roster = selected.length
      ? characters.filter((c) => selected.includes(c.id))
      : characters;
    let onDeck = roster.slice(0, MAX_CREW);
    // DEV ONLY debug hook: `localStorage.debugCrewModelUrl = '/models/x.glb'`
    // forces a modelUrl onto the first on-deck character so the 3D deck can be
    // tested before CMS characters carry real modelUrls. Remove when live.
    const debugModelUrl = localStorage.getItem('debugCrewModelUrl');
    if (debugModelUrl && onDeck.length > 0 && !onDeck.some((c) => c.modelUrl)) {
      onDeck = onDeck.map((c, i) =>
        i === 0 ? { ...c, modelUrl: debugModelUrl } : c,
      );
    }
    setCrew(onDeck);
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    loadCrew();
    // Stored characters snapshot CMS data at unlock time; sync current CMS
    // fields (persona/voiceId/modelUrl/image) so chat reflects portal edits.
    void rewardsService.refreshUnlockedCharactersFromCms().then((changed) => {
      if (changed) loadCrew();
    });
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
  }, []);

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

  const goBackToSail = useCallback(() => {
    if (enteringRef.current) return;
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/sail');
    }
  }, [navigate]);

  /** Hatch-open hint → white fade → navigate. (Runs after any 3D descent.) */
  const beginHatchTransition = useCallback(() => {
    clearTimers();

    if (reduceMotion) {
      setHatchOpen(true);
      setWhiteFade(true);
      const id = window.setTimeout(() => navigate('/sail/basement'), 80);
      timersRef.current = [id];
      return;
    }

    setHatchOpen(true);
    const fadeId = window.setTimeout(() => setWhiteFade(true), HATCH_OPEN_MS);
    const navId = window.setTimeout(() => navigate('/sail/basement'), NAVIGATE_AFTER_MS);
    timersRef.current = [fadeId, navId];
  }, [clearTimers, navigate, reduceMotion]);

  const crew3d = crew.filter((c) => !!c.modelUrl);

  /**
   * Depth-layer the jukebox art against the walking 3D crew: a character
   * whose feet are BELOW the jukebox base (closer to camera) and horizontally
   * overlapping it must draw on top, so the art drops below the character
   * canvas (z-5) for that frame; with everyone behind/away it sits back
   * above the canvas so the mast-side placement occludes correctly. If
   * several characters straddle it, any one in front keeps the art behind
   * (least glitchy). Mutates style directly — no per-frame re-renders.
   */
  useEffect(() => {
    if (crew3d.length === 0) return;
    let raf = 0;
    const tick = () => {
      const el = jukeboxArtRef.current;
      const deck = deckRef.current;
      if (el && deck) {
        const r = el.getBoundingClientRect();
        const inFront = deck.feetPositions().some(
          (f) =>
            f.y > r.bottom - 4 && // feet lower on screen than the jukebox base
            f.y < r.bottom + 190 && // …but near enough to visually overlap it
            f.x > r.left - 14 &&
            f.x < r.right + 14,
        );
        const z = inFront ? '4' : '6';
        if (el.style.zIndex !== z) el.style.zIndex = z;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [crew3d.length]);

  const enterBasement = useCallback(() => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    endParty(); // hatch descent cancels a running jukebox party

    // With a 3D character on deck, he walks to the hatch and climbs down
    // first; the white-fade transition fires once he's disappeared inside.
    const walker = crew3d[0];
    if (walker && !reduceMotion) {
      const started = deckRef.current?.descendIntoHatch(walker.id, beginHatchTransition);
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
    beginHatchTransition();
  }, [beginHatchTransition, crew3d, endParty, reduceMotion]);
  const crew2d = crew.filter((c) => !c.modelUrl);

  /**
   * Hatch tap. The invisible tap target sits above the 3D canvas, so first
   * raycast for a character under the pointer — if the walker is standing
   * on/next to the hatch, tapping him opens his action menu instead of
   * triggering the descent.
   */
  /** Tap on a character → AI chat directly (dancing is jukebox-only now). */
  const openChat = useCallback(
    (character: UnlockedCharacter) => {
      endParty(); // chat opening cancels a jukebox party…
      danceMusic.stop(); // …and silences any lingering tune
      setChatCharacter(character);
    },
    [endParty],
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

  /**
   * Jukebox tap. Like the hatch, its hit area floats above the 3D canvas —
   * if a crew member is standing right in front of it, tapping THEM opens
   * chat; tapping the jukebox itself starts the party.
   */
  const onJukeboxTap = useCallback(
    (e: React.MouseEvent) => {
      const hit = deckRef.current?.characterAt(e.clientX, e.clientY);
      if (hit) {
        openChat(hit.character);
        return;
      }
      startParty();
    },
    [openChat, startParty],
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Sky/ocean slot — animated CSS scene behind the transparent ship art
          (drifting cloud marquees, bobbing wave bands, sparkle drift). An
          animated sky <video> can still replace this whole slot later. */}
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

      {/* Jukebox party: night falls over the sky/ocean layers only — the ship
          art renders above this, so deck + characters stay lit. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(7,9,40,0.9) 0%, rgba(6,10,36,0.78) 30%, rgba(4,12,32,0.6) 100%)',
          opacity: party ? 1 : 0,
          transition: reduceMotion ? 'none' : 'opacity 500ms ease',
        }}
      />
      {/* Transparent-sky ship art — same object-cover mapping the zone config
          in CrewDeck3D relies on for image→screen coordinate alignment. */}
      <img
        src={CREW_SHIP_DECK_SHIP}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />

      {/* 3D crew — characters with a GLB model stand idle on the deck.
          Tap → AI chat popup (dancing is jukebox-only). */}
      {crew3d.length > 0 && (
        <Suspense fallback={null}>
          <CrewDeck3D
            ref={deckRef}
            characters={crew3d}
            paused={!!chatCharacter}
            onCharacterTap={(character) => openChat(character)}
          />
        </Suspense>
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
              onClick={() => setChatCharacter(c)}
              aria-label={`Chat with ${c.name}`}
              className="flex flex-col items-center select-none pointer-events-auto p-0 m-0 border-0 bg-transparent appearance-none cursor-pointer active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-xl"
              style={{ width: 'clamp(58px, 13vw, 84px)' }}
            >
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

      {/* Open deck hatch — invisible tap target over the glowing hatch art
          (right-mid of deck; image coords ~x 0.66–0.94, y 0.53–0.70, plus a
          small margin). The glow in the art itself is the affordance. Taps
          first raycast for a character (onHatchTap) so the walker standing
          on the hatch still opens his action menu. */}
      <button
        type="button"
        onClick={onHatchTap}
        disabled={hatchOpen}
        aria-label="Open hatch to the basement"
        className="absolute z-20 p-0 m-0 border-0 appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          left: '64%',
          top: '50%',
          width: '34%',
          height: '21%',
          borderRadius: '12%',
          cursor: hatchOpen ? 'default' : 'pointer',
          background: 'transparent',
        }}
      />

      {/* Jukebox — parked at the back of the ship beside the RIGHT staircase
          base (the open pocket between the stair and the stacked rail
          barrels; image coords ~x 0.70, y 0.35), scaled down to match the
          painted perspective at that depth (~0.6× of a front-deck prop). Its
          floor footprint is the 'jukebox' obstacle in CrewDeck3D so walkers
          never path THROUGH it. Anchored dead-center at the foot of the mast
          pillar's plinth, leaning against the mast. Split into two layers:
          the ART lives in this pointer-less div whose z-index is re-layered
          per frame against the 3D characters (below the canvas when someone
          walks in FRONT of it, above when everyone is behind), while the
          invisible kid-sized tap BUTTON below stays on top in both states.
          Tap → 8s dance party: everyone dances, night falls, disco ball. */}
      <div
        ref={jukeboxArtRef}
        aria-hidden
        className="absolute pointer-events-none flex items-end justify-center"
        style={{
          left: '50%',
          top: '46.5%',
          transform: 'translate(-50%, -100%)',
          width: 'max(17vw, 68px)',
          height: 'max(17vw, 68px)',
          padding: '0 0 2px',
          zIndex: 6, // above the canvas (z-5) until someone walks in front
          opacity: hatchOpen ? 0.5 : 1,
          filter: 'drop-shadow(0 4px 9px rgba(0,0,0,0.45))',
        }}
      >
        <svg
          viewBox="0 0 64 84"
          className={`block h-auto select-none pointer-events-none${
            reduceMotion ? '' : ' crew-jukebox-glow'
          }`}
          style={{ width: '72%' }}
          aria-hidden
        >
          <defs>
            <linearGradient id="jbWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#A56A36" />
              <stop offset="0.55" stopColor="#8B5327" />
              <stop offset="1" stopColor="#6B3E1D" />
            </linearGradient>
            <linearGradient id="jbWindow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFF3C4" />
              <stop offset="0.6" stopColor="#FFD86B" />
              <stop offset="1" stopColor="#FF9C41" />
            </linearGradient>
          </defs>
          {/* Cabinet — arched wood body */}
          <path
            d="M7 38 A25 27 0 0 1 57 38 L57 76 Q57 81 52 81 L12 81 Q7 81 7 76 Z"
            fill="url(#jbWood)"
            stroke="#46280F"
            strokeWidth="2.5"
          />
          {/* Glowing arch window with bouncing music notes */}
          <path
            d="M15 39 A17 18 0 0 1 49 39 L49 52 L15 52 Z"
            fill="url(#jbWindow)"
            stroke="#8A5524"
            strokeWidth="1.6"
          />
          <g fill="#7A3C10">
            <circle cx="26" cy="45" r="2.6" />
            <rect x="27.6" y="32" width="1.9" height="13.5" rx="0.9" />
            <circle cx="38" cy="42" r="2.6" />
            <rect x="39.6" y="29" width="1.9" height="13.5" rx="0.9" />
            <path d="M27.6 32 q6 -3.5 13.9 -3 l0 3.4 q-7.6 -0.6 -13.9 3 Z" />
          </g>
          {/* Bubble lights along the arch */}
          <g className="crew-jukebox-lights" stroke="#46280F" strokeWidth="0.8">
            <circle cx="13" cy="33" r="2.5" fill="#FF5E5E" />
            <circle cx="19.5" cy="23.5" r="2.5" fill="#FFD24A" />
            <circle cx="32" cy="18.6" r="2.5" fill="#5EE1FF" />
            <circle cx="44.5" cy="23.5" r="2.5" fill="#8CE86B" />
            <circle cx="51" cy="33" r="2.5" fill="#FF7BD5" />
          </g>
          {/* Speaker grille */}
          <rect x="16" y="57" width="32" height="18" rx="3.5" fill="#3E2410" stroke="#2A1708" strokeWidth="1.4" />
          {[21, 27, 33, 39, 45].map((x) => (
            <rect key={x} x={x} y="59.5" width="2.4" height="13" rx="1.2" fill="#6B4423" />
          ))}
          {/* Feet */}
          <rect x="11" y="80" width="8" height="3.4" rx="1.6" fill="#46280F" />
          <rect x="45" y="80" width="8" height="3.4" rx="1.6" fill="#46280F" />
        </svg>
      </div>

      {/* Jukebox tap target — invisible, always on top so the party trigger
          works whichever side of the characters the art is layered on.
          Character raycast in onJukeboxTap keeps Talk working here too. */}
      <button
        type="button"
        onClick={onJukeboxTap}
        disabled={hatchOpen}
        aria-label="Jukebox — start a dance party"
        className="absolute z-30 m-0 p-0 border-0 bg-transparent appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
        style={{
          left: '50%',
          top: '46.5%',
          transform: 'translate(-50%, -100%)',
          width: 'max(17vw, 68px)',
          height: 'max(17vw, 68px)',
          cursor: hatchOpen ? 'default' : 'pointer',
        }}
      />

      {/* Ship wheel — bottom-left; returns to sail navigation. */}
      <button
        type="button"
        onClick={goBackToSail}
        disabled={hatchOpen}
        aria-label="Back to sail"
        className="absolute z-30 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full"
        style={{
          left: 'max(10px, env(safe-area-inset-left, 0px))',
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          width: 'min(22vw, 88px)',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
        }}
      >
        <img
          src={SAIL_STEERING_WHEEL}
          alt=""
          draggable={false}
          className="block w-full h-auto select-none pointer-events-none"
        />
        {/* Wood plaque “Go back” — same chrome as the hatch “Open” plaque */}
        <span
          aria-hidden
          className="absolute left-1/2 flex items-center justify-center gap-0.5 pointer-events-none select-none whitespace-nowrap font-display font-black uppercase tracking-[0.08em] text-[#F5E6C8]"
          style={{
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
            textShadow:
              '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="1.05em"
            height="1.05em"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Go back
        </span>
      </button>

      {/* Crew roster picker — wood plaque button, bottom-right (mirrors wheel). */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={hatchOpen}
        aria-label="Pick your crew"
        aria-haspopup="dialog"
        className="absolute z-30 m-0 border-0 appearance-none active:scale-95 transition-transform disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent flex items-center justify-center gap-1 select-none whitespace-nowrap font-display font-black uppercase tracking-[0.08em] text-[#F5E6C8]"
        style={{
          right: 'max(10px, env(safe-area-inset-right, 0px))',
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          padding: '0.5rem 0.85rem',
          borderRadius: '0.55rem',
          fontSize: 'clamp(0.68rem, 3vw, 0.9rem)',
          lineHeight: 1,
          cursor: hatchOpen ? 'default' : 'pointer',
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '2px solid #6B4423',
          boxShadow:
            '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
          textShadow:
            '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))',
        }}
      >
        <Users size="1.05em" aria-hidden />
        Crew
      </button>

      <CrewPickerDropdown open={pickerOpen} onClose={closePicker} anchor="page" />

      {/* Tap-to-chat popup — AI conversation with the tapped crew member */}
      {chatCharacter && (
        <CrewChatPopup
          character={chatCharacter}
          onClose={() => setChatCharacter(null)}
        />
      )}

      {/* White fade → SailBoatBasement */}
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
        /* Warm pulsing glow so the jukebox reads as tappable (like the hatch) */
        .crew-jukebox-glow {
          animation: crew-jukebox-glow 2.8s ease-in-out infinite;
        }
        @keyframes crew-jukebox-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255, 190, 80, 0.35)); }
          50% { filter: drop-shadow(0 0 11px rgba(255, 200, 90, 0.75)); }
        }
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
          .crew-jukebox-glow, .crew-disco-ball, .crew-party-spot {
            animation: none !important;
          }
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
