
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Play, Pause, Square } from 'lucide-react';
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

  const [isPlaying, setIsPlaying] = useState(false);

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
          
          {/* Top Controls Container */}
          <div className="absolute top-4 left-0 right-0 flex justify-between items-start z-50 px-2 pointer-events-none">
              
              {/* Left Side: Play/Stop Button */}
              <div className="flex items-center gap-2 pointer-events-auto">
                  {!isPlaying ? (
                      <button 
                        onClick={() => setIsPlaying(true)} 
                        className="rounded-full p-3 flex items-center justify-center shadow-lg border-2 bg-[#3E1F07] border-[#5c2e0b] text-[#FFD700] hover:scale-105 transition-transform"
                      >
                          <Play size={24} fill="currentColor" className="ml-1"/>
                      </button>
                  ) : (
                      <button 
                        onClick={() => setIsPlaying(false)}
                        className="bg-red-500 hover:bg-red-600 text-white font-display font-bold text-sm py-2 px-4 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.4)] border-2 border-red-700 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
                      >
                          <Square size={16} fill="currentColor" /> STOP
                      </button>
                  )}
              </div>

              {/* Right Side: Close Button - Always visible */}
              <button 
                onClick={onClose} 
                className="pointer-events-auto text-white hover:text-gray-300 transition-colors bg-black/20 rounded-full p-2"
              >
                  <X size={24} />
              </button>
          </div>

          {/* Avatar Large View - Zoomed out */}
          <div className={`relative shrink-0 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'w-48 h-48 md:w-56 md:h-56 mb-8' : 'w-40 h-40 md:w-48 md:h-48 mb-10 mt-10'}`}>
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
                        isAnimating={isPlaying}
                        frameClass={equippedFrame}
                   />
              </div>
          </div>

          {/* Bottom UI Container */}
          <div className="w-full relative z-20">
              
              {/* Standard Info & Buttons (When NOT Playing) */}
              <div className={`w-full flex flex-col items-center transition-all duration-500 ease-in-out absolute bottom-0 left-0 right-0 ${isPlaying ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0 relative'}`}>
                  <div className="w-full max-w-xs space-y-3 pb-6 mt-48">
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
