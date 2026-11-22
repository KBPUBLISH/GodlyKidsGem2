import React, { useLayoutEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

/** Approximate footprint of the badge + hint block, used to keep it on screen. */
const BLOCK_W = 124;
const BLOCK_H = 96;
const EDGE_MARGIN = 8;

/**
 * Padlock + soft darkening + unlock hint over a locked basement hotspot.
 * Gold badge matches the main-map story lock.
 *
 * Hotspots are laid out in the painting's object-cover frame, so on a tall
 * phone the ones near the painting's edges (e.g. the dartboard) are partly
 * cropped by the viewport. The badge therefore isn't simply centred in the
 * hotspot: it's centred in the *visible* part of it and nudged so the whole
 * badge + text block stays inside the screen.
 */
const GameLockOverlay: React.FC<{ islandLabel: string }> = ({ islandLabel }) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Visible slice of the hotspot.
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, vw);
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, vh);
      let cx = right > left ? (left + right) / 2 : r.left + r.width / 2;
      let cy = bottom > top ? (top + bottom) / 2 : r.top + r.height / 2;
      // Keep the whole block on screen.
      cx = Math.min(Math.max(cx, BLOCK_W / 2 + EDGE_MARGIN), vw - BLOCK_W / 2 - EDGE_MARGIN);
      cy = Math.min(Math.max(cy, BLOCK_H / 2 + EDGE_MARGIN), vh - BLOCK_H / 2 - EDGE_MARGIN);
      setAnchor({ x: cx - r.left, y: cy - r.top });
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);

  return (
    <span ref={rootRef} className="absolute inset-0 pointer-events-none" aria-hidden>
      <span
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.24) 55%, rgba(0,0,0,0) 80%)',
        }}
      />
      <span
        className="absolute flex flex-col items-center justify-center gap-1.5"
        style={{
          width: BLOCK_W,
          left: anchor ? anchor.x : '50%',
          top: anchor ? anchor.y : '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
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
          <Lock size={19} className="text-[#5c3a1a]" strokeWidth={2.8} fill="rgba(92,58,26,0.2)" />
        </span>
        <span
          className="relative px-2 font-display font-bold text-[11px] leading-tight text-[#FFE9B0] text-center"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)' }}
        >
          Complete {islandLabel}!
        </span>
      </span>
    </span>
  );
};

export default GameLockOverlay;
