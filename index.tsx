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
      
      // 2. Ensure hash exists for HashRouter (default to #/home if missing)
      if (!url.hash || url.hash === '#' || url.hash === '#/') {
        url.hash = '#/home';
        needsUpdate = true;
      }
      
      // 3. Remove trailing slashes from hash (but keep #/home not #/home/)
      if (url.hash.length > 2 && url.hash.endsWith('/')) {
        url.hash = url.hash.slice(0, -1);
        needsUpdate = true;
      }
      
      // 4. Apply URL changes BEFORE React mounts (sync, no history manipulation during render)
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
