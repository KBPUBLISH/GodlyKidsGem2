/**
 * Local persistence for Bible Map Rewards unlocks (characters, games,
 * book templates, coin claim tracking) + selected Crew deck roster.
 *
 * TODO(later): sync unlocks to user API; full parrot-shop coin spend beyond
 * grant.
 */

import { getApiBaseUrl } from './apiService';

export type RewardType = 'character' | 'game' | 'coins' | 'book_template';

/** CMS / default pool entry (story-pack rewards config). */
export type RewardDefinition = {
  id: string;
  type: RewardType;
  title: string;
  imageUrl?: string;
  /** character */
  characterName?: string;
  /** character — optional GLB model for 3D walking on the crew deck */
  modelUrl?: string;
  /** character — optional ElevenLabs voice id for spoken chat replies */
  voiceId?: string;
  /** character — optional freeform speech-style description for AI chat */
  persona?: string;
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
  /** Absolute GLB URL — when present the character walks the deck in 3D */
  modelUrl?: string;
  /** ElevenLabs voice id — when present chat replies are spoken via TTS */
  voiceId?: string;
  /** Freeform speech-style description passed to the AI chat endpoint */
  persona?: string;
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
  /** Reward games are one-play-only; set when the kid launches it. */
  playedAt?: number;
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

/** Result of one auto-grant sync pass (see syncNewRewardsForClaimedStories). */
export type RewardSyncSummary = {
  /** Claimed story ids the sync attempted to check. */
  checkedStoryIds: string[];
  /** Subset whose CMS pool actually fetched OK. */
  fetchedStoryIds: string[];
  granted: RewardDefinition[];
  skippedAlreadyClaimed: number;
  skippedCoins: number;
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
 * Resolve CMS media URLs (GCS absolute or /uploads relative) so reward images
 * load inside <img> anywhere — including the buried treasure game iframe on
 * mobile WebViews, where the app origin differs from the API origin.
 */
function resolveRewardImageUrl(url: string | undefined | null): string {
  if (!url || !String(url).trim()) return '';
  const trimmed = String(url).trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  const base = getApiBaseUrl().replace(/\/$/, '');
  const origin = base.replace(/\/api$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

/**
 * Normalize MapStory.rewards (or legacy game) into a pool for the loot modal.
 * Rewards missing their own image fall back to the story pack hero image
 * (coins intentionally stay imageless — the coin icon is expected there).
 */
export function resolveRewardPool(story: {
  _id?: string;
  heroImageUrl?: string;
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
  const heroImage = (story?.heroImageUrl || '').trim();
  const cmsPool = Array.isArray(story?.rewards?.pool) ? story!.rewards!.pool! : [];
  const cleaned = cmsPool
    .filter((r) => r && r.id && r.type)
    .map((r) => {
      const type = r.type as RewardType;
      const ownImage = (r.imageUrl && String(r.imageUrl).trim()) || '';
      const fallbackImage =
        type === 'coins'
          ? ''
          : (type === 'game' ? (story?.game?.webview?.coverImage || '').trim() : '') ||
            heroImage;
      return {
        ...r,
        id: String(r.id),
        type,
        title: (r.title && String(r.title).trim()) || labelForType(type),
        imageUrl: resolveRewardImageUrl(ownImage || fallbackImage) || undefined,
        bookCoverUrl: resolveRewardImageUrl(r.bookCoverUrl) || undefined,
        // 3D crew fields — modelUrl resolves relative CMS paths just like images
        modelUrl: resolveRewardImageUrl(r.modelUrl) || undefined,
        voiceId: (r.voiceId && String(r.voiceId).trim()) || undefined,
        persona: (r.persona && String(r.persona).trim()) || undefined,
      };
    });

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
      imageUrl:
        resolveRewardImageUrl((g.webview.coverImage || '').trim() || heroImage) ||
        undefined,
      gameUrl: g.webview.url.trim(),
    });
  }
  return pool;
}

class RewardsService {
  getUnlockedCharacters(): UnlockedCharacter[] {
    return readStore().characters;
  }

  /**
   * Fetch the current CMS reward pool for each story id. Offline / fetch
   * errors are silent — failed stories are simply absent from the result.
   */
  private async fetchRewardPoolsByStory(
    storyIds: string[],
  ): Promise<Map<string, RewardDefinition[]>> {
    const pools = new Map<string, RewardDefinition[]>();
    const apiRoot = getApiBaseUrl().replace(/\/$/, '');
    await Promise.all(
      storyIds.map(async (sid) => {
        try {
          // no-store: WebView/proxy HTTP caches must never serve a stale
          // story doc here — this fetch is what propagates CMS edits
          // (replaced GLB modelUrl, persona, voiceId…) to stored rewards.
          const res = await fetch(
            `${apiRoot}/bible-map/stories/${encodeURIComponent(sid)}`,
            { cache: 'no-store' },
          );
          if (!res.ok) return;
          const json = await res.json();
          // GET /bible-map/stories/:id wraps the doc: { story, coloringPages }
          const story = json?.story ?? json;
          pools.set(sid, resolveRewardPool(story));
        } catch {
          /* offline / CMS unreachable — keep stored snapshot */
        }
      }),
    );
    return pools;
  }

  /**
   * Story ids whose treasure the user already dug up. A story counts as
   * claimed when EITHER a claimedKey carries its `storyId:` prefix OR the
   * user already holds any reward item stamped with that sourceStoryId —
   * holding Adam proves the Adam & Eve dig happened even if the claimedKeys
   * entries are missing or shaped differently (older app builds wrote claim
   * state through flows that have since changed).
   */
  getClaimedStoryIds(): string[] {
    const store = readStore();
    const ids = new Set<string>();
    for (const key of store.claimedKeys) {
      const idx = key.indexOf(':');
      if (idx > 0) ids.add(key.slice(0, idx));
    }
    const held: { sourceStoryId?: string }[] = [
      ...store.characters,
      ...store.games,
      ...store.bookTemplates,
    ];
    for (const item of held) {
      const sid = (item.sourceStoryId || '').trim();
      if (sid) ids.add(sid);
    }
    return Array.from(ids);
  }

  /**
   * Rewards added to a story pack in the CMS AFTER the kid dug its treasure
   * would otherwise be unreachable (the REWARDS activity is one-shot). For
   * every already-claimed story, re-fetch the current pool and auto-collect
   * items the user doesn't hold yet, via the same collectReward path the dig
   * uses so records look identical. Stories not yet claimed are untouched —
   * their dig stays meaningful. New coins entries are skipped: retroactive
   * coin grants need the UserContext balance and aren't the point of this
   * sync; leaving them unclaimed is harmless.
   */
  async syncNewRewardsForClaimedStories(): Promise<RewardSyncSummary> {
    const checkedStoryIds = this.getClaimedStoryIds();
    const summary: RewardSyncSummary = {
      checkedStoryIds,
      fetchedStoryIds: [],
      granted: [],
      skippedAlreadyClaimed: 0,
      skippedCoins: 0,
    };
    if (checkedStoryIds.length === 0) {
      console.log('⚓ rewards sync: no claimed stories yet — nothing to check');
      return summary;
    }

    const pools = await this.fetchRewardPoolsByStory(checkedStoryIds);
    summary.fetchedStoryIds = Array.from(pools.keys());
    for (const [storyId, pool] of pools) {
      for (const def of pool) {
        if (def.type === 'coins') {
          summary.skippedCoins += 1;
          continue;
        }
        if (this.isClaimed(storyId, def.id)) {
          summary.skippedAlreadyClaimed += 1;
          continue;
        }
        const result = this.collectReward(storyId, def);
        if (result.ok) summary.granted.push(def);
      }
    }

    const failed = checkedStoryIds.length - summary.fetchedStoryIds.length;
    console.log(
      `⚓ rewards sync: fetched ${summary.fetchedStoryIds.length}/${checkedStoryIds.length} claimed stories` +
        (failed > 0 ? ` (${failed} fetch failed — will retry next launch)` : '') +
        `, granted ${summary.granted.length}` +
        (summary.granted.length > 0
          ? ` (${summary.granted
              .map((g) => `${g.type}: ${g.characterName || g.title}`)
              .join(', ')})`
          : '') +
        `, skipped ${summary.skippedAlreadyClaimed} already-claimed + ${summary.skippedCoins} coins`,
    );
    return summary;
  }

  /**
   * App-start sync: auto-collect newly added CMS rewards for claimed stories
   * and refresh stored character fields.
   *
   * The character-field refresh (modelUrl / voiceId / persona / name / image
   * of already-unlocked characters) runs on EVERY startup — it's one
   * lightweight story fetch per source story, and throttling it is exactly
   * how a replaced GLB kept walking the deck with the old model for up to an
   * hour after a CMS edit.
   *
   * Only the auto-grant pass (collecting rewards newly ADDED to a claimed
   * story's pool) is throttled to once per hour so app reloads don't hammer
   * the API with grant bookkeeping. The throttle timestamp is persisted only
   * after a pass where EVERY claimed story fetched successfully, so an
   * offline / cold-start failure retries on the next launch instead of being
   * silently locked out for an hour. The throttle is also bypassed when the
   * claimed-story set changed since the last successful sync (a new dig
   * happened) or when `localStorage.debugForceRewardSync = '1'` is set.
   */
  async syncClaimedRewardsAtStartup(): Promise<void> {
    const AT_KEY = 'godlykids_rewards_cms_sync_at';
    const STORIES_KEY = 'godlykids_rewards_cms_sync_stories';
    const THROTTLE_MS = 60 * 60 * 1000;

    const claimedSig = this.getClaimedStoryIds().sort().join(',');
    let force = false;
    let lastAt = 0;
    let lastSig = '';
    try {
      force = localStorage.getItem('debugForceRewardSync') === '1';
      lastAt = parseInt(localStorage.getItem(AT_KEY) || '0', 10) || 0;
      lastSig = localStorage.getItem(STORIES_KEY) || '';
    } catch {}

    // Never throttled: CMS edits to already-unlocked characters must reach
    // the app on the next launch, not the next hour.
    try {
      await this.refreshUnlockedCharactersFromCms();
    } catch {
      /* offline — stored snapshot stays; crew page retries on mount */
    }

    const withinThrottle = lastAt > 0 && Date.now() - lastAt < THROTTLE_MS;
    if (withinThrottle && !force && claimedSig === lastSig) {
      const minutesLeft = Math.ceil((THROTTLE_MS - (Date.now() - lastAt)) / 60000);
      console.log(
        `⚓ rewards sync: auto-grant throttled, ${minutesLeft}min left ` +
          `(localStorage.debugForceRewardSync='1' to force; character fields were refreshed)`,
      );
      return;
    }

    try {
      const summary = await this.syncNewRewardsForClaimedStories();
      const allFetched =
        summary.checkedStoryIds.length > 0 &&
        summary.fetchedStoryIds.length === summary.checkedStoryIds.length;
      if (allFetched) {
        localStorage.setItem(AT_KEY, String(Date.now()));
        localStorage.setItem(STORIES_KEY, claimedSig);
      }
    } catch {
      /* offline — silently retry on a future launch */
    }
  }

  /**
   * Unlocked characters snapshot CMS reward data at unlock time, so records
   * stored before a CMS edit (e.g. a persona added later) go stale forever.
   * Re-fetch each character's source story and sync name/imageUrl/modelUrl/
   * voiceId/persona from the current CMS reward pool. Offline / fetch errors
   * are silent — stored data stays as-is. Returns true when anything changed.
   */
  async refreshUnlockedCharactersFromCms(): Promise<boolean> {
    const storyIds = Array.from(
      new Set(
        readStore()
          .characters.map((c) => (c.sourceStoryId || '').trim())
          .filter(Boolean),
      ),
    );
    if (storyIds.length === 0) return false;

    const pools = await this.fetchRewardPoolsByStory(storyIds);
    const freshById = new Map<string, RewardDefinition>();
    for (const pool of pools.values()) {
      for (const def of pool) {
        if (def.type === 'character') freshById.set(def.id, def);
      }
    }
    if (freshById.size === 0) return false;

    const store = readStore();
    let changed = false;
    store.characters = store.characters.map((c) => {
      const def = freshById.get(c.id);
      if (!def) return c;
      const next: UnlockedCharacter = {
        ...c,
        name: def.characterName || def.title || c.name,
        imageUrl: def.imageUrl || c.imageUrl,
        // CMS is the source of truth — removed fields clear the stored value
        modelUrl: def.modelUrl,
        voiceId: def.voiceId,
        persona: def.persona,
      };
      if (JSON.stringify(next) !== JSON.stringify(c)) changed = true;
      return next;
    });
    if (changed) writeStore(store);
    return changed;
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

  /** Consume a reward game's single play (no-op if already played). */
  markGamePlayed(gameId: string): void {
    const store = readStore();
    store.games = store.games.map((g) =>
      g.id === gameId && !g.playedAt ? { ...g, playedAt: Date.now() } : g,
    );
    writeStore(store);
  }

  /**
   * Whether this story pack's treasure chest was already dug up — i.e. any of
   * its rewards were collected (claimedKeys are written per storyId:rewardId
   * when the buried-treasure flow calls collectReward). Drives the island
   * REWARDS activity check-mark / not-clickable state.
   */
  hasCollectedStoryRewards(storyId: string): boolean {
    const sid = (storyId || '').trim();
    if (!sid) return false;
    const prefix = `${sid}:`;
    return readStore().claimedKeys.some((k) => k.startsWith(prefix));
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
            modelUrl: def.modelUrl,
            voiceId: def.voiceId,
            persona: def.persona,
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
