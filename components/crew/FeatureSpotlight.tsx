import React from 'react';

type Props = {
  /** Absolute box inside the parent (left/top/width/height/transform…). */
  box: React.CSSProperties;
  /** Round ring for circular props (wheel, jukebox); rounded box otherwise. */
  shape?: 'circle' | 'rounded';
  /** Optional bouncing badge above the ring (e.g. "Tap"). */
  label?: string;
  /** Stacking context inside the parent. */
  zIndex?: number;
};

/**
 * Pulsing gold ring over a deck/basement feature while a tour guide talks
 * about it. Pointer-transparent — the real tap target underneath keeps
 * working (or stays disabled) as the page decides.
 */
const FeatureSpotlight: React.FC<Props> = ({ box, shape = 'rounded', label, zIndex = 35 }) => (
  <div
    aria-hidden
    className="absolute pointer-events-none"
    style={{ ...box, zIndex }}
  >
    <span
      className="feature-spot-ring absolute inset-0"
      style={{ borderRadius: shape === 'circle' ? '50%' : '18%' }}
    />
    <span
      className="feature-spot-glow absolute inset-0"
      style={{ borderRadius: shape === 'circle' ? '50%' : '18%' }}
    />
    {label && (
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[115%]">
        <span className="feature-spot-label">{label}</span>
      </span>
    )}
    <style>{`
      .feature-spot-ring {
        border: 3px solid #FFE27A;
        box-shadow:
          0 0 0 2px rgba(120, 72, 10, 0.75),
          0 0 18px 4px rgba(255, 214, 92, 0.75),
          inset 0 0 14px rgba(255, 226, 122, 0.45);
        animation: feature-spot-pulse 1.4s ease-in-out infinite;
      }
      .feature-spot-glow {
        background: radial-gradient(ellipse at center, rgba(255, 226, 122, 0.22) 0%, rgba(255, 226, 122, 0) 70%);
        animation: feature-spot-glow 1.4s ease-in-out infinite;
      }
      .feature-spot-label {
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
        animation: feature-spot-bounce 1.15s ease-in-out infinite;
      }
      @keyframes feature-spot-pulse {
        0%, 100% { transform: scale(1); opacity: 0.95; }
        50% { transform: scale(1.06); opacity: 1; }
      }
      @keyframes feature-spot-glow {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      @keyframes feature-spot-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .feature-spot-ring, .feature-spot-glow, .feature-spot-label { animation: none; }
      }
    `}</style>
  </div>
);

export default FeatureSpotlight;
