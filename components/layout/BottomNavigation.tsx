import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, Headphones, BookOpen, Library, Heart } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';

// Key for storing wheel hint state
const WHEEL_HINT_KEY = 'godlykids_wheel_hint_shown';

// Helper to get initial tab from pathname
const getTabFromPath = (pathname: string): string => {
  if (pathname === '/home' || pathname === '/') return 'explore';
  if (pathname === '/listen') return 'listen';
  if (pathname === '/read') return 'read';
  if (pathname === '/library') return 'library';
  if (pathname === '/giving') return 'give';
  return 'explore'; // Default to explore
};

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Initialize activeTab based on current route immediately (not in useEffect)
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));
  const { playTab, currentPlaylist } = useAudio();
  const { t } = useLanguage();
  const isPlayerActive = !!currentPlaylist;
  const [isHidden, setIsHidden] = useState(false);
  
  // Wheel hint for new users
  const [showWheelHint, setShowWheelHint] = useState(false);
  
  // Check if user has seen the wheel hint before
  useEffect(() => {
    const hasSeenHint = localStorage.getItem(WHEEL_HINT_KEY);
    if (!hasSeenHint) {
      // Show hint after a short delay for new users
      const timer = setTimeout(() => {
        setShowWheelHint(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Dismiss the hint
  const dismissHint = () => {
    setShowWheelHint(false);
    localStorage.setItem(WHEEL_HINT_KEY, 'true');
  };

  // Listen for modal open/close to hide the ship wheel
  useEffect(() => {
    const checkModalState = () => {
      setIsHidden(document.body.hasAttribute('data-modal-open'));
    };
    
    // Initial check
    checkModalState();
    
    // Use MutationObserver to watch for attribute changes on body
    const observer = new MutationObserver(checkModalState);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-modal-open'] });
    
    return () => observer.disconnect();
  }, []);

  // ... (existing code)

  // Configuration for the wheel
  const ITEM_ANGLE = 45; // Degrees between items;

  const navItems = [
    { id: 'explore', label: t('explore'), icon: Compass, path: '/home', index: 0 },
    { id: 'listen', label: t('listen'), icon: Headphones, path: '/listen', index: 1 },
    { id: 'read', label: t('read'), icon: BookOpen, path: '/read', index: 2 },
    { id: 'library', label: t('library'), icon: Library, path: '/library', index: 3 },
    { id: 'give', label: t('give') || 'Give', icon: Heart, path: '/giving', index: 4 },
  ];

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleNav = (id: string, path: string) => {
    if (activeTab === id) return;
    playTab();
    setActiveTab(id);
    navigate(path);
  };

  const activeItem = navItems.find(i => i.id === activeTab) || navItems[0];

  // --- DRAG / SWIPE LOGIC ---
  const [dragRotation, setDragRotation] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const totalMoveRef = useRef(0);

  const getAngle = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const onStart = (clientX: number, clientY: number) => {
    // Dismiss the wheel hint on first interaction
    if (showWheelHint) {
      dismissHint();
    }
    
    startAngleRef.current = getAngle(clientX, clientY);
    // Positive rotation aligns with index when items are on the left/CCW side
    startRotationRef.current = (activeItem.index * ITEM_ANGLE);

    setDragRotation(startRotationRef.current);
    setIsDragging(true);
    totalMoveRef.current = 0;
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const currentAngle = getAngle(clientX, clientY);

    // Standard physics: Dragging right (CW) increases rotation
    let delta = currentAngle - startAngleRef.current;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    totalMoveRef.current += Math.abs(delta);
    setDragRotation(startRotationRef.current + delta);
  };

  const onEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragRotation !== null) {
      // Positive rotation maps to index
      const rawIndex = dragRotation / ITEM_ANGLE;
      let index = Math.round(rawIndex);

      if (index < 0) index = 0;
      if (index > 4) index = 4;

      const targetItem = navItems.find(i => i.index === index);
      if (targetItem) {
        handleNav(targetItem.id, targetItem.path);
      }
    }
    setDragRotation(null);
  };

  // Event Listeners
  const handleTouchStart = (e: React.TouchEvent) => onStart(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY);
  const handleMouseDown = (e: React.MouseEvent) => onStart(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => onMove(e.clientX, e.clientY);

  const WHEEL_SIZE = 400;
  const RADIUS = 115;
  const CENTER = WHEEL_SIZE / 2;

  // Positive target rotation
  const targetRotation = (activeItem.index * ITEM_ANGLE);
  const visualRotation = isDragging && dragRotation !== null ? dragRotation : targetRotation;

  // Hide when modal is open
  if (isHidden) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-0 flex justify-center pointer-events-none">

      {/* Wheel Hint for New Users */}
      {showWheelHint && (
        <div 
          className={`absolute z-[50] pointer-events-auto transition-all duration-500 ease-in-out ${
            isPlayerActive ? 'bottom-[180px] md:bottom-[220px]' : 'bottom-[100px] md:bottom-[140px]'
          }`}
          onClick={dismissHint}
        >
          {/* Hint Container */}
          <div className="relative flex flex-col items-center animate-in fade-in duration-500">
            {/* Text Bubble */}
            <div className="bg-[#FFD700] text-[#3E1F07] px-4 py-2 rounded-xl font-bold text-sm shadow-lg mb-2 relative">
              <span>{t('spinWheelToNavigate') || 'Spin the wheel to navigate!'}</span>
              {/* Bubble Arrow */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#FFD700]"></div>
            </div>
            
            {/* Animated Hand Icon - Simple curved arrow */}
            <div className="relative">
              <svg 
                viewBox="0 0 64 64" 
                className="w-14 h-14 animate-wheel-hint drop-shadow-lg"
              >
                {/* Simple curved rotation arrow */}
                <g fill="none" stroke="#FFD700" strokeWidth="4" strokeLinecap="round">
                  {/* Curved arrow path */}
                  <path d="M 20 32 A 14 14 0 1 1 44 32" />
                  {/* Arrow head */}
                  <path d="M 40 24 L 44 32 L 36 32" strokeLinejoin="round" />
                </g>
              </svg>
              
              {/* Circular motion indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-2 border-dashed border-[#FFD700]/40 rounded-full animate-spin-slow"></div>
              </div>
            </div>
            
            {/* Tap to dismiss */}
            <span className="text-white/60 text-[10px] mt-2">Tap anywhere to dismiss</span>
          </div>
        </div>
      )}

      {/* Active Indicator Jewel */}
      <div
        className={`absolute z-[45] animate-bounce duration-[2000ms] transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[215px] md:bottom-[255px]' : 'bottom-[135px] md:bottom-[175px]'
          }`}
      >
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#FFD700]"></div>
      </div>

      {/* Static CSS Shadow */}
      <div
        className={`absolute w-[340px] h-[340px] rounded-full bg-black/40 blur-xl pointer-events-none md:scale-[1.25] transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[-115px] md:bottom-[-120px]' : 'bottom-[-195px] md:bottom-[-200px]'
          }`}
      ></div>

      <div
        ref={wheelRef}
        className={`absolute w-[400px] h-[400px] md:scale-[1.25] origin-center pointer-events-auto touch-none select-none flex items-center justify-center transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[-110px] md:bottom-[-115px]' : 'bottom-[-190px] md:bottom-[-195px]'
          }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={onEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        <div
          className="w-full h-full relative will-change-transform"
          style={{
            transform: `rotate(${visualRotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* SVG Wheel */}
          <svg viewBox="0 0 400 400" className="w-full h-full relative z-10 pointer-events-none">
            <g transform="translate(200, 200)">

              {/* --- 1. HANDLES --- */}
              {[...Array(8)].map((_, i) => (
                <g key={`handle-${i}`} transform={`rotate(${i * 45})`}>
                  <path
                    d="M-6,-130 L-6,-145 C-8,-146 -12,-150 -12,-160 C-12,-170 -5,-175 0,-175 C5,-175 12,-170 12,-160 C12,-150 8,-146 6,-145 L6,-130 Z"
                    fill="#5e3006"
                    stroke="#3d1e03"
                    strokeWidth="1"
                  />
                </g>
              ))}

              {/* --- 2. SPOKES --- */}
              {[...Array(8)].map((_, i) => (
                <path
                  key={`spoke-${i}`}
                  d="M-7,-40 L-5,-130 L5,-130 L7,-40 Z"
                  fill="#5e3006"
                  stroke="#2a1201"
                  strokeWidth="0.5"
                  transform={`rotate(${i * 45})`}
                />
              ))}

              {/* --- 3. OUTER RIM --- */}
              <circle r="125" fill="none" stroke="#5e3006" strokeWidth="28" />
              <circle r="138" fill="none" stroke="#4A2810" strokeWidth="2" />
              <circle r="112" fill="none" stroke="#4A2810" strokeWidth="2" />

              {/* Gold Studs */}
              {[...Array(16)].map((_, i) => (
                <circle
                  key={`stud-${i}`}
                  cx="0" cy="-125" r="3"
                  fill="#FFD700"
                  stroke="#5e3006" strokeWidth="0.5"
                  transform={`rotate(${i * 22.5 + 22.5})`}
                />
              ))}

              {/* --- 4. HUB --- */}
              <circle r="45" fill="#5e3006" stroke="#3d1e03" strokeWidth="2" />
              <circle r="18" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />

            </g>
          </svg>

          {/* Icons */}
          {navItems.map((item) => {
            // PLACEMENT LOGIC:
            // Index 0 -> -90 (Top)
            // Index 1 -> -135 (Top Left)
            // Index 2 -> -180 (Left)
            // Index 3 -> -225 (Bottom Left)
            const angleDeg = -90 - (item.index * ITEM_ANGLE);
            const angleRad = angleDeg * (Math.PI / 180);

            const x = CENTER + RADIUS * Math.cos(angleRad);
            const y = CENTER + RADIUS * Math.sin(angleRad);

            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (totalMoveRef.current < 5) {
                    handleNav(item.id, item.path);
                  }
                }}
                className="absolute w-14 h-14 -ml-7 -mt-7 flex flex-col items-center justify-center z-20 transition-transform outline-none pointer-events-auto"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  // Counter-rotate icon so it stays upright while wheel spins
                  transform: `rotate(${-visualRotation}deg) scale(${isActive ? 1.1 : 0.9})`,
                }}
              >
                <div className={`absolute inset-0 rounded-full border-4 border-[#B8860B] bg-[#3d1e03] shadow-sm transition-colors ${isActive ? 'border-[#FFD700]' : ''}`}></div>

                <div
                  className={`
                    relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                    ${isActive ? 'text-[#FFD700]' : 'text-[#cd853f]'}
                    `}
                >
                  <item.icon size={isActive ? 22 : 18} strokeWidth={2.5} />
                </div>

                <span
                  className={`
                    absolute top-12 w-24 text-center
                    text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                    ${isActive ? 'text-[#FFD700] bg-black/60 backdrop-blur-sm' : 'hidden'}
                    `}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* CSS for wheel hint animation */}
      <style>{`
        @keyframes wheel-hint {
          0%, 100% {
            transform: translateX(-15px) rotate(-20deg);
          }
          50% {
            transform: translateX(15px) rotate(20deg);
          }
        }
        .animate-wheel-hint {
          animation: wheel-hint 1.5s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default BottomNavigation;
