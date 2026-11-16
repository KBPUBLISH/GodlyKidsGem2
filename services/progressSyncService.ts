// Progress Sync Service - reports content progress (book/game/island ids only) to our backend
// so it can send personalised notifications: next story, newly unlocked games, island tips.
// First-party only; nothing goes to third-party analytics.

import { getApiBaseUrl } from './apiService';
import { authService } from './authService';

const FLUSH_DELAY_MS = 10000;
const BACKFILL_KEY = 'godlykids_progress_backfilled_v1';

interface ProgressReport {
  completedBooks?: Array<{ bookId: string; completedAt: number }>;
  inProgressBooks?: Array<{ bookId: string; pageIndex: number; lastReadAt: number }>;
  completedGames?: Array<{ gameId: string; completedAt: number }>;
  island?: { buildings: string[]; harvestCount?: number; cookedRecipeCount?: number };
}

let pending: Required<Omit<ProgressReport, 'island'>> & { island?: ProgressReport['island'] } = {
  completedBooks: [],
  inProgressBooks: [],
  completedGames: [],
};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const hasPending = () =>
  pending.completedBooks.length > 0 ||
  pending.inProgressBooks.length > 0 ||
  pending.completedGames.length > 0 ||
  !!pending.island;

const flush = async (): Promise<void> => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!hasPending()) return;
  const userId = authService.getUserIdForBackend();
  if (!userId) return;

  const report = pending;
  pending = { completedBooks: [], inProgressBooks: [], completedGames: [] };
  try {
    await fetch(`${getApiBaseUrl()}app-user/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...report }),
      keepalive: true,
    });
  } catch (error) {
    console.warn('Progress sync failed:', error);
  }
};

const scheduleFlush = (immediate = false) => {
  if (immediate) {
    void flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}

export const progressSyncService = {
  reportBookCompleted(bookId: string, completedAt: number = Date.now()): void {
    pending.completedBooks.push({ bookId, completedAt });
    pending.inProgressBooks = pending.inProgressBooks.filter((p) => p.bookId !== bookId);
    scheduleFlush(true);
  },

  reportReadingProgress(bookId: string, pageIndex: number): void {
    pending.inProgressBooks = pending.inProgressBooks.filter((p) => p.bookId !== bookId);
    pending.inProgressBooks.push({ bookId, pageIndex, lastReadAt: Date.now() });
    scheduleFlush();
  },

  reportGameCompleted(gameId: string, completedAt: number = Date.now()): void {
    pending.completedGames.push({ gameId, completedAt });
    scheduleFlush(true);
  },

  /** For the island game: current building ids (e.g. 'garden', 'oven' = Starter Kitchen) and counters. */
  reportIsland(island: { buildings: string[]; harvestCount?: number; cookedRecipeCount?: number }): void {
    pending.island = island;
    scheduleFlush();
  },

  /** One-time upload of progress recorded on this device before syncing existed. */
  backfillOnce(completedBooks: Array<{ bookId: string; completedAt: number }>): void {
    try {
      if (localStorage.getItem(BACKFILL_KEY) || completedBooks.length === 0) return;
      if (!authService.getUserIdForBackend()) return;
      localStorage.setItem(BACKFILL_KEY, String(Date.now()));
    } catch {
      return;
    }
    pending.completedBooks.push(...completedBooks);
    scheduleFlush(true);
  },
};
