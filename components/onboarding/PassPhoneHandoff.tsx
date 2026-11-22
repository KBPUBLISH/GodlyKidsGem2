import React, { useId } from 'react';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";
const PARENT_HAND = '/assets/images/pass-phone-parent-hand.png';
const KID_HAND = '/assets/images/pass-phone-kid-hand.png';

type PassPhoneHandoffProps = {
  onContinue?: () => void;
  variant?: 'full' | 'underlay';
  /** to-child: parent hands the phone over. to-parent: the kid hands it back. */
  direction?: 'to-child' | 'to-parent';
  /** Tap a hand to choose who is holding the phone. Hides the pass animation. */
  onSelect?: (who: 'parent' | 'kid') => void;
};

const PassPhoneHandoff: React.FC<PassPhoneHandoffProps> = ({
  onContinue,
  variant = 'full',
  direction = 'to-child',
  onSelect,
}) => {
  const uid = useId().replace(/:/g, '');
  const underlay = variant === 'underlay';
  const selectable = Boolean(onSelect);

  return (
    <div
      className={`w-full max-w-md px-6 flex flex-col items-center ${
        underlay ? 'pb-2' : 'flex-1'
      } ${selectable ? '' : underlay ? 'pointer-events-none' : ''}`}
    >
      {variant === 'full' && (
        <>
          <h1
            className="text-center font-extrabold leading-[0.95] text-[2.35rem] sm:text-[2.7rem] mt-2"
            style={{ fontFamily: BUBBLE, color: NAVY, textShadow: '0 2px 0 #fff' }}
          >
            Pass the phone
          </h1>
          <p
            className="mt-2 mb-1 text-center text-[1.15rem] font-semibold leading-snug max-w-[18rem]"
            style={{ fontFamily: BUBBLE, color: NAVY }}
          >
            Hand it to your child — the adventure is theirs now.
          </p>
        </>
      )}

      {selectable && (
        <p
          className="mb-1 text-center font-extrabold text-[1.65rem] leading-none"
          style={{ fontFamily: BUBBLE, color: NAVY, textShadow: '0 2px 0 #fff' }}
        >
          Select
        </p>
      )}

      <div
        className={`relative w-full flex items-end justify-center ${
          underlay ? 'min-h-0 max-w-[19rem]' : 'flex-1 min-h-[300px] max-w-[22rem]'
        }`}
      >
        <div
          className={`relative w-full flex items-end justify-between gap-1 ${
            selectable ? '' : direction === 'to-parent' ? 'gk-pass-to-parent' : ''
          }`}
        >
          <button
            type="button"
            disabled={!selectable}
            onClick={() => onSelect?.('parent')}
            className={`gk-pass-adult flex flex-col items-center w-[46%] bg-transparent border-0 p-0 ${
              selectable ? 'pointer-events-auto active:scale-95 transition-transform' : 'pointer-events-none'
            }`}
            aria-label="Parent"
          >
            <img
              src={PARENT_HAND}
              alt=""
              aria-hidden
              className="w-full h-auto object-contain drop-shadow-md select-none"
              draggable={false}
            />
            <span
              className="mt-0.5 font-extrabold text-[0.92rem] leading-none"
              style={{ fontFamily: BUBBLE, color: NAVY }}
            >
              Parent
            </span>
          </button>

          {!selectable && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <svg viewBox="0 0 360 220" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#A6DCFF" />
                  <stop offset="1" stopColor="#3B94CC" />
                </linearGradient>
                <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#12264A" floodOpacity="0.2" />
                </filter>
              </defs>
              <g className="gk-pass-phone" filter={`url(#${uid}-soft)`}>
                <rect x="-18" y="-33" width="36" height="66" rx="8.5" fill="#16345F" />
                <rect x="-14" y="-29" width="28" height="50" rx="4.5" fill={`url(#${uid}-sky)`} />
                <circle cx="-4.4" cy="-12" r="2.7" fill="#16345F" />
                <circle cx="4.4" cy="-12" r="2.7" fill="#16345F" />
                <path d="M-6.4 2.4 A7 5.4 0 0 0 6.4 2.4" fill="none" stroke="#16345F" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="0" cy="26" r="2.3" fill={GOLD} />
              </g>
            </svg>
          </div>
          )}

          <button
            type="button"
            disabled={!selectable}
            onClick={() => onSelect?.('kid')}
            className={`gk-pass-child flex flex-col items-center w-[36%] mb-[2%] bg-transparent border-0 p-0 ${
              selectable ? 'pointer-events-auto active:scale-95 transition-transform' : 'pointer-events-none'
            }`}
            aria-label="Kid"
          >
            <img
              src={KID_HAND}
              alt=""
              aria-hidden
              className="w-full h-auto object-contain drop-shadow-md select-none"
              draggable={false}
            />
            <span
              className="mt-0.5 font-extrabold text-[0.92rem] leading-none"
              style={{ fontFamily: BUBBLE, color: NAVY }}
            >
              Kid
            </span>
          </button>
        </div>
      </div>

      {variant === 'full' && onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full max-w-sm px-10 py-3.5 rounded-full font-extrabold text-[1.55rem] leading-none active:scale-[0.97] transition-transform"
          style={{
            fontFamily: BUBBLE,
            background: GOLD,
            color: NAVY,
            boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
            marginBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 0.75rem)',
          }}
        >
          Continue →
        </button>
      )}

      <style>{`
      .gk-pass-adult {
        transform-origin: 70% 55%;
        animation: gk-pass-adult 3.6s ease-in-out infinite;
      }
      .gk-pass-child {
        transform-origin: 30% 55%;
        animation: gk-pass-child 3.6s ease-in-out infinite;
      }
      .gk-pass-phone {
        animation: gk-pass-phone 3.6s ease-in-out infinite;
      }
      @keyframes gk-pass-adult {
        0%, 12% { transform: translate(0, 4px); }
        40%, 52% { transform: translate(10px, -6px); }
        78%, 100% { transform: translate(0, 4px); }
      }
      @keyframes gk-pass-child {
        0%, 18% { transform: translate(4px, 5px); }
        44%, 70% { transform: translate(-10px, -8px); }
        100% { transform: translate(4px, 5px); }
      }
      @keyframes gk-pass-phone {
        0%, 12% { transform: translate(148px, 78px) rotate(-10deg); }
        40% { transform: translate(180px, 70px) rotate(0deg); }
        58%, 74% { transform: translate(214px, 92px) rotate(8deg); }
        100% { transform: translate(148px, 78px) rotate(-10deg); }
      }
      .gk-pass-to-parent .gk-pass-adult {
        animation-name: gk-pass-adult-receive;
      }
      .gk-pass-to-parent .gk-pass-child {
        animation-name: gk-pass-child-give;
      }
      .gk-pass-to-parent .gk-pass-phone {
        animation-name: gk-pass-phone-to-parent;
      }
      @keyframes gk-pass-child-give {
        0%, 12% { transform: translate(4px, 5px); }
        40%, 52% { transform: translate(-10px, -8px); }
        78%, 100% { transform: translate(4px, 5px); }
      }
      @keyframes gk-pass-adult-receive {
        0%, 18% { transform: translate(0, 4px); }
        44%, 70% { transform: translate(10px, -6px); }
        100% { transform: translate(0, 4px); }
      }
      @keyframes gk-pass-phone-to-parent {
        0%, 12% { transform: translate(214px, 92px) rotate(8deg); }
        40% { transform: translate(180px, 70px) rotate(0deg); }
        58%, 74% { transform: translate(148px, 78px) rotate(-10deg); }
        100% { transform: translate(214px, 92px) rotate(8deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .gk-pass-adult, .gk-pass-child, .gk-pass-phone { animation: none; }
        .gk-pass-phone { transform: translate(148px, 78px) rotate(-10deg); }
      }
    `}</style>
    </div>
  );
};

export default PassPhoneHandoff;
