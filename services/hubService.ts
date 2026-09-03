/**
 * Godly Hub read API for the Creators tab.
 *
 * Covers the public /api/hub endpoints and maps their responses onto the
 * CreatorStory / CreatorProfile view models the Creators panel and the story
 * detail page render. Token balance, ownership and purchases stay in
 * tokenService.
 */

import { getApiBaseUrl } from './apiService';
import { authService } from './authService';
import { DEFAULT_BOOK_COVER, placeholderImage } from '../utils/placeholderImage';
import type { CreatorEpisode, CreatorProfile, CreatorStory } from '../utils/creatorStories';

// ============================================
// Raw API shapes (see backend src/utils/hubSeries.js → toPublicPlaylist)
// ============================================

export interface HubCreatorRef {
  _id: string;
  name: string;
  profileImage?: string;
  bio?: string;
  website?: string;
}

export interface HubEpisode {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  audioUrl?: string;
  /** Seconds. Absent on planned episodes, and optional on released ones. */
  duration?: number;
  order?: number;
  planned?: boolean;
  releaseDate?: string;
  reviewStatus?: 'approved' | 'pending' | 'rejected';
}

export interface HubSeries {
  _id: string;
  title: string;
  /** Creator name captured when the series was created. */
  author: string;
  description?: string;
  coverImage?: string;
  type: 'Audiobook' | 'Song';
  categories?: string[];
  items?: HubEpisode[];
  priceTokens: number;
  minAge?: number;
  /**
   * Populated on /hub/playlists and /hub/playlists/:id, but a bare id string
   * on /hub/creators/:id, which does not populate it.
   */
  creatorId: HubCreatorRef | string;
  purchaseCount?: number;
  backerCount?: number;
  seriesStatus?: 'complete' | 'in-progress';
  releasePlan?: string;
  releasedEpisodeCount?: number;
  plannedEpisodeCount?: number;
  publishedAt?: string;
  isFeatured?: boolean;
  averageRating?: number;
  ratingCount?: number;
}

export interface HubBrowseOptions {
  category?: string;
  type?: 'Audiobook' | 'Song';
  featured?: boolean;
  seriesStatus?: 'complete' | 'in-progress';
  sort?: 'newest' | 'popular' | 'price_low' | 'price_high';
  limit?: number;
  offset?: number;
}

export interface HubBrowseResult {
  stories: CreatorStory[];
  total: number;
  hasMore: boolean;
}

export interface HubCreatorResult {
  profile: CreatorProfile;
  stories: CreatorStory[];
  following: boolean;
}

export interface SeriesReview {
  id: string;
  rating: number;
  comment?: string;
  displayName: string;
  createdAt: string;
  mine?: boolean;
}

export interface SeriesReviewsResult {
  averageRating: number;
  ratingCount: number;
  reviews: SeriesReview[];
  myReview: { rating: number; comment?: string } | null;
}

/** Carries the status code so callers can tell "no such series" from "no network". */
export class HubRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HubRequestError';
    this.status = status;
  }
}

// ============================================
// Requests
// ============================================

const REQUEST_TIMEOUT = 10000;

