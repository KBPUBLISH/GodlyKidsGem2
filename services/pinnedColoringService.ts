export type PinnedColoring = {
  bookId: string;
  /** pageId passed to DrawingCanvas saveKey (e.g. "book-123-coloring-5") */
  pageId: string;
  /** "5" or Mongo _id portion from pageId */
  pageRef: string;
  pinnedAt: number;
};

const PIN_PREFIX = 'godlykids_pinned_coloring_';
const DRAWING_PREFIX = 'godlykids_coloring_';

function storageKeyForBook(bookId: string) {
  return `${PIN_PREFIX}${bookId}`;
}

export function parseColoringPageId(pageId?: string): { bookId: string; pageRef: string } | null {
  if (!pageId) return null;
  // Expected: "book-<bookId>-coloring-<pageRef>"
  const m = /^book-(.+?)-coloring-(.+)$/.exec(pageId);
  if (!m) return null;
  return { bookId: m[1], pageRef: m[2] };
}

export const pinnedColoringService = {
  getPinned(bookId: string): PinnedColoring | null {
    try {
      const raw = localStorage.getItem(storageKeyForBook(bookId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PinnedColoring;
      if (!parsed || parsed.bookId !== bookId || !parsed.pageId || !parsed.pageRef) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  pinFromPageId(pageId: string): PinnedColoring | null {
    const parsed = parseColoringPageId(pageId);
    if (!parsed) return null;
    const pinned: PinnedColoring = {
      bookId: parsed.bookId,
      pageId,
      pageRef: parsed.pageRef,
      pinnedAt: Date.now(),
    };
    try {
      localStorage.setItem(storageKeyForBook(parsed.bookId), JSON.stringify(pinned));
      return pinned;
    } catch {
      return null;
    }
  },

  unpin(bookId: string) {
    try {
      localStorage.removeItem(storageKeyForBook(bookId));
    } catch {
      // ignore
    }
  },

  getDrawingDataUrl(pageId: string): string | null {
    try {
      return localStorage.getItem(`${DRAWING_PREFIX}${pageId}`);
    } catch {
      return null;
    }
  },
};


