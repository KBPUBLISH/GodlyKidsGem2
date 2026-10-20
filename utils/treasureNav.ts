const FALLBACK_PATH = '/sail';

/** In-app path only — reject protocol-relative / open redirects. */
export function safeAppReturnPath(path?: string, fallback = FALLBACK_PATH): string {
  if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
    return path;
  }
  return fallback;
}

/** Location.state when opening the game shelf after a finished dig. */
export type GameShelfFromTreasureState = {
  returnTo?: string;
  fromCompletedTreasure?: boolean;
};
