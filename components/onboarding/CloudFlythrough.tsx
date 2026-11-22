import React, { useCallback, useEffect, useMemo } from 'react';
import { prefersReducedMotion } from '../../utils/bibleMapApi';

const CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const CLOUD_B = '/assets/images/map-sky-cloud-b.png';

const DURATION_MS = 1600;
const REDUCED_MS = 280;

type CloudFlythroughProps = {
  onComplete: () => void;
};

const LAYERS = [
  { src: CLOUD_A, cls: 'ob-cloud-a' },
  { src: CLOUD_B, cls: 'ob-cloud-b' },
  { src: CLOUD_A, cls: 'ob-cloud-c' },
  { src: CLOUD_B, cls: 'ob-cloud-d' },
] as const;

/** Decode the two fly-through PNGs before the map transition starts. */
export function preloadCloudFlythroughAssets(): void {
  if (typeof window === 'undefined') return;
  for (const src of [CLOUD_A, CLOUD_B]) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

/**
 * Full-screen fly-through: a few cloud banks rush toward the camera, then
 * part to reveal the journey map. Transform + opacity only — no filters.
 */
const CloudFlythrough: React.FC<CloudFlythroughProps> = ({ onComplete }) => {
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const ms = reduced ? REDUCED_MS : DURATION_MS;
    const id = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(id);
  }, [onComplete, reduced]);

  const dropWillChange = useCallback((e: React.AnimationEvent<HTMLElement>) => {
    e.currentTarget.style.willChange = 'auto';
  }, []);

  return (
    <div
      className={`ob-cloud-wipe${reduced ? ' ob-cloud-wipe--reduced' : ''}`}
      role="presentation"
      aria-label="Flying through the clouds"
    >
      {LAYERS.map((layer, i) => (
        <img
          key={i}
          src={layer.src}
          alt=""
          aria-hidden
          className={`ob-cloud ${layer.cls}`}
          draggable={false}
          decoding="async"
          onAnimationEnd={dropWillChange}
        />
      ))}
      <style>{`
        .ob-cloud-wipe {
          position: fixed;
          inset: 0;
          z-index: 99990;
          overflow: hidden;
          pointer-events: auto;
          background:
            linear-gradient(180deg, #8ec8f8 0%, #c8e6fa 38%, #eef7ff 70%, #ffffff 100%);
          transform: translate3d(0, 0, 0);
          animation: ob-cloud-wipe-out ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud {
          position: absolute;
          pointer-events: none;
          user-select: none;
          will-change: transform;
        }
        .ob-cloud-a {
          width: 64%;
          left: -10%;
          top: 4%;
          animation: ob-cloud-rush-a ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-b {
          width: 58%;
          right: -8%;
          top: 18%;
          animation: ob-cloud-rush-b ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-c {
          width: 72%;
          left: -6%;
          bottom: -4%;
          animation: ob-cloud-rush-c ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-d {
          width: 52%;
          right: -4%;
          bottom: 16%;
          animation: ob-cloud-rush-d ${DURATION_MS}ms ease-in forwards;
        }
        @keyframes ob-cloud-rush-a {
          0% { transform: translate3d(0, 4%, 0) scale(0.72); opacity: 0.88; }
          100% { transform: translate3d(-12%, -22%, 0) scale(1.75); opacity: 0; }
        }
        @keyframes ob-cloud-rush-b {
          0% { transform: translate3d(0, 6%, 0) scale(0.68); opacity: 0.82; }
          100% { transform: translate3d(12%, -18%, 0) scale(1.7); opacity: 0; }
        }
        @keyframes ob-cloud-rush-c {
          0% { transform: translate3d(0, 0, 0) scale(0.78); opacity: 0.92; }
          100% { transform: translate3d(-8%, 12%, 0) scale(1.8); opacity: 0; }
        }
        @keyframes ob-cloud-rush-d {
          0% { transform: translate3d(0, 4%, 0) scale(0.7); opacity: 0.8; }
          100% { transform: translate3d(10%, 10%, 0) scale(1.65); opacity: 0; }
        }
        @keyframes ob-cloud-wipe-out {
          0%, 58% { opacity: 1; }
          100% { opacity: 0; }
        }
        .ob-cloud-wipe--reduced {
          animation: ob-cloud-wipe-out ${REDUCED_MS}ms ease forwards;
        }
        .ob-cloud-wipe--reduced .ob-cloud {
          animation: none !important;
          will-change: auto;
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-cloud-wipe {
            animation: ob-cloud-wipe-out ${REDUCED_MS}ms ease forwards;
          }
          .ob-cloud {
            animation: none !important;
            will-change: auto;
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default CloudFlythrough;
