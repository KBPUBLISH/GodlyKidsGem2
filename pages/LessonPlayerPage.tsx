import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, VolumeX, Check, ChevronRight, Star, Book, FlaskConical, Calculator, Hourglass, Languages, Palette, Cpu, Video, X, Lock, Loader2, Mic, ChevronLeft } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { markCompleted, getCompletion } from '../services/lessonService';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { analyticsService } from '../services/analyticsService';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import DrawingCanvas from '../components/features/DrawingCanvas';
import { filterVisibleVoices } from '../services/voiceManagementService';
import { activityTrackingService } from '../services/activityTrackingService';

interface Episode {
    episodeNumber: number;
    title?: string;
    url: string;
    thumbnail?: string;
    duration?: number;
}

interface Lesson {
    _id: string;
    title: string;
    description?: string;
    video: {
        url: string;
        thumbnail?: string;
        duration?: number;
    };
    episodes?: Episode[];
    type?: string;
    captions?: Array<{
        text: string;
        timestamp: number;
    }>;
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

const getLessonIcon = (type: string) => {
    switch (type) {
        case 'Bible': return <Book className="w-5 h-5 text-[#FFD700]" />;
        case 'Science': return <FlaskConical className="w-5 h-5 text-[#FFD700]" />;
        case 'Math': return <Calculator className="w-5 h-5 text-[#FFD700]" />;
        case 'History': return <Hourglass className="w-5 h-5 text-[#FFD700]" />;
        case 'English': return <Languages className="w-5 h-5 text-[#FFD700]" />;
        case 'Art': return <Palette className="w-5 h-5 text-[#FFD700]" />;
        case 'Technology': return <Cpu className="w-5 h-5 text-[#FFD700]" />;
        default: return <Video className="w-5 h-5 text-[#FFD700]" />;
    }
};

const LessonPlayerPage: React.FC = () => {
    const { lessonId } = useParams<{ lessonId: string }>();
    const navigate = useNavigate();
    const { addCoins, isOwned, purchaseItem, coins, isSubscribed, isVoiceUnlocked } = useUser();
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
    
    // Episode state
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const preloadedVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
    const episodeContainerRef = useRef<HTMLDivElement>(null);

    // Quiz state
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(new Map());
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [correctAnswers, setCorrectAnswers] = useState(0);

    // Audio playback state
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [showGeneratingPopup, setShowGeneratingPopup] = useState(false);
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

    // Note: isVoiceUnlocked comes from UserContext - uses the same unlock system as BookReader

    const loadDefaultVoice = async () => {
        try {
            const voiceList = await ApiService.getVoices();
            if (voiceList && voiceList.length > 0) {
                // Filter out hidden voices
                const visibleVoices = filterVisibleVoices(voiceList);
                setVoices(visibleVoices);
                
                // Get user's default voice from localStorage (set during onboarding)
                const defaultVoiceId = localStorage.getItem('godlykids_default_voice');
                
                // Find unlocked voices
                const unlockedVoices = visibleVoices.filter((v: any) => isVoiceUnlocked(v.voice_id));
                
                if (defaultVoiceId && isVoiceUnlocked(defaultVoiceId)) {
                    // Use the user's default voice if it's unlocked
                    setSelectedVoiceId(defaultVoiceId);
                } else if (unlockedVoices.length > 0) {
                    // Use first unlocked voice
                    setSelectedVoiceId(unlockedVoices[0].voice_id);
                } else if (visibleVoices.length > 0) {
                    // Fallback to first visible voice
                    setSelectedVoiceId(visibleVoices[0].voice_id);
                }
                
                console.log(`✅ Loaded ${visibleVoices.length} voice(s), ${unlockedVoices.length} unlocked`);
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

    // Episode helpers
    const hasEpisodes = lesson?.episodes && lesson.episodes.length > 0;
    const totalEpisodes = hasEpisodes ? lesson!.episodes!.length : 1;
    const currentEpisode = hasEpisodes ? lesson!.episodes![currentEpisodeIndex] : null;
    
    const getCurrentVideoUrl = (): string => {
        if (hasEpisodes && currentEpisode) {
            return currentEpisode.url;
        }
        return lesson?.video?.url || '';
    };

    const goToNextEpisode = () => {
        if (hasEpisodes && currentEpisodeIndex < totalEpisodes - 1 && !isTransitioning) {
            setIsTransitioning(true);
            // Scroll to next episode with smooth animation
            if (episodeContainerRef.current) {
                const containerWidth = episodeContainerRef.current.offsetWidth;
                episodeContainerRef.current.scrollTo({
                    left: (currentEpisodeIndex + 1) * containerWidth,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => {
                setCurrentEpisodeIndex(prev => prev + 1);
                setVideoProgress(0);
                setIsTransitioning(false);
                // Auto-play next episode
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
                    }
                }, 100);
            }, 300);
        } else if (!hasEpisodes || currentEpisodeIndex >= totalEpisodes - 1) {
            // Last episode finished - auto-transition to devotional
            setVideoWatched(true);
            setTimeout(() => {
                setCurrentScreen('devotional');
            }, 500); // Brief delay before transitioning
        }
    };

    const goToPreviousEpisode = () => {
        if (hasEpisodes && currentEpisodeIndex > 0 && !isTransitioning) {
            setIsTransitioning(true);
            // Scroll to previous episode with smooth animation
            if (episodeContainerRef.current) {
                const containerWidth = episodeContainerRef.current.offsetWidth;
                episodeContainerRef.current.scrollTo({
                    left: (currentEpisodeIndex - 1) * containerWidth,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => {
                setCurrentEpisodeIndex(prev => prev - 1);
                setVideoProgress(0);
                setIsTransitioning(false);
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
                    }
                }, 100);
            }, 300);
        }
    };

    const goToEpisode = (index: number) => {
        if (hasEpisodes && index >= 0 && index < totalEpisodes && !isTransitioning) {
            setIsTransitioning(true);
            // Scroll to selected episode
            if (episodeContainerRef.current) {
                const containerWidth = episodeContainerRef.current.offsetWidth;
                episodeContainerRef.current.scrollTo({
                    left: index * containerWidth,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => {
                setCurrentEpisodeIndex(index);
                setVideoProgress(0);
                setShowEpisodeSelector(false);
                setIsTransitioning(false);
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
                    }
                }, 100);
            }, 300);
        }
    };

    // Preload next episodes for smooth transitions
    useEffect(() => {
        if (hasEpisodes && lesson?.episodes) {
            // Preload next 2 episodes
            const episodesToPreload = lesson.episodes.slice(currentEpisodeIndex + 1, currentEpisodeIndex + 3);
            episodesToPreload.forEach(episode => {
                if (!preloadedVideosRef.current.has(episode.url)) {
                    const video = document.createElement('video');
                    video.preload = 'auto';
                    video.src = episode.url;
                    preloadedVideosRef.current.set(episode.url, video);
                    console.log(`🎬 Preloading episode ${episode.episodeNumber}...`);
                }
            });
        }
    }, [hasEpisodes, currentEpisodeIndex, lesson?.episodes]);

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
                // Track lesson view analytics
                analyticsService.lessonView(lessonId!, data.title);
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
        console.log('🎬 Video tap detected, videoRef:', !!videoRef.current, 'isPlaying:', isVideoPlaying);
        
        // Show tap indicator briefly regardless of video state
        setShowVideoControls(true);
        setTimeout(() => setShowVideoControls(false), 500);
        
        if (videoRef.current) {
            if (isVideoPlaying) {
                videoRef.current.pause();
                setIsVideoPlaying(false);
                console.log('⏸️ Video paused');
            } else {
                videoRef.current.play().then(() => {
                    setIsVideoPlaying(true);
                    console.log('▶️ Video playing');
                }).catch(err => {
                    console.log('⚠️ Play prevented:', err);
                });
            }
        } else {
            console.log('⚠️ Video ref not available');
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // Prevent default to stop native video controls from interfering
        e.preventDefault();
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart) return;
        
        // Prevent default to stop click events from also firing
        e.preventDefault();

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;

        // If horizontal swipe is greater than vertical, it's a swipe
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 80) {
            // Swipe detected
            if (deltaX > 0) {
                // Swipe right - go to previous episode
                if (hasEpisodes && currentEpisodeIndex > 0) {
                    goToPreviousEpisode();
                }
            } else {
                // Swipe left - go to next episode or devotional
                if (hasEpisodes && currentEpisodeIndex < totalEpisodes - 1) {
                    goToNextEpisode();
                } else {
                    // Last episode or no episodes - swipe to devotional
                    setVideoWatched(true);
                    setCurrentScreen('devotional');
                }
            }
        } else if (Math.abs(deltaX) < 50 && Math.abs(deltaY) < 50) {
            // Increased threshold to 50px - allows for natural finger movement during tap
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

    // Audio queue for progressive loading
    const audioQueueRef = useRef<string[]>([]);
    const isLoadingRemainingRef = useRef(false);

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

        // Split text into chunks for progressive loading
        // First chunk: title + first 2 sentences (faster initial load)
        // Second chunk: rest of content
        const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
        const firstChunkSize = Math.min(3, sentences.length); // First 3 sentences
        const firstChunk = sentences.slice(0, firstChunkSize).join(' ').trim();
        const remainingChunk = sentences.slice(firstChunkSize).join(' ').trim();

        setIsGeneratingAudio(true);
        setShowGeneratingPopup(true);
        audioQueueRef.current = [];
        isLoadingRemainingRef.current = false;
        
        try {
            // Generate first chunk quickly
            console.log('🎤 Generating first chunk:', firstChunk.substring(0, 50) + '...');
            const firstResult = await ApiService.generateTTS(firstChunk, selectedVoiceId, lessonId);
            
            if (firstResult && firstResult.audioUrl) {
                setAudioUrl(firstResult.audioUrl);
                setShowGeneratingPopup(false);
                
                // Start playing first chunk immediately
                playAudio(firstResult.audioUrl);
                
                // Load remaining content in background (if any)
                if (remainingChunk.length > 0 && !isLoadingRemainingRef.current) {
                    isLoadingRemainingRef.current = true;
                    console.log('🎤 Loading remaining audio in background...');
                    
                    // Generate remaining audio in background
                    ApiService.generateTTS(remainingChunk, selectedVoiceId, lessonId)
                        .then((remainingResult) => {
                            if (remainingResult && remainingResult.audioUrl) {
                                audioQueueRef.current.push(remainingResult.audioUrl);
                                console.log('✅ Remaining audio loaded and queued');
                            }
                        })
                        .catch((err) => {
                            console.warn('Failed to load remaining audio:', err);
                        })
                        .finally(() => {
                            isLoadingRemainingRef.current = false;
                        });
                }
            } else {
                console.error('Failed to generate audio');
                setShowGeneratingPopup(false);
            }
        } catch (error: any) {
            // Handle AbortError gracefully (expected when navigating away or cancelling)
            if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
                // Silently handle abort - this is expected behavior
                setShowGeneratingPopup(false);
                return;
            }
            console.error('Error generating audio:', error);
            setShowGeneratingPopup(false);
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

        audio.onplay = () => {
            setIsAudioPlaying(true);
            setShowGeneratingPopup(false);
        };
        audio.onpause = () => setIsAudioPlaying(false);
        audio.onended = () => {
            // Check if there's more audio in the queue
            if (audioQueueRef.current.length > 0) {
                const nextAudioUrl = audioQueueRef.current.shift();
                console.log('🔄 Playing next queued audio segment');
                if (nextAudioUrl) {
                    // Small delay for natural transition
                    setTimeout(() => {
                        playAudio(nextAudioUrl);
                    }, 300);
                    return;
                }
            }
            
            // If still loading remaining audio, wait for it
            if (isLoadingRemainingRef.current) {
                console.log('⏳ Waiting for remaining audio to load...');
                const checkInterval = setInterval(() => {
                    if (audioQueueRef.current.length > 0) {
                        clearInterval(checkInterval);
                        const nextAudioUrl = audioQueueRef.current.shift();
                        if (nextAudioUrl) {
                            console.log('🔄 Remaining audio loaded, continuing playback');
                            playAudio(nextAudioUrl);
                        }
                    } else if (!isLoadingRemainingRef.current) {
                        // Loading finished but queue is empty (error case)
                        clearInterval(checkInterval);
                        setIsAudioPlaying(false);
                        audioRef.current = null;
                    }
                }, 200); // Check every 200ms
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (isLoadingRemainingRef.current) {
                        console.warn('⚠️ Timeout waiting for remaining audio');
                        setIsAudioPlaying(false);
                        audioRef.current = null;
                    }
                }, 30000);
                return;
            }
            
