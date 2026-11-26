import { grassStand, islandBedCount, islandHasRoom } from '../shared/islandStand.mjs';
import {
  PLAYERS_WORLD_RESIDENTS_KEY,
  readPlayersWorldResidents,
  type PlayersWorldResident,
} from './playersWorld';
import { scopedKey } from './profileScope';

const SAVE_KEY = 'godlykids_homeworld_playtest_v1';
const PENDING_KEY = 'godlykids_island_pending_v1';
const WORLD_URL = '/homeworld/assets/world.json';
/** Grass beside the island's starting spot, used only if the map cannot be read. */
const FALLBACK_STAND = { x: 3.133, y: 0.629 };

type StandCharacter = {
  id: string;
  name: string;
  modelUrl?: string;
  imageUrl?: string;
  sourceStoryId?: string;
};

type IslandMap = {
  heroStart?: number[];
  grid?: { origin: number[]; columns: number; rows: number; mask: number[] };
  trees?: { position?: number[]; radius?: number }[];
  boulders?: { position?: number[]; radius?: number }[];
};

export type IslandStandResult = 'home' | 'already' | 'waiting';

let worldPromise: Promise<IslandMap | null> | null = null;
const placing = new Map<string, Promise<IslandStandResult>>();

export function preloadIslandMap(): Promise<IslandMap | null> {
  if (worldPromise) return worldPromise;
  if (typeof fetch !== 'function') {
    worldPromise = Promise.resolve(null);
    return worldPromise;
  }
  worldPromise = fetch(WORLD_URL)
    .then((response) => (response.ok ? (response.json() as Promise<IslandMap>) : null))
    .catch(() => null);
  return worldPromise;
}

function readList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(scopedKey(key)) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string' && id) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, ids: string[]): void {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* private mode: the friend stays off the ship for this visit */
  }
}

/** Collected friends who still need a bed before they can stand on the grass. */
export function readPendingIslandIds(): string[] {
  return readList(PENDING_KEY);
}

function rememberPending(id: string): void {
  writeList(PENDING_KEY, [...readList(PENDING_KEY), id]);
}

function forgetPending(id: string): void {
  writeList(PENDING_KEY, readList(PENDING_KEY).filter((saved) => saved !== id));
}

function readIslandSave(): { player?: { x?: number; y?: number }; buildings?: { kind?: string; status?: string; key?: string }[] } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(scopedKey(SAVE_KEY)) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

function writeResidents(list: PlayersWorldResident[]): void {
  localStorage.setItem(scopedKey(PLAYERS_WORLD_RESIDENTS_KEY), JSON.stringify(list));
}

function buildingAvoid(world: IslandMap, buildings: { key?: string; status?: string }[] | undefined) {
  const origin = world.grid?.origin;
  if (!origin) return [];
  const spots = [];
  for (const building of buildings || []) {
    if (!building || building.status === 'cancelled') continue;
    const match = /^(\d+):(\d+)$/.exec(building.key || '');
    if (!match) continue;
    spots.push({
      x: origin[0] + Number(match[1]) + 1.5,
      y: origin[1] + Number(match[2]) + 1.5,
      r: 2.4,
    });
  }
  return spots;
}

async function standCollectedCharacter(character: StandCharacter): Promise<IslandStandResult> {
  const id = String(character?.id || '').trim();
  const name = String(character?.name || '').trim();
  if (!id || !name) return 'waiting';
  const residents = readPlayersWorldResidents();
  if (residents.some((resident) => resident.id === id)) {
    forgetPending(id);
    return 'already';
  }
  const save = readIslandSave();
  if (!islandHasRoom(residents.length, islandBedCount(save))) {
    rememberPending(id);
    return 'waiting';
  }
  const world = await preloadIslandMap();
  const player = save?.player;
  const anchor = Number.isFinite(player?.x) && Number.isFinite(player?.y)
    ? { x: player!.x as number, y: player!.y as number }
    : null;
  const spot = (world && grassStand(world, anchor, residents, buildingAvoid(world, save?.buildings))) || { ...FALLBACK_STAND };
  const next: PlayersWorldResident = {
    id,
    name,
    modelUrl: character.modelUrl || '',
    imageUrl: character.imageUrl || '',
    sourceStoryId: character.sourceStoryId || '',
    x: spot.x,
    y: spot.y,
  };
  writeResidents([...residents.filter((resident) => resident.id !== id), next]);
  forgetPending(id);
  return 'home';
}

/** Put a story-pack character on the grass. Does not add them to the ship. */
export function placeCollectedCharacterOnIsland(character: StandCharacter): Promise<IslandStandResult> {
  const id = String(character?.id || '').trim();
  if (!id) return Promise.resolve('waiting');
  const current = placing.get(id);
  if (current) return current;
  const job = standCollectedCharacter(character).finally(() => placing.delete(id));
  placing.set(id, job);
  return job;
}
