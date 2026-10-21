/**
 * Cover image variant helpers.
 *
 * Optimized covers are stored as WebP with a predictable naming convention:
 *   full:  books/{id}/cover/123_name.webp
 *   thumb: books/{id}/cover/123_name_thumb.webp
 *
 * The small `thumb` variant is generated alongside the full image at upload
 * time (and by the backfill script), so we can derive its URL purely from the
 * full URL — no extra DB fields required.
 *
 * Derivation only happens for WebP files we host (GCS or our own /uploads),
 * which guarantees the thumb actually exists. Any other URL (legacy JPG/PNG,
 * external placeholders, etc.) is returned unchanged.
 */

const isOurOptimizedCover = (url: string): boolean =>
  /\.webp(\?|$)/i.test(url) &&
  (url.includes('storage.googleapis.com') || url.includes('/uploads/'));

export type CoverVariant = 'full' | 'thumb';

/**
 * Return the requested variant of a cover URL.
 * Falls back to the original URL when the variant can't be safely derived.
 */
export const getCoverVariant = (
  url: string | undefined | null,
  variant: CoverVariant
): string => {
  if (!url) return '';
  if (variant === 'full') return url;
  if (!isOurOptimizedCover(url)) return url;
  if (/_thumb\.webp(\?|$)/i.test(url)) return url; // already a thumb
  return url.replace(/\.webp(\?|$)/i, '_thumb.webp$1');
};

/** Small thumbnail variant — use in grids, cards, lists, mini-player. */
export const getCoverThumb = (url: string | undefined | null): string =>
  getCoverVariant(url, 'thumb');

/** Full-size variant — use in detail heroes and full-screen players. */
export const getCoverFull = (url: string | undefined | null): string =>
  getCoverVariant(url, 'full');