            // No more audio in queue and not loading
            setIsAudioPlaying(false);
            audioRef.current = null;
        };
        audio.onerror = () => {
            console.error('Audio playback error');
            setIsAudioPlaying(false);
            audioRef.current = null;
            // Try next in queue if available
            if (audioQueueRef.current.length > 0) {
                const nextAudioUrl = audioQueueRef.current.shift();
                if (nextAudioUrl) {
                    playAudio(nextAudioUrl);
                }
            }
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
        addCoins(coinsEarned, `Lesson Quiz - ${correct} correct`, 'lesson');

        // Mark activity as completed
        setActivityCompleted(true);

        // Mark lesson as completed
        markCompleted(lessonId!, correct, coinsEarned);
        
        // Track lesson complete analytics
        analyticsService.lessonComplete(lessonId!, lesson?.title);
        
        // Track for Report Card
        activityTrackingService.trackLessonCompleted(lessonId!, lesson?.title || 'Video Lesson');

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
            {/* Voice Generation Loading Popup - Dismissible */}
            {showGeneratingPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#5D4037] rounded-2xl p-8 mx-4 max-w-sm w-full shadow-2xl border-4 border-[#3E2723] text-center relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowGeneratingPopup(false)}
                            className="absolute top-3 right-3 text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        {/* Animated Icon */}
                        <div className="mb-6 relative">
                            <div className="w-20 h-20 mx-auto bg-[#3E2723] rounded-full flex items-center justify-center">
                                <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin" />
                            </div>
                            <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-4 border-[#FFD700]/30 animate-ping" />
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-[#FFD700] text-xl font-bold font-display mb-3">
                            Preparing Your Story
                        </h3>
                        
                        {/* Message */}
                        <p className="text-white/90 text-sm leading-relaxed mb-4">
                            This will just take a minute, and then after that, it's clear sailing! ⛵
                        </p>
                        
                        {/* Sub-message */}
                        <div className="bg-[#3E2723] rounded-lg p-3 border border-[#FFD700]/20">
                            <p className="text-[#FFD700]/80 text-xs">
                                ✨ Feel free to keep reading - it will start automatically when ready!
                            </p>
                        </div>
                        
                        {/* Progress dots animation */}
                        <div className="flex justify-center gap-2 mt-6">
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}

            {currentScreen === 'video' ? (
                <div className="fixed inset-0 z-50 bg-black overflow-hidden">
                    {/* Progress Bar - Only show on video screen at top */}
                    <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-gray-800/50">
                        <div
                            className="h-full bg-[#FFD700] transition-all duration-100"
                            style={{ width: `${videoProgress}%` }}
                        />
                    </div>

                    {/* Header Bar - Episode selector on left, X button on right */}
                    <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between">
                        {/* Episode Indicator - Left side */}
                        {hasEpisodes ? (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowEpisodeSelector(!showEpisodeSelector);
                                    }}
                                    className="flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-2"
                                >
                                    <span className="text-white font-medium text-sm">
                                        Episode {currentEpisodeIndex + 1}/{totalEpisodes}
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-white/70 transition-transform ${showEpisodeSelector ? 'rotate-90' : ''}`} />
                                </button>

                                {/* Episode Selector Dropdown */}
                                {showEpisodeSelector && (
                                    <div className="absolute top-full left-0 mt-2 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden min-w-[200px]">
                                        {lesson?.episodes?.map((ep, idx) => (
                                            <button
                                                key={idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (idx !== currentEpisodeIndex) {
                                                        setIsTransitioning(true);
                                                        setTimeout(() => {
                                                            setCurrentEpisodeIndex(idx);
                                                            setVideoProgress(0);
                                                            setIsTransitioning(false);
                                                            setTimeout(() => {
                                                                if (videoRef.current) {
                                                                    videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
                                                                }
                                                            }, 100);
                                                        }, 200);
                                                    }
                                                    setShowEpisodeSelector(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                                                    idx === currentEpisodeIndex 
                                                        ? 'bg-[#FFD700]/20 text-[#FFD700]' 
                                                        : 'text-white hover:bg-white/10'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                    idx === currentEpisodeIndex ? 'bg-[#FFD700] text-black' : 'bg-white/20'
                                                }`}>
                                                    {idx + 1}
                                                </div>
                                                <span className="text-sm">{ep.title || `Episode ${idx + 1}`}</span>
                                                {idx === currentEpisodeIndex && (
                                                    <Check className="w-4 h-4 ml-auto" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div /> 
                        )}

                        {/* Close Button - Right side */}
                        <button
                            onClick={() => navigate(-1)}
                            className="text-white p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Video Content - Full Screen with Snap Scroll for Episodes */}
                    <div
                        ref={episodeContainerRef}
                        className="absolute inset-0 bg-black flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                        style={{ 
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onClick={(e) => {
                            // Handle click on the container itself (not on video element)
                            // This helps with desktop and some mobile browsers
                            if (e.target === e.currentTarget) {
                                handleVideoTap();
                            }
                        }}
                    >
                        {/* Render all episodes for snap scroll (or single video if no episodes) */}
                        {hasEpisodes ? (
                            lesson?.episodes?.map((episode, index) => (
                                <div
                                    key={episode.url || index}
                                    className="flex-shrink-0 w-full h-full snap-center relative"
                                    style={{ scrollSnapAlign: 'center' }}
                                    onClick={handleVideoTap}
                                >
                                    {index === currentEpisodeIndex ? (
                                        <video
                                            ref={videoRef}
                                            src={episode.url}
                                            className="w-full h-full object-contain cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleVideoTap();
                                            }}
                                            onTimeUpdate={handleVideoProgress}
                                            onPlay={() => setIsVideoPlaying(true)}
                                            onPause={() => setIsVideoPlaying(false)}
                                            onEnded={() => {
                                                setIsVideoPlaying(false);
                                                if (currentEpisodeIndex < totalEpisodes - 1) {
                                                    goToNextEpisode();
                                                } else {
                                                    // Last episode finished - transition to devotional
                                                    setVideoWatched(true);
                                                    setTimeout(() => {
                                                        setCurrentScreen('devotional');
                                                    }, 500);
                                                }
                                            }}
                                            onLoadedData={() => {
                                                if (videoRef.current && index === currentEpisodeIndex) {
                                                    videoRef.current.play().catch(err => {
                                                        console.log('Autoplay prevented:', err);
                                                    });
                                                }
                                            }}
                                            playsInline
                                            autoPlay={index === currentEpisodeIndex}
                                        />
                                    ) : (
                                        // Placeholder for non-active episodes (shows thumbnail or loading)
                                        <div className="w-full h-full flex items-center justify-center bg-black">
                                            <div className="text-center">
                                                <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-3">
                                                    <span className="text-3xl font-bold text-white">{index + 1}</span>
                                                </div>
                                                <p className="text-white/60 text-sm">{episode.title || `Episode ${index + 1}`}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            // Single video (no episodes)
                            <div
                                className="flex-shrink-0 w-full h-full snap-center"
                                onClick={handleVideoTap}
                            >
                                <video
                                    ref={videoRef}
                                    src={getCurrentVideoUrl()}
                                    className="w-full h-full object-contain cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleVideoTap();
                                    }}
                                    onTimeUpdate={handleVideoProgress}
                                    onPlay={() => setIsVideoPlaying(true)}
                                    onPause={() => setIsVideoPlaying(false)}
                                    onEnded={() => {
                                        setIsVideoPlaying(false);
                                        setVideoWatched(true);
                                        // Auto-transition to devotional
                                        setTimeout(() => {
                                            setCurrentScreen('devotional');
                                        }, 500);
                                    }}
                                    onLoadedData={() => {
                                        if (videoRef.current) {
                                            videoRef.current.play().catch(err => {
                                                console.log('Autoplay prevented:', err);
                                            });
                                        }
                                    }}
                                    playsInline
                                    autoPlay
                                />
                            </div>
                        )}
                    </div>

                    {/* Tap indicator (shows briefly on tap) - Outside scroll container */}
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

                    {/* Swipe hint for episodes */}
                    {hasEpisodes && totalEpisodes > 1 && !videoWatched && (
                        <div className="absolute top-1/2 left-0 right-0 flex justify-between px-2 pointer-events-none z-20">
                            {currentEpisodeIndex > 0 && (
                                <div className="bg-black/40 backdrop-blur-sm rounded-full p-2 animate-pulse">
                                    <ChevronLeft className="w-6 h-6 text-white/70" />
                                </div>
                            )}
                            <div className="flex-1" />
                            {currentEpisodeIndex < totalEpisodes - 1 && (
                                <div className="bg-black/40 backdrop-blur-sm rounded-full p-2 animate-pulse">
                                    <ChevronRight className="w-6 h-6 text-white/70" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Continue Button - Shows after watching video or when video ends */}
                    {videoWatched && (
                        <div className="absolute bottom-16 left-0 right-0 flex justify-center z-30 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={() => setCurrentScreen('devotional')}
                                className="flex items-center gap-3 bg-[#8B4513] hover:bg-[#A0522D] text-white px-8 py-4 rounded-full font-bold font-display text-lg shadow-2xl border-4 border-[#FFD700] transition-all transform hover:scale-105 active:scale-95"
                                style={{
                                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.4), 0 8px 32px rgba(0, 0, 0, 0.5)'
                                }}
                            >
                                <Book className="w-6 h-6" />
                                Continue to Devotional
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {/* Episode Progress Bar (for multi-episode) */}
                    {hasEpisodes && !videoWatched && (
                        <div className="absolute bottom-16 left-4 right-4 z-30">
                            <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
                                {lesson?.episodes?.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => goToEpisode(index)}
                                        className={`flex-1 h-1.5 rounded-full transition-all ${
                                            index < currentEpisodeIndex
                                                ? 'bg-[#FFD700]' // Completed
                                                : index === currentEpisodeIndex
                                                ? 'bg-gradient-to-r from-[#FFD700] to-white/30' // Current
                                                : 'bg-white/30' // Upcoming
                                        }`}
                                        style={index === currentEpisodeIndex ? { 
                                            background: `linear-gradient(to right, #FFD700 ${videoProgress}%, rgba(255,255,255,0.3) ${videoProgress}%)` 
                                        } : {}}
                                    />
                                ))}
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
            ) : (
                <div 
                    className="h-full flex flex-col bg-black"
                    onTouchStart={(e) => {
                        const touch = e.touches[0];
                        setTouchStart({ x: touch.clientX, y: touch.clientY });
                    }}
                    onTouchEnd={(e) => {
                        if (!touchStart) return;
                        const touch = e.changedTouches[0];
                        const deltaX = touch.clientX - touchStart.x;
                        const deltaY = touch.clientY - touchStart.y;
                        
                        // Only process horizontal swipes
                        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 80) {
                            if (deltaX > 0) {
                                // Swipe right - go back
                                handleBack();
                            } else {
                                // Swipe left - go forward
                                if (currentScreen === 'devotional') {
                                    setDevotionalRead(true);
                                    setCurrentScreen('activity');
                                }
                            }
                        }
                        setTouchStart(null);
                    }}
                >
                    {/* Progress Bar for other screens */}
                    <div className="w-full h-1 bg-gray-800">
                        <div
                            className="h-full bg-[#FFD700] transition-all duration-300"
                            style={{ width: `${getProgress()}%` }}
                        />
                    </div>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6 text-white" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/10 p-2 rounded-full">
                                    {getLessonIcon(lesson.type || 'Bible')}
                                </div>
                                <h1 className="text-xl md:text-2xl font-bold text-white">{lesson.title}</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full">
                            <span className="text-white text-sm font-semibold">
                                {currentScreen === 'devotional' ? 'Devotional' : 'Activity'}
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {currentScreen === 'devotional' && (
                            <div className="h-full flex flex-col p-4 relative"
                                style={{
                                    backgroundColor: '#8B4513',
                                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), 
                                                      linear-gradient(to bottom, #8B5A2B, #654321)`
                                }}>
                                {/* Decorative background elements - Nails/Bolts */}
                                <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>

                                {/* Audio Controls - Wood style */}
                                <div className="mb-6 flex justify-center items-center gap-3 relative z-50">
                                    {/* Voice Selector */}
                                    <div
                                        ref={voiceDropdownRef}
                                        className="relative z-[200]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowVoiceDropdown(!showVoiceDropdown);
                                            }}
                                            className="bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-lg px-4 py-2 flex items-center gap-2 transition-colors border-2 border-[#3E2723] shadow-md"
                                        >
                                            <Mic className="w-5 h-5 text-[#FFD700] flex-shrink-0" />
                                            <span className="text-[#FFD700] text-sm font-bold truncate font-display tracking-wide">
                                                {voices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                                    clonedVoices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                                    'Voice'}
                                            </span>
                                        </button>

                                        {/* Dropdown Menu - opens BELOW the button */}
                                        {showVoiceDropdown && (
                                            <div className="absolute top-full left-0 mt-2 bg-[#5D4037] rounded-lg border-2 border-[#3E2723] shadow-xl z-[9999] max-h-[300px] overflow-y-auto min-w-[220px]">
                                                <div className="py-2">
                                                    {/* Unlocked Voices Section - show first */}
                                                    {voices.filter(v => isVoiceUnlocked(v.voice_id)).length > 0 && (
                                                        <>
                                                            <div className="px-4 py-1 text-xs text-[#FFD700]/60 uppercase tracking-wider font-display">Unlocked</div>
                                                            {voices.filter(v => isVoiceUnlocked(v.voice_id)).map(v => (
                                                                <button
                                                                    key={v.voice_id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedVoiceId(v.voice_id);
                                                                        setShowVoiceDropdown(false);
                                                                        // Regenerate audio with new voice if audio was already generated
                                                                        if (audioUrl) {
                                                                            setAudioUrl(null);
                                                                        }
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm text-[#FFD700] hover:bg-[#4E342E] transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-[#4E342E]' : ''}`}
                                                                >
                                                                    {selectedVoiceId === v.voice_id && (
                                                                        <Check className="w-4 h-4 text-[#FFD700]" />
                                                                    )}
                                                                    <span className={`font-display tracking-wide ${selectedVoiceId === v.voice_id ? 'font-bold' : ''}`}>
                                                                        {v.name}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}

                                                    {/* Cloned voices (always unlocked) */}
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
                                                                        }
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm text-[#FFD700] hover:bg-[#4E342E] transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-[#4E342E]' : ''}`}
                                                                >
                                                                    {selectedVoiceId === v.voice_id && (
                                                                        <Check className="w-4 h-4 text-[#FFD700]" />
                                                                    )}
                                                                    <span className={`font-display tracking-wide ${selectedVoiceId === v.voice_id ? 'font-bold' : ''}`}>
                                                                        {v.name} (Cloned)
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}

                                                    {/* Locked Voices Section (only show if not premium) */}
                                                    {!isSubscribed && voices.filter(v => !isVoiceUnlocked(v.voice_id)).length > 0 && (
                                                        <>
                                                            <div className="border-t border-[#3E2723] my-1"></div>
                                                            <div className="px-4 py-1 text-xs text-white/40 uppercase tracking-wider font-display">Locked</div>
                                                            {voices.filter(v => !isVoiceUnlocked(v.voice_id)).map(v => (
                                                                <div key={v.voice_id} className="flex items-center gap-2 px-2 py-1">
                                                                    <div className="flex-1 flex items-center gap-2 px-2 py-1 text-sm text-white/50">
                                                                        <Lock className="w-4 h-4 text-white/30" />
                                                                        <span className="font-display tracking-wide">{v.name}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setShowVoiceDropdown(false);
                                                                            navigate('/profile', { state: { openShop: true, shopTab: 'voices' } });
                                                                        }}
                                                                        className="px-2 py-1 text-xs bg-[#FFD700] text-[#3E2723] rounded hover:bg-[#FFC107] transition-colors font-bold font-display"
                                                                    >
                                                                        Unlock
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}

                                                    {voices.length === 0 && clonedVoices.length === 0 && (
                                                        <div className="px-4 py-2 text-sm text-white/50 text-center">
                                                            No voices available
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Audio Play Button - Wood style */}
                                    <button
                                        onClick={toggleAudio}
                                        disabled={isGeneratingAudio}
                                        className={`flex items-center gap-3 px-6 py-3 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg border-2 ${isGeneratingAudio
                                            ? 'bg-[#5D4037] text-white/50 border-[#3E2723] cursor-not-allowed'
                                            : isAudioPlaying
                                                ? 'bg-[#3E2723] text-[#FFD700] border-[#FFD700]'
                                                : 'bg-[#5D4037] text-[#FFD700] border-[#3E2723] hover:bg-[#4E342E]'
                                            }`}
                                    >
                                        {isGeneratingAudio ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span className="font-display">Loading...</span>
                                            </>
                                        ) : isAudioPlaying ? (
                                            <>
                                                <Pause className="w-6 h-6" />
                                                <span className="font-display">Pause</span>
                                            </>
                                        ) : (
                                            <>
                                                <Volume2 className="w-6 h-6" />
                                                <span className="font-display">Listen</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Main Content - Parchment on Wood */}
                                <div className="flex-1 overflow-y-auto relative z-10 px-2">
                                    {/* Parchment Container */}
                                    <div className="bg-[#f3e5ab] rounded-sm shadow-lg p-6 transform rotate-[-1deg] border-2 border-[#d4c59a] relative">
                                        {/* Parchment texture overlay */}
                                        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply"
                                            style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/aged-paper.png")` }}
                                        ></div>

                                        {/* Title */}
                                        {lesson.devotional.title && (
                                            <div className="text-center mb-6 relative z-10">
                                                <h2 className="text-[#5D4037] text-3xl md:text-4xl font-black font-display drop-shadow-sm tracking-wide">
                                                    {lesson.devotional.title}
                                                </h2>
                                                <div className="w-32 h-1 bg-[#8B4513] mx-auto mt-2 rounded-full opacity-50"></div>
                                            </div>
                                        )}

                                        {/* Content - Clean formatted text (no highlighting) */}
                                        {lesson.devotional.content && (
                                            <div className="mb-8 relative z-10">
                                                {/* Split content by paragraphs and render each with proper spacing */}
                                                {lesson.devotional.content
                                                    .replace(/\[[^\]]+\][.,!?;:'"-]*/g, '') // Remove [brackets] AND trailing punctuation
                                                    .split(/\n\n+|\.\s+(?=[A-Z])/) // Split by double newlines or sentence boundaries
                                                    .filter(p => p.trim().length > 0)
                                                    .map((paragraph, idx) => (
                                                        <p 
                                                            key={idx} 
                                                            className="text-[#3E2723] text-lg md:text-xl leading-loose font-medium font-serif mb-4 text-justify first-letter:text-2xl first-letter:font-bold first-letter:text-[#5D4037]"
                                                        >
                                                            {paragraph.trim().replace(/\s+/g, ' ')}
                                                        </p>
                                                    ))
                                                }
                                            </div>
                                        )}

                                        {/* Bible Verse - Wax Seal Style */}
                                        {lesson.devotional.verse && (
                                            <div className="relative z-10 mt-8 border-t-2 border-[#d4c59a] pt-6">
                                                <div className="flex flex-col items-center text-center">
                                                    <span className="text-2xl mb-2">📜</span>
                                                    <p className="text-[#8B4513] font-black text-lg font-display mb-2">{lesson.devotional.verse}</p>
                                                    {lesson.devotional.verseText && (
                                                        <p className="text-[#5D4037] text-xl italic font-serif leading-relaxed max-w-lg">"{lesson.devotional.verseText}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Navigation buttons - Wood Signs */}
                                <div className="flex items-center justify-between pt-6 gap-4 relative z-10">
                                    <button
                                        onClick={handleBack}
                                        className="bg-[#5D4037] hover:bg-[#4E342E] text-[#FFD700] px-6 py-3 rounded-lg font-bold font-display flex items-center gap-2 shadow-lg border-2 border-[#3E2723] transition-transform active:scale-95"
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
                                        className="bg-[#8B4513] hover:bg-[#A0522D] text-white px-8 py-3 rounded-lg font-bold font-display text-lg shadow-lg border-2 border-[#5D4037] transition-transform active:scale-95 flex items-center gap-2"
                                    >
                                        Continue
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentScreen === 'activity' && (
                            <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden"
                                style={{
                                    backgroundColor: '#8B4513',
                                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), 
                                                      linear-gradient(to bottom, #8B5A2B, #654321)`
                                }}>
                                {/* Decorative background elements */}
                                <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>
                                <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-[#4a2810] shadow-inner opacity-60"></div>

                                {lesson.activity.type === 'quiz' && questions.length > 0 ? (
                                    <>
                                        <div className="flex-1 overflow-y-auto px-2">
                                            {/* Parchment Container */}
                                            <div className="bg-[#f3e5ab] rounded-sm shadow-lg p-6 transform rotate-[1deg] border-2 border-[#d4c59a] relative min-h-full">
                                                {/* Parchment texture overlay */}
                                                <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply"
                                                    style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/aged-paper.png")` }}
                                                ></div>

                                                <div className="relative z-10">
                                                    <h2 className="text-[#5D4037] text-3xl font-black font-display mb-6 text-center drop-shadow-sm tracking-wide">
                                                        {lesson.activity.title || 'Quiz Time!'}
                                                    </h2>

                                                    {/* Question Progress */}
                                                    <div className="mb-8 px-4">
                                                        <div className="flex justify-between text-[#8B4513] text-sm font-bold mb-2 font-display">
                                                            <span>Question {currentQuestionIndex + 1}</span>
                                                            <span>{questions.length} total</span>
                                                        </div>
                                                        <div className="w-full h-4 bg-[#d4c59a] rounded-full overflow-hidden border border-[#8B4513]/30">
                                                            <div
                                                                className="h-full bg-[#8B4513] transition-all duration-300 relative"
                                                                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                                                            >
                                                                <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Current Question */}
                                                    <div className="mb-8">
                                                        <h3 className="text-[#3E2723] text-2xl font-bold mb-6 text-center font-serif leading-relaxed">
                                                            {questions[currentQuestionIndex].question}
                                                        </h3>

                                                        <div className="space-y-4">
                                                            {questions[currentQuestionIndex].options.map((option, optIndex) => {
                                                                const isSelected = selectedAnswers.get(currentQuestionIndex) === optIndex;
                                                                const isCorrect = option.isCorrect;
                                                                const showResult = quizSubmitted;

                                                                return (
                                                                    <button
                                                                        key={optIndex}
                                                                        onClick={() => handleQuizAnswer(currentQuestionIndex, optIndex)}
                                                                        disabled={quizSubmitted}
                                                                        className={`w-full p-4 rounded-lg text-left transition-all border-2 transform active:scale-[0.98] ${showResult && isCorrect
                                                                            ? 'bg-green-100 border-green-500 text-green-900 shadow-md'
                                                                            : showResult && isSelected && !isCorrect
                                                                                ? 'bg-red-100 border-red-500 text-red-900 shadow-md'
                                                                                : isSelected
                                                                                    ? 'bg-[#FFD700] border-[#B8860B] text-[#3E2723] shadow-md font-bold'
                                                                                    : 'bg-white/60 border-[#d4c59a] text-[#5D4037] hover:bg-white hover:border-[#8B4513] hover:shadow-md'
                                                                            } ${quizSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${showResult && isCorrect ? 'bg-green-500 border-green-600 text-white' :
                                                                                showResult && isSelected && !isCorrect ? 'bg-red-500 border-red-600 text-white' :
                                                                                    isSelected ? 'bg-[#B8860B] border-[#8B4513] text-white' :
                                                                                        'bg-[#d4c59a] border-[#8B4513] text-[#5D4037]'
                                                                                }`}>
                                                                                {String.fromCharCode(65 + optIndex)}
                                                                            </div>
                                                                            <span className="text-lg font-medium">{option.text}</span>
                                                                            {showResult && isCorrect && <Check className="w-6 h-6 text-green-600 ml-auto" />}
                                                                            {showResult && isSelected && !isCorrect && <X className="w-6 h-6 text-red-600 ml-auto" />}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Navigation - Wood Signs */}
                                            {!quizSubmitted && (
                                                <div className="flex items-center justify-between pt-6 gap-4 relative z-10 pb-4">
                                                    <button
                                                        onClick={() => {
                                                            if (currentQuestionIndex > 0) {
                                                                setCurrentQuestionIndex(currentQuestionIndex - 1);
                                                            } else {
                                                                handleBack();
                                                            }
                                                        }}
                                                        className="bg-[#5D4037] hover:bg-[#4E342E] text-[#FFD700] px-6 py-3 rounded-lg font-bold font-display flex items-center gap-2 shadow-lg border-2 border-[#3E2723] transition-transform active:scale-95"
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
                                                            className="bg-[#8B4513] hover:bg-[#A0522D] text-white px-8 py-3 rounded-lg font-bold font-display text-lg shadow-lg border-2 border-[#5D4037] transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Next
                                                            <ChevronRight className="w-6 h-6" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={handleSubmitQuiz}
                                                            disabled={!selectedAnswers.has(currentQuestionIndex)}
                                                            className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-8 py-3 rounded-lg font-bold font-display text-lg shadow-lg border-2 border-[#1B5E20] transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Submit!
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Results */}
                                            {quizSubmitted && (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                                    <div className="bg-[#f3e5ab] rounded-lg shadow-2xl p-8 max-w-md w-full border-4 border-[#8B4513] text-center animate-in zoom-in duration-300 relative">
                                                        {/* Confetti/Stars */}
                                                        <div className="absolute -top-6 -left-6 text-4xl animate-bounce">⭐</div>
                                                        <div className="absolute -top-6 -right-6 text-4xl animate-bounce" style={{ animationDelay: '0.5s' }}>⭐</div>

                                                        <h3 className="text-[#5D4037] text-3xl font-black font-display mb-4">Quiz Complete!</h3>

                                                        <div className="text-6xl mb-4">
                                                            {correctAnswers === questions.length ? '🏆' : correctAnswers > questions.length / 2 ? '🌟' : '👍'}
                                                        </div>

                                                        <p className="text-[#3E2723] text-xl mb-6 font-serif">
                                                            You got <span className="font-bold text-[#8B4513]">{correctAnswers}</span> out of <span className="font-bold text-[#8B4513]">{questions.length}</span> correct!
                                                        </p>

                                                        <div className="bg-[#FFF8E1] p-4 rounded-lg border-2 border-[#d4c59a] mb-6 inline-block">
                                                            <p className="text-[#FF8F00] font-black text-2xl flex items-center gap-2 justify-center">
                                                                <span>🪙</span> +{correctAnswers * 10} Coins!
                                                            </p>
                                                        </div>

                                                        <button
                                                            onClick={() => navigate(-1)}
                                                            className="w-full bg-[#8B4513] hover:bg-[#A0522D] text-white px-6 py-4 rounded-lg font-bold font-display text-xl shadow-lg border-2 border-[#5D4037] transition-transform active:scale-95"
                                                        >
                                                            Awesome!
                                                        </button>
                                                    </div>
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
                                                
                                                // Track lesson complete analytics
                                                analyticsService.lessonComplete(lessonId!, lesson?.title);
                                                
                                                // Track for Report Card
                                                activityTrackingService.trackLessonCompleted(lessonId!, lesson?.title || 'Video Lesson');

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

