import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, FileText, Clock, Settings } from 'lucide-react';
const ShopModal = lazy(() => import('../features/ShopModal'));
import AvatarDetailModal from '../features/AvatarDetailModal';
import CoinHistoryModal from '../features/CoinHistoryModal';
import ReportCardModal from '../features/ReportCardModal';
import { useUser } from '../../context/UserContext';
import { useTutorial } from '../../context/TutorialContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';

/** Recessed circular well carved into the wood plank */
const PLANK_RECESS_CIRCLE =
  'relative flex items-center justify-center rounded-full active:scale-95 transition-transform ' +
  'bg-[rgba(92,50,18,0.22)] border border-[rgba(70,38,12,0.28)] ' +
  'shadow-[inset_0_3px_7px_rgba(55,28,8,0.55),inset_0_-1px_2px_rgba(255,230,180,0.28),0_1px_0_rgba(255,235,200,0.18)]';

/** Embossed cream/brass icon tone on recessed controls */
const PLANK_ICON = 'text-[#E8D5A8] drop-shadow-[0_1px_1px_rgba(60,30,10,0.55)]';

const PORTHOLE_RIVETS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

// Lifetime deal timer constants - shared with PaywallPage
const LIFETIME_DEAL_KEY = 'godlykids_lifetime_deal_start';
const DEAL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const LIFETIME_OFFER_STAGE_KEY = 'godlykids_lifetime_offer_stage';

const EXPLORE_TOP_HEADER_WOOD = '/assets/images/explore-top-header-wood.png';
/** Pull full PNG up so wood sits nearer flush with screen top (keeps side/bottom live edges). */
const PLANK_TOP_LIFT = '-1.5rem';
/**
 * Extra top inset below safe-area so controls sit lower / centered in the wood band.
 * Compensates for PLANK_TOP_LIFT (items-center uses the full PNG box, including the
 * portion pulled above the viewport).
 */
const PLANK_CONTROLS_TOP_EXTRA = '1.75rem';

