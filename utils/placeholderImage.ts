/**
 * Generates an inline SVG `data:` URI placeholder image.
 *
 * This is a local replacement for `https://via.placeholder.com`, which was
 * shut down and now returns `ERR_CONNECTION_CLOSED` for every request,
 * spamming the console with "RESOURCE LOAD ERROR" entries whenever a real
 * cover image failed to load.
 *
 * Because the result is a data URI it requires no network request and
 * cannot fail to load.
 *
 * @param width    Image width in pixels.
 * @param height   Image height in pixels.
 * @param bgColor  Background color as a 3/6-digit hex string WITHOUT the leading `#`.
 * @param text     Label drawn centered on the placeholder (emoji is supported).
 * @param textColor Text color as a 3/6-digit hex string WITHOUT the leading `#`.
 */
export function placeholderImage(
  width: number,
  height: number,
  bgColor: string,
  text: string,
  textColor: string = 'FFFFFF'
): string {
  const safeText = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Scale the font roughly the way placeholder.com did: ~40% of the smaller side.
  const fontSize = Math.max(12, Math.floor(Math.min(width, height) * 0.4));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="#${bgColor}"/>` +
      `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ` +
        `fill="#${textColor}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" ` +
        `font-size="${fontSize}" font-weight="bold">${safeText}</text>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Default brown 400x400 "Book Cover" placeholder used across the app. */
export const DEFAULT_BOOK_COVER = placeholderImage(400, 400, '8B4513', 'Book Cover');
