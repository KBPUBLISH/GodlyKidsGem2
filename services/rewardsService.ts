/**
 * Local persistence for Bible Map Rewards unlocks (characters, games,
 * book templates, coin claim tracking) + selected Crew deck roster.
 *
 * TODO(later): sync unlocks to user API; 3D crew walking + AI talk on deck;
 * full parrot-shop coin spend beyond grant.
 */

export type RewardType = 'character' | 'game' | 'coins' | 'book_template';

/** CMS / default pool entry (story-pack rewards config). */
export type RewardDefinition = {
  id: string;
  type: RewardType;
  title: string;
  imageUrl?: string;
  /** character */
  characterName?: string;
  /** game — 1:1 icon + link */
  gameUrl?: string;
  /** book_template — Kids Monthly Book id */
  bookId?: string;
  bookCoverUrl?: string;
  /** coins range (inclusive) */
  coinMin?: number;
  coinMax?: number;
};

export type UnlockedCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  sourceStoryId?: string;
  unlockedAt: number;
};

export type UnlockedRewardGame = {
  id: string;
  name: string;
  imageUrl?: string;
  url: string;
  sourceStoryId?: string;
  unlockedAt: number;
  /** Show NEW until dismissed / opened */
  isNew: boolean;
};

export type UnlockedBookTemplate = {
  id: string;
  bookId: string;
  title: string;
  coverUrl?: string;
  sourceStoryId?: string;
  unlockedAt: number;
  isNew: boolean;
};

type RewardsStore = {
  characters: UnlockedCharacter[];
  games: UnlockedRewardGame[];
  bookTemplates: UnlockedBookTemplate[];
  /** storyId:rewardId keys already collected */
  claimedKeys: string[];
  /** Selected crew character ids (max 12) for sail deck */
  selectedCrewIds: string[];
};

const STORAGE_KEY = 'godlykids_rewards_v1';
export const MAX_CREW = 12;

const EMPTY: RewardsStore = {
  characters: [],
  games: [],
  bookTemplates: [],
  claimedKeys: [],
  selectedCrewIds: [],
};

const claimKey = (storyId: string, rewardId: string) =>
  `${storyId.trim()}:${rewardId.trim()}`;

function readStore(): RewardsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, characters: [], games: [], bookTemplates: [], claimedKeys: [], selectedCrewIds: [] };
    const parsed = JSON.parse(raw) as Partial<RewardsStore>;
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      games: Array.isArray(parsed.games) ? parsed.games : [],
      bookTemplates: Array.isArray(parsed.bookTemplates) ? parsed.bookTemplates : [],
      claimedKeys: Array.isArray(parsed.claimedKeys) ? parsed.claimedKeys : [],
      selectedCrewIds: Array.isArray(parsed.selectedCrewIds)
        ? parsed.selectedCrewIds.slice(0, MAX_CREW)
        : [],
    };
  } catch {
    return { ...EMPTY, characters: [], games: [], bookTemplates: [], claimedKeys: [], selectedCrewIds: [] };
  }
}

function writeStore(store: RewardsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('rewardsService: failed to save', err);
  }
}

/** Default pool when CMS rewards.pool is empty — gold coins always available. */
export function defaultRewardPool(storyId?: string): RewardDefinition[] {
  const suffix = storyId ? `-${storyId.slice(-6)}` : '';
  return [
    {
      id: `default-coins${suffix}`,
      type: 'coins',
      title: 'Gold Coins',
      coinMin: 100,
      coinMax: 1000,
    },
  ];
}

