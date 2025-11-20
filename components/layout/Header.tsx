import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';

interface HeaderProps {
  isVisible: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS" }) => {
  const navigate = useNavigate();

  return (
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
              {/* User Avatar */}
              <div 
                  onClick={() => navigate('/profile')}
                  className="w-11 h-11 bg-[#f3e5ab] rounded-full border-[3px] border-[#8B4513] overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative group cursor-pointer active:scale-95 transition-transform"
              >
                  <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Felix" className="w-full h-full p-0.5" alt="Profile" />
              </div>
              
              {/* App Title */}
              <h1 className="text-[#5c2e0b] font-display font-extrabold text-2xl drop-shadow-sm tracking-wide" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>
                {title}
              </h1>

              {/* Currency/Points */}
              <div className="flex items-center bg-[#5c2e0b] rounded-full px-3 py-1.5 gap-2 border-2 border-[#8B4513] shadow-inner">
                  <Crown className="text-[#FFD700]" size={16} fill="#FFD700" />
                  <span className="text-white font-display font-bold text-sm">240</span>
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
  );
};

export default Header;