import { getBibleMapApiRoot, resolveBibleMapMediaUrl } from './bibleMapApi';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { isPlayableMainMapStory, isStoryPackComplete } from './mainMapStoryUnlock';
import type { TryItPayload } from './tryItContent';

export type OceanMapIslandStatus = 'complete' | 'current' | 'locked';

export interface OceanMapIsland {
  id: string;
  /** Mongo ObjectId from CMS — used to match story.islandId. */
  cmsId?: string;
  book: string;
  title: string;
  status: OceanMapIslandStatus;
  storiesComplete: number;
  storiesTotal: number;
  x: number;
  y: number;
  /** Ocean-map island art from CMS (optional). */
  mapArtUrl?: string;
  /** Optional sail-carousel upload; sail deck prefers map art, then this. */
  sailArtUrl?: string;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  /** True when this row came from the Bible Map API. */
  fromApi?: boolean;
}

/** Lightweight published story row for map progress markers. */
export type OceanMapStoryRow = {
  _id: string;
  islandId?: string | { _id?: string; slug?: string };
  status?: string;
  quizMode?: string;
  bookId?: unknown;
  customQuestions?: unknown[];
  quiz?: {
    levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
  };
  /** Try It beat — when present it is part of pack completion. */
  tryIt?: TryItPayload;
};

/** Island keys a story can match (ObjectId and/or slug). */
export const storyIslandKeys = (row: OceanMapStoryRow): string[] => {
  const raw = row.islandId;
  if (!raw) return [];
  if (typeof raw === 'string' || typeof raw === 'number') return [String(raw)];
  return [raw._id, raw.slug].filter(Boolean).map(String);
};

export type ApiIslandRow = {
  _id?: string;
  slug?: string;
  title?: string;
  bookLabel?: string;
  description?: string;
  mapArtUrl?: string;
  sailArtUrl?: string;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  mapPosition?: { x?: number; y?: number };
  order?: number;
  unlockRule?: string;
  status?: string;
  storyCounts?: { total?: number; published?: number };
};

/**
 * Abort budget for the CMS island fetch. Generous because the API is often a
 * cold-starting free-tier dyno; the fallback island paints immediately either
 * way, so a longer wait only means real islands still arrive instead of never.
 */
export const CMS_ISLANDS_TIMEOUT_MS = 15_000;

/**
 * Art URL for an ocean-map island — CMS upload only. Islands with no uploaded
 * `mapArtUrl` render the status disc (gold / green / grey with star, check or
 * padlock) that both the map and the Explore backdrop already draw, so there
 * is no art-less hole to fill with a generic placeholder.
 */
export const getOceanIslandArtSrc = (island: OceanMapIsland): string | undefined =>
  island.mapArtUrl || undefined;

/** Sail deck island art — same map icon the ocean map uses, then sail upload. */
export const getSailIslandArtSrc = (island: OceanMapIsland): string | undefined =>
  island.mapArtUrl || island.sailArtUrl || undefined;

export const mapApiIslandToOceanIsland = (
  row: ApiIslandRow,
  index: number,
): OceanMapIsland | null => {
  const id = (row.slug || row._id || '').toString().trim();
  if (!id) return null;
  const storiesTotal = Math.max(
    0,
    Number(row.storyCounts?.published ?? row.storyCounts?.total ?? 0) || 0,
  );
  const book = (row.bookLabel || row.title || id).trim();
  const x =
    typeof row.mapPosition?.x === 'number' && Number.isFinite(row.mapPosition.x)
      ? row.mapPosition.x
      : 50;
  // The ocean map lays islands out in measured pixel slots and ignores these
  // coordinates; only the Explore backdrop still positions by x/y.
  const y =
    typeof row.mapPosition?.y === 'number' && Number.isFinite(row.mapPosition.y)
      ? row.mapPosition.y
      : Math.min(90, 8 + index * 18);
  // Published islands are tappable for CMS testing (progress wiring later).
  // Draft islands still appear on the voyage — locked, but with their CMS art.
  const status: OceanMapIslandStatus = row.status === 'published' ? 'current' : 'locked';
  return {
    id,
    cmsId: row._id ? String(row._id) : undefined,
    book,
    title: (row.description || row.title || 'Adventure').trim(),
    status,
    storiesComplete: 0,
    storiesTotal: storiesTotal || 1,
    x,
    y,
    mapArtUrl: resolveBibleMapMediaUrl(row.mapArtUrl) || undefined,
    sailArtUrl: resolveBibleMapMediaUrl(row.sailArtUrl) || undefined,
    mainMapUrl: resolveBibleMapMediaUrl(row.mainMapUrl) || undefined,
    mainMapVideoUrl: resolveBibleMapMediaUrl(row.mainMapVideoUrl) || undefined,
    fromApi: true,
  };
};