export function randomCoinAmount(min = 100, max = 1000): number {
  const lo = Math.max(1, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function labelForType(type: RewardType): string {
  switch (type) {
    case 'character':
      return 'Character';
    case 'game':
      return 'New Game';
    case 'coins':
      return 'Gold Coins';
    case 'book_template':
      return 'Story Template';
    default:
      return 'Reward';
  }
}

/**
 * Normalize MapStory.rewards (or legacy game) into a pool for the loot modal.
 */
export function resolveRewardPool(story: {
  _id?: string;
  rewards?: {
    enabled?: boolean;
    pool?: RewardDefinition[];
  };
  game?: {
    enabled?: boolean;
    kind?: string;
    gameId?: string;
    webview?: { title?: string; url?: string; coverImage?: string };
  };
} | null | undefined): RewardDefinition[] {
  const storyId = story?._id ? String(story._id) : '';
  const cmsPool = Array.isArray(story?.rewards?.pool) ? story!.rewards!.pool! : [];
  const cleaned = cmsPool
    .filter((r) => r && r.id && r.type)
    .map((r) => ({
      ...r,
      id: String(r.id),
      type: r.type as RewardType,
      title: (r.title && String(r.title).trim()) || labelForType(r.type as RewardType),
    }));

  if (cleaned.length > 0) {
    if (!cleaned.some((r) => r.type === 'coins')) {
      return [...cleaned, ...defaultRewardPool(storyId)];
    }
    return cleaned;
  }

  const pool = defaultRewardPool(storyId);
  const g = story?.game;
  if (g?.enabled && g.kind === 'webview' && g.webview?.url?.trim()) {
    pool.unshift({
      id: `legacy-game-${storyId || 'pack'}`,
      type: 'game',
      title: (g.webview.title && g.webview.title.trim()) || 'New Game',
      imageUrl: g.webview.coverImage,
      gameUrl: g.webview.url.trim(),
    });
  }
  return pool;
}

class RewardsService {
  getUnlockedCharacters(): UnlockedCharacter[] {
    return readStore().characters;
  }

  getUnlockedGames(): UnlockedRewardGame[] {
    return readStore().games;
  }

  getUnlockedBookTemplates(): UnlockedBookTemplate[] {
    return readStore().bookTemplates;
  }

  getSelectedCrewIds(): string[] {
    return readStore().selectedCrewIds;
  }

  isClaimed(storyId: string, rewardId: string): boolean {
    if (!storyId?.trim() || !rewardId?.trim()) return false;
    return readStore().claimedKeys.includes(claimKey(storyId, rewardId));
  }

  setSelectedCrewIds(ids: string[]): string[] {
    const store = readStore();
    const unlocked = new Set(store.characters.map((c) => c.id));
    const next = ids.filter((id) => unlocked.has(id)).slice(0, MAX_CREW);
    store.selectedCrewIds = next;
    writeStore(store);
    return next;
  }

  toggleCrewMember(characterId: string): { selectedCrewIds: string[]; error?: string } {
    const store = readStore();
    const exists = store.characters.some((c) => c.id === characterId);
    if (!exists) return { selectedCrewIds: store.selectedCrewIds, error: 'Character not unlocked' };
    const idx = store.selectedCrewIds.indexOf(characterId);
    if (idx >= 0) {
      store.selectedCrewIds = store.selectedCrewIds.filter((id) => id !== characterId);
    } else {
      if (store.selectedCrewIds.length >= MAX_CREW) {
        return {
          selectedCrewIds: store.selectedCrewIds,
          error: `You can pick up to ${MAX_CREW} crew members`,
        };
      }
      store.selectedCrewIds = [...store.selectedCrewIds, characterId];
    }
    writeStore(store);
    return { selectedCrewIds: store.selectedCrewIds };
  }

  markGameSeen(gameId: string): void {
    const store = readStore();
    store.games = store.games.map((g) =>
      g.id === gameId ? { ...g, isNew: false } : g,
    );
    writeStore(store);
  }

  markBookTemplateSeen(templateId: string): void {
    const store = readStore();
    store.bookTemplates = store.bookTemplates.map((t) =>
      t.id === templateId ? { ...t, isNew: false } : t,
    );
    writeStore(store);
  }

  /**
   * Collect a reward from a story pack loot box.
   * Returns coin amount when type is coins; otherwise null.
   */
  collectReward(
    storyId: string,
    def: RewardDefinition,
  ): { ok: boolean; coinsGranted?: number; error?: string; alreadyClaimed?: boolean } {
    if (!storyId?.trim() || !def?.id) {
      return { ok: false, error: 'Missing story or reward' };
    }
    const store = readStore();
    const key = claimKey(storyId, def.id);
    if (store.claimedKeys.includes(key)) {
      return { ok: false, alreadyClaimed: true, error: 'Already collected' };
    }

    const now = Date.now();

    if (def.type === 'coins') {
      const amount = randomCoinAmount(def.coinMin ?? 100, def.coinMax ?? 1000);
      store.claimedKeys = [...store.claimedKeys, key];
      writeStore(store);
      return { ok: true, coinsGranted: amount };
    }

    if (def.type === 'character') {
      const charId = def.id;
      if (!store.characters.some((c) => c.id === charId)) {
        store.characters = [
          ...store.characters,
          {
            id: charId,
            name: def.characterName || def.title || 'Crew Friend',
            imageUrl: def.imageUrl || '',
            sourceStoryId: storyId,
            unlockedAt: now,
          },
        ];
      }
      store.claimedKeys = [...store.claimedKeys, key];
      writeStore(store);
      return { ok: true };
    }

    if (def.type === 'game') {
      const url = (def.gameUrl || '').trim();
      if (!url) return { ok: false, error: 'Game URL missing' };
      if (!store.games.some((g) => g.id === def.id)) {
        store.games = [
          ...store.games,
          {
            id: def.id,
            name: def.title || 'New Game',
            imageUrl: def.imageUrl,
            url,
            sourceStoryId: storyId,
            unlockedAt: now,
            isNew: true,
          },
        ];
      }
      store.claimedKeys = [...store.claimedKeys, key];
      writeStore(store);
      return { ok: true };
    }

    if (def.type === 'book_template') {
      const bookId = (def.bookId || '').trim();
      if (!bookId) return { ok: false, error: 'Book template id missing' };
      if (!store.bookTemplates.some((t) => t.id === def.id || t.bookId === bookId)) {
        store.bookTemplates = [
          ...store.bookTemplates,
          {
            id: def.id,
            bookId,
            title: def.title || 'Dive Deeper Story',
            coverUrl: def.bookCoverUrl || def.imageUrl,
            sourceStoryId: storyId,
            unlockedAt: now,
            isNew: true,
          },
        ];
      }
      store.claimedKeys = [...store.claimedKeys, key];
      writeStore(store);
      return { ok: true };
    }

    return { ok: false, error: 'Unknown reward type' };
  }
}

export const rewardsService = new RewardsService();
