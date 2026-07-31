import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAudio } from '../../context/AudioContext';
import { useTutorial } from '../../context/TutorialContext';

const MAP_FOOTER_FRAME = '/assets/images/map-footer-frame.png';
/** Native size of map-footer-frame.png (846×295). */
const MAP_FOOTER_ASPECT = 295 / 846;

const MAIN_NAV_PAGES = ['/world', '/home', '/listen', '/read', '/games', '/map'];

type NavItem = {
  id: string;
  label: string;
  path: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'explore', label: 'Explore', path: '/world' },
  { id: 'listen', label: 'Listen', path: '/listen' },
  { id: 'read', label: 'Read', path: '/read' },
  { id: 'games', label: 'Games', path: '/games' },
];

/** Tutorial / programmatic tab → path (OnboardingTutorial still dispatches wheel events). */
const TUTORIAL_TAB_PATHS: Record<string, string> = {
  explore: '/world',
  listen: '/listen',
  read: '/read',
  games: '/games',
  map: '/map',
};

const getActiveTab = (pathname: string): string | null => {
  if (pathname === '/world' || pathname === '/home' || pathname === '/') return 'explore';
  if (pathname === '/listen') return 'listen';
  if (pathname === '/read') return 'read';
  if (pathname === '/games') return 'games';
  // /map and other main pages: no matching tab highlight
  return null;
};

/**
 * Shared wood+rope footer with EXPLORE · LISTEN · READ · GAMES pills.
 * Used on every main-nav page (including Map). No ship wheel.
 */
const WoodTabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTab } = useAudio();
  const { isTutorialActive, skipTutorial, currentStep } = useTutorial();
  const activeTab = getActiveTab(location.pathname);

  const handleNav = (id: string, path: string) => {
    if (activeTab === id && location.pathname === path) return;

    if (
      isTutorialActive &&
      currentStep !== 'navigate_to_games' &&
      currentStep !== 'navigate_to_explore' &&
      currentStep !== 'navigate_to_books' &&
      currentStep !== 'navigate_to_audio'
    ) {
      skipTutorial();
    }

    playTab();
    navigate(path);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none bottom-nav-bar wood-tab-bar-root"
      style={{
        paddingBottom:
          'calc(var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px))',
      }}
    >
      {/* Wood plank + rope along top */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[35] pointer-events-none"
        aria-hidden
      >
        <img
          src={MAP_FOOTER_FRAME}
          alt=""
          className="block w-full select-none"
          draggable={false}
          style={{
            width: '100%',
            height: 'var(--app-footer-h)',
            objectFit: 'cover',
            objectPosition: 'center top',
            filter: 'drop-shadow(0 -4px 10px rgba(0,0,0,0.28))',
          }}
        />
        {/* Safe-area + modest lift fill so the plank sits above the absolute bottom */}
        <div
          style={{
            height:
              'calc(var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px))',
            background: 'linear-gradient(0deg, #a86a3e 0%, #b87d4a 100%)',
          }}
        />
      </div>

      <nav
        className="wood-tab-nav absolute left-0 right-0 z-[50] flex items-center justify-evenly gap-1.5 pointer-events-none"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id, item.path)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`wood-tab-btn pointer-events-auto touch-manipulation active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                isActive ? 'wood-tab-btn--active' : ''
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="wood-tab-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        body[data-modal-open="true"] .bottom-nav-bar {
          display: none !important;
          pointer-events: none !important;
        }
        /* Keep in sync with MapPage scroll pad (--map-footer-h / --wood-tab-lift on :root). */
        .wood-tab-bar-root {
          --app-footer-h: var(
            --map-footer-h,
            min(calc(100vw * ${MAP_FOOTER_ASPECT}), 10vh, 78px)
          );
        }
        :root {
          /* Modest lift off the absolute bottom (plus safe-area). */
          --wood-tab-lift: 12px;
          --map-footer-h: min(
            calc(100vw * ${MAP_FOOTER_ASPECT}),
            10vh,
            78px
          );
        }
        @media (min-width: 768px) {
          :root {
            --map-footer-h: min(
              calc(100vw * ${MAP_FOOTER_ASPECT}),
              8.5vh,
              88px
            );
          }
        }
        .wood-tab-nav {
          bottom: calc(
            var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px)
          );
          height: var(--app-footer-h);
          box-sizing: border-box;
          /* Clear rope limb at top of map-footer-frame */
          padding: 18px 0.55rem 8px;
        }
        .wood-tab-btn {
          flex: 1 1 0;
          max-width: 92px;
          height: min(38px, calc(var(--app-footer-h) - 28px));
          border-radius: 9999px;
          border: 2px solid #5c3a1a;
          background:
            linear-gradient(180deg, #c48a52 0%, #a56b3a 42%, #8b5a2b 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 230, 180, 0.45),
            inset 0 -2px 3px rgba(60, 30, 8, 0.35),
            0 2px 4px rgba(0, 0, 0, 0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.35rem;
        }
        .wood-tab-btn--active {
          border-color: #e8c060;
          background:
            linear-gradient(180deg, #d9a05e 0%, #b87a40 42%, #9a5f28 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 240, 200, 0.55),
            inset 0 -2px 3px rgba(60, 30, 8, 0.3),
            0 0 0 1px rgba(255, 215, 0, 0.35),
            0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .wood-tab-label {
          font-family: 'Nunito', system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(0.62rem, 2.8vw, 0.78rem);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.88);
          text-shadow: 0 1px 2px rgba(40, 18, 4, 0.55);
          line-height: 1;
          white-space: nowrap;
        }
        .wood-tab-btn--active .wood-tab-label {
          color: #ffffff;
          text-shadow:
            0 0 6px rgba(255, 220, 120, 0.45),
            0 1px 2px rgba(40, 18, 4, 0.5);
        }
        @media (min-width: 768px) {
          .wood-tab-nav {
            padding: 20px 1.25rem 10px;
            gap: 0.65rem;
          }
          .wood-tab-btn {
            max-width: 110px;
            height: min(42px, calc(var(--app-footer-h) - 30px));
          }
          .wood-tab-label {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTab } = useAudio();
  const [isHidden, setIsHidden] = useState(false);

  const navigateToTab = useCallback(
    (tabId: string) => {
      const path = TUTORIAL_TAB_PATHS[tabId];
      if (!path || location.pathname === path) return;
      playTab();
      navigate(path);
    },
    [location.pathname, navigate, playTab],
  );

  useEffect(() => {
    const handleTutorialNavigate = (e: Event) => {
      const { target } = (e as CustomEvent).detail;
      navigateToTab(target);
    };

    window.addEventListener('tutorial_navigate_wheel', handleTutorialNavigate);
    return () => window.removeEventListener('tutorial_navigate_wheel', handleTutorialNavigate);
  }, [navigateToTab]);

  useEffect(() => {
    const checkModalState = () => {
      setIsHidden(document.body.hasAttribute('data-modal-open'));
    };

    checkModalState();

    const observer = new MutationObserver(checkModalState);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-modal-open'] });

    return () => observer.disconnect();
  }, []);

  const isAllowedPage = MAIN_NAV_PAGES.includes(location.pathname);
  if (isHidden || !isAllowedPage) {
    return null;
  }

  return <WoodTabBar />;
};

export default BottomNavigation;
