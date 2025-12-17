import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ============================================================
// URL NORMALIZATION - MUST RUN BEFORE REACT MOUNTS
// ============================================================
// iOS WebViews (DeSpia) can inject query params or have malformed URLs.
// We normalize the URL ONCE here, BEFORE React Router initializes.
// This prevents white screens from route mismatches.
(() => {
  try {
    const ua = navigator.userAgent || '';
    const isDespia = /despia/i.test(ua);
    
    if (isDespia) {
      const url = new URL(window.location.href);
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
        if ((!url.hash || url.hash === '#' || url.hash === '#/') && lastRoute) {
          targetHash = lastRoute;
          console.log('📱 Despia: Restoring to saved route:', targetHash);
        }
      }
      
      // 3. Ensure hash exists for HashRouter (default to #/home if missing)
      if (!targetHash || targetHash === '#' || targetHash === '#/') {
        targetHash = '#/home';
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
