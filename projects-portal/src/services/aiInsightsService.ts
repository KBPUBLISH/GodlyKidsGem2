import apiClient from './apiClient';

export type InsightTier = 'opus' | 'sonnet';
export type InsightTimeRange = 'day' | 'week' | 'month' | 'all';

export interface InsightFinding {
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'positive' | 'info';
}

export interface InsightRecommendation {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
}

export interface InsightResult {
  diagnosis: string;
  findings: InsightFinding[];
  recommendations: InsightRecommendation[];
  model: string;
  tier: InsightTier;
  generatedAt: string;
  unstructured?: boolean;
}

const TOKEN_KEY = 'portal_admin_token';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Keep only the fields that matter for analysis, and cap list length.
function slimBooks(books: any[]): any[] {
  return (books || []).slice(0, 30).map((b) => ({
    title: b.title,
    status: b.status,
    views: b.viewCount,
    reads: b.readCount,
    likes: b.likeCount,
    favorites: b.favoriteCount,
    avgPagesRead: b.avgPagesRead,
    completionRate: b.averageCompletionRate,
    quizStarts: b.quizStartCount,
    quizCompletions: b.quizCompletionCount,
    gamesPlayed: b.gameOpenCount,
  }));
}

function slimPlaylists(playlists: any[]): any[] {
  return (playlists || []).slice(0, 30).map((p) => ({
    title: p.title ?? p.name,
    plays: p.playCount ?? p.playsCount ?? p.plays,
    likes: p.likeCount,
    favorites: p.favoriteCount,
    completionRate: p.averageCompletionRate,
  }));
}

async function safeGet(url: string): Promise<any | null> {
  try {
    const res = await apiClient.get(url, { headers: authHeaders() });
    return res.data;
  } catch (err) {
    console.warn(`[aiInsights] Failed to gather ${url}`, err);
    return null;
  }
}

/**
 * Gathers a compact analytics summary from the existing backend analytics
 * endpoints. Missing sections are simply omitted (best-effort).
 */
export async function gatherAnalyticsSummary(timeRange: InsightTimeRange): Promise<Record<string, unknown>> {
  const contentRange = timeRange; // content endpoint accepts day|week|month|all

  const [booksData, playlistsData, games, onboarding, paywall, retention, lessonRetention] =
    await Promise.all([
      safeGet(`/api/analytics/content?type=book&timeRange=${contentRange}`),
      safeGet(`/api/analytics/content?type=playlist&timeRange=${contentRange}`),
      safeGet('/api/analytics/games'),
      safeGet('/api/analytics/onboarding'),
      safeGet('/api/analytics/paywall'),
      safeGet('/api/analytics/retention'),
      safeGet('/api/analytics/lesson-retention'),
    ]);

  const summary: Record<string, unknown> = {};

  if (booksData?.books) summary.books = slimBooks(booksData.books);
  if (playlistsData?.playlists) summary.playlists = slimPlaylists(playlistsData.playlists);
  if (games) summary.games = games;
  if (onboarding) summary.onboardingFunnel = onboarding;
  if (paywall) summary.paywall = paywall;
  if (retention) summary.retention = retention;
  if (lessonRetention) summary.lessonRetention = lessonRetention;

  return summary;
}

export async function requestInsights(params: {
  tier: InsightTier;
  focus?: string;
  timeRange: InsightTimeRange;
  summary: Record<string, unknown>;
}): Promise<InsightResult> {
  const res = await apiClient.post(
    '/api/ai/insights',
    {
      tier: params.tier,
      focus: params.focus || '',
      timeRange: params.timeRange,
      summary: params.summary,
    },
    { headers: authHeaders() }
  );
  return res.data as InsightResult;
}
