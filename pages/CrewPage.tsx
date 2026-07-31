import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Shared wood texture for circular header controls. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const CREW_ICON = '/assets/images/sail-btn-crew.png';

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

/**
 * Crew roster placeholder — wired from the sail-scene Crew button.
 * Full crew / friends UI will land here later.
 */
const CrewPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex flex-col items-center"
      style={{
        background:
          'linear-gradient(180deg, #7ec8f8 0%, #a6dffc 35%, #c8eef6 70%, #e8f6fc 100%)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center px-3"
        style={{ paddingTop: 'max(12px, var(--safe-area-top, 0px))' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-11 h-11 rounded-full text-white active:scale-95 transition-transform"
          style={woodBtnStyle}
          aria-label="Back"
        >
          <ArrowLeft size={22} className="drop-shadow" strokeWidth={2.6} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 pb-16">
        <img
          src={CREW_ICON}
          alt=""
          draggable={false}
          className="w-[min(42vw,180px)] h-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] select-none"
        />
        <h1
          className="font-display font-black uppercase tracking-wide text-2xl text-[#5C3D1E]"
          style={{
            textShadow: '0 1px 0 rgba(255,240,200,0.6), 0 2px 4px rgba(0,0,0,0.15)',
          }}
        >
          Crew
        </h1>
        <p className="font-display font-bold text-center text-[#6B4423]/85 text-sm max-w-[16rem]">
          Meet your shipmates here soon!
        </p>
      </div>
    </div>
  );
};

export default CrewPage;
