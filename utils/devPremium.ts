const FORCE_FREE_KEY = 'godlykids_dev_force_free';

export function isDevForceFree(): boolean {
  try {
    return localStorage.getItem(FORCE_FREE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Turn off local premium + reverse-trial flags so paywall testing works. */
export function applyDevResetPremium(): void {
  try {
    localStorage.setItem(FORCE_FREE_KEY, 'true');
    localStorage.setItem('godlykids_premium', 'false');
    localStorage.removeItem('godlykids_reverse_trial');
    localStorage.removeItem('godlykids_reverse_trial_end');
    localStorage.removeItem('godlykids_ships_library_paywall_seen');
    sessionStorage.removeItem('godlykids_ships_library_paywall_seen');
    localStorage.removeItem('godlykids_library_hs_guide');
    sessionStorage.removeItem('godlykids_library_hs_guide');
    localStorage.removeItem('godlykids_free_library_story_id');
    sessionStorage.removeItem('godlykids_free_library_story_id');
  } catch {
    /* private mode */
  }
}

export function clearDevForceFree(): void {
  try {
    localStorage.removeItem(FORCE_FREE_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * If the URL hash includes resetPremium=1, clear premium for this device and
 * return true so the caller can reload with a clean hash.
 */
export function consumeResetPremiumHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  if (!hash.includes('resetPremium=1')) return false;
  applyDevResetPremium();
  const cleaned = hash
    .replace(/([?&])resetPremium=1&?/g, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?$/, '');
  const url = new URL(window.location.href);
  url.hash = cleaned;
  window.history.replaceState(null, '', url.toString());
  return true;
}
