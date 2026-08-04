import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Users } from 'lucide-react';
import {
  MAX_CREW,
  rewardsService,
  type UnlockedCharacter,
} from '../services/rewardsService';

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
 * Crew roster — unlocked reward characters; multi-select up to 12 for deck.
 * TODO(later): 3D walking on ship + AI Bible conversations.
 */
const CrewPage: React.FC = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<UnlockedCharacter[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCharacters(rewardsService.getUnlockedCharacters());
    setSelected(rewardsService.getSelectedCrewIds());
  }, []);

  const toggle = (id: string) => {
    const result = rewardsService.toggleCrewMember(id);
    setSelected(result.selectedCrewIds);
    setError(result.error || null);
  };

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

      <div className="flex-1 w-full max-w-md mx-auto flex flex-col items-center px-5 pt-20 pb-10 overflow-y-auto">
        <img
          src={CREW_ICON}
          alt=""
          draggable={false}
          className="w-[min(36vw,140px)] h-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] select-none"
        />
        <h1
          className="font-display font-black uppercase tracking-wide text-2xl text-[#5C3D1E] mt-3"
          style={{
            textShadow: '0 1px 0 rgba(255,240,200,0.6), 0 2px 4px rgba(0,0,0,0.15)',
          }}
        >
          Crew
        </h1>
        <p className="font-display font-bold text-center text-[#6B4423]/85 text-sm max-w-[18rem] mt-1 mb-4">
          Pick up to {MAX_CREW} shipmates for your deck ({selected.length}/{MAX_CREW})
        </p>

        {characters.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 text-[#6B4423]/80">
            <Users size={36} />
            <p className="font-display font-bold text-sm text-center">
              Unlock characters from Island Rewards loot boxes to build your crew.
            </p>
          </div>
        ) : (
          <ul className="w-full space-y-2 mt-2">
            {characters.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:scale-[0.99] transition-transform ${
                      on ? 'bg-[#5C3D1E]/15 ring-2 ring-[#D4A017]' : 'bg-white/50'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-white/80 border-2 border-[#D4A017]/60 flex items-center justify-center flex-shrink-0">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <Users size={24} className="text-[#6B4423]/60" />
                      )}
                    </div>
                    <span className="flex-1 font-display font-black text-[#5C3D1E] text-base truncate">
                      {c.name}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border-2 ${
                        on ? 'bg-amber-400 border-amber-600 text-[#3d2314]' : 'border-[#6B4423]/30'
                      }`}
                    >
                      {on ? <Check size={16} strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="mt-3 font-display font-bold text-amber-800 text-sm text-center">{error}</p>
        )}
        <p className="mt-6 text-[11px] font-display text-[#6B4423]/55 text-center max-w-xs">
          {/* TODO(later): 3D avatars walking on ship deck + AI talk */}
          Walking on deck & conversations coming soon.
        </p>
      </div>
    </div>
  );
};

export default CrewPage;
