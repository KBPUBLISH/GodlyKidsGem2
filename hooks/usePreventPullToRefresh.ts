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

    return () => {
      html.style.overscrollBehavior = prev.html;
      body.style.overscrollBehavior = prev.body;
      if (root) root.style.overscrollBehavior = prev.root;
    };
  }, [enabled]);
}
