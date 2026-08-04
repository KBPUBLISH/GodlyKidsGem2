import React, { useEffect, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import {
  MAX_CREW,
  rewardsService,
  type UnlockedCharacter,
} from '../../services/rewardsService';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional anchor hint — dropdown is fixed near bottom-left (CREW button). */
  anchor?: 'sail' | 'page';
};

/**
 * Multi-select crew roster (max 12) from unlocked reward characters.
 * TODO(later): selected crew walk as 3D avatars on ship deck + AI talk.
 */
const CrewPickerDropdown: React.FC<Props> = ({ open, onClose, anchor = 'sail' }) => {
  const [characters, setCharacters] = useState<UnlockedCharacter[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setCharacters(rewardsService.getUnlockedCharacters());
    setSelected(rewardsService.getSelectedCrewIds());
  };

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    const result = rewardsService.toggleCrewMember(id);
    setSelected(result.selectedCrewIds);
    setError(result.error || null);
    if (result.error) {
      window.setTimeout(() => setError(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[180]" role="dialog" aria-modal="true" aria-label="Crew picker">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close crew picker"
        onClick={onClose}
      />
      <div
        className={`absolute z-[181] w-[min(92vw,320px)] max-h-[min(58vh,420px)] flex flex-col rounded-2xl overflow-hidden ${
          anchor === 'sail'
            ? 'left-3 bottom-[max(88px,calc(var(--safe-area-bottom,0px)+72px))]'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
        style={{
          background:
            'linear-gradient(165deg, #3d2314 0%, #5c3a1a 45%, #2a160c 100%)',
          boxShadow: '0 10px 32px rgba(0,0,0,0.5)',
          border: '2px solid #8B6914',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#F5E6A3]/25">
          <div className="flex items-center gap-2 text-[#F5E6C8]">
            <Users size={18} />
            <span className="font-display font-black uppercase text-sm tracking-wide">
              Crew ({selected.length}/{MAX_CREW})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/25 text-[#F5E6C8]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {characters.length === 0 ? (
            <p className="font-display font-bold text-[#F5E6C8]/80 text-sm text-center py-8 px-4">
              Unlock characters from story Rewards loot boxes to build your crew!
            </p>
          ) : (
            <ul className="space-y-1.5">
              {characters.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                        on ? 'bg-emerald-800/50' : 'bg-black/25 hover:bg-black/35'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2a160c] border-2 border-[#F5E6A3]/50 flex-shrink-0 flex items-center justify-center">
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <Users size={20} className="text-amber-200/70" />
                        )}
                      </div>
                      <span className="flex-1 font-display font-bold text-[#F5E6C8] text-sm truncate">
                        {c.name}
                      </span>
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border ${
                          on
                            ? 'bg-amber-400 border-amber-200 text-[#3d2314]'
                            : 'border-[#F5E6A3]/40 text-transparent'
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p className="px-3 pb-2 text-center text-amber-200 text-xs font-display font-bold">
            {error}
          </p>
        )}
        <p className="px-3 pb-3 text-[10px] text-center text-[#F5E6C8]/55 font-display">
          {/* TODO(later): walking 3D avatars + AI Bible conversations on deck */}
          Deck walking & talk coming soon — selection is saved.
        </p>
      </div>
    </div>
  );
};

export default CrewPickerDropdown;
