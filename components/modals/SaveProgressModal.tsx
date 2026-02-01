import React from 'react';
import { X, BookOpen, Music, Sparkles, Save } from 'lucide-react';

// Ship's Wheel SVG Component - decorative background
const ShipsWheel: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 400 400" className={className}>
    <defs>
      <linearGradient id="swWoodGrain" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#8B5A2B" />
        <stop offset="50%" stopColor="#A56B3A" />
        <stop offset="100%" stopColor="#6B4423" />
      </linearGradient>
      <radialGradient id="swRimDepth" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#D4975A" />
        <stop offset="50%" stopColor="#A56B3A" />
        <stop offset="100%" stopColor="#5C3D1E" />
      </radialGradient>
      <linearGradient id="swSpokeWood" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#5C3D1E" />
        <stop offset="50%" stopColor="#A56B3A" />
        <stop offset="100%" stopColor="#5C3D1E" />
      </linearGradient>
      <radialGradient id="swHubWood" cx="30%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#C4884A" />
        <stop offset="50%" stopColor="#8B5A2B" />
        <stop offset="100%" stopColor="#4A2810" />
      </radialGradient>
      <radialGradient id="swGoldCenter" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FFE55C" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </radialGradient>
    </defs>
    
    <g transform="translate(200, 200)">
      {/* Handles */}
      {[...Array(8)].map((_, i) => (
        <g key={`handle-${i}`} transform={`rotate(${i * 45})`}>
          <path
            d="M-6,-130 L-6,-145 C-8,-147 -12,-151 -12,-161 C-12,-172 -5,-177 0,-177 C5,-177 12,-172 12,-161 C12,-151 8,-147 6,-145 L6,-130 Z"
            fill="url(#swSpokeWood)"
            stroke="#3d1e03"
            strokeWidth="1.5"
          />
        </g>
      ))}

      {/* Spokes */}
      {[...Array(8)].map((_, i) => (
        <g key={`spoke-${i}`} transform={`rotate(${i * 45})`}>
          <path
            d="M-6,-42 L-5,-128 L5,-128 L6,-42 Z"
            fill="url(#swSpokeWood)"
            stroke="#3d1e03"
            strokeWidth="1"
          />
        </g>
      ))}

      {/* Outer Rim */}
      <circle r="125" fill="none" stroke="url(#swRimDepth)" strokeWidth="26" />
      <circle r="136" fill="none" stroke="#5C3D1E" strokeWidth="1.5" />
      <circle r="112" fill="none" stroke="#4A2810" strokeWidth="2" />

      {/* Gold Studs */}
      {[...Array(16)].map((_, i) => (
        <g key={`stud-${i}`} transform={`rotate(${i * 22.5 + 11.25})`}>
          <circle cx="0" cy="-125" r="4" fill="url(#swGoldCenter)" />
        </g>
      ))}

      {/* Hub */}
      <circle r="47" fill="#4A2810" />
      <circle r="44" fill="url(#swHubWood)" stroke="#3d1e03" strokeWidth="2" />
      <circle r="20" fill="url(#swGoldCenter)" stroke="#B8860B" strokeWidth="2" />
    </g>
  </svg>
);

interface SaveProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  consumedContent?: {
    booksRead: number;
    audioPlayed: number;
  };
}

const SaveProgressModal: React.FC<SaveProgressModalProps> = ({
  isOpen,
  onClose,
  onCreateAccount,
  onSignIn,
  consumedContent = { booksRead: 0, audioPlayed: 0 }
}) => {
  if (!isOpen) return null;

  const totalConsumed = consumedContent.booksRead + consumedContent.audioPlayed;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Ship's Wheel - Behind Modal */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <ShipsWheel className="w-[500px] h-[500px] opacity-15 animate-[spinSlow_60s_linear_infinite]" />
      </div>
      
      {/* Modal */}
      <div className="relative bg-gradient-to-b from-[#1a3a52] to-[#0f2538] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/10 animate-[slideUp_0.3s_ease-out]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg shadow-[#FFD700]/30">
            <Save className="w-10 h-10 text-[#5c2e0b]" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2 font-display">
          Save Your Progress!
        </h2>

        {/* Subtitle */}
        <p className="text-white/70 text-center mb-6">
          Create a free account to save your progress and pick up where you left off on any device.
        </p>

        {/* Progress Summary */}
        {totalConsumed > 0 && (
          <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
            <p className="text-white/60 text-sm text-center mb-3">Your progress so far:</p>
            <div className="flex justify-center gap-6">
              {consumedContent.booksRead > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{consumedContent.booksRead}</p>
                    <p className="text-white/50 text-xs">book{consumedContent.booksRead > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              {consumedContent.audioPlayed > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold">{consumedContent.audioPlayed}</p>
                    <p className="text-white/50 text-xs">audio</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2 mb-6">
          {[
            'Save your reading & listening progress',
            'Sync across all your devices',
            'Earn coins and unlock rewards',
            'Create profiles for your kids'
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
              <Sparkles className="w-4 h-4 text-[#FFD700] flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={onCreateAccount}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold text-lg shadow-lg shadow-[#FFD700]/30 active:scale-[0.98] transition-transform"
          >
            Create Free Account
          </button>
          
          <button
            onClick={onSignIn}
            className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold border border-white/20 active:scale-[0.98] transition-transform"
          >
            I already have an account
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-2 text-white/50 text-sm hover:text-white/70 transition-colors"
          >
            Continue without saving
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default SaveProgressModal;
