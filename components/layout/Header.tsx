
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import ShopModal from '../features/ShopModal';
import AvatarDetailModal from '../features/AvatarDetailModal';
import { useUser } from '../../context/UserContext';
import AvatarCompositor from '../avatar/AvatarCompositor';

interface HeaderProps {
  isVisible: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS" }) => {
  const navigate = useNavigate();
  const { coins, equippedAvatar, equippedFrame, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs, isSubscribed } = useUser();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 drop-shadow-2xl transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
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
                {/* User Avatar with Compositor */}
                <div 
                    onClick={() => setIsDetailOpen(true)}
                    className="relative group cursor-pointer active:scale-95 transition-transform"
                >
                    <div className={`w-11 h-11 bg-[#f3e5ab] rounded-full border-[3px] ${equippedFrame} overflow-visible shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative z-0`}>
                        <AvatarCompositor 
                            headUrl={equippedAvatar}
                            hat={equippedHat}
                            body={equippedBody}
                            leftArm={equippedLeftArm}
                            rightArm={equippedRightArm}
                            legs={equippedLegs}
                            className="w-full h-full"
                        />
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
                
                {/* App Title */}
                <h1 className="text-[#5c2e0b] font-display font-extrabold text-2xl drop-shadow-sm tracking-wide pl-2" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>
                  {title}
                </h1>

                <div className="flex items-center gap-2">
                    {/* Coins / Shop Trigger */}
                    <button 
                      onClick={() => setIsShopOpen(true)}
                      className="hidden md:flex bg-black/30 hover:bg-black/40 rounded-full px-3 py-1 items-center gap-1.5 border border-[#FFD700]/40 transition-colors active:scale-95"
                    >
                        <div className="w-5 h-5 rounded-full bg-[#FFD700] border border-[#B8860B] flex items-center justify-center shadow-sm">
                           <span className="text-[#B8860B] font-bold text-[10px]">$</span>
                        </div>
                        <span className="text-[#FFD700] font-bold font-display text-sm shadow-black drop-shadow-md">{coins}</span>
                    </button>

                    {/* Mobile Coins (Smaller) */}
                    <button 
                      onClick={() => setIsShopOpen(true)}
                      className="md:hidden flex flex-col items-center justify-center -space-y-1 active:scale-95"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#FFD700] border border-[#B8860B] flex items-center justify-center shadow-sm z-10">
                           <span className="text-[#B8860B] font-bold text-[10px]">$</span>
                        </div>
                        <span className="text-[#FFD700] font-bold font-display text-[10px] bg-black/40 px-1.5 rounded-full pt-1 pb-0.5 -mt-1">{coins}</span>
                    </button>
                </div>
            </div>
         </div>
         
         {/* Jagged Bottom Edge SVG */}
         <div className="relative w-full h-6 -mt-[1px]">
             <svg viewBox="0 0 600 25" preserveAspectRatio="none" className="w-full h-full text-[#CD853F] fill-current drop-shadow-lg">
                 <path d="M0,0 L600,0 L600,8 C550,16 500,6 450,10 C350,16 250,4 150,12 C100,16 50,6 0,10 Z" />
                 <path d="M0,10 C50,6 100,16 150,12 C250,4 350,16 450,10 C500,6 550,16 600,8" fill="none" stroke="#5C2E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
             </svg>
         </div>
      </header>

      <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
      <AvatarDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} onEdit={() => setIsShopOpen(true)} />
    </>
  );
};

export default Header;
