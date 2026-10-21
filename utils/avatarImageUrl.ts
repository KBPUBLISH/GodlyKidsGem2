/** Local avatar PNG under /avatars/… */
export function isAvatarPngPath(src: string | null | undefined): src is string {
  return typeof src === 'string' && src.startsWith('/avatars/') && src.endsWith('.png');
}

/** Full-size WebP sibling (same path, .webp extension). */
export function getAvatarWebpUrl(pngPath: string): string {
  return pngPath.replace(/\.png$/i, '.webp');
}

/** 160px shop-grid thumb WebP (e.g. /avatars/bodies/thumbs/body-1.webp). */
export function getShopThumbUrl(pngPath: string): string {
  const parts = pngPath.split('/');
  const file = parts.pop()!;
  return [...parts, 'thumbs', file.replace(/\.png$/i, '.webp')].join('/');
}
