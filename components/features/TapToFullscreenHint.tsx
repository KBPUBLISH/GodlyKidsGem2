import React from 'react';

/**
 * Bouncing finger over the page art telling kids they can tap the picture or
 * video to go full screen. Purely decorative — pointer-events are off so the
 * tap lands on the art underneath, which is what toggles the reading scroll.
 */
interface TapToFullscreenHintProps {
  /** Vertical position of the finger tip (CSS top, e.g. '34%'). */
  top?: string;
  label?: string;
}

const TapToFullscreenHint: React.FC<TapToFullscreenHintProps> = ({
  top = '34%',
  label = 'Tap for full screen',
}) => (
  <div
    aria-hidden
    className="absolute left-1/2 z-[60] pointer-events-none select-none flex flex-col items-center"
    style={{ top, transform: 'translateX(-50%)', animation: 'reader-fs-hint-in 420ms ease-out both' }}
  >
    <div className="reader-fs-hint-ring" />
    <img
      src="/assets/images/finger-pointer.png"
      alt=""
      draggable={false}
      className="reader-fs-hint-finger w-[64px] h-[64px] object-contain drop-shadow-lg"
      onError={(e) => {
        const img = e.currentTarget;
        img.style.display = 'none';
        const fallback = document.createElement('span');
        fallback.className = 'reader-fs-hint-finger';
        fallback.style.fontSize = '48px';
        fallback.textContent = '👆';
        img.parentElement?.insertBefore(fallback, img);
      }}
    />
    <span
      className="mt-1 rounded-full px-3 py-1 text-[12px] font-black uppercase tracking-wide text-[#3D2314]"
      style={{
        background: 'linear-gradient(180deg, #FFE68A 0%, #F5C518 100%)',
        border: '2px solid #B8860B',
        boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
        fontFamily: '"Nunito", sans-serif',
      }}
    >
      {label}
    </span>
    <style>{`
      @keyframes reader-fs-hint-in {
        from { opacity: 0; transform: translateX(-50%) scale(0.8); }
        to { opacity: 1; transform: translateX(-50%) scale(1); }
      }
      @keyframes reader-fs-hint-tap {
        0%, 100% { transform: translateY(0) scale(1); }
        40% { transform: translateY(10px) scale(0.92); }
        55% { transform: translateY(10px) scale(0.92); }
      }
      @keyframes reader-fs-hint-ring {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
        45% { opacity: 0.85; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); }
      }
      .reader-fs-hint-finger {
        animation: reader-fs-hint-tap 1.3s ease-in-out infinite;
        transform-origin: 50% 90%;
      }
      .reader-fs-hint-ring {
        position: absolute;
        top: 8px;
        left: 50%;
        width: 54px;
        height: 54px;
        border-radius: 999px;
        border: 3px solid rgba(255, 230, 138, 0.95);
        box-shadow: 0 0 14px rgba(245, 197, 24, 0.7);
        transform: translate(-50%, -50%);
        animation: reader-fs-hint-ring 1.3s ease-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .reader-fs-hint-finger, .reader-fs-hint-ring { animation: none; }
        .reader-fs-hint-ring { opacity: 0.7; }
      }
    `}</style>
  </div>
);

export default TapToFullscreenHint;
