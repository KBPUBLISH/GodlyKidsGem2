import { getBibleMapApiRoot, resolveBibleMapMediaUrl } from './bibleMapApi';

/** Bundled Genesis island art (no book-name label overlay needed). */
export const MAP_ISLAND_GENESIS = '/assets/images/map-island-genesis.png';

export type OceanMapIslandStatus = 'complete' | 'current' | 'locked';

export interface OceanMapIsland {
  id: string;
  book: string;
  title: string;
  status: OceanMapIslandStatus;
  storiesComplete: number;
  storiesTotal: number;
  x: number;
  y: number;
  /** Ocean-map island art from CMS (optional). */
  mapArtUrl?: string;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  /** True when this row came from the Bible Map API. */
  fromApi?: boolean;
}

export type ApiIslandRow = {
  _id?: string;
  slug?: string;
  title?: string;
  bookLabel?: string;
  description?: string;
  mapArtUrl?: string;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  mapPosition?: { x?: number; y?: number };
  order?: number;
  unlockRule?: string;
  status?: string;
  storyCounts?: { total?: number; published?: number };
};

/**
 * Minimum y for Genesis — keeps the island comfortably below the locked
 * horizon band instead of hugging the wood header.
 */
export const GENESIS_MIN_Y = 14;

/** Offline / API-empty layout — same positions as MapPage ship navigation.
 *  Only Genesis is unlocked; every later island is locked (greyed out). */
export const FALLBACK_OCEAN_ISLANDS: OceanMapIsland[] = [
  {
    id: 'genesis',
    book: 'Genesis',
    title: 'Creation',
    status: 'current',
    storiesComplete: 0,
    storiesTotal: 10,
    x: 50,
    y: GENESIS_MIN_Y,
  },
  {
    id: 'exodus',
    book: 'Exodus',
    title: 'God Rescues',
    status: 'locked',
    storiesComplete: 0,
    storiesTotal: 10,
    x: 47,
    y: 30,
  },
  {
    id: 'psalms',
    book: 'Psalms',
    title: 'Songs of Faith',
    status: 'locked',
    storiesComplete: 0,
    storiesTotal: 10,
    x: 27,
    y: 49,
  },
  {
    id: 'gospels',
    book: 'Gospels',
    title: 'The Good News',
    status: 'locked',
    storiesComplete: 0,
    storiesTotal: 10,
    x: 65,
    y: 67,
  },
  {
    id: 'acts',
    book: 'Acts',
    title: 'The Church Begins',
    status: 'locked',
    storiesComplete: 0,
    storiesTotal: 10,
    x: 36,
    y: 86,
  },
];

export const CMS_ISLANDS_TIMEOUT_MS = 3_000;

export const isGenesisIsland = (island: Pick<OceanMapIsland, 'id' | 'book'>): boolean => {
  const id = island.id.toLowerCase();
  const book = island.book.toLowerCase();
  return id === 'genesis' || id.includes('genesis') || book === 'genesis';
};

/** Art URL for an ocean-map island — CMS upload, else bundled Genesis. */
export const getOceanIslandArtSrc = (island: OceanMapIsland): string | undefined =>
  island.mapArtUrl || (isGenesisIsland(island) ? MAP_ISLAND_GENESIS : undefined);

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
  let y =
    typeof row.mapPosition?.y === 'number' && Number.isFinite(row.mapPosition.y)
      ? row.mapPosition.y
      : Math.min(90, 8 + index * 18);
  // Genesis never rides up against the horizon, even with a CMS position.
  if (isGenesisIsland({ id, book }) && y < GENESIS_MIN_Y) y = GENESIS_MIN_Y;
  // Published islands are tappable for CMS testing (progress wiring later).
  const status: OceanMapIslandStatus = 'current';
  return {
    id,
    book,
    title: (row.description || row.title || 'Adventure').trim(),
    status,
    storiesComplete: 0,
    storiesTotal: storiesTotal || 1,
    x,
    y,
    mapArtUrl: resolveBibleMapMediaUrl(row.mapArtUrl) || undefined,
    mainMapUrl: resolveBibleMapMediaUrl(row.mainMapUrl) || undefined,
    mainMapVideoUrl: resolveBibleMapMediaUrl(row.mainMapVideoUrl) || undefined,
    fromApi: true,
  };
};

const isSameOceanIsland = (
  a: Pick<OceanMapIsland, 'id' | 'book'>,
  b: Pick<OceanMapIsland, 'id' | 'book'>,
): boolean =>
  a.id.toLowerCase() === b.id.toLowerCase() ||
  a.book.toLowerCase() === b.book.toLowerCase();

/**
 * Voyage islands the CMS hasn't published yet — shown greyed out (locked)
 * after the published ones so kids can see what's coming on the journey.
 */
const lockedUpcomingIslands = (published: OceanMapIsland[]): OceanMapIsland[] =>
  FALLBACK_OCEAN_ISLANDS.filter(
    (fallback) => !published.some((island) => isSameOceanIsland(island, fallback)),
  ).map((fallback) => ({ ...fallback, status: 'locked' as const, storiesComplete: 0 }));

/**
 * Fetch published ocean-map islands (CMS icons + positions), padded with the
 * not-yet-unlocked voyage islands rendered as locked.
 * Returns null on failure / empty so callers keep FALLBACK_OCEAN_ISLANDS.
 */
export const fetchOceanMapIslands = async (
  signal?: AbortSignal,
): Promise<OceanMapIsland[] | null> => {
  const res = await fetch(`${getBibleMapApiRoot()}/bible-map/islands`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as ApiIslandRow[];
  if (!Array.isArray(data) || data.length === 0) return null;
  const mapped = data
    .map((row, i) => mapApiIslandToOceanIsland(row, i))
    .filter((row): row is OceanMapIsland => row != null);
  if (mapped.length === 0) return null;
  return [...mapped, ...lockedUpcomingIslands(mapped)];
};