/**
 * Fetch ocean-map islands (CMS icons + positions) — all statuses, so draft
 * islands show their uploaded art as locked previews. The CMS is the only
 * source of islands; nothing is padded in.
 * Returns null on an empty list so callers can show their error state rather
 * than an ocean that looks like it simply has nothing on it.
 */
export const fetchOceanMapIslands = async (
  signal?: AbortSignal,
): Promise<OceanMapIsland[] | null> => {
  const res = await fetch(`${getBibleMapApiRoot()}/bible-map/islands?status=all`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as ApiIslandRow[];
  if (!Array.isArray(data) || data.length === 0) return null;
  const mapped = data
    .filter((row) => row.status !== 'archived')
    .map((row, i) => mapApiIslandToOceanIsland(row, i))
    .filter((row): row is OceanMapIsland => row != null);
  if (mapped.length === 0) return null;
  return mapped;
};

/**
 * Published story packs for ocean-map progress markers (read + quiz complete).
 * Returns null on failure so callers can fall back to local progress counts.
 */
export const fetchPublishedMapStories = async (
  signal?: AbortSignal,
): Promise<OceanMapStoryRow[] | null> => {
  const res = await fetch(`${getBibleMapApiRoot()}/bible-map/stories`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as OceanMapStoryRow[];
  if (!Array.isArray(data) || data.length === 0) return null;
  return data.filter((row) => row && row._id);
};

/** Island id aliases a story row may be filed under (slug + CMS ObjectId). */
export const oceanIslandAliases = (
  island: Pick<OceanMapIsland, 'id' | 'cmsId'>,
): string[] =>
  [island.id, island.cmsId]
    .map((id) => (id == null ? '' : String(id).trim()))
    .filter(Boolean);

/**
 * Stories-complete count for one island, from the same source the story
 * flow writes to (`islandStoryProgressService`, stamped by the reader /
 * quiz / Try It pages). A story is complete when its pack beats are done:
 * Read + Quiz (when it has quiz content) + Try It (when it has Try It) —
 * the rule the ocean map and sequential unlock already use.
 *
 * `mapStories` is the published story list from `fetchPublishedMapStories`.
 * Story rows match the island by slug or CMS ObjectId, and progress lookup
 * tolerates completions saved under either island alias (or `genesis`).
 * Without a story list we fall back to counting locally read stories.
 * The result is clamped so the pill never shows more than the total.
 */
export const countIslandStoriesComplete = (
  island: Pick<OceanMapIsland, 'id' | 'cmsId' | 'storiesTotal'>,
  mapStories: ReadonlyArray<OceanMapStoryRow> | null | undefined,
): { complete: number; total: number } => {
  const aliases = oceanIslandAliases(island);
  const aliasSet = new Set(aliases);
  const playable = (mapStories ?? []).filter((row) => {
    if (!isPlayableMainMapStory(row)) return false;
    return storyIslandKeys(row).some((key) => aliasSet.has(key));
  });
  const completeFromStories = playable.filter((row) =>
    isStoryPackComplete(island.id, row),
  ).length;
  const rawComplete =
    playable.length > 0
      ? completeFromStories
      : islandStoryProgressService.countReadCompleteStories(aliases);
  const total = Math.max(island.storiesTotal, playable.length, 0);
  return { complete: Math.min(rawComplete, total), total };
};

/** Islands with `storiesComplete` / `storiesTotal` filled from real progress. */
export const withIslandStoryProgress = (
  islands: ReadonlyArray<OceanMapIsland>,
  mapStories: ReadonlyArray<OceanMapStoryRow> | null | undefined,
): OceanMapIsland[] =>
  islands.map((island) => {
    const { complete, total } = countIslandStoriesComplete(island, mapStories);
    return { ...island, storiesComplete: complete, storiesTotal: total };
  });
