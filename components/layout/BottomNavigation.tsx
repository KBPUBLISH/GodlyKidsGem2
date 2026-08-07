import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Anchor } from 'lucide-react';
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
  '/games/library',
];

type NavItem = {
  id: string;
  label: string;
  path: string;
};

/**
 * Home (ship wheel) · Library (treasure map) · My Journey (anchor) ·
 * Favorites (gold star) · Rewards (treasure chest).
 * The active tab sits in a cream door-shaped arch that rises above the plank.
 */
const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/world' },
  { id: 'library', label: 'Library', path: '/listen' },
  { id: 'journey', label: 'My Journey', path: '/map' },
  { id: 'favorites', label: 'Favorites', path: '/library' },
  { id: 'rewards', label: 'Rewards', path: '/games/library' },
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
  if (pathname === '/map') return 'journey';
  if (pathname === '/library') return 'favorites';
  if (pathname === '/games/library') return 'rewards';
  // /games and other main pages: no matching tab highlight
  return null;
};

/** Treasure chest icon (brown chest, gold band + lock). */
const TreasureChestIcon: React.FC = () => (
  <svg viewBox="0 0 36 32" className="gk-tab-svg" aria-hidden>
    <path
      d="M3 14 Q3 3.5 18 3.5 Q33 3.5 33 14 L33 16.5 L3 16.5 Z"
      fill="#9C6633"
      stroke="#4A2E12"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <rect
      x="3"
      y="16.5"
      width="30"
      height="12"
      rx="2"
      fill="#B5793F"
      stroke="#4A2E12"
      strokeWidth="1.8"
    />
    <rect x="14.4" y="3.8" width="7.2" height="24.4" fill="#E9B94D" stroke="#4A2E12" strokeWidth="1.6" />
    <rect x="15.6" y="13" width="4.8" height="7" rx="1.2" fill="#F4CE6A" stroke="#4A2E12" strokeWidth="1.4" />
    <circle cx="18" cy="15.8" r="1.15" fill="#4A2E12" />
    <path d="M18 16.6 L18 18.4" stroke="#4A2E12" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const renderTabIcon = (id: string): React.ReactNode => {
  switch (id) {
    case 'home':
      return <img src={SAIL_STEERING_WHEEL} alt="" draggable={false} className="gk-tab-img" />;
    case 'library':
      return <img src={TAB_MAP} alt="" draggable={false} className="gk-tab-img" />;
    case 'journey':
      return <Anchor className="gk-tab-anchor" strokeWidth={2.75} aria-hidden />;
    case 'favorites':
      return <img src={GOLD_STAR} alt="" draggable={false} className="gk-tab-img" />;
    case 'rewards':
      return <TreasureChestIcon />;
    default:
      return null;
  }
};

/**
 * Shared wood+rope footer with 5 tabs; the active tab pops up in a cream
 * door/arch shape. Used on every main-nav page (including Map, My Library and
 * the game shelf).
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
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="gk-tab-icon" aria-hidden>
                {renderTabIcon(item.id)}
              </span>
              <span className="gk-tab-label">{item.label}</span>
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
        /* Anchor uses currentColor: cream on the plank, dark inside the notch. */
        .gk-tab-anchor {
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
         * Active tab: cream door/arch — semicircular head, straight sides,
         * flat base merging into the plank. Grows upward from the plank
         * (align-items:end on the nav row) so its top rises above the rope.
         * The rise (12px height bump + 6px nav bottom pad = ~18px) stays
         * within the 24%-of-plank clearance budget pages already use
         * (e.g. ListenPagePanorama pads by --map-footer-h * 1.24).
         */
        .gk-tab--active {
          --gk-icon: clamp(34px, 10.5vw, 41px);
          min-height: calc(var(--app-footer-h) + 12px);
          background: linear-gradient(180deg, #fffef8 0%, #f7f1e3 58%, #efe0c0 100%);
          border-radius: 40px 40px 12px 12px;
          box-shadow:
            0 0 0 2px rgba(198, 152, 94, 0.5),
            0 4px 10px rgba(0, 0, 0, 0.35),
            inset 0 -3px 5px rgba(160, 118, 55, 0.25),
            inset 0 2px 0 rgba(255, 255, 255, 0.9);
          padding: 12px 6px 8px;
          gap: 6px;
        }
        .gk-tab--active .gk-tab-label {
          color: #4a2e12;
          text-shadow: none;
        }
        .gk-tab--active .gk-tab-anchor {
          color: #4a2e12;
        }
        .gk-tab--active .gk-tab-icon {
          filter: drop-shadow(0 1px 1px rgba(40, 18, 4, 0.25));
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
            --gk-icon: 46px;
            /* Keep the arch head semicircular on the wider desktop tabs. */
            border-radius: 56px 56px 12px 12px;
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
