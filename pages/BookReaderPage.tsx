import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Volume2, Mic, Check, Music, Home, Heart, Star } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import VoiceCloningModal from '../components/features/VoiceCloningModal';
import { useAudio } from '../context/AudioContext';
import { readingProgressService } from '../services/readingProgressService';
import { favoritesService } from '../services/favoritesService';
import { readCountService } from '../services/readCountService';
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
    const swipeDetectedRef = useRef<boolean>(false);
    const desiredScrollStateRef = useRef<boolean | null>(null); // Track desired scroll state for next page turn
    const showScrollRef = useRef<boolean>(true); // Track scroll state to avoid closure issues
    const [bookMusicEnabled, setBookMusicEnabled] = useState(true); // Default to enabled
    const [hasBookMusic, setHasBookMusic] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    // Pause background music when entering book reader
    useEffect(() => {
        console.log('📖 BookReaderPage MOUNTED - Auto-toggling music off');

        // Store original music state in both ref and localStorage
        wasMusicEnabledRef.current = musicEnabled;
        localStorage.setItem('godly_kids_music_was_enabled', musicEnabled ? 'true' : 'false');

        // If music is enabled, toggle it off (this pauses music)
        if (musicEnabled) {
            console.log('🎵 Music was enabled, toggling off');
            toggleMusic();
        }

        setGameMode(false);

        // Safety measure: Pause any stray audio elements (but toggleMusic should handle it)
        const killAllAudio = () => {
            const allAudio = document.querySelectorAll('audio');
            allAudio.forEach(audio => {
                if (audio !== bookBackgroundMusicRef.current) {
                    // Only pause if music is disabled (should be after toggle)
                    if (!musicEnabled) {
                        audio.pause();
                    }
                }
            });
        };
        
        // Run once after a short delay to ensure toggle has taken effect
        const killTimeout = setTimeout(killAllAudio, 100);

        // Fetch book data to check for book-specific background music
        const fetchBookData = async () => {
            if (!bookId) return;
            try {
                const book = await ApiService.getBookById(bookId);
                console.log('📖 Fetched book data:', book);
                
                // Check both the rawData (from API) and the transformed book
                const rawData = (book as any)?.rawData;
                const files = rawData?.files || (book as any)?.files;
                console.log('📖 Book rawData:', rawData);
                console.log('📖 Book files:', files);
                console.log('📖 Book audio files:', files?.audio);
                
                if (book && files?.audio && Array.isArray(files.audio) && files.audio.length > 0) {
                    // Use the first audio file as background music
                    // Handle both {url: "..."} and direct URL string formats
                    const audioFile = files.audio[0];
                    const musicUrl = typeof audioFile === 'string' ? audioFile : (audioFile?.url || audioFile);
                    console.log('🎵 Found book background music URL:', musicUrl);
                    if (musicUrl) {
                        console.log('✅ Setting hasBookMusic to true');
                        setHasBookMusic(true);
                        
                        // Clean up any existing book music
                        if (bookBackgroundMusicRef.current) {
                            bookBackgroundMusicRef.current.pause();
                            bookBackgroundMusicRef.current.src = '';
                            bookBackgroundMusicRef.current = null;
                        }

                        const audio = new Audio(musicUrl);
                        audio.loop = true;
                        audio.volume = 0.15; // Quiet background music (15% volume)
                        audio.preload = 'auto';
                        bookBackgroundMusicRef.current = audio;

                        // Only play if music is enabled
                        if (bookMusicEnabled) {
                            // Try to play immediately
                            const playMusic = async () => {
                                try {
                                    await audio.play();
                                    console.log('✅ Book background music started');
                                } catch (err) {
                                    console.warn('⚠️ Could not auto-play book music, will play on user interaction:', err);
                                }
                            };

                            // Wait for audio to be ready
                            audio.addEventListener('canplaythrough', playMusic);
                        }
                    } else {
                        setHasBookMusic(false);
                    }
                } else {
                    setHasBookMusic(false);
                }
            } catch (err) {
                console.error('Failed to fetch book data:', err);
                setHasBookMusic(false);
            }
        };

        fetchBookData();

        // Cleanup: stop book background music and restore app music when leaving
        return () => {
            console.log('📖 BookReaderPage UNMOUNTING - Restoring music state');
            clearTimeout(killTimeout);

            if (bookBackgroundMusicRef.current) {
                bookBackgroundMusicRef.current.pause();
                bookBackgroundMusicRef.current.src = '';
                bookBackgroundMusicRef.current = null;
            }

            // Restore music to original state (toggle back on if it was originally enabled)
            // Use a timeout to ensure state has updated
            setTimeout(() => {
                const wasEnabled = wasMusicEnabledRef.current || localStorage.getItem('godly_kids_music_was_enabled') === 'true';
                // Get current state from AudioContext (check if music is actually playing)
                const bgAudio = document.querySelector('audio[src*="Seaside_Adventure"]') as HTMLAudioElement;
                const isCurrentlyPlaying = bgAudio && !bgAudio.paused;
                
                // If music was originally enabled but is not currently playing, toggle it back on
                if (wasEnabled && !isCurrentlyPlaying) {
                    console.log('🎵 Unmount cleanup: Restoring music - toggling back on');
                    toggleMusic();
                    // Clear the flag
                    localStorage.removeItem('godly_kids_music_was_enabled');
                }
            }, 100);
        };
    }, [bookId, setGameMode, musicEnabled, toggleMusic]);

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const data = await ApiService.getBookPages(bookId);
                
                // Add "The End" page as the last page
                // Create a beautiful themed background matching the app's aesthetic
                const theEndBackground = 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="theEndGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#fdf6e3;stop-opacity:1" />
                                <stop offset="50%" style="stop-color:#f3e5ab;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#e8d5b7;stop-opacity:1" />
                            </linearGradient>
                            <pattern id="woodGrain" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                                <rect width="100" height="100" fill="#fdf6e3"/>
                                <path d="M0,50 Q25,45 50,50 T100,50" stroke="#d4c5a0" stroke-width="1" fill="none" opacity="0.3"/>
                                <path d="M0,75 Q25,70 50,75 T100,75" stroke="#d4c5a0" stroke-width="1" fill="none" opacity="0.2"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#theEndGradient)"/>
                        <rect width="100%" height="100%" fill="url(#woodGrain)" opacity="0.4"/>
                    </svg>
                `);
                
                const theEndPage: Page = {
                    _id: 'the-end-page',
                    pageNumber: data.length + 1,
                    backgroundUrl: theEndBackground,
                    backgroundType: 'image',
                    scrollUrl: '',
                    scrollHeight: 0,
                    textBoxes: [
                        {
                            text: '✨',
                            x: 50,
                            y: 30,
                            width: 20,
                            alignment: 'center',
                            fontSize: 80,
                            fontFamily: 'Fredoka',
                            color: '#FFD700',
                        },
                        {
                            text: 'The End',
                            x: 50,
                            y: 42,
                            width: 60,
                            alignment: 'center',
                            fontSize: 72,
                            fontFamily: 'Fredoka',
                            color: '#8B4513',
                        },
                        {
                            text: 'Thank you for reading!',
                            x: 50,
                            y: 58,
                            width: 70,
                            alignment: 'center',
                            fontSize: 32,
                            fontFamily: 'Nunito',
                            color: '#5c2e0b',
                        },
                    ],
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

        // Fetch voices (only enabled voices from portal)
        const fetchVoices = async () => {
            const voiceList = await ApiService.getVoices();
            if (voiceList.length > 0) {
                setVoices(voiceList);
                // Try to find a kid-friendly voice or use first available
                const kidVoice = voiceList.find((v: any) =>
                    v.name === 'Domi' || v.name === 'Bella' || v.name === 'Elli' || v.name === 'Rachel'
                );
                if (kidVoice) {
                    setSelectedVoiceId(kidVoice.voice_id);
                } else if (voiceList.length > 0) {
                    // Use first available voice if no kid-friendly voice found
                    setSelectedVoiceId(voiceList[0].voice_id);
                }
                console.log(`✅ Loaded ${voiceList.length} enabled voice(s) from portal`);
            } else {
                console.warn('⚠️ No voices enabled in portal. Please enable voices in the portal first.');
                // Don't use fallback - show empty state so users know to enable voices in portal
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

            setTimeout(() => {
                const nextIndex = currentPageIndex + 1;
                setCurrentPageIndex(nextIndex);
                currentPageIndexRef.current = nextIndex;
                // Use the determined scroll state
                setShowScroll(scrollStateToUse);
                showScrollRef.current = scrollStateToUse; // Update ref
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                if (bookId) {
                    readingProgressService.saveProgress(bookId, nextIndex);
                    
                    // Check if book is completed (reached "The End" page)
                    if (nextIndex >= pages.length - 1) {
                        // Increment read count when book is completed
                        readCountService.incrementReadCount(bookId);
                    }
                }
            }, 600);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex > 0) {
            // Preserve scroll state when turning pages manually - use ref to get latest value
            const currentScrollState = showScrollRef.current;
            
            setIsPageTurning(true);
            setFlipState({ direction: 'prev', isFlipping: true });

            setTimeout(() => {
                const prevIndex = currentPageIndex - 1;
                setCurrentPageIndex(prevIndex);
                currentPageIndexRef.current = prevIndex;
                // Preserve the scroll state from previous page
                setShowScroll(currentScrollState);
                showScrollRef.current = currentScrollState; // Update ref
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                if (bookId) {
                    readingProgressService.saveProgress(bookId, prevIndex);
                }
            }, 600);
        }
    };

    // Swipe gesture handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        swipeDetectedRef.current = false; // Reset swipe detection
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const swipeThreshold = 50;
        const diff = touchStartX.current - touchEndX.current;

        if (Math.abs(diff) > swipeThreshold) {
            swipeDetectedRef.current = true; // Mark that a swipe was detected
            if (diff > 0) {
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
            // Small movement - not a swipe, allow tap to proceed
            swipeDetectedRef.current = false;
        }
    };

    const toggleScroll = (e?: React.MouseEvent) => {
        // Stop propagation to prevent music unlock
        if (e) {
            e.stopPropagation();
        }
        
        // If scroll is currently closed and user is opening it, turn to next page
        if (!showScroll && currentPageIndex < pages.length - 1) {
            // Turn to next page with scroll open
            stopAudio();
            // Set desired scroll state to open for next page
            desiredScrollStateRef.current = true;
            handleNext({ stopPropagation: () => { } } as React.MouseEvent);
        } else {
            // Just toggle scroll state (closing it or already on last page)
            setShowScroll(prev => {
                const newState = !prev;
                showScrollRef.current = newState; // Update ref
                return newState;
            });
        }
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

        // Otherwise, generate/fetch new audio using WebSocket
        setActiveTextBoxIndex(index);
        setLoadingAudio(true);
        setCurrentWordIndex(-1);
        setWordAlignment(null);
        wordAlignmentRef.current = null;
        alignmentWarningShownRef.current = false; // Reset warning flag for new audio

        try {
            // Process text to extract emotional cues
            const processedText = processTextWithEmotionalCues(text);
            
            // Use HTTP API for TTS with emotional cues preserved
            const result = await ApiService.generateTTS(
                processedText.ttsText, // Send text with cues to ElevenLabs
                selectedVoiceId,
                bookId || undefined
            );

            // Use final audio URL from WebSocket
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
                                setIsPageTurning(true);
                                setTimeout(() => {
                                    setCurrentPageIndex(nextPageIndex);
                                    currentPageIndexRef.current = nextPageIndex; // Update ref
                                    // Preserve scroll state during page turns (both manual and auto-play)
                                    setShowScroll(showScrollRef.current);
                                    setIsPageTurning(false);
                                    // Save progress
                                    if (bookId) {
                                        readingProgressService.saveProgress(bookId, nextPageIndex);
                                    }

                                    // Wait for page to render, then auto-play next page
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
                                    }, 300);
                                }, 300);
                            } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                                // Reached end of book, stop auto-play
                                console.log('🏁 Auto-play: Reached end of book, stopping');
                                setAutoPlayMode(false);
                                autoPlayModeRef.current = false;
                                isAutoPlayingRef.current = false;
                                // Increment read count when book is completed
                                if (bookId) {
                                    readCountService.incrementReadCount(bookId);
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
                            setIsPageTurning(true);
                            setTimeout(() => {
                                setCurrentPageIndex(nextPageIndex);
                                currentPageIndexRef.current = nextPageIndex; // Update ref
                                // Preserve scroll state during page turns (both manual and auto-play)
                                setShowScroll(showScrollRef.current);
                                setIsPageTurning(false);
                                // Save progress
                                if (bookId) {
                                    readingProgressService.saveProgress(bookId, nextPageIndex);
                                }

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
                                }, 300);
                            }, 300);
                        } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                            // Reached end of book, stop auto-play
                            console.log('🏁 Auto-play: Reached end of book, stopping');
                            setAutoPlayMode(false);
                            autoPlayModeRef.current = false;
                            isAutoPlayingRef.current = false;
                            // Increment read count when book is completed
                            if (bookId) {
                                readCountService.incrementReadCount(bookId);
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
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const newState = !bookMusicEnabled;
                                setBookMusicEnabled(newState);
                                
                                if (bookBackgroundMusicRef.current) {
                                    if (newState) {
                                        // Update volume when playing
                                        bookBackgroundMusicRef.current.volume = 0.15;
                                        bookBackgroundMusicRef.current.play().catch(err => {
                                            console.warn('Could not play book music:', err);
                                        });
                                    } else {
                                        bookBackgroundMusicRef.current.pause();
                                    }
                                }
                            }}
                            className={`bg-black/50 backdrop-blur-md rounded-full p-3 hover:bg-black/70 transition-all border ${
                                bookMusicEnabled 
                                    ? 'border-yellow-400/50 shadow-lg shadow-yellow-400/20' 
                                    : 'border-white/20'
                            }`}
                            title={bookMusicEnabled ? "Disable background music" : "Enable background music"}
                        >
                            <Music className={`w-6 h-6 ${bookMusicEnabled ? 'text-yellow-300' : 'text-white/50'}`} />
                        </button>
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

                    {/* Dropdown Menu */}
                    {showVoiceDropdown && (
                        <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 min-w-[200px] max-w-[280px] max-h-[400px] overflow-y-auto">
                            <div className="py-2">
                                {/* Portal voices */}
                                {voices.length > 0 && (
                                    <>
                                        {voices.map(v => (
                                            <button
                                                key={v.voice_id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedVoiceId(v.voice_id);
                                                    setShowVoiceDropdown(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedVoiceId === v.voice_id ? 'bg-white/20' : ''
                                                    }`}
                                            >
                                                {selectedVoiceId === v.voice_id && (
                                                    <Check className="w-4 h-4 text-[#FFD700]" />
                                                )}
                                                <span className={selectedVoiceId === v.voice_id ? 'font-bold' : ''}>
                                                    {v.name}
                                                </span>
                                            </button>
                                        ))}
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

                                {/* Voice Cloning Feature Disabled - ElevenLabs Limit Reached */}
                                {/* Separator */}
                                {(voices.length > 0 || clonedVoices.length > 0) && (
                                    <div className="border-t border-white/20 my-1"></div>
                                )}

                                {/* Create Voice Option - DISABLED */}
                                {/* 
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowVoiceDropdown(false);
                                            setShowVoiceCloningModal(true);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-[#FFD700] font-bold hover:bg-white/10 transition-colors flex items-center gap-2"
                                    >
                                        <Mic className="w-4 h-4" />
                                        Create Your Voice
                                    </button>
                                    */}

                                {/* No voices message */}
                                {voices.length === 0 && clonedVoices.length === 0 && (
                                    <div className="px-4 py-2 text-sm text-white/70 text-center">
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
                className="flex-1 w-full h-full relative perspective-[2000px] overflow-hidden bg-gray-900"
                onClick={handleBackgroundTap}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Style for animations */}
                <style>{`
                    @keyframes flipNext {
                        0% { transform: rotateY(0deg); }
                        100% { transform: rotateY(-180deg); }
                    }
                    @keyframes flipPrev {
                        0% { transform: rotateY(-180deg); }
                        100% { transform: rotateY(0deg); }
                    }
                    .animate-flip-next {
                        animation: flipNext 0.6s cubic-bezier(0.645, 0.045, 0.355, 1.000) forwards;
                    }
                    .animate-flip-prev {
                        animation: flipPrev 0.6s cubic-bezier(0.645, 0.045, 0.355, 1.000) forwards;
                    }
                    .book-page {
                        backface-visibility: hidden;
                        transform-style: preserve-3d;
                        transform-origin: left center;
                    }
                `}</style>

                {/* 3D Scene Container */}
                <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>

                    {/* CASE 1: Normal View (No Flip) */}
                    {!flipState && (
                        <div className="absolute inset-0 z-10">
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
                    )}

                    {/* CASE 2: Flipping NEXT */}
                    {flipState?.direction === 'next' && (
                        <>
                            {/* Bottom Layer: Next Page (Destination) */}
                            <div className="absolute inset-0 z-0">
                                <BookPageRenderer
                                    page={mapPage(pages[currentPageIndex + 1]) || currentPage}
                                    activeTextBoxIndex={null}
                                    showScroll={true}
                                />
                            </div>
                            {/* Top Layer: Current Page (Animating) */}
                            <div className="absolute inset-0 z-20 book-page animate-flip-next">
                                <BookPageRenderer
                                    page={currentPage}
                                    activeTextBoxIndex={activeTextBoxIndex}
                                    showScroll={showScroll}
                                    highlightedWordIndex={currentWordIndex}
                                    wordAlignment={wordAlignment}
                                />
                                {/* Back of the page */}
                                <div className="absolute inset-0 bg-white" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}></div>
                            </div>
                        </>
                    )}

                    {/* CASE 3: Flipping PREV */}
                    {flipState?.direction === 'prev' && (
                        <>
                            {/* Bottom Layer: Current Page (Destination) */}
                            <div className="absolute inset-0 z-0">
                                <BookPageRenderer
                                    page={currentPage}
                                    activeTextBoxIndex={activeTextBoxIndex}
                                    showScroll={showScroll}
                                    highlightedWordIndex={currentWordIndex}
                                    wordAlignment={wordAlignment}
                                />
                            </div>
                            {/* Top Layer: Prev Page (Animating) */}
                            <div className="absolute inset-0 z-20 book-page animate-flip-prev" style={{ transform: 'rotateY(-180deg)' }}>
                                <BookPageRenderer
                                    page={mapPage(pages[currentPageIndex - 1]) || currentPage}
                                    activeTextBoxIndex={null}
                                    showScroll={true}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Navigation is now swipe-only - removed click zones */}
            </div>

            {/* Wood Play Button - Positioned above the scroll */}
            <div 
                className={`absolute left-4 z-40 transition-all duration-500 ${
                    showScroll 
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

            {/* The End Page Buttons */}
            {isTheEndPage && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-auto">
                    <div className="flex gap-3">
                        {/* Go Home Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
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
                            className="relative overflow-hidden font-display font-bold transition-transform active:scale-95 rounded-xl shadow-xl border-b-4 bg-[#8B4513] border-[#5c2e0b] hover:bg-[#A0522D] text-white px-6 py-3 flex items-center gap-2"
                        >
                            <Home className="w-5 h-5" />
                            <span>Go Home</span>
                            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                                 style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 12px)' }}>
                            </div>
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                        </button>

                        {/* Save to Favs Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (bookId) {
                                    const newFavoriteState = favoritesService.toggleFavorite(bookId);
                                    setIsFavorite(newFavoriteState);
                                }
                            }}
                            className={`relative overflow-hidden font-display font-bold transition-transform active:scale-95 rounded-xl shadow-xl border-b-4 px-6 py-3 flex items-center gap-2 ${
                                isFavorite
                                    ? 'bg-[#FFD700] border-[#B8860B] hover:bg-[#ffe066] text-[#5c2e0b]'
                                    : 'bg-[#CD853F] border-[#8B4513] hover:bg-[#DEB887] text-white'
                            }`}
                        >
                            <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                            <span>{isFavorite ? 'Favorited' : 'Save to Favs'}</span>
                            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                                 style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 12px)' }}>
                            </div>
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                        </button>

                        {/* Like Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (bookId) {
                                    const newLikeState = favoritesService.toggleLike(bookId);
                                    setIsLiked(newLikeState);
                                }
                            }}
                            className={`relative overflow-hidden font-display font-bold transition-transform active:scale-95 rounded-xl shadow-xl border-b-4 px-6 py-3 flex items-center gap-2 ${
                                isLiked
                                    ? 'bg-[#FF5252] border-[#D32F2F] hover:bg-[#FF6B6B] text-white'
                                    : 'bg-[#CD853F] border-[#8B4513] hover:bg-[#DEB887] text-white'
                            }`}
                        >
                            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                            <span>{isLiked ? 'Liked' : 'Like'}</span>
                            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                                 style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 12px)' }}>
                            </div>
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                        </button>
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
        </div>
    );
};

export default BookReaderPage;
