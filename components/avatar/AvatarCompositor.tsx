
import React from 'react';
import { AVATAR_ASSETS } from './AvatarAssets';

interface AvatarCompositorProps {
  headUrl: string;
  hat?: string | null;
  body?: string | null;
  leftArm?: string | null;
  rightArm?: string | null;
  legs?: string | null;
  className?: string;
}

const AvatarCompositor: React.FC<AvatarCompositorProps> = ({
  headUrl,
  hat,
  body,
  leftArm,
  rightArm,
  legs,
  className = "w-full h-full"
}) => {
  // Card Styles - The "Badge/Button" look
  // Note: overflow-hidden is applied to the card itself to mask the SVG asset properly
  const cardClass = "absolute bg-[#fdf6e3] border-[3px] border-[#8B4513] shadow-[0_3px_0_rgba(0,0,0,0.2)] flex items-center justify-center overflow-hidden";
  
  return (
    <div className={`relative ${className}`}>
      {/* 
         LAYOUT CONCEPT: "Connected Modules"
         The Head is the central hub.
         The Body connects to the Head.
         Limbs connect to the Body.
      */}

      {/* 1. HEAD (Anchor) */}
      <div className="absolute inset-0 z-30 rounded-full overflow-hidden border-[4px] border-[#eecaa0] bg-[#f3e5ab] shadow-inner">
          <img src={headUrl} alt="Head" className="w-full h-full object-cover" />
      </div>

      {/* 2. HAT (Connects to Head) */}
      {hat && AVATAR_ASSETS[hat] && (
          <div 
            className={`${cardClass} z-40 rounded-2xl`}
            style={{ 
                top: '-55%', left: '10%', width: '80%', height: '70%',
                transform: 'rotate(-5deg)' 
            }}
          >
               <svg viewBox="0 0 100 80" className="w-full h-full p-1 overflow-visible">
                  {AVATAR_ASSETS[hat]}
               </svg>
          </div>
      )}

      {/* 3. BODY CONTAINER (Connects to Head) 
          This container holds the Body Card AND the attached Limbs.
          If Body is missing, Limbs are not rendered.
      */}
      {body && AVATAR_ASSETS[body] && (
          <div
             className="absolute z-20 flex items-center justify-center"
             style={{
                // Positioned relative to the Head container
                top: '80%', left: '50%', width: '70%', height: '70%',
                transform: 'translate(-50%, 0)' 
             }}
          >
               {/* 3a. LEGS (Behind Body) */}
               {legs && AVATAR_ASSETS[legs] && (
                    <div 
                        className={`${cardClass} z-0 rounded-xl bg-[#fff8e1]`}
                        style={{ 
                            top: '85%', left: '10%', width: '80%', height: '80%',
                            transform: 'rotate(-2deg)'
                        }}
                    >
                        <svg viewBox="0 0 100 60" className="w-full h-full p-1 overflow-visible">
                            {AVATAR_ASSETS[legs]}
                        </svg>
                    </div>
                )}

               {/* 3b. RIGHT ARM (Viewer Left) */}
               {rightArm && AVATAR_ASSETS[rightArm] && (
                  <div 
                    className={`${cardClass} z-20 rounded-xl`}
                    style={{ 
                        top: '10%', left: '-45%', width: '60%', height: '80%',
                        transform: 'rotate(15deg)'
                    }}
                  >
                       <svg viewBox="0 0 50 100" className="w-full h-full p-1 overflow-visible">
                          {AVATAR_ASSETS[rightArm]}
                      </svg>
                  </div>
               )}

               {/* 3c. LEFT ARM (Viewer Right) */}
               {leftArm && AVATAR_ASSETS[leftArm] && (
                  <div 
                    className={`${cardClass} z-20 rounded-xl`}
                    style={{ 
                        top: '10%', right: '-45%', width: '60%', height: '80%',
                        transform: 'rotate(-15deg)'
                    }}
                  >
                       <svg viewBox="0 0 50 100" className="w-full h-full p-1 overflow-visible">
                          {AVATAR_ASSETS[leftArm]}
                      </svg>
                  </div>
               )}

               {/* 3d. THE BODY CARD ITSELF */}
               <div className={`${cardClass} z-10 rounded-2xl w-full h-full`}>
                   <svg viewBox="0 0 100 80" className="w-full h-full p-1 overflow-visible">
                      {AVATAR_ASSETS[body]}
                   </svg>
               </div>
          </div>
      )}

    </div>
  );
};

export default AvatarCompositor;
