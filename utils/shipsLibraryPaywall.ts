import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SEEN_KEY = 'godlykids_ships_library_paywall_seen';
export const SHIPS_PAYWALL_EVENT = 'gk-show-ships-paywall';

export type ShipsPaywallReason = 'library-intro' | 'library-story' | 'island';

export function hasSeenShipsLibraryPaywall(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1' || sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markShipsLibraryPaywallSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

function returnPathForReason(reason?: ShipsPaywallReason): string {
  return reason === 'island' ? '/map' : '/listen';
}

/** Same subscription, two doors — library story or next island. */
export function requestShipsLibraryPaywall(reason: ShipsPaywallReason = 'library-story'): boolean {
  try {
    if (localStorage.getItem('godlykids_dev_force_free') !== 'true' && localStorage.getItem('godlykids_premium') === 'true') {
      return false;
    }
  } catch {
    /* private mode */
  }
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(SHIPS_PAYWALL_EVENT, { detail: { reason } }));
  return true;
}

/** Opens the Settings paywall (`/paywall`) whenever library or island access is gated. */
export function ShipsPaywallHost(): null {
  const navigate = useNavigate();

  useEffect(() => {
    const onShow = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: ShipsPaywallReason }>).detail?.reason;
      navigate('/paywall', {
        state: {
          from: 'library',
          shipsPaywallReason: reason,
          returnTo: returnPathForReason(reason),
        },
      });
    };
    window.addEventListener(SHIPS_PAYWALL_EVENT, onShow);
    return () => window.removeEventListener(SHIPS_PAYWALL_EVENT, onShow);
  }, [navigate]);

  return null;
}
