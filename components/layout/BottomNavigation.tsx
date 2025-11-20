import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, Headphones, BookOpen, Library } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('explore');

  // Configuration for the wheel
  const ITEM_ANGLE = 45; // Degrees between items
  
  const navItems = [
    { id: 'explore', label: 'Explore', icon: Compass, path: '/home', index: 0 },
    { id: 'listen', label: 'Listen', icon: Headphones, path: '/listen', index: 1 },
    { id: 'read', label: 'Read', icon: BookOpen, path: '/read', index: 2 },
    { id: 'library', label: 'Library', icon: Library, path: '/library', index: 3 },
  ];

  useEffect(() => {
    if (location.pathname === '/home') setActiveTab('explore');
    else if (location.pathname === '/listen') setActiveTab('listen');
    else if (location.pathname === '/read') setActiveTab('read');
    else if (location.pathname === '/library') setActiveTab('library');
  }, [location.pathname]);

  const handleNav = (id: string, path: string) => {
    setActiveTab(id);
    navigate(path);
  };

  const activeItem = navItems.find(i => i.id === activeTab) || navItems[0];
  const currentRotation = -(activeItem.index * ITEM_ANGLE);

  // Wheel Dimensions
  const WHEEL_SIZE = 280; 
  const RADIUS = 105; 
  const CENTER = WHEEL_SIZE / 2; // 140

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-0 flex justify-center pointer-events-none">
      
      {/* Active Indicator Jewel */}
      <div className="absolute bottom-[120px] z-[60] drop-shadow-xl animate-bounce duration-[2000ms]">
         <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#FFD700]"></div>
      </div>

      {/* 
        The Wheel Container.
        pointer-events-none allows scrolling "through" the wheel graphic.
      */}
      <div 
        className="absolute bottom-[-130px] w-[280px] h-[280px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none"
        style={{ 
          transform: `rotate(${currentRotation}deg)`,
        }}
      >
        {/* Blur Background Layer */}
        {/* Inset 25px matches the outer rim radius (140 - 25 = 115px radius) */}
        <div className="absolute inset-[25px] rounded-full backdrop-blur-sm bg-black/20 z-0"></div>

        {/* SVG Ship Wheel */}
        <svg viewBox="0 0 280 280" className="w-full h-full drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] relative z-10">
          <defs>
             <linearGradient id="woodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
               <stop offset="0%" stopColor="#8B4513" />
               <stop offset="50%" stopColor="#A0522D" />
               <stop offset="100%" stopColor="#5C2E0B" />
             </linearGradient>
             <filter id="woodGrain">
               <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" result="noise"/>
               <feColorMatrix type="saturate" values="0" />
               <feComposite operator="in" in2="SourceGraphic" result="composite"/>
               <feBlend mode="multiply" in="composite" in2="SourceGraphic" />
             </filter>
          </defs>

          {/* Handles (8 handles) */}
          {[...Array(8)].map((_, i) => (
             <g key={`handle-${i}`} transform={`rotate(${i * 45} 140 140)`}>
                <path d="M132,-10 L148,-10 L144,20 L136,20 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                <circle cx="140" cy="-15" r="5" fill="#8B4513" stroke="#3E1F07" />
             </g>
          ))}

          {/* Spokes (8 spokes) */}
          {[...Array(8)].map((_, i) => (
             <rect 
               key={`spoke-${i}`}
               x="134" y="20" width="12" height="240" rx="2"
               fill="#5C2E0B"
               stroke="#3E1F07"
               strokeWidth="1"
               transform={`rotate(${i * 45} 140 140)`}
             />
          ))}

          {/* Outer Rim (Ring) */}
          <circle cx="140" cy="140" r="115" fill="none" stroke="url(#woodGrad)" strokeWidth="24" />
          {/* Rim Details */}
          <circle cx="140" cy="140" r="127" fill="none" stroke="#3E1F07" strokeWidth="2" />
          <circle cx="140" cy="140" r="103" fill="none" stroke="#3E1F07" strokeWidth="2" />
          <circle cx="140" cy="140" r="115" fill="none" stroke="#3E1F07" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"/>

          {/* Inner Hub */}
          <circle cx="140" cy="140" r="40" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
          <circle cx="140" cy="140" r="20" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
          <circle cx="140" cy="140" r="8" fill="#B8860B" />
        </svg>

        {/* Icons placed on the wheel */}
        {navItems.map((item) => {
          const angleDeg = (item.index * ITEM_ANGLE) - 90;
          const angleRad = angleDeg * (Math.PI / 180);
          
          const x = CENTER + RADIUS * Math.cos(angleRad);
          const y = CENTER + RADIUS * Math.sin(angleRad);

          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={(e) => {
                 e.stopPropagation(); 
                 handleNav(item.id, item.path);
              }}
              // pointer-events-auto enables clicking/tapping on the buttons even though container is none
              className="absolute w-14 h-14 -ml-7 -mt-7 flex flex-col items-center justify-center z-20 transition-all duration-300 outline-none pointer-events-auto"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: `rotate(${-currentRotation}deg) scale(${isActive ? 1.1 : 0.9})`, 
              }}
            >
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.5)] border-2 transition-all duration-300
                  ${isActive 
                    ? 'bg-[#FFD700] text-[#5C2E0B] border-white scale-110' 
                    : 'bg-[#3E1F07] text-[#e2cba5] border-[#8B4513] hover:bg-[#5C2E0B]'
                  }
                `}
              >
                <item.icon size={isActive ? 20 : 18} strokeWidth={2.5} />
              </div>
              <span 
                className={`
                  absolute top-12 w-24 text-center
                  text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition-all duration-300
                  ${isActive 
                    ? 'text-[#FFD700] opacity-100 drop-shadow-md bg-black/40 backdrop-blur-sm scale-100' 
                    : 'text-white/70 opacity-0 scale-0'
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;