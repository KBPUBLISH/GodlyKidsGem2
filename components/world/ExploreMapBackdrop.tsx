import React, { useEffect, useState } from 'react';
import { Check, Lock, Star } from 'lucide-react';
import {
  CMS_ISLANDS_TIMEOUT_MS,
  FALLBACK_OCEAN_ISLANDS,
  fetchOceanMapIslands,
  getOceanIslandArtSrc,
  isGenesisIsland,
  type OceanMapIsland,
} from '../../utils/oceanMapIslands';

/** Same ocean strip as MapPage — cropped as a full-bleed Explore background. */
const MAP_OCEAN_SCROLL = '/assets/images/map-ocean-scroll.png';
const MAP_SKY_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const MAP_SKY_CLOUD_B = '/assets/images/map-sky-cloud-b.png';

type MapSkyCloudSpec = {
  id: string;
  src: string;
  widthPct: number;
  leftPct?: number;
  rightPct?: number;
  topPct?: number;
  bottomPct?: number;
  opacity: number;
};

/** Horizon cloud bank — mirrors MapPage marquee layout. */
const MAP_SKY_CLOUDS: MapSkyCloudSpec[] = [
  { id: 'a-left', src: MAP_SKY_CLOUD_A, widthPct: 44, leftPct: -12, topPct: 0, opacity: 0.95 },
  { id: 'b-right', src: MAP_SKY_CLOUD_B, widthPct: 36, rightPct: -8, topPct: 4, opacity: 0.92 },
  { id: 'a-mid', src: MAP_SKY_CLOUD_A, widthPct: 30, leftPct: 32, topPct: 0, opacity: 0.82 },
  { id: 'b-high', src: MAP_SKY_CLOUD_B, widthPct: 22, leftPct: 52, topPct: 2, opacity: 0.74 },
  { id: 'a-low', src: MAP_SKY_CLOUD_A, widthPct: 32, leftPct: 10, topPct: 14, opacity: 0.58 },
];

const MAP_SKY_CLOUD_LOOP_SEC = 90;

/** Rest framing — Genesis sits mid-upper on the ocean (slightly lower than Map top). */
export const EXPLORE_GENESIS_REST = { x: 50, y: 36 } as const;
/** Cinematic: ease Genesis a bit lower before punch-in. */
export const EXPLORE_GENESIS_LOWERED = { x: 50, y: 48 } as const;

/**
 * MapPage y% lives on a tall scroll strip; Explore is one viewport.
 * Keep relative offsets from Genesis, compressed into the visible ocean.
 */
const EXPLORE_Y_SCALE = 0.45;
const EXPLORE_X_SCALE = 0.9;

const exploreIslandPosition = (
  island: OceanMapIsland,
  genesis: OceanMapIsland | undefined,
  genesisExplore: { x: number; y: number },
): { x: number; y: number } => {
  if (isGenesisIsland(island)) return genesisExplore;
  const gX = genesis?.x ?? 50;
  const gY = genesis?.y ?? 3.5;
  const x = genesisExplore.x + (island.x - gX) * EXPLORE_X_SCALE;
  const y = genesisExplore.y + (island.y - gY) * EXPLORE_Y_SCALE;
  return {
    x: Math.min(88, Math.max(12, x)),
    y: Math.min(84, Math.max(42, y)),
  };
};

export type ExploreMapBackdropProps = {
  /** Sail cinematic: chrome cleared; map stays. */
  cinematic?: boolean;
  /** Animate Genesis downward for the punch-in. */
  genesisLowered?: boolean;
  /** Camera zoom into Genesis. */
  zoom?: boolean;
  className?: string;
};

const ZOOM_SCALE = 2.35;
const ZOOM_MS = 1400;
const LOWER_MS = 750;
const ZOOM_EASE = 'cubic-bezier(0.72, 0.0, 0.88, 0.28)';
const LOWER_EASE = 'cubic-bezier(0.33, 0.9, 0.4, 1)';
/** Viewport transform-origin aimed at Genesis after lower (~50% × 48%). */
const ZOOM_ORIGIN = '50% 48%';

const GENESIS_ART_WIDTH = 'min(58vw, 240px)';
const OTHER_ART_WIDTH = 'min(36vw, 148px)';
const DISC_SIZE = 52;

/**
 * Living Map ocean backdrop for Explore — reuses MapPage ocean + drifting clouds
 * + all ocean islands (CMS icons when available) so Sail-the-Map can animate
 * in-place (no /map route load). Non-interactive; Genesis remains the zoom target.
 */
