
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, FileText, Clock } from 'lucide-react';
const ShopModal = lazy(() => import('../features/ShopModal'));
import AvatarDetailModal from '../features/AvatarDetailModal';
import CoinHistoryModal from '../features/CoinHistoryModal';
import ReportCardModal from '../features/ReportCardModal';
import { useUser } from '../../context/UserContext';
import { useTutorial } from '../../context/TutorialContext';
import { useSubscription } from '../../context/SubscriptionContext';
import ErrorBoundary from '../common/ErrorBoundary';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';

// Lifetime deal timer constants - shared with PaywallPage
const LIFETIME_DEAL_KEY = 'godlykids_lifetime_deal_start';
const DEAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface HeaderProps {
  isVisible: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { coins, equippedAvatar, equippedFrame, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs, isSubscribed, headOffset } = useUser();
  const { isStepActive, nextStep, isTutorialActive, currentStep } = useTutorial();
  const { reverseTrial, isPremium } = useSubscription();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCoinHistoryOpen, setIsCoinHistoryOpen] = useState(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  
  // Lifetime deal countdown timer state
  const [dealTimeRemaining, setDealTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  
  // Track the 24-hour countdown for lifetime deal (only if not subscribed)
  useEffect(() => {
    if (isSubscribed) {
      setDealTimeRemaining(null);
      return;
    }
    
    // Check if deal timer has been started
    const dealStartTime = localStorage.getItem(LIFETIME_DEAL_KEY);
    if (!dealStartTime) {
      setDealTimeRemaining(null);
      return;
    }
    
    const startTime = parseInt(dealStartTime, 10);
    const endTime = startTime + DEAL_DURATION_MS;
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = endTime - now;
      
      if (remaining <= 0) {
        setDealTimeRemaining(null);
        return;
      }
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      setDealTimeRemaining({ hours, minutes, seconds });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [isSubscribed]);

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
    if (currentStep === 'navigate_to_give' && isShopOpen) {
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

  const handleShopClick = () => {
    setIsShopOpen(true);
    if (isStepActive('shop_highlight')) {
      nextStep(); // Advance to shop_open
    }
  };

  const handleShopClose = () => {
    setIsShopOpen(false);
    if (isStepActive('shop_open')) {
      nextStep(); // Advance to navigate_to_give
    }
    // Dispatch event for referral prompt (existing behavior)
    window.dispatchEvent(new CustomEvent('godlykids_shop_closed'));
  };

  // Check for openShop in navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openShop) {
      setIsShopOpen(true);
      // Clear the state to prevent reopening on refresh/back
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
      >
        {/* Safe Area Spacer for iOS notch/status bar */}
        <div 
          className="bg-[#C4884A]" 
          style={{ height: 'var(--safe-area-top, 0px)' }}
        />
        
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
          {/* Subtle Wood Grain Lines */}
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
          
          {/* Edge Highlight (top inner glow) */}
          <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#E8B87A] to-transparent opacity-40"></div>

          {/* Content */}
          <div className="flex justify-between items-center relative z-10 mb-1">
            {/* User Avatar - Head Only */}
            <div
              onClick={() => setIsDetailOpen(true)}
              className="relative group cursor-pointer active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 bg-[#f3e5ab] rounded-full border-[3px] ${equippedFrame} overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative z-0 flex items-center justify-center`}>
                {/* Head Only with Offset */}
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

              {/* Subscription Status Crown */}
              <div className={`absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border z-20 ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'}`}>
                <Crown
                  size={14}
                  className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"}
                  fill={isSubscribed ? "#FFD700" : "#E5E7EB"}
                />
              </div>
            </div>
            
            {/* Reverse Trial PRO Badge - Show next to avatar */}
            {reverseTrial.isActive && !isPremium && (
              <button
                onClick={() => navigate('/trial-stats')}
                className="ml-2 bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-1 rounded-lg border border-amber-600 shadow-md flex items-center gap-1.5 hover:shadow-lg active:scale-95 transition-all"
              >
                <Crown size={14} className="text-amber-800" />
                <span className="text-amber-900 font-bold text-xs">
                  {reverseTrial.daysRemaining} {reverseTrial.daysRemaining === 1 ? 'day' : 'days'} left
                </span>
                <div className="w-px h-3.5 bg-amber-600/40 mx-0.5" />
                <span className="text-amber-800 font-extrabold text-xs tracking-wide">PRO</span>
              </button>
            )}
            
            {/* Lifetime Deal Timer - Show next to avatar if deal is active and not subscribed */}
            {dealTimeRemaining && !isSubscribed && (
              <button
                onClick={() => navigate('/paywall')}
                className="ml-2 bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-2 py-1 rounded-lg border border-[#b91c1c] shadow-md flex items-center gap-1.5 animate-pulse hover:animate-none active:scale-95 transition-transform"
              >
                <Clock size={12} className="text-white" />
                <span className="text-white font-mono font-bold text-xs">
                  {String(dealTimeRemaining.hours).padStart(2, '0')}:
                  {String(dealTimeRemaining.minutes).padStart(2, '0')}:
                  {String(dealTimeRemaining.seconds).padStart(2, '0')}
                </span>
                <span className="text-white/80 text-[10px] font-semibold">DEAL</span>
              </button>
            )}

            {/* Center - Empty for now */}
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              {/* Gold Coins Display */}
              <button
                id="coins-button"
                data-tutorial="coins-button"
                onClick={handleCoinsClick}
                className="bg-gradient-to-b from-[#FFD700] to-[#DAA520] px-2.5 py-1.5 rounded-lg border-2 border-[#B8860B] shadow-[0_3px_0_#8B6914,inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5 group"
                title="Your Gold Coins - Click to view history"
              >
                {/* Coin Icon */}
                <div className="relative">
                  <div className="w-5 h-5 bg-gradient-to-br from-[#FFE55C] to-[#DAA520] rounded-full border border-[#B8860B] shadow-inner flex items-center justify-center">
                    <span className="text-[#8B6914] font-black text-[10px]">G</span>
                  </div>
                  {/* Shine effect */}
                  <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white/50 rounded-full"></div>
                </div>
                {/* Coin Count */}
                <span className="text-[#5c2e0b] font-display font-black text-sm tracking-wide drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] group-hover:text-[#3e1f07] transition-colors">
                  {coins.toLocaleString()}
                </span>
              </button>

              {/* Report Card Button */}
              <button
                id="report-card-button"
                data-tutorial="report-card-button"
                onClick={handleReportCardClick}
                className="bg-[#2E7D32] hover:bg-[#388E3C] px-2 py-1.5 rounded-lg border-2 border-[#1B5E20] shadow-[0_4px_0_#0D3811] active:translate-y-[2px] active:shadow-none transition-all relative group flex items-center justify-center"
                title="View Report Card"
              >
                <FileText className="w-5 h-5 text-white/90 group-hover:text-white transition-colors" />
              </button>

              {/* Shop Sign Button */}
              <button
                id="shop-button"
                data-tutorial="shop-button"
                onClick={handleShopClick}
                className="bg-[#8B4513] hover:bg-[#A0522D] px-3 py-1.5 rounded-lg border-2 border-[#5c2e0b] shadow-[0_4px_0_#3e1f07] active:translate-y-[2px] active:shadow-none transition-all relative group flex items-center justify-center"
              >
                {/* Wood Texture Overlay */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] pointer-events-none rounded-md"></div>

                {/* Nails */}
                <div className="absolute top-1 left-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute top-1 right-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute bottom-1 left-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute bottom-1 right-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>

                <span className="text-[#FFD700] font-display font-black text-sm tracking-wide drop-shadow-md uppercase group-hover:text-white transition-colors relative z-10">
                  Shop
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Carved Bottom Edge SVG */}
        <div className="relative w-full h-5 -mt-[1px]">
          <svg viewBox="0 0 800 20" preserveAspectRatio="none" className="w-full h-full">
            {/* Main wood bottom with carved edge */}
            <path 
              d="M0,0 L800,0 L800,8 C780,10 760,6 740,9 C700,12 680,7 650,10 C600,14 560,8 520,11 C480,14 440,7 400,10 C360,13 320,8 280,11 C240,14 200,7 160,10 C120,13 80,8 40,11 C20,13 10,9 0,10 Z" 
              fill="#8B5A2B"
            />
            {/* Lighter inner edge */}
            <path 
              d="M0,0 L800,0 L800,6 C780,8 760,4 740,7 C700,10 680,5 650,8 C600,12 560,6 520,9 C480,12 440,5 400,8 C360,11 320,6 280,9 C240,12 200,5 160,8 C120,11 80,6 40,9 C20,11 10,7 0,8 Z" 
              fill="#A56B3A"
            />
            {/* Dark carved line detail */}
            <path 
              d="M0,8 C20,6 40,11 80,8 C120,5 160,10 200,7 C240,4 280,9 320,6 C360,3 400,8 440,5 C480,2 520,9 560,6 C600,3 650,8 680,5 C720,2 760,6 800,4" 
              fill="none" 
              stroke="#5C3D1E" 
              strokeWidth="1.5" 
              opacity="0.5"
            />
          </svg>
        </div>
      </header>

      {isShopOpen && (
        <Suspense fallback={null}>
          <ShopModal isOpen={isShopOpen} onClose={handleShopClose} hideCloseButton={isTutorialActive} />
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
