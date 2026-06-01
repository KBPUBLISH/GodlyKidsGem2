import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX, X, Sparkles, Book, Music } from 'lucide-react';
import WoodButton from '../ui/WoodButton';
import { attachReliableLoop } from '../../utils/audioLoop';

interface PersonalizedStoryPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    storyData: {
        title: string;
        content: string;
        scripture: string;
        scriptureText: string;
        ttsAudioUrl: string | null;
        coverImageUrl: string | null;
        backgroundMusicUrl: string | null;
        estimatedDuration: number; // in seconds
    } | null;
    childName: string;
}

const PersonalizedStoryPlayer: React.FC<PersonalizedStoryPlayerProps> = ({
    isOpen,
    onClose,
    onComplete,
    storyData,
    childName
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [musicMuted, setMusicMuted] = useState(false);
    const [showScripture, setShowScripture] = useState(false);
    
    const narrationRef = useRef<HTMLAudioElement>(null);
    const musicRef = useRef<HTMLAudioElement>(null);
    const musicLoopDetachRef = useRef<(() => void) | null>(null);
    const progressInterval = useRef<NodeJS.Timeout | null>(null);

    // Initialize audio elements
    useEffect(() => {
        if (isOpen && storyData) {
            // Set up narration audio
            if (narrationRef.current && storyData.ttsAudioUrl) {
                narrationRef.current.src = storyData.ttsAudioUrl;
                narrationRef.current.load();
            }
            
            // Set up background music
            if (musicRef.current && storyData.backgroundMusicUrl) {
                musicLoopDetachRef.current?.();
                musicRef.current.src = storyData.backgroundMusicUrl;
                musicRef.current.volume = 0.2; // Background music at 20% volume
                musicRef.current.loop = true;
                musicRef.current.load();
                musicLoopDetachRef.current = attachReliableLoop(musicRef.current, true);
            }
        }
        
        return () => {
            // Cleanup
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
            if (narrationRef.current) {
                narrationRef.current.pause();
            }
            musicLoopDetachRef.current?.();
            musicLoopDetachRef.current = null;
            if (musicRef.current) {
                musicRef.current.pause();
            }
        };
    }, [isOpen, storyData]);

    // Handle narration time updates
    const handleTimeUpdate = useCallback(() => {
        if (narrationRef.current) {
            const current = narrationRef.current.currentTime;
            const total = narrationRef.current.duration || storyData?.estimatedDuration || 60;
            setCurrentTime(current);
            setDuration(total);
            setProgress((current / total) * 100);
        }
    }, [storyData]);

    // Handle narration ended
    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        setProgress(100);
        
        // Stop background music
        if (musicRef.current) {
            musicRef.current.pause();
        }
        
        // Show scripture for a moment before completing
        setShowScripture(true);
        setTimeout(() => {
            onComplete();
        }, 3000);
    }, [onComplete]);

    // Play/Pause toggle
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            narrationRef.current?.pause();
            musicRef.current?.pause();
            setIsPlaying(false);
        } else {
            // Play narration
            if (narrationRef.current && storyData?.ttsAudioUrl) {
                narrationRef.current.play().catch(console.error);
            }
            // Play background music
            if (musicRef.current && storyData?.backgroundMusicUrl && !musicMuted) {
                musicRef.current.play().catch(console.error);
            }
            setIsPlaying(true);
        }
    }, [isPlaying, storyData, musicMuted]);

    // Toggle background music
    const toggleMusic = useCallback(() => {
        setMusicMuted(prev => {
            if (musicRef.current) {
                if (prev) {
                    // Unmuting - start playing if narration is playing
                    if (isPlaying) {
                        musicRef.current.play().catch(console.error);
                    }
                } else {
                    // Muting
                    musicRef.current.pause();
                }
            }
            return !prev;
        });
    }, [isPlaying]);

    // Skip story
    const handleSkip = useCallback(() => {
        if (narrationRef.current) {
            narrationRef.current.pause();
        }
        if (musicRef.current) {
            musicRef.current.pause();
        }
        onComplete();
    }, [onComplete]);

    // Format time as M:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen || !storyData) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
            {/* Hidden audio elements */}
            <audio
                ref={narrationRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onLoadedMetadata={() => {
                    if (narrationRef.current) {
                        setDuration(narrationRef.current.duration);
                    }
                }}
            />
            <audio ref={musicRef} />

            <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-[#1A0F0A] to-[#2A1810] rounded-3xl overflow-hidden shadow-2xl">
                {/* Cover Image */}
                <div className="relative aspect-square">
                    {storyData.coverImageUrl ? (
                        <img
                            src={storyData.coverImageUrl}
                            alt={storyData.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#667EEA] to-[#764BA2] flex items-center justify-center">
                            <Book className="w-32 h-32 text-white/30" />
                        </div>
                    )}
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-[#FFD700]" />
                            <span className="text-[#FFD700] text-sm font-medium">
                                {childName}'s Story
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            {storyData.title}
                        </h2>
                    </div>
                </div>

                {/* Scripture overlay (shows at end) */}
                {showScripture && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-8 animate-fade-in">
                        <div className="text-center">
                            <p className="text-xl text-white mb-4 italic">
                                "{storyData.scriptureText}"
                            </p>
                            <p className="text-[#FFD700] font-medium">
                                — {storyData.scripture}
                            </p>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="p-6 space-y-4">
                    {/* Progress bar */}
                    <div className="space-y-2">
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-sm text-white/60">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Play controls */}
                    <div className="flex items-center justify-center gap-6">
                        {/* Music toggle */}
                        {storyData.backgroundMusicUrl && (
                            <button
                                onClick={toggleMusic}
                                className={`p-3 rounded-full transition-colors ${
                                    musicMuted 
                                        ? 'bg-gray-700 text-gray-400' 
                                        : 'bg-[#8B4513]/50 text-[#FFD700]'
                                }`}
                                title={musicMuted ? 'Unmute music' : 'Mute music'}
                            >
                                {musicMuted ? (
                                    <VolumeX className="w-6 h-6" />
                                ) : (
                                    <Music className="w-6 h-6" />
                                )}
                            </button>
                        )}

                        {/* Play/Pause button */}
                        <button
                            onClick={togglePlay}
                            disabled={!storyData.ttsAudioUrl}
                            className="p-6 bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#9B5523] hover:to-[#B0623D] rounded-full text-white shadow-lg transition-all disabled:opacity-50"
                        >
                            {isPlaying ? (
                                <Pause className="w-10 h-10" />
                            ) : (
                                <Play className="w-10 h-10 ml-1" />
                            )}
                        </button>

                        {/* Skip button */}
                        <button
                            onClick={handleSkip}
                            className="p-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-full text-white/80 transition-colors"
                            title="Skip story"
                        >
                            <SkipForward className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Story text (scrollable) */}
                    {!storyData.ttsAudioUrl && (
                        <div className="mt-4 max-h-48 overflow-y-auto bg-black/30 rounded-xl p-4">
                            <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                                {storyData.content}
                            </p>
                        </div>
                    )}

                    {/* Helper text */}
                    {storyData.ttsAudioUrl && (
                        <p className="text-center text-white/50 text-sm">
                            {isPlaying 
                                ? 'Listening to your story...' 
                                : progress > 0 
                                    ? 'Paused' 
                                    : 'Tap play to start your story'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonalizedStoryPlayer;
