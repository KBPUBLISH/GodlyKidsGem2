/** Bible characters a player has dropped off on the Players World island. */
export const PLAYERS_WORLD_RESIDENTS_KEY = 'godlykids_players_world_residents_v1';

export type PlayersWorldResident = {
  id: string;
  name: string;
  modelUrl?: string;
  imageUrl?: string;
  sourceStoryId?: string;
  x: number;
  y: number;
};

type CharacterLook = {
  id: string;
  name: string;
  modelUrl?: string;
  imageUrl?: string;
  sourceStoryId?: string;
};

/**
 * A portal reward can get a new GLB after the kid already dropped that
 * friend on the island. Copy the current look onto the saved resident so
 * the island loads the new model instead of the one from drop-off day.
 */
export function applyCharacterAppearanceToResidents(
  characters: CharacterLook[],
  idRemap: Map<string, string> = new Map(),
): boolean {
  const list = readPlayersWorldResidents();
  if (!list.length || !characters.length) return false;
  const byId = new Map(characters.map((c) => [c.id, c]));
  let changed = false;
  const next = list.map((resident) => {
    const id = idRemap.get(resident.id) ?? resident.id;
    const character = byId.get(id);
    if (!character) return resident.id === id ? resident : { ...resident, id };
    const modelUrl = character.modelUrl || '';
    const imageUrl = character.imageUrl || resident.imageUrl || '';
    const name = character.name || resident.name;
    const sourceStoryId = character.sourceStoryId || resident.sourceStoryId || '';
    if (
      resident.id === id &&
      resident.name === name &&
      (resident.modelUrl || '') === modelUrl &&
      (resident.imageUrl || '') === imageUrl &&
      (resident.sourceStoryId || '') === sourceStoryId
    ) {
      return resident;
    }
    changed = true;
    return { ...resident, id, name, modelUrl, imageUrl, sourceStoryId };
  });
  if (!changed) return false;
  const byResident = new Map<string, PlayersWorldResident>();
  for (const resident of next) byResident.set(resident.id, resident);
  try {
    localStorage.setItem(
      PLAYERS_WORLD_RESIDENTS_KEY,
      JSON.stringify(Array.from(byResident.values())),
    );
  } catch {
    return false;
  }
  return true;
}

export function readPlayersWorldResidents(): PlayersWorldResident[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYERS_WORLD_RESIDENTS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (row): row is PlayersWorldResident =>
        !!row &&
        typeof row.id === 'string' &&
        typeof row.name === 'string' &&
        Number.isFinite(row.x) &&
        Number.isFinite(row.y),
    );
  } catch {
    return [];
  }
}
