
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Compass, Headphones, BookOpen, Library } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('explore');
  const { playTab, currentPlaylist } = useAudio();
  const isPlayerActive = !!currentPlaylist;

  // ... (existing code)

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

  const WHEEL_SIZE = 400;
  const RADIUS = 115;
  const CENTER = WHEEL_SIZE / 2;

  // Positive target rotation
  const targetRotation = (activeItem.index * ITEM_ANGLE);
  const visualRotation = isDragging && dragRotation !== null ? dragRotation : targetRotation;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-0 flex justify-center pointer-events-none">

      {/* Active Indicator Jewel */}
      <div
        className={`absolute z-[60] animate-bounce duration-[2000ms] transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[215px] md:bottom-[310px]' : 'bottom-[135px] md:bottom-[230px]'
          }`}
      >
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#FFD700]"></div>
      </div>

      {/* Static CSS Shadow */}
      <div
        className={`absolute w-[340px] h-[340px] rounded-full bg-black/40 blur-xl pointer-events-none md:scale-[1.6] transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[-115px] md:bottom-[-90px]' : 'bottom-[-195px] md:bottom-[-170px]'
          }`}
      ></div>

      <div
        ref={wheelRef}
        className={`absolute w-[400px] h-[400px] md:scale-[1.6] origin-center pointer-events-auto touch-none select-none flex items-center justify-center transition-all duration-500 ease-in-out ${isPlayerActive ? 'bottom-[-110px] md:bottom-[-85px]' : 'bottom-[-190px] md:bottom-[-165px]'
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
    </div>
  );
};

export default BottomNavigation;
