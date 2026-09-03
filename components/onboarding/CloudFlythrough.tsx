import React, { useEffect } from 'react';
import { prefersReducedMotion } from '../../utils/bibleMapApi';

const CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const CLOUD_B = '/assets/images/map-sky-cloud-b.png';

const DURATION_MS = 2400;
const REDUCED_MS = 280;

type CloudFlythroughProps = {
  onComplete: () => void;
};

/**
 * Full-screen fly-through: banks of clouds rush toward the camera, then part
 * to reveal the journey map underneath.
 */
const CloudFlythrough: React.FC<CloudFlythroughProps> = ({ onComplete }) => {
  useEffect(() => {
    const ms = prefersReducedMotion() ? REDUCED_MS : DURATION_MS;
    const id = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(id);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[99990] overflow-hidden pointer-events-auto"
      role="presentation"
      aria-label="Flying through the clouds"
      style={{
        background:
          'linear-gradient(180deg, #8ec8f8 0%, #c8e6fa 38%, #eef7ff 70%, #ffffff 100%)',
      }}
    >
      <img src={CLOUD_A} alt="" aria-hidden className="ob-cloud ob-cloud-a" draggable={false} />
      <img src={CLOUD_B} alt="" aria-hidden className="ob-cloud ob-cloud-b" draggable={false} />
      <img src={CLOUD_A} alt="" aria-hidden className="ob-cloud ob-cloud-c" draggable={false} />
      <img src={CLOUD_B} alt="" aria-hidden className="ob-cloud ob-cloud-d" draggable={false} />
      <img src={CLOUD_A} alt="" aria-hidden className="ob-cloud ob-cloud-e" draggable={false} />
      <img src={CLOUD_B} alt="" aria-hidden className="ob-cloud ob-cloud-f" draggable={false} />
      <style>{`
        .ob-cloud {
          position: absolute;
          pointer-events: none;
          user-select: none;
          will-change: transform, opacity;
          filter: drop-shadow(0 8px 18px rgba(80, 120, 160, 0.28));
        }
        .ob-cloud-a {
          width: 92%;
          left: -18%;
          top: 8%;
          animation: ob-cloud-rush-a ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-b {
          width: 80%;
          right: -22%;
          top: 22%;
          animation: ob-cloud-rush-b ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-c {
          width: 110%;
          left: -8%;
          top: 42%;
          animation: ob-cloud-rush-c ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-d {
          width: 70%;
          left: 18%;
          top: -6%;
          opacity: 0.85;
          animation: ob-cloud-rush-d ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-e {
          width: 120%;
          left: -10%;
          bottom: -8%;
          animation: ob-cloud-rush-e ${DURATION_MS}ms ease-in forwards;
        }
        .ob-cloud-f {
          width: 95%;
          right: -16%;
          bottom: 12%;
          animation: ob-cloud-rush-f ${DURATION_MS}ms ease-in forwards;
        }
        @keyframes ob-cloud-rush-a {
          0% { transform: translate3d(0, 8%, 0) scale(0.55); opacity: 0.7; }
          70% { opacity: 1; }
          100% { transform: translate3d(-8%, -40%, 0) scale(2.6); opacity: 0; }
        }
        @keyframes ob-cloud-rush-b {
          0% { transform: translate3d(0, 12%, 0) scale(0.5); opacity: 0.65; }
          100% { transform: translate3d(12%, -30%, 0) scale(2.8); opacity: 0; }
        }
        @keyframes ob-cloud-rush-c {
          0% { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0.9; }
          100% { transform: translate3d(0, -18%, 0) scale(3.1); opacity: 0; }
        }
        @keyframes ob-cloud-rush-d {
          0% { transform: translate3d(0, 20%, 0) scale(0.45); opacity: 0.55; }
          100% { transform: translate3d(0, -50%, 0) scale(2.2); opacity: 0; }
        }
        @keyframes ob-cloud-rush-e {
          0% { transform: translate3d(0, 10%, 0) scale(0.8); opacity: 0.95; }
          100% { transform: translate3d(-6%, 20%, 0) scale(3.4); opacity: 0; }
        }
        @keyframes ob-cloud-rush-f {
          0% { transform: translate3d(0, 6%, 0) scale(0.6); opacity: 0.8; }
          100% { transform: translate3d(10%, 16%, 0) scale(2.9); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-cloud { animation: none !important; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CloudFlythrough;
