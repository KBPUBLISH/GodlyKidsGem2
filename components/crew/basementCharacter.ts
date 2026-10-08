import { MAX_CREW, rewardsService, type UnlockedCharacter } from '../../services/rewardsService';

/**
 * sessionStorage key remembering which 3D character climbed down the deck
 * hatch most recently (legacy single-id marker, kept for the manual flow).
 */
export const BASEMENT_CHARACTER_KEY = 'crewBasementCharacterId';

/**
 * Per-character location persistence: characters move between the top deck
 * and the basement on their own (autonomous hatch trips) or via the manual
 * OPEN-hatch descent. Both pages read this so a character is only ever in
 * one place. `returnAt` is when a basement visit ends — once it passes, the
 * character counts as back on deck (the deck page plays the hatch emergence
 * if it's mounted at that moment).
 */
const LOCATIONS_KEY = 'crewCharacterLocations';

export type CrewLocation = {
  loc: 'deck' | 'basement';
  /** Epoch ms when a basement visit ends (only while loc === 'basement'). */
  returnAt?: number;
};

function readLocations(): Record<string, CrewLocation> {
  try {
    const raw = sessionStorage.getItem(LOCATIONS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CrewLocation>;
  } catch {
    /* storage unavailable / corrupt */
  }
  return {};
}

export function getCrewLocation(characterId: string): CrewLocation {
  const rec = readLocations()[characterId];
  if (!rec) return { loc: 'deck' };
  // A basement stay whose return time already passed counts as back on deck.
  if (rec.loc === 'basement' && rec.returnAt != null && rec.returnAt <= Date.now()) {
    return { loc: 'deck' };
  }
  return rec;
}

export function setCrewLocation(characterId: string, rec: CrewLocation): void {
  try {
    const all = readLocations();
    all[characterId] = rec;
    sessionStorage.setItem(LOCATIONS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — location just won't persist */
  }
}

/** The on-deck 3D roster, mirroring CrewPage.loadCrew (incl. DEV hook). */
function roster3d(): UnlockedCharacter[] {
  const characters = rewardsService.getUnlockedCharacters();
  const selected = rewardsService.getSelectedCrewIds();
  const roster = selected.length
    ? characters.filter((c) => selected.includes(c.id))
    : characters;
  let onDeck = roster.slice(0, MAX_CREW);

  // DEV ONLY debug hook — see CrewPage.loadCrew. Remove when CMS goes live.
  const debugModelUrl = localStorage.getItem('debugCrewModelUrl');
  if (debugModelUrl && onDeck.length > 0 && !onDeck.some((c) => c.modelUrl)) {
    onDeck = onDeck.map((c, i) =>
      i === 0 ? { ...c, modelUrl: debugModelUrl } : c,
    );
  }
  return onDeck.filter((c) => !!c.modelUrl);
}

/**
 * Which 3D characters are currently below deck: everyone whose persisted
 * location says 'basement' (fresh), falling back to the legacy single-id
 * marker set by the manual hatch descent. Empty when no 3D crew exist.
 */
export function resolveBasementCharacters(): UnlockedCharacter[] {
  const crew = roster3d();
  if (crew.length === 0) return [];

  const below = crew.filter((c) => getCrewLocation(c.id).loc === 'basement');
  if (below.length > 0) return below;

  // Legacy marker only counts while the character has no location record yet
  // (e.g. reduced-motion manual entry, where no descent animation ran).
  let persistedId: string | null = null;
  try {
    persistedId = sessionStorage.getItem(BASEMENT_CHARACTER_KEY);
  } catch {
    /* storage unavailable */
  }
  const legacy = crew.find(
    (c) => c.id === persistedId && readLocations()[c.id] === undefined,
  );
  return legacy ? [legacy] : [];
}
