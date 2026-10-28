import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import WoodBackButton from '../components/WoodBackButton';
import {
  installParentWindowOpenGuard,
  kidSafeIframeProps,
} from '../utils/kidSafeGameIframe';

const CREW_PATH = '/crew';
const WHITE_FADE_MS = 480;
const CANON_GOLF_URL = 'https://canongolf.netlify.app/';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Canon Golf — opened from the glowing cannon on the crew deck.
 * Route: /crew/canon
 */
const CrewCanonGolfPage: React.FC = () => {
  const navigate = useNavigate();
  const [whiteFade, setWhiteFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timersRef = useRef<number[]>([]);
  const reduceMotion = prefersReducedMotion();
  const iframeProps = kidSafeIframeProps('Canon Golf');

  usePreventPullToRefresh(true);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => installParentWindowOpenGuard(), []);

  useEffect(() => {
    if (reduceMotion) {
      setWhiteFade(false);
      return;
    }
    const id = window.setTimeout(() => setWhiteFade(false), 40);
    timersRef.current.push(id);
    return () => clearTimers();
  }, [clearTimers, reduceMotion]);

  const goBackToCrew = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    clearTimers();

    const leave = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(CREW_PATH, { replace: true });
      }
    };

    if (reduceMotion) {
      setWhiteFade(true);
      const id = window.setTimeout(leave, 80);
      timersRef.current = [id];
      return;
    }

    setWhiteFade(true);
    const navId = window.setTimeout(leave, WHITE_FADE_MS);
    timersRef.current = [navId];
  }, [clearTimers, leaving, navigate, reduceMotion]);

  return (
    <div
      className="relative h-[100dvh] min-h-0 bg-[#16233A] flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      <WoodBackButton
        onClick={goBackToCrew}
        disabled={leaving}
        className="fixed z-[60] w-12 h-12"
        style={{
          bottom: 'max(14px, calc(var(--safe-area-bottom, 0px) + 10px))',
          left: 'max(10px, env(safe-area-inset-left, 0px))',
        }}
        aria-label="Back to ship deck"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#16233A] z-10">
          <div className="text-center">
            <Loader2 size={48} className="text-[#FFD166] animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Loading the cannon...</p>
          </div>
        </div>
      )}

      <div className="flex-1 relative min-h-0 overscroll-none" style={{ overscrollBehavior: 'none' }}>
        <iframe
          src={CANON_GOLF_URL}
          className="w-full h-full border-0 overscroll-none"
          onLoad={() => setLoading(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overscrollBehavior: 'none',
          }}
          {...iframeProps}
        />
      </div>

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 99980,
          background: '#fff',
          opacity: whiteFade ? 1 : 0,
          transition: reduceMotion ? 'none' : `opacity ${WHITE_FADE_MS}ms ease-in-out`,
        }}
        aria-hidden
      />
    </div>
  );
};

export default CrewCanonGolfPage;