const ExploreMapBackdrop: React.FC<ExploreMapBackdropProps> = ({
  cinematic = false,
  genesisLowered = false,
  zoom = false,
  className = '',
}) => {
  const [islands, setIslands] = useState<OceanMapIsland[]>(FALLBACK_OCEAN_ISLANDS);
  const genesisExplore = genesisLowered ? EXPLORE_GENESIS_LOWERED : EXPLORE_GENESIS_REST;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(() => controller.abort(), CMS_ISLANDS_TIMEOUT_MS);

    const load = async () => {
      try {
        const mapped = await fetchOceanMapIslands(controller.signal);
        if (!cancelled && mapped) setIslands(mapped);
      } catch {
        /* keep FALLBACK_OCEAN_ISLANDS */
      } finally {
        window.clearTimeout(failSafe);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, []);

  const genesisIsland = islands.find((island) => isGenesisIsland(island));
  /** Non-Genesis first (behind), Genesis last (foreground / cinematic target). */
  const orderedIslands = [
    ...islands.filter((island) => !isGenesisIsland(island)),
    ...islands.filter((island) => isGenesisIsland(island)),
  ];

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden
    >
      {/* Camera layer — ocean + islands zoom together */}
      <div
        className="absolute inset-0"
        style={{
          transform: zoom ? `scale(${ZOOM_SCALE})` : 'scale(1)',
          transformOrigin: ZOOM_ORIGIN,
          transition: cinematic ? `transform ${ZOOM_MS}ms ${ZOOM_EASE}` : undefined,
          willChange: cinematic ? 'transform' : undefined,
          filter: cinematic ? 'saturate(1.08) brightness(1.05)' : undefined,
        }}
      >
        {/* Sky wash */}
        <div
          className="absolute inset-x-0 top-0 z-[1]"
          style={{
            height: '42%',
            background:
              'linear-gradient(180deg, #1a6fd4 0%, #3aa0ef 38%, #7ec8f8 68%, #1a8fd1 100%)',
          }}
        />

        {/* Ocean strip — cover crop of MapPage scroll art */}
        <div
          className="absolute inset-0 z-[2]"
          style={{ background: '#1a8fd1' }}
        >
          <img
            src={MAP_OCEAN_SCROLL}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none"
            style={{ objectPosition: 'center 8%' }}
          />
        </div>

        {/* Soft horizon haze */}
        <div
          className="absolute inset-x-0 top-0 z-[3] h-[28%]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(184,223,248,0.18) 45%, transparent 100%)',
          }}
        />

        {/* All MapPage islands — CMS mapArtUrl when present; decorative only */}
        {orderedIslands.map((island) => {
          const isGenesis = isGenesisIsland(island);
          const pos = exploreIslandPosition(island, genesisIsland, genesisExplore);
          const artSrc = getOceanIslandArtSrc(island);
          const hasArt = Boolean(artSrc);
          const isLocked = island.status === 'locked';
          const isComplete = island.status === 'complete';
          const isCurrent = island.status === 'current';
          /** Never label Genesis — decorative GENESIS sign / orphaned book chip removed. */
          const showLabel = !isGenesis;
          const discStyle: React.CSSProperties = isLocked
            ? { background: 'radial-gradient(circle at 35% 30%, #8fa3ad, #5b6f78)' }
            : isComplete
              ? { background: 'radial-gradient(circle at 35% 30%, #7bd66a, #3f9e3a)' }
              : { background: 'radial-gradient(circle at 35% 30%, #ffd98a, #e0a94a 45%, #c98a3a)' };

          return (
            <div
              key={island.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                zIndex: isGenesis ? 5 : 4,
                width: hasArt
                  ? isGenesis
                    ? GENESIS_ART_WIDTH
                    : OTHER_ART_WIDTH
                  : DISC_SIZE + 48,
                transition: isGenesis && cinematic ? `top ${LOWER_MS}ms ${LOWER_EASE}` : undefined,
                filter: isGenesis
                  ? cinematic && (genesisLowered || zoom)
                    ? 'drop-shadow(0 0 18px rgba(255, 236, 160, 0.55))'
                    : 'drop-shadow(0 8px 18px rgba(0,0,0,0.35))'
                  : 'drop-shadow(0 6px 12px rgba(0,0,0,0.28))',
                opacity: isGenesis ? 1 : cinematic ? 0.92 : 0.88,
              }}
            >
              {hasArt && artSrc ? (
                <div className="relative w-full">
                  <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
                    <span className="explore-map-shore explore-map-shore-1" />
                    <span className="explore-map-shore explore-map-shore-2" />
                  </div>
                  <img
                    src={artSrc}
                    alt=""
                    draggable={false}
                    className="relative z-[1] block w-full h-auto select-none"
                  />
                </div>
              ) : (
                <div
                  className={`rounded-full border-[3px] shadow-[0_6px_14px_rgba(0,0,0,0.28)] flex items-center justify-center ${
                    isLocked ? 'border-white/35 grayscale-[30%]' : 'border-white/55'
                  }`}
                  style={{
                    width: DISC_SIZE,
                    height: DISC_SIZE,
                    ...discStyle,
                  }}
                >
                  {isComplete && (
                    <span className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                      <Check size={14} className="text-[#2E7D32]" strokeWidth={3} />
                    </span>
                  )}
                  {isCurrent && (
                    <Star size={20} className="text-white drop-shadow" fill="#FFD700" strokeWidth={1.5} />
                  )}
                  {isLocked && (
                    <span className="w-7 h-7 rounded-full bg-black/35 flex items-center justify-center">
                      <Lock size={14} className="text-white" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              )}

              {showLabel && (
                <span
                  className="mt-1.5 max-w-[110px] text-center leading-tight px-2 py-0.5 rounded-md bg-[#f3e3c4]/92 text-[#5c3d1e] text-[10px] font-display font-black border border-[#c9a76b]/90 shadow"
                  style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
                >
                  {island.book}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Clouds stay viewport-pinned (drift over the ocean, not scaled away) */}
      <div
        className="absolute inset-x-0 top-0 z-[6] overflow-hidden"
        style={{
          height: 'min(28vh, 220px)',
          top: 'var(--safe-area-top, 0px)',
          opacity: cinematic ? 0.9 : 1,
        }}
      >
        <div
          className="explore-map-sky-cloud-track"
          style={{ '--cloud-loop-duration': `${MAP_SKY_CLOUD_LOOP_SEC}s` } as React.CSSProperties}
        >
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="explore-map-sky-cloud-strip"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {MAP_SKY_CLOUDS.map((cloud) => (
                <img
                  key={`${copy}-${cloud.id}`}
                  src={cloud.src}
                  alt=""
                  draggable={false}
                  className="explore-map-sky-cloud absolute max-w-none h-auto select-none"
                  style={{
                    width: `${cloud.widthPct}%`,
                    left: cloud.leftPct != null ? `${cloud.leftPct}%` : undefined,
                    right: cloud.rightPct != null ? `${cloud.rightPct}%` : undefined,
                    top: cloud.topPct != null ? `${cloud.topPct}%` : undefined,
                    bottom: cloud.bottomPct != null ? `${cloud.bottomPct}%` : undefined,
                    opacity: cloud.opacity,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .explore-map-sky-cloud-track {
          --cloud-loop-duration: 90s;
          display: flex;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: explore-map-sky-cloud-scroll var(--cloud-loop-duration) linear infinite;
        }
        .explore-map-sky-cloud-strip {
          position: relative;
          flex: 0 0 50%;
          width: 50%;
          height: 100%;
        }
        .explore-map-sky-cloud {
          filter: drop-shadow(0 2px 6px rgba(40, 80, 120, 0.18));
        }
        @keyframes explore-map-sky-cloud-scroll {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        .explore-map-shore {
          position: absolute;
          left: 50%;
          top: 58%;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.45);
          transform: translate(-50%, -50%);
          pointer-events: none;
          box-sizing: border-box;
        }
        .explore-map-shore-1 {
          width: 96%;
          height: 42%;
          animation: explore-map-shore-pulse 3.2s ease-out infinite;
        }
        .explore-map-shore-2 {
          width: 110%;
          height: 48%;
          border-width: 1.5px;
          border-color: rgba(255,255,255,0.28);
          animation: explore-map-shore-pulse 3.2s ease-out infinite;
          animation-delay: 1.1s;
        }
        @keyframes explore-map-shore-pulse {
          0% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.7; }
          70% { opacity: 0.22; }
          100% { transform: translate(-50%, -50%) scale(1.18); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .explore-map-sky-cloud-track {
            --cloud-loop-duration: 220s;
          }
          .explore-map-shore-1,
          .explore-map-shore-2 {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ExploreMapBackdrop;
