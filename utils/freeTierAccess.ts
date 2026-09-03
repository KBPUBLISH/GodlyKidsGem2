import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDevForceFree } from './devPremium';
import { requestShipsLibraryPaywall } from './shipsLibraryPaywall';

const FREE_STORY_KEY = 'godlykids_free_library_story_id';

/**
 * The one island a child can sail without a subscription.
 *
 * This is a hardcoded CMS slug, and that carries a known risk: the previous
 * value was `genesis`, and when that island was deleted from the CMS the
 * predicate below silently stopped matching anything, so no island was free
 * at all. It failed quietly because nothing checks that the slug still exists.
 *
 * If `beginnings` is ever deleted or re-slugged, the same thing happens again:
 * the free tier closes completely and every non-premium child is walled out of
 * every island, with no error anywhere. `assertFreeTierIslandExists` below is
 * wired into the ocean map's island fetch to turn that into a loud console
 * error instead of silence — but the real fix is to update this constant.
 */
export const FREE_TIER_ISLAND_ID = 'beginnings';

/**
 * Tripwire for the hazard described above. Call with the island list from the
 * CMS; shouts if the configured free island is no longer in it.
 *
 * Deliberately not gated to dev builds: it only ever fires when the free tier
 * is already broken for every child, which is worth surfacing in production
 * error reporting too. Silence is the failure mode we are trying to avoid.
 */
export function assertFreeTierIslandExists(
  islands: ReadonlyArray<{ id: string; book: string }>,
): void {
  if (!islands.length) return;
  if (islands.some((island) => isFreeTierIsland(island.id, island.book))) return;
  console.error(
    `[freeTierAccess] The free island "${FREE_TIER_ISLAND_ID}" is not in the CMS ` +
      `island list (${islands.map((i) => i.id).join(', ')}). No island is free — ` +
      `every non-premium child is now paywalled out of all content. ` +
      `Update FREE_TIER_ISLAND_ID in utils/freeTierAccess.ts.`,
  );
}

export function hasPremiumAccess(): boolean {
  if (isDevForceFree()) return false;
  try {
    return localStorage.getItem('godlykids_premium') === 'true';
  } catch {
    return false;
  }
}

export function isFreeTierIsland(islandId: string, book?: string): boolean {
  const id = (islandId || '').trim().toLowerCase();
  const label = (book || '').trim().toLowerCase();
  return id === FREE_TIER_ISLAND_ID || label === FREE_TIER_ISLAND_ID;
}

export function getGrantedLibraryStoryId(): string | null {
  try {
    return localStorage.getItem(FREE_STORY_KEY) || sessionStorage.getItem(FREE_STORY_KEY);
  } catch {
    return null;
  }
}

export function clearGrantedLibraryStory(): void {
  try {
    localStorage.removeItem(FREE_STORY_KEY);
    sessionStorage.removeItem(FREE_STORY_KEY);
  } catch {
    /* private mode */
  }
}

function grantLibraryStory(contentId: string): void {
  try {
    localStorage.setItem(FREE_STORY_KEY, contentId);
    sessionStorage.setItem(FREE_STORY_KEY, contentId);
  } catch {
    /* private mode */
  }
}

/** True if this library item is still in the free slice (or user is premium). */
export function canAccessLibraryContent(contentId: string): boolean {
  if (!contentId) return true;
  if (hasPremiumAccess()) return true;
  const granted = getGrantedLibraryStoryId();
  return !granted || granted === contentId;
}

/**
 * First library story is free and then the paywall fires.
 * Any other story is blocked and shows the same paywall again.
 */
export function claimOrBlockLibraryContent(contentId: string): 'allow' | 'blocked' {
  if (!contentId || hasPremiumAccess()) return 'allow';
  const granted = getGrantedLibraryStoryId();
  if (!granted) {
    grantLibraryStory(contentId);
    requestShipsLibraryPaywall('library-story');
    return 'allow';
  }
  if (granted === contentId) return 'allow';
  requestShipsLibraryPaywall('library-story');
  return 'blocked';
}

export function openLibraryOrPaywall(contentId: string, open: () => void): void {
  if (claimOrBlockLibraryContent(contentId) === 'blocked') return;
  open();
}

/** The free island stays free. Any other island is the wall. */
export function claimOrBlockIsland(islandId: string, book?: string): 'allow' | 'blocked' {
  if (hasPremiumAccess() || isFreeTierIsland(islandId, book)) return 'allow';
  requestShipsLibraryPaywall('island');
  return 'blocked';
}

/** Redirect + paywall if a non-free island is opened without a subscription. */
export function useRequireIslandAccess(islandId?: string, book?: string): boolean {
  const navigate = useNavigate();
  const allowed = !islandId || hasPremiumAccess() || isFreeTierIsland(islandId, book);
  useEffect(() => {
    if (!islandId) return;
    if (claimOrBlockIsland(islandId, book) === 'blocked') {
      navigate('/map', { replace: true });
    }
  }, [islandId, book, navigate]);
  return allowed;
}
