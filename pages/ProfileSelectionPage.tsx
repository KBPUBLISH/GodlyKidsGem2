import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, User as UserIcon, Settings, ChevronLeft } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';

const PROFILES = [
  { id: 1, name: 'Michael', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', color: 'bg-[#FFB74D]' },
  { id: 2, name: 'Amanda', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka', color: 'bg-[#F8BBD0]' },
  { id: 3, name: 'John', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John', color: 'bg-[#4FC3F7]' },
  { id: 4, name: 'Jane', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane', color: 'bg-[#AED581]' },
];

const ProfileSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar">
      
      {/* Top Bar (Specific to this page as per screenshot) */}
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
                <div className="w-10 h-10 bg-[#8B4513] rounded-full flex items-center justify-center border-2 border-[#eecaa0] shadow-md hidden xs:flex">
                    <UserIcon size={20} className="text-[#eecaa0]" />
                </div>
                <span className="font-display font-bold text-[#eecaa0] text-lg shadow-sm">Member</span>
            </div>
        </div>

        {/* Settings Button (Replaces Credits) */}
        <button 
           onClick={() => {}} // Placeholder for settings action
           className="w-10 h-10 bg-[#5c2e0b] hover:bg-[#70380d] border-2 border-[#8B4513] rounded-full flex items-center justify-center text-[#eecaa0] shadow-lg active:scale-95 transition-transform"
        >
            <Settings size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center pt-28 pb-10 px-6">
          
          {/* Sign */}
          <div className="relative mb-12 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-10 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl transform -rotate-1">
                {/* Wood Texture */}
                 <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-2xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
                  WHO'S USING?
                </h1>

                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-3 w-3 h-3 bg-[#3e1f07] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
             </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 w-full max-w-[300px] mb-auto">
            {PROFILES.map((profile) => (
              <div 
                key={profile.id} 
                onClick={() => navigate('/home')}
                className="flex flex-col items-center gap-3 cursor-pointer group"
              >
                <div className={`w-28 h-28 rounded-full ${profile.color} p-1 shadow-[0_8px_15px_rgba(0,0,0,0.3)] transition-transform duration-200 group-active:scale-95 group-hover:scale-105 border-4 border-white`}>
                   <div className="w-full h-full rounded-full overflow-hidden bg-black/5 relative">
                      <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover transform translate-y-1" />
                   </div>
                </div>
                <span className="font-display font-bold text-white text-lg tracking-wide drop-shadow-md">
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

          {/* Bottom Buttons */}
          <div className="w-full max-w-xs flex gap-4 mt-8">
             <WoodButton variant="light" fullWidth className="text-sm py-3 rounded-xl border-b-4 shadow-lg" onClick={() => {}}>
                EDIT PROFILE
             </WoodButton>
             <WoodButton variant="light" fullWidth className="text-sm py-3 rounded-xl border-b-4 shadow-lg" onClick={() => {}}>
                LEARN MORE
             </WoodButton>
          </div>

      </div>
    </div>
  );
};

export default ProfileSelectionPage;