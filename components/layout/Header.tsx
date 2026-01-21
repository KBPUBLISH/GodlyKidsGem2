
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, FileText } from 'lucide-react';
const ShopModal = lazy(() => import('../features/ShopModal'));
import AvatarDetailModal from '../features/AvatarDetailModal';
import CoinHistoryModal from '../features/CoinHistoryModal';
import ReportCardModal from '../features/ReportCardModal';
import { useUser } from '../../context/UserContext';
import { useTutorial } from '../../context/TutorialContext';
import ErrorBoundary from '../common/ErrorBoundary';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';

interface HeaderProps {
  isVisible: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { coins, equippedAvatar, equippedFrame, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs, isSubscribed, headOffset } = useUser();
  const { isStepActive, nextStep, isTutorialActive, currentStep } = useTutorial();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCoinHistoryOpen, setIsCoinHistoryOpen] = useState(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);

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
        className={`fixed top-0 left-0 right-0 z-50 drop-shadow-2xl transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        {/* Safe Area Spacer for iOS notch/status bar - Despia provides var(--safe-area-top) */}
        <div 
          className="bg-[#CD853F]" 
          style={{ height: 'var(--safe-area-top, 0px)' }}
        />
        
        {/* Main Plank Area */}
        <div className="relative bg-[#CD853F] px-4 pt-5 pb-3 shadow-sm border-t border-[#eecaa0]">
          {/* Wood Grain Texture Overlay */}
          <div className="absolute inset-0 opacity-25 pointer-events-none mix-blend-color-burn"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q 50 15 100 20 T 200 20' stroke='%238B4513' fill='none' opacity='0.5' stroke-width='2'/%3E%3Cpath d='M0 10 Q 80 5 160 10 T 320 10' stroke='%235C2E0B' fill='none' opacity='0.3'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 40px'
            }}>
          </div>

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

        {/* Jagged Bottom Edge SVG */}
        <div className="relative w-full h-6 -mt-[1px]">
          <svg viewBox="0 0 600 25" preserveAspectRatio="none" className="w-full h-full text-[#CD853F] fill-current drop-shadow-lg">
            <path d="M0,0 L600,0 L600,8 C550,16 500,6 450,10 C350,16 250,4 150,12 C100,16 50,6 0,10 Z" />
            <path d="M0,10 C50,6 100,16 150,12 C250,4 350,16 450,10 C500,6 550,16 600,8" fill="none" stroke="#5C2E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
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
