
import React from 'react';
import { AVATAR_ASSETS } from './AvatarAssets';

interface AvatarCompositorProps {
  headUrl: string;
  hat?: string | null;
  body?: string | null;
  leftArm?: string | null;
  rightArm?: string | null;
  legs?: string | null;
  animationStyle?: string; // e.g. 'anim-breathe', 'anim-bounce'
  leftArmRotation?: number;
  rightArmRotation?: number;
  legsRotation?: number;
  hatRotation?: number;
  leftArmOffset?: { x: number, y: number };
  rightArmOffset?: { x: number, y: number };
  legsOffset?: { x: number, y: number };
  headOffset?: { x: number, y: number };
  bodyOffset?: { x: number, y: number };
  hatOffset?: { x: number, y: number };
  leftArmScale?: number;
  rightArmScale?: number;
  legsScale?: number;
  headScale?: number;
  bodyScale?: number;
  hatScale?: number;
  onPartClick?: (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat') => void;
  isAnimating?: boolean;
  className?: string;
  frameClass?: string; // Pass the frame border class here
  selectedArm?: 'leftArm' | 'rightArm' | null; // Which arm is currently selected
  onArmSelect?: (armType: 'leftArm' | 'rightArm' | null) => void; // Callback when arm is selected
  onArmRotate?: (armType: 'leftArm' | 'rightArm', angle: number) => void; // Callback to rotate arm
  isEditable?: boolean; // Enable/disable arm positioning (default: false)
  onEditRequest?: () => void; // Callback when arm is clicked in non-editable mode
}

const AvatarCompositor: React.FC<AvatarCompositorProps> = ({
  headUrl,
  hat,
  body,
  leftArm,
  rightArm,
  legs,
  animationStyle = 'anim-breathe', // Default
  leftArmRotation = 0,
  rightArmRotation = 0,
  legsRotation = 0,
  hatRotation = 0,
  leftArmOffset = { x: 0, y: 0 },
  rightArmOffset = { x: 0, y: 0 },
  legsOffset = { x: 0, y: 0 },
      headOffset = { x: 0, y: 0 },
      bodyOffset = { x: 0, y: 0 },
      hatOffset = { x: 0, y: 0 },
      leftArmScale = 1,
      rightArmScale = 1,
      legsScale = 1,
      headScale = 1,
      bodyScale = 1,
      hatScale = 1,
      onPartClick,
  isAnimating = false,
  className = "w-full h-full",
  frameClass = "border-[#8B4513]",
  selectedArm = null,
  onArmSelect,
  onArmRotate,
  isEditable = false,
  onEditRequest
}) => {
  // Card Styles for BODY PARTS only
  const cardClass = "bg-[#fdf6e3] border-[3px] border-[#8B4513] shadow-[0_2px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden";
  
  // Helper to check if a value is a file path (PNG) vs internal SVG asset
  const isFilePath = (value: string | null | undefined): boolean => {
    return !!value && value.startsWith('/');
  };
  
  // Check if it's an internal SVG asset (starts with 'head-' but NOT a file path starting with '/')
  const isInternalHead = headUrl && headUrl.startsWith('head-') && !headUrl.startsWith('/');
  const headAsset = isInternalHead ? AVATAR_ASSETS[headUrl] : null;

      const handlePartClick = (e: React.MouseEvent, part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat') => {
        if (onPartClick) {
          e.stopPropagation();
          onPartClick(part);
        }
      };

  // Adjusted offsets for narrower arm containers
  const DEFAULT_ARM_TOP = 15; 
  const DEFAULT_ARM_SIDE = -25; // Adjusted for 44% width
  const DEFAULT_LEGS_TOP = 85;
  const DEFAULT_LEGS_LEFT = 15;

  // Determine which animation class to apply to the body container
  let bodyAnimationClass = isAnimating ? animationStyle : '';
  
  // Special case: For 'anim-spin', we don't rotate the whole body container rigidly.
  if (isAnimating && animationStyle === 'anim-spin') {
      bodyAnimationClass = 'anim-breathe';
  }
  
  // Head animation logic
  let headAnimationClass = '';
  if (isAnimating) {
      if (animationStyle === 'anim-bounce') headAnimationClass = 'anim-bounce-head';
      else if (animationStyle === 'anim-spin') headAnimationClass = 'anim-rotate'; 
      else if (animationStyle === 'anim-wobble') headAnimationClass = 'anim-wobble';
      else if (animationStyle === 'anim-jiggle') headAnimationClass = 'anim-jiggle';
      else if (animationStyle === 'anim-sway') headAnimationClass = 'anim-sway';
      else if (animationStyle === 'anim-hop') headAnimationClass = 'anim-hop-head';
      else headAnimationClass = 'anim-bounce-subtle';
  }

  // Helper for limb classes (wings)
  const getLimbAnimClass = () => {
      if (isAnimating && animationStyle === 'anim-spin') return ' anim-rotate';
      return '';
  };

  // Helper for leg animation classes - uses squish animations anchored at top
  const getLegsAnimClass = () => {
      if (!isAnimating) return '';
      if (animationStyle === 'anim-spin') return 'anim-rotate';
      if (animationStyle === 'anim-bounce') return 'animate-legs-squish-fast';
      if (animationStyle === 'anim-hop') return 'animate-legs-squish-fast';
      if (animationStyle === 'anim-wobble') return 'animate-legs-wobble';
      if (animationStyle === 'anim-jiggle') return 'animate-legs-jiggle';
      if (animationStyle === 'anim-pulse') return 'animate-legs-squish';
      if (animationStyle === 'anim-heartbeat') return 'animate-legs-squish-fast';
      // Default gentle squish for breathe, float, sway, etc.
      return 'animate-legs-squish';
  };

  return (
    <div className={`relative ${className}`}>
      
      {/* 4. HEAD (Top Layer Z-50) */}
      <div 
        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate(${headOffset.x}%, ${headOffset.y}%) scale(${headScale})`
        }}
      >
          <div 
            className={`w-[72%] h-[72%] flex items-center justify-center ${headAnimationClass} ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : 'pointer-events-none'}`} // Sized to sit on neck
            style={{ animationDuration: animationStyle === 'anim-spin' ? '1s' : '2s' }}
            onClick={(e) => onPartClick && handlePartClick(e, 'head')}
          >
              {/* Head Container - Transparent, No Border/Background */}
              <div className={`w-full h-full flex items-center justify-center relative`}>
                  {headAsset ? (
                      // FUNNY HEAD (SVG)
                      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                          {headAsset}
                      </svg>
                  ) : (
                      // IMAGE HEAD - use object-contain for proper centering
                      <img 
                        src={headUrl || ''} 
                        alt="Head" 
                        className="w-full h-full object-contain object-center pointer-events-none" 
                        style={{ transform: 'scale(1.15)' }}
                      />
                  )}
              </div>
          </div>
      </div>

      {/* 5. HAT (Topmost Z-60) */}
      {hat && (isFilePath(hat) || AVATAR_ASSETS[hat]) && (
          <div 
            className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
            style={{
              transform: `translate(${hatOffset.x}%, ${hatOffset.y}%) scale(${hatScale})`
            }}
          >
             <div 
                className="absolute top-[-25%] left-1/2 w-[90%] h-[70%] origin-center"
                style={{ transform: `translateX(-50%) rotate(${hatRotation - 3}deg)` }}
             >
                 <div 
                    className={`absolute inset-0 flex items-center justify-center ${headAnimationClass} ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : 'pointer-events-none'}`}
                    style={{ animationDuration: animationStyle === 'anim-spin' ? '1s' : '2s', animationDelay: '0.1s' }}
                    onClick={(e) => onPartClick && handlePartClick(e, 'hat')}
                 >
                      {isFilePath(hat) ? (
                        <img src={hat} alt="Hat" className="w-full h-full object-contain object-center pointer-events-none filter drop-shadow-md" />
                      ) : (
                        <svg viewBox="0 0 100 80" className="w-full h-full p-1 overflow-visible filter drop-shadow-md">
                            {AVATAR_ASSETS[hat]}
                        </svg>
                      )}
                 </div>
             </div>
          </div>
      )}

      {/* LEGS - Separate from body so they don't inherit body animation */}
      {legs && (isFilePath(legs) || AVATAR_ASSETS[legs]) && (
          <div 
              className="absolute z-[25]"
              style={{ 
                  top: `calc(85% + ${bodyOffset.y}% + ${DEFAULT_LEGS_TOP + legsOffset.y}% * 0.9)`, 
                  left: `calc(50% + ${bodyOffset.x}% + (${DEFAULT_LEGS_LEFT + legsOffset.x}% - 50%) * 0.95)`, 
                  width: `calc(95% * 0.7 * ${bodyScale})`, 
                  height: `calc(90% * 0.7 * ${bodyScale})`,
                  transformOrigin: 'top center',
                  transform: `translate(-50%, 0) rotate(${legsRotation}deg) scale(${legsScale})`
              }}
          >
              {/* Inner wrapper for animation - anchored at top for squish effect */}
              <div
                  onClick={(e) => handlePartClick(e, 'legs')}
                  className={`w-full h-full flex items-center justify-center ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : ''} ${getLegsAnimClass()}`}
                  style={{ transformOrigin: 'top center' }}
              >
                  {isFilePath(legs) ? (
                    <img src={legs} alt="Feet" className="w-full h-full object-contain object-center pointer-events-none" />
                  ) : (
                    <svg viewBox="0 0 100 60" className="w-full h-full overflow-visible">
                        {AVATAR_ASSETS[legs]}
                    </svg>
                  )}
              </div>
          </div>
      )}

      {/* BODY GROUP - Outer wrapper for position/scale, inner wrapper for animation */}
      {body && (isFilePath(body) || AVATAR_ASSETS[body]) && (
          <div
             className="absolute z-20"
             style={{
                top: `calc(85% + ${bodyOffset.y}%)`, 
                left: `calc(50% + ${bodyOffset.x}%)`, 
                width: '95%', 
                height: '90%',
                transform: `translate(-50%, 0) scale(${bodyScale})` 
             }}
          >
          {/* Inner animation wrapper */}
          <div
             className={`w-full h-full flex items-center justify-center ${bodyAnimationClass} ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : 'pointer-events-none'}`}
             onClick={(e) => onPartClick && handlePartClick(e, 'body')}
          >
               {/* MAIN BODY */}
               <div 
                  onClick={(e) => handlePartClick(e, 'body')}
                  className={`absolute z-20 flex items-center justify-center ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : ''}`}
                  style={{ width: '100%', height: '100%' }}
                >
                   {isFilePath(body) ? (
                     <img src={body} alt="Body" className="w-full h-full object-contain object-center pointer-events-none" style={{ transform: 'scale(1.3)' }} />
                   ) : (
                     <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible pointer-events-none" style={{ transform: 'scale(1.3)' }}>
                        {AVATAR_ASSETS[body]}
                     </svg>
                   )}
               </div>

               {/* 3. LEFT WING/ARM (Viewer's Left) (Z-15 - behind body) */}
               {leftArm && (isFilePath(leftArm) || AVATAR_ASSETS[leftArm]) && (
                  <div 
                    className="absolute z-[15]"
                    style={{ 
                        top: `${DEFAULT_ARM_TOP + leftArmOffset.y}%`, 
                        left: `${DEFAULT_ARM_SIDE + leftArmOffset.x}%`,
                        width: '44%',
                        height: '80%',
                        transformOrigin: '50% 50%', 
                        transform: `rotate(${leftArmRotation}deg) scale(${leftArmScale})`
                    }}
                  >
                      <div
                        onClick={(e) => handlePartClick(e, 'leftArm')}
                        className={`w-full h-full transition-colors duration-300 flex items-center justify-center ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : ''} ${isAnimating && animationStyle !== 'anim-spin' ? 'animate-arm-sway-left' : ''} ${getLimbAnimClass()}`}
                        style={{ transformOrigin: '50% 50%' }} 
                      >
                           {isFilePath(leftArm) ? (
                             <img src={leftArm} alt="Left Wing" className="w-full h-full object-contain object-center pointer-events-none" />
                           ) : (
                             <svg viewBox="0 0 50 100" className="w-full h-full overflow-visible">
                                {AVATAR_ASSETS[leftArm]}
                            </svg>
                           )}
                      </div>
                  </div>
               )}

               {/* 4. RIGHT WING/ARM (Viewer's Right) (Z-15 - behind body) */}
               {rightArm && (isFilePath(rightArm) || AVATAR_ASSETS[rightArm]) && (
                  <div 
                    className="absolute z-[15]"
                    style={{ 
                        top: `${DEFAULT_ARM_TOP + rightArmOffset.y}%`, 
                        right: `${DEFAULT_ARM_SIDE - rightArmOffset.x}%`,
                        width: '44%',
                        height: '80%',
                        transformOrigin: '50% 50%',
                        transform: `rotate(${rightArmRotation}deg) scale(${rightArmScale})`
                    }}
                  >
                      <div 
                        onClick={(e) => handlePartClick(e, 'rightArm')}
                        className={`w-full h-full transition-colors duration-300 flex items-center justify-center ${onPartClick ? 'cursor-pointer hover:brightness-110 active:scale-95 pointer-events-auto' : ''} ${isAnimating && animationStyle !== 'anim-spin' ? 'animate-arm-sway-right' : ''} ${getLimbAnimClass()}`}
                        style={{ transformOrigin: '50% 50%' }} 
                      >
                           {isFilePath(rightArm) ? (
                             <img src={rightArm} alt="Right Wing" className="w-full h-full object-contain object-center pointer-events-none" />
                           ) : (
                             <svg viewBox="0 0 50 100" className="w-full h-full overflow-visible">
                                {AVATAR_ASSETS[rightArm]}
                            </svg>
                           )}
                      </div>
                  </div>
               )}
          </div>
          </div>
      )}
      <style>{`
        /* --- ARM SWAY (Standard for all) --- */
        @keyframes armSwayLeft {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes armSwayRight {
          0%, 100% { transform: rotate(5deg); }
          50% { transform: rotate(25deg); }
        }
        .animate-arm-sway-left {
           animation: armSwayLeft 2s ease-in-out infinite;
        }
        .animate-arm-sway-right {
           animation: armSwayRight 2s ease-in-out infinite;
        }

        /* --- LEGS SQUISH ANIMATIONS (anchored at top, no vertical movement) --- */
        @keyframes legsSquish {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50% { transform: scaleY(0.92) scaleX(1.04); }
        }
        .animate-legs-squish {
           animation: legsSquish 2s ease-in-out infinite;
           transform-origin: top center;
        }

        @keyframes legsSquishFast {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50% { transform: scaleY(0.85) scaleX(1.08); }
        }
        .animate-legs-squish-fast {
           animation: legsSquishFast 0.6s ease-in-out infinite;
           transform-origin: top center;
        }

        @keyframes legsWobble {
          0%, 100% { transform: scaleY(1) rotate(0deg); }
          25% { transform: scaleY(0.95) rotate(-3deg); }
          75% { transform: scaleY(0.95) rotate(3deg); }
        }
        .animate-legs-wobble {
           animation: legsWobble 1s ease-in-out infinite;
           transform-origin: top center;
        }

        @keyframes legsJiggle {
          0% { transform: scaleY(1) rotate(0deg); }
          25% { transform: scaleY(0.97) rotate(2deg); }
          50% { transform: scaleY(1) rotate(-2deg); }
          75% { transform: scaleY(0.97) rotate(1deg); }
          100% { transform: scaleY(1) rotate(0deg); }
        }
        .animate-legs-jiggle {
           animation: legsJiggle 0.4s ease-in-out infinite;
           transform-origin: top center;
        }

        /* --- ANIM: BREATHE (Default) --- */
        /* Note: Scale is handled by outer wrapper, animations only do position/rotation */
        @keyframes animBreathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .anim-breathe {
           animation: animBreathe 3s ease-in-out infinite;
        }

        /* --- ANIM: BOUNCE (Energetic) --- */
        @keyframes animBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .anim-bounce {
           animation: animBounce 0.6s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
        }
        @keyframes headBounce {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-5px); }
        }
        .anim-bounce-head {
           animation: headBounce 0.6s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
        }

        /* --- ANIM: FLOAT (Ghostly/Space) --- */
        @keyframes animFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .anim-float {
           animation: animFloat 2.5s ease-in-out infinite;
        }

        /* --- ANIM: WIGGLE (Silly) --- */
        @keyframes animWiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .anim-wiggle {
           animation: animWiggle 0.4s ease-in-out infinite;
        }

        /* --- ANIM: PULSE (Power) --- */
        @keyframes animPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .anim-pulse {
           animation: animPulse 1s ease-in-out infinite;
        }

        /* --- NEW ANIMATIONS --- */

        /* SPIN (Old body container spin - maintained for ref, but replaced for anim-spin) */
        @keyframes animSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        /* ROTATE (Pure rotation for limbs/head) */
        @keyframes animRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .anim-rotate {
           animation: animRotate 1s linear infinite;
        }

        /* SHAKE */
        @keyframes animShake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .anim-shake {
           animation: animShake 0.5s ease-in-out infinite;
        }

        /* WOBBLE */
        @keyframes animWobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        .anim-wobble {
           animation: animWobble 1s ease-in-out infinite;
        }

        /* HEARTBEAT */
        @keyframes animHeartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.15); }
          28% { transform: scale(1); }
          42% { transform: scale(1.15); }
          70% { transform: scale(1); }
        }
        .anim-heartbeat {
           animation: animHeartbeat 1.3s ease-in-out infinite;
        }

        /* JIGGLE */
        @keyframes animJiggle {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(3deg); }
          50% { transform: rotate(-3deg); }
          75% { transform: rotate(1deg); }
          100% { transform: rotate(0deg); }
        }
        .anim-jiggle {
           animation: animJiggle 0.4s ease-in-out infinite;
        }

        /* SWAY */
        @keyframes animSway {
          0%, 100% { transform: translateX(-5px) rotate(-5deg); }
          50% { transform: translateX(5px) rotate(5deg); }
        }
        .anim-sway {
           animation: animSway 3s ease-in-out infinite;
        }

        /* HOP */
        @keyframes animHop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .anim-hop {
           animation: animHop 0.8s cubic-bezier(0.25, 1.5, 0.5, 1) infinite;
        }
        @keyframes animHopHead {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .anim-hop-head {
           animation: animHopHead 0.8s cubic-bezier(0.25, 1.5, 0.5, 1) infinite;
        }

        /* --- HEAD DEFAULT BOUNCE --- */
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .anim-bounce-subtle {
           animation: bounceSubtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default AvatarCompositor;