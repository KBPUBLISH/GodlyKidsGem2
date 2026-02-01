import React, { useEffect } from 'react';
import { X, BookOpen, Music, Sparkles, Save } from 'lucide-react';

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
  // Hide the navigation wheel when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    
    return () => {
      document.body.removeAttribute('data-modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalConsumed = consumedContent.booksRead + consumedContent.audioPlayed;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
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
      `}</style>
    </div>
  );
};

export default SaveProgressModal;
