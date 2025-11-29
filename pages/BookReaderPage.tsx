import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Volume2 } from 'lucide-react';
import { ApiService } from '../services/apiService';

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
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Default Rachel
    const [wordAlignment, setWordAlignment] = useState<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
    const wordAlignmentRef = useRef<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);

    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const data = await ApiService.getBookPages(bookId);
                setPages(data);
            } catch (err) {
                console.error('Failed to fetch pages:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPages();

        // Fetch voices
        const fetchVoices = async () => {
            const voiceList = await ApiService.getVoices();
            if (voiceList.length > 0) {
                setVoices(voiceList);
                // Try to find a kid-friendly voice or stick to default
                const kidVoice = voiceList.find((v: any) => v.name === 'Domi' || v.name === 'Bella');
                if (kidVoice) setSelectedVoiceId(kidVoice.voice_id);
            } else {
                // Fallback to hardcoded common voices if API fails
                const fallbackVoices = [
                    { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade' },
                    { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade' },
                    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade' },
                    { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade' },
                    { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade' },
                    { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade' },
                    { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', category: 'premade' },
                    { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade' },
                    { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', category: 'premade' }
                ];
                setVoices(fallbackVoices);
                // Default to Domi (kid-friendly)
                setSelectedVoiceId('AZnzlk1XvdvUeBnXmlld');
            }
        };
        fetchVoices();
    }, [bookId]);

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
        stopAudio();
        if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(prev => prev + 1);
            setShowScroll(true); // Reset scroll visibility on page turn
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        stopAudio();
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
            setShowScroll(true);
        }
    };

    const toggleScroll = () => {
        setShowScroll(prev => !prev);
    };

    const stopAudio = () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        setPlaying(false);
        setActiveTextBoxIndex(null);
    };

    const handlePlayPage = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // If already playing, pause/stop
        if (playing) {
            stopAudio();
            return;
        }

        // Play the first text box on the page
        if (currentPage.textBoxes && currentPage.textBoxes.length > 0) {
            const firstBox = currentPage.textBoxes[0];
            handlePlayText(firstBox.text, 0, e);
        }
    };

    const handlePlayText = async (text: string, index: number, e: React.MouseEvent) => {
        e.stopPropagation();

        // If already playing this text, pause it
        if (playing && activeTextBoxIndex === index) {
            currentAudio?.pause();
            setPlaying(false);
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
            return;
        }

        // Otherwise, generate/fetch new audio using WebSocket
        setActiveTextBoxIndex(index);
        setLoadingAudio(true);
        setCurrentWordIndex(-1);
        setWordAlignment(null);
        wordAlignmentRef.current = null;

        try {
            // Use WebSocket for real-time streaming with word alignment
            const result = await ApiService.generateTTS(
                text,
                selectedVoiceId,
                bookId || undefined,
                // onAudioChunk callback - can be used for streaming in future
                undefined,
                // onAlignment callback - update word alignment in real-time
                (alignment: { words: Array<{ word: string; start: number; end: number }> }) => {
                    console.log('📝 Received word alignment:', alignment);
                    console.log('📝 Words count:', alignment?.words?.length || 0);
                    console.log('📝 First 5 words:', alignment?.words?.slice(0, 5));
                    console.log('📝 Timing range:', {
                        first: alignment?.words?.[0],
                        last: alignment?.words?.[alignment.words.length - 1]
                    });
                    setWordAlignment(alignment);
                    wordAlignmentRef.current = alignment;
                }
            );

            // Use final audio URL from WebSocket
            if (result && result.audioUrl) {
                const audio = new Audio(result.audioUrl);

                const alignment = result.alignment || null;
                if (alignment && alignment.words) {
                    console.log('📝 Final alignment received:', alignment);
                    setWordAlignment(alignment);
                    wordAlignmentRef.current = alignment;
                } else {
                    console.warn('⚠️ No alignment data in result:', result);
                }

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
                        } else if (currentTime >= (currentAlignment.words[currentAlignment.words.length - 1]?.end || 0)) {
                            setCurrentWordIndex(-1);
                        }
                    } else if (!currentAlignment) {
                        // Debug: log when alignment is missing
                        console.warn('⚠️ No alignment data available for highlighting');
                    }
                };

                audio.onended = () => {
                    setPlaying(false);
                    setActiveTextBoxIndex(null);
                    setCurrentWordIndex(-1);
                    setWordAlignment(null);
                    wordAlignmentRef.current = null;
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
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden flex flex-col">
            {/* Top Toolbar - Simplified for App */}
            <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 pointer-events-none">
                <button
                    onClick={() => navigate(-1)}
                    className="pointer-events-auto bg-black/30 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/50 transition flex items-center gap-2"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-4">
                    {/* Voice Selector */}
                    <div className="pointer-events-auto bg-black/30 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-white" />
                        <select
                            value={selectedVoiceId}
                            onChange={(e) => setSelectedVoiceId(e.target.value)}
                            className="bg-transparent text-white text-sm outline-none border-none cursor-pointer max-w-[100px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {voices.map(v => (
                                <option key={v.voice_id} value={v.voice_id} className="text-black">
                                    {v.name}
                                </option>
                            ))}
                            {voices.length === 0 && <option value="21m00Tcm4TlvDq8ikWAM" className="text-black">Rachel</option>}
                        </select>
                    </div>

                    <div className="bg-black/30 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm">
                        Page {currentPageIndex + 1} / {pages.length}
                    </div>
                </div>

                <div className="w-10" /> {/* Spacer for balance */}
            </div>

            {/* Main Reading Area */}
            <div className="flex-1 w-full h-full relative" onClick={toggleScroll}>
                {/* Background Layer */}
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    {currentPage.backgroundType === 'video' ? (
                        <video
                            src={currentPage.backgroundUrl}
                            className="w-full h-full object-contain"
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    ) : (
                        <img
                            src={currentPage.backgroundUrl}
                            alt={`Page ${currentPage.pageNumber}`}
                            className="w-full h-full object-contain"
                        />
                    )}
                </div>

                {/* Text Boxes Layer - positioned relative to full page, moves with scroll */}
                <div
                    className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-in-out z-20"
                    style={{
                        transform: currentPage.scrollUrl && !showScroll
                            ? 'translateY(100%)'
                            : 'translateY(0)'
                    }}
                >
                    {currentPage.textBoxes?.map((box, idx) => {
                        // Calculate scroll top position
                        const scrollHeightVal = currentPage.scrollHeight ? `${currentPage.scrollHeight}px` : '30%';
                        const scrollTopVal = `calc(100% - ${scrollHeightVal})`;
                        const isActive = activeTextBoxIndex === idx;

                        return (
                            <div
                                key={idx}
                                className="absolute pointer-events-auto overflow-y-auto p-2 group"
                                style={{
                                    left: `${box.x}%`,
                                    // If scroll exists, ensure top is at least the scroll start position
                                    top: currentPage.scrollUrl ? `max(${box.y}%, ${scrollTopVal})` : `${box.y}%`,
                                    width: `${box.width || 30}%`,
                                    transform: 'translate(0, 0)',
                                    textAlign: box.alignment,
                                    color: box.color || '#4a3b2a',
                                    fontFamily: box.fontFamily || 'Comic Sans MS',
                                    fontSize: `${box.fontSize || 24}px`,
                                    // Calculate max height based on the effective top position
                                    maxHeight: currentPage.scrollUrl
                                        ? `calc(100% - max(${box.y}%, ${scrollTopVal}) - 40px)`
                                        : `calc(100% - ${box.y}% - 40px)`,
                                    overflowY: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                }}
                            >
                                {/* Individual Play Button Overlay - Hidden for now as we have the main wood button */}
                                {/* 
                                <div className={`absolute -top-3 -right-3 z-30 transition-opacity ${isActive || loadingAudio ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <button
                                        onClick={(e) => handlePlayText(box.text, idx, e)}
                                        className="bg-white/90 hover:bg-white text-indigo-600 rounded-full p-1.5 shadow-lg transform hover:scale-110 transition-all"
                                        disabled={loadingAudio && isActive}
                                    >
                                        {loadingAudio && isActive ? (
                                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        ) : isActive && playing ? (
                                            <Pause className="w-4 h-4 fill-current" />
                                        ) : (
                                            <Play className="w-4 h-4 fill-current ml-0.5" />
                                        )}
                                    </button>
                                </div>
                                */}

                                {(() => {
                                    // Debug logging
                                    if (isActive) {
                                        console.log('🔍 Rendering check:', {
                                            isActive,
                                            hasWordAlignment: !!wordAlignment,
                                            wordsCount: wordAlignment?.words?.length || 0,
                                            currentWordIndex,
                                            boxText: box.text?.substring(0, 20)
                                        });
                                    }

                                    if (isActive && wordAlignment && wordAlignment.words && wordAlignment.words.length > 0) {
                                        // Render text with word highlighting
                                        return (
                                            <span>
                                                {wordAlignment.words.map((w: any, wordIdx: number) => {
                                                    const isHighlighted = wordIdx === currentWordIndex;
                                                    return (
                                                        <span
                                                            key={wordIdx}
                                                            className={isHighlighted ? 'bg-yellow-300 bg-opacity-70 rounded px-1 transition-all duration-100' : ''}
                                                            style={{
                                                                backgroundColor: isHighlighted ? 'rgba(255, 235, 59, 0.6)' : 'transparent',
                                                                transition: 'background-color 0.1s ease-in-out'
                                                            }}
                                                        >
                                                            {w.word}
                                                            {wordIdx < wordAlignment.words.length - 1 && ' '}
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        );
                                    } else {
                                        // Regular text display when not playing or no alignment
                                        return box.text;
                                    }
                                })()}
                            </div>
                        );
                    })}
                </div>

                {/* Scroll Overlay Layer */}
                {currentPage.scrollUrl && (
                    <div
                        className={`absolute bottom-0 left-0 right-0 transition-transform duration-500 ease-in-out z-10 ${showScroll ? 'translate-y-0' : 'translate-y-full'
                            }`}
                        style={{ height: currentPage.scrollHeight ? `${currentPage.scrollHeight}px` : '30%' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* The Scroll Image */}
                        <img
                            src={currentPage.scrollUrl}
                            alt="Scroll background"
                            className="w-full h-full object-fill"
                        />
                    </div>
                )}

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

                {/* Navigation Controls (Side Taps) */}
                <div className="absolute inset-y-0 left-0 w-1/4 z-30" onClick={handlePrev} />
                <div className="absolute inset-y-0 right-0 w-1/4 z-30" onClick={handleNext} />
            </div>
        </div>
    );
};

export default BookReaderPage;
