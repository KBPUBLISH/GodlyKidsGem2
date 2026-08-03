/**
 * Return-to-Island-Scene helpers for Bible Map book reader navigation.
 * Prefer explicit navigate() to `/sail/:islandId/lesson?storyId=...` over history.back().
 */

export type IslandSceneReturnContext = {
  islandId: string;
  storyId?: string;
  fromMainMap?: boolean;
  fromSail?: boolean;
  title?: string;
};

/** Location.state shape when opening /read/:bookId from the island lesson flow. */
export type IslandSceneReaderState = IslandSceneReturnContext & {
  /** Legacy: island id string when opened from IslandLessonPage. */
  fromIslandLesson?: string;
  fromIslandScene?: boolean;
  readingLevel?: string;
};

export const buildIslandScenePath = (ctx: {
  islandId: string;
  storyId?: string;
}): string => {
  const islandId = (ctx.islandId || '').trim();
  if (!islandId) return '';
  const storyId = (ctx.storyId || '').trim();
  const qs = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
  return `/sail/${encodeURIComponent(islandId)}/lesson${qs}`;
};


/** Start / Continue hub (IslandLessonPage) for a story. */
export const buildIslandLessonHubPath = (ctx: {
  islandId: string;
  storyId?: string;
}): string => {
  const islandId = (ctx.islandId || '').trim();
  if (!islandId) return '';
  const storyId = (ctx.storyId || '').trim();
  const qs = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
  return `/sail/${encodeURIComponent(islandId)}/lesson/hub${qs}`;
};

export const buildIslandSceneNavState = (ctx: IslandSceneReturnContext) => ({
  skipIntro: true as const,
  title: ctx.title,
  fromMainMap: Boolean(ctx.fromMainMap),
  fromSail: Boolean(ctx.fromSail),
});

/**
 * Resolve return context from reader location.state and/or durable query params.
 * Query keys: returnIslandId, returnStoryId, fromMainMap, fromSail.
 */
export const resolveIslandSceneReturn = (
  state: IslandSceneReaderState | null | undefined,
  searchParams: URLSearchParams,
): IslandSceneReturnContext | null => {
  const islandId =
    (typeof state?.islandId === 'string' && state.islandId.trim()) ||
    (typeof state?.fromIslandLesson === 'string' && state.fromIslandLesson.trim()) ||
    searchParams.get('returnIslandId')?.trim() ||
    '';
  if (!islandId) return null;

  const storyId =
    (typeof state?.storyId === 'string' && state.storyId.trim()) ||
    searchParams.get('returnStoryId')?.trim() ||
    '';

  const fromMainMap =
    Boolean(state?.fromMainMap) || searchParams.get('fromMainMap') === '1';
  const fromSail =
    Boolean(state?.fromSail) || searchParams.get('fromSail') === '1';
  const title =
    (typeof state?.title === 'string' && state.title.trim()) || undefined;

  return {
    islandId,
    storyId: storyId || undefined,
    fromMainMap,
    fromSail,
    title,
  };
};

/** Append return-* query params so refresh / share of reader URL still returns to scene. */
export const appendIslandSceneReturnParams = (
  params: URLSearchParams,
  ctx: IslandSceneReturnContext,
): void => {
  params.set('returnIslandId', ctx.islandId);
  if (ctx.storyId) params.set('returnStoryId', ctx.storyId);
  if (ctx.fromMainMap) params.set('fromMainMap', '1');
  if (ctx.fromSail) params.set('fromSail', '1');
};
