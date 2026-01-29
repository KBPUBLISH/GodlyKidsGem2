
import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import AvatarCompositor from '../avatar/AvatarCompositor';
import { useUser } from '../../context/UserContext';
import WoodButton from '../ui/WoodButton';

interface AvatarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

const AvatarDetailModal: React.FC<AvatarDetailModalProps> = ({ isOpen, onClose, onEdit }) => {
  const navigate = useNavigate();
  const { 
      equippedAvatar, equippedFrame, equippedHat, equippedBody, 
      equippedLeftArm, equippedRightArm, equippedLegs,
      equippedAnimation, // Use configured animation
      equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation,
      leftArmOffset, rightArmOffset, legsOffset,
      headOffset, bodyOffset, hatOffset,
      leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale
  } = useUser();

  if (!isOpen) return null;

  const handleGoToProfiles = () => {
    onClose();
    navigate('/profile');
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-center px-4 pointer-events-auto overflow-hidden">
      {/* Backdrop with Island Background */}
      <div 
        className="fixed inset-0 bg-cover bg-center animate-in fade-in duration-300"
        style={{ backgroundImage: `url('/assets/images/islandbackground.jpg')` }}
        onClick={onClose}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-sm flex flex-col items-center justify-center min-h-full py-10 z-10">
          
          {/* Close Button - Top Right */}
          <div className="absolute top-4 right-2 z-50">
              <button 
                onClick={onClose} 
                className="text-white hover:text-gray-300 transition-colors bg-black/20 rounded-full p-2"
              >
                  <X size={24} />
              </button>
          </div>

          {/* Avatar Large View - Always animating */}
          <div className="relative shrink-0 w-48 h-48 md:w-56 md:h-56 mb-8">
              
              {/* Speech bubble when no body equipped */}
              {!equippedBody && (
                <button
                  onClick={() => { onClose(); onEdit(); }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-4 py-2 shadow-lg border-2 border-[#FFD700] whitespace-nowrap animate-bounce z-20"
                  style={{ animationDuration: '2s' }}
                >
                  <p className="text-[#5D4037] text-sm font-bold text-center leading-tight">
                    "I sure wish I had a body!" 🥺
                  </p>
                  <p className="text-[#8B5A2B] text-xs text-center mt-1 opacity-70">Tap to customize!</p>
                  {/* Speech bubble tail - pointing down toward avatar */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
                  <div className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[9px] border-t-[#FFD700]"></div>
                </button>
              )}
              
              <div className="w-full h-full relative z-10 overflow-visible">
                   <AvatarCompositor 
                        headUrl={equippedAvatar}
                        hat={equippedHat}
                        body={equippedBody}
                        leftArm={equippedLeftArm}
                        rightArm={equippedRightArm}
                        legs={equippedLegs}
                        animationStyle={equippedAnimation}
                        leftArmRotation={equippedLeftArmRotation}
                        rightArmRotation={equippedRightArmRotation}
                        legsRotation={equippedLegsRotation}
                        leftArmOffset={leftArmOffset}
                        rightArmOffset={rightArmOffset}
                        legsOffset={legsOffset}
                        headOffset={headOffset}
                        bodyOffset={bodyOffset}
                        hatOffset={hatOffset}
                        leftArmScale={leftArmScale}
                        rightArmScale={rightArmScale}
                        legsScale={legsScale}
                        headScale={headScale}
                        bodyScale={bodyScale}
                        hatScale={hatScale}
                        isAnimating={true}
                        frameClass={equippedFrame}
                   />
              </div>
          </div>

          {/* Bottom UI Container */}
          <div className="w-full relative z-20">
              <div className="w-full flex flex-col items-center">
                  <div className="w-full max-w-xs space-y-3 pb-6 mt-8">
                      <WoodButton variant="gold" onClick={() => { onClose(); onEdit(); }} className="w-full py-4 text-xl shadow-xl">
                        BUILDER SHOP
                      </WoodButton>
                      
                      <WoodButton variant="light" onClick={handleGoToProfiles} className="w-full py-3 text-lg shadow-lg border-b-4">
                        GO TO PROFILES
                      </WoodButton>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AvatarDetailModal;
