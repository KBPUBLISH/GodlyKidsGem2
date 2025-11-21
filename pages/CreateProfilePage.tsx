
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';
import { useUser } from '../context/UserContext';

const FUNNY_HEADS = [
  'head-toast',
  'head-burger',
  'head-cookie',
  'head-tv',
  'head-slime',
  'head-pumpkin',
  'head-earth',
  'head-moon',
  'head-bomb',
  'head-eye',
  'head-bear-brown',
  'head-bear-polar',
  'head-bear-aviator',
  'head-dog-pug',
  'head-dog-dalmatian',
  'head-cat-orange',
  'head-cat-black',
  'head-lizard'
];

const CreateProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { addKid } = useUser();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [selectedHead, setSelectedHead] = useState(FUNNY_HEADS[0]);

  const handleCreate = () => {
    if (!name.trim()) return;
    
    addKid({
      id: Date.now().toString(),
      name: name,
      age: age,
      avatarSeed: selectedHead
    });
    
    navigate('/profile');
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar px-6 py-6">
      
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 active:scale-95 transition-transform"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center pt-12 pb-10 max-w-md mx-auto w-full">
          
          {/* Header Sign */}
          <div className="relative mb-8 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-8 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl">
                 <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] uppercase">
                  New Adventurer
                </h1>
                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
             </div>
          </div>

          {/* Main Avatar Preview */}
          <div className="w-40 h-40 rounded-full border-[6px] border-white shadow-[0_0_30px_rgba(255,255,255,0.3)] bg-[#f3e5ab] mb-8 relative overflow-hidden animate-in zoom-in duration-500 flex items-center justify-center">
               {AVATAR_ASSETS[selectedHead] ? (
                  <div className="w-[90%] h-[90%]">
                     <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                         {AVATAR_ASSETS[selectedHead]}
                     </svg>
                  </div>
               ) : (
                  <img src={selectedHead} alt="Selected Avatar" className="w-full h-full object-cover" />
               )}
          </div>

          {/* Name Input */}
          <div className="w-full mb-4 space-y-2">
            <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide">NAME</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name..."
              className="w-full bg-black/30 backdrop-blur-sm border-2 border-[#eecaa0]/50 rounded-xl px-5 py-4 text-white font-display text-lg placeholder:text-white/40 focus:outline-none focus:border-[#eecaa0] transition-colors shadow-inner text-center"
            />
          </div>

           {/* Age Input */}
           <div className="w-full mb-8 space-y-2">
            <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide">AGE (Optional)</label>
            <input 
              type="number" 
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age..."
              className="w-full bg-black/30 backdrop-blur-sm border-2 border-[#eecaa0]/50 rounded-xl px-5 py-4 text-white font-display text-lg placeholder:text-white/40 focus:outline-none focus:border-[#eecaa0] transition-colors shadow-inner text-center"
            />
          </div>

          {/* Avatar Selection Grid */}
          <div className="w-full mb-8">
             <label className="text-[#eecaa0] font-display font-bold ml-2 text-sm tracking-wide mb-3 block">CHOOSE A LOOK</label>
             <div className="grid grid-cols-5 gap-3">
                {FUNNY_HEADS.map((head) => (
                   <button
                     key={head}
                     onClick={() => setSelectedHead(head)}
                     className={`aspect-square rounded-full overflow-hidden border-2 transition-all duration-200 flex items-center justify-center bg-[#f3e5ab] p-1 ${selectedHead === head ? 'border-[#FFD700] scale-110 shadow-[0_0_15px_#FFD700]' : 'border-white/20 hover:border-white/50 opacity-80 hover:opacity-100'}`}
                   >
                      <div className="w-full h-full">
                         {AVATAR_ASSETS[head] ? (
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                {AVATAR_ASSETS[head]}
                            </svg>
                         ) : (
                            <img src={head} alt={head} className="w-full h-full object-cover" />
                         )}
                      </div>
                   </button>
                ))}
             </div>
          </div>

          {/* Action Button */}
          <WoodButton 
            fullWidth 
            variant="primary" 
            onClick={handleCreate} 
            disabled={!name.trim()}
            className={`py-4 text-xl transition-opacity ${!name.trim() ? 'opacity-50 grayscale' : 'opacity-100'}`}
          >
            START ADVENTURE
          </WoodButton>

      </div>
    </div>
  );
};

export default CreateProfilePage;