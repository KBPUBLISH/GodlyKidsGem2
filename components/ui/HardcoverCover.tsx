import React, { useEffect } from 'react';

const STYLE_ID = 'gk-hardcover-cover-css';

const HARDCOVER_CSS = `
  .hardcover-stage {
    perspective: 900px;
    padding: 4px 8px 10px 2px;
  }
  .hardcover-book {
    position: relative;
    width: 100%;
    height: 100%;
    transform: rotateY(-6deg) translateZ(0);
    transform-origin: 20% 50%;
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
  .hardcover-face {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 3px 10px 10px 4px;
    background: #1e293b;
    box-shadow:
      5px 8px 14px rgba(48, 32, 12, 0.26),
      inset 10px 0 12px rgba(0, 0, 0, 0.22),
      inset -1px 0 0 rgba(255, 255, 255, 0.12);
  }
  .hardcover-face img {
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  .hardcover-face::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 12%;
    max-width: 15px;
    z-index: 4;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.46) 0%,
      rgba(255, 255, 255, 0.3) 36%,
      rgba(0, 0, 0, 0.14) 68%,
      transparent 100%
    );
  }
  .hardcover-face::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background: linear-gradient(115deg, rgba(255, 255, 255, 0.16) 0%, transparent 32%);
  }
  .hardcover-pages {
    position: absolute;
    top: 3%;
    bottom: 3%;
    right: -6px;
    width: 6px;
    z-index: 0;
    border-radius: 0 2px 2px 0;
    background: repeating-linear-gradient(
      to right,
      #f8f2e6 0 1.5px,
      #d9cbb3 1.5px 2.5px
    );
    box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.18);
  }
  @media (prefers-reduced-motion: reduce) {
    .hardcover-book {
      transform: none;
    }
  }
`;

function ensureHardcoverStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = HARDCOVER_CSS;
  document.head.appendChild(el);
}

type HardcoverCoverProps = {
  children: React.ReactNode;
  className?: string;
  /** Defaults to portrait library cards. */
  aspectClassName?: string;
};

/**
 * Turns a flat cover image into a hardcover: left spine, page edge, tilt, shadow.
 * Existing cover files stay as-is — this is display-only.
 */
const HardcoverCover: React.FC<HardcoverCoverProps> = ({
  children,
  className = '',
  aspectClassName = 'aspect-[3/4]',
}) => {
  ensureHardcoverStyles();
  useEffect(() => {
    ensureHardcoverStyles();
  }, []);

  return (
    <div className={`hardcover-stage relative w-full ${aspectClassName} ${className}`}>
      <div className="hardcover-book">
        <span className="hardcover-pages" aria-hidden />
        <div className="hardcover-face">{children}</div>
      </div>
    </div>
  );
};

export default HardcoverCover;
