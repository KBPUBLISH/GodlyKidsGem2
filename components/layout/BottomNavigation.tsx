import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Anchor, Ship } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { useTutorial } from '../../context/TutorialContext';

const MAP_FOOTER_FRAME = '/assets/images/map-footer-frame.png';
/** Native size of map-footer-frame.png (846×295). */
const MAP_FOOTER_ASPECT = 295 / 846;
/** Same wheel art as CrewPage / SailScenePage. */
const SAIL_STEERING_WHEEL = '/assets/images/sail-steering-wheel.png';
/** Gold star art (island quiz win) reused as the Favorites icon. */
const GOLD_STAR = '/assets/images/island-star-win.png';
/** Treasure-map illustration (user-provided, background removed) — Library tab. */
const TAB_MAP = '/assets/ui/tab-map.png';

const MAIN_NAV_PAGES = [
  '/world',
  '/home',
  '/listen',
  '/read',
  '/games',
  '/map',
  '/library',
];

type NavItem = {
  id: string;
  label: string;
  path: string;
};

/**
 * Home (anchor) · Library (treasure map) · My Journey (ship wheel) ·
 * Favorites (gold star) · Crew (ship).
 * My Journey opens the sail deck (/sail), where the kid steers the wheel
 * between islands; the island map (/map) is reached from there.
 * The active tab sits in a cream door-shaped arch that rises above the plank.
 */
const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/world' },
  { id: 'library', label: 'Library', path: '/listen' },
  { id: 'journey', label: 'My Journey', path: '/sail' },
  { id: 'favorites', label: 'Favorites', path: '/library' },
  { id: 'crew', label: 'Crew', path: '/crew' },
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
  if (pathname === '/world' || pathname === '/home' || pathname === '/') return 'home';
  // /read stays reachable via the Library page's Listen/Read toggle.
  if (pathname === '/listen' || pathname === '/read') return 'library';
  // /map (island map) still lights the Journey tab; tapping it goes to /sail.
  if (pathname === '/sail' || pathname === '/map') return 'journey';
  if (pathname === '/library') return 'favorites';
  if (pathname === '/crew') return 'crew';
  // /games and other main pages: no matching tab highlight
  return null;
};

const renderTabIcon = (id: string): React.ReactNode => {
  switch (id) {
    case 'home':
      return <Anchor className="gk-tab-anchor" strokeWidth={2.75} aria-hidden />;
    case 'library':
      return <img src={TAB_MAP} alt="" draggable={false} className="gk-tab-img" />;
    case 'journey':
      return <img src={SAIL_STEERING_WHEEL} alt="" draggable={false} className="gk-tab-img" />;
    case 'favorites':
      return <img src={GOLD_STAR} alt="" draggable={false} className="gk-tab-img" />;
    case 'crew':
      return <Ship className="gk-tab-ship" strokeWidth={2.4} aria-hidden />;
    default:
      return null;
  }
};

/**
 * Shared wood+rope footer with 5 tabs; the active tab pops up in a cream
 * door/arch shape. Used on every main-nav page (including Map, My Library and
 * Crew).
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
        className="wood-tab-nav absolute left-0 right-0 z-[50] flex items-end justify-evenly pointer-events-none"
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
              className={`gk-tab pointer-events-auto touch-manipulation outline-none ${
                isActive ? 'gk-tab--active' : ''
              }${item.id === 'journey' ? ' gk-tab--journey' : ''}`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="gk-tab-icon" aria-hidden>
                {renderTabIcon(item.id)}
              </span>
              {item.id !== 'journey' && <span className="gk-tab-label">{item.label}</span>}
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
          padding: 0 0.3rem 6px;
        }
        .gk-tab {
          --gk-icon: clamp(24px, 7.2vw, 30px);
          flex: 1 1 0;
          min-width: 0;
          max-width: 96px;
          /* Length (not auto) so min-height animates to the active arch height. */
          min-height: 50px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 2px;
          border: none;
          background: transparent;
          padding: 4px 2px 3px;
          border-radius: 14px;
          transition:
            transform 0.18s ease,
            background 0.18s ease,
            box-shadow 0.18s ease,
            min-height 0.18s ease,
            border-radius 0.18s ease,
            padding 0.18s ease,
            gap 0.18s ease;
        }
        .gk-tab:active {
          transform: scale(0.94);
        }
        .gk-tab:focus-visible {
          box-shadow: 0 0 0 2px #ffd700;
        }
        .gk-tab-icon {
          width: var(--gk-icon);
          height: var(--gk-icon);
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 2px rgba(40, 18, 4, 0.4));
          transition: width 0.18s ease, height 0.18s ease;
        }
        .gk-tab-img,
        .gk-tab-svg {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          user-select: none;
          pointer-events: none;
        }
        /* Anchor / ship use currentColor: cream on the plank, dark inside the notch. */
        .gk-tab-anchor,
        .gk-tab-ship {
          width: 92%;
          height: 92%;
          color: #ffeec9;
        }
        .gk-tab-label {
          font-family: 'Nunito', system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(0.52rem, 2.4vw, 0.7rem);
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.92);
          text-shadow: 0 1px 2px rgba(40, 18, 4, 0.6);
          line-height: 1;
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /*
         * Active tab: no container — the icon grows a step and the label turns
         * gold, so the plank stays clean. (The old cream "door" arch is gone.)
         */
        .gk-tab--active {
          --gk-icon: clamp(30px, 9vw, 36px);
        }
        .gk-tab--active .gk-tab-label {
          color: #ffd95a;
          text-shadow: 0 1px 2px rgba(40, 18, 4, 0.8), 0 0 8px rgba(255, 200, 60, 0.45);
        }
        .gk-tab--active .gk-tab-anchor,
        .gk-tab--active .gk-tab-ship {
          color: #ffe08a;
        }
        /*
         * Centre tab (My Journey): the ship's wheel is the hero control — a
         * big bare wheel (no medallion) that rises above the plank and rope
         * (the button itself is taller, so the raised part is tappable) and
         * rocks gently so it reads as "turn me".
         */
        .gk-tab--journey {
          --gk-icon: clamp(92px, 27vw, 108px);
          --gk-rise: 44px;
          max-width: 132px;
          min-height: calc(var(--app-footer-h) + var(--gk-rise));
          justify-content: flex-start;
          padding-top: 0;
          gap: 0;
          overflow: visible;
        }
        .gk-tab--journey .gk-tab-icon {
          filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.5));
        }
        .gk-tab--journey .gk-tab-img {
          animation: gk-wheel-rock 3.2s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        .gk-tab--journey .gk-tab-label {
          color: #ffe08a;
          text-shadow: 0 1px 2px rgba(40, 18, 4, 0.8);
          font-size: clamp(0.56rem, 2.6vw, 0.74rem);
        }
        .gk-tab--journey.gk-tab--active .gk-tab-icon {
          filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 10px rgba(255, 215, 90, 0.7));
        }
        .gk-tab--journey:active {
          transform: scale(0.96);
        }
        @keyframes gk-wheel-rock {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gk-tab--journey .gk-tab-img {
            animation: none;
          }
        }
        @media (min-width: 768px) {
          .wood-tab-nav {
            padding: 0 1.1rem 8px;
          }
          .gk-tab {
            --gk-icon: 34px;
            max-width: 118px;
            gap: 3px;
          }
          .gk-tab--active {
            --gk-icon: 40px;
          }
          .gk-tab--journey {
            --gk-icon: 116px;
            --gk-rise: 48px;
            max-width: 160px;
          }
          .gk-tab-label {
            font-size: 0.78rem;
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