interface HeaderProps {
  isVisible: boolean;
  title?: string;
  /** `plank` = Explore mockup wood-plank chrome */
  variant?: 'default' | 'plank';
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS", variant = 'default' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { coins, equippedAvatar, equippedFrame, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs, isSubscribed, headOffset } = useUser();
  const { isStepActive, nextStep, isTutorialActive, currentStep } = useTutorial();
  const { isPremium } = useSubscription();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [shopBuilderMode, setShopBuilderMode] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCoinHistoryOpen, setIsCoinHistoryOpen] = useState(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  
  // Android detection — synchronous so the very first render uses simplified styles.
  // Include all Android (including Despia runtime) so header buttons render reliably.
  const [isAndroid] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /android/.test(ua);
  });

  
  // Force repaint on Android after mount
  const [androidReady, setAndroidReady] = useState(!isAndroid);
  
  // Lifetime deal countdown timer state
  const [dealTimeRemaining, setDealTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  
  // Force a repaint on Android after mount by toggling a CSS transform
  useEffect(() => {
    if (!isAndroid) return;
    const timer = setTimeout(() => {
      setAndroidReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [isAndroid]);
  
  // Track the 30-minute countdown for lifetime deal (only after paywall dismissed)
  // Re-runs on route change so it picks up the localStorage values set by the paywall close handler
  useEffect(() => {
    if (isSubscribed) {
      setDealTimeRemaining(null);
      return;
    }
    
    const stage = localStorage.getItem(LIFETIME_OFFER_STAGE_KEY);
    const dealStartTime = localStorage.getItem(LIFETIME_DEAL_KEY);
    if (!dealStartTime || !stage || stage === 'none' || stage === 'done') {
      setDealTimeRemaining(null);
      return;
    }
    
    const startTime = parseInt(dealStartTime, 10);
    const endTime = startTime + DEAL_DURATION_MS;
    
    const updateTimer = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setDealTimeRemaining(null);
        return;
      }
      setDealTimeRemaining({
        minutes: Math.floor(remaining / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
      });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isSubscribed, location.pathname]);

  // Auto-close modals when tutorial step advances past the popup_open steps
  useEffect(() => {
    // When tutorial advances past coins_popup_open, close coins modal
    if (currentStep === 'report_card_highlight' && isCoinHistoryOpen) {
      setIsCoinHistoryOpen(false);
    }
    // When tutorial advances past report_card_open, close report card modal
    if (currentStep === 'shop_highlight' && isReportCardOpen) {
      setIsReportCardOpen(false);
    }
    // When tutorial advances past shop_open, close shop modal
    if (currentStep === 'navigate_to_games' && isShopOpen) {
      setIsShopOpen(false);
    }
  }, [currentStep, isCoinHistoryOpen, isReportCardOpen, isShopOpen]);

  // Tutorial integration - advance steps when modals open/close
  const handleCoinsClick = () => {
    setIsCoinHistoryOpen(true);
    if (isStepActive('coins_highlight')) {
      nextStep(); // Advance to coins_popup_open
    }
  };

  const handleCoinsClose = () => {
    setIsCoinHistoryOpen(false);
    if (isStepActive('coins_popup_open')) {
      nextStep(); // Advance to report_card_highlight
    }
  };

  const handleReportCardClick = () => {
    setIsReportCardOpen(true);
    if (isStepActive('report_card_highlight')) {
      nextStep(); // Advance to report_card_open
    }
  };

  const handleReportCardClose = () => {
    setIsReportCardOpen(false);
    if (isStepActive('report_card_open')) {
      nextStep(); // Advance to shop_highlight
    }
  };

  const handleShopClick = useCallback((builderMode = false) => {
    setShopBuilderMode(builderMode);
    setIsShopOpen(true);
    if (isStepActive('shop_highlight')) {
      nextStep();
    }
  }, [isStepActive, nextStep]);

  // Listen for external requests to open the avatar shop (e.g. Parrot Island tap)
  useEffect(() => {
    const handler = (event: Event) => {
      const builderMode = Boolean((event as CustomEvent).detail?.builderMode);
      handleShopClick(builderMode);
    };
    window.addEventListener('open_avatar_shop', handler);
    return () => window.removeEventListener('open_avatar_shop', handler);
  }, [handleShopClick]);

  const handleShopClose = () => {
    setIsShopOpen(false);
    setShopBuilderMode(false);
    if (isStepActive('shop_open')) {
      nextStep(); // Advance to navigate_to_games
    }
    // Dispatch event for referral prompt (existing behavior)
    window.dispatchEvent(new CustomEvent('godlykids_shop_closed'));
  };

  // Check for openShop in navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openShop) {
      setShopBuilderMode(Boolean((location.state as any).builderMode));
      setIsShopOpen(true);
      // Clear the state to prevent reopening on refresh/back
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const isPlank = variant === 'plank';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
        style={{
          filter: isAndroid || isPlank ? undefined : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          transform: isAndroid ? (androidReady ? 'translateZ(0)' : 'translate3d(0,0,1px)') : undefined,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          perspective: isAndroid ? undefined : '1000px',
        }}
      >
        {/* Safe Area Spacer — default header only (plank uses full PNG; controls pad for notch) */}
        {!isPlank && (
          <div
            style={{
              height: 'max(var(--safe-area-top, 0px), 28px)',
              background: '#C4884A',
            }}
          />
        )}

        {isPlank ? (
          /* Full plank PNG at natural aspect — live edges on sides + bottom visible */
          <div className="relative w-full" style={{ marginTop: PLANK_TOP_LIFT }}>
            <img
              src={EXPLORE_TOP_HEADER_WOOD}
              alt=""
              aria-hidden
              className="pointer-events-none select-none relative block w-full h-auto"
              draggable={false}
            />
            <div
              className="absolute inset-0 flex items-center justify-between gap-2 sm:gap-2.5 px-3 sm:px-4"
              style={{
                paddingTop: `calc(var(--safe-area-top, 0px) + ${PLANK_CONTROLS_TOP_EXTRA})`,
              }}
            >
                <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
                  {/* Porthole avatar */}
                  <button
                    type="button"
                    onClick={() => setIsDetailOpen(true)}
                    className="relative flex-shrink-0 active:scale-95 transition-transform"
                    aria-label="Profile"
                  >
                    <div
                      className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2.5px]"
                      style={{
                        background:
                          'linear-gradient(145deg, #F0D78A 0%, #C9A227 35%, #8B6914 70%, #E8C65A 100%)',
                        boxShadow:
                          '0 2px 4px rgba(60,30,10,0.4), inset 0 1px 1px rgba(255,245,200,0.55), inset 0 -1px 2px rgba(90,50,10,0.35)',
                      }}
                    >
                      {/* Rivets on brass rim */}
                      {PORTHOLE_RIVETS.map((deg) => {
                        const rad = (deg * Math.PI) / 180;
                        const r = 46; // % from center toward rim
                        return (
                          <span
                            key={deg}
                            aria-hidden
                            className="absolute w-[5px] h-[5px] rounded-full pointer-events-none z-10"
                            style={{
                              top: `${50 - r * Math.cos(rad)}%`,
                              left: `${50 + r * Math.sin(rad)}%`,
                              background:
                                'radial-gradient(circle at 35% 30%, #F5E6B0, #B8860B 60%, #6B4E12)',
                              boxShadow: '0 0.5px 1px rgba(0,0,0,0.35)',
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        );
                      })}
                      <div
                        className="w-full h-full rounded-full overflow-hidden bg-[#f3e5ab] relative flex items-center justify-center"
                        style={{
                          boxShadow: 'inset 0 2px 5px rgba(40,20,5,0.35)',
                          border: '1.5px solid rgba(90,55,15,0.35)',
                        }}
                      >
                        <div
                          className="w-full h-full flex items-center justify-center relative"
                          style={{ transform: `translate(${headOffset.x}%, ${headOffset.y}%)` }}
                        >
                          {(() => {
                            const isInternalHead = equippedAvatar && equippedAvatar.startsWith('head-');
                            const headAsset = isInternalHead ? AVATAR_ASSETS[equippedAvatar] : null;
                            return headAsset ? (
                              <div className="w-[90%] h-[90%] flex items-center justify-center">
                                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                  {headAsset}
                                </svg>
                              </div>
                            ) : (
                              <img src={equippedAvatar || ''} alt="Head" className="w-full h-full object-cover" />
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`absolute -top-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm border z-20 ${
                        isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'
                      }`}
                    >
                      <Crown
                        size={12}
                        className={isSubscribed ? 'text-[#B8860B]' : 'text-gray-400'}
                        fill={isSubscribed ? '#FFD700' : '#E5E7EB'}
                      />
                    </div>
                  </button>

                  {dealTimeRemaining && !isSubscribed && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('show_lifetime_offer'))}
                      className="flex-shrink-0 bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-1.5 py-1 rounded-lg border border-[#b91c1c] shadow-md flex items-center gap-1 animate-pulse hover:animate-none active:scale-95 transition-transform"
                    >
                      <Clock size={11} className="text-white" />
                      <span className="text-white font-mono font-bold text-[10px]">
                        {String(dealTimeRemaining.minutes).padStart(2, '0')}:
                        {String(dealTimeRemaining.seconds).padStart(2, '0')}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
                  {/* Coin currency pill — recessed, content-sized */}
                  <button
                    id="coins-button"
                    data-tutorial="coins-button"
                    type="button"
                    onClick={handleCoinsClick}
                    title="Your Gold Coins - Click to view history"
                    className="flex-shrink-0 h-9 sm:h-10 rounded-full flex items-center gap-1.5 pl-1 pr-2.5 active:scale-[0.98] transition-transform
                      bg-[rgba(92,50,18,0.2)] border border-[rgba(70,38,12,0.28)]
                      shadow-[inset_0_3px_7px_rgba(55,28,8,0.5),inset_0_-1px_2px_rgba(255,230,180,0.22),0_1px_0_rgba(255,235,200,0.15)]"
                    style={
                      isAndroid
                        ? {
                            transform: 'translateZ(0)',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                          }
                        : undefined
                    }
                  >
                    <div
                      className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'radial-gradient(circle at 32% 28%, #FFE55C 0%, #F0C040 40%, #C9A227 75%, #8B6914 100%)',
                        boxShadow:
                          '0 1px 2px rgba(60,30,10,0.4), inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 2px rgba(90,50,10,0.35)',
                        border: '1.5px solid #A67C1A',
                      }}
                    >
                      {/* Money-bag mark */}
                      <svg
                        viewBox="0 0 24 24"
                        className="w-[13px] h-[13px] text-[#6B4423]"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M12 3c1.2 0 2.1.7 2.5 1.6L15 6h1.2c.4 0 .8.3.8.8v1.1c2.2.9 3.5 2.7 3.5 5.1 0 3.3-3.1 6-8.5 6S3 16.3 3 13c0-2.4 1.3-4.2 3.5-5.1V6.8c0-.5.4-.8.8-.8H8.5l.5-1.4C9.4 3.7 10.3 3 12 3zm0 2c-.5 0-.8.2-1 .5L10.6 7h2.8L13 5.5c-.2-.3-.5-.5-1-.5zM8.5 9.2C6.9 9.9 6 11.2 6 13c0 2.3 2.3 4.5 6 4.5s6-2.2 6-4.5c0-1.8-.9-3.1-2.5-3.8H8.5z" />
                      </svg>
                      {!isAndroid && (
                        <div className="absolute top-1 left-1.5 w-1.5 h-1.5 bg-white/45 rounded-full" />
                      )}
                    </div>
                    <span className="text-[#F5E6C8] font-display font-black text-sm sm:text-base tracking-wide drop-shadow-[0_1px_1px_rgba(60,30,10,0.55)]">
                      {coins.toLocaleString()}
                    </span>
                  </button>

                  {/* Settings — recessed circle (also hosts report-card tutorial target) */}
                  <button
                    id="report-card-button"
                    data-tutorial="report-card-button"
                    type="button"
                    onClick={() => {
                      if (
                        isTutorialActive &&
                        (isStepActive('report_card_highlight') || isStepActive('report_card_open'))
                      ) {
                        handleReportCardClick();
                        return;
                      }
                      navigate('/settings');
                    }}
                    className={`${PLANK_RECESS_CIRCLE} w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0`}
                    aria-label="Settings"
                    title="Settings"
                  >
                    <Settings size={18} strokeWidth={2.25} className={PLANK_ICON} />
                  </button>
                </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top Rough Edge SVG */}
            <div className="relative w-full h-3 bg-[#C4884A]">
              <svg viewBox="0 0 800 12" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
                <path
                  d="M0,12 L0,4 C20,6 35,2 60,5 C90,8 110,3 140,4 C180,6 200,2 240,5 C280,8 320,3 360,4 C400,6 440,2 480,5 C520,8 560,3 600,4 C640,6 680,2 720,5 C760,8 780,4 800,5 L800,12 Z"
                  fill="#A56B3A"
                />
              </svg>
            </div>

            {/* Main Plank Area */}
            <div className="relative px-4 pt-4 pb-3" style={{
              background: 'linear-gradient(180deg, #C4884A 0%, #D4975A 15%, #C4884A 50%, #A56B3A 85%, #8B5A2B 100%)'
            }}>
              <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
                <svg width="100%" height="100%" preserveAspectRatio="none">
                  <defs>
                    <pattern id="woodGrain" x="0" y="0" width="300" height="100" patternUnits="userSpaceOnUse">
                      <path d="M0,20 Q75,15 150,22 T300,18" stroke="#5C3D1E" fill="none" strokeWidth="1.5" opacity="0.6"/>
                      <path d="M0,45 Q100,38 200,48 T400,42" stroke="#5C3D1E" fill="none" strokeWidth="1" opacity="0.4"/>
                      <path d="M0,70 Q60,65 120,72 T240,68" stroke="#5C3D1E" fill="none" strokeWidth="1.5" opacity="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#woodGrain)"/>
                </svg>
              </div>

              <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#E8B87A] to-transparent opacity-40"></div>

              <div className="flex justify-between items-center relative z-10 mb-1">
                <div
                  onClick={() => setIsDetailOpen(true)}
                  className="relative group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className={`w-11 h-11 bg-[#f3e5ab] rounded-full border-[3px] ${equippedFrame} overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative z-0 flex items-center justify-center`}>
                    <div
                      className="w-full h-full flex items-center justify-center relative"
                      style={{
                        transform: `translate(${headOffset.x}%, ${headOffset.y}%)`
                      }}
                    >
                      {(() => {
                        const isInternalHead = equippedAvatar && equippedAvatar.startsWith('head-');
                        const headAsset = isInternalHead ? AVATAR_ASSETS[equippedAvatar] : null;

                        return (
                          <>
                            {headAsset ? (
                              <div className="w-[90%] h-[90%] flex items-center justify-center">
                                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                  {headAsset}
                                </svg>
                              </div>
                            ) : (
                              <img src={equippedAvatar || ''} alt="Head" className="w-full h-full object-cover" />
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className={`absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border z-20 ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'}`}>
                    <Crown
                      size={14}
                      className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"}
                      fill={isSubscribed ? "#FFD700" : "#E5E7EB"}
                    />
                  </div>
                </div>

                {dealTimeRemaining && !isSubscribed && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('show_lifetime_offer'))}
                    className="ml-2 bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-2 py-1 rounded-lg border border-[#b91c1c] shadow-md flex items-center gap-1.5 animate-pulse hover:animate-none active:scale-95 transition-transform"
                  >
                    <Clock size={12} className="text-white" />
                    <span className="text-white font-mono font-bold text-xs">
                      {String(dealTimeRemaining.minutes).padStart(2, '0')}:
                      {String(dealTimeRemaining.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-white/80 text-[10px] font-semibold">DEAL</span>
                  </button>
                )}

                <div className="flex-1"></div>

                <div className="flex items-center gap-2" style={{
                  transform: isAndroid ? 'translate3d(0,0,0)' : undefined,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  ...(isAndroid && { isolation: 'isolate' as const, minHeight: 40 })
                }}>
                  <button
                    id="coins-button"
                    data-tutorial="coins-button"
                    onClick={handleCoinsClick}
                    className={isAndroid ?
                      "bg-[#FFD700] px-2.5 py-1.5 rounded-lg border-2 border-[#B8860B] transition-all flex items-center gap-1.5 group" :
                      "bg-gradient-to-b from-[#FFD700] to-[#DAA520] px-2.5 py-1.5 rounded-lg border-2 border-[#B8860B] shadow-[0_3px_0_#8B6914,inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5 group"
                    }
                    title="Your Gold Coins - Click to view history"
                    style={isAndroid ? {
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      opacity: 1,
                      minWidth: 44,
                      minHeight: 40
                    } : undefined}
                  >
                    <div className="relative">
                      <div className={isAndroid ?
                        "w-5 h-5 bg-[#FFE55C] rounded-full border border-[#B8860B] flex items-center justify-center" :
                        "w-5 h-5 bg-gradient-to-br from-[#FFE55C] to-[#DAA520] rounded-full border border-[#B8860B] shadow-inner flex items-center justify-center"
                      }>
                        <span className="text-[#8B6914] font-black text-[10px]">G</span>
                      </div>
                      {!isAndroid && (
                        <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white/50 rounded-full"></div>
                      )}
                    </div>
                    <span className={isAndroid ?
                      "text-[#5c2e0b] font-display font-black text-sm tracking-wide" :
                      "text-[#5c2e0b] font-display font-black text-sm tracking-wide drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] group-hover:text-[#3e1f07] transition-colors"
                    }>
                      {coins.toLocaleString()}
                    </span>
                  </button>

                  <button
                    id="report-card-button"
                    data-tutorial="report-card-button"
                    onClick={handleReportCardClick}
                    className={isAndroid ?
                      "bg-[#2E7D32] px-2 py-1.5 rounded-lg border-2 border-[#1B5E20] transition-all relative group flex items-center justify-center" :
                      "bg-[#2E7D32] hover:bg-[#388E3C] px-2 py-1.5 rounded-lg border-2 border-[#1B5E20] shadow-[0_4px_0_#0D3811] active:translate-y-[2px] active:shadow-none transition-all relative group flex items-center justify-center"
                    }
                    title="View Report Card"
                    style={isAndroid ? {
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      opacity: 1,
                      minWidth: 44,
                      minHeight: 40
                    } : undefined}
                  >
                    <FileText className={`w-5 h-5 flex-shrink-0 ${isAndroid ? 'text-white' : 'text-white/90 group-hover:text-white'} transition-colors`} style={isAndroid ? { fill: 'currentColor' } : undefined} />
                  </button>
                </div>
              </div>
            </div>

            {/* Carved Bottom Edge SVG */}
            <div className="relative w-full h-5 -mt-[1px]">
              <svg viewBox="0 0 800 20" preserveAspectRatio="none" className="w-full h-full">
                <path
                  d="M0,0 L800,0 L800,8 C780,10 760,6 740,9 C700,12 680,7 650,10 C600,14 560,8 520,11 C480,14 440,7 400,10 C360,13 320,8 280,11 C240,14 200,7 160,10 C120,13 80,8 40,11 C20,13 10,9 0,10 Z"
                  fill="#8B5A2B"
                />
                <path
                  d="M0,0 L800,0 L800,6 C780,8 760,4 740,7 C700,10 680,5 650,8 C600,12 560,6 520,9 C480,12 440,5 400,8 C360,11 320,6 280,9 C240,12 200,5 160,8 C120,11 80,6 40,9 C20,11 10,7 0,8 Z"
                  fill="#A56B3A"
                />
                <path
                  d="M0,8 C20,6 40,11 80,8 C120,5 160,10 200,7 C240,4 280,9 320,6 C360,3 400,8 440,5 C480,2 520,9 560,6 C600,3 650,8 680,5 C720,2 760,6 800,4"
                  fill="none"
                  stroke="#5C3D1E"
                  strokeWidth="1.5"
                  opacity="0.5"
                />
              </svg>
            </div>
          </>
        )}
      </header>

      {isShopOpen && (
        <Suspense fallback={null}>
          <ShopModal
            isOpen={isShopOpen}
            onClose={handleShopClose}
            initialBuilderMode={shopBuilderMode}
            hideCloseButton={isTutorialActive}
          />
        </Suspense>
      )}
      <CoinHistoryModal 
        isOpen={isCoinHistoryOpen} 
        onClose={handleCoinsClose} 
        onOpenShop={handleShopClick}
        hideCloseButton={isTutorialActive}
      />
      <AvatarDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} onEdit={handleShopClick} />
      <ReportCardModal isOpen={isReportCardOpen} onClose={handleReportCardClose} hideCloseButton={isTutorialActive} />
    </>
  );
};

export default Header;