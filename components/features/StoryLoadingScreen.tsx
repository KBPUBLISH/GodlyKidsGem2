import React, { useState, useEffect } from 'react';
import { Book, Sparkles, Music, Mic, Wand2 } from 'lucide-react';

interface StoryLoadingScreenProps {
    isOpen: boolean;
    childName: string;
    stage?: 'finding' | 'cover' | 'narration' | 'ready';
}

interface LoadingStage {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
}

const StoryLoadingScreen: React.FC<StoryLoadingScreenProps> = ({
    isOpen,
    childName,
    stage = 'finding'
}) => {
    const [currentTip, setCurrentTip] = useState(0);
    const [animatingDots, setAnimatingDots] = useState('');

    const stages: LoadingStage[] = [
        { 
            id: 'finding', 
            label: 'Finding your story', 
            icon: <Book className="w-6 h-6" />,
            color: 'from-blue-500 to-blue-600'
        },
        { 
            id: 'cover', 
            label: 'Creating your cover', 
            icon: <Wand2 className="w-6 h-6" />,
            color: 'from-purple-500 to-purple-600'
        },
        { 
            id: 'narration', 
            label: 'Recording narration', 
            icon: <Mic className="w-6 h-6" />,
            color: 'from-pink-500 to-pink-600'
        },
        { 
            id: 'ready', 
            label: 'Almost ready!', 
            icon: <Sparkles className="w-6 h-6" />,
            color: 'from-yellow-500 to-orange-500'
        },
    ];

    const tips = [
        `Did you know? God loves ${childName} very much!`,
        `${childName}, you're about to go on an adventure!`,
        `Every story has a special message just for you, ${childName}!`,
        `Get cozy! Your story is almost ready, ${childName}!`,
        `${childName}, God has amazing plans for you!`,
    ];

    // Animate dots
    useEffect(() => {
        if (!isOpen) return;
        
        const dotInterval = setInterval(() => {
            setAnimatingDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);

        return () => clearInterval(dotInterval);
    }, [isOpen]);

    // Rotate tips
    useEffect(() => {
        if (!isOpen) return;
        
        const tipInterval = setInterval(() => {
            setCurrentTip(prev => (prev + 1) % tips.length);
        }, 4000);

        return () => clearInterval(tipInterval);
    }, [isOpen, tips.length]);

    const currentStageIndex = stages.findIndex(s => s.id === stage);
    const currentStageData = stages[currentStageIndex] || stages[0];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#1A0F0A] to-[#2A1810]">
            <div className="w-full max-w-md mx-4 text-center">
                {/* Animated character/book icon */}
                <div className="mb-8 relative">
                    {/* Outer glow */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 bg-[#FFD700]/10 rounded-full animate-ping" />
                    </div>
                    
                    {/* Main icon container */}
                    <div className="relative w-32 h-32 mx-auto">
                        {/* Rotating ring */}
                        <div className="absolute inset-0 border-4 border-[#FFD700]/30 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
                        <div className="absolute inset-2 border-4 border-t-[#FFD700] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                        
                        {/* Center icon */}
                        <div className="absolute inset-4 bg-gradient-to-br from-[#8B4513] to-[#A0522D] rounded-full flex items-center justify-center shadow-lg">
                            <Book className="w-12 h-12 text-[#FFD700] animate-pulse" />
                        </div>
                        
                        {/* Sparkles around */}
                        <div className="absolute -top-2 -right-2 animate-bounce" style={{ animationDelay: '0ms' }}>
                            <Sparkles className="w-6 h-6 text-[#FFD700]" />
                        </div>
                        <div className="absolute -bottom-2 -left-2 animate-bounce" style={{ animationDelay: '200ms' }}>
                            <Sparkles className="w-5 h-5 text-[#FFD700]" />
                        </div>
                        <div className="absolute top-0 -left-4 animate-bounce" style={{ animationDelay: '400ms' }}>
                            <Sparkles className="w-4 h-4 text-[#FFD700]" />
                        </div>
                    </div>
                </div>

                {/* Main message */}
                <h2 className="text-2xl font-bold text-white mb-2">
                    Preparing {childName}'s Story{animatingDots}
                </h2>
                
                {/* Current stage */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${currentStageData.color} text-white text-sm font-medium mb-8`}>
                    {currentStageData.icon}
                    {currentStageData.label}
                </div>

                {/* Progress stages */}
                <div className="flex justify-center gap-2 mb-8">
                    {stages.map((s, index) => (
                        <div
                            key={s.id}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                index < currentStageIndex
                                    ? 'bg-[#4CAF50]' // Completed
                                    : index === currentStageIndex
                                        ? 'bg-[#FFD700] animate-pulse' // Current
                                        : 'bg-gray-600' // Pending
                            }`}
                        />
                    ))}
                </div>

                {/* Stage descriptions */}
                <div className="space-y-2 mb-8">
                    {stages.map((s, index) => (
                        <div
                            key={s.id}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-300 ${
                                index < currentStageIndex
                                    ? 'bg-[#4CAF50]/20 text-[#4CAF50]'
                                    : index === currentStageIndex
                                        ? 'bg-[#FFD700]/20 text-[#FFD700]'
                                        : 'bg-gray-800/50 text-gray-500'
                            }`}
                        >
                            <div className={`p-1.5 rounded-full ${
                                index < currentStageIndex
                                    ? 'bg-[#4CAF50]/30'
                                    : index === currentStageIndex
                                        ? 'bg-[#FFD700]/30'
                                        : 'bg-gray-700'
                            }`}>
                                {s.icon}
                            </div>
                            <span className="text-sm font-medium">{s.label}</span>
                            {index < currentStageIndex && (
                                <span className="ml-auto text-xs">✓</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Fun tip */}
                <div className="bg-[#8B4513]/30 rounded-xl p-4 border border-[#8B4513]/50">
                    <p className="text-[#FFD700] text-sm animate-fade-in" key={currentTip}>
                        {tips[currentTip]}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StoryLoadingScreen;
