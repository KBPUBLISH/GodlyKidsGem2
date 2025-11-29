import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Volume2, Mic, Check } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import VoiceCloningModal from '../components/features/VoiceCloningModal';
import { useAudio } from '../context/AudioContext';
import { readingProgressService } from '../services/readingProgressService';
import { BookPageRenderer } from '../components/features/BookPageRenderer';

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
    const { setGameMode, setMusicPaused } = useAudio();
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showScroll, setShowScroll] = useState(true);

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
    const [isPageTurning, setIsPageTurning] = useState(false);
    const [flipState, setFlipState] = useState<{ direction: 'next' | 'prev', isFlipping: boolean } | null>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);

    // Pause background music when entering book reader
    useEffect(() => {
        console.log('📖 BookReaderPage MOUNTED');

        // NUCLEAR OPTION: Force a page reload on first mount to kill all audio
        // Use URL parameter to track if we've already reloaded
        const urlParams = new URLSearchParams(window.location.search);
        const hasReloaded = urlParams.get('reloaded');

        if (!hasReloaded) {
            console.log('🔄 First time entering book reader - forcing reload to kill audio');
            // Add reloaded parameter to URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('reloaded', '1');
            window.location.href = newUrl.toString();
            return;
        }

        console.log('📖 BookReaderPage - Already reloaded, proceeding normally');

        // Pause app background music and prevent it from resuming on interaction
        setGameMode(false);
        setMusicPaused(true);

        // NUCLEAR OPTION: Immediately pause ALL audio elements in the DOM
        const killAllAudio = () => {
            const allAudio = document.querySelectorAll('audio');
            allAudio.forEach(audio => {
                if (audio !== bookBackgroundMusicRef.current) {
                    audio.pause();
                    audio.volume = 0;
                }
            });
        };
        killAllAudio();

        // Keep killing audio every 100ms as a safety measure
        const killInterval = setInterval(killAllAudio, 100);

        // Fetch book data to check for book-specific background music
        const fetchBookData = async () => {
            if (!bookId) return;
            try {
                const book = await ApiService.getBookById(bookId);
                if (book && (book as any).files?.audio && Array.isArray((book as any).files.audio) && (book as any).files.audio.length > 0) {
                    // Use the first audio file as background music
                    const musicUrl = (book as any).files.audio[0].url;
                    if (musicUrl) {
                        // Clean up any existing book music
                        if (bookBackgroundMusicRef.current) {
                            bookBackgroundMusicRef.current.pause();
                            bookBackgroundMusicRef.current.src = '';
                            bookBackgroundMusicRef.current = null;
                        }

                        const audio = new Audio(musicUrl);
                        audio.loop = true;
                        audio.volume = 0.3; // Lower volume for background music
                        audio.preload = 'auto';
                        bookBackgroundMusicRef.current = audio;

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
                }
            } catch (err) {
                console.error('Failed to fetch book data:', err);
            }
        };

        fetchBookData();

        // Cleanup: stop book background music and resume app music when leaving
        return () => {
            console.log('📖 BookReaderPage UNMOUNTING - Clearing kill interval');
            clearInterval(killInterval);

            if (bookBackgroundMusicRef.current) {
                bookBackgroundMusicRef.current.pause();
                bookBackgroundMusicRef.current.src = '';
                bookBackgroundMusicRef.current = null;
            }

            // Allow app music to resume when leaving book reader
            setMusicPaused(false);
        };
    }, [bookId, setGameMode, setMusicPaused]);

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const data = await ApiService.getBookPages(bookId);
                setPages(data);

                // Check if page is specified in URL (from Continue button)
                const pageParam = searchParams.get('page');
                if (pageParam) {
                    const pageNum = parseInt(pageParam, 10);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= data.length) {
                        const pageIndex = pageNum - 1; // Convert to 0-based
                        setCurrentPageIndex(pageIndex);
                        console.log(`📖 Navigated to page ${pageNum} from URL`);
                    }
                } else {
                    // Load saved reading progress if no URL param
                    const progress = readingProgressService.getProgress(bookId);
                    if (progress && progress.currentPageIndex >= 0 && progress.currentPageIndex < data.length) {
                        setCurrentPageIndex(progress.currentPageIndex);
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

    const currentPage = pages[currentPageIndex];

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex < pages.length - 1) {
            setIsPageTurning(true);
            setFlipState({ direction: 'next', isFlipping: true });

            setTimeout(() => {
                const nextIndex = currentPageIndex + 1;
                setCurrentPageIndex(nextIndex);
                setShowScroll(true);
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                if (bookId) {
                    readingProgressService.saveProgress(bookId, nextIndex);
                }
            }, 600);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex > 0) {
            setIsPageTurning(true);
            setFlipState({ direction: 'prev', isFlipping: true });

            setTimeout(() => {
                const prevIndex = currentPageIndex - 1;
                setCurrentPageIndex(prevIndex);
                setShowScroll(true);
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
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const swipeThreshold = 50;
        const diff = touchStartX.current - touchEndX.current;

        if (Math.abs(diff) > swipeThreshold) {
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
        }
    };

    const toggleScroll = (e?: React.MouseEvent) => {
        // Stop propagation to prevent music unlock
        if (e) {
            e.stopPropagation();
        }
        setShowScroll(prev => !prev);
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

        try {
            // Use HTTP API for TTS
            const result = await ApiService.generateTTS(
                text,
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
                        const actualDuration = audio.duration;
                        const estimatedDuration = alignment.words.length * 0.4; // Our estimated duration

                        // Scale word timings to match actual audio duration
                        if (actualDuration > 0 && estimatedDuration > 0) {
                            const scaleFactor = actualDuration / estimatedDuration;
                            const scaledAlignment = {
                                words: alignment.words.map((w: any) => ({
                                    word: w.word,
                                    start: w.start * scaleFactor,
                                    end: w.end * scaleFactor
                                }))
                            };
                            console.log('📝 Scaled alignment:', {
                                estimatedDuration: estimatedDuration.toFixed(2),
                                actualDuration: actualDuration.toFixed(2),
                                scaleFactor: scaleFactor.toFixed(2),
                                words: scaledAlignment.words.length
                            });
                            setWordAlignment(scaledAlignment);
                            wordAlignmentRef.current = scaledAlignment;
                        } else {
                            setWordAlignment(alignment);
                            wordAlignmentRef.current = alignment;
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
                    } else if (!currentAlignment) {
                        // Debug: log when alignment is missing
                        console.warn('⚠️ No alignment data available for highlighting');
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
                            // Use ref to get latest autoPlayMode value (closure-safe)
                            if (autoPlayModeRef.current && currentPageIndex < pages.length - 1) {
                                const nextPageIndex = currentPageIndex + 1;
                                console.log('🔄 Auto-play: Moving to page', nextPageIndex + 1);
                                setIsPageTurning(true);
                                setTimeout(() => {
                                    setCurrentPageIndex(nextPageIndex);
                                    setShowScroll(true);
                                    setIsPageTurning(false);
                                    // Save progress
                                    if (bookId) {
                                        readingProgressService.saveProgress(bookId, nextPageIndex);
                                    }

                                    // Wait for page to render, then auto-play next page
                                    setTimeout(() => {
                                        // Check again if auto-play is still enabled
                                        if (autoPlayModeRef.current) {
                                            const nextPage = pages[nextPageIndex];
                                            if (nextPage && nextPage.textBoxes && nextPage.textBoxes.length > 0) {
                                                const firstBox = nextPage.textBoxes[0];
                                                console.log('▶️ Auto-play: Starting next page audio');
                                                const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                                handlePlayText(firstBox.text, 0, syntheticEvent, true);
                                            } else {
                                                console.log('⏹️ Auto-play: No text boxes on next page, stopping');
                                                setAutoPlayMode(false);
                                                autoPlayModeRef.current = false;
                                            }
                                        }
                                    }, 300);
                                }, 300);
                            } else if (autoPlayModeRef.current && currentPageIndex >= pages.length - 1) {
                                // Reached end of book, stop auto-play
                                console.log('🏁 Auto-play: Reached end of book, stopping');
                                setAutoPlayMode(false);
                                autoPlayModeRef.current = false;
                            }
                        }, 500);
                    } else {
                        setPlaying(false);
                        setActiveTextBoxIndex(null);
                        setCurrentWordIndex(-1);
                        setWordAlignment(null);
                        wordAlignmentRef.current = null;

                        // Auto-play: Move to next page if enabled
                        // Use ref to get latest autoPlayMode value (closure-safe)
                        if (autoPlayModeRef.current && currentPageIndex < pages.length - 1) {
                            const nextPageIndex = currentPageIndex + 1;
                            console.log('🔄 Auto-play: Moving to page', nextPageIndex + 1);
                            setIsPageTurning(true);
                            setTimeout(() => {
                                setCurrentPageIndex(nextPageIndex);
                                setShowScroll(true);
                                setIsPageTurning(false);
                                // Save progress
                                if (bookId) {
                                    readingProgressService.saveProgress(bookId, nextPageIndex);
                                }

                                setTimeout(() => {
                                    // Check again if auto-play is still enabled
                                    if (autoPlayModeRef.current) {
                                        const nextPage = pages[nextPageIndex];
                                        if (nextPage && nextPage.textBoxes && nextPage.textBoxes.length > 0) {
                                            const firstBox = nextPage.textBoxes[0];
                                            console.log('▶️ Auto-play: Starting next page audio');
                                            const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                            handlePlayText(firstBox.text, 0, syntheticEvent, true);
                                        } else {
                                            console.log('⏹️ Auto-play: No text boxes on next page, stopping');
                                            setAutoPlayMode(false);
                                            autoPlayModeRef.current = false;
                                        }
                                    }
                                }, 300);
                            }, 300);
                        } else if (autoPlayModeRef.current && currentPageIndex >= pages.length - 1) {
                            // Reached end of book, stop auto-play
                            console.log('🏁 Auto-play: Reached end of book, stopping');
                            setAutoPlayMode(false);
                            autoPlayModeRef.current = false;
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
                    onClick={() => navigate(-1)}
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
                        navigate(-1);
                    }}
                    className="pointer-events-auto bg-black/40 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/60 transition"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Right: Voice Selector - Compact */}
                <div
                    ref={voiceDropdownRef}
                    className="pointer-events-auto relative"
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

            {/* Main Reading Area */}
            <div
                className="flex-1 w-full h-full relative perspective-[2000px] overflow-hidden bg-gray-900"
                onClick={(e) => toggleScroll(e)}
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
                                    page={pages[currentPageIndex + 1]}
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
                                    page={pages[currentPageIndex - 1]}
                                    activeTextBoxIndex={null}
                                    showScroll={true}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Navigation Controls (Side Taps) - Overlay on top of 3D scene */}
                <div className="absolute inset-y-0 left-0 w-1/4 z-30" onClick={handlePrev} />
                <div className="absolute inset-y-0 right-0 w-1/4 z-30" onClick={handleNext} />
            </div>

            {/* Wood Play Button - Positioned over the scroll */}
            <div className={`absolute bottom-4 left-4 z-40 transition-transform duration-500 ${showScroll ? 'translate-y-0' : 'translate-y-24'}`}>
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
