import React from 'react';

export const AVATAR_ASSETS: Record<string, React.ReactNode> = {
  // --- EXISTING HATS ---
  'hat-pirate': (
    <g>
      <path d="M10,50 L90,50 L80,20 Q50,0 20,20 Z" fill="#333" stroke="#000" strokeWidth="2" />
      <path d="M35,25 L65,25" stroke="white" strokeWidth="2" />
      <circle cx="50" cy="20" r="5" fill="white" />
      <path d="M5,50 L95,50 L95,60 Q50,70 5,60 Z" fill="#333" stroke="#000" strokeWidth="2" />
    </g>
  ),
  'hat-viking': (
    <g>
       <path d="M20,50 Q50,10 80,50" fill="#78909c" stroke="#37474f" strokeWidth="2" />
       <path d="M15,50 L85,50" stroke="#37474f" strokeWidth="2" />
       <path d="M20,40 Q5,20 15,5" fill="#f3e5ab" stroke="#3e2723" strokeWidth="1.5" />
       <path d="M80,40 Q95,20 85,5" fill="#f3e5ab" stroke="#3e2723" strokeWidth="1.5" />
    </g>
  ),
  'hat-propeller': (
    <g>
      <path d="M25,55 Q50,15 75,55" fill="#ffeb3b" stroke="#fbc02d" strokeWidth="2" />
      <rect x="48" y="15" width="4" height="10" fill="#333" />
      <path d="M20,15 L80,15" stroke="#f44336" strokeWidth="3" className="animate-[spin_0.5s_linear_infinite] origin-[50px_15px]" />
    </g>
  ),
  'hat-crown': (
    <g>
      <path d="M20,50 L30,20 L40,50 L50,15 L60,50 L70,20 L80,50 Z" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
      <circle cx="30" cy="20" r="3" fill="red" />
      <circle cx="50" cy="15" r="3" fill="blue" />
      <circle cx="70" cy="20" r="3" fill="green" />
    </g>
  ),
  'hat-cowboy': (
    <g>
      <path d="M10,45 Q50,60 90,45 L90,40 Q50,55 10,40 Z" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
      <path d="M25,40 L25,20 Q50,0 75,20 L75,40 Z" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
      <path d="M25,35 L75,35" stroke="#3e2723" strokeWidth="3" />
    </g>
  ),
  'hat-cone': (
    <g>
      <path d="M20,60 L80,60 L50,5 Z" fill="#ff6f00" stroke="#e65100" strokeWidth="2" />
      <rect x="15" y="60" width="70" height="5" fill="#ff6f00" stroke="#e65100" />
      <path d="M30,40 L70,40 L65,30 L35,30 Z" fill="white" opacity="0.8" />
      <path d="M25,50 L75,50 L72,45 L28,45 Z" fill="white" opacity="0.8" />
    </g>
  ),
  'hat-sombrero': (
    <g>
      <ellipse cx="50" cy="50" rx="45" ry="10" fill="#fdd835" stroke="#fbc02d" strokeWidth="2" />
      <path d="M30,50 Q30,20 50,15 Q70,20 70,50" fill="#fdd835" stroke="#fbc02d" strokeWidth="2" />
      <path d="M30,45 Q50,55 70,45" fill="none" stroke="#e91e63" strokeWidth="2" strokeDasharray="4,2" />
      <path d="M10,50 Q50,65 90,50" fill="none" stroke="#e91e63" strokeWidth="2" />
    </g>
  ),
  'hat-brain': (
    <g>
      <path d="M20,50 Q20,10 50,10 Q80,10 80,50" fill="#f8bbd0" stroke="#ec407a" strokeWidth="2" />
      <path d="M30,30 Q40,20 50,30 Q60,20 70,30" fill="none" stroke="#ec407a" strokeWidth="2" />
      <path d="M25,40 Q35,30 45,40" fill="none" stroke="#ec407a" strokeWidth="2" />
      <path d="M55,40 Q65,30 75,40" fill="none" stroke="#ec407a" strokeWidth="2" />
    </g>
  ),
  'hat-poo': (
    <g>
       <path d="M20,60 Q50,70 80,60 L75,45 Q50,55 25,45 L20,60 Z" fill="#5d4037" />
       <path d="M25,45 Q50,55 75,45 L70,30 Q50,40 30,30 L25,45 Z" fill="#795548" />
       <path d="M30,30 Q50,40 70,30 L60,15 Q50,20 40,15 L30,30 Z" fill="#8d6e63" />
       <path d="M40,15 Q50,25 60,15 L50,5 L40,15 Z" fill="#a1887f" />
       <circle cx="15" cy="20" r="1" fill="black" className="animate-bounce" />
       <circle cx="85" cy="30" r="1" fill="black" className="animate-bounce delay-100" />
    </g>
  ),
  'hat-astronaut': (
    <g>
      <circle cx="50" cy="50" r="45" fill="rgba(225,245,254,0.4)" stroke="#b0bec5" strokeWidth="4" />
      <path d="M20,50 Q50,80 80,50" fill="none" stroke="#b0bec5" strokeWidth="2" opacity="0.5" />
      <circle cx="70" cy="30" r="5" fill="white" opacity="0.6" />
    </g>
  ),
  'hat-chef': (
    <g>
      <path d="M25,55 L75,55 L75,45 L25,45 Z" fill="white" stroke="#e0e0e0" strokeWidth="2" />
      <path d="M25,45 Q10,15 40,15 Q50,0 60,15 Q90,15 75,45" fill="white" stroke="#e0e0e0" strokeWidth="2" />
    </g>
  ),
  'hat-party': (
    <g>
       <path d="M25,60 L50,10 L75,60 Z" fill="#ab47bc" stroke="#8e24aa" strokeWidth="2" />
       <circle cx="50" cy="10" r="0" className="animate-ping"><animate attributeName="r" values="0;10" dur="1s" repeatCount="indefinite" /></circle>
       <circle cx="35" cy="50" r="3" fill="#ffeb3b" />
       <circle cx="65" cy="40" r="3" fill="#4caf50" />
       <circle cx="50" cy="30" r="3" fill="#2196f3" />
    </g>
  ),
  'hat-tophat': (
    <g>
      <rect x="15" y="55" width="70" height="5" fill="#212121" />
      <rect x="25" y="15" width="50" height="40" fill="#212121" />
      <rect x="25" y="45" width="50" height="5" fill="#d32f2f" />
    </g>
  ),
  'hat-flowers': (
    <g>
       <circle cx="20" cy="50" r="8" fill="#e91e63" />
       <circle cx="35" cy="45" r="8" fill="#9c27b0" />
       <circle cx="50" cy="42" r="8" fill="#2196f3" />
       <circle cx="65" cy="45" r="8" fill="#4caf50" />
       <circle cx="80" cy="50" r="8" fill="#ffeb3b" />
    </g>
  ),
  'hat-ninja': (
    <g>
       <rect x="15" y="35" width="70" height="15" fill="#d32f2f" />
       <circle cx="50" cy="42" r="5" fill="#b71c1c" />
       <path d="M85,40 Q100,30 100,60 L95,45 Z" fill="#d32f2f" />
    </g>
  ),
  // --- NEW HATS ---
  'hat-cap-backwards': (
    <g>
      <path d="M20,50 Q50,20 80,50" fill="#1976d2" stroke="#0d47a1" strokeWidth="2" />
      <path d="M15,50 L85,50 L85,45 L15,45 Z" fill="#1565c0" />
      <path d="M20,45 L10,48 L20,51" fill="#1976d2" stroke="#0d47a1" />
    </g>
  ),
  'hat-beanie': (
    <g>
       <path d="M20,55 Q50,10 80,55" fill="#e64a19" stroke="#bf360c" strokeWidth="2" />
       <rect x="18" y="50" width="64" height="10" rx="2" fill="#d84315" stroke="#bf360c" />
       <circle cx="50" cy="15" r="6" fill="#ff5722" />
    </g>
  ),
  'hat-jester': (
    <g>
      <path d="M20,50 Q10,10 30,25 L40,50" fill="#7b1fa2" stroke="#4a148c" />
      <path d="M80,50 Q90,10 70,25 L60,50" fill="#7b1fa2" stroke="#4a148c" />
      <path d="M40,50 Q50,10 60,50" fill="#ab47bc" stroke="#4a148c" />
      <circle cx="30" cy="25" r="4" fill="#ffeb3b" />
      <circle cx="70" cy="25" r="4" fill="#ffeb3b" />
      <circle cx="50" cy="10" r="4" fill="#ffeb3b" />
    </g>
  ),
  'hat-afro': (
    <g>
      <circle cx="50" cy="40" r="35" fill="#3e2723" stroke="#212121" strokeWidth="2" />
      <circle cx="30" cy="30" r="10" fill="#4e342e" />
      <circle cx="70" cy="30" r="10" fill="#4e342e" />
      <circle cx="50" cy="15" r="10" fill="#4e342e" />
      <path d="M20,40 Q50,55 80,40" fill="none" stroke="#212121" strokeWidth="2" />
    </g>
  ),
  'hat-grad': (
    <g>
      <rect x="20" y="35" width="60" height="15" fill="#212121" />
      <path d="M10,35 L50,15 L90,35 L50,55 Z" fill="#212121" stroke="#000" />
      <circle cx="50" cy="35" r="2" fill="#fbc02d" />
      <path d="M50,35 L70,45 L70,55" fill="none" stroke="#fbc02d" strokeWidth="2" />
    </g>
  ),
  'hat-headphones': (
    <g>
       <path d="M15,50 Q15,10 50,10 Q85,10 85,50" fill="none" stroke="#424242" strokeWidth="6" />
       <rect x="5" y="40" width="15" height="30" rx="5" fill="#f44336" stroke="#b71c1c" />
       <rect x="80" y="40" width="15" height="30" rx="5" fill="#f44336" stroke="#b71c1c" />
    </g>
  ),

  // --- EXISTING BODIES ---
  'body-robot': (
    <g>
      <rect x="25" y="0" width="50" height="60" rx="5" fill="#b0bec5" stroke="#546e7a" strokeWidth="2" />
      <rect x="35" y="15" width="30" height="20" fill="#4dd0e1" stroke="#0097a7" />
      <circle cx="40" cy="45" r="3" fill="#ff5252" />
      <circle cx="50" cy="45" r="3" fill="#ffeb3b" />
      <circle cx="60" cy="45" r="3" fill="#69f0ae" />
    </g>
  ),
  'body-suit': (
    <g>
       <path d="M25,0 L75,0 L85,20 L80,60 L20,60 L15,20 Z" fill="#ef5350" stroke="#b71c1c" strokeWidth="2" />
       <path d="M40,20 L50,35 L60,20" fill="#ffeb3b" />
       <circle cx="50" cy="30" r="8" fill="white" stroke="#b71c1c" />
       <text x="50" y="33" fontSize="8" textAnchor="middle" fill="#b71c1c" fontWeight="bold">S</text>
    </g>
  ),
  'body-tux': (
    <g>
       <path d="M25,0 L75,0 L80,60 L20,60 Z" fill="#212121" stroke="black" strokeWidth="1" />
       <path d="M40,0 L50,40 L60,0 Z" fill="white" />
       <path d="M45,5 L55,5 L55,10 L45,10 Z" fill="#d50000" />
       <circle cx="50" cy="20" r="2" fill="black" />
       <circle cx="50" cy="30" r="2" fill="black" />
    </g>
  ),
  'body-hotdog': (
    <g>
       <rect x="30" y="0" width="40" height="60" rx="10" fill="#f44336" />
       <path d="M20,0 Q10,30 20,60 L30,60 L30,0 Z" fill="#ffca28" />
       <path d="M80,0 Q90,30 80,60 L70,60 L70,0 Z" fill="#ffca28" />
       <path d="M45,5 Q55,30 45,55" fill="none" stroke="#ffeb3b" strokeWidth="3" />
    </g>
  ),
  'body-skeleton': (
    <g>
       <rect x="35" y="0" width="30" height="60" fill="#212121" />
       <path d="M40,10 L60,10 M35,20 L65,20 M40,30 L60,30 M45,40 L55,40" stroke="white" strokeWidth="3" strokeLinecap="round" />
       <path d="M50,0 L50,60" stroke="white" strokeWidth="3" />
    </g>
  ),
  'body-armor': (
    <g>
       <path d="M20,0 L80,0 L75,50 L50,60 L25,50 Z" fill="#bdbdbd" stroke="#757575" strokeWidth="2" />
       <path d="M25,50 L50,40 L75,50" fill="none" stroke="#757575" />
       <circle cx="50" cy="25" r="10" fill="#1976d2" opacity="0.8" />
    </g>
  ),
  'body-donut': (
    <g>
       <circle cx="50" cy="30" r="35" fill="#8d6e63" />
       <circle cx="50" cy="30" r="15" fill="#f3e5ab" />
       <path d="M25,20 Q50,5 75,20 Q80,40 50,55 Q20,40 25,20" fill="#f06292" opacity="0.9" />
       <rect x="30" y="15" width="4" height="2" fill="white" transform="rotate(45 30 15)" />
       <rect x="60" y="15" width="4" height="2" fill="yellow" transform="rotate(-20 60 15)" />
       <rect x="50" y="45" width="4" height="2" fill="cyan" transform="rotate(10 50 45)" />
    </g>
  ),
  'body-dress': (
    <g>
      <path d="M30,0 L70,0 L90,60 L10,60 Z" fill="#e040fb" stroke="#aa00ff" strokeWidth="1" />
      <path d="M30,0 Q50,40 70,0" fill="white" opacity="0.3" />
      <circle cx="50" cy="20" r="5" fill="#ffeb3b" />
    </g>
  ),
  'body-overalls': (
    <g>
       <rect x="30" y="0" width="40" height="60" fill="#1976d2" />
       <rect x="25" y="0" width="5" height="60" fill="#0d47a1" />
       <rect x="70" y="0" width="5" height="60" fill="#0d47a1" />
       <circle cx="35" cy="10" r="3" fill="#ffeb3b" />
       <circle cx="65" cy="10" r="3" fill="#ffeb3b" />
       <rect x="40" y="20" width="20" height="15" fill="#1565c0" />
    </g>
  ),
  'body-muscle': (
    <g>
       <rect x="25" y="0" width="50" height="60" fill="#d7ccc8" />
       <path d="M30,0 L70,0 L65,60 L35,60 Z" fill="#3e2723" opacity="0.8" />
       <path d="M25,0 Q50,20 75,0" fill="#d7ccc8" />
       <path d="M35,30 Q50,40 65,30" fill="none" stroke="#3e2723" strokeWidth="1" opacity="0.5" />
    </g>
  ),
  'body-ghost': (
    <g>
       <path d="M20,60 L20,20 Q50,-10 80,20 L80,60" fill="white" opacity="0.9" stroke="#e0e0e0" strokeWidth="2" />
       <circle cx="40" cy="20" r="3" fill="#212121" />
       <circle cx="60" cy="20" r="3" fill="#212121" />
       <ellipse cx="50" cy="30" rx="4" ry="6" fill="#212121" />
    </g>
  ),
  'body-hawaiian': (
    <g>
      <rect x="25" y="0" width="50" height="60" fill="#00bcd4" />
      <circle cx="35" cy="20" r="5" fill="#ffeb3b" opacity="0.8" />
      <circle cx="60" cy="40" r="6" fill="#ff5252" opacity="0.8" />
      <circle cx="45" cy="50" r="4" fill="#69f0ae" opacity="0.8" />
      <path d="M50,0 L50,60" stroke="#0097a7" strokeWidth="1" />
    </g>
  ),
  'body-puffer': (
    <g>
      <rect x="20" y="0" width="60" height="60" rx="10" fill="#ff9800" />
      <line x1="20" y1="15" x2="80" y2="15" stroke="#ef6c00" strokeWidth="2" />
      <line x1="20" y1="30" x2="80" y2="30" stroke="#ef6c00" strokeWidth="2" />
      <line x1="20" y1="45" x2="80" y2="45" stroke="#ef6c00" strokeWidth="2" />
      <rect x="48" y="0" width="4" height="60" fill="#333" />
    </g>
  ),
  // --- NEW BODIES ---
  'body-hoodie': (
    <g>
       <path d="M20,0 L80,0 L85,60 L15,60 Z" fill="#607d8b" stroke="#455a64" strokeWidth="2" />
       <path d="M25,0 Q50,25 75,0" fill="#90a4ae" />
       <rect x="40" y="25" width="20" height="25" fill="#455a64" opacity="0.5" rx="2" />
       <path d="M45,25 L45,10" stroke="#cfd8dc" strokeWidth="2" />
       <path d="M55,25 L55,10" stroke="#cfd8dc" strokeWidth="2" />
    </g>
  ),
  'body-tshirt-logo': (
    <g>
       <rect x="25" y="0" width="50" height="60" fill="#212121" />
       <path d="M30,0 Q50,10 70,0" fill="#e0e0e0" />
       <circle cx="50" cy="30" r="10" fill="#e91e63" />
       <path d="M45,30 L55,30 M50,25 L50,35" stroke="white" strokeWidth="2" />
    </g>
  ),
  'body-king-robe': (
    <g>
       <rect x="20" y="0" width="60" height="60" fill="#b71c1c" />
       <rect x="45" y="0" width="10" height="60" fill="white" />
       <circle cx="50" cy="15" r="2" fill="black" />
       <circle cx="50" cy="30" r="2" fill="black" />
       <circle cx="50" cy="45" r="2" fill="black" />
       <path d="M20,0 L30,20 L40,0" fill="white" />
       <path d="M80,0 L70,20 L60,0" fill="white" />
    </g>
  ),
  'body-jester': (
    <g>
       <rect x="25" y="0" width="25" height="60" fill="#ab47bc" />
       <rect x="50" y="0" width="25" height="60" fill="#ffeb3b" />
       <circle cx="50" cy="10" r="4" fill="red" />
       <circle cx="50" cy="50" r="4" fill="red" />
       <path d="M25,0 Q50,20 75,0" fill="none" stroke="black" strokeWidth="1" />
    </g>
  ),
  'body-karate': (
    <g>
       <path d="M20,0 L80,0 L75,60 L25,60 Z" fill="white" stroke="#e0e0e0" strokeWidth="2" />
       <path d="M25,0 L75,60 M75,0 L25,60" stroke="#e0e0e0" strokeWidth="2" opacity="0.5" />
       <rect x="20" y="35" width="60" height="6" fill="black" />
    </g>
  ),
  'body-space-suit': (
    <g>
       <rect x="20" y="0" width="60" height="60" rx="5" fill="#eceff1" stroke="#b0bec5" strokeWidth="2" />
       <rect x="35" y="15" width="30" height="20" fill="#29b6f6" stroke="#0288d1" />
       <circle cx="40" cy="50" r="5" fill="#d32f2f" />
       <rect x="55" y="45" width="20" height="10" fill="#ffa000" />
    </g>
  ),

  // --- ARMS (LEFT - Viewers Right) ---
  'arm-l-robot': (
    <g transform="rotate(20 25 0)">
       <rect x="0" y="0" width="20" height="50" rx="5" fill="#90a4ae" stroke="#546e7a" />
       <path d="M5,50 L-5,70 M15,50 L25,70" stroke="#546e7a" strokeWidth="4" />
       <circle cx="10" cy="0" r="5" fill="#546e7a" />
    </g>
  ),
  'arm-l-muscle': (
     <g transform="rotate(10 25 0)">
        <path d="M10,0 Q30,20 20,40 Q10,50 0,40 Q-10,20 10,0" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
        <circle cx="10" cy="40" r="12" fill="#8d6e63" stroke="#5d4037" />
     </g>
  ),
  'arm-l-tentacle': (
      <path d="M10,0 Q-20,20 0,40 Q20,60 -10,80" transform="scale(-1, 1) translate(-20, 0)" fill="none" stroke="#ba68c8" strokeWidth="8" strokeLinecap="round" />
  ),
  'arm-l-hook': (
     <g transform="rotate(15 25 0)">
        <rect x="5" y="0" width="10" height="40" fill="#3e2723" />
        <path d="M10,40 L10,50 Q-10,70 10,80" fill="none" stroke="#bdbdbd" strokeWidth="4" />
        <circle cx="10" cy="40" r="8" fill="#ffc107" />
     </g>
  ),
  'arm-l-crab': (
     <g transform="rotate(10 25 0)">
        <path d="M0,0 Q20,30 10,50" fill="none" stroke="#f44336" strokeWidth="6" />
        <path d="M20,50 Q30,70 10,80 Q-10,70 0,50 Z" fill="#f44336" />
        <path d="M20,50 L10,70 M0,50 L10,70" stroke="#b71c1c" strokeWidth="1" />
     </g>
  ),
  'arm-l-zombie': (
     <g transform="rotate(10 25 0)">
        <rect x="5" y="0" width="12" height="50" fill="#c8e6c9" stroke="#388e3c" />
        <rect x="5" y="0" width="12" height="15" fill="#5d4037" />
        <rect x="5" y="50" width="12" height="10" fill="#c8e6c9" />
        <path d="M5,60 L0,70 M10,60 L10,75 M17,60 L20,68" stroke="#388e3c" strokeWidth="2" />
     </g>
  ),
  'arm-l-wing': (
     <g transform="rotate(20 25 0)">
        <path d="M10,0 Q60,30 30,80 Q0,40 10,0" fill="white" stroke="#e0e0e0" strokeWidth="2" />
        <path d="M20,20 Q40,40 25,60" fill="none" stroke="#e0e0e0" />
     </g>
  ),
  'arm-l-wing-dragon': (
    <g transform="rotate(20 25 0)">
       <path d="M10,0 Q80,30 20,90 L15,60 Q30,40 10,0" fill="#d32f2f" stroke="#b71c1c" strokeWidth="2" />
       <path d="M20,20 L40,30 L20,40" fill="none" stroke="#b71c1c" />
    </g>
  ),
  'arm-l-cactus': (
    <g transform="rotate(10 25 0)">
       <path d="M10,0 Q0,40 20,80" fill="none" stroke="#4caf50" strokeWidth="15" strokeLinecap="round" />
       <path d="M15,20 L5,20 M18,40 L8,40 M20,60 L10,60" stroke="#1b5e20" strokeWidth="2" />
    </g>
  ),
  'arm-l-box': (
    <g>
       <rect x="0" y="0" width="30" height="60" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
       <line x1="0" y1="30" x2="30" y2="30" stroke="#5d4037" />
    </g>
  ),
  'arm-l-slime': (
    <path d="M10,0 Q30,30 10,60 Q0,70 5,80" fill="none" stroke="#76ff03" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
  ),
  'arm-l-skeleton-fancy': (
    <g transform="rotate(10 25 0)">
       <line x1="15" y1="0" x2="15" y2="60" stroke="#eee" strokeWidth="6" />
       <circle cx="15" cy="60" r="5" fill="#eee" />
       <circle cx="15" cy="30" r="8" fill="none" stroke="#ffd700" strokeWidth="3" />
    </g>
  ),
  'arm-l-drill': (
    <g transform="rotate(20 25 0)">
       <rect x="5" y="0" width="15" height="40" fill="#607d8b" />
       <path d="M0,40 L25,40 L12.5,80 Z" fill="#cfd8dc" stroke="#607d8b" />
       <path d="M5,45 L20,45 M8,55 L18,55 M10,65 L15,65" stroke="#607d8b" />
    </g>
  ),
  'arm-l-baguette': (
    <g transform="rotate(30 25 0)">
       <ellipse cx="10" cy="40" rx="8" ry="40" fill="#ffcc80" stroke="#e65100" />
       <path d="M5,20 L15,25 M5,40 L15,45 M5,60 L15,65" stroke="#e65100" strokeWidth="2" />
    </g>
  ),
  // --- NEW ARMS (LEFT) ---
  'arm-l-wing-angel': (
    <g transform="rotate(20 25 0)">
       <path d="M10,0 Q70,20 50,80 Q10,50 10,0" fill="#fff9c4" stroke="#fbc02d" strokeWidth="2" />
       <path d="M20,20 Q40,30 30,50" fill="none" stroke="#fbc02d" />
    </g>
  ),
  'arm-l-glove-boxing': (
    <g transform="rotate(15 25 0)">
       <rect x="5" y="0" width="12" height="40" fill="#8d6e63" />
       <circle cx="10" cy="55" r="15" fill="#f44336" stroke="#b71c1c" strokeWidth="2" />
       <path d="M5,50 L15,50" stroke="#b71c1c" />
    </g>
  ),
  'arm-l-claw-monster': (
    <g transform="rotate(10 25 0)">
       <path d="M5,0 L15,0 L18,40 L2,40 Z" fill="#4caf50" stroke="#2e7d32" />
       <path d="M0,40 L10,60 L20,40" fill="#4caf50" />
       <path d="M0,60 L5,75 M10,60 L10,75 M20,60 L15,75" stroke="#fff" strokeWidth="2" />
    </g>
  ),
  'arm-l-leaf': (
    <g transform="rotate(20 25 0)">
       <path d="M10,0 Q40,40 10,80 Q-20,40 10,0" fill="#66bb6a" stroke="#2e7d32" strokeWidth="2" />
       <path d="M10,0 L10,80" stroke="#2e7d32" />
       <path d="M10,20 L25,30 M10,40 L-5,50" stroke="#2e7d32" />
    </g>
  ),
  'arm-l-wand': (
    <g transform="rotate(10 25 0)">
       <rect x="10" y="0" width="10" height="40" fill="#333" />
       <circle cx="10" cy="40" r="6" fill="#e0e0e0" />
       <rect x="13" y="30" width="4" height="50" fill="#8d6e63" stroke="#5d4037" />
       <circle cx="10" cy="80" r="4" fill="#ffeb3b" className="animate-pulse" />
    </g>
  ),
  'arm-l-shield': (
    <g transform="rotate(15 25 0)">
        <rect x="5" y="0" width="10" height="40" fill="#5d4037" />
        <path d="M-5,30 L25,30 L25,60 Q10,80 -5,60 Z" fill="#90a4ae" stroke="#455a64" strokeWidth="2" />
        <path d="M10,35 L10,70" stroke="#455a64" strokeWidth="2" />
        <path d="M-5,45 L25,45" stroke="#455a64" strokeWidth="2" />
    </g>
  ),


  // --- ARMS (RIGHT - Viewers Left) ---
  'arm-r-robot': (
    <g transform="rotate(-20 25 0)">
       <rect x="5" y="0" width="20" height="50" rx="5" fill="#90a4ae" stroke="#546e7a" />
       <path d="M10,50 L0,70 M20,50 L30,70" stroke="#546e7a" strokeWidth="4" />
       <circle cx="15" cy="0" r="5" fill="#546e7a" />
    </g>
  ),
  'arm-r-muscle': (
     <g transform="rotate(-10 25 0)">
        <path d="M15,0 Q-5,20 5,40 Q15,50 25,40 Q35,20 15,0" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
        <circle cx="15" cy="40" r="12" fill="#8d6e63" stroke="#5d4037" />
     </g>
  ),
  'arm-r-tentacle': (
      <path d="M15,0 Q-5,20 25,40 Q5,60 35,80" fill="none" stroke="#ba68c8" strokeWidth="8" strokeLinecap="round" />
  ),
  'arm-r-hook': (
     <g transform="rotate(-15 25 0)">
        <rect x="10" y="0" width="10" height="40" fill="#3e2723" />
        <path d="M15,40 L15,50 Q35,70 15,80" fill="none" stroke="#bdbdbd" strokeWidth="4" />
        <circle cx="15" cy="40" r="8" fill="#ffc107" />
     </g>
  ),
  'arm-r-crab': (
     <g transform="rotate(-10 25 0)">
        <path d="M15,0 Q-5,30 5,50" fill="none" stroke="#f44336" strokeWidth="6" />
        <path d="M-5,50 Q-15,70 5,80 Q25,70 15,50 Z" fill="#f44336" />
        <path d="M-5,50 L5,70 M15,50 L5,70" stroke="#b71c1c" strokeWidth="1" />
     </g>
  ),
  'arm-r-zombie': (
     <g transform="rotate(-10 25 0)">
        <rect x="8" y="0" width="12" height="50" fill="#c8e6c9" stroke="#388e3c" />
        <rect x="8" y="0" width="12" height="15" fill="#5d4037" />
        <rect x="8" y="50" width="12" height="10" fill="#c8e6c9" />
        <path d="M8,60 L3,70 M13,60 L13,75 M20,60 L23,68" stroke="#388e3c" strokeWidth="2" />
     </g>
  ),
  'arm-r-wing': (
     <g transform="rotate(-20 25 0)">
        <path d="M5,0 Q-45,30 -15,80 Q15,40 5,0" fill="white" stroke="#e0e0e0" strokeWidth="2" />
        <path d="M-5,20 Q-25,40 -10,60" fill="none" stroke="#e0e0e0" />
     </g>
  ),
  'arm-r-wing-dragon': (
    <g transform="rotate(-20 25 0)">
       <path d="M5,0 Q-65,30 -5,90 L0,60 Q-15,40 5,0" fill="#d32f2f" stroke="#b71c1c" strokeWidth="2" />
       <path d="M-5,20 L-25,30 L-5,40" fill="none" stroke="#b71c1c" />
    </g>
  ),
  'arm-r-cactus': (
    <g transform="rotate(-10 25 0)">
       <path d="M15,0 Q5,40 25,80" fill="none" stroke="#4caf50" strokeWidth="15" strokeLinecap="round" />
       <path d="M20,20 L10,20 M23,40 L13,40 M25,60 L15,60" stroke="#1b5e20" strokeWidth="2" />
    </g>
  ),
  'arm-r-box': (
    <g>
       <rect x="-5" y="0" width="30" height="60" fill="#8d6e63" stroke="#5d4037" strokeWidth="2" />
       <line x1="-5" y1="30" x2="25" y2="30" stroke="#5d4037" />
    </g>
  ),
  'arm-r-slime': (
    <path d="M15,0 Q35,30 15,60 Q5,70 10,80" fill="none" stroke="#76ff03" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
  ),
  'arm-r-skeleton-fancy': (
    <g transform="rotate(-10 25 0)">
       <line x1="10" y1="0" x2="10" y2="60" stroke="#eee" strokeWidth="6" />
       <circle cx="10" cy="60" r="5" fill="#eee" />
       <circle cx="10" cy="30" r="8" fill="none" stroke="#ffd700" strokeWidth="3" />
    </g>
  ),
  'arm-r-drill': (
    <g transform="rotate(-20 25 0)">
       <rect x="5" y="0" width="15" height="40" fill="#607d8b" />
       <path d="M0,40 L25,40 L12.5,80 Z" fill="#cfd8dc" stroke="#607d8b" />
       <path d="M5,45 L20,45 M8,55 L18,55 M10,65 L15,65" stroke="#607d8b" />
    </g>
  ),
  'arm-r-baguette': (
    <g transform="rotate(-30 25 0)">
       <ellipse cx="15" cy="40" rx="8" ry="40" fill="#ffcc80" stroke="#e65100" />
       <path d="M10,20 L20,25 M10,40 L20,45 M10,60 L20,65" stroke="#e65100" strokeWidth="2" />
    </g>
  ),
  // --- NEW ARMS (RIGHT) ---
  'arm-r-wing-angel': (
    <g transform="rotate(-20 25 0)">
       <path d="M15,0 Q75,20 55,80 Q15,50 15,0" fill="#fff9c4" stroke="#fbc02d" strokeWidth="2" />
       <path d="M25,20 Q45,30 35,50" fill="none" stroke="#fbc02d" />
    </g>
  ),
  'arm-r-glove-boxing': (
    <g transform="rotate(-15 25 0)">
       <rect x="8" y="0" width="12" height="40" fill="#8d6e63" />
       <circle cx="13" cy="55" r="15" fill="#f44336" stroke="#b71c1c" strokeWidth="2" />
       <path d="M8,50 L18,50" stroke="#b71c1c" />
    </g>
  ),
  'arm-r-claw-monster': (
    <g transform="rotate(-10 25 0)">
       <path d="M10,0 L20,0 L23,40 L7,40 Z" fill="#4caf50" stroke="#2e7d32" />
       <path d="M5,40 L15,60 L25,40" fill="#4caf50" />
       <path d="M5,60 L10,75 M15,60 L15,75 M25,60 L20,75" stroke="#fff" strokeWidth="2" />
    </g>
  ),
  'arm-r-leaf': (
    <g transform="rotate(-20 25 0)">
       <path d="M15,0 Q45,40 15,80 Q-15,40 15,0" fill="#66bb6a" stroke="#2e7d32" strokeWidth="2" />
       <path d="M15,0 L15,80" stroke="#2e7d32" />
       <path d="M15,20 L30,30 M15,40 L0,50" stroke="#2e7d32" />
    </g>
  ),
  'arm-r-wand': (
    <g transform="rotate(-10 25 0)">
       <rect x="10" y="0" width="10" height="40" fill="#333" />
       <circle cx="15" cy="40" r="6" fill="#e0e0e0" />
       <rect x="13" y="30" width="4" height="50" fill="#8d6e63" stroke="#5d4037" />
       <circle cx="15" cy="80" r="4" fill="#ffeb3b" className="animate-pulse" />
    </g>
  ),
  'arm-r-shield': (
    <g transform="rotate(-15 25 0)">
        <rect x="10" y="0" width="10" height="40" fill="#5d4037" />
        <path d="M0,30 L30,30 L30,60 Q15,80 0,60 Z" fill="#90a4ae" stroke="#455a64" strokeWidth="2" />
        <path d="M15,35 L15,70" stroke="#455a64" strokeWidth="2" />
        <path d="M0,45 L30,45" stroke="#455a64" strokeWidth="2" />
    </g>
  ),

  // --- EXISTING LEGS ---
  'legs-wheels': (
    <g>
       <rect x="20" y="0" width="60" height="40" fill="#78909c" />
       <circle cx="30" cy="50" r="15" fill="#212121" stroke="#424242" strokeWidth="4" />
       <circle cx="70" cy="50" r="15" fill="#212121" stroke="#424242" strokeWidth="4" />
       <circle cx="30" cy="50" r="5" fill="#9e9e9e" />
       <circle cx="70" cy="50" r="5" fill="#9e9e9e" />
    </g>
  ),
  'legs-chicken': (
    <g>
       <path d="M30,0 L30,50 L20,60 M30,50 L30,60 M30,50 L40,60" stroke="#ffab00" strokeWidth="4" fill="none" />
       <path d="M70,0 L70,50 L60,60 M70,50 L70,60 M70,50 L80,60" stroke="#ffab00" strokeWidth="4" fill="none" />
    </g>
  ),
  'legs-rocket': (
    <g>
       <path d="M25,0 L75,0 L80,30 L20,30 Z" fill="#e0e0e0" stroke="#9e9e9e" />
       <path d="M30,30 L40,50 L60,50 L70,30" fill="#ff5722" />
       <path d="M35,50 Q50,70 65,50" fill="#ffeb3b" className="animate-pulse" />
    </g>
  ),
  'legs-mermaid': (
    <g>
       <path d="M25,0 Q15,30 50,60 Q85,30 75,0" fill="#4db6ac" stroke="#009688" strokeWidth="2" />
       <path d="M50,60 L30,80 L70,80 Z" fill="#80cbc4" stroke="#009688" />
       <path d="M30,20 Q50,30 70,20" fill="none" stroke="#009688" opacity="0.5" />
       <path d="M35,40 Q50,50 65,40" fill="none" stroke="#009688" opacity="0.5" />
    </g>
  ),
  'legs-spider': (
    <g>
       <path d="M20,0 Q10,10 0,30 M0,30 L10,40" stroke="#212121" strokeWidth="3" fill="none" />
       <path d="M30,0 Q20,20 10,40 M10,40 L20,50" stroke="#212121" strokeWidth="3" fill="none" />
       <path d="M80,0 Q90,10 100,30 M100,30 L90,40" stroke="#212121" strokeWidth="3" fill="none" />
       <path d="M70,0 Q80,20 90,40 M90,40 L80,50" stroke="#212121" strokeWidth="3" fill="none" />
    </g>
  ),
  'legs-peg': (
    <g>
       <rect x="25" y="0" width="20" height="40" fill="#5d4037" />
       <path d="M25,40 L45,40 L45,50 L30,50 Z" fill="black" />
       <rect x="65" y="0" width="10" height="50" fill="#8d6e63" />
       <circle cx="70" cy="55" r="3" fill="#5d4037" />
    </g>
  ),
  'legs-ufo': (
    <g>
       <ellipse cx="50" cy="10" rx="40" ry="10" fill="#9e9e9e" stroke="#616161" strokeWidth="2" />
       <path d="M30,15 L20,40 M50,18 L50,45 M70,15 L80,40" stroke="#757575" strokeWidth="3" />
       <path d="M10,50 Q50,60 90,50" fill="none" stroke="#00e676" strokeWidth="2" className="animate-pulse" />
    </g>
  ),
  'legs-skates': (
    <g>
       <rect x="25" y="0" width="20" height="40" fill="#1e88e5" />
       <rect x="55" y="0" width="20" height="40" fill="#1e88e5" />
       <rect x="23" y="40" width="24" height="10" fill="white" />
       <rect x="53" y="40" width="24" height="10" fill="white" />
       <circle cx="28" cy="55" r="4" fill="#424242" />
       <circle cx="42" cy="55" r="4" fill="#424242" />
       <circle cx="58" cy="55" r="4" fill="#424242" />
       <circle cx="72" cy="55" r="4" fill="#424242" />
    </g>
  ),
  'legs-ghost': (
    <g>
       <path d="M20,0 L20,40 Q50,60 80,40 L80,0" fill="white" opacity="0.8" />
    </g>
  ),
  'legs-ballerina': (
    <g>
       <rect x="25" y="0" width="15" height="40" fill="#f8bbd0" />
       <rect x="60" y="0" width="15" height="40" fill="#f8bbd0" />
       <path d="M20,0 L80,0 L90,15 L10,15 Z" fill="#f48fb1" opacity="0.8" />
       <path d="M25,40 L40,40 L40,50 Q25,55 25,40" fill="#e91e63" />
       <path d="M60,40 L75,40 L75,50 Q60,55 60,40" fill="#e91e63" />
    </g>
  ),
  'legs-jeans': (
    <g>
       <rect x="25" y="0" width="22" height="55" fill="#1565c0" />
       <rect x="53" y="0" width="22" height="55" fill="#1565c0" />
       <path d="M25,50 L47,50" stroke="#0d47a1" strokeWidth="2" />
       <path d="M53,50 L75,50" stroke="#0d47a1" strokeWidth="2" />
       <rect x="25" y="55" width="22" height="5" fill="#333" />
       <rect x="53" y="55" width="22" height="5" fill="#333" />
    </g>
  ),
  'legs-shorts': (
    <g>
       <rect x="25" y="0" width="22" height="25" fill="#558b2f" />
       <rect x="53" y="0" width="22" height="25" fill="#558b2f" />
       <rect x="28" y="25" width="16" height="30" fill="#d7ccc8" />
       <rect x="56" y="25" width="16" height="30" fill="#d7ccc8" />
       <rect x="25" y="55" width="22" height="5" fill="#5d4037" />
       <rect x="53" y="55" width="22" height="5" fill="#5d4037" />
    </g>
  ),
  'legs-springs': (
    <g>
       <path d="M35,0 L25,10 L35,20 L25,30 L35,40 L25,50" fill="none" stroke="#9e9e9e" strokeWidth="4" />
       <path d="M65,0 L75,10 L65,20 L75,30 L65,40 L75,50" fill="none" stroke="#9e9e9e" strokeWidth="4" />
       <rect x="20" y="50" width="20" height="10" fill="#607d8b" />
       <rect x="60" y="50" width="20" height="10" fill="#607d8b" />
    </g>
  ),
  // --- NEW LEGS ---
  'legs-boots-rain': (
    <g>
       <rect x="30" y="0" width="15" height="30" fill="#1976d2" />
       <rect x="55" y="0" width="15" height="30" fill="#1976d2" />
       <rect x="28" y="30" width="19" height="25" fill="#ffeb3b" />
       <rect x="53" y="30" width="19" height="25" fill="#ffeb3b" />
       <path d="M28,55 L47,55 L47,60 L25,60 Z" fill="#fbc02d" />
       <path d="M53,55 L72,55 L72,60 L50,60 Z" fill="#fbc02d" />
    </g>
  ),
  'legs-tail-mermaid-pink': (
    <g>
       <path d="M25,0 Q15,30 50,60 Q85,30 75,0" fill="#f48fb1" stroke="#e91e63" strokeWidth="2" />
       <path d="M50,60 L30,80 L70,80 Z" fill="#f8bbd0" stroke="#e91e63" />
       <path d="M30,20 Q50,30 70,20" fill="none" stroke="#e91e63" opacity="0.5" />
       <path d="M35,40 Q50,50 65,40" fill="none" stroke="#e91e63" opacity="0.5" />
    </g>
  ),
  'legs-hoverboard': (
    <g>
       <rect x="30" y="0" width="15" height="40" fill="#424242" />
       <rect x="55" y="0" width="15" height="40" fill="#424242" />
       <ellipse cx="50" cy="50" rx="45" ry="8" fill="#ec407a" stroke="#880e4f" strokeWidth="2" />
       <path d="M15,55 L85,55" stroke="#00e676" strokeWidth="2" className="animate-pulse" />
    </g>
  ),
  'legs-cloud': (
    <g>
       <circle cx="30" cy="20" r="15" fill="white" />
       <circle cx="50" cy="30" r="18" fill="white" />
       <circle cx="70" cy="20" r="15" fill="white" />
       <circle cx="40" cy="40" r="15" fill="white" />
       <circle cx="60" cy="40" r="15" fill="white" />
    </g>
  ),
  'legs-elf': (
    <g>
       <rect x="30" y="0" width="15" height="40" fill="#4caf50" />
       <rect x="55" y="0" width="15" height="40" fill="#4caf50" />
       <path d="M30,40 L45,40 L45,50 L25,45 Z" fill="#388e3c" />
       <path d="M55,40 L70,40 L70,50 L50,45 Z" fill="#388e3c" />
       <circle cx="25" cy="45" r="2" fill="#ffeb3b" />
       <circle cx="50" cy="45" r="2" fill="#ffeb3b" />
    </g>
  ),
  'legs-karate': (
    <g>
       <rect x="25" y="0" width="20" height="45" fill="white" stroke="#e0e0e0" />
       <rect x="55" y="0" width="20" height="45" fill="white" stroke="#e0e0e0" />
       <rect x="30" y="45" width="10" height="10" fill="#ffcc80" />
       <rect x="60" y="45" width="10" height="10" fill="#ffcc80" />
    </g>
  ),
};