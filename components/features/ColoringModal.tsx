import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Home, ShoppingBag, Star } from 'lucide-react';
import DrawingCanvas from './DrawingCanvas';
import { useUser } from '../../context/UserContext';
import WoodButton from '../ui/WoodButton';

interface ColoringModalProps {
    isOpen: boolean;
    onClose: () => void;
    backgroundImageUrl?: string;
}

const ColoringModal: React.FC<ColoringModalProps> = ({ isOpen, onClose, backgroundImageUrl }) => {
    const navigate = useNavigate();
    const { addCoins } = useUser();
    const [showReward, setShowReward] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    if (!isOpen) return null;

    const handleComplete = () => {
        addCoins(50);
        setShowReward(true);
    };

    const handleHome = () => {
        navigate('/home');
    };

    const handleShop = () => {
        navigate('/home', { state: { openShop: true } });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Main Card */}
            <div className="relative w-full max-w-4xl h-[85vh] bg-[#4a148c] rounded-[2rem] p-1 border-4 border-[#7b1fa2] shadow-2xl 
         transition-all duration-500 transform overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white/70 rounded-full p-2 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full pt-4 pb-4 px-4">
                    {/* Title */}
                    <h2 className="font-display font-extrabold text-2xl text-[#e1bee7] drop-shadow-md tracking-wide mb-4 uppercase flex items-center justify-center gap-2">
                        <Sparkles size={20} className="text-[#ab47bc]" /> Coloring Time!
                    </h2>

                    {/* Drawing Canvas */}
                    <div className="flex-1 min-h-0 bg-white rounded-xl overflow-hidden shadow-inner relative">
                        <DrawingCanvas
                            prompt="Color the picture!"
                            backgroundImageUrl={backgroundImageUrl}
                            onComplete={handleComplete}
                        />

                        {/* Reward Overlay */}
                        {showReward && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                                <div className="relative w-32 h-32 mb-6">
                                    <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Star size={80} className="text-[#FFD700] fill-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
                                    </div>
                                    <div className="absolute -top-2 -right-2 animate-bounce">
                                        <Sparkles size={32} className="text-[#FFD700]" />
                                    </div>
                                </div>

                                <h3 className="font-display font-bold text-4xl text-white mb-2 animate-in zoom-in duration-300 delay-150">
                                    GREAT JOB!
                                </h3>
                                <p className="text-[#FFD700] font-bold text-xl mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-300">
                                    You earned 50 Coins!
                                </p>

                                <div className="flex flex-col gap-4 w-full max-w-xs animate-in slide-in-from-bottom-8 duration-500 delay-500">
                                    <button
                                        onClick={handleHome}
                                        className="bg-[#2196F3] hover:bg-[#1E88E5] text-white py-4 rounded-xl font-bold shadow-lg border-b-4 border-[#1565C0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Home size={24} />
                                        Go Home
                                    </button>

                                    <button
                                        onClick={handleShop}
                                        className="bg-[#8B4513] hover:bg-[#795548] text-white py-4 rounded-xl font-bold shadow-lg border-b-4 border-[#5D4037] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ShoppingBag size={24} />
                                        Go to Shop
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ColoringModal;