const identityQuery = (): string => {
  const params = new URLSearchParams();
  const email = authService.getUser()?.email || localStorage.getItem('godlykids_user_email') || '';
  const userId = authService.getUserIdForBackend() || localStorage.getItem('godlykids_device_id') || '';
  if (email) params.set('email', email);
  if (userId) params.set('userId', userId);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const hubHeaders = (json = false): HeadersInit => {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const token = authService.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const withIdentity = (path: string): string => {
  const extra = identityQuery().replace(/^\?/, '');
  if (!extra) return path;
  return path.includes('?') ? `${path}&${extra}` : `${path}?${extra}`;
};

async function fetchHub<T>(
  path: string,
  init?: { method?: string; body?: unknown },
  timeout = REQUEST_TIMEOUT,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`⏱️ Hub request timeout after ${timeout}ms: ${path}`);
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(`${getApiBaseUrl()}${withIdentity(path)}`, {
      method: init?.method || 'GET',
      headers: hubHeaders(Boolean(init?.body)),
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `Hub request failed: ${response.status}`;
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // keep status message
      }
      throw new HubRequestError(message, response.status);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const buildQuery = (options?: HubBrowseOptions): string => {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  if (options?.type) params.set('type', options.type);
  if (options?.featured) params.set('featured', 'true');
  if (options?.seriesStatus) params.set('seriesStatus', options.seriesStatus);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));
  const query = params.toString();
  return query ? `?${query}` : '';
};

// ============================================
// Mapping to the view model
// ============================================

const etaFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

const avatarFor = (name: string): string =>
  placeholderImage(96, 96, 'D8C7AD', (name.trim()[0] || '★').toUpperCase(), '173A5E');

const resolveCreator = (
  series: HubSeries,
  fallback?: HubCreatorRef,
): { id: string; name: string; avatar: string } => {
  const ref = typeof series.creatorId === 'object' && series.creatorId ? series.creatorId : fallback;
  const name = ref?.name || series.author || 'Godly Kids Creator';
  return {
    id: ref?._id || (typeof series.creatorId === 'string' ? series.creatorId : ''),
    name,
    avatar: ref?.profileImage || avatarFor(name),
  };
};

// `free` is intentionally left unset: the hub schema has no free-preview flag,
// so the preview affordances stay dark rather than promising a free episode.
const toEpisode = (item: HubEpisode, seriesCover: string): CreatorEpisode => ({
  title: item.title,
  minutes: item.duration ? Math.max(1, Math.round(item.duration / 60)) : undefined,
  planned: item.planned || undefined,
  eta:
    item.planned && item.releaseDate
      ? etaFormat.format(new Date(item.releaseDate))
      : undefined,
  coverImage: item.coverImage || seriesCover,
});

export const toCreatorStory = (series: HubSeries, creatorFallback?: HubCreatorRef): CreatorStory => {
  const creator = resolveCreator(series, creatorFallback);
  const cover = series.coverImage || DEFAULT_BOOK_COVER;
  const episodeList = [...(series.items || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item) => toEpisode(item, cover));

  return {
    id: series._id,
    title: series.title,
    creatorId: creator.id,
    creator: creator.name,
    creatorAvatar: creator.avatar,
    cover,
    format: 'audio',
    ages: series.minAge != null ? `Ages ${series.minAge}+` : undefined,
    credits: series.priceTokens,
    blurb: series.description || '',
    rating: series.ratingCount ? series.averageRating : undefined,
    reviews: series.ratingCount || undefined,
    seriesStatus: episodeList.some((episode) => episode.planned) ? 'in-progress' : 'complete',
    backers: series.backerCount ?? series.purchaseCount,
    releasePlan: series.releasePlan,
    episodeList,
  };
};

/**
 * Popular Creators row. The hub exposes no public creator list, so creators are
 * grouped out of the series already loaded — story counts therefore reflect the
 * published series in hand, not a creator's full catalog.
 */
export const toCreatorProfiles = (stories: CreatorStory[]): CreatorProfile[] => {
  const byId = new Map<string, CreatorProfile>();

  stories.forEach((story) => {
    if (!story.creatorId) return;
    const existing = byId.get(story.creatorId);
    if (existing) {
      existing.storyCount += 1;
      return;
    }
    byId.set(story.creatorId, {
      id: story.creatorId,
      name: story.creator,
      avatar: story.creatorAvatar,
      storyCount: 1,
    });
  });

  return [...byId.values()].sort((a, b) => b.storyCount - a.storyCount);
};

// ============================================
// Service
// ============================================

export const hubService = {
  /** Browse published creator series. Throws so callers can show a retry state. */
  browseSeries: async (options?: HubBrowseOptions): Promise<HubBrowseResult> => {
    const data = await fetchHub<{ playlists?: HubSeries[]; total?: number; hasMore?: boolean }>(
      `hub/playlists${buildQuery(options)}`,
    );
    return {
      stories: (data.playlists || []).map((series) => toCreatorStory(series)),
      total: data.total || 0,
      hasMore: data.hasMore || false,
    };
  },

  /** Admin-curated series, ordered by featuredOrder. */
  getFeaturedSeries: async (): Promise<CreatorStory[]> => {
    const data = await fetchHub<{ playlists?: HubSeries[] }>('hub/featured');
    return (data.playlists || []).map((series) => toCreatorStory(series));
  },

  /** A single series, or null when it does not exist or is not published. */
  getSeries: async (id: string): Promise<CreatorStory | null> => {
    try {
      const data = await fetchHub<{ playlist?: HubSeries }>(`hub/playlists/${id}`);
      return data.playlist ? toCreatorStory(data.playlist) : null;
    } catch (error) {
      if (error instanceof HubRequestError && error.status === 404) return null;
      throw error;
    }
  },

  /** A creator plus everything they have published. */
  getCreator: async (creatorId: string): Promise<HubCreatorResult | null> => {
    try {
      const data = await fetchHub<{
        creator?: HubCreatorRef;
        playlists?: HubSeries[];
        contentCount?: number;
        following?: boolean;
      }>(`hub/creators/${creatorId}`);

      if (!data.creator) return null;
      const creator = data.creator;

      return {
        profile: {
          id: creator._id,
          name: creator.name,
          avatar: creator.profileImage || avatarFor(creator.name),
          storyCount: data.contentCount ?? (data.playlists || []).length,
          bio: creator.bio,
          website: creator.website,
        },
        stories: (data.playlists || []).map((series) => toCreatorStory(series, creator)),
        following: Boolean(data.following),
      };
    } catch (error) {
      if (error instanceof HubRequestError && error.status === 404) return null;
      throw error;
    }
  },

  /** Other series by the same creator, for the "More from" row. */
  getMoreFromCreator: async (creatorId: string, excludeStoryId: string): Promise<CreatorStory[]> => {
    if (!creatorId) return [];
    const result = await hubService.getCreator(creatorId);
    return (result?.stories || []).filter((story) => story.id !== excludeStoryId);
  },

  getReviews: async (playlistId: string): Promise<SeriesReviewsResult> => {
    const data = await fetchHub<SeriesReviewsResult>(`hub/playlists/${playlistId}/reviews`);
    return {
      averageRating: data.averageRating || 0,
      ratingCount: data.ratingCount || 0,
      reviews: data.reviews || [],
      myReview: data.myReview || null,
    };
  },

  saveReview: async (
    playlistId: string,
    rating: number,
    comment: string,
  ): Promise<SeriesReviewsResult> => {
    const data = await fetchHub<{
      averageRating?: number;
      ratingCount?: number;
      review?: SeriesReview;
    }>(`hub/playlists/${playlistId}/reviews`, {
      method: 'POST',
      body: { rating, comment },
    });
    const refreshed = await hubService.getReviews(playlistId).catch(() => null);
    return refreshed || {
      averageRating: data.averageRating || rating,
      ratingCount: data.ratingCount || 1,
      reviews: data.review ? [data.review] : [],
      myReview: { rating, comment },
    };
  },

  followCreator: async (creatorId: string, follow: boolean): Promise<boolean> => {
    const data = await fetchHub<{ following?: boolean }>(`hub/creators/${creatorId}/follow`, {
      method: follow ? 'POST' : 'DELETE',
      body: {},
    });
    return Boolean(data.following);
  },
};

export default hubService;
