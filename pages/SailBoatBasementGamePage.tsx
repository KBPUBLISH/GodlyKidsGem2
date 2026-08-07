import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import WoodBackButton from '../components/WoodBackButton';

const BASEMENT_PATH = '/sail/basement';
const WHITE_FADE_MS = 480;
// Local, ad-free pool game bundled with the app — no external site, no Famobi.
const POOL_GAME_URL = '/games/pocket-pals-pool.html';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * In-app pool game (Pocket Pals) served from our own public assets, so kids
 * never leave the app and there are no third-party ads or splash screens.
 */
const SailBoatBasementGamePage: React.FC = () => {
  const navigate = useNavigate();
  const [whiteFade, setWhiteFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timersRef = useRef<number[]>([]);
  const reduceMotion = prefersReducedMotion();

  usePreventPullToRefresh(true);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setWhiteFade(false);
      return;
    }
    const id = window.setTimeout(() => setWhiteFade(false), 40);
    timersRef.current.push(id);
    return () => clearTimers();
  }, [clearTimers, reduceMotion]);

  const goBackToBasement = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    clearTimers();

    const leave = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(BASEMENT_PATH, { replace: true });
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
        onClick={goBackToBasement}
        disabled={leaving}
        className="fixed z-[60] w-12 h-12"
        style={{
          top: 'max(var(--safe-area-top, 0px), 12px)',
          left: 'max(var(--safe-area-left, 0px), 12px)',
        }}
        aria-label="Back to basement"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#16233A] z-10">
          <div className="text-center">
            <Loader2 size={48} className="text-[#FFD166] animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Racking up the balls...</p>
          </div>
        </div>
      )}

      <div className="flex-1 relative min-h-0 overscroll-none" style={{ overscrollBehavior: 'none' }}>
        <iframe
          src={POOL_GAME_URL}
          title="Pocket Pals — Pool for Kids"
          className="w-full h-full border-0 overscroll-none"
          allow="autoplay"
          onLoad={() => setLoading(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overscrollBehavior: 'none',
          }}
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

export default SailBoatBasementGamePage;
