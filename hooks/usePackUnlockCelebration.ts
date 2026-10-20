import { useCallback, useEffect, useState } from 'react';
import {
  STORY_PACK_UX_EVENT,
  storyPackUnlockUxService,
  type PackUnlockCelebrationPayload,
} from '../services/storyPackUnlockUxService';
import type { PackUnlockCoverStory } from '../utils/mainMapStoryUnlock';

/**
 * Resolve a pending next-pack celebration for this island and show it once.
 */
export function usePackUnlockCelebration(
  islandId: string,
  stories: PackUnlockCoverStory[],
  ready = true,
): {
  celebration: PackUnlockCelebrationPayload | null;
  dismissCelebration: () => void;
} {
  const [payload, setPayload] = useState<PackUnlockCelebrationPayload | null>(null);
  const [uxTick, setUxTick] = useState(0);
  const storySig = stories.map((s) => s._id).join('|');

  useEffect(() => {
    const bump = () => setUxTick((t) => t + 1);
    window.addEventListener(STORY_PACK_UX_EVENT, bump);
    return () => window.removeEventListener(STORY_PACK_UX_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!ready || !islandId || stories.length === 0 || payload) return;
    const next = storyPackUnlockUxService.resolvePendingUnlock(islandId, stories);
    if (!next) return;
    storyPackUnlockUxService.markCelebrated(next.islandId, next.packId);
    setPayload(next);
    // stories identity is represented by storySig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandId, storySig, ready, uxTick, payload]);

  const dismissCelebration = useCallback(() => setPayload(null), []);

  return { celebration: payload, dismissCelebration };
}
