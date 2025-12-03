import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Volume2, Mic, Check, Music, Home, Heart, Star, RotateCcw, Lock, BookOpen, Loader2 } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import VoiceCloningModal from '../components/features/VoiceCloningModal';
import BookQuizModal from '../components/features/BookQuizModal';
import { useAudio } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { readingProgressService } from '../services/readingProgressService';
import { favoritesService } from '../services/favoritesService';
import { readCountService } from '../services/readCountService';
import { bookCompletionService } from '../services/bookCompletionService';
import { BookPageRenderer } from '../components/features/BookPageRenderer';
import { processTextWithEmotionalCues, removeEmotionalCues } from '../utils/textProcessing';

interface TextBox {
    text: string;
    x: number;
    y: number;
    width?: number;
    alignment: 'left' | 'center' | 'right';
    fontFamily?: string;
    fontSize?: number;
    color?: string;
}

interface Page {
    _id: string;
    pageNumber: number;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    scrollUrl?: string;
    scrollHeight?: number;
    textBoxes?: TextBox[];
    files?: {
        soundEffect?: {
            url?: string;
        };
    };
    soundEffectUrl?: string;
}


// Wood Button Component
const WoodButton: React.FC<{ onClick: (e: React.MouseEvent) => void; icon: React.ReactNode; className?: string }> = ({ onClick, icon, className = '' }) => (
    <button
        onClick={onClick}
        className={`
            relative w-14 h-14 flex items-center justify-center
            bg-gradient-to-b from-[#C17F44] to-[#8B4513]
            border-2 border-[#5D2E0E] rounded-2xl
            shadow-[inset_2px_2px_4px_rgba(255,255,255,0.3),inset_-2px_-2px_4px_rgba(0,0,0,0.4),0_4px_8px_rgba(0,0,0,0.5)]
            active:translate-y-0.5 active:shadow-[inset_2px_2px_8px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.5)]
            transition-all duration-100 group
            ${className}
        `}
    >
        {/* Inner engraved look for icon */}
        <div className="text-[#3e2723] drop-shadow-[1px_1px_0px_rgba(255,255,255,0.3)]">
            {icon}
        </div>

        {/* Wood grain texture overlay (optional, using simple CSS pattern) */}
        <div className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
            style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #000 5px, #000 6px)'
            }}
        />
    </button>
);

