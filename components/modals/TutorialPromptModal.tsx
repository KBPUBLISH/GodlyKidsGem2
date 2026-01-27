import React from 'react';
import { createPortal } from 'react-dom';
import { X, Play, SkipForward, Sparkles } from 'lucide-react';
import { activityTrackingService } from '../../services/activityTrackingService';

interface TutorialPromptModalProps {
    isOpen: boolean;
    onStartTutorial: () => void;
    onSkip: () => void;
}

const TUTORIAL_PROMPT_KEY = 'godlykids_tutorial_prompt_shown';

// Check if the tutorial prompt has been shown before
export const shouldShowTutorialPrompt = (): boolean => {
    // Don't show if tutorial was already completed
    if (localStorage.getItem('godlykids_tutorial_complete') === 'true') {
        return false;
    }
    // Don't show if prompt was already shown
    if (localStorage.getItem(TUTORIAL_PROMPT_KEY) === 'true') {
        return false;
    }
    return true;
};

// Mark tutorial prompt as shown
export const markTutorialPromptShown = () => {
    localStorage.setItem(TUTORIAL_PROMPT_KEY, 'true');
};

const TutorialPromptModal: React.FC<TutorialPromptModalProps> = ({
    isOpen,
    onStartTutorial,
    onSkip
}) => {
    if (!isOpen) return null;

    const handleStartTutorial = () => {
        markTutorialPromptShown();
        // Track that user chose to start the tutorial
        activityTrackingService.trackTutorialStep('tutorial_prompt_accepted', {
            choice: 'begin_tutorial'
        });
        onStartTutorial();
    };

    const handleSkip = () => {
        markTutorialPromptShown();
        // Track that user chose to skip the tutorial
        activityTrackingService.trackTutorialStep('tutorial_prompt_skipped', {
            choice: 'skip_tutorial'
        });
        onSkip();
    };

    // Use portal to render at document body level, bypassing parent stacking contexts
    return createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <div className="bg-gradient-to-b from-amber-100 to-orange-100 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border-4 border-amber-600 relative">
                {/* Close button */}
                <button 
                    onClick={handleSkip}
                    className="absolute top-3 right-3 p-2 bg-black/20 rounded-full hover:bg-black/30 transition-colors z-10"
                >
                    <X className="w-5 h-5 text-amber-800" />
                </button>

                {/* Image section */}
                <div className="relative h-48 bg-gradient-to-b from-sky-400 to-sky-300 flex items-center justify-center overflow-hidden">
                    {/* Try to load the tutorial-hs image, fallback to illustration */}
                    <img 
                        src="/assets/images/tutorial-hs.png"
                        alt="Tutorial"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback if image doesn't exist - show a fun illustration
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                    {/* Fallback content if image fails */}
                    <div className="absolute inset-0 hidden flex-col items-center justify-center bg-gradient-to-b from-sky-400 to-sky-300">
                        <div className="text-6xl mb-2">🦜📚</div>
                        <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
                    </div>
                    
                    {/* Decorative sparkles */}
                    <div className="absolute top-4 left-4">
                        <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                    </div>
                    <div className="absolute top-8 right-8">
                        <Sparkles className="w-4 h-4 text-white animate-pulse" style={{ animationDelay: '0.5s' }} />
                    </div>
                    <div className="absolute bottom-6 left-8">
                        <Sparkles className="w-5 h-5 text-yellow-200 animate-pulse" style={{ animationDelay: '1s' }} />
                    </div>
                </div>

                {/* Content section */}
                <div className="p-6 text-center">
                    <h2 className="text-2xl font-bold text-amber-900 mb-2">
                        Ready for a Quick Tour?
                    </h2>
                    <p className="text-amber-700 mb-6 text-sm">
                        Take a 2-minute guided demo to discover all the amazing features waiting for your family!
                    </p>

                    {/* Start Demo Button */}
                    <button
                        onClick={handleStartTutorial}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl 
                                   hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg
                                   flex items-center justify-center gap-3 text-lg mb-3"
                    >
                        <Play className="w-6 h-6" />
                        Jump into Demo!
                    </button>

                    {/* Skip Button */}
                    <button
                        onClick={handleSkip}
                        className="w-full py-3 bg-white/50 text-amber-700 font-medium rounded-xl 
                                   hover:bg-white/70 transition-all border border-amber-300
                                   flex items-center justify-center gap-2"
                    >
                        <SkipForward className="w-5 h-5" />
                        I'll explore on my own
                    </button>

                    <p className="text-xs text-amber-600/70 mt-4">
                        You can always find the tutorial in Settings later
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TutorialPromptModal;
