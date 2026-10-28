import React, { useCallback, useMemo, useRef, useState } from 'react';
import PerryFlyIn from './PerryFlyIn';
import { buildPerryIslandCopy } from '../../utils/perrySpeech';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";

type PerryMapGuideProps = {
  kidName?: string | null;
  canSail?: boolean;
  onSetSail: () => void;
};

const PerryMapGuide: React.FC<PerryMapGuideProps> = ({ kidName, canSail = true, onSetSail }) => {
  const copy = useMemo(() => buildPerryIslandCopy(kidName), [kidName]);
  const [ready, setReady] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const sailedRef = useRef(false);
  const canSailRef = useRef(canSail);
  canSailRef.current = canSail;

  const sail = useCallback(() => {
    if (sailedRef.current || !canSailRef.current) return;
    sailedRef.current = true;
    onSetSail();
  }, [onSetSail]);

  return (
    <PerryFlyIn
      className="z-[90]"
      motion="dive"
      holdY={-0.55}
      height={0.78}
      bubble={ready ? copy.line : null}
      tts={ready ? copy.tts : null}
      onReady={() => {
        setReady(true);
        window.setTimeout(() => setShowContinue(true), 1600);
      }}
      // Clip plays once (~30 s). If the kid hasn't tapped by the end, sail anyway.
      onClipEnd={sail}
      footer={
        showContinue ? (
          <button
            type="button"
            onClick={sail}
            disabled={!canSail}
            className="pointer-events-auto w-full max-w-sm px-10 py-3.5 rounded-full font-extrabold text-[1.55rem] leading-none active:scale-[0.97] transition-transform disabled:opacity-45"
            style={{
              fontFamily: BUBBLE,
              background: GOLD,
              color: NAVY,
              boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
              marginBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 4.25rem)',
            }}
          >
            Discover the ship
          </button>
        ) : (
          <div
            style={{
              height: '3.4rem',
              marginBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 4.25rem)',
            }}
          />
        )
      }
    />
  );
};

export default PerryMapGuide;
