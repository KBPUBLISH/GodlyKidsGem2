/** Synchronous same-origin wallet operation: validate before changing game inventory. */
export function transactFriendsWallet(request, wallet) {
  const balance = wallet.balance();
  const delta = request.delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(balance + delta) || balance + delta < 0 || typeof request.commit !== 'function') {
    return { ok: false, balance, reason: 'Not enough gold coins.' };
  }
  try { request.commit(); } catch {
    return { ok: false, balance, reason: 'We couldn’t save that. Please try again.' };
  }
  if (delta < 0) wallet.spend(-delta, 'Friends World purchase');
  if (delta > 0) wallet.earn(delta, 'Friends World earnings', 'game');
  return { ok: true, balance: wallet.balance() };
}
