import { getProfileScopeKey } from './profileScope';
import { resolveFirstStoryPackDestination } from './onboardingJourney';
import { rewardsService, ONBOARDING_ADAM_ID, ONBOARDING_ADAM_REWARD } from '../services/rewardsService';
import { firstFriendKey, readFirstFriend, beginFirstFriendStory, isFirstFriendReading, finishFirstFriendStory } from '../homeworld/src/living-first-friend.mjs';

/** Only the opt-in island's completed solo task can initiate this handoff. */
export async function openLivingFirstFriendStory(scope: string) {
  if (scope !== getProfileScopeKey()) throw new Error('The active child changed.');
  const key = firstFriendKey(scope);
  const record = readFirstFriend(localStorage, key);
  if (!record || record.phase === 'unlocked') throw new Error('Finish your first island task first.');
  let islandId: string, storyId: string, state: Record<string, unknown> = {};
  if (record.phase === 'reading') {
    islandId = record.islandId;
    storyId = record.storyId;
  } else {
    const destination = await resolveFirstStoryPackDestination();
    const url = new URL(destination.path, window.location.origin);
    islandId = decodeURIComponent(/^\/sail\/([^/]+)\/lesson/.exec(url.pathname)?.[1] || '');
    storyId = url.searchParams.get('storyId') || '';
    state = { ...destination.state };
  }
  if (!islandId || !storyId) throw new Error('The first story is not available yet.');
  if (scope !== getProfileScopeKey() || !beginFirstFriendStory(localStorage, key, islandId, storyId)) throw new Error('The story handoff could not be saved.');
  // Use the ordinary reader, without starting/resetting the previous ship onboarding.
  delete state.onboardingJourney;
  return { path: `/sail/${encodeURIComponent(islandId)}/lesson?storyId=${encodeURIComponent(storyId)}`, state: { ...state, fromMyHome: true, livingFirstFriend: true } };
}

/** Called by the real reader only at The End, after reading progress is recorded. */
export function completeLivingFirstFriendReading(islandId: string, storyId: string, readPageCount: number): boolean {
  if (!Number.isInteger(readPageCount) || readPageCount < 1) return false;
  const key = firstFriendKey(getProfileScopeKey());
  if (!isFirstFriendReading(localStorage, key, islandId, storyId)) return false;
  const findAdam = () => rewardsService.getUnlockedCharacters().find(c => c.id === ONBOARDING_ADAM_ID || /^adam$/i.test(c.name.trim()));
  if (!findAdam()) rewardsService.collectReward(storyId, ONBOARDING_ADAM_REWARD);
  if (!findAdam()) return false;
  return finishFirstFriendStory(localStorage, key, islandId, storyId);
}
