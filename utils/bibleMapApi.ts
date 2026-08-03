import { getApiBaseUrl } from '../services/apiService';

/** API root that already includes `/api` (e.g. `https://host/api`). */
export const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

/** Resolve CMS media URLs (GCS absolute or /uploads relative). */
export const resolveBibleMapMediaUrl = (url: string | undefined | null): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  const base = getApiBaseUrl().replace(/\/$/, '');
  const origin = base.replace(/\/api$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
};

export const TABLET_MIN_WIDTH = 768;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
