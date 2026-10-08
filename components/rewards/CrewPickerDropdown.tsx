import React, { useEffect, useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import {
  MAX_CREW,
  rewardsService,
  type UnlockedCharacter,
} from '../../services/rewardsService';

const CREW_SHIP_DECK_BG = '/assets/images/crew-ship-deck-bg.png';
/** Shared wood texture — matches the Sail / CrewPage wood plaques. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

/** Carved/embossed text — same chrome as CrewPage wood plaques. */
const CARVED_TEXT_SHADOW =
  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional anchor hint — dropdown is fixed near bottom-left (CREW button). */
  anchor?: 'sail' | 'page';
};

/**
 * Face-focused portrait: full-body character art is top-anchored and zoomed
 * so the face fills the tile (object-cover + top bias + slight scale).
 */
const FacePortrait: React.FC<{ imageUrl?: string; dim?: boolean }> = ({
  imageUrl,
  dim,
}) => (
  <div
    className="w-full h-full overflow-hidden bg-[#2a160c]"
    style={{ opacity: dim ? 0.85 : 1 }}
  >
    {imageUrl ? (
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        className="w-full h-full object-cover pointer-events-none select-none"
        style={{
          objectPosition: 'center top',
          transform: 'scale(1.45)',
          transformOrigin: '50% 8%',
        }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <Users size={22} className="text-amber-200/70" aria-hidden />
      </div>
    )}
  </div>
);

/**
 * Multi-select crew roster (max 12) from unlocked reward characters.
 * Wood-plank panel: "On deck" 12-slot grid (selected faces + empty slots),
 * plus a "Your characters" grid of unlocked-but-unselected faces below.
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

  const byId = new Map(characters.map((c) => [c.id, c]));
  // Preserve pick order in the deck grid; drop ids of no-longer-unlocked chars.
  const onDeck = selected
    .map((id) => byId.get(id))
    .filter((c): c is UnlockedCharacter => !!c);
  const available = characters.filter((c) => !selected.includes(c.id));
  const emptyCount = Math.max(0, MAX_CREW - onDeck.length);

  return (
    <div className="fixed inset-0 z-[180]" role="dialog" aria-modal="true" aria-label="Crew picker">
      <img
        src={CREW_SHIP_DECK_BG}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
      />
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close crew picker"
        onClick={onClose}
      />
      <div
        className={`absolute z-[181] w-[min(94vw,380px)] max-h-[min(72vh,560px)] flex flex-col overflow-hidden ${
          anchor === 'sail'
            ? 'left-3 bottom-[max(100px,calc(var(--safe-area-bottom,0px)+84px))]'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
        style={{
          borderRadius: '1.25rem',
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '3px solid #6B4423',
          boxShadow:
            '0 3px 0 #5c3a1a, 0 14px 36px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,230,180,0.35), inset 0 -4px 10px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header — carved title on the wood plank */}
        <div
          className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{
            borderBottom: '2px solid rgba(62,31,7,0.55)',
            boxShadow: 'inset 0 -1px 0 rgba(255,230,180,0.22)',
          }}
        >
          <div
            className="flex items-center gap-2 text-[#F5E6C8]"
            style={{ textShadow: CARVED_TEXT_SHADOW }}
          >
            <Users size={18} aria-hidden />
            <span className="font-display font-black uppercase text-sm tracking-[0.08em]">
              Crew · {selected.length}/{MAX_CREW} spots
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#F5E6C8] active:scale-95 transition-transform"
            style={{
              background: 'rgba(42,22,12,0.6)',
              border: '2px solid #6B4423',
              boxShadow: 'inset 0 1px 0 rgba(255,230,180,0.25), 0 2px 4px rgba(0,0,0,0.35)',
              textShadow: CARVED_TEXT_SHADOW,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3">
          {characters.length === 0 ? (
            <p
              className="font-display font-bold text-[#F5E6C8] text-sm text-center py-8 px-4"
              style={{ textShadow: CARVED_TEXT_SHADOW }}
            >
              Unlock characters from story Rewards loot boxes to build your crew!
            </p>
          ) : (
            <>
              {/* On deck — all 12 slots: selected faces first, then empty slots */}
              <p
                className="font-display font-black uppercase text-[11px] tracking-[0.1em] text-[#F5E6C8] mb-1.5"
                style={{ textShadow: CARVED_TEXT_SHADOW }}
              >
                On deck
              </p>
              <div
                className="rounded-xl p-2"
                style={{
                  background: 'rgba(42,22,12,0.45)',
                  boxShadow:
                    'inset 0 2px 6px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,230,180,0.15)',
                }}
              >
                <ul className="grid grid-cols-4 gap-2" aria-label="Crew slots">
                  {onDeck.map((c) => (
                    <li key={c.id} className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        aria-label={`Remove ${c.name} from crew`}
                        aria-pressed
                        className="relative w-full aspect-square rounded-xl overflow-hidden p-0 m-0 appearance-none cursor-pointer active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        style={{
                          border: '2.5px solid #F5C842',
                          boxShadow:
                            '0 0 0 1.5px #8a5a1c, 0 3px 6px rgba(0,0,0,0.4)',
                        }}
                      >
                        <FacePortrait imageUrl={c.imageUrl} />
                        <span
                          aria-hidden
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-amber-400 text-[#3d2314]"
                          style={{
                            border: '1.5px solid #fde68a',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
                          }}
                        >
                          <Check size={12} strokeWidth={3.5} />
                        </span>
                      </button>
                      <span
                        className="mt-0.5 max-w-full truncate font-display font-bold text-[#F5E6C8] text-[9px] uppercase tracking-wide"
                        style={{ textShadow: CARVED_TEXT_SHADOW }}
                      >
                        {c.name}
                      </span>
                    </li>
                  ))}
                  {Array.from({ length: emptyCount }).map((_, i) => (
                    <li key={`empty-${i}`} className="flex flex-col items-center">
                      <div
                        aria-hidden
                        className="w-full aspect-square rounded-xl flex items-center justify-center"
                        style={{
                          background:
                            'radial-gradient(circle at 50% 40%, rgba(20,10,5,0.55) 0%, rgba(30,16,8,0.75) 100%)',
                          border: '2px dashed rgba(245,230,163,0.28)',
                          boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.55)',
                        }}
                      >
                        <Plus size={18} className="text-[#F5E6A3]/35" strokeWidth={3} />
                      </div>
                      {/* Spacer keeps empty slots row-aligned with named tiles */}
                      <span className="mt-0.5 text-[9px] leading-none">&nbsp;</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Your characters — unlocked but not on deck; tap a face to add */}
              {available.length > 0 && (
                <>
                  <p
                    className="font-display font-black uppercase text-[11px] tracking-[0.1em] text-[#F5E6C8] mt-3 mb-1.5"
                    style={{ textShadow: CARVED_TEXT_SHADOW }}
                  >
                    Your characters
                  </p>
                  <ul
                    className="grid grid-cols-4 gap-2"
                    aria-label="Characters available to add"
                  >
                    {available.map((c) => (
                      <li key={c.id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-label={`Add ${c.name} to crew`}
                          aria-pressed={false}
                          className="relative w-full aspect-square rounded-xl overflow-hidden p-0 m-0 appearance-none cursor-pointer active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          style={{
                            border: '2px solid rgba(245,230,163,0.55)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
                          }}
                        >
                          <FacePortrait imageUrl={c.imageUrl} dim />
                          <span
                            aria-hidden
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[#F5E6C8]"
                            style={{
                              background: 'rgba(42,22,12,0.75)',
                              border: '1.5px solid rgba(245,230,163,0.5)',
                            }}
                          >
                            <Plus size={12} strokeWidth={3.5} />
                          </span>
                        </button>
                        <span
                          className="mt-0.5 max-w-full truncate font-display font-bold text-[#F5E6C8]/90 text-[9px] uppercase tracking-wide"
                          style={{ textShadow: CARVED_TEXT_SHADOW }}
                        >
                          {c.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {error && (
          <p
            className="px-3 pb-1.5 text-center text-amber-200 text-xs font-display font-bold flex-shrink-0"
            style={{ textShadow: CARVED_TEXT_SHADOW }}
          >
            {error}
          </p>
        )}
        <p
          className="px-3 pb-3 text-[10px] text-center text-[#F5E6C8]/75 font-display flex-shrink-0"
          style={{ textShadow: CARVED_TEXT_SHADOW }}
        >
          Tap a crew member on deck to say hi — selection is saved.
        </p>
      </div>
    </div>
  );
};

export default CrewPickerDropdown;
