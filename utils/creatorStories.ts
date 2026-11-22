// View models for the Creators tab (Library) and the creator story detail
// screen. The data comes from the Godly Hub API — see services/hubService.ts
// for the mapping from /api/hub responses onto these types.

export type StoryFormat = 'read' | 'audio';

export type CreatorEpisode = {
  title: string;
  /** Absent when the upload has no duration, and on planned episodes. */
  minutes?: number;
  /** Free preview — playable/readable without spending credits. */
  free?: boolean;
  /**
   * Announced but not published yet. Planned episodes show a release window
   * instead of a play button, and are what a pledge is buying in advance.
   */
  planned?: boolean;
  /** Release window shown on planned episodes, e.g. "Oct 2026". */
  eta?: string;
  /** Per-episode art; the series cover is used when this is missing. */
  coverImage?: string;
};

export type CreatorStory = {
  id: string;
  title: string;
  creator: string;
  /** Hub creator id, used to load the rest of their catalog. */
  creatorId: string;
  creatorAvatar: string;
  cover: string;
  format: StoryFormat;
  /** Star rating and review count, when the source has them. */
  rating?: number;
  reviews?: number;
  ages?: string;
  credits: number;
  blurb: string;
  /**
   * 'in-progress' series are still being written. Kids can pledge the full
   * price now, which unlocks what exists today and every episode as it lands.
   */
  seriesStatus: 'complete' | 'in-progress';
  /** Backers who have already pledged (social proof on the pledge card). */
  backers?: number;
  /** What the creator promised for the whole series, e.g. "one a month". */
  releasePlan?: string;
  episodeList: CreatorEpisode[];
};

export type CreatorProfile = {
  id: string;
  name: string;
  storyCount: number;
  avatar: string;
  bio?: string;
  website?: string;
};

/** Episodes a kid can open today. */
export function releasedCount(story: CreatorStory): number {
  return story.episodeList.filter((ep) => !ep.planned).length;
}

/** Everything the creator has committed to, released plus announced. */
export function plannedCount(story: CreatorStory): number {
  return story.episodeList.length;
}
