
import React, { useEffect, useState, useRef } from 'react';
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

  // --- DRAG / SWIPE LOGIC ---
  const [dragRotation, setDragRotation] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const totalMoveRef = useRef(0); // To distinguish tap vs drag

  // Helper: Calculate angle of touch relative to wheel center
  const getAngle = (clientX: number, clientY: number) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // atan2 returns radians, convert to degrees
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const onStart = (clientX: number, clientY: number) => {
    startAngleRef.current = getAngle(clientX, clientY);
    // The current target rotation based on active tab
    startRotationRef.current = -(activeItem.index * ITEM_ANGLE);
    
    setDragRotation(startRotationRef.current);
    setIsDragging(true);
    totalMoveRef.current = 0;
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const currentAngle = getAngle(clientX, clientY);
    let delta = currentAngle - startAngleRef.current;

    // Handle angle wrapping -180/180 boundary
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    totalMoveRef.current += Math.abs(delta);
    setDragRotation(startRotationRef.current + delta);
  };

  const onEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragRotation !== null) {
      // Snap to nearest index
      // visualRotation = -(index * 45)
      // index = -visualRotation / 45
      const rawIndex = -dragRotation / ITEM_ANGLE;
      let index = Math.round(rawIndex);

      // Clamp index to valid range
      if (index < 0) index = 0;
      if (index > 3) index = 3;

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

  // Wheel Dimensions
  const WHEEL_SIZE = 400; // Increased size to prevent cropping of handles
  const RADIUS = 115; 
  const CENTER = WHEEL_SIZE / 2; // 200

  // Calculated Rotation
  const targetRotation = -(activeItem.index * ITEM_ANGLE);
  const visualRotation = isDragging && dragRotation !== null ? dragRotation : targetRotation;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-0 flex justify-center pointer-events-none">
      
      {/* Active Indicator Jewel */}
      <div className="absolute bottom-[135px] md:bottom-[230px] z-[60] drop-shadow-xl animate-bounce duration-[2000ms]">
         <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#FFD700] filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"></div>
      </div>

      {/* 
        The Wheel Wrapper Container.
        Handles Positioning & Scaling (Static Transforms).
        
        - Tablet Scale: 1.6x
        - Position: 
            Mobile: -190px (Center ~10px from bottom)
            Tablet: -165px (Lowered further to show approx 55% of scaled wheel)
        - Origin: Center (Prevents wobbling during rotation)
      */}
      <div 
        ref={wheelRef}
        className="absolute bottom-[-190px] md:bottom-[-165px] w-[400px] h-[400px] md:scale-[1.6] origin-center pointer-events-auto touch-none select-none flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={onEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        {/* Rotating Inner Container - Handles Dynamic Rotation */}
        <div 
            className="w-full h-full relative"
            style={{ 
                transform: `rotate(${visualRotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.7s cubic-bezier(0.19, 1, 0.22, 1)',
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
        >
            {/* SVG Ship Wheel - High Detail */}
            <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_0_40px_rgba(0,0,0,0.6)] relative z-10 pointer-events-none">
            <defs>
                {/* Realistic Wood Gradients */}
                <radialGradient id="woodRadial" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="40%" stopColor="#8B4513" />
                <stop offset="85%" stopColor="#5e3006" />
                <stop offset="100%" stopColor="#3d1e03" />
                </radialGradient>
                
                {/* Linear Wood for Spokes/Handles to simulate cylinder */}
                <linearGradient id="woodCylinder" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3d1e03" />
                <stop offset="20%" stopColor="#8B4513" />
                <stop offset="50%" stopColor="#cd853f" /> {/* Highlight */}
                <stop offset="80%" stopColor="#8B4513" />
                <stop offset="100%" stopColor="#3d1e03" />
                </linearGradient>

                {/* Gold/Brass Gradient */}
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FDB931" />
                    <stop offset="30%" stopColor="#FFD700" />
                    <stop offset="60%" stopColor="#FDB931" />
                    <stop offset="100%" stopColor="#B8860B" />
                </linearGradient>

                {/* Texture Filter */}
                <filter id="woodGrain">
                <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" stitchTiles="stitch" result="noise"/>
                <feColorMatrix type="saturate" values="0.1" result="desaturatedNoise"/>
                <feComposite operator="in" in="desaturatedNoise" in2="SourceGraphic" result="composite"/>
                <feBlend mode="multiply" in="composite" in2="SourceGraphic" />
                </filter>
                
                {/* Inner Shadow for Depth */}
                <filter id="innerBevel" x="-50%" y="-50%" width="200%" height="200%">
                    <feComponentTransfer in="SourceAlpha">
                        <feFuncA type="table" tableValues="1 0" />
                    </feComponentTransfer>
                    <feGaussianBlur stdDeviation="2"/> 
                    <feOffset dx="1" dy="2" result="offsetblur"/>
                    <feFlood floodColor="black" floodOpacity="0.7"/>
                    <feComposite in2="offsetblur" operator="in"/>
                    <feComposite in2="SourceAlpha" operator="in" />
                    <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode />
                    </feMerge>
                </filter>

                <filter id="dropShadowLoose">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.5"/>
                </filter>
            </defs>

            <g transform="translate(200, 200)" filter="url(#dropShadowLoose)">
                
                {/* --- 1. HANDLES (Back Layer) --- */}
                {[...Array(8)].map((_, i) => (
                    <g key={`handle-${i}`} transform={`rotate(${i * 45})`}>
                        {/* Bulbous Handle Shape */}
                        <path 
                            d="M-6,-130 L-6,-145 C-8,-146 -12,-150 -12,-160 C-12,-170 -5,-175 0,-175 C5,-175 12,-170 12,-160 C12,-150 8,-146 6,-145 L6,-130 Z" 
                            fill="url(#woodCylinder)" 
                            stroke="#3d1e03" 
                            strokeWidth="1"
                        />
                        <circle cx="0" cy="-175" r="2" fill="#3d1e03" opacity="0.5" />
                    </g>
                ))}

                {/* --- 2. SPOKES (Connect Hub to Rim) --- */}
                {[...Array(8)].map((_, i) => (
                    <path 
                        key={`spoke-${i}`}
                        d="M-7,-40 L-5,-130 L5,-130 L7,-40 Z" 
                        fill="url(#woodCylinder)"
                        stroke="#2a1201"
                        strokeWidth="0.5"
                        transform={`rotate(${i * 45})`}
                    />
                ))}

                {/* --- 3. OUTER RIM --- */}
                {/* Main Ring */}
                <circle r="125" fill="none" stroke="url(#woodRadial)" strokeWidth="28" filter="url(#woodGrain)" />
                
                {/* Rim Bevels (Simulated with thin strokes) */}
                <circle r="138" fill="none" stroke="#4A2810" strokeWidth="2" />
                <circle r="136" fill="none" stroke="#7a4012" strokeWidth="1" opacity="0.5" />
                
                <circle r="112" fill="none" stroke="#4A2810" strokeWidth="2" />
                <circle r="114" fill="none" stroke="#7a4012" strokeWidth="1" opacity="0.5" />
                
                {/* Decorative Grooves on Rim */}
                <circle r="125" fill="none" stroke="#3d1e03" strokeWidth="2" opacity="0.3" />
                <circle r="120" fill="none" stroke="#3d1e03" strokeWidth="1" opacity="0.2" />
                <circle r="130" fill="none" stroke="#3d1e03" strokeWidth="1" opacity="0.2" />

                {/* Gold Studs on Rim */}
                {[...Array(16)].map((_, i) => (
                    <circle 
                        key={`stud-${i}`}
                        cx="0" cy="-125" r="3" 
                        fill="url(#goldGrad)" 
                        stroke="#5e3006" strokeWidth="0.5"
                        transform={`rotate(${i * 22.5 + 22.5})`} 
                        filter="url(#innerBevel)"
                    />
                ))}

                {/* --- 4. HUB (Center) --- */}
                {/* Base */}
                <circle r="45" fill="url(#woodRadial)" stroke="#3d1e03" strokeWidth="2" />
                {/* Inner detail */}
                <circle r="35" fill="none" stroke="url(#woodCylinder)" strokeWidth="8" opacity="0.8" />
                <circle r="25" fill="#5e3006" />
                {/* Gold Cap */}
                <circle r="18" fill="url(#goldGrad)" stroke="#B8860B" strokeWidth="1" filter="url(#innerBevel)" />
                {/* Center Bolt */}
                <circle r="6" fill="#B8860B" stroke="#3d1e03" strokeWidth="0.5" />

            </g>
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
                    if (totalMoveRef.current < 5) {
                        handleNav(item.id, item.path);
                    }
                }}
                className="absolute w-14 h-14 -ml-7 -mt-7 flex flex-col items-center justify-center z-20 transition-all duration-300 outline-none pointer-events-auto"
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    // Counter-rotate icons so they stay upright relative to screen, or rotate with wheel?
                    // Currently rotating with wheel but scaling up.
                    // The transform below counter-rotates visualRotation so icons stay upright!
                    transform: `rotate(${-visualRotation}deg) scale(${isActive ? 1.1 : 0.9})`, 
                }}
                >
                {/* Mounting Plate for Icon */}
                <div className={`absolute inset-0 rounded-full border-4 border-[#B8860B] bg-[#3d1e03] shadow-lg transition-all duration-300 ${isActive ? 'scale-110 border-[#FFD700]' : 'scale-100'}`}></div>

                <div 
                    className={`
                    relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isActive 
                        ? 'text-[#FFD700]' 
                        : 'text-[#cd853f] hover:text-[#FFD700]'
                    }
                    `}
                >
                    <item.icon size={isActive ? 22 : 18} strokeWidth={2.5} className="filter drop-shadow-sm" />
                </div>
                
                <span 
                    className={`
                    absolute top-12 w-24 text-center
                    text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full transition-all duration-300
                    ${isActive 
                        ? 'text-[#FFD700] opacity-100 drop-shadow-md bg-black/60 backdrop-blur-sm scale-100' 
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
    </div>
  );
};

export default BottomNavigation;
