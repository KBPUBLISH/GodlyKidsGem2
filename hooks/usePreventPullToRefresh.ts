import { useEffect } from 'react';

/**
 * Prevents mobile pull-to-refresh and reduces scroll/rubber-band chaining on the host
 * shell while a full-screen game iframe is shown, so vertical swipes reach the game.
 */
export function usePreventPullToRefresh(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prev = {
      html: html.style.overscrollBehavior,
      body: body.style.overscrollBehavior,
      root: root?.style.overscrollBehavior ?? '',
    };

    const value = 'none';
    html.style.overscrollBehavior = value;
    body.style.overscrollBehavior = value;
    if (root) root.style.overscrollBehavior = value;

    // Native shells (Despia / WKWebView / Android WebView) only drop their
    // pull-to-refresh gesture when the page consumes the touch. The host page
    // never scrolls while a full-screen game is up, so swallow downward drags
    // that start at the top — unless they begin inside a scrollable panel.
    const scrollable = (el: EventTarget | null): boolean => {
      let node = el instanceof Element ? el : null;
      while (node && node !== body) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return true;
        node = node.parentElement;
      }
      return false;
    };
    let startY = 0;
    let swallow = false;
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
      swallow = !scrollable(e.target) && (html.scrollTop === 0 && body.scrollTop === 0);
    };
    const onMove = (e: TouchEvent) => {
      if (!swallow || !e.cancelable) return;
      const y = e.touches[0]?.clientY ?? 0;
      if (y > startY) e.preventDefault();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });

    return () => {
      html.style.overscrollBehavior = prev.html;
      body.style.overscrollBehavior = prev.body;
      if (root) root.style.overscrollBehavior = prev.root;
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
    };
  }, [enabled]);
}
