import React, { useEffect, useMemo, useState } from 'react';
import { Gift, Sparkles, X, Coins, User, Gamepad2, BookOpen } from 'lucide-react';
import {
  rewardsService,
  type RewardDefinition,
  type RewardType,
} from '../../services/rewardsService';
import { useUser } from '../../context/UserContext';

type Phase = 'closed' | 'opening' | 'choose';

type Props = {
  open: boolean;
  onClose: () => void;
  storyId: string;
  storyTitle?: string;
  pool: RewardDefinition[];
};

const TYPE_ICON: Record<RewardType, React.ElementType> = {
  coins: Coins,
  character: User,
  game: Gamepad2,
  book_template: BookOpen,
};

const TYPE_LABEL: Record<RewardType, string> = {
  coins: 'Gold Coins',
  character: 'Character',
  game: 'New Game',
  book_template: 'Story Template',
};

/**
 * Loot-box open animation → reward cards to collect.
 * Persists unlocks via rewardsService; coins via UserContext.addCoins.
 */
const RewardsLootModal: React.FC<Props> = ({
  open,
  onClose,
  storyId,
  storyTitle,
  pool,
}) => {
  const { addCoins } = useUser();
  const [phase, setPhase] = useState<Phase>('closed');
  const [collectedIds, setCollectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase('closed');
      setCollectedIds([]);
      setToast(null);
      setShake(false);
      return;
    }
    setPhase('closed');
    const claimed = pool
      .filter((r) => rewardsService.isClaimed(storyId, r.id))
      .map((r) => r.id);
    setCollectedIds(claimed);
    const t = window.setTimeout(() => setPhase('opening'), 400);
    const t2 = window.setTimeout(() => setPhase('choose'), 1600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [open, storyId, pool]);

  const options = useMemo(() => pool.filter((r) => r?.id), [pool]);

  if (!open) return null;

  const handleCollect = (def: RewardDefinition) => {
    if (collectedIds.includes(def.id)) return;
    const result = rewardsService.collectReward(storyId, def);
    if (result.alreadyClaimed) {
      setCollectedIds((prev) =>
        prev.includes(def.id) ? prev : [...prev, def.id],
      );
      return;
    }
    if (!result.ok) {
      setToast(result.error || 'Could not collect');
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    if (result.coinsGranted && result.coinsGranted > 0) {
      addCoins(result.coinsGranted, `Rewards loot — ${storyTitle || 'story pack'}`, 'other');
      setToast(`+${result.coinsGranted} gold coins!`);
    } else {
      setToast(`Unlocked: ${def.title}`);
    }
    setCollectedIds((prev) => [...prev, def.id]);
    window.setTimeout(() => setToast(null), 2200);
  };

  const allDone =
    options.length > 0 && options.every((o) => collectedIds.includes(o.id));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rewards loot box"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Close rewards"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-md rounded-2xl overflow-hidden ${shake ? 'animate-pulse' : ''}`}
        style={{
          background:
            'linear-gradient(165deg, #3d2314 0%, #5c3a1a 40%, #2a160c 100%)',
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,230,180,0.25)',
          border: '2px solid #8B6914',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <h2
            className="font-display font-black uppercase tracking-wide text-[#F5E6C8] text-lg"
            style={{
              textShadow: '0 1px 0 #5C2E0B, 0 2px 4px rgba(0,0,0,0.4)',
            }}
          >
            Rewards
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#F5E6C8] bg-black/25 active:scale-95"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {storyTitle ? (
          <p className="px-4 text-[#F5E6C8]/75 text-xs font-display font-bold mb-2">
            {storyTitle}
          </p>
        ) : null}

        {phase !== 'choose' && (
          <div className="flex flex-col items-center justify-center py-10 px-6 min-h-[220px]">
            <div
              className={`relative ${phase === 'opening' ? 'rewards-chest-open' : 'rewards-chest-idle'}`}
            >
              <style>{`
                .rewards-chest-idle { animation: rewardsBob 1.2s ease-in-out infinite; }
                .rewards-chest-open { animation: rewardsBurst 0.9s ease-out forwards; }
                @keyframes rewardsBob {
                  0%, 100% { transform: translateY(0) rotate(-2deg); }
                  50% { transform: translateY(-8px) rotate(2deg); }
                }
                @keyframes rewardsBurst {
                  0% { transform: scale(1) rotate(0); filter: brightness(1); }
                  40% { transform: scale(1.2) rotate(-6deg); filter: brightness(1.3); }
                  100% { transform: scale(1.05) rotate(0); filter: brightness(1.15); }
                }
              `}</style>
              <div
                className="w-28 h-28 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(180deg, #F0D78C 0%, #D4A017 45%, #8B6914 100%)',
                  boxShadow:
                    '0 4px 0 #5c3a1a, 0 8px 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,240,200,0.5)',
                  border: '3px solid #F5E6A3',
                }}
              >
                <Gift
                  size={52}
                  className="text-[#5c3a1a]"
                  strokeWidth={2.2}
                />
              </div>
              {phase === 'opening' && (
                <Sparkles
                  className="absolute -top-3 -right-3 text-amber-300"
                  size={28}
                />
              )}
            </div>
            <p className="mt-5 font-display font-bold text-[#F5E6C8] text-sm">
              {phase === 'closed' ? 'Loot box ready…' : 'Opening…'}
            </p>
          </div>
        )}

        {phase === 'choose' && (
          <div className="px-4 pb-5 pt-1 max-h-[60vh] overflow-y-auto">
            <p className="font-display font-bold text-[#F5E6C8]/90 text-sm mb-3 text-center">
              Pick your rewards!
            </p>
            <div className="grid grid-cols-1 gap-3">
              {options.map((def) => {
                const Icon = TYPE_ICON[def.type] || Gift;
                const done = collectedIds.includes(def.id);
                return (
                  <button
                    key={def.id}
                    type="button"
                    disabled={done}
                    onClick={() => handleCollect(def)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-transform active:scale-[0.98] disabled:opacity-70 ${
                      done ? 'bg-emerald-900/40' : 'bg-black/30 hover:bg-black/40'
                    }`}
                    style={{ border: '1.5px solid rgba(245,230,200,0.35)' }}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#2a160c] flex items-center justify-center border border-[#F5E6A3]/40">
                      {def.imageUrl ? (
                        <img
                          src={def.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <Icon size={28} className="text-amber-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-black text-[#F5E6C8] text-sm truncate">
                        {def.title}
                      </div>
                      <div className="text-[11px] font-display font-bold text-amber-200/80 uppercase tracking-wide">
                        {TYPE_LABEL[def.type]}
                        {def.type === 'coins'
                          ? ` · ${def.coinMin ?? 100}–${def.coinMax ?? 1000}`
                          : ''}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-display font-black uppercase px-2.5 py-1 rounded-full flex-shrink-0 ${
                        done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-[#3d2314]'
                      }`}
                    >
                      {done ? 'Got it!' : 'Collect'}
                    </span>
                  </button>
                );
              })}
            </div>

            {toast && (
              <p className="mt-3 text-center font-display font-bold text-amber-200 text-sm">
                {toast}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-xl font-display font-black uppercase tracking-wide text-[#3d2314] active:scale-[0.98]"
              style={{
                background:
                  'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
                boxShadow: '0 3px 0 #5c3a1a',
                border: '2px solid #F5E6A3',
              }}
            >
              {allDone ? 'Done' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardsLootModal;
