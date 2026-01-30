
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, User as UserIcon, Settings, ChevronLeft, ShoppingBag, Crown, Lock } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import ShopModal from '../components/features/ShopModal';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';

// Helper for random color backgrounds for kid profiles
const PROFILE_BG_COLORS = ['bg-[#F8BBD0]', 'bg-[#4FC3F7]', 'bg-[#C5E1A5]', 'bg-[#FFF59D]', 'bg-[#E1BEE7]'];

const ProfileSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isSubscribed, 
    kids,
    switchProfile,
  } = useUser();
  
  const [isShopOpen, setIsShopOpen] = useState(false);
  const { t } = useLanguage();
  
  // Open shop if requested via navigation state
  useEffect(() => {
    if (location.state?.openShop) {
      setIsShopOpen(true);
      // Clear the state to prevent reopening on re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Helper to pick a color based on index (consistent for same kid order)
  const getKidColor = (index: number) => PROFILE_BG_COLORS[index % PROFILE_BG_COLORS.length];

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar">
      
      {/* Wood Header Bar */}
      <div className="relative z-20 pt-8 pb-4 px-6 bg-[#CD853F] shadow-md border-b-4 border-[#8B4513]">
        {/* Wood Texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 30px, #3E1F07 30px, #3E1F07 32px)'}}></div>
        
        <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#8B4513] rounded-full flex items-center justify-center border-2 border-[#eecaa0] shadow-md relative">
                    <UserIcon size={20} className="text-[#eecaa0]" />
                     {/* Sub Badge Small */}
                     <div className={`absolute -top-1 -right-1 bg-white rounded-full p-0.5 border shadow-sm ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-300'}`}>
                        <Crown size={10} className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"} fill={isSubscribed ? "#FFD700" : "#E5E7EB"} />
                    </div>
                </div>
                <span className="font-display font-bold text-[#5c2e0b] text-lg">{t('profiles')}</span>
            </div>

            {/* Right Actions */}
            <button 
              onClick={() => navigate('/settings')} 
              className="w-10 h-10 bg-[#8B4513] hover:bg-[#A0522D] border-2 border-[#eecaa0] rounded-full flex items-center justify-center text-[#f3e5ab] shadow-md active:scale-95 transition-transform"
            >
                <Settings size={20} />
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center pt-8 pb-10 px-6">
          
          {/* Sign */}
          <div className="relative mb-10 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-8 py-4 rounded-2xl border-b-[6px] border-[#8B4513] shadow-xl transform -rotate-1">
                {/* Wood Texture */}
                 <div className="absolute inset-0 opacity-20 rounded-2xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-2xl tracking-wide drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] text-center">
                  {t('chooseExplorer')}
                </h1>
                <p className="relative text-[#FFE082] text-sm text-center mt-1 font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{t('whosPlayingToday')}</p>

                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
             </div>
          </div>

          {/* Grid - Only show kid profiles */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 w-full max-w-[300px] mb-8">
            
            {/* KIDS PROFILES ONLY - Parent profile removed from selection */}
            {kids.map((profile, index) => {
              // Use the kid's current avatar (updated in shop) or fall back to initial avatarSeed
              const kidAvatar = profile.avatar || profile.avatarSeed;
              
              return (
                <div 
                  key={profile.id} 
                  onClick={() => {
                    switchProfile(profile.id); // Switch to this kid's profile
                    navigate('/home');
                  }}
                  className="flex flex-col items-center gap-3 cursor-pointer group"
                >
                  <div className="relative">
                      <div className={`w-28 h-28 rounded-full ${getKidColor(index)} p-1 shadow-[0_8px_15px_rgba(0,0,0,0.3)] transition-transform duration-200 group-active:scale-95 group-hover:scale-105 border-4 border-white flex items-center justify-center overflow-hidden`}>
                          <div className="w-[90%] h-[90%]">
                               {AVATAR_ASSETS[kidAvatar] ? (
                                   <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                       {AVATAR_ASSETS[kidAvatar]}
                                   </svg>
                               ) : (
                                   <img src={kidAvatar} alt={profile.name} className="w-full h-full object-cover rounded-full" />
                               )}
                          </div>
                      </div>
                  </div>

                  <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md text-center leading-tight break-words w-32">
                    {profile.name}
                  </span>
                </div>
              );
            })}

          </div>

          {/* New Profile Button - Moved Outside Grid, Lower Down */}
          {/* Show lock badge if free user already has 1 kid */}
          {!isSubscribed && kids.length >= 1 ? (
            <div 
                onClick={() => navigate('/paywall')}
                className="flex flex-col items-center gap-2 cursor-pointer group mt-8"
            >
               <div className="w-28 h-28 rounded-full bg-[#64748b]/50 backdrop-blur-md border-4 border-dashed border-white/40 shadow-lg flex items-center justify-center transition-transform duration-200 group-active:scale-95 group-hover:bg-[#64748b]/60 relative">
                  {/* Plus sign - clearly visible */}
                  <Plus size={48} className="text-white/80" strokeWidth={3} />
                  {/* Small lock badge in corner */}
                  <div className="absolute -top-1 -right-1 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full p-1.5 border-2 border-white shadow-lg">
                    <Lock size={14} className="text-[#5c2e0b]" />
                  </div>
               </div>
               <span className="font-display font-bold text-white text-base tracking-wide drop-shadow-md text-center">
                  Add Profile
                </span>
               <span className="text-[10px] text-[#FFD700] font-bold bg-black/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown size={10} fill="currentColor" /> Premium
                </span>
            </div>
          ) : (
            <div 
                onClick={() => navigate('/create-profile')}
                className="flex flex-col items-center gap-3 cursor-pointer group mt-8"
            >
               <div className="w-28 h-28 rounded-full bg-[#64748b]/60 backdrop-blur-md border-4 border-white/30 shadow-lg flex items-center justify-center transition-transform duration-200 group-active:scale-95 group-hover:bg-[#64748b]/80">
                  <Plus size={48} className="text-white" strokeWidth={4} />
               </div>
               <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md">
                  New
                </span>
            </div>
          )}

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
                               <span className="font-display font-extrabold text-[#B8860B] text-sm leading-tight">{t('goPremium').toUpperCase()}</span>
                               <span className="text-[10px] text-[#B8860B] font-bold opacity-80">{t('unlockAllStoriesItems') || 'Unlock all stories & items'}</span>
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
             <WoodButton variant="light" fullWidth className="text-sm py-3 rounded-xl border-b-4 shadow-lg" onClick={() => navigate('/edit-profile')}>
                {t('editProfile').toUpperCase()}
             </WoodButton>
             <WoodButton 
                variant="gold" 
                fullWidth 
                className="text-sm py-3 rounded-xl border-b-4 shadow-lg flex items-center justify-center gap-2" 
                onClick={() => setIsShopOpen(true)}
             >
                <ShoppingBag size={20} />
                {t('visitShop').toUpperCase()}
             </WoodButton>
          </div>
          
          <ShopModal 
            isOpen={isShopOpen} 
            onClose={() => setIsShopOpen(false)}
            initialTab={location.state?.shopTab || undefined}
          />

      </div>
    </div>
  );
};

export default ProfileSelectionPage;