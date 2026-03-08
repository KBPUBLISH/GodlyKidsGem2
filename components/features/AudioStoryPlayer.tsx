import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, X, Sparkles } from 'lucide-react';

// Word alignment from TTS API
interface WordAlignment {
    word: string;
    start: number; // seconds
    end: number;   // seconds
}

interface AudioStoryPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    story: {
        title: string;
        content: string;
        scripture: string;
        scriptureText: string;
        ttsAudioUrl: string | null;
        alignmentData?: { words: WordAlignment[] } | null;
        sceneImageUrl: string | null;
        backgroundMusicUrl?: string | null;
        estimatedDuration?: number;
    } | null;
    childName: string;
}

const AudioStoryPlayer: React.FC<AudioStoryPlayerProps> = ({
    isOpen,
    onClose,
    onComplete,
    story,
    childName
}) => {
    // Audio state
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [musicMuted, setMusicMuted] = useState(false);
    const [showScripture, setShowScripture] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [wordAlignment, setWordAlignment] = useState<{ words: WordAlignment[] } | null>(null);
    
    // Refs
    const narrationRef = useRef<HTMLAudioElement>(null);
    const musicRef = useRef<HTMLAudioElement>(null);
    const textContainerRef = useRef<HTMLDivElement>(null);
    const highlightedWordRef = useRef<HTMLSpanElement>(null);

    // Parse story content into words
    const contentWords = useMemo(() => {
        if (!story?.content) return [];
        return story.content
            .replace(/\{childName\}/g, childName)
            .split(/(\s+)/)
            .filter(word => word.trim());
    }, [story?.content, childName]);

    // Initialize audio and alignment
    useEffect(() => {
        if (isOpen && story) {
            // Reset state
            setProgress(0);
            setCurrentTime(0);
            setCurrentWordIndex(-1);
            setShowScripture(false);
            setIsPlaying(false);
            
            // Set up narration audio
            if (narrationRef.current && story.ttsAudioUrl) {
                narrationRef.current.src = story.ttsAudioUrl;
                narrationRef.current.load();
            }
            
            // Set up background music
            if (musicRef.current && story.backgroundMusicUrl) {
                musicRef.current.src = story.backgroundMusicUrl;
                musicRef.current.volume = 0.15;
                musicRef.current.loop = true;
                musicRef.current.load();
            }
            
            // Set up word alignment
            if (story.alignmentData?.words && story.alignmentData.words.length > 0) {
                setWordAlignment(story.alignmentData);
            } else if (contentWords.length > 0) {
                // Fallback: even distribution
                const estimatedDuration = story.estimatedDuration || 60;
                const wordDuration = estimatedDuration / contentWords.length;
                const evenAlignment: { words: WordAlignment[] } = {
                    words: contentWords.map((word, idx) => ({
                        word,
                        start: idx * wordDuration,
                        end: (idx + 1) * wordDuration
                    }))
                };
                setWordAlignment(evenAlignment);
            }
        }
        
        return () => {
            if (narrationRef.current) {
                narrationRef.current.pause();
            }
            if (musicRef.current) {
                musicRef.current.pause();
            }
        };
    }, [isOpen, story, contentWords]);

    // Update word highlighting based on current time
    useEffect(() => {
        if (!wordAlignment?.words || currentTime === 0) {
            setCurrentWordIndex(-1);
            return;
        }
        
        // Find the current word based on time
        const wordIdx = wordAlignment.words.findIndex(
            (w, idx) => currentTime >= w.start && currentTime < w.end
        );
        
        if (wordIdx !== -1 && wordIdx !== currentWordIndex) {
            setCurrentWordIndex(wordIdx);
        }
    }, [currentTime, wordAlignment, currentWordIndex]);

    // Auto-scroll to highlighted word
    useEffect(() => {
        if (highlightedWordRef.current && textContainerRef.current) {
            const container = textContainerRef.current;
            const word = highlightedWordRef.current;
            
            const containerRect = container.getBoundingClientRect();
            const wordRect = word.getBoundingClientRect();
            
            // Check if word is outside visible area
            if (wordRect.top < containerRect.top || wordRect.bottom > containerRect.bottom) {
                word.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentWordIndex]);

    // Handle time update
    const handleTimeUpdate = useCallback(() => {
        if (narrationRef.current) {
            const current = narrationRef.current.currentTime;
            const total = narrationRef.current.duration || duration || 60;
            setCurrentTime(current);
            setProgress((current / total) * 100);
        }
    }, [duration]);

    // Handle audio ended
    const handleEnded = useCallback(() => {
        setIsPlaying(false);
        setProgress(100);
        setCurrentWordIndex(-1);
        
        if (musicRef.current) {
            musicRef.current.pause();
        }
        
        // Show scripture before completing
        setShowScripture(true);
        setTimeout(() => {
            onComplete();
        }, 4000);
    }, [onComplete]);

    // Play/Pause toggle
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            narrationRef.current?.pause();
            musicRef.current?.pause();
            setIsPlaying(false);
        } else {
            if (narrationRef.current && story?.ttsAudioUrl) {
                narrationRef.current.play().catch(console.error);
            }
            if (musicRef.current && story?.backgroundMusicUrl && !musicMuted) {
                musicRef.current.play().catch(console.error);
            }
            setIsPlaying(true);
        }
    }, [isPlaying, story, musicMuted]);

    // Restart
    const handleRestart = useCallback(() => {
        if (narrationRef.current) {
            narrationRef.current.currentTime = 0;
            setCurrentTime(0);
            setProgress(0);
            setCurrentWordIndex(-1);
            if (!isPlaying) {
                togglePlay();
            }
        }
    }, [isPlaying, togglePlay]);

    // Toggle music
    const toggleMusic = useCallback(() => {
        setMusicMuted(prev => {
            if (musicRef.current) {
                if (prev && isPlaying) {
                    musicRef.current.play().catch(console.error);
                } else {
                    musicRef.current.pause();
                }
            }
            return !prev;
        });
    }, [isPlaying]);

    // Skip
    const handleSkip = useCallback(() => {
        narrationRef.current?.pause();
        musicRef.current?.pause();
        onComplete();
    }, [onComplete]);

    // Seek on progress bar click
    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!narrationRef.current) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * (narrationRef.current.duration || duration);
        
        narrationRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        setProgress(percentage * 100);
    }, [duration]);

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen || !story) return null;

    const personalizedContent = story.content?.replace(/\{childName\}/g, childName) || '';

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
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

            {/* Background Image */}
            <div className="absolute inset-0">
                {story.sceneImageUrl ? (
                    <img
                        src={story.sceneImageUrl}
                        alt="Story scene"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#2E1A47] via-[#1A0F0A] to-[#0A1929]" />
                )}
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 safe-area-top">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#FFD700]" />
                        <span className="text-[#FFD700] text-sm font-medium">
                            {childName}'s Story
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Title */}
                <div className="px-6 mb-4">
                    <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                        {story.title.replace(/\{childName\}/g, childName)}
                    </h1>
                </div>

                {/* Story Text with Karaoke Highlighting */}
                <div 
                    ref={textContainerRef}
                    className="flex-1 overflow-y-auto px-6 pb-4"
                >
                    {showScripture ? (
                        // Scripture display at end
                        <div className="flex items-center justify-center h-full animate-fade-in">
                            <div className="text-center px-4">
                                <p className="text-xl text-white mb-4 italic leading-relaxed">
                                    "{story.scriptureText}"
                                </p>
                                <p className="text-[#FFD700] font-medium">
                                    — {story.scripture}
                                </p>
                            </div>
                        </div>
                    ) : (
                        // Story content with word highlighting
                        <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                            <p className="text-lg leading-relaxed text-white/90">
                                {contentWords.map((word, idx) => {
                                    const isHighlighted = idx === currentWordIndex;
                                    const isPast = idx < currentWordIndex;
                                    
                                    return (
                                        <span
                                            key={idx}
                                            ref={isHighlighted ? highlightedWordRef : null}
                                            className={`inline transition-all duration-150 ${
                                                isHighlighted
                                                    ? 'text-[#FFD700] font-semibold scale-105 bg-[#FFD700]/20 rounded px-1 -mx-1'
                                                    : isPast
                                                        ? 'text-white/70'
                                                        : 'text-white/90'
                                            }`}
                                        >
                                            {word}{' '}
                                        </span>
                                    );
                                })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="bg-gradient-to-t from-black to-transparent pt-8 pb-6 px-6">
                    {/* Progress bar */}
                    <div className="mb-4 space-y-2">
                        <div 
                            className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                            onClick={handleSeek}
                        >
                            <div
                                className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all duration-100"
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
                        {/* Restart */}
                        <button
                            onClick={handleRestart}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            title="Restart"
                        >
                            <RotateCcw className="w-6 h-6" />
                        </button>

                        {/* Music toggle */}
                        {story.backgroundMusicUrl && (
                            <button
                                onClick={toggleMusic}
                                className={`p-3 rounded-full transition-colors ${
                                    musicMuted 
                                        ? 'bg-white/10 text-white/50' 
                                        : 'bg-[#8B4513]/50 text-[#FFD700]'
                                }`}
                                title={musicMuted ? 'Unmute music' : 'Mute music'}
                            >
                                {musicMuted ? (
                                    <VolumeX className="w-6 h-6" />
                                ) : (
                                    <Volume2 className="w-6 h-6" />
                                )}
                            </button>
                        )}

                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            disabled={!story.ttsAudioUrl}
                            className="p-5 bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#9B5523] hover:to-[#B0623D] rounded-full text-white shadow-lg transition-all disabled:opacity-50 active:scale-95"
                        >
                            {isPlaying ? (
                                <Pause className="w-10 h-10" />
                            ) : (
                                <Play className="w-10 h-10 ml-1" />
                            )}
                        </button>

                        {/* Skip */}
                        <button
                            onClick={handleSkip}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            title="Skip"
                        >
                            <SkipForward className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Helper text */}
                    {story.ttsAudioUrl && !showScripture && (
                        <p className="text-center text-white/50 text-sm mt-4">
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

export default AudioStoryPlayer;
