
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { X } from 'lucide-react';
import { useUser } from '../../context/UserContext';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const [step, setStep] = useState<'closed' | 'opening' | 'opened'>('closed');
  const [shake, setShake] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('closed');
      setIsClaiming(false);
    }
  }, [isOpen]);

  const handleChestClick = () => {
    if (step === 'closed') {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setStep('opening');
        setTimeout(() => setStep('opened'), 600);
      }, 500);
    }
  };

  const handleClaim = () => {
    setIsClaiming(true);
    addCoins(50); // Add 50 real coins
    // Wait for animation to finish before closing
    setTimeout(() => {
        onClose();
    }, 1000);
  };

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={step === 'opened' && !isClaiming ? onClose : undefined}
      ></div>

      {/* FLYING COINS ANIMATION OVERLAY */}
      {isClaiming && (
        <div className="fixed inset-0 pointer-events-none z-[150]">
             {[...Array(12)].map((_, i) => (
                 <div 
                    key={i}
                    className="absolute w-8 h-8 bg-[#FFD700] border-2 border-[#B8860B] rounded-full shadow-xl flex items-center justify-center text-[#B8860B] font-bold text-xs z-[150]"
                    style={{
                        animation: `flyCoin 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                        animationDelay: `${i * 0.05}s`,
                        '--scatter-x': `${(Math.random() - 0.5) * 150}px` as any,
                        '--scatter-y': `${(Math.random() - 0.5) * 150}px` as any,
                    } as React.CSSProperties}
                 >
                    $
                 </div>
             ))}
        </div>
      )}

      {/* Main Card */}
      <div className={`
         relative w-full max-w-sm bg-[#3E1F07] rounded-3xl p-1 border-4 border-[#8B4513] shadow-2xl 
         transition-all duration-500 transform
         ${step === 'opening' ? 'scale-105' : 'scale-100'}
         ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
          
          {/* Wood Texture Background */}
          <div className="absolute inset-0 rounded-[20px] bg-[#8B4513] overflow-hidden">
              <div className="absolute inset-0 opacity-20" 
                   style={{ backgroundImage: 'repeating-linear-gradient(45deg, #3E1F07 0px, #3E1F07 20px, #5c2e0b 20px, #5c2e0b 40px)' }}>
              </div>
              {/* Light Burst Effect (Behind Chest) */}
              <div className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] 
                  bg-gradient-to-r from-transparent via-[#FFD700]/30 to-transparent
                  transition-opacity duration-1000
                  ${step === 'opened' ? 'opacity-100 animate-[spin_10s_linear_infinite]' : 'opacity-0'}
              `} style={{clipPath: 'polygon(50% 50%, 0 0, 100% 0, 50% 50%, 100% 100%, 0 100%)'}}></div>
               <div className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] 
                  bg-gradient-to-b from-transparent via-[#FFD700]/30 to-transparent
                  transition-opacity duration-1000 delay-100
                  ${step === 'opened' ? 'opacity-100 animate-[spin_15s_linear_infinite_reverse]' : 'opacity-0'}
              `} style={{clipPath: 'polygon(50% 50%, 0 0, 100% 0, 50% 50%, 100% 100%, 0 100%)'}}></div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-[#eecaa0] rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center pt-10 pb-8 px-6 text-center min-h-[400px]">
              
              <h2 className="font-display font-extrabold text-2xl text-[#FFD700] drop-shadow-md tracking-wide mb-2 uppercase">
                {step === 'opened' ? 'Daily Treasure!' : 'Daily Gift'}
              </h2>
              
              <p className="text-[#eecaa0] font-bold text-sm mb-8 opacity-90">
                 {step === 'opened' ? 'You found wisdom & gold!' : 'Tap the chest to open'}
              </p>

              {/* CHEST GRAPHIC */}
              <div 
                onClick={handleChestClick}
                className={`
                   relative w-48 h-48 cursor-pointer transition-transform duration-100
                   ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}
                   ${step === 'opened' ? 'mt-4 mb-8' : 'mt-10'}
                `}
              >
                  {step !== 'opened' ? (
                    // CLOSED CHEST SVG
                    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl filter">
                         {/* Bottom Box */}
                         <path d="M20,80 L180,80 L170,160 Q100,175 30,160 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                         <path d="M20,80 L180,80 L180,140 L20,140 Z" fill="url(#woodGrain)" opacity="0.5" />
                         
                         {/* Lid (Closed) */}
                         <path d="M15,80 Q100,30 185,80" fill="#A0522D" stroke="#3E1F07" strokeWidth="3" />
                         <path d="M15,80 Q100,30 185,80" fill="url(#woodGrain)" opacity="0.4" />
                         
                         {/* Gold Trim */}
                         <path d="M90,75 L110,75 L110,95 Q100,100 90,95 Z" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
                         <path d="M20,80 L180,80" fill="none" stroke="#FFD700" strokeWidth="4" />
                         
                         {/* Lock */}
                         <circle cx="100" cy="90" r="8" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />
                         
                         {/* Pulsing Glow */}
                         <circle cx="100" cy="100" r="60" fill="none" stroke="#FFD700" strokeWidth="2" className="animate-ping opacity-20" />
                    </svg>
                  ) : (
                    // OPENED CHEST SVG
                    <div className="relative animate-[popChest_0.6s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                            {/* Back Inside */}
                            <path d="M30,80 L170,80 L165,130 L35,130 Z" fill="#2a1201" />
                            
                            {/* Lid (Open) */}
                            <path d="M20,80 L180,80 L160,20 Q100,10 40,20 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                            <path d="M20,80 L180,80" stroke="#FFD700" strokeWidth="3" />
                            
                            {/* Bottom Box */}
                            <path d="M20,80 L180,80 L175,150 Q100,165 25,150 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                            
                            {/* Gold Coins Overflowing */}
                            <circle cx="60" cy="75" r="10" fill="#FFD700" stroke="#B8860B" />
                            <circle cx="80" cy="70" r="12" fill="#FFD700" stroke="#B8860B" />
                            <circle cx="100" cy="75" r="11" fill="#FFD700" stroke="#B8860B" />
                            <circle cx="120" cy="70" r="10" fill="#FFD700" stroke="#B8860B" />
                            <circle cx="140" cy="78" r="9" fill="#FFD700" stroke="#B8860B" />
                            <circle cx="90" cy="60" r="10" fill="#FFD700" stroke="#B8860B" />
                            
                            {/* Sparkles */}
                            <g className="animate-pulse">
                                <path d="M50,40 L55,30 L60,40 L70,45 L60,50 L55,60 L50,50 L40,45 Z" fill="white" />
                                <path d="M150,50 L153,45 L156,50 L161,53 L156,56 L153,61 L150,56 L145,53 Z" fill="white" />
                            </g>
                        </svg>
                    </div>
                  )}
              </div>

              {/* REWARD CONTENT */}
              {step === 'opened' && !isClaiming && (
                  <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100 flex flex-col items-center">
                      
                      {/* Verse Card */}
                      <div className="bg-[#f3e5ab] text-[#5c2e0b] p-4 rounded-lg shadow-inner border-2 border-[#d4b483] w-full mb-4 relative">
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#8B4513] text-[#FFD700] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#FFD700]">VERSE OF THE DAY</div>
                          <p className="font-display font-bold text-lg italic leading-snug">
                            "Be strong and courageous. Do not be afraid; do not be discouraged."
                          </p>
                          <p className="text-xs font-bold text-right mt-2 opacity-70">— Joshua 1:9</p>
                      </div>

                      {/* Coin Reward */}
                      <div className="flex items-center gap-2 mb-6 bg-black/30 px-4 py-2 rounded-full border border-[#FFD700]/50">
                          <div className="w-6 h-6 rounded-full bg-[#FFD700] border border-[#B8860B] flex items-center justify-center shadow-sm">
                              <span className="text-[#B8860B] font-bold text-xs">$</span>
                          </div>
                          <span className="text-white font-bold font-display text-xl">+50 Coins</span>
                      </div>

                      <WoodButton onClick={handleClaim} fullWidth className="py-3 text-lg shadow-xl">
                          CLAIM REWARD
                      </WoodButton>
                  </div>
              )}

          </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes popChest {
          0% { transform: scale(0.8) translateY(10px); }
          50% { transform: scale(1.1) translateY(-10px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes flyCoin {
          0% {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          30% {
            transform: translate(var(--scatter-x), var(--scatter-y)) scale(1.2);
            opacity: 1;
          }
          100% {
            top: 4%;
            left: 85%; /* Approximate Header Coin Location */
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );

  // Use Portal to render at document.body level to ensure it covers everything
  return createPortal(content, document.body);
};

export default DailyRewardModal;
