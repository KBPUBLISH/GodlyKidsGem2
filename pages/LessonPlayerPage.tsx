import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Check, Lock, Volume2, Loader2, Mic } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { markCompleted, getCompletion } from '../services/lessonService';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import { useNavigate } from 'react-router-dom';
import DrawingCanvas from '../components/features/DrawingCanvas';
import { filterVisibleVoices } from '../services/voiceManagementService';

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
    };
    devotional: {
        title?: string;
        content?: string;
        verse?: string;
        verseText?: string;
    };
    activity: {
        type: 'quiz' | 'reflection';
        title?: string;
        questions?: Array<{
            question: string;
            options: Array<{ text: string; isCorrect: boolean }>;
        }>;
        content?: string; // Legacy: single question
        options?: Array<{ text: string; isCorrect: boolean }>; // Legacy
    };
    coinReward?: number;
}

type Screen = 'video' | 'devotional' | 'activity';

const LessonPlayerPage: React.FC = () => {
    const { lessonId } = useParams<{ lessonId: string }>();
    const navigate = useNavigate();
    const { addCoins, isOwned, purchaseItem, coins, isSubscribed } = useUser();
    const { setMusicPaused, musicEnabled } = useAudio();
    
    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentScreen, setCurrentScreen] = useState<Screen>('video');
    const [videoProgress, setVideoProgress] = useState(0);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [videoWatched, setVideoWatched] = useState(false);
    const [showVideoControls, setShowVideoControls] = useState(false);
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [devotionalRead, setDevotionalRead] = useState(false);
    const [activityCompleted, setActivityCompleted] = useState(false);
    
    // Quiz state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(new Map());
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    
    // Audio playback state
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
    const [voices, setVoices] = useState<any[]>([]);
    const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
    const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
    const voiceDropdownRef = useRef<HTMLDivElement>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (lessonId) {
            fetchLesson();
        }
        
        // Load default voice on mount
        loadDefaultVoice();
        
        // Pause app background music when entering lesson player
        const wasMusicEnabled = musicEnabled;
        if (wasMusicEnabled) {
            localStorage.setItem('godly_kids_was_music_enabled_lesson', 'true');
        }
        setMusicPaused(true);
        
        // Cleanup audio on unmount
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            
            // Restore music state when leaving
            const wasEnabled = localStorage.getItem('godly_kids_was_music_enabled_lesson') === 'true';
            if (wasEnabled) {
                setMusicPaused(false);
                localStorage.removeItem('godly_kids_was_music_enabled_lesson');
            }
        };
    }, [lessonId, musicEnabled, setMusicPaused]);
    
    // Helper to check if a voice is unlocked
    const isVoiceUnlocked = (voiceId: string): boolean => {
        // Free voices (Rachel, Domi, Bella, Elli)
        const freeVoices = ['21m00Tcm4TlvDq8ikWAM', 'AZnzlk1XvdvUeBnXmlld', 'EXAVITQu4vr4xnSDxMaL', 'MF3mGyEYCl7XYWbV9V6O'];
        if (freeVoices.includes(voiceId)) return true;
        
        // Check if voice is purchased
        const voiceShopId = `voice-${voiceId}`;
        // Also check by voice name pattern
        const voiceName = voices.find(v => v.voice_id === voiceId)?.name?.toLowerCase() || '';
        const shopIdPatterns = [
            voiceShopId,
            `voice-${voiceName.replace(/\s+/g, '-').toLowerCase()}`,
        ];
        
        return shopIdPatterns.some(id => isOwned(id)) || isSubscribed;
    };
    
    // Helper to get voice shop item ID
    const getVoiceShopId = (voiceId: string, voiceName: string): string => {
        const nameSlug = voiceName.toLowerCase().replace(/\s+/g, '-');
        return `voice-${nameSlug}`;
    };

    const loadDefaultVoice = async () => {
        try {
            const voiceList = await ApiService.getVoices();
            if (voiceList && voiceList.length > 0) {
                // Filter out hidden voices
                const visibleVoices = filterVisibleVoices(voiceList);
                setVoices(visibleVoices);
                // Try to find a kid-friendly voice or use first available unlocked voice
                const kidVoice = visibleVoices.find((v: any) => {
                    const isKidFriendly = ['Domi', 'Bella', 'Elli', 'Rachel'].includes(v.name);
                    return isKidFriendly && isVoiceUnlocked(v.voice_id);
                });
                if (kidVoice) {
                    setSelectedVoiceId(kidVoice.voice_id);
                } else {
                    // Find first unlocked voice
                    const firstUnlocked = visibleVoices.find((v: any) => isVoiceUnlocked(v.voice_id));
                    if (firstUnlocked) {
                        setSelectedVoiceId(firstUnlocked.voice_id);
                    } else if (visibleVoices.length > 0) {
                        setSelectedVoiceId(visibleVoices[0].voice_id);
                    }
                }
            } else {
                // Fallback to a common ElevenLabs voice ID
                setSelectedVoiceId('21m00Tcm4TlvDq8ikWAM'); // Rachel - a popular ElevenLabs voice
            }
            
            // Load cloned voices from local storage
            const cloned = voiceCloningService.getClonedVoices();
            setClonedVoices(cloned);
        } catch (error) {
            console.error('Error loading voices:', error);
            // Fallback to default voice
            setSelectedVoiceId('21m00Tcm4TlvDq8ikWAM');
        }
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (voiceDropdownRef.current && !voiceDropdownRef.current.contains(event.target as Node)) {
                setShowVoiceDropdown(false);
            }
        };
        
        if (showVoiceDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showVoiceDropdown]);

    const fetchLesson = async () => {
        try {
            const data = await ApiService.getLesson(lessonId!);
            if (data) {
                setLesson(data);
                // Check if already completed
                const completion = getCompletion(lessonId!);
                if (completion) {
                    setVideoWatched(true);
                    setDevotionalRead(true);
                    setActivityCompleted(true);
                }
            }
        } catch (error) {
            console.error('Error fetching lesson:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVideoProgress = () => {
        if (videoRef.current) {
            const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setVideoProgress(progress);
            
            // Mark as watched if > 90%
            if (progress > 90 && !videoWatched) {
                setVideoWatched(true);
            }
        }
    };

    const handleVideoTap = () => {
        if (videoRef.current) {
            // Show tap indicator briefly
            setShowVideoControls(true);
            setTimeout(() => setShowVideoControls(false), 500);
            
            if (isVideoPlaying) {
                videoRef.current.pause();
                setIsVideoPlaying(false);
            } else {
                videoRef.current.play();
                setIsVideoPlaying(true);
            }
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        
        // If horizontal swipe is greater than vertical, it's a swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            e.preventDefault();
            e.stopPropagation();
            if (deltaX > 0) {
                // Swipe right - go back
                handleBack();
            } else {
                // Swipe left - go to next (devotional)
                if (currentScreen === 'video') {
                    setCurrentScreen('devotional');
                }
            }
        } else if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
            // Small movement - treat as tap
            handleVideoTap();
        }
        
        setTouchStart(null);
    };

    const handleNext = () => {
        if (currentScreen === 'video') {
            setCurrentScreen('devotional');
        } else if (currentScreen === 'devotional') {
            setCurrentScreen('activity');
        }
    };
    
    const generateDevotionalAudio = async () => {
        if (!lesson || !selectedVoiceId) return;
        
        // Combine all devotional text
        const textParts: string[] = [];
        if (lesson.devotional.title) {
            textParts.push(lesson.devotional.title);
        }
        if (lesson.devotional.content) {
            textParts.push(lesson.devotional.content);
        }
        if (lesson.devotional.verse) {
            textParts.push(lesson.devotional.verse);
        }
        if (lesson.devotional.verseText) {
            textParts.push(lesson.devotional.verseText);
        }
        
        const fullText = textParts.join('. ');
        if (!fullText.trim()) return;
        
        setIsGeneratingAudio(true);
        try {
            const result = await ApiService.generateTTS(fullText, selectedVoiceId, lessonId);
            if (result && result.audioUrl) {
                setAudioUrl(result.audioUrl);
                // Auto-play after generation
                setTimeout(() => {
                    playAudio(result.audioUrl);
                }, 100);
            } else {
                console.error('Failed to generate audio');
            }
        } catch (error: any) {
            // Handle AbortError gracefully (expected when navigating away or cancelling)
            if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
                // Silently handle abort - this is expected behavior
                return;
            }
            console.error('Error generating audio:', error);
        } finally {
            setIsGeneratingAudio(false);
        }
    };
    
    const playAudio = (url?: string) => {
        const audioUrlToPlay = url || audioUrl;
        if (!audioUrlToPlay) {
            // Generate audio if not available
            generateDevotionalAudio();
            return;
        }
        
        // Stop any existing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        
        // Create new audio element
        const audio = new Audio(audioUrlToPlay);
        audioRef.current = audio;
        
        audio.onplay = () => setIsAudioPlaying(true);
        audio.onpause = () => setIsAudioPlaying(false);
        audio.onended = () => {
            setIsAudioPlaying(false);
            audioRef.current = null;
        };
        audio.onerror = () => {
            console.error('Audio playback error');
            setIsAudioPlaying(false);
            audioRef.current = null;
        };
        
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            setIsAudioPlaying(false);
        });
    };
    
    const pauseAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsAudioPlaying(false);
        }
    };
    
    const toggleAudio = () => {
        if (isAudioPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    };

    const handleBack = () => {
        if (currentScreen === 'devotional') {
            // Stop audio when leaving devotional screen
            if (audioRef.current) {
                pauseAudio();
            }
            setCurrentScreen('video');
        } else if (currentScreen === 'activity') {
            setCurrentScreen('devotional');
        }
    };

    const handleQuizAnswer = (questionIndex: number, optionIndex: number) => {
        if (quizSubmitted) return;
        
        const newAnswers = new Map(selectedAnswers);
        newAnswers.set(questionIndex, optionIndex);
        setSelectedAnswers(newAnswers);
    };

    const handleSubmitQuiz = () => {
        if (!lesson || !lesson.activity.questions) return;
        
        let correct = 0;
        lesson.activity.questions.forEach((q, qIndex) => {
            const selectedIndex = selectedAnswers.get(qIndex);
            if (selectedIndex !== undefined && q.options[selectedIndex]?.isCorrect) {
                correct++;
            }
        });
        
        setCorrectAnswers(correct);
        setQuizSubmitted(true);
        
        // Award coins: 10 per correct answer
        const coinsEarned = correct * 10;
        addCoins(coinsEarned);
        
        // Mark activity as completed
        setActivityCompleted(true);
        
        // Mark lesson as completed
        markCompleted(lessonId!, correct, coinsEarned);
        
        // Save to backend
        const userId = 'local-user'; // TODO: Get from auth context
        ApiService.completeLesson(
            lessonId!,
            userId,
            {
                videoWatched,
                devotionalRead,
                activityCompleted: true,
            },
            {
                quizAnswers: Array.from(selectedAnswers.entries()).map(([qIndex, optIndex]) => ({
                    questionId: qIndex,
                    selectedAnswer: optIndex,
                    isCorrect: lesson.activity.questions?.[qIndex]?.options[optIndex]?.isCorrect || false,
                })),
            },
            coinsEarned
        );
    };

    const getProgress = (): number => {
        let progress = 0;
        if (videoWatched) progress += 33.33;
        if (devotionalRead) progress += 33.33;
        if (activityCompleted) progress += 33.34;
        return progress;
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-white text-lg">Loading lesson...</div>
            </div>
        );
    }

    if (!lesson) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-white text-lg">Lesson not found</div>
            </div>
        );
    }

    const questions = lesson.activity.questions || (lesson.activity.content ? [{
        question: lesson.activity.content,
        options: lesson.activity.options || [],
    }] : []);

    return (
        <>
            {currentScreen === 'video' ? (
                <div className="fixed inset-0 z-50 bg-black overflow-hidden">
                    {/* Progress Bar - Only show on video screen at top */}
                    <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-gray-800/50">
                        <div
                            className="h-full bg-[#FFD700] transition-all duration-100"
                            style={{ width: `${videoProgress}%` }}
                        />
                    </div>

                    {/* Header - Only show X button on video screen */}
                    <div className="absolute top-2 right-2 z-20">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-white p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Video Content - Full Screen */}
                    <div 
                        className="absolute inset-0 bg-black"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={(e) => {
                            // Prevent default scrolling while allowing swipe detection
                            e.preventDefault();
                        }}
                        onClick={handleVideoTap}
                        style={{ touchAction: 'pan-y pinch-zoom' }}
                    >
                        <video
                            ref={videoRef}
                            src={lesson.video.url}
                            className="w-full h-full object-contain pointer-events-none"
                            onTimeUpdate={handleVideoProgress}
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            onEnded={() => {
                                setIsVideoPlaying(false);
                                setVideoWatched(true);
                                // Auto-advance to devotional after video ends
                                setTimeout(() => {
                                    setCurrentScreen('devotional');
                                }, 500);
                            }}
                            onLoadedData={() => {
                                // Autoplay video when loaded
                                if (videoRef.current) {
                                    videoRef.current.play().catch(err => {
                                        console.log('Autoplay prevented:', err);
                                    });
                                }
                            }}
                            playsInline
                            autoPlay
                        />
                        
                        {/* Tap indicator (shows briefly on tap) */}
                        {showVideoControls && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                                <div className="bg-black/50 rounded-full p-4">
                                    {isVideoPlaying ? (
                                        <Pause className="w-12 h-12 text-white" />
                                    ) : (
                                        <Play className="w-12 h-12 text-white" />
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Screen indicators at bottom - show other tabs */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                            <div className={`h-1 rounded-full transition-all ${currentScreen === 'video' ? 'w-8 bg-[#FFD700]' : 'w-1 bg-white/50'}`} />
                            <div className={`h-1 rounded-full transition-all ${currentScreen === 'devotional' ? 'w-8 bg-[#FFD700]' : 'w-1 bg-white/50'}`} />
                            <div className={`h-1 rounded-full transition-all ${currentScreen === 'activity' ? 'w-8 bg-[#FFD700]' : 'w-1 bg-white/50'}`} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col bg-black">
                    {/* Progress Bar for other screens */}
                    <div className="w-full h-1 bg-gray-800">
                        <div
                            className="h-full bg-[#FFD700] transition-all duration-300"
                            style={{ width: `${getProgress()}%` }}
                        />
                    </div>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4">
                        <button
                            onClick={handleBack}
                            className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="text-white text-sm font-semibold">
                            {currentScreen === 'devotional' ? 'Devotional' : 'Activity'}
                        </div>
                        <div className="w-10" /> {/* Spacer */}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                {currentScreen === 'devotional' && (
                    <div className="h-full flex flex-col bg-gradient-to-b from-indigo-900 to-purple-900 p-6">
                        {/* Audio Controls */}
                        <div className="mb-4 flex justify-center items-center gap-3">
                            {/* Voice Selector */}
                            <div
                                ref={voiceDropdownRef}
                                className="relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowVoiceDropdown(!showVoiceDropdown);
                                    }}
                                    className="bg-white/20 backdrop-blur-md rounded-full px-3 py-2 flex items-center gap-2 hover:bg-white/30 transition-colors w-full"
                                >
                                    <Mic className="w-4 h-4 text-white flex-shrink-0" />
                                    <span className="text-white text-sm truncate flex-1 text-center">
                                        {voices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                            clonedVoices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                            'Voice'}
                                    </span>
                                </button>

                                {/* Dropdown Menu */}
                                {showVoiceDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                                        <div className="py-2">
                                            {/* Portal voices */}
                                            {voices.length > 0 && (
                                                <>
                                                    {voices.map(v => {
                                                        const unlocked = isVoiceUnlocked(v.voice_id);
                                                        const shopId = getVoiceShopId(v.voice_id, v.name);
                                                        return (
                                                            <div key={v.voice_id} className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (unlocked) {
                                                                            setSelectedVoiceId(v.voice_id);
                                                                            setShowVoiceDropdown(false);
                                                                            // Regenerate audio with new voice if audio was already generated
                                                                            if (audioUrl) {
                                                                                setAudioUrl(null);
                                                                                generateDevotionalAudio();
                                                                            }
                                                                        }
                                                                    }}
                                                                    disabled={!unlocked}
                                                                    className={`flex-1 text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-white/20' : ''} ${!unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    {selectedVoiceId === v.voice_id && unlocked && (
                                                                        <Check className="w-4 h-4 text-[#FFD700]" />
                                                                    )}
                                                                    {!unlocked && (
                                                                        <Lock className="w-4 h-4 text-gray-400" />
                                                                    )}
                                                                    <span className={selectedVoiceId === v.voice_id ? 'font-bold' : ''}>
                                                                        {v.name}
                                                                    </span>
                                                                </button>
                                                                {!unlocked && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setShowVoiceDropdown(false);
                                                                            navigate('/profile', { state: { openShop: true, shopTab: 'voices' } });
                                                                        }}
                                                                        className="px-3 py-1 text-xs bg-[#FFD700] text-black rounded hover:bg-[#FFC700] transition-colors font-semibold"
                                                                    >
                                                                        Unlock
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            )}

                                            {/* Cloned voices */}
                                            {clonedVoices.length > 0 && (
                                                <>
                                                    {clonedVoices.map(v => (
                                                        <button
                                                            key={v.voice_id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVoiceId(v.voice_id);
                                                                setShowVoiceDropdown(false);
                                                                // Regenerate audio with new voice if audio was already generated
                                                                if (audioUrl) {
                                                                    setAudioUrl(null);
                                                                    generateDevotionalAudio();
                                                                }
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-white/20' : ''
                                                                }`}
                                                        >
                                                            {selectedVoiceId === v.voice_id && (
                                                                <Check className="w-4 h-4 text-[#FFD700]" />
                                                            )}
                                                            <span className={selectedVoiceId === v.voice_id ? 'font-bold' : ''}>
                                                                {v.name} (Cloned)
                                                            </span>
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {voices.length === 0 && clonedVoices.length === 0 && (
                                                <div className="px-4 py-2 text-sm text-gray-400 text-center">
                                                    No voices available
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Audio Play Button */}
                            <button
                                onClick={toggleAudio}
                                disabled={isGeneratingAudio}
                                className={`flex items-center gap-3 px-6 py-3 rounded-lg font-semibold transition-all ${
                                    isGeneratingAudio
                                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                                        : isAudioPlaying
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : 'bg-[#FFD700] text-black hover:bg-[#FFC700]'
                                }`}
                            >
                                {isGeneratingAudio ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Generating Audio...</span>
                                    </>
                                ) : isAudioPlaying ? (
                                    <>
                                        <Pause className="w-5 h-5" />
                                        <span>Pause Reading</span>
                                    </>
                                ) : (
                                    <>
                                        <Volume2 className="w-5 h-5" />
                                        <span>Listen to Devotional</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto">
                            {lesson.devotional.title && (
                                <h2 className="text-white text-2xl font-bold mb-4">{lesson.devotional.title}</h2>
                            )}
                            {lesson.devotional.content && (
                                <div className="text-white text-lg leading-relaxed mb-6 whitespace-pre-line">
                                    {lesson.devotional.content}
                                </div>
                            )}
                            {lesson.devotional.verse && (
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                                    <p className="text-[#FFD700] font-semibold mb-2">{lesson.devotional.verse}</p>
                                    {lesson.devotional.verseText && (
                                        <p className="text-white italic">{lesson.devotional.verseText}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/20">
                            <button
                                onClick={handleBack}
                                className="text-white/80 hover:text-white flex items-center gap-2"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                Back
                            </button>
                            <button
                                onClick={() => {
                                    // Stop audio if playing
                                    if (audioRef.current) {
                                        pauseAudio();
                                    }
                                    setDevotionalRead(true);
                                    handleNext();
                                }}
                                className="bg-[#FFD700] text-black px-6 py-3 rounded-lg font-semibold"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {currentScreen === 'activity' && (
                    <div className="h-full flex flex-col bg-gradient-to-b from-blue-900 to-indigo-900 p-4 md:p-6 overflow-hidden">
                        {lesson.activity.type === 'quiz' && questions.length > 0 ? (
                            <>
                                <div className="flex-1 overflow-y-auto">
                                    <h2 className="text-white text-2xl font-bold mb-6">
                                        {lesson.activity.title || 'Quiz'}
                                    </h2>
                                    
                                    {/* Question Progress */}
                                    <div className="mb-6">
                                        <div className="text-white/70 text-sm mb-2">
                                            Question {currentQuestionIndex + 1} of {questions.length}
                                        </div>
                                        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#FFD700] transition-all duration-300"
                                                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Current Question */}
                                    <div className="mb-6">
                                        <h3 className="text-white text-xl font-semibold mb-4">
                                            {questions[currentQuestionIndex].question}
                                        </h3>
                                        
                                        <div className="space-y-3">
                                            {questions[currentQuestionIndex].options.map((option, optIndex) => {
                                                const isSelected = selectedAnswers.get(currentQuestionIndex) === optIndex;
                                                const isCorrect = option.isCorrect;
                                                const showResult = quizSubmitted;
                                                
                                                return (
                                                    <button
                                                        key={optIndex}
                                                        onClick={() => handleQuizAnswer(currentQuestionIndex, optIndex)}
                                                        disabled={quizSubmitted}
                                                        className={`w-full p-4 rounded-lg text-left transition-all ${
                                                            showResult && isCorrect
                                                                ? 'bg-green-500 border-2 border-green-400'
                                                                : showResult && isSelected && !isCorrect
                                                                ? 'bg-red-500 border-2 border-red-400'
                                                                : isSelected
                                                                ? 'bg-[#FFD700] border-2 border-[#FFD700]'
                                                                : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'
                                                        } ${quizSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <span className="text-white font-medium">{option.text}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    {!quizSubmitted && (
                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={() => {
                                                    if (currentQuestionIndex > 0) {
                                                        setCurrentQuestionIndex(currentQuestionIndex - 1);
                                                    } else {
                                                        handleBack();
                                                    }
                                                }}
                                                className="text-white/80 hover:text-white flex items-center gap-2"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                                {currentQuestionIndex > 0 ? 'Previous' : 'Back'}
                                            </button>
                                            
                                            {currentQuestionIndex < questions.length - 1 ? (
                                                <button
                                                    onClick={() => {
                                                        if (selectedAnswers.has(currentQuestionIndex)) {
                                                            setCurrentQuestionIndex(currentQuestionIndex + 1);
                                                        }
                                                    }}
                                                    disabled={!selectedAnswers.has(currentQuestionIndex)}
                                                    className="bg-[#FFD700] text-black px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                    <ChevronRight className="w-5 h-5 inline ml-2" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleSubmitQuiz}
                                                    disabled={!selectedAnswers.has(currentQuestionIndex)}
                                                    className="bg-[#FFD700] text-black px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Submit
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Results */}
                                    {quizSubmitted && (
                                        <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-lg p-6">
                                            <h3 className="text-white text-xl font-bold mb-2">Quiz Complete!</h3>
                                            <p className="text-white/80 mb-4">
                                                You got {correctAnswers} out of {questions.length} correct!
                                            </p>
                                            <p className="text-[#FFD700] font-semibold text-lg">
                                                🪙 You earned {correctAnswers * 10} coins!
                                            </p>
                                            <button
                                                onClick={() => navigate(-1)}
                                                className="mt-4 bg-[#FFD700] text-black px-6 py-3 rounded-lg font-semibold w-full"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <DrawingCanvas
                                    prompt={lesson.activity.content || lesson.activity.reflectionPrompt || 'Draw something that represents what you learned today!'}
                                    onComplete={() => {
                                        setActivityCompleted(true);
                                        markCompleted(lessonId!, 0, 0);
                                        
                                        // Save to backend
                                        const userId = 'local-user'; // TODO: Get from auth context
                                        ApiService.completeLesson(
                                            lessonId!,
                                            userId,
                                            {
                                                videoWatched,
                                                devotionalRead,
                                                activityCompleted: true,
                                            },
                                            {
                                                reflectionCompleted: true,
                                            },
                                            0
                                        );
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
                    </div>
                </div>
            )}
        </>
    );
};

export default LessonPlayerPage;

