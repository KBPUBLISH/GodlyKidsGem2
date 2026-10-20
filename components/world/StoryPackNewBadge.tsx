import React from 'react';

/** Gold "NEW" chip for an unlocked-but-unopened story pack on the island map. */
const StoryPackNewBadge: React.FC = () => (
  <span
    className="absolute z-[3] pointer-events-none select-none font-display font-black uppercase text-white"
    data-testid="story-pack-new-badge"
    style={{
      top: '-6%',
      right: '-8%',
      fontSize: '0.55rem',
      lineHeight: 1,
      letterSpacing: '0.07em',
      padding: '3px 7px 2px',
      borderRadius: 9999,
      background: 'linear-gradient(180deg, #FFB03B 0%, #F4511E 100%)',
      border: '1.5px solid rgba(255,255,255,0.9)',
      boxShadow: '0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,235,200,0.6)',
      textShadow: '0 1px 2px rgba(0,0,0,0.35)',
      animation: 'gk-pack-new-wiggle 2.4s ease-in-out infinite',
    }}
    aria-hidden
  >
    NEW
    <style>{`@keyframes gk-pack-new-wiggle{0%,20%,100%{transform:rotate(-4deg) scale(1)}6%{transform:rotate(5deg) scale(1.12)}12%{transform:rotate(-4deg) scale(1)}}`}</style>
  </span>
);

export default StoryPackNewBadge;
