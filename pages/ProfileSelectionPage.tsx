
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User as UserIcon, Settings, ChevronLeft, ShoppingBag, Crown } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import ShopModal from '../components/features/ShopModal';
import { useUser } from '../context/UserContext';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';

// Helper for random color backgrounds if needed, though we mainly use #f3e5ab or consistent logic
const PROFILE_BG_COLORS = ['bg-[#F8BBD0]', 'bg-[#4FC3F7]', 'bg-[#C5E1A5]', 'bg-[#FFF59D]', 'bg-[#E1BEE7]'];

const ProfileSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isSubscribed, 
    parentName,
    kids,
    equippedAvatar, 
    equippedFrame, 
    equippedHat
  } = useUser();
  const [isShopOpen, setIsShopOpen] = useState(false);

  // Helper to pick a color based on index (consistent for same kid order)
  const getKidColor = (index: number) => PROFILE_BG_COLORS[index % PROFILE_BG_COLORS.length];

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center pt-8">
        <div className="flex items-center gap-3">
            {/* Back Button */}
            <button 
              onClick={() => navigate('/home')}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 active:scale-95 transition-transform shadow-md"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex items-center gap-2 opacity-90">
                <div className="w-10 h-10 bg-[#8B4513] rounded-full flex items-center justify-center border-2 border-[#eecaa0] shadow-md hidden xs:flex relative">
                    <UserIcon size={20} className="text-[#eecaa0]" />
                     {/* Sub Badge Small */}
                     <div className={`absolute -top-1 -right-1 bg-white rounded-full p-0.5 border shadow-sm ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-300'}`}>
                        <Crown size={10} className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"} fill={isSubscribed ? "#FFD700" : "#E5E7EB"} />
                    </div>
                </div>
                <span className="font-display font-bold text-[#eecaa0] text-lg shadow-sm">Member</span>
            </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
            {/* Settings Button */}
            <button 
              onClick={() => navigate('/settings')} 
              className="w-10 h-10 bg-[#5c2e0b] hover:bg-[#70380d] border-2 border-[#8B4513] rounded-full flex items-center justify-center text-[#eecaa0] shadow-lg active:scale-95 transition-transform"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center pt-28 pb-10 px-6">
          
          {/* Sign */}
          <div className="relative mb-12 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-10 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl transform -rotate-1">
                {/* Wood Texture */}
                 <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-2xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
                  WHO'S PLAYING?
                </h1>

                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
             </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 w-full max-w-[300px] mb-auto">
            
            {/* PARENT PROFILE (Main User) - Head Only */}
             <div 
                onClick={() => navigate('/home')}
                className="flex flex-col items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                    <div className={`w-28 h-28 bg-[#f3e5ab] rounded-full border-[4px] ${equippedFrame} overflow-hidden shadow-[0_8px_15px_rgba(0,0,0,0.3)] transition-transform duration-200 group-active:scale-95 group-hover:scale-105 flex items-center justify-center relative z-10`}>
                        {/* Head Only */}
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
                                        <img src={equippedAvatar || ''} alt="Head" className="w-full h-full object-cover rounded-full" />
                                    )}
                                    {/* Hat Overlay */}
                                    {equippedHat && AVATAR_ASSETS[equippedHat] && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <svg viewBox="0 0 100 80" className="w-full h-full p-1 overflow-visible">
                                                {AVATAR_ASSETS[equippedHat]}
                                            </svg>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                    {/* Crown Badge */}
                    <div className={`absolute top-0 right-0 bg-white rounded-full p-1.5 shadow-md border-2 z-20 ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'}`}>
                        <Crown 
                            size={18} 
                            className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"} 
                            fill={isSubscribed ? "#FFD700" : "#E5E7EB"} 
                        />
                    </div>
                </div>

                <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md text-center leading-tight break-words w-32">
                  {parentName || "Parent"}
                </span>
              </div>

            {/* KIDS PROFILES */}
            {kids.map((profile, index) => (
              <div 
                key={profile.id} 
                onClick={() => navigate('/home')}
                className="flex flex-col items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                    <div className={`w-28 h-28 rounded-full ${getKidColor(index)} p-1 shadow-[0_8px_15px_rgba(0,0,0,0.3)] transition-transform duration-200 group-active:scale-95 group-hover:scale-105 border-4 border-white flex items-center justify-center overflow-hidden`}>
                        <div className="w-[90%] h-[90%]">
                             {AVATAR_ASSETS[profile.avatarSeed] ? (
                                 <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                     {AVATAR_ASSETS[profile.avatarSeed]}
                                 </svg>
                             ) : (
                                 <img src={profile.avatarSeed} alt={profile.name} className="w-full h-full object-cover rounded-full" />
                             )}
                        </div>
                    </div>
                </div>

                <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md text-center leading-tight break-words w-32">
                  {profile.name}
                </span>
              </div>
            ))}

            {/* New Profile Button */}
            <div 
                onClick={() => navigate('/create-profile')}
                className="flex flex-col items-center gap-3 cursor-pointer group"
            >
               <div className="w-28 h-28 rounded-full bg-[#64748b]/60 backdrop-blur-md border-4 border-white/30 shadow-lg flex items-center justify-center transition-transform duration-200 group-active:scale-95 group-hover:bg-[#64748b]/80">
                  <Plus size={48} className="text-white" strokeWidth={4} />
               </div>
               <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md">
                  New
                </span>
            </div>
          </div>

          {/* Go Premium Banner (If Not Subscribed) */}
          {!isSubscribed && (
              <div 
                onClick={() => navigate('/paywall')}
                className="w-full max-w-xs mt-8 mb-2 bg-gradient-to-r from-[#FFD700] to-[#FDB931] rounded-xl p-1 shadow-lg cursor-pointer transform transition-transform active:scale-95 group"
              >
                  <div className="bg-[#fff8e1] rounded-[10px] px-4 py-3 flex items-center justify-between border border-[#FDB931]">
                      <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-[#FFD700] rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                <Crown size={20} className="text-[#B8860B]" fill="#B8860B" />
                           </div>
                           <div className="flex flex-col">
                               <span className="font-display font-extrabold text-[#B8860B] text-sm leading-tight">GO PREMIUM</span>
                               <span className="text-[10px] text-[#B8860B] font-bold opacity-80">Unlock all stories & items</span>
                           </div>
                      </div>
                      <div className="bg-[#B8860B] text-[#FFD700] rounded-full p-1">
                          <ChevronLeft size={16} className="rotate-180" />
                      </div>
                  </div>
              </div>
          )}

          {/* Bottom Buttons */}
          <div className={`w-full max-w-xs flex gap-4 ${!isSubscribed ? 'mt-2' : 'mt-8'}`}>
             <WoodButton variant="light" fullWidth className="text-sm py-3 rounded-xl border-b-4 shadow-lg" onClick={() => {}}>
                EDIT PROFILE
             </WoodButton>
             <WoodButton 
                variant="gold" 
                fullWidth 
                className="text-sm py-3 rounded-xl border-b-4 shadow-lg flex items-center justify-center gap-2" 
                onClick={() => setIsShopOpen(true)}
             >
                <ShoppingBag size={20} />
                VISIT SHOP
             </WoodButton>
          </div>
          
          <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />

      </div>
    </div>
  );
};

export default ProfileSelectionPage;