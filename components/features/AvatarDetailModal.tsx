
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
      leftArmOffset, rightArmOffset, legsOffset
  } = useUser();

  const [isPlaying, setIsPlaying] = useState(false);

  if (!isOpen) return null;

  const handleGoToProfiles = () => {
    onClose();
    navigate('/profile');
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-center px-4 pointer-events-auto overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      ></div>

      {/* Main Container */}
      <div className="relative w-full max-w-sm flex flex-col items-center justify-center min-h-full py-10 z-10">
          
          {/* Top Controls Container */}
          <div className="absolute top-4 left-0 right-0 flex justify-between items-start z-50 px-2 pointer-events-none">
              
              {/* Play Animation Toggle (Top Left) - Hide when playing to avoid overlap */}
              <div className={`pointer-events-auto transition-all duration-500 ${isPlaying ? 'opacity-0 -translate-x-10' : 'opacity-100 translate-x-0'}`}>
                  <button 
                    onClick={() => setIsPlaying(true)} 
                    className="rounded-full p-3 flex items-center justify-center shadow-lg border-2 bg-[#3E1F07] border-[#5c2e0b] text-[#FFD700] hover:scale-105 transition-transform"
                  >
                      <Play size={24} fill="currentColor" className="ml-1"/>
                  </button>
              </div>

              {/* Close Button - Always visible */}
              <button 
                onClick={onClose} 
                className="pointer-events-auto text-white hover:text-gray-300 transition-colors bg-black/20 rounded-full p-2"
              >
                  <X size={24} />
              </button>
          </div>

          {/* Avatar Large View - Reduced zoom when playing to prevent cropping */}
          <div className={`relative shrink-0 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'w-64 h-64 md:w-72 md:h-72 mb-8' : 'w-48 h-48 md:w-60 md:h-60 mb-10 mt-10'}`}>
              {/* Glow */}
              <div className={`absolute inset-0 bg-[#FFD700] rounded-full blur-3xl animate-pulse transition-opacity duration-500 ${isPlaying ? 'opacity-30' : 'opacity-10'}`}></div>
              
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
                        isAnimating={isPlaying}
                        frameClass={equippedFrame}
                   />
              </div>
          </div>

          {/* Bottom UI Container */}
          <div className="w-full relative z-20">
              
              {/* Standard Info & Buttons (When NOT Playing) */}
              <div className={`w-full flex flex-col items-center transition-all duration-500 ease-in-out absolute bottom-0 left-0 right-0 ${isPlaying ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0 relative'}`}>
                  <div className="text-center relative bg-black/40 p-4 rounded-2xl backdrop-blur-sm w-full mb-8 border border-white/5 shadow-xl">
                    <h2 className="font-display font-extrabold text-white text-3xl mb-1 text-shadow-lg tracking-wide">YOUR AVATAR</h2>
                    <p className="text-white/70 font-bold">Ready for adventure!</p>
                  </div>

                  <div className="w-full max-w-xs space-y-3 pb-10">
                      <WoodButton variant="gold" onClick={() => { onClose(); onEdit(); }} className="w-full py-4 text-xl shadow-xl">
                        BUILDER SHOP
                      </WoodButton>
                      
                      <WoodButton variant="light" onClick={handleGoToProfiles} className="w-full py-3 text-lg shadow-lg border-b-4">
                        GO TO PROFILES
                      </WoodButton>
                  </div>
              </div>

              {/* Stop Button (When Playing) - Replaces other UI */}
              <div className={`w-full flex justify-center transition-all duration-500 ease-in-out absolute bottom-0 left-0 right-0 ${!isPlaying ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0 relative'}`}>
                   <button 
                      onClick={() => setIsPlaying(false)}
                      className="bg-red-500 hover:bg-red-600 text-white font-display font-bold text-lg py-3 px-8 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.4)] border-4 border-red-700 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 mb-10"
                   >
                      <Square size={20} fill="currentColor" /> STOP
                   </button>
              </div>

          </div>

      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AvatarDetailModal;
