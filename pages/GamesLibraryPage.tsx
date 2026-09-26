import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Lock } from 'lucide-react';
import { ApiService } from '../services/apiService';
import {
  rewardsService,
  type UnlockedRewardGame,
} from '../services/rewardsService';
import { toKidSafeGameUrl } from '../utils/kidSafeGameIframe';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const GAMES_ICON = '/assets/images/rewards-gamepad-icon.png';

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

type LibraryGame = {
  id: string;
  name: string;
  imageUrl?: string;
  url: string;
  unlocked: boolean;
  isNew: boolean;
  /** Reward games are one-play-only — true once the single play is used. */
  played: boolean;
  source: 'reward' | 'placeholder' | 'cms';
};

/** Future / teaser slots — stay locked until collected via Rewards loot. */
const LOCKED_PLACEHOLDERS: LibraryGame[] = [
  {
    id: 'placeholder-mystery-quest',
    name: 'Mystery Quest',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
  {
    id: 'placeholder-bible-race',
    name: 'Bible Race',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
  {
    id: 'placeholder-ark-builder',
    name: 'Ark Builder',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
  {
    id: 'placeholder-fishers',
    name: 'Fishers of Men',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
  {
    id: 'placeholder-temple-run',
    name: 'Temple Path',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
  {
    id: 'placeholder-shepherd',
    name: 'Shepherd Hero',
    imageUrl: undefined,
    url: '',
    unlocked: false,
    isNew: false,
    played: false,
    source: 'placeholder',
  },
];

const SLOTS_PER_SHELF = 3;

function chunkShelves(games: LibraryGame[]): LibraryGame[][] {
  const shelves: LibraryGame[][] = [];
  for (let i = 0; i < games.length; i += SLOTS_PER_SHELF) {
    shelves.push(games.slice(i, i + SLOTS_PER_SHELF));
  }
  if (shelves.length === 0) {
    shelves.push([]);
  }
  return shelves;
}

function fromReward(g: UnlockedRewardGame): LibraryGame {
  return {
    id: g.id,
    name: g.name,
    imageUrl: g.imageUrl,
    url: g.url,
    unlocked: true,
    isNew: g.isNew,
    played: Boolean(g.playedAt),
    source: 'reward',
  };
}

/**
 * Games Library — wood-shelf catalog of reward-unlocked games (+ locked teasers).
 * Unlock via Island Rewards loot boxes (rewardsService). Old /games island page stays intact.
 */
const GamesLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [rewardGames, setRewardGames] = useState<UnlockedRewardGame[]>([]);
  const [cmsCovers, setCmsCovers] = useState<
    Record<string, { name?: string; imageUrl?: string }>
  >({});
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRewardGames(rewardsService.getUnlockedGames());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await ApiService.getEnabledGames({ forceRefresh: false });
        if (cancelled || !Array.isArray(data)) return;
        const byUrl: Record<string, { name?: string; imageUrl?: string }> = {};
        for (const g of data) {
          const url = typeof g?.url === 'string' ? g.url.trim() : '';
          if (!url) continue;
          byUrl[url] = {
            name: g.name,
            imageUrl: g.logo || g.coverImage || undefined,
          };
        }
        setCmsCovers(byUrl);
      } catch {
        /* optional enrich — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const catalog = useMemo(() => {
    const unlockedIds = new Set(rewardGames.map((g) => g.id));
    const unlockedUrls = new Set(
      rewardGames.map((g) => (g.url || '').trim()).filter(Boolean),
    );

    const unlocked: LibraryGame[] = rewardGames.map((g) => {
      const base = fromReward(g);
      const cms = g.url ? cmsCovers[g.url.trim()] : undefined;
      return {
        ...base,
        name: base.name || cms?.name || 'Game',
        imageUrl: base.imageUrl || cms?.imageUrl,
      };
    });

    // Sort newest unlocks first so “NEW” sits near the top shelves.
    unlocked.sort((a, b) => {
      const aAt =
        rewardGames.find((r) => r.id === a.id)?.unlockedAt ?? 0;
      const bAt =
        rewardGames.find((r) => r.id === b.id)?.unlockedAt ?? 0;
      return bAt - aAt;
    });

    const locked = LOCKED_PLACEHOLDERS.filter(
      (p) => !unlockedIds.has(p.id) && !unlockedUrls.has(p.url),
    );

    return [...unlocked, ...locked];
  }, [rewardGames, cmsCovers]);

  const shelves = useMemo(() => chunkShelves(catalog), [catalog]);

  const showLockedToast = () => {
    setToast('Sail & read stories to unlock!');
  };

  const playGame = (game: LibraryGame) => {
    if (!game.unlocked || !game.url) {
      showLockedToast();
      return;
    }
    if (game.source === 'reward') {
      if (game.played) {
        setToast('You already played this one — one time only!');
        return;
      }
      rewardsService.markGameSeen(game.id);
      // Reward games are one-play-only: consume the play at launch so the
      // island REWARDS activity shows Claimed when the kid returns.
      rewardsService.markGamePlayed(game.id);
      setRewardGames(rewardsService.getUnlockedGames());
    }
    // Famobi play links are rewritten to CDN embeds inside /game (skip splash).
    const playUrl = toKidSafeGameUrl(game.url);
    navigate(
      `/game?url=${encodeURIComponent(playUrl)}&name=${encodeURIComponent(game.name)}`,
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col">
      {/* Warm room / wall behind shelves */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, #6b4226 0%, #3d2414 45%, #1a100a 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply"
        aria-hidden
        style={{
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: '420px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Header */}
      <div
        className="relative z-20 flex items-center gap-3 px-3"
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
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={GAMES_ICON}
            alt=""
            draggable={false}
            className="w-10 h-10 object-contain drop-shadow select-none"
          />
          <div className="min-w-0">
            <h1
              className="font-display font-black uppercase tracking-wide text-xl text-[#F5E6C8] leading-tight truncate"
              style={{ textShadow: '0 2px 6px rgba(0,0,0,0.55)' }}
            >
              Games Library
            </h1>
            <p className="font-display text-[11px] text-[#F5E6C8]/75 truncate">
              Unlock games from Rewards loot boxes
            </p>
          </div>
        </div>
      </div>

      {/* Shelves */}
      <div
        className="relative z-10 flex-1 overflow-y-auto no-scrollbar px-3 pb-8"
        style={{
          // Clear the fixed wood tab bar (now shown on this page) + safe area.
          paddingBottom:
            'calc(var(--safe-area-bottom, 0px) + var(--map-footer-h, 78px) + var(--wood-tab-lift, 12px) + 24px)',
        }}
      >
        <div className="max-w-md mx-auto mt-4 space-y-7">
          {shelves.map((shelfGames, shelfIdx) => (
            <div key={`shelf-${shelfIdx}`} className="relative">
              {/* Icons sitting on the shelf */}
              <div className="relative z-[1] grid grid-cols-3 gap-3 px-2 pb-2">
                {Array.from({ length: SLOTS_PER_SHELF }).map((_, slotIdx) => {
                  const game = shelfGames[slotIdx];
                  if (!game) {
                    return <div key={`empty-${shelfIdx}-${slotIdx}`} />;
                  }
                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => playGame(game)}
                      className="flex flex-col items-center gap-1.5 group cursor-pointer select-none focus:outline-none active:scale-95 transition-transform"
                      aria-label={
                        !game.unlocked
                          ? `${game.name}, locked`
                          : game.played
                            ? `${game.name}, already played`
                            : `Play ${game.name}`
                      }
                    >
                      <div
                        className={`relative w-full aspect-square rounded-[22%] overflow-hidden border-2 shadow-lg ${
                          game.unlocked
                            ? 'border-amber-300/70 group-hover:border-amber-200'
                            : 'border-[#5c3a1a]/80'
                        }`}
                        style={{
                          boxShadow: game.unlocked
                            ? '0 6px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,230,180,0.25)'
                            : '0 4px 10px rgba(0,0,0,0.5)',
                        }}
                      >
                        {game.imageUrl ? (
                          <img
                            src={game.imageUrl}
                            alt=""
                            draggable={false}
                            className={`w-full h-full object-cover ${
                              !game.unlocked
                                ? 'grayscale brightness-75'
                                : game.played
                                  ? 'grayscale-[0.7] brightness-90'
                                  : ''
                            }`}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center ${
                              game.unlocked
                                ? 'bg-gradient-to-br from-amber-500 to-orange-800'
                                : 'bg-gradient-to-br from-[#4a3424] to-[#2a1a10] grayscale'
                            }`}
                          >
                            <Gamepad2
                              className={`w-14 h-14 ${
                                game.unlocked ? 'text-white/75' : 'text-white/35'
                              }`}
                            />
                          </div>
                        )}

                        {!game.unlocked && (
                          <>
                            <div className="absolute inset-0 bg-[#1a100a]/45" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div
                                className="w-11 h-11 rounded-full flex items-center justify-center"
                                style={{
                                  background:
                                    'radial-gradient(circle at 35% 30%, #c9a227, #8a6914 55%, #5c450c)',
                                  boxShadow:
                                    '0 3px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,230,160,0.45)',
                                  border: '2px solid #5c3a1a',
                                }}
                              >
                                <Lock
                                  size={20}
                                  className="text-[#3d2414]"
                                  strokeWidth={2.8}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {game.unlocked && game.played && (
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full z-10 shadow">
                            PLAYED
                          </div>
                        )}

                        {game.unlocked && !game.played && game.isNew && (
                          <div className="absolute top-1 right-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full z-10 shadow">
                            NEW
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-display font-bold text-center leading-tight line-clamp-2 w-full drop-shadow-md ${
                          game.unlocked ? 'text-[#F5E6C8]' : 'text-[#F5E6C8]/55'
                        }`}
                      >
                        {game.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Wood plank shelf */}
              <div
                className="relative h-[18px] rounded-md overflow-hidden"
                style={{
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow:
                    '0 8px 16px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,220,160,0.28), inset 0 -3px 4px rgba(0,0,0,0.35)',
                  border: '1px solid #5c3a1a',
                }}
                aria-hidden
              >
                <div
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{
                    background:
                      'linear-gradient(to bottom, rgba(255,230,180,0.35), transparent)',
                  }}
                />
                <div
                  className="absolute inset-x-2 bottom-0 h-[4px] rounded-full blur-[2px]"
                  style={{ background: 'rgba(0,0,0,0.35)' }}
                />
              </div>
              {/* Shelf brackets */}
              <div
                className="absolute left-1 bottom-[6px] w-2.5 h-5 rounded-sm"
                style={{
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  boxShadow: '1px 2px 4px rgba(0,0,0,0.4)',
                  border: '1px solid #4a2e14',
                }}
                aria-hidden
              />
              <div
                className="absolute right-1 bottom-[6px] w-2.5 h-5 rounded-sm"
                style={{
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  boxShadow: '-1px 2px 4px rgba(0,0,0,0.4)',
                  border: '1px solid #4a2e14',
                }}
                aria-hidden
              />
            </div>
          ))}

          {rewardGames.length === 0 && (
            <p className="font-display font-bold text-center text-[#F5E6C8]/70 text-sm px-4 pt-2">
              Finish island story packs and open Rewards loot boxes to fill your
              shelves!
            </p>
          )}
        </div>
      </div>

      {/* Gentle toast */}
      {toast && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 px-4 py-2.5 rounded-2xl font-display font-bold text-sm text-[#3d2414] text-center max-w-[85vw]"
          style={{
            bottom: 'max(28px, calc(var(--safe-area-bottom, 0px) + 16px))',
            background:
              'linear-gradient(180deg, #F5E6C8 0%, #E8D4A8 100%)',
            boxShadow:
              '0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
            border: '2px solid #8B6914',
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
};

export default GamesLibraryPage;