const BookReaderPage: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setGameMode, setMusicPaused, musicEnabled, toggleMusic } = useAudio();
    const { isVoiceUnlocked, isSubscribed, addCoins, kids, currentProfileId } = useUser();
    
    // Get current kid's age for age-appropriate quiz
    const getCurrentKidAge = (): number => {
        if (currentProfileId && kids.length > 0) {
            const currentKid = kids.find(k => k.id === currentProfileId);
            if (currentKid && currentKid.age) {
                return currentKid.age;
            }
        }
        return 6; // Default age if not found
    };
    const kidAge = getCurrentKidAge();
    const wasMusicEnabledRef = useRef<boolean>(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showScroll, setShowScroll] = useState(true);

    // Keep ref in sync with state
    useEffect(() => {
        showScrollRef.current = showScroll;
    }, [showScroll]);

    // TTS State
    const [playing, setPlaying] = useState(false);
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
    const [activeTextBoxIndex, setActiveTextBoxIndex] = useState<number | null>(null);
    const [loadingAudio, setLoadingAudio] = useState(false);
    const [voices, setVoices] = useState<any[]>([]);
    const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Default Rachel
    const [wordAlignment, setWordAlignment] = useState<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
    const [showVoiceCloningModal, setShowVoiceCloningModal] = useState(false);
    const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
    const wordAlignmentRef = useRef<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);
    const bookBackgroundMusicRef = useRef<HTMLAudioElement | null>(null);
    const voiceDropdownRef = useRef<HTMLDivElement>(null);
    const [autoPlayMode, setAutoPlayMode] = useState(false);
    const autoPlayModeRef = useRef(false);
    const currentPageIndexRef = useRef(0); // Track page index to avoid closure issues
    const isAutoPlayingRef = useRef(false); // Prevent multiple simultaneous auto-play calls
    const alignmentWarningShownRef = useRef(false); // Prevent alignment warning spam
    const [isPageTurning, setIsPageTurning] = useState(false);
    const [flipState, setFlipState] = useState<{ direction: 'next' | 'prev', isFlipping: boolean } | null>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const touchEndY = useRef<number>(0);
    const touchStartTime = useRef<number>(0);
    const swipeDetectedRef = useRef<boolean>(false);
    const desiredScrollStateRef = useRef<boolean | null>(null); // Track desired scroll state for next page turn
    const showScrollRef = useRef<boolean>(true); // Track scroll state to avoid closure issues
    const [bookMusicEnabled, setBookMusicEnabled] = useState(true); // Default to enabled
    const BOOK_MUSIC_VOLUME = 0.3; // Hardcoded at 30% volume

    // Use ref to track music enabled state for intervals/callbacks
    const bookMusicEnabledRef = useRef<boolean>(bookMusicEnabled);
    useEffect(() => {
        bookMusicEnabledRef.current = bookMusicEnabled;
    }, [bookMusicEnabled]);

    const [hasBookMusic, setHasBookMusic] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    
    // Audio preloading cache - stores preloaded audio for upcoming pages
    // Key: `${pageIndex}-${textBoxIndex}-${voiceId}`, Value: { audioUrl, alignment }
    const audioPreloadCacheRef = useRef<Map<string, { audioUrl: string; alignment: any }>>(new Map());
    const preloadingInProgressRef = useRef<Set<string>>(new Set());
    
    // Quiz state
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizAttemptCount, setQuizAttemptCount] = useState(0);
    const [quizLoading, setQuizLoading] = useState(false);
    const [bookTitle, setBookTitle] = useState('');
    const [congratsAudioPlayed, setCongratsAudioPlayed] = useState(false);
    const congratsAudioRef = useRef<HTMLAudioElement | null>(null);
    
    // Page turn sound effect using Web Audio API for a synthetic paper sound
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // Function to play page turn sound using Web Audio API (synthetic paper rustle)
    const playPageTurnSound = () => {
        try {
            // Create or reuse AudioContext
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            
            // Resume context if suspended (required for autoplay policy)
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            
            const now = ctx.currentTime;
            
            // Create noise buffer for paper rustle sound
            const bufferSize = ctx.sampleRate * 0.15; // 150ms of sound
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            // Generate filtered noise that sounds like paper
            for (let i = 0; i < bufferSize; i++) {
                // Pink-ish noise with envelope
                const t = i / bufferSize;
                const envelope = Math.sin(t * Math.PI) * Math.pow(1 - t, 0.5); // Quick attack, natural decay
                output[i] = (Math.random() * 2 - 1) * envelope * 0.3;
            }
            
            // Create noise source
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            
            // High-pass filter to make it sound more like paper
            const highPass = ctx.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.value = 800;
            highPass.Q.value = 0.5;
            
            // Low-pass filter to remove harsh highs
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = 'lowpass';
            lowPass.frequency.value = 4000;
            lowPass.Q.value = 0.7;
            
            // Gain for volume control
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(0.25, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            
            // Connect the audio graph
            noiseSource.connect(highPass);
            highPass.connect(lowPass);
            lowPass.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Play the sound
            noiseSource.start(now);
            noiseSource.stop(now + 0.15);
            
        } catch (err) {
            // Silently fail if Web Audio API is not available
            console.log('Page turn sound not available');
        }
    };

    // Function to play congratulations message using TTS when user reaches the end
    const playCongratsAudio = async () => {
        if (congratsAudioPlayed || !selectedVoiceId) return;
        
        try {
            setCongratsAudioPlayed(true); // Prevent multiple plays
            
            const congratsText = "Great job! You made it to the end! What would you like to do now?";
            console.log('🎉 Generating congrats audio with voice:', selectedVoiceId);
            
            const result = await ApiService.generateTTS(congratsText, selectedVoiceId, bookId || undefined);
            
            if (result && result.audioUrl) {
                // Stop any currently playing audio
                if (congratsAudioRef.current) {
                    congratsAudioRef.current.pause();
                }
                
                const audio = new Audio(result.audioUrl);
                audio.volume = 0.8;
                congratsAudioRef.current = audio;
                
                audio.play().catch(err => {
                    console.warn('Failed to play congrats audio:', err);
                });
            }
        } catch (err) {
            console.error('Failed to generate congrats audio:', err);
        }
    };

    // Play congrats audio when reaching "The End" page
    useEffect(() => {
        const currentPage = pages[currentPageIndex];
        const isTheEnd = currentPage?.id === 'the-end-page' || currentPageIndex === pages.length - 1;
        
        if (isTheEnd && pages.length > 1 && !congratsAudioPlayed) {
            playCongratsAudio();
        }
    }, [currentPageIndex, pages, congratsAudioPlayed]);

    // Effect 1: Initialization, Book Data Fetching, and Cleanup
    useEffect(() => {
        console.log('📖 BookReaderPage MOUNTED - KILLING ALL APP MUSIC');

        // 1. Save current music state before muting
        const currentMusicState = musicEnabled;
        wasMusicEnabledRef.current = currentMusicState;
        localStorage.setItem('godly_kids_music_was_enabled', currentMusicState.toString());

        // 2. Pause app background music immediately
        setGameMode(false);
        setMusicPaused(true);

        // 3. Force mute background music by directly toggling if enabled
        if (currentMusicState) {
            console.log('🎵 BookReader: Force muting background music');
            // Directly toggle music off (this updates the state and stops audio)
            toggleMusic();

            // Also try clicking the button to ensure UI reflects the state
            setTimeout(() => {
                const musicButton = document.querySelector('button[title*="Music"], button[title*="music"]') as HTMLButtonElement;
                if (musicButton && !musicButton.disabled) {
                    musicButton.click();
                }
            }, 50);
        }

        // 4. Nuclear Option: Kill all other audio elements (more aggressive)
        // BUT preserve book background music
        const killAllAudio = () => {
            const allAudio = document.querySelectorAll('audio');
            allAudio.forEach(audio => {
                // Don't kill our own book music - it should play!
                if (bookBackgroundMusicRef.current && audio === bookBackgroundMusicRef.current) {
                    return;
                }
                // Force pause and mute only app background music
                audio.pause();
                audio.volume = 0;
                audio.currentTime = 0; // Reset position
            });
        };
        killAllAudio();

        // 5. Keep killing app background audio aggressively, but preserve book music
        let killCount = 0;
        let killInterval: NodeJS.Timeout | null = setInterval(() => {
            killAllAudio();
            // Ensure book music continues playing if it should be
            if (bookBackgroundMusicRef.current && bookMusicEnabledRef.current && bookBackgroundMusicRef.current.paused) {
                // Always apply current volume before playing
                bookBackgroundMusicRef.current.volume = BOOK_MUSIC_VOLUME;
                bookBackgroundMusicRef.current.play().catch(() => {
                    // Ignore play errors - might be user interaction required
                });
            }
            killCount++;
            // After 1 second (20 iterations at 50ms), slow down to 200ms
            if (killCount === 20 && killInterval) {
                clearInterval(killInterval);
                killInterval = setInterval(() => {
                    killAllAudio();
                    // Keep book music playing
                    if (bookBackgroundMusicRef.current && bookMusicEnabledRef.current && bookBackgroundMusicRef.current.paused) {
                        // Always apply current volume before playing
                        bookBackgroundMusicRef.current.volume = BOOK_MUSIC_VOLUME;
                        bookBackgroundMusicRef.current.play().catch(() => { });
                    }
                }, 200);
            }
        }, 50);

        // 6. Fetch book data and setup book music
        const fetchBookData = async () => {
            if (!bookId) return;
            try {
                const book = await ApiService.getBookById(bookId);
                const rawData = (book as any)?.rawData;
                const files = rawData?.files || (book as any)?.files;
                
                // Store book title for quiz modal
                const title = (book as any)?.title || rawData?.title || 'This Book';
                setBookTitle(title);

                // Fetch quiz attempt count
                const userId = localStorage.getItem('godlykids_user_id') || 'anonymous';
                const attempts = await ApiService.getBookQuizAttempts(bookId, userId);
                if (attempts) {
                    setQuizAttemptCount(attempts.attemptCount || 0);
                }

                if (files?.audio && Array.isArray(files.audio) && files.audio.length > 0) {
                    const musicUrl = files.audio[0].url;
                    if (musicUrl) {
                        console.log('🎵 Found book music:', musicUrl);
                        setHasBookMusic(true);

                        // Create audio object but don't play yet (handled by second effect)
                        if (bookBackgroundMusicRef.current) {
                            bookBackgroundMusicRef.current.pause();
                        }

                        const audio = new Audio(musicUrl);
                        audio.loop = true;
                        audio.volume = BOOK_MUSIC_VOLUME; // Use ref to get current volume
                        audio.preload = 'auto';
                        bookBackgroundMusicRef.current = audio;

                        // Start playing book music automatically when loaded
                        audio.addEventListener('canplaythrough', () => {
                            if (bookMusicEnabledRef.current) {
                                // Apply current volume before playing
                                audio.volume = BOOK_MUSIC_VOLUME;
                                console.log('🎵 Book music ready - starting playback at volume:', BOOK_MUSIC_VOLUME);
                                audio.play().catch(err => {
                                    console.warn('⚠️ Book music auto-play prevented:', err);
                                });
                            }
                        }, { once: true });

                        // Try to play immediately if already loaded
                        if (audio.readyState >= 3 && bookMusicEnabledRef.current) {
                            audio.play().catch(err => {
                                console.warn('⚠️ Book music immediate play prevented:', err);
                            });
                        }

                        // Trigger a state update to notify the second effect that music is ready
                        // We can use setHasBookMusic(true) which we already did, 
                        // but we might need to force a re-check if it was already true.
                        // For now, the dependency on hasBookMusic in the second effect should handle it.
                    }
                }
            } catch (err) {
                console.error('Failed to fetch book data:', err);
            }
        };

        fetchBookData();

        // Cleanup function
        return () => {
            console.log('📖 BookReaderPage UNMOUNTING - Cleanup');
            if (killInterval) clearInterval(killInterval);

            // Stop and destroy book music
            if (bookBackgroundMusicRef.current) {
                bookBackgroundMusicRef.current.pause();
                bookBackgroundMusicRef.current.src = '';
                bookBackgroundMusicRef.current = null;
            }

            // Resume app music
            setMusicPaused(false);
        };
    }, [bookId, setGameMode, setMusicPaused]); // Removed bookMusicEnabled from dependencies

    // Effect 2: Handle Music Toggle (Play/Pause)
    useEffect(() => {
        const audio = bookBackgroundMusicRef.current;
        if (!audio) return;

        if (bookMusicEnabled) {
            console.log('🎵 Book music enabled - attempting to play');
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn('⚠️ Auto-play prevented:', err);
                });
            }
        } else {
            console.log('🎵 Book music disabled - pausing');
            audio.pause();
        }
    }, [bookMusicEnabled, hasBookMusic]); // Run when toggle changes or when music is loaded

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const data = await ApiService.getBookPages(bookId);

                // Add "The End" page as the last page
                // Simple wood plank background only - modal will appear on top
                const theEndBackground = 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="woodPlanks" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                                <rect width="100" height="100" fill="#8B4513"/>
                                <rect x="0" y="0" width="14" height="100" fill="#a05f2c"/>
                                <rect x="14" y="0" width="1" height="100" fill="#3e1f07"/>
                                <rect x="15" y="0" width="14" height="100" fill="#c28246"/>
                                <rect x="29" y="0" width="1" height="100" fill="#3e1f07"/>
                                <rect x="30" y="0" width="19" height="100" fill="#945829"/>
                                <rect x="49" y="0" width="1" height="100" fill="#3e1f07"/>
                                <rect x="50" y="0" width="24" height="100" fill="#b06d36"/>
                                <rect x="74" y="0" width="1" height="100" fill="#3e1f07"/>
                                <rect x="75" y="0" width="25" height="100" fill="#a05f2c"/>
                            </pattern>
                            <filter id="noise">
                                <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" stitchTiles="stitch"/>
                            </filter>
                        </defs>
                        <rect width="100" height="100" fill="url(#woodPlanks)"/>
                        <rect width="100" height="100" filter="url(#noise)" opacity="0.1"/>
                    </svg>
                `);

                const theEndPage: Page = {
                    _id: 'the-end-page',
                    pageNumber: data.length + 1,
                    backgroundUrl: theEndBackground,
                    backgroundType: 'image',
                    scrollUrl: '',
                    scrollHeight: 0,
                    textBoxes: [], // Empty - no text on the page itself, modal will show on top
                };

                setPages([...data, theEndPage]);

                // Check if page is specified in URL (from Continue button)
                const pageParam = searchParams.get('page');
                if (pageParam) {
                    const pageNum = parseInt(pageParam, 10);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= data.length) {
                        const pageIndex = pageNum - 1; // Convert to 0-based
                        setCurrentPageIndex(pageIndex);
                        currentPageIndexRef.current = pageIndex;
                        console.log(`📖 Navigated to page ${pageNum} from URL`);
                    }
                } else {
                    // Load saved reading progress if no URL param
                    const progress = readingProgressService.getProgress(bookId);
                    if (progress && progress.currentPageIndex >= 0 && progress.currentPageIndex < data.length) {
                        setCurrentPageIndex(progress.currentPageIndex);
                        currentPageIndexRef.current = progress.currentPageIndex;
                        console.log(`📖 Restored reading progress: Page ${progress.currentPageIndex + 1} of ${data.length}`);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch pages:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPages();

        // Fetch voices (only enabled voices from portal, filtered by unlock status)
        const fetchVoices = async () => {
            const voiceList = await ApiService.getVoices();
            if (voiceList.length > 0) {
                // Store all voices for display (locked/unlocked)
                setVoices(voiceList);
                
                // Get default voice from localStorage (set during onboarding)
                const defaultVoiceId = localStorage.getItem('godlykids_default_voice');
                
                // Find an unlocked voice to use as default
                const unlockedVoices = voiceList.filter((v: any) => isVoiceUnlocked(v.voice_id));
                
                if (defaultVoiceId && isVoiceUnlocked(defaultVoiceId)) {
                    // Use the default voice if it's unlocked
                    setSelectedVoiceId(defaultVoiceId);
                } else if (unlockedVoices.length > 0) {
                    // Use first unlocked voice
                    setSelectedVoiceId(unlockedVoices[0].voice_id);
                } else if (voiceList.length > 0) {
                    // Fallback: use first voice (will show as locked in UI)
                    setSelectedVoiceId(voiceList[0].voice_id);
                }
                console.log(`✅ Loaded ${voiceList.length} voice(s), ${unlockedVoices.length} unlocked`);
            } else {
                console.warn('⚠️ No voices enabled in portal. Please enable voices in the portal first.');
                setVoices([]);
            }
        };
        fetchVoices();

        // Load cloned voices from local storage
        const loadClonedVoices = () => {
            const cloned = voiceCloningService.getClonedVoices();
            setClonedVoices(cloned);
            console.log(`✅ Loaded ${cloned.length} cloned voice(s) from local storage`);
        };
        loadClonedVoices();
    }, [bookId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (voiceDropdownRef.current && !voiceDropdownRef.current.contains(event.target as Node)) {
                setShowVoiceDropdown(false);
            }
        };

        if (showVoiceDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showVoiceDropdown]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
            }
        };
    }, [currentAudio]);

    // Helper to map page data to include soundEffectUrl
    const mapPage = (page: Page | undefined) => {
        if (!page) return null;
        return {
            ...page,
            id: page._id,
            soundEffectUrl: page.files?.soundEffect?.url || page.soundEffectUrl
        };
    };

    const currentPage = mapPage(pages[currentPageIndex]);
    const isTheEndPage = currentPage?.id === 'the-end-page' || currentPageIndex === pages.length - 1;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex < pages.length - 1) {
            // Use desired scroll state if set, otherwise preserve current state from ref
            const scrollStateToUse = desiredScrollStateRef.current !== null
                ? desiredScrollStateRef.current
                : showScrollRef.current; // Use ref to get latest value
            desiredScrollStateRef.current = null; // Reset after use

            setIsPageTurning(true);
            setFlipState({ direction: 'next', isFlipping: true });
            playPageTurnSound(); // Play page turn sound effect

            // Change page content at the halfway point (when page is perpendicular - 90deg)
            setTimeout(() => {
                const nextIndex = currentPageIndex + 1;
                setCurrentPageIndex(nextIndex);
                currentPageIndexRef.current = nextIndex;
                // Use the determined scroll state
                setShowScroll(scrollStateToUse);
                showScrollRef.current = scrollStateToUse; // Update ref
            }, 700); // Halfway through 1.4s animation

            // End the flip animation
            setTimeout(() => {
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                const nextIndex = currentPageIndex + 1;
                if (bookId) {
                    readingProgressService.saveProgress(bookId, nextIndex);

                    // Check if book is completed (reached "The End" page)
                    if (nextIndex >= pages.length - 1) {
                        // Increment read count when book is completed (local)
                        readCountService.incrementReadCount(bookId);
                        // Mark book as permanently completed (unlocks games forever)
                        bookCompletionService.markBookCompleted(bookId);
                        // Increment global read count in database
                        ApiService.incrementBookReadCount(bookId);
                    }
                }
            }, 1500); // Slightly after 1.4s animation completes
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex > 0) {
            // Preserve scroll state when turning pages manually - use ref to get latest value
            const currentScrollState = showScrollRef.current;

            // For backwards, change the page immediately so the slide animation reveals the previous page
            const prevIndex = currentPageIndex - 1;
            setCurrentPageIndex(prevIndex);
            currentPageIndexRef.current = prevIndex;
            setShowScroll(currentScrollState);
            showScrollRef.current = currentScrollState;

            setIsPageTurning(true);
            setFlipState({ direction: 'prev', isFlipping: true });
            playPageTurnSound(); // Play page turn sound effect

            // End the slide animation (0.5s duration)
            setTimeout(() => {
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                if (bookId) {
                    readingProgressService.saveProgress(bookId, prevIndex);
                }
            }, 550); // Slightly after 0.5s animation completes
        }
    };

    // Swipe gesture handlers - more sensitive to prevent accidental page turns
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        swipeDetectedRef.current = false; // Reset swipe detection
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
        const swipeThresholdX = 100; // Increased from 50 - require more deliberate horizontal swipe
        const swipeThresholdY = 80; // Max vertical movement allowed (prevents diagonal swipes)
        const minSwipeTime = 100; // Minimum time in ms for a valid swipe (prevents accidental taps)
        const maxSwipeTime = 800; // Maximum time for swipe (too slow = not a swipe)
        
        const diffX = touchStartX.current - touchEndX.current;
        const diffY = Math.abs(touchStartY.current - touchEndY.current);
        const swipeTime = Date.now() - touchStartTime.current;

        // Only trigger page turn if:
        // 1. Horizontal swipe is significant (> threshold)
        // 2. Vertical movement is minimal (primarily horizontal gesture)
        // 3. Swipe duration is within valid range (not too fast/accidental, not too slow)
        const isValidSwipe = Math.abs(diffX) > swipeThresholdX && 
                             diffY < swipeThresholdY && 
                             swipeTime > minSwipeTime && 
                             swipeTime < maxSwipeTime;

        if (isValidSwipe) {
            swipeDetectedRef.current = true; // Mark that a swipe was detected
            if (diffX > 0) {
                // Swipe left - next page
                if (currentPageIndex < pages.length - 1) {
                    stopAudio();
                    handleNext({ stopPropagation: () => { } } as React.MouseEvent);
                }
            } else {
                // Swipe right - previous page
                if (currentPageIndex > 0) {
                    stopAudio();
                    handlePrev({ stopPropagation: () => { } } as React.MouseEvent);
                }
            }
            // Reset swipe detection after a delay to allow click handler to check it
            setTimeout(() => {
                swipeDetectedRef.current = false;
            }, 300);
        } else {
            // Not a valid swipe - allow tap/click to proceed
            swipeDetectedRef.current = false;
        }
    };

    const toggleScroll = (e?: React.MouseEvent) => {
        // Stop propagation to prevent music unlock
        if (e) {
            e.stopPropagation();
        }

        // Simply toggle scroll state - tapping should NEVER turn the page
        // Only swipe or auto-play should turn pages
        setShowScroll(prev => {
            const newState = !prev;
            showScrollRef.current = newState; // Update ref
            return newState;
        });
    };

    // Handle background tap - toggle scroll or turn page if auto-play is active
    const handleBackgroundTap = (e: React.MouseEvent) => {
        // Don't handle if a swipe was just detected (prevents tap after swipe)
        if (swipeDetectedRef.current) {
            swipeDetectedRef.current = false; // Reset for next interaction
            return;
        }

        // Don't handle if clicking on interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('.text-box')) {
            return;
        }

        e.stopPropagation();

        // If auto-play is active, turn page and lower scroll
        if (autoPlayMode || autoPlayModeRef.current) {
            // Turn to next page if available
            if (currentPageIndex < pages.length - 1) {
                stopAudio();
                handleNext({ stopPropagation: () => { } } as React.MouseEvent);
                // Lower scroll (user preference from last page)
                if (showScroll) {
                    setShowScroll(false);
                }
            }
        } else {
            // Normal mode: just toggle scroll
            toggleScroll(e);
        }
    };

    const stopAudio = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        setPlaying(false);
        setActiveTextBoxIndex(null);
        setAutoPlayMode(false);
        autoPlayModeRef.current = false;
        isAutoPlayingRef.current = false; // Reset auto-play flag
    };

    const handlePlayPage = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // If already playing, pause/stop and disable auto-play
        if (playing) {
            stopAudio();
            setAutoPlayMode(false);
            return;
        }

        // Enable auto-play mode and start playing
        setAutoPlayMode(true);
        autoPlayModeRef.current = true;

        // Play the first text box on the page
        if (currentPage.textBoxes && currentPage.textBoxes.length > 0) {
            const firstBox = currentPage.textBoxes[0];
            handlePlayText(firstBox.text, 0, e, true); // Pass autoPlay flag
        }
    };

    // Preload audio for upcoming pages (runs in background)
    const preloadUpcomingAudio = async (startPageIndex: number) => {
        const pagesToPreload = 3; // Preload next 3 pages
        
        for (let i = 0; i < pagesToPreload; i++) {
            const pageIndex = startPageIndex + i;
            if (pageIndex >= pages.length - 1) break; // Don't preload "The End" page
            
            const page = pages[pageIndex];
            if (!page || !page.textBoxes) continue;
            
            // Preload each text box on the page
            for (let textBoxIndex = 0; textBoxIndex < page.textBoxes.length; textBoxIndex++) {
                const textBox = page.textBoxes[textBoxIndex];
                if (!textBox.text) continue;
                
                const cacheKey = `${pageIndex}-${textBoxIndex}-${selectedVoiceId}`;
                
                // Skip if already cached or currently preloading
                if (audioPreloadCacheRef.current.has(cacheKey) || preloadingInProgressRef.current.has(cacheKey)) {
                    continue;
                }
                
                // Mark as preloading
                preloadingInProgressRef.current.add(cacheKey);
                
                // Preload in background (don't await to avoid blocking)
                (async () => {
                    try {
                        const processedText = processTextWithEmotionalCues(textBox.text);
                        const result = await ApiService.generateTTS(
                            processedText.ttsText,
                            selectedVoiceId,
                            bookId || undefined
                        );
                        
                        if (result && result.audioUrl) {
                            audioPreloadCacheRef.current.set(cacheKey, {
                                audioUrl: result.audioUrl,
                                alignment: result.alignment
                            });
                            console.log(`🎵 Preloaded audio for page ${pageIndex + 1}, text box ${textBoxIndex + 1}`);
                        }
                    } catch (err) {
                        console.warn(`Failed to preload audio for page ${pageIndex + 1}:`, err);
                    } finally {
                        preloadingInProgressRef.current.delete(cacheKey);
                    }
                })();
            }
        }
    };

    // Trigger preloading when page changes or voice changes
    useEffect(() => {
        if (pages.length > 0 && selectedVoiceId) {
            // Start preloading from current page
            preloadUpcomingAudio(currentPageIndex);
        }
    }, [currentPageIndex, selectedVoiceId, pages.length]);

    const handlePlayText = async (text: string, index: number, e: React.MouseEvent, isAutoPlay: boolean = false) => {
        e.stopPropagation();

        // If already playing this text, pause it
        if (playing && activeTextBoxIndex === index) {
            currentAudio?.pause();
            setPlaying(false);
            setAutoPlayMode(false);
            autoPlayModeRef.current = false;
            return;
        }

        // If playing another text, stop it
        if (playing && activeTextBoxIndex !== index) {
            stopAudio();
        }

        // If we have audio for this text already loaded and paused, resume it
        if (activeTextBoxIndex === index && currentAudio) {
            currentAudio.play();
            setPlaying(true);
            if (isAutoPlay) {
                setAutoPlayMode(true);
                autoPlayModeRef.current = true;
            }
            return;
        }

        // Otherwise, generate/fetch new audio
        setActiveTextBoxIndex(index);
        setLoadingAudio(true);
        setCurrentWordIndex(-1);
        setWordAlignment(null);
        wordAlignmentRef.current = null;
        alignmentWarningShownRef.current = false; // Reset warning flag for new audio

        try {
            // Check preload cache first - use ref for accurate page index (state might be stale)
            const actualPageIndex = currentPageIndexRef.current;
            const cacheKey = `${actualPageIndex}-${index}-${selectedVoiceId}`;
            let result = audioPreloadCacheRef.current.get(cacheKey);
            
            if (result) {
                console.log(`🎵 Using preloaded audio for page ${actualPageIndex + 1}, text box ${index + 1}`);
            } else {
                // Not in cache, generate now
                const processedText = processTextWithEmotionalCues(text);
                result = await ApiService.generateTTS(
                    processedText.ttsText, // Send text with cues to ElevenLabs
                    selectedVoiceId,
                    bookId || undefined
                ) || undefined;
            }

            // Use audio URL (from cache or freshly generated)
            if (result && result.audioUrl) {
                const audio = new Audio(result.audioUrl);

                // Wait for audio metadata to load so we can get the actual duration
                audio.addEventListener('loadedmetadata', () => {
                    const alignment = result.alignment || null;
                    if (alignment && alignment.words) {
                        // Filter out emotional cue words from alignment and remap indices
                        const filteredWords: Array<{ word: string; start: number; end: number; originalIndex: number }> = [];
                        alignment.words.forEach((w: any, idx: number) => {
                            // Skip words that are only emotional cues (like "[excited]")
                            if (!w.word.match(/^\[.*\]$/)) {
                                // Remove cues from word text but keep the word
                                const cleanedWord = w.word.replace(/\[([^\]]+)\]/g, '').trim();
                                if (cleanedWord.length > 0) {
                                    filteredWords.push({
                                        word: cleanedWord,
                                        start: w.start,
                                        end: w.end,
                                        originalIndex: idx
                                    });
                                }
                            }
                        });

                        const actualDuration = audio.duration;
                        const estimatedDuration = filteredWords.length * 0.4; // Our estimated duration

                        // Scale word timings to match actual audio duration
                        if (actualDuration > 0 && estimatedDuration > 0) {
                            const scaleFactor = actualDuration / estimatedDuration;
                            const scaledAlignment = {
                                words: filteredWords.map((w) => ({
                                    word: w.word,
                                    start: w.start * scaleFactor,
                                    end: w.end * scaleFactor
                                }))
                            };
                            console.log('📝 Scaled alignment (with cues filtered):', {
                                estimatedDuration: estimatedDuration.toFixed(2),
                                actualDuration: actualDuration.toFixed(2),
                                scaleFactor: scaleFactor.toFixed(2),
                                words: scaledAlignment.words.length,
                                originalWords: alignment.words.length
                            });
                            setWordAlignment(scaledAlignment);
                            wordAlignmentRef.current = scaledAlignment;
                        } else {
                            const filteredAlignment = {
                                words: filteredWords.map((w) => ({
                                    word: w.word,
                                    start: w.start,
                                    end: w.end
                                }))
                            };
                            setWordAlignment(filteredAlignment);
                            wordAlignmentRef.current = filteredAlignment;
                        }
                    } else {
                        console.warn('⚠️ No alignment data in result:', result);
                    }
                });

                // Track audio time for word highlighting
                // Use ref to access latest alignment data (avoids closure issues)
                audio.ontimeupdate = () => {
                    const currentAlignment = wordAlignmentRef.current;
                    if (currentAlignment && currentAlignment.words && currentAlignment.words.length > 0) {
                        const currentTime = audio.currentTime;
                        const wordIndex = currentAlignment.words.findIndex(
                            (w: any) => currentTime >= w.start && currentTime < w.end
                        );

                        // Log every 10th update to avoid console spam
                        if (Math.floor(currentTime * 10) % 10 === 0) {
                            console.log('🕐 Audio time:', currentTime.toFixed(2), 'Word index:', wordIndex);
                            if (wordIndex !== -1) {
                                const word = currentAlignment.words[wordIndex];
                                console.log('📍 Current word:', word.word, `[${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s]`);
                            }
                        }

                        if (wordIndex !== -1 && wordIndex !== currentWordIndex) {
                            console.log('✨ Highlighting word', wordIndex, ':', currentAlignment.words[wordIndex].word);
                            setCurrentWordIndex(wordIndex);
                        }
                        // Don't reset highlighting when past last word - keep it on the last word
                        // This ensures all words get highlighted even if timing is slightly off
                    } else if (!currentAlignment && !alignmentWarningShownRef.current && loadingAudio) {
                        // Only warn once while loading, not continuously
                        alignmentWarningShownRef.current = true;
                        console.warn('⚠️ No alignment data available for highlighting (still loading...)');
                    }
                };

                audio.onended = () => {
                    // Highlight the last word when audio ends
                    const currentAlignment = wordAlignmentRef.current;
                    if (currentAlignment && currentAlignment.words && currentAlignment.words.length > 0) {
                        setCurrentWordIndex(currentAlignment.words.length - 1);
                        // Clear after a brief moment to show completion
                        setTimeout(() => {
                            setCurrentWordIndex(-1);
                            setPlaying(false);
                            setActiveTextBoxIndex(null);
                            setWordAlignment(null);
                            wordAlignmentRef.current = null;

                            // Auto-play: Move to next page if enabled
                            // Use refs to get latest values (closure-safe)
                            const currentPageIdx = currentPageIndexRef.current;
                            if (autoPlayModeRef.current && !isAutoPlayingRef.current && currentPageIdx < pages.length - 1) {
                                isAutoPlayingRef.current = true; // Prevent multiple calls
                                const nextPageIndex = currentPageIdx + 1;
                                console.log('🔄 Auto-play: Moving to page', nextPageIndex + 1, `(from page ${currentPageIdx + 1})`);
                                
                                // Trigger the page flip animation
                                setIsPageTurning(true);
                                setFlipState({ direction: 'next', isFlipping: true });
                                playPageTurnSound(); // Play page turn sound effect
                                
                                // Change page content at the halfway point (700ms into 1.4s animation)
                                setTimeout(() => {
                                    setCurrentPageIndex(nextPageIndex);
                                    currentPageIndexRef.current = nextPageIndex; // Update ref
                                    // Preserve scroll state during page turns (both manual and auto-play)
                                    setShowScroll(showScrollRef.current);
                                    // Save progress
                                    if (bookId) {
                                        readingProgressService.saveProgress(bookId, nextPageIndex);
                                    }
                                }, 700);
                                
                                // End animation and start next page audio
                                setTimeout(() => {
                                    setIsPageTurning(false);
                                    setFlipState(null);

                                    // Wait a moment for page to render, then auto-play next page
                                    setTimeout(() => {
                                        // Check again if auto-play is still enabled and we're on the correct page
                                        if (autoPlayModeRef.current && currentPageIndexRef.current === nextPageIndex) {
                                            const nextPage = pages[nextPageIndex];
                                            if (nextPage && nextPage.textBoxes && nextPage.textBoxes.length > 0) {
                                                const firstBox = nextPage.textBoxes[0];
                                                console.log('▶️ Auto-play: Starting next page audio');
                                                isAutoPlayingRef.current = false; // Reset flag before calling
                                                const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                                handlePlayText(firstBox.text, 0, syntheticEvent, true);
                                            } else {
                                                console.log('⏹️ Auto-play: No text boxes on next page, stopping');
                                                setAutoPlayMode(false);
                                                autoPlayModeRef.current = false;
                                                isAutoPlayingRef.current = false;
                                            }
                                        } else {
                                            console.log('⏹️ Auto-play: Cancelled or page changed');
                                            isAutoPlayingRef.current = false;
                                        }
                                    }, 200);
                                }, 1500); // After 1.4s animation completes
                            } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                                // Reached end of book, stop auto-play
                                console.log('🏁 Auto-play: Reached end of book, stopping');
                                setAutoPlayMode(false);
                                autoPlayModeRef.current = false;
                                isAutoPlayingRef.current = false;
                                // Increment read count when book is completed
                                if (bookId) {
                                    readCountService.incrementReadCount(bookId);
                                    // Mark book as permanently completed (unlocks games forever)
                                    bookCompletionService.markBookCompleted(bookId);
                                    // Increment global read count in database
                                    ApiService.incrementBookReadCount(bookId);
                                }
                            } else if (isAutoPlayingRef.current) {
                                console.log('⏸️ Auto-play: Already processing, skipping');
                            }
                        }, 500);
                    } else {
                        setPlaying(false);
                        setActiveTextBoxIndex(null);
                        setCurrentWordIndex(-1);
                        setWordAlignment(null);
                        wordAlignmentRef.current = null;

                        // Auto-play: Move to next page if enabled
                        // Use refs to get latest values (closure-safe)
                        const currentPageIdx = currentPageIndexRef.current;
                        if (autoPlayModeRef.current && !isAutoPlayingRef.current && currentPageIdx < pages.length - 1) {
                            isAutoPlayingRef.current = true; // Prevent multiple calls
                            const nextPageIndex = currentPageIdx + 1;
                            console.log('🔄 Auto-play: Moving to page', nextPageIndex + 1, `(from page ${currentPageIdx + 1})`);
                            
                            // Trigger the page flip animation
                            setIsPageTurning(true);
                            setFlipState({ direction: 'next', isFlipping: true });
                            playPageTurnSound(); // Play page turn sound effect
                            
                            // Change page content at the halfway point (700ms into 1.4s animation)
                            setTimeout(() => {
                                setCurrentPageIndex(nextPageIndex);
                                currentPageIndexRef.current = nextPageIndex; // Update ref
                                // Preserve scroll state during page turns (both manual and auto-play)
                                setShowScroll(showScrollRef.current);
                                // Save progress
                                if (bookId) {
                                    readingProgressService.saveProgress(bookId, nextPageIndex);
                                }
                            }, 700);
                            
                            // End animation and start next page audio
                            setTimeout(() => {
                                setIsPageTurning(false);
                                setFlipState(null);

                                // Wait a moment for page to render, then auto-play next page
                                setTimeout(() => {
                                    // Check again if auto-play is still enabled and we're on the correct page
                                    if (autoPlayModeRef.current && currentPageIndexRef.current === nextPageIndex) {
                                        const nextPage = pages[nextPageIndex];
                                        if (nextPage && nextPage.textBoxes && nextPage.textBoxes.length > 0) {
                                            const firstBox = nextPage.textBoxes[0];
                                            console.log('▶️ Auto-play: Starting next page audio');
                                            isAutoPlayingRef.current = false; // Reset flag before calling
                                            const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                            handlePlayText(firstBox.text, 0, syntheticEvent, true);
                                        } else {
                                            console.log('⏹️ Auto-play: No text boxes on next page, stopping');
                                            setAutoPlayMode(false);
                                            autoPlayModeRef.current = false;
                                            isAutoPlayingRef.current = false;
                                        }
                                    } else {
                                        console.log('⏹️ Auto-play: Cancelled or page changed');
                                        isAutoPlayingRef.current = false;
                                    }
                                }, 200);
                            }, 1500); // After 1.4s animation completes
                        } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                            // Reached end of book, stop auto-play
                            console.log('🏁 Auto-play: Reached end of book, stopping');
                            setAutoPlayMode(false);
                            autoPlayModeRef.current = false;
                            isAutoPlayingRef.current = false;
                            // Increment read count when book is completed
                            if (bookId) {
                                readCountService.incrementReadCount(bookId);
                                // Mark book as permanently completed (unlocks games forever)
                                bookCompletionService.markBookCompleted(bookId);
                                // Increment global read count in database
                                ApiService.incrementBookReadCount(bookId);
                            }
                        } else if (isAutoPlayingRef.current) {
                            console.log('⏸️ Auto-play: Already processing, skipping');
                        }
                    }
                };

                audio.onplay = () => setPlaying(true);
                audio.onpause = () => setPlaying(false);

                setCurrentAudio(audio);
                audio.play();
            } else {
                console.error('No audio URL returned');
                alert('Failed to generate audio. Please check the API key.');
                setActiveTextBoxIndex(null);
            }
        } catch (error) {
            console.error('Failed to play audio:', error);
            alert('Failed to play audio. The TTS service might be unavailable.');
            setActiveTextBoxIndex(null);
        } finally {
            setLoadingAudio(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                Loading book...
            </div>
        );
    }

    if (pages.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <h2 className="text-2xl font-bold mb-4">No pages found</h2>
                <button
                    onClick={() => {
                        // Restore music before navigating back
                        const wasEnabled = wasMusicEnabledRef.current || localStorage.getItem('godly_kids_music_was_enabled') === 'true';

                        if (wasEnabled) {
                            console.log('🎵 Back button: Restoring background music before navigating');

                            // First, ensure music is enabled in state
                            if (!musicEnabled) {
                                toggleMusic();
                            }

                            // Then programmatically click the music button in the header after navigation
                            // This ensures the audio context is unlocked and music actually plays
                            setTimeout(() => {
                                const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
                                if (musicButton) {
                                    console.log('🎵 Programmatically clicking music button to restore playback');
                                    musicButton.click();
                                }
                            }, 150);

                            // Clear the flag
                            localStorage.removeItem('godly_kids_music_was_enabled');
                        }

                        // Navigate back to book detail page explicitly
                        if (bookId) {
                            navigate(`/book/${bookId}`);
                        } else {
                            navigate(-1);
                        }
                    }}
                    className="bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700 transition"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div
            className="relative w-full h-screen bg-gray-900 overflow-hidden flex flex-col"
            onTouchStart={(e) => {
                // Block any music from playing on touch
                e.stopPropagation();
            }}
            onClick={(e) => {
                // Block any music from playing on click
                e.stopPropagation();
            }}
        >
            {/* Top Toolbar - Clean and Compact */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-3 z-50 pointer-events-none">
                {/* Back Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();

                        // Restore music before navigating back
                        const wasEnabled = wasMusicEnabledRef.current || localStorage.getItem('godly_kids_music_was_enabled') === 'true';

                        if (wasEnabled) {
                            console.log('🎵 Back button: Restoring background music before navigating');

                            // First, ensure music is enabled in state
                            if (!musicEnabled) {
                                toggleMusic();
                            }

                            // Then programmatically click the music button in the header after navigation
                            // This ensures the audio context is unlocked and music actually plays
                            setTimeout(() => {
                                const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
                                if (musicButton) {
                                    console.log('🎵 Programmatically clicking music button to restore playback');
                                    musicButton.click();
                                }
                            }, 150);

                            // Clear the flag
                            localStorage.removeItem('godly_kids_music_was_enabled');
                        }

                        // Navigate back to book detail page explicitly
                        if (bookId) {
                            navigate(`/book/${bookId}`);
                        } else {
                            navigate(-1);
                        }
                    }}
                    className="pointer-events-auto bg-black/40 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/60 transition"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Right: Voice Selector and Music Toggle */}
                <div className="pointer-events-auto flex items-center gap-2">
                    {/* Background Music Toggle - Only show if book has music */}
                    {hasBookMusic ? (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newState = !bookMusicEnabled;
                                    setBookMusicEnabled(newState);

                                    if (bookBackgroundMusicRef.current) {
                                        if (newState) {
                                            // Update volume when playing (use ref for current value)
                                            bookBackgroundMusicRef.current.volume = BOOK_MUSIC_VOLUME;
                                            bookBackgroundMusicRef.current.play().catch(err => {
                                                console.warn('Could not play book music:', err);
                                            });
                                        } else {
                                            bookBackgroundMusicRef.current.pause();
                                        }
                                    }
                                }}
                                className={`bg-black/50 backdrop-blur-md rounded-full p-3 hover:bg-black/70 transition-all border ${bookMusicEnabled
                                    ? 'border-yellow-400/50 shadow-lg shadow-yellow-400/20'
                                    : 'border-white/20'
                                    }`}
                                title={bookMusicEnabled ? "Disable background music" : "Enable background music"}
                            >
                                <Music className={`w-6 h-6 ${bookMusicEnabled ? 'text-yellow-300' : 'text-white/50'}`} />
                            </button>
                            
                        </>
                    ) : (
                        <div className="text-xs text-white/50 px-2">
                            {/* Debug: Show why button isn't showing */}
                            {process.env.NODE_ENV === 'development' && (
                                <span>No music</span>
                            )}
                        </div>
                    )}

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
                            className="bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-black/60 transition-colors"
                        >
                            <Volume2 className="w-4 h-4 text-white" />
                            <span className="text-white text-xs max-w-[100px] truncate">
                                {voices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                    clonedVoices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                    'Voice'}
                            </span>
                        </button>

                        {/* Dropdown Menu - Opens BELOW the button */}
                        {showVoiceDropdown && (
                            <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-[100] min-w-[220px] max-w-[300px] max-h-[350px] overflow-y-auto">
                                <div className="py-2">
                                    {/* Unlocked Voices Section - with green checkmark indicator */}
                                    {voices.filter(v => isVoiceUnlocked(v.voice_id)).length > 0 && (
                                        <>
                                            <div className="px-4 py-1.5 text-xs text-green-400 uppercase tracking-wider font-bold flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Your Voices
                                            </div>
                                            {voices.filter(v => isVoiceUnlocked(v.voice_id)).map(v => (
                                                <button
                                                    key={v.voice_id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedVoiceId(v.voice_id);
                                                        setShowVoiceDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-white/20' : ''}`}
                                                >
                                                    {selectedVoiceId === v.voice_id ? (
                                                        <Check className="w-4 h-4 text-[#FFD700]" />
                                                    ) : (
                                                        <div className="w-4 h-4" />
                                                    )}
                                                    <span className={selectedVoiceId === v.voice_id ? 'font-bold' : ''}>
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
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-white/20' : ''}`}
                                                >
                                                    {selectedVoiceId === v.voice_id ? (
                                                        <Check className="w-4 h-4 text-[#FFD700]" />
                                                    ) : (
                                                        <div className="w-4 h-4" />
                                                    )}
                                                    <span className={selectedVoiceId === v.voice_id ? 'font-bold' : ''}>
                                                        {v.name} (Cloned)
                                                    </span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* Locked Voices Section (only show if not premium) */}
                                    {!isSubscribed && voices.filter(v => !isVoiceUnlocked(v.voice_id)).length > 0 && (
                                        <>
                                            <div className="border-t border-white/20 my-2"></div>
                                            <div className="px-4 py-1.5 text-xs text-white/40 uppercase tracking-wider font-bold flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Locked
                                            </div>
                                            {voices.filter(v => !isVoiceUnlocked(v.voice_id)).map(v => (
                                                <button
                                                    key={v.voice_id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Navigate to shop to unlock
                                                        setShowVoiceDropdown(false);
                                                        navigate('/profile', { state: { openShop: true, shopTab: 'voices' } });
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm text-white/40 hover:bg-white/5 transition-colors flex items-center gap-2"
                                                >
                                                    <Lock className="w-4 h-4 text-white/30" />
                                                    <span>{v.name}</span>
                                                    <span className="ml-auto text-xs text-[#FFD700] font-bold">Unlock</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* No voices message */}
                                    {voices.length === 0 && clonedVoices.length === 0 && (
                                        <div className="px-4 py-3 text-sm text-white/70 text-center">
                                            No voices available
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Reading Area */}
            <div
                className="flex-1 w-full h-full relative overflow-hidden bg-gray-900"
                onClick={handleBackgroundTap}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Style for high-sheen 3D glossy white page curl animation */}
                <style>{`
                    /* Enhanced 3D page curl with more dramatic rotation */
                    @keyframes pageCurlNext {
                        0% { 
                            transform: perspective(2000px) rotateY(0deg) rotateX(0deg) translateZ(0px);
                        }
                        15% {
                            transform: perspective(2000px) rotateY(-20deg) rotateX(2deg) translateZ(30px);
                        }
                        35% { 
                            transform: perspective(2000px) rotateY(-60deg) rotateX(3deg) translateZ(60px);
                        }
                        50% { 
                            transform: perspective(2000px) rotateY(-90deg) rotateX(4deg) translateZ(80px);
                        }
                        65% {
                            transform: perspective(2000px) rotateY(-120deg) rotateX(3deg) translateZ(60px);
                        }
                        85% {
                            transform: perspective(2000px) rotateY(-160deg) rotateX(2deg) translateZ(30px);
                        }
                        100% { 
                            transform: perspective(2000px) rotateY(-180deg) rotateX(0deg) translateZ(0px);
                        }
                    }
                    
                    /* Previous page animation - simple smooth slide from left */
                    @keyframes pageCurlPrev {
                        0% { 
                            transform: translateX(-100%);
                            opacity: 0;
                        }
                        20% {
                            opacity: 1;
                        }
                        100% { 
                            transform: translateX(0%);
                            opacity: 1;
                        }
                    }
                    
                    /* Multiple shimmer waves for high sheen effect */
                    @keyframes shimmerWave1 {
                        0% { 
                            left: -50%;
                            opacity: 0;
                        }
                        15% {
                            opacity: 0.8;
                        }
                        85% {
                            opacity: 0.8;
                        }
                        100% { 
                            left: 120%;
                            opacity: 0;
                        }
                    }
                    
                    @keyframes shimmerWave2 {
                        0% { 
                            left: -30%;
                            opacity: 0;
                        }
                        20% {
                            opacity: 0.6;
                        }
                        80% {
                            opacity: 0.6;
                        }
                        100% { 
                            left: 130%;
                            opacity: 0;
                        }
                    }
                    
                    @keyframes shimmerWave3 {
                        0% { 
                            left: -70%;
                            opacity: 0;
                        }
                        25% {
                            opacity: 0.4;
                        }
                        75% {
                            opacity: 0.4;
                        }
                        100% { 
                            left: 110%;
                            opacity: 0;
                        }
                    }
                    
                    /* Pulsing glow effect */
                    @keyframes sheenPulse {
                        0%, 100% { 
                            opacity: 0.3;
                        }
                        50% { 
                            opacity: 0.7;
                        }
                    }
                    
                    /* Shadow that grows and moves during curl */
                    @keyframes curlShadowGrow {
                        0% { 
                            opacity: 0;
                            width: 0px;
                        }
                        30% { 
                            opacity: 0.5;
                            width: 120px;
                        }
                        50% { 
                            opacity: 0.6;
                            width: 150px;
                        }
                        70% {
                            opacity: 0.5;
                            width: 120px;
                        }
                        100% { 
                            opacity: 0;
                            width: 0px;
                        }
                    }
                    
                    .page-curl-next {
                        animation: pageCurlNext 1.4s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
                        transform-origin: left center;
                        transform-style: preserve-3d;
                    }
                    
                    .page-curl-prev {
                        animation: pageCurlPrev 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
                    }
                    
                    .shimmer-wave-1 {
                        animation: shimmerWave1 1.4s ease-out forwards;
                    }
                    
                    .shimmer-wave-2 {
                        animation: shimmerWave2 1.4s ease-out 0.1s forwards;
                    }
                    
                    .shimmer-wave-3 {
                        animation: shimmerWave3 1.4s ease-out 0.05s forwards;
                    }
                    
                    .sheen-pulse {
                        animation: sheenPulse 0.7s ease-in-out infinite;
                    }
                    
                    .curl-shadow {
                        animation: curlShadowGrow 1.4s ease-in-out forwards;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes scaleUp {
                        from { transform: scale(0.8); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `}</style>

                {/* Page Container with deep perspective for realistic 3D curl */}
                <div className="relative w-full h-full" style={{ perspective: '1800px', perspectiveOrigin: 'center center' }}>

                    {/* The actual page content - with slide animation for prev direction */}
                    <div className={`absolute inset-0 z-10 ${flipState?.direction === 'prev' ? 'page-curl-prev' : ''}`}>
                        <BookPageRenderer
                            page={currentPage}
                            activeTextBoxIndex={activeTextBoxIndex}
                            showScroll={showScroll}
                            onToggleScroll={toggleScroll}
                            onPlayText={handlePlayText}
                            highlightedWordIndex={currentWordIndex}
                            wordAlignment={wordAlignment}
                        />
                    </div>

                    {/* High-sheen glossy white page that curls over - ONLY for next direction */}
                    {flipState && flipState.direction === 'next' && (
                        <>
                            {/* Dynamic shadow cast by the curling page */}
                            <div 
                                className="absolute top-0 bottom-0 z-40 pointer-events-none curl-shadow"
                                style={{
                                    left: 0,
                                    right: 'auto',
                                    background: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.05) 70%, transparent 100%)',
                                }}
                            />
                            
                            {/* The curling glossy white page */}
                            <div 
                                className="absolute inset-0 z-50 pointer-events-none page-curl-next"
                            >
                                {/* Front of page - HIGH SHEEN glossy white */}
                                <div 
                                    className="absolute inset-0"
                                    style={{
                                        background: 'linear-gradient(155deg, #ffffff 0%, #fefefe 15%, #fcfcfa 30%, #fafaf8 45%, #f8f8f5 60%, #f5f5f2 75%, #f2f2ef 90%, #efefec 100%)',
                                        backfaceVisibility: 'hidden',
                                        boxShadow: `
                                            inset 0 0 150px rgba(255,255,255,0.8),
                                            inset 0 0 50px rgba(255,255,255,0.5),
                                            -12px 0 35px rgba(0,0,0,0.2),
                                            -4px 0 15px rgba(0,0,0,0.15),
                                            -1px 0 5px rgba(0,0,0,0.1)
                                        `,
                                    }}
                                >
                                    {/* Fine paper texture */}
                                    <div 
                                        className="absolute inset-0 opacity-[0.015]"
                                        style={{
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                                        }}
                                    />
                                    
                                    {/* Base glossy sheen layer */}
                                    <div 
                                        className="absolute inset-0 sheen-pulse"
                                        style={{
                                            background: 'linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 25%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0) 100%)',
                                        }}
                                    />
                                    
                                    {/* Multiple shimmer waves for high sheen effect */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        {/* Primary shimmer wave - bright and wide */}
                                        <div 
                                            className="absolute top-0 bottom-0 shimmer-wave-1"
                                            style={{
                                                width: '35%',
                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 15%, rgba(255,255,255,0.7) 45%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.7) 55%, rgba(255,255,255,0.2) 85%, transparent 100%)',
                                                transform: 'skewX(-15deg)',
                                            }}
                                        />
                                        {/* Secondary shimmer wave - softer */}
                                        <div 
                                            className="absolute top-0 bottom-0 shimmer-wave-2"
                                            style={{
                                                width: '25%',
                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 80%, transparent 100%)',
                                                transform: 'skewX(-25deg)',
                                            }}
                                        />
                                        {/* Tertiary shimmer wave - subtle accent */}
                                        <div 
                                            className="absolute top-0 bottom-0 shimmer-wave-3"
                                            style={{
                                                width: '15%',
                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                                                transform: 'skewX(-10deg)',
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Bright curl edge highlight - always on right side (lifting edge) */}
                                    <div 
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '6px',
                                            right: 0,
                                            background: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.9) 70%, rgba(255,255,255,1))',
                                            boxShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)',
                                        }}
                                    />
                                    
                                    {/* Gradient shadow near curl edge for depth */}
                                    <div 
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '100px',
                                            right: '6px',
                                            background: 'linear-gradient(to left, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 40%, transparent 100%)',
                                        }}
                                    />
                                    
                                    {/* Opposite edge subtle highlight */}
                                    <div 
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '2px',
                                            left: 0,
                                            background: 'linear-gradient(to bottom, rgba(200,200,200,0.3), rgba(200,200,200,0.2) 50%, rgba(200,200,200,0.3))',
                                        }}
                                    />
                                </div>
                                
                                {/* Back of page - slightly darker with subtle sheen */}
                                <div 
                                    className="absolute inset-0"
                                    style={{
                                        background: 'linear-gradient(155deg, #f8f8f5 0%, #f5f5f2 20%, #f0f0ed 40%, #ebebea 60%, #e8e8e5 80%, #e5e5e2 100%)',
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    {/* Paper texture on back */}
                                    <div 
                                        className="absolute inset-0 opacity-[0.02]"
                                        style={{
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                                        }}
                                    />
                                    
                                    {/* Subtle matte sheen on back */}
                                    <div 
                                        className="absolute inset-0"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.2) 60%, rgba(255,255,255,0) 100%)',
                                        }}
                                    />
                                    
                                    {/* Edge shadow on back */}
                                    <div 
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '60px',
                                            left: 0,
                                            background: 'linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)',
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Navigation is now swipe-only - removed click zones */}
            </div>

            {/* Wood Play Button - Positioned above the scroll */}
            <div
                className={`absolute left-4 z-40 transition-all duration-500 ${showScroll
                    ? 'bottom-[calc(30%+1rem)]' // Position above scroll (30% height + 1rem spacing)
                    : 'bottom-4' // When scroll is hidden, position at bottom
                    }`}
                style={{
                    // Use scrollHeight if available, otherwise default to 30%
                    bottom: showScroll && currentPage.scrollHeight
                        ? `calc(${currentPage.scrollHeight}px + 1rem)`
                        : showScroll
                            ? 'calc(30% + 1rem)'
                            : '1rem'
                }}
            >
                <WoodButton
                    onClick={handlePlayPage}
                    icon={loadingAudio ? (
                        <div className="w-6 h-6 border-4 border-[#3e2723] border-t-transparent rounded-full animate-spin" />
                    ) : playing ? (
                        <Pause className="w-8 h-8 fill-current" />
                    ) : (
                        <Play className="w-8 h-8 fill-current ml-1" />
                    )}
                />
            </div>

            {/* Page Counter - Bottom Right */}
            <div className="absolute bottom-4 right-4 z-50 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium pointer-events-auto">
                    {currentPageIndex + 1} / {pages.length}
                </div>
            </div>

            {/* The End Page Overlay */}
            {isTheEndPage && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
                    <div className="relative bg-[#DEB887] p-8 rounded-3xl shadow-2xl border-8 border-[#5D4037] max-w-md w-full mx-4 transform animate-[scaleUp_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)] overflow-hidden">
                        {/* Realistic Wood Texture Background */}
                        <div className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `
                                    repeating-linear-gradient(45deg, rgba(93, 64, 55, 0.05) 0px, rgba(93, 64, 55, 0.05) 2px, transparent 2px, transparent 8px),
                                    repeating-linear-gradient(-45deg, rgba(93, 64, 55, 0.05) 0px, rgba(93, 64, 55, 0.05) 2px, transparent 2px, transparent 6px),
                                    linear-gradient(to bottom right, rgba(0,0,0,0.1), rgba(0,0,0,0.3))
                                `,
                                backgroundSize: '100% 100%, 100% 100%, 100% 100%'
                            }}
                        />

                        {/* Inner Bevel/Highlight */}
                        <div className="absolute inset-0 border-4 border-[#ffffff20] rounded-[20px] pointer-events-none"></div>

                        {/* Content */}
                        <div className="relative flex flex-col items-center gap-6 text-center z-10">
                            {/* Header */}
                            <div className="space-y-2">
                                <h2 className="text-5xl font-black text-[#3E2723] drop-shadow-sm font-display tracking-wide animate-bounce"
                                    style={{ textShadow: '2px 2px 0px rgba(255,255,255,0.4)' }}>
                                    The End!
                                </h2>
                                <p className="text-[#3E2723] font-bold text-lg opacity-90">
                                    Great reading! What's next?
                                </p>
                            </div>

                            {/* Action Buttons Grid */}
                            <div className="flex flex-col gap-4 w-full">
                                {/* Take Quiz Button */}
                                {quizAttemptCount < 2 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Stop congrats audio if playing
                                            if (congratsAudioRef.current) {
                                                congratsAudioRef.current.pause();
                                            }
                                            setShowQuizModal(true);
                                        }}
                                        disabled={quizLoading}
                                        className="bg-[#FF9800] hover:bg-[#F57C00] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#E65100] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
                                    >
                                        {quizLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        )}
                                        <span>Take Quiz</span>
                                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                            {quizAttemptCount}/2
                                        </span>
                                    </button>
                                )}
                                
                                {quizAttemptCount >= 2 && (
                                    <div className="bg-[#9E9E9E] text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 opacity-75">
                                        <BookOpen className="w-5 h-5" />
                                        <span>Quiz Completed</span>
                                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                            2/2
                                        </span>
                                    </div>
                                )}

                                {/* Read Again */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Stop congrats audio if playing
                                        if (congratsAudioRef.current) {
                                            congratsAudioRef.current.pause();
                                        }
                                        setCongratsAudioPlayed(false); // Reset for next read
                                        setCurrentPageIndex(0);
                                    }}
                                    className="bg-[#4CAF50] hover:bg-[#43A047] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#2E7D32] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <RotateCcw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" />
                                    Read Again
                                </button>

                                {/* Go Home */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Stop congrats audio if playing
                                        if (congratsAudioRef.current) {
                                            congratsAudioRef.current.pause();
                                        }
                                        // Restore music before navigating
                                        const wasEnabled = wasMusicEnabledRef.current || localStorage.getItem('godly_kids_music_was_enabled') === 'true';
                                        if (wasEnabled && !musicEnabled) {
                                            toggleMusic();
                                        }
                                        setTimeout(() => {
                                            const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
                                            if (musicButton) {
                                                musicButton.click();
                                            }
                                        }, 150);
                                        navigate('/home');
                                    }}
                                    className="bg-[#2196F3] hover:bg-[#1E88E5] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#1565C0] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    <span>Home</span>
                                </button>
                            </div>

                            {/* Social Actions */}
                            <div className="flex gap-4 w-full justify-center pt-4 border-t border-[#8B4513]/20">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (bookId) {
                                            const newFavoriteState = favoritesService.toggleFavorite(bookId);
                                            setIsFavorite(newFavoriteState);
                                        }
                                    }}
                                    className={`p-3 rounded-full shadow-md transition-transform active:scale-90 border-2 ${isFavorite
                                        ? 'bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-[#FFD700] hover:text-[#FFD700]'}`}
                                    title="Add to Favorites"
                                >
                                    <Star className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (bookId) {
                                            const newLikeState = favoritesService.toggleLike(bookId);
                                            setIsLiked(newLikeState);
                                        }
                                    }}
                                    className={`p-3 rounded-full shadow-md transition-transform active:scale-90 border-2 ${isLiked
                                        ? 'bg-[#FF5252] border-[#D32F2F] text-white'
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-[#FF5252] hover:text-[#FF5252]'}`}
                                    title="Like Book"
                                >
                                    <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Voice Cloning Modal */}
            <VoiceCloningModal
                isOpen={showVoiceCloningModal}
                onClose={() => setShowVoiceCloningModal(false)}
                onVoiceCloned={(voice) => {
                    // Reload cloned voices
                    const cloned = voiceCloningService.getClonedVoices();
                    setClonedVoices(cloned);
                    // Optionally select the newly cloned voice
                    setSelectedVoiceId(voice.voice_id);
                }}
            />

            {/* Book Quiz Modal */}
            <BookQuizModal
                isOpen={showQuizModal}
                onClose={() => setShowQuizModal(false)}
                bookId={bookId || ''}
                bookTitle={bookTitle}
                attemptCount={quizAttemptCount}
                maxAttempts={2}
                kidAge={kidAge}
                onQuizComplete={(score, coinsEarned) => {
                    // Update attempt count
                    setQuizAttemptCount(prev => prev + 1);
                    console.log(`📊 Quiz completed: ${score}/6, earned ${coinsEarned} coins`);
                }}
            />
        </div>
    );
};

export default BookReaderPage;
