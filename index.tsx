import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/** True when a returning family (language chosen, at least one kid) should reopen on the island. */
function openFriendsWorldOnColdStart() {
  try {
    if (localStorage.getItem('godlykids_language_selected') !== 'true') return false;
    const raw = localStorage.getItem('godly_kids_data_v6');
    if (!raw) return false;
    const userData = JSON.parse(raw);
    return Array.isArray(userData.kids) && userData.kids.length > 0;
  } catch {
    return false;
  }
}

// ============================================================
// URL NORMALIZATION & DEEP LINK HANDLING - MUST RUN BEFORE REACT MOUNTS
// ============================================================
// iOS WebViews (DeSpia) can inject query params or have malformed URLs.
// We normalize the URL ONCE here, BEFORE React Router initializes.
// This prevents white screens from route mismatches.
// 
// DEEP LINK HANDLING:
// When deep links open the app (e.g., https://app.godlykids.com/book/123),
// we need to convert the path to hash format (#/book/123) for HashRouter.
(() => {
  try {
    const ua = navigator.userAgent || '';
    const isDespia = /despia/i.test(ua);
    const url = new URL(window.location.href);

    // Dev: /#/listen?resetPremium=1 turns off the 1-day gift / local premium flags
    if ((window.location.hash || '').includes('resetPremium=1')) {
      try {
        localStorage.setItem('godlykids_dev_force_free', 'true');
        localStorage.setItem('godlykids_premium', 'false');
        localStorage.removeItem('godlykids_reverse_trial');
        localStorage.removeItem('godlykids_reverse_trial_end');
        localStorage.removeItem('godlykids_ships_library_paywall_seen');
        sessionStorage.removeItem('godlykids_ships_library_paywall_seen');
        localStorage.removeItem('godlykids_library_hs_guide');
        sessionStorage.removeItem('godlykids_library_hs_guide');
      } catch (e) {}
      const cleaned = (window.location.hash || '')
        .replace(/([?&])resetPremium=1&?/g, '$1')
        .replace(/[?&]$/, '')
        .replace(/\?$/, '');
      url.hash = cleaned;
      window.history.replaceState(null, '', url.toString());
      window.location.reload();
      return;
    }
    
    // Check for logout flag - if present, force landing page and clean state
    if (url.searchParams.has('logout')) {
      console.log('🔒 Logout detected - forcing complete fresh state');
      
      // Clear session storage but keep Bible Map completions (same account
      // logging back in should still see finished stories unlocked).
      try {
        const snap: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key && (key === 'godlykids_island_story_progress' || key.startsWith('godlykids_island_story_progress:'))) {
            const value = localStorage.getItem(key);
            if (value != null) snap[key] = value;
          }
        }
        localStorage.clear();
        Object.entries(snap).forEach(([key, value]) => {
          try { localStorage.setItem(key, value); } catch (e) {}
        });
      } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      
      // Remove logout param and set to landing page
      url.searchParams.delete('logout');
      url.hash = '#/';
      
      // Replace history then force reload for completely fresh React state
      window.history.replaceState(null, '', url.toString());
      window.location.reload();
      return; // Skip rest - reload will handle it
    }

    // ============================================================
    // DEEP LINK CONVERSION (works for both web and Despia)
    // ============================================================
    // Universal links / deep links open with path in pathname, not hash.
    // Convert: https://app.godlykids.com/book/123 → #/book/123
    // 
    // Supported deep link paths:
    // - /book/:id → book detail page
    // - /read/:bookId → book reader
    // - /audio/playlist/:playlistId → playlist detail
    // - /audio/playlist/:playlistId/play/:itemIndex → specific track
    // - /playlist/:playlistId → playlist (legacy format)
    // - /playlist/:playlistId/:trackIndex → playlist with track
    // - /share/playlist/:playlistId → share playlist page
    // - /share/book/:bookId → share book page
    // - /s/p/:playlistId → short playlist share
    // - /s/b/:bookId → short book share
    // - /lesson/:lessonId → lesson player
    // - /lessons → lessons list
    // - /home → home page
    // - /listen → listen page
    // - /read → read page
    // - /signin → sign in page
    // - /onboarding → onboarding
    // - /paywall → paywall
    // - /book-series/:seriesId → book series detail
    
    const deepLinkPaths = [
      /^\/book\/[^/]+$/,                           // /book/:id
      /^\/read\/[^/]+$/,                           // /read/:bookId
      /^\/audio\/playlist\/[^/]+$/,                // /audio/playlist/:playlistId
      /^\/audio\/playlist\/[^/]+\/play\/\d+$/,     // /audio/playlist/:playlistId/play/:itemIndex
      /^\/playlist\/[^/]+$/,                       // /playlist/:playlistId (legacy)
      /^\/playlist\/[^/]+\/\d+$/,                  // /playlist/:playlistId/:trackIndex
      /^\/share\/playlist\/[^/]+$/,                // /share/playlist/:playlistId
      /^\/share\/playlist\/[^/]+\/\d+$/,           // /share/playlist/:playlistId/:trackIndex
      /^\/share\/book\/[^/]+$/,                    // /share/book/:bookId
      /^\/s\/p\/[^/]+$/,                           // /s/p/:playlistId (short)
      /^\/s\/p\/[^/]+\/\d+$/,                      // /s/p/:playlistId/:trackIndex
      /^\/s\/b\/[^/]+$/,                           // /s/b/:bookId (short)
      /^\/lesson\/[^/]+$/,                         // /lesson/:lessonId
      /^\/book-series\/[^/]+$/,                    // /book-series/:seriesId
      /^\/lessons$/,
      /^\/home$/,
      /^\/world$/,
      /^\/listen$/,
      /^\/read$/,
      /^\/signin$/,
      /^\/sign-in$/,
      /^\/onboarding$/,
      /^\/paywall$/,
      /^\/paywall\/intro$/,
      /^\/paywall\/reminder$/,
      /^\/library$/,
      /^\/games$/,
      /^\/games\/library$/,
      /^\/settings$/,
      /^\/profile$/,
    ];
    
    const pathname = url.pathname;
    const isDeepLinkPath = deepLinkPaths.some(pattern => pattern.test(pathname));
    
    if (isDeepLinkPath && (!url.hash || url.hash === '#' || url.hash === '#/')) {
      // This is a deep link! Convert pathname to hash
      console.log('🔗 Deep link detected:', pathname);
      url.hash = '#' + pathname + (url.search || '');
      url.pathname = '/'; // Clear pathname
      url.search = '';    // Search params are now in the hash
      console.log('🔗 Converted to hash route:', url.hash);
      window.history.replaceState(null, '', url.toString());
      // Don't return - continue with other normalization if needed
    }
    
    if (isDespia) {
      let needsUpdate = false;
      
      // 1. Strip OneSignal and other injected query params
      const paramsToRemove = Array.from(url.searchParams.keys()).filter(k => 
        /^onesignal/i.test(k) || /^idcc/i.test(k)
      );
      paramsToRemove.forEach(k => {
        url.searchParams.delete(k);
        needsUpdate = true;
      });
      
      // 2. Check if this is a focus restoration after soft-close
      // If so, try to restore the last known route
      let targetHash = url.hash;
      const lastHiddenTs = parseInt(localStorage.getItem('gk_last_hidden_ts') || '0', 10);
      const timeSinceHidden = Date.now() - lastHiddenTs;
      const isReturningFromBackground = lastHiddenTs > 0 && timeSinceHidden < 10000; // Within 10 seconds
      
      if (isReturningFromBackground) {
        const lastRoute = localStorage.getItem('gk_last_route');
        console.log('📱 Despia: Returning from background, last route:', lastRoute);
        
        // If current hash is empty/default but we have a saved route, restore it
        // BUT don't override if we just processed a deep link
        if ((!url.hash || url.hash === '#' || url.hash === '#/') && lastRoute && !isDeepLinkPath) {
          targetHash = lastRoute;
          console.log('📱 Despia: Restoring to saved route:', targetHash);
        }
      } else if (!isDeepLinkPath && openFriendsWorldOnColdStart()) {
        // App was closed (not a quick switch back). Land on the island.
        const hashPath = (targetHash || '').replace(/^#/, '').split('?')[0];
        const keepSetup = ['/onboarding', '/signin', '/sign-in', '/paywall', '/create-profile', '/edit-profile', '/reset-password', '/language']
          .some((path) => hashPath === path || hashPath.startsWith(`${path}/`));
        if (!keepSetup && hashPath !== '/my-home') {
          targetHash = '#/my-home';
          console.log('📱 Despia: Cold start opens Friends World');
        }
      }
      
      // 3. Ensure hash exists for HashRouter (default to #/ landing page if missing)
      // IMPORTANT: Fresh installs should go to landing page, not home
      if (!targetHash || targetHash === '#') {
        targetHash = '#/';
      }
      
      // 4. Remove trailing slashes from hash (but keep #/home not #/home/)
      if (targetHash.length > 2 && targetHash.endsWith('/')) {
        targetHash = targetHash.slice(0, -1);
      }
      
      // 5. Apply changes if needed
      if (url.hash !== targetHash || paramsToRemove.length > 0) {
        url.hash = targetHash;
        needsUpdate = true;
      }
      
      // 6. Apply URL changes BEFORE React mounts (sync, no history manipulation during render)
      if (needsUpdate) {
        console.log('🔧 URL normalized before React mount:', url.toString());
        window.history.replaceState(null, '', url.toString());
      }
    }
  } catch (e) {
    console.error('URL normalization error:', e);
  }
})();

// ============================================================
// REACT APP MOUNT
// ============================================================
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
