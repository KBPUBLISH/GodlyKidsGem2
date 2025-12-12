export type PinnedColoring = {
  bookId: string;
  /** pageId passed to DrawingCanvas saveKey (e.g. "book-123-coloring-5") */
  pageId: string;
  /** "5" or Mongo _id portion from pageId */
  pageRef: string;
  pinnedAt: number;
  /** The coloring page line art URL (so we can overlay it on top of the drawing) */
  backgroundUrl?: string;
  /** Whether we have a pre-composited image stored */
  hasComposite?: boolean;
};

const PIN_PREFIX = 'godlykids_pinned_coloring_';
const DRAWING_PREFIX = 'godlykids_coloring_';
const COMPOSITE_PREFIX = 'godlykids_fridge_composite_';

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

  pinFromPageId(pageId: string, backgroundUrl?: string): PinnedColoring | null {
    const parsed = parseColoringPageId(pageId);
    if (!parsed) return null;
    const pinned: PinnedColoring = {
      bookId: parsed.bookId,
      pageId,
      pageRef: parsed.pageRef,
      pinnedAt: Date.now(),
      backgroundUrl,
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

  /**
   * Pin with a pre-composited image (drawing + line art baked together)
   */
  pinWithComposite(pageId: string, compositeDataUrl: string): PinnedColoring | null {
    const parsed = parseColoringPageId(pageId);
    if (!parsed) return null;
    
    try {
      // Store the composite image
      localStorage.setItem(`${COMPOSITE_PREFIX}${parsed.bookId}`, compositeDataUrl);
      
      // Store the pin record
      const pinned: PinnedColoring = {
        bookId: parsed.bookId,
        pageId,
        pageRef: parsed.pageRef,
        pinnedAt: Date.now(),
        hasComposite: true,
      };
      localStorage.setItem(storageKeyForBook(parsed.bookId), JSON.stringify(pinned));
      return pinned;
    } catch (e) {
      console.error('Failed to store composite pin:', e);
      return null;
    }
  },

  /**
   * Get the composite image for a book (if available)
   */
  getCompositeUrl(bookId: string): string | null {
    try {
      return localStorage.getItem(`${COMPOSITE_PREFIX}${bookId}`);
    } catch {
      return null;
    }
  },

  /**
   * Clean up composite when unpinning
   */
  unpinWithCleanup(bookId: string) {
    try {
      localStorage.removeItem(storageKeyForBook(bookId));
      localStorage.removeItem(`${COMPOSITE_PREFIX}${bookId}`);
    } catch {
      // ignore
    }
  },
};


