import { profileService } from '../services/profileService';

const STORAGE_BASE = 'purchased_games';

const readIds = (): string[] => {
  try {
    const raw = localStorage.getItem(profileService.getProfileKey(STORAGE_BASE));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeIds = (ids: string[]): void => {
  try {
    localStorage.setItem(profileService.getProfileKey(STORAGE_BASE), JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
};

/** True if this profile has spent gold coins to unlock the game. */
export const isGamePurchased = (...ids: Array<string | undefined | null>): boolean => {
  const purchased = readIds();
  return ids.some((id) => !!id && purchased.includes(id));
};

export const markGamePurchased = (...ids: Array<string | undefined | null>): void => {
  const purchased = readIds();
  let changed = false;
  for (const id of ids) {
    if (!id || purchased.includes(id)) continue;
    purchased.push(id);
    changed = true;
  }
  if (changed) writeIds(purchased);
};
