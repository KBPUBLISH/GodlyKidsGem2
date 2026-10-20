import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import {
  CHALLENGE_PACK_COUNT,
  challengeRemainingMs,
  formatChallengeCountdown,
  isSevenDayChallengeActive,
  loadChallengePacks,
  type ChallengePack,
} from '../../utils/sevenDayChallenge';

const SevenDayChallengeBadge: React.FC = () => {
  const [active, setActive] = useState(isSevenDayChallengeActive);
  const [remaining, setRemaining] = useState(challengeRemainingMs);
  const [open, setOpen] = useState(false);
  const [packs, setPacks] = useState<ChallengePack[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshPacks = () => {
    loadChallengePacks()
      .then(setPacks)
      .catch(() => {});
  };

  useEffect(() => {
    const sync = () => {
      const on = isSevenDayChallengeActive();
      setActive(on);
      setRemaining(challengeRemainingMs());
      if (on) refreshPacks();
    };
    sync();
    const clock = window.setInterval(sync, 30000);
    window.addEventListener('sevenDayChallengeUpdated', sync);
    window.addEventListener('islandStoryProgressUpdated', sync);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener('sevenDayChallengeUpdated', sync);
      window.removeEventListener('islandStoryProgressUpdated', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  if (!active) return null;

  const done = packs.filter((pack) => pack.complete).length;

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex items-center gap-1 rounded-full bg-[#1B2A6B] px-2 py-1 text-white shadow-md active:scale-95"
        aria-expanded={open}
        aria-label={`7 day challenge, ${formatChallengeCountdown(remaining)} left, ${done} of ${CHALLENGE_PACK_COUNT} story packs`}
      >
        <Clock size={12} />
        <span className="font-display font-black text-[10px] leading-none tracking-wide">
          {formatChallengeCountdown(remaining)}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[80] w-[min(78vw,280px)] rounded-2xl bg-white p-3 text-[#1B2A6B] shadow-2xl">
          <p className="font-display font-black text-sm leading-tight">7-day challenge</p>
          <p className="mt-0.5 text-[11px] font-bold text-[#3d4a86]">
            {formatChallengeCountdown(remaining)} left · {done}/{CHALLENGE_PACK_COUNT} story packs
          </p>
          <ul className="mt-2 space-y-1.5">
            {packs.map((pack) => (
              <li key={pack.id} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                    pack.complete
                      ? 'border-[#2E7D32] bg-[#2E7D32] text-white'
                      : 'border-[#c5cbe8] bg-white'
                  }`}
                  aria-hidden
                >
                  {pack.complete && <Check size={11} strokeWidth={3} />}
                </span>
                <span className={`text-xs font-semibold leading-snug ${pack.complete ? 'text-[#2E7D32]' : ''}`}>
                  {pack.title}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-bold leading-snug text-[#5B4AD6]">
            Finish all 7 story packs to get the free book.
          </p>
        </div>
      )}
    </div>
  );
};

export default SevenDayChallengeBadge;
