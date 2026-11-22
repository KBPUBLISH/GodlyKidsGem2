import React from 'react';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const INK = '#3A2414';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";
const HAND = "'Caveat', 'Patrick Hand', cursive";
const SIGN = "'Pacifico', 'Caveat', cursive";

type ForParentsGateProps = {
  onContinue: () => void;
};

const PROMISES = [
  'Your kids will grow in their Bible knowledge.',
  "They'll ask faith questions that'll keep you on your toes.",
  'They\'ll beg for "just one more story."',
  "They'll get excited about going to church.",
];

const ForParentsGate: React.FC<ForParentsGateProps> = ({ onContinue }) => (
  <div className="w-full max-w-md px-4 pb-2 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
    <p
      className="text-[0.72rem] font-extrabold tracking-[0.26em] uppercase mb-2"
      style={{ fontFamily: BUBBLE, color: GOLD, textShadow: '0 1px 0 #3E1F07' }}
    >
      For parents
    </p>

    <article
      className="relative w-full px-5 pt-6 pb-5 mb-5"
      style={{
        background: 'linear-gradient(180deg, #FFF8E8 0%, #F4E2B8 100%)',
        boxShadow:
          'inset 0 0 0 2px #E8D09A, 0 10px 0 #C9A35A, 0 16px 28px rgba(18, 38, 74, 0.22)',
        transform: 'rotate(-0.6deg)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, transparent, transparent 27px, #C9A35A 27px, #C9A35A 28px)',
          backgroundPosition: '0 42px',
        }}
      />
      <div
        aria-hidden
        className="absolute left-8 top-3 bottom-3 w-px"
        style={{ background: 'rgba(196, 86, 86, 0.28)' }}
      />

      <h1
        className="relative text-center leading-none mb-3"
        style={{ fontFamily: SIGN, color: INK, fontSize: '1.85rem' }}
      >
        Our Promise to You
      </h1>

      <p
        className="relative text-[1.28rem] leading-[1.35] mb-3"
        style={{ fontFamily: HAND, color: INK }}
      >
        Dear parent,
      </p>
      <p
        className="relative text-[1.22rem] leading-[1.38] mb-3"
        style={{ fontFamily: HAND, color: INK }}
      >
        We believe Godly Kids will change how your family talks about God. So
        we&apos;re making you a promise.
      </p>

      <ul className="relative space-y-1.5 mb-3 pl-1">
        {PROMISES.map((line) => (
          <li
            key={line}
            className="flex gap-2 text-[1.18rem] leading-[1.32]"
            style={{ fontFamily: HAND, color: INK }}
          >
            <span aria-hidden className="mt-0.5 text-[#B4532A]">
              ✦
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <p
        className="relative text-[1.22rem] leading-[1.38] mb-2 font-bold"
        style={{ fontFamily: HAND, color: INK }}
      >
        If that doesn&apos;t happen, tell us and we&apos;ll help you get your
        money back. No questions asked.
      </p>
      <p
        className="relative text-[1.05rem] leading-[1.35] mb-5 opacity-90"
        style={{ fontFamily: HAND, color: INK }}
      >
        Email{' '}
        <a href="mailto:support@godlykids.com" className="underline">
          support@godlykids.com
        </a>{' '}
        or tap Settings and we&apos;ll walk you through it.
      </p>

      <div className="relative text-right pr-2">
        <p className="text-[1.15rem] mb-1" style={{ fontFamily: HAND, color: INK }}>
          With love,
        </p>
        <p style={{ fontFamily: SIGN, color: INK, fontSize: '1.7rem', lineHeight: 1.1 }}>
          Micheal Bouchard
        </p>
        <p
          className="text-[1.05rem] mt-0.5"
          style={{ fontFamily: HAND, color: INK }}
        >
          Founder of Godly Kids
        </p>
      </div>
    </article>

    <button
      type="button"
      onClick={onContinue}
      className="w-full px-6 py-3.5 rounded-full font-extrabold text-[1.2rem] leading-tight active:scale-[0.97] transition-transform"
      style={{
        fontFamily: BUBBLE,
        background: GOLD,
        color: NAVY,
        boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
      }}
    >
      I&apos;m in. Let&apos;s set up my family.
    </button>
  </div>
);

export default ForParentsGate;
