/** The embedded island shares the selected app profile’s wallet. Standalone previews stay local. */
export function friendsWallet(action, data = {}) {
  if (window.parent === window) return null;
  const query = new URLSearchParams(window.location.search);
  const request = { ...data, action, source: window, scope: query.get('profile'), world: query.get('livingTest') === '1' ? 'living-test' : 'normal' };
  try { window.parent.dispatchEvent(new window.parent.CustomEvent('gk-friends-wallet', { detail: request })); } catch { /* Parent unavailable. Never spend a separate embedded wallet. */ }
  return request.result || { ok: false, reason: 'Your gold coins are still loading. Please try again.' };
}
