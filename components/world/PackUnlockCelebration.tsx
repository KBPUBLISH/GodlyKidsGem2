import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { prefersReducedMotion } from '../../utils/bibleMapApi';
import type { PackUnlockCelebrationPayload } from '../../services/storyPackUnlockUxService';

const HOLD_MS = 2000;
const OUT_MS = 400;

type Phase = 'in' | 'out';

type Props = {
  payload: PackUnlockCelebrationPayload;
  onDone: () => void;
};

/**
 * Auto-dismiss overlay of the newly unlocked pack cover.
 * Tap anywhere to skip; kids are not asked to confirm.
 */
const PackUnlockCelebration: React.FC<Props> = ({ payload, onDone }) => {
  const [phase, setPhase] = useState<Phase>('in');
  const reduce = prefersReducedMotion();

  useEffect(() => {
    const hold = window.setTimeout(() => setPhase('out'), HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [payload.packId]);

  useEffect(() => {
    if (phase !== 'out') return;
    const done = window.setTimeout(onDone, reduce ? 220 : OUT_MS);
    return () => window.clearTimeout(done);
  }, [phase, onDone, reduce]);

  const skip = () => setPhase('out');

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-auto"
      onClick={skip}
      role="status"
      aria-live="polite"
      aria-label={`${payload.title} unlocked`}
    >
      <div
        className="absolute inset-0"
        data-testid="pack-unlock-celebration"
        style={{
          background: 'rgba(11, 30, 51, 0.55)',
          opacity: phase === 'out' ? 0 : 1,
          transition: 'opacity 0.35s ease',
        }}
        aria-hidden
      />
      <div
        className="relative z-[1] flex flex-col items-center gap-3 px-6"
        style={{
          animation: reduce
            ? phase === 'out'
              ? 'gk-pack-unlock-fade 0.2s ease-in forwards'
              : 'gk-pack-unlock-fade 0.2s ease-out'
            : phase === 'out'
              ? 'gk-pack-unlock-out 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards'
              : 'gk-pack-unlock-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <span
          className="font-display font-black uppercase tracking-wide text-[#3E1F07] text-sm px-4 py-1.5 rounded-full border-2 border-[#B8860B]"
          style={{
            background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
            boxShadow: '0 3px 0 #8B6914, 0 8px 18px rgba(0,0,0,0.35)',
          }}
        >
          New story unlocked!
        </span>
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 'min(42vw, 196px)',
            height: 'min(42vw, 196px)',
            background: 'linear-gradient(180deg, #F0D78C 0%, #D4A017 45%, #8B6914 100%)',
            boxShadow:
              '0 4px 0 #5c3a1a, 0 14px 28px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,240,200,0.55)',
            border: '3px solid #F5E6A3',
          }}
        >
          {payload.coverUrl ? (
            <img
              src={payload.coverUrl}
              alt=""
              className="w-[88%] h-[88%] object-contain rounded-full"
              draggable={false}
            />
          ) : (
            <span className="flex items-center justify-center w-[88%] h-[88%] rounded-full bg-emerald-700/90 border-2 border-emerald-300">
              <MapPin className="w-[42%] h-[42%] text-white" strokeWidth={2.2} />
            </span>
          )}
        </div>
        <p
          className="font-display font-black text-white text-center text-lg max-w-[16rem] leading-tight"
          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}
        >
          {payload.title}
        </p>
      </div>
      <style>{`
        @keyframes gk-pack-unlock-in {
          0% { transform: scale(0.2) translateY(24px); opacity: 0; }
          70% { transform: scale(1.12) translateY(-6px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes gk-pack-unlock-out {
          0% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(0.45) translateY(-36px); opacity: 0; }
        }
        @keyframes gk-pack-unlock-fade {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gk-pack-unlock-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes gk-pack-unlock-out {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        }
      `}</style>
    </div>
  );
};

export default PackUnlockCelebration;
