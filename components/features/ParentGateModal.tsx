import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock } from 'lucide-react';
import WoodButton from '../ui/WoodButton';

interface ParentGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ParentGateModal: React.FC<ParentGateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [answer, setAnswer] = useState('');
  const [problem, setProblem] = useState({ q: '', a: 0 });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Generate numbers (e.g., 11 + 6, 15 + 4) - simple enough for adults, requires reading for kids
      const n1 = Math.floor(Math.random() * 10) + 10; 
      const n2 = Math.floor(Math.random() * 9) + 1;
      setProblem({ q: `${n1} + ${n2} = ?`, a: n1 + n2 });
      setAnswer('');
      setError(false);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseInt(answer);
    if (!isNaN(val) && val === problem.a) {
      onSuccess();
      onClose();
    } else {
      setError(true);
      setAnswer('');
      // Simple vibration feedback if supported
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4 pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      ></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-xs bg-[#fdf6e3] rounded-2xl p-6 shadow-2xl border-4 border-[#8B4513] animate-in zoom-in-95 flex flex-col items-center text-center">
         
         {/* Close Button */}
         <button 
            onClick={onClose} 
            className="absolute top-3 right-3 text-[#8B4513]/50 hover:text-[#8B4513] transition-colors"
         >
            <X size={24} />
         </button>
         
         {/* Icon */}
         <div className="w-14 h-14 bg-[#8B4513] rounded-full flex items-center justify-center mb-4 text-[#FFD700] shadow-md border-2 border-[#eecaa0]">
            <Lock size={24} />
         </div>

         <h2 className="font-display font-bold text-xl text-[#5c2e0b] mb-1">Ask a Parent</h2>
         <p className="text-[#8B4513] text-sm mb-6 font-semibold opacity-80">
             Please solve to continue.
         </p>

         {/* Math Problem */}
         <div className="text-3xl font-display font-extrabold text-[#5c2e0b] mb-6 bg-white/50 px-6 py-3 rounded-xl border-2 border-[#8B4513]/20 shadow-inner">
            {problem.q}
         </div>

         <form onSubmit={handleSubmit} className="w-full">
            <input 
                type="tel" 
                value={answer}
                onChange={(e) => {
                    setAnswer(e.target.value);
                    if(error) setError(false);
                }}
                className={`w-full border-2 rounded-xl px-4 py-3 text-center text-xl font-bold mb-4 outline-none transition-colors font-display text-[#5c2e0b] placeholder:text-[#5c2e0b]/30 shadow-inner ${
                    error 
                    ? 'border-red-500 bg-red-50 animate-[shake_0.5s_ease-in-out]' 
                    : 'border-[#8B4513]/30 bg-white focus:border-[#8B4513]'
                }`}
                placeholder="?"
                autoFocus
            />
            
            {error && (
                <p className="text-red-500 text-xs font-bold mb-3 -mt-2 animate-pulse">
                    Incorrect, try again!
                </p>
            )}
            
            <WoodButton fullWidth type="submit" variant="primary" className="py-3 text-lg">
                Verify & Continue
            </WoodButton>
         </form>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ParentGateModal;