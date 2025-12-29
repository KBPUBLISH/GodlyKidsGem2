import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Play, Pause, Volume2, Mic, Check, Music, Home, Heart, Star, RotateCcw, Lock, Sparkles, HelpCircle, Share2, Copy, Smartphone, Grid3X3, Loader2, Globe, BookOpen, SkipForward, FileText } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { voiceCloningService, ClonedVoice } from '../services/voiceCloningService';
import { translationService, SUPPORTED_LANGUAGES } from '../services/translationService';
import ColoringModal from '../components/features/ColoringModal';
import BookQuizModal from '../components/features/BookQuizModal';
import { useAudio } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { readingProgressService } from '../services/readingProgressService';
import { favoritesService } from '../services/favoritesService';
import { readCountService } from '../services/readCountService';
import { analyticsService } from '../services/analyticsService';
import { bookCompletionService } from '../services/bookCompletionService';
import { incrementActivityCounter } from '../components/features/ReviewPromptModal';
import { BookPageRenderer, ScrollState } from '../components/features/BookPageRenderer';
import { processTextWithEmotionalCues, removeEmotionalCues } from '../utils/textProcessing';
import { activityTrackingService } from '../services/activityTrackingService';
import { authService } from '../services/authService';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';

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

interface VideoSequenceItem {
    url: string;
    filename?: string;
    order: number;
}

interface ImageSequenceItem {
    url: string;
    filename?: string;
    order: number;
}

interface Page {
    _id: string;
    pageNumber: number;
    backgroundUrl?: string;
    backgroundType?: 'image' | 'video';
    isColoringPage?: boolean;
    coloringEndModalOnly?: boolean; // If true, coloring page only shows in end modal
    scrollUrl?: string;
    scrollHeight?: number;
    scrollMidHeight?: number; // Mid scroll height % (default 30)
    scrollMaxHeight?: number; // Max scroll height % (default 60)
    scrollOffsetY?: number; // Vertical offset from bottom in percentage (default 0)
    // Video sequence - multiple videos that play in order
    useVideoSequence?: boolean;
    videoSequence?: VideoSequenceItem[];
    // Image sequence - multiple images that cycle with transitions
    useImageSequence?: boolean;
    imageSequence?: ImageSequenceItem[];
    imageSequenceDuration?: number; // seconds per image (default 3)
    imageSequenceAnimation?: string; // animation effect type
    textBoxes?: TextBox[]; // Legacy: some pages may have textBoxes at root
    content?: {
        textBoxes?: TextBox[]; // Primary location of textBoxes from DB
    };
    files?: {
        soundEffect?: {
            url?: string;
        };
        background?: {
            url?: string;
            type?: string;
        };
        scroll?: {
            url?: string;
        };
    };
    soundEffectUrl?: string;
}

/**
 * Represents a segment of text to be spoken with a specific voice.
 * Used for multi-segment TTS where narrator and characters alternate.
 * 
 * Example: "Moses said @Moses "Let my people go" then Pharaoh replied @Pharaoh "Never!""
 * Becomes 4 segments:
 *   1. { text: "Moses said", isNarrator: true }
 *   2. { text: "Let my people go", characterName: "Moses" }
 *   3. { text: "then Pharaoh replied", isNarrator: true }
 *   4. { text: "Never!", characterName: "Pharaoh" }
 */
interface TextSegment {
    text: string;           // The actual text to speak
    voiceId: string;        // Voice ID to use for this segment
    characterName?: string; // Character name (if character voice)
    isNarrator: boolean;    // True if narrator voice
    startIndex: number;     // Start position in original cleaned text (for highlighting)
    endIndex: number;       // End position in original cleaned text (for highlighting)
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
    const { isVoiceUnlocked, isSubscribed } = useUser();
    const wasMusicEnabledRef = useRef<boolean>(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [scrollState, setScrollState] = useState<ScrollState>('max'); // Default to max (60%) - matches portal editing view
    const [bookTitle, setBookTitle] = useState<string>('Book');
    const [bookOrientation, setBookOrientation] = useState<'portrait' | 'landscape'>('portrait');
    
    // Studio intro video state (per-book, set in portal)
    const [showIntroVideo, setShowIntroVideo] = useState(false);
    const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
    const [introVideoChecked, setIntroVideoChecked] = useState(false); // Track if we've checked for intro video
    const introVideoRef = useRef<HTMLVideoElement>(null);

    // Keep ref in sync with state
    const scrollStateRef = useRef<ScrollState>('max');
    useEffect(() => {
        scrollStateRef.current = scrollState;
    }, [scrollState]);

    // TTS State
    const [playing, setPlaying] = useState(false);
    const playingRef = useRef(false); // Ref to track playing state for closures
    const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
    const [activeTextBoxIndex, setActiveTextBoxIndex] = useState<number | null>(null);
    const [loadingAudio, setLoadingAudio] = useState(false);
    const [showLoadingPopup, setShowLoadingPopup] = useState(false); // Dismissible loading popup
    const [voices, setVoices] = useState<any[]>([]);
    const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Default Rachel
    
    // Book-specific voice settings (from portal)
    const [bookDefaultVoiceId, setBookDefaultVoiceId] = useState<string | null>(null);
    const [bookRewardVoiceId, setBookRewardVoiceId] = useState<string | null>(null);
    const [showVoiceUnlockModal, setShowVoiceUnlockModal] = useState(false);
    const [unlockedVoice, setUnlockedVoice] = useState<{ name: string; characterImage?: string } | null>(null);
    // Track if user has overridden the book's default voice
    const [useBookDefaultVoice, setUseBookDefaultVoice] = useState(true);
    
    // Multi-character voice system
    const [defaultNarratorVoiceId, setDefaultNarratorVoiceId] = useState<string | null>(null);
    const [characterVoices, setCharacterVoices] = useState<Array<{ characterName: string; voiceId: string; color?: string }>>([]);
    
    // Get the effective voice ID to use for TTS (for narrator - non-character text)
    // Priority: 1. Book's narrator voice, 2. User's selected voice
    const effectiveNarratorVoiceId = defaultNarratorVoiceId || 
        ((bookDefaultVoiceId && useBookDefaultVoice) ? bookDefaultVoiceId : selectedVoiceId);
    
    // Legacy: Get the effective voice ID to use for TTS
    // If book has default and user hasn't overridden, use book's default
    // Otherwise use user's selected voice
    const effectiveVoiceId = (bookDefaultVoiceId && useBookDefaultVoice) ? bookDefaultVoiceId : selectedVoiceId;
    
    /**
     * Get the voice ID to use for a given text, handling @Character tags
     * 
     * SUPPORTED FORMATS:
     * 1. "@Moses Let my people go!"  ← Tag INSIDE quotes (preferred) - Moses reads only the quoted text
     * 2. @Moses "Let my people go!"  ← Tag OUTSIDE quotes - Moses reads only the quoted text
     * 
     * The @Character tag MUST be paired with quotes to define exactly what the character says.
     * Text without quotes = narrator reads it.
     * 
     * Voice Priority:
     * 1. @Character tag with quotes -> Use character's assigned voice (FIXED)
     * 2. No tag -> Use narrator voice (defaultNarratorVoiceId or user's selected voice)
     */
    const getVoiceForText = (text: string): { voiceId: string; cleanText: string; characterName?: string } => {
        // Pattern 1: Tag INSIDE quotes - "@Moses Let my people go!"
        // This is the PREFERRED format - cleaner and more intuitive
        const insideQuotesMatch = text.match(/"@(\w+)\s+([^"]+)"/);
        
        if (insideQuotesMatch) {
            const [fullMatch, charName, dialogueText] = insideQuotesMatch;
            const character = characterVoices.find(c => 
                c.characterName.toLowerCase() === charName.toLowerCase()
            );
            
            // Clean text: keep only the dialogue (remove tag, keep rest of text for display)
            const cleanText = text
                .replace(/"@\w+\s+([^"]+)"/g, '"$1"') // Replace "@Name text" with just "text"
                .replace(/\s+/g, ' ')
                .trim();
            
            if (character && character.voiceId) {
                console.log(`🎭 Character voice (inside quotes): "@${charName} ${dialogueText}" -> voice: ${character.voiceId}`);
                return { 
                    voiceId: character.voiceId, 
                    cleanText,
                    characterName: character.characterName
                };
            }
            console.warn(`⚠️ Character @${charName} not found, using narrator voice`);
            return { voiceId: effectiveNarratorVoiceId, cleanText };
        }
        
        // Pattern 2: Tag OUTSIDE quotes - @Moses "Let my people go!"
        const outsideQuotesMatch = text.match(/@(\w+)\s+"([^"]+)"/);
        
        if (outsideQuotesMatch) {
            const [fullMatch, charName, quotedText] = outsideQuotesMatch;
            const character = characterVoices.find(c => 
                c.characterName.toLowerCase() === charName.toLowerCase()
            );
            
            // Clean text: remove @tag but keep the quoted text
            const cleanText = text
                .replace(/@\w+\s+"([^"]+)"/g, '"$1"') // Replace @Name "text" with just "text"
                .replace(/\s+/g, ' ')
                .trim();
            
            if (character && character.voiceId) {
                console.log(`🎭 Character voice (outside quotes): @${charName} "${quotedText}" -> voice: ${character.voiceId}`);
                return { 
                    voiceId: character.voiceId, 
                    cleanText,
                    characterName: character.characterName
                };
            }
            console.warn(`⚠️ Character @${charName} not found, using narrator voice`);
            return { voiceId: effectiveNarratorVoiceId, cleanText };
        }
        
        // No @Character tag with quotes - narrator reads everything
        // NOTE: @Character without quotes is IGNORED (use quotes to define dialogue!)
        const cleanText = text
            .replace(/@\w+\s*/g, '') // Remove any stray @tags (they're malformed without quotes)
            .replace(/\s+/g, ' ')
            .trim();
        
        return { 
            voiceId: effectiveNarratorVoiceId, 
            cleanText 
        };
    };
    
    /**
     * Parse text into multiple segments for multi-voice TTS playback.
     * Handles text with multiple @Character tags that need different voices.
     * 
     * Example input:
     *   "Moses said @Moses "Let my people go" then Pharaoh replied @Pharaoh "Never!""
     * 
     * Returns array of segments:
     *   [
     *     { text: "Moses said", voiceId: narratorVoice, isNarrator: true },
     *     { text: "Let my people go", voiceId: mosesVoice, characterName: "Moses" },
     *     { text: "then Pharaoh replied", voiceId: narratorVoice, isNarrator: true },
     *     { text: "Never!", voiceId: pharaohVoice, characterName: "Pharaoh" }
     *   ]
     * 
     * Supports both formats:
     * - @Moses "dialogue" (tag outside quotes)
     * - "@Moses dialogue" (tag inside quotes)
     */
    const parseTextIntoSegments = (text: string): TextSegment[] => {
        const segments: TextSegment[] = [];
        
        // Combined regex to match both formats:
        // 1. @Character "dialogue" - tag outside quotes
        // 2. "@Character dialogue" - tag inside quotes
        const characterPattern = /(?:@(\w+)\s*"([^"]+)"|"@(\w+)\s+([^"]+)")/g;
        
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let cleanTextIndex = 0; // Track position in cleaned text for highlighting
        
        // First pass: build cleaned text to calculate indices
        const cleanedText = text
            .replace(/@(\w+)\s*"([^"]+)"/g, '"$2"')  // @Name "text" -> "text"
            .replace(/"@(\w+)\s+([^"]+)"/g, '"$2"') // "@Name text" -> "text"
            .replace(/\s+/g, ' ')
            .trim();
        
        // Reset regex
        characterPattern.lastIndex = 0;
        
        while ((match = characterPattern.exec(text)) !== null) {
            // Get narrator text before this character dialogue
            const narratorText = text.slice(lastIndex, match.index).trim();
            
            if (narratorText) {
                // Calculate position in cleaned text
                const cleanNarratorText = narratorText.replace(/\s+/g, ' ').trim();
                const startIdx = cleanTextIndex;
                const endIdx = cleanTextIndex + cleanNarratorText.length;
                cleanTextIndex = endIdx + 1; // +1 for space
                
                segments.push({
                    text: cleanNarratorText,
                    voiceId: effectiveNarratorVoiceId,
                    isNarrator: true,
                    startIndex: startIdx,
                    endIndex: endIdx
                });
            }
            
            // Determine which pattern matched
            // match[1] and match[2] are for @Name "text" pattern
            // match[3] and match[4] are for "@Name text" pattern
            const charName = match[1] || match[3];
            const dialogueText = match[2] || match[4];
            
            if (charName && dialogueText) {
                // Find the character voice
                const character = characterVoices.find(c => 
                    c.characterName.toLowerCase() === charName.toLowerCase()
                );
                
                // Calculate position in cleaned text (dialogue is in quotes)
                const startIdx = cleanTextIndex + 1; // +1 for opening quote
                const endIdx = startIdx + dialogueText.length;
                cleanTextIndex = endIdx + 2; // +2 for closing quote and space
                
                segments.push({
                    text: dialogueText,
                    voiceId: character?.voiceId || effectiveNarratorVoiceId,
                    characterName: character?.characterName || charName,
                    isNarrator: false,
                    startIndex: startIdx,
                    endIndex: endIdx
                });
                
                if (!character) {
                    console.warn(`⚠️ Character @${charName} not found in characterVoices, using narrator voice`);
                }
            }
            
            lastIndex = match.index + match[0].length;
        }
        
        // Get any remaining narrator text after the last character dialogue
        const remainingText = text.slice(lastIndex).trim();
        if (remainingText) {
            const cleanRemainingText = remainingText
                .replace(/@\w+\s*/g, '') // Remove stray @tags
                .replace(/\s+/g, ' ')
                .trim();
            
            if (cleanRemainingText) {
                const startIdx = cleanTextIndex;
                const endIdx = cleanTextIndex + cleanRemainingText.length;
                
                segments.push({
                    text: cleanRemainingText,
                    voiceId: effectiveNarratorVoiceId,
                    isNarrator: true,
                    startIndex: startIdx,
                    endIndex: endIdx
                });
            }
        }
        
        // If no segments were created (no character tags), create single narrator segment
        if (segments.length === 0) {
            const cleanText = text
                .replace(/@\w+\s*/g, '') // Remove any stray @tags
                .replace(/\s+/g, ' ')
                .trim();
            
            segments.push({
                text: cleanText,
                voiceId: effectiveNarratorVoiceId,
                isNarrator: true,
                startIndex: 0,
                endIndex: cleanText.length
            });
        }
        
        console.log(`📝 Parsed ${segments.length} segment(s):`, segments.map(s => 
            `"${s.text.substring(0, 30)}${s.text.length > 30 ? '...' : ''}" [${s.isNarrator ? 'Narrator' : s.characterName}]`
        ));
        
        return segments;
    };
    
    /**
     * Get cleaned display text with all @Character tags removed.
     * Used for displaying text in the UI without the voice markup.
     */
    const getCleanDisplayText = (text: string): string => {
        return text
            .replace(/@(\w+)\s*"([^"]+)"/g, '"$2"')  // @Name "text" -> "text"
            .replace(/"@(\w+)\s+([^"]+)"/g, '"$2"') // "@Name text" -> "text"
            .replace(/@\w+\s*/g, '') // Remove stray @tags
            .replace(/\s+/g, ' ')
            .trim();
    };
    
    const [wordAlignment, setWordAlignment] = useState<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
    const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
    
    // Translation state
    const [selectedLanguage, setSelectedLanguage] = useState<string>(() => translationService.getPreferredLanguage());
    const selectedLanguageRef = useRef<string>(selectedLanguage); // Ref to track language for closures
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [translatedContent, setTranslatedContent] = useState<Map<string, { text: string; textBoxes: Array<{ translatedText: string }> }>>(new Map());
    const [isTranslating, setIsTranslating] = useState(false);
    const languageDropdownRef = useRef<HTMLDivElement>(null);
    
    // Keep language ref in sync with state
    useEffect(() => {
        selectedLanguageRef.current = selectedLanguage;
    }, [selectedLanguage]);
    const wordAlignmentRef = useRef<{ words: Array<{ word: string; start: number; end: number }> } | null>(null);
    const bookBackgroundMusicRef = useRef<HTMLAudioElement | null>(null);
    // iOS/WKWebView often ignores HTMLAudioElement.volume. Use WebAudio GainNode for reliable volume control.
    const bookMusicCtxRef = useRef<AudioContext | null>(null);
    const bookMusicGainRef = useRef<GainNode | null>(null);
    const bookMusicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const bookMusicWebAudioReadyRef = useRef<boolean>(false); // only true after a user gesture resumes AudioContext
    const voiceDropdownRef = useRef<HTMLDivElement>(null);
    const [autoPlayMode, setAutoPlayMode] = useState(false);
    const autoPlayModeRef = useRef(false);
    const currentPageIndexRef = useRef(0); // Track page index to avoid closure issues
    const isAutoPlayingRef = useRef(false); // Prevent multiple simultaneous auto-play calls
    const alignmentWarningShownRef = useRef(false); // Prevent alignment warning spam
    const hasAutoPlayedOnStartRef = useRef(false); // Track if we've auto-played on book start
    
    // TTS Playback Mode: 'auto' = auto page turn, 'page' = current page only
    const [ttsMode, setTtsMode] = useState<'auto' | 'page'>('auto');
    const ttsModeRef = useRef<'auto' | 'page'>('auto');
    const [showTtsModeMenu, setShowTtsModeMenu] = useState(false);
    
    // Multi-segment TTS playback state
    // Allows alternating between narrator and character voices in a single text box
    const [currentSegments, setCurrentSegments] = useState<TextSegment[]>([]);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const currentSegmentIndexRef = useRef(0); // Ref for closure access
    const segmentsQueueRef = useRef<Array<{ segment: TextSegment; audioUrl: string; alignment: any }>>([]);
    const isPlayingMultiSegmentRef = useRef(false); // Track if we're in multi-segment playback mode
    const multiSegmentAudioRef = useRef<HTMLAudioElement | null>(null); // Current playing audio in multi-segment mode
    
    const [isPageTurning, setIsPageTurning] = useState(false);
    const [flipState, setFlipState] = useState<{ direction: 'next' | 'prev', isFlipping: boolean } | null>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const touchStartY = useRef<number>(0);
    const touchEndY = useRef<number>(0);
    const touchStartTime = useRef<number>(0);
    const swipeDetectedRef = useRef<boolean>(false);
    
    // Audio preloading cache refs
    const audioPreloadCacheRef = useRef<Map<string, { audioUrl: string; alignment: any }>>(new Map());
    const preloadingInProgressRef = useRef<Set<string>>(new Set());
    const desiredScrollStateRef = useRef<ScrollState | null>(null); // Track desired scroll state for next page turn
    
    // Background preloading cache refs - prevents black flash between pages
    const preloadedBackgroundsRef = useRef<Set<string>>(new Set());
    
    const [bookMusicEnabled, setBookMusicEnabled] = useState(true); // Default to enabled
    const [musicVolume] = useState(0.4); // Fixed volume at 40%

    // Use ref to track music enabled state for intervals/callbacks
    const bookMusicEnabledRef = useRef<boolean>(bookMusicEnabled);
    useEffect(() => {
        bookMusicEnabledRef.current = bookMusicEnabled;
    }, [bookMusicEnabled]);

    // Prevent re-wiring the same audio element on arbitrary taps (iOS can glitch/pause when MediaElementSource is recreated)
    const bookMusicConnectedElRef = useRef<HTMLAudioElement | null>(null);

    const ensureBookMusicGraph = useCallback((audioEl: HTMLAudioElement) => {
        // Check if audio is cross-origin (CORS will block WebAudio connection)
        const audioSrc = audioEl.src || '';
        const isCrossOrigin = audioSrc.includes('storage.googleapis.com') || 
                              audioSrc.includes('cloudfront') ||
                              audioSrc.includes('amazonaws.com') ||
                              (audioSrc.startsWith('http') && !audioSrc.includes(window.location.host));
        
        // For cross-origin audio, skip WebAudio entirely to avoid CORS silence
        // Just use native audio element volume control
        if (isCrossOrigin) {
            audioEl.volume = musicVolume;
            audioEl.muted = false;
            console.log('🎵 Using direct volume control (CORS-safe):', musicVolume);
            return;
        }

        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) {
            audioEl.volume = musicVolume;
            return;
        }

        if (!bookMusicCtxRef.current) {
            bookMusicCtxRef.current = new Ctx();
        }
        const ctx = bookMusicCtxRef.current;

        // If AudioContext isn't unlocked yet, DON'T connect to WebAudio (can cause silence on iOS).
        // Use element volume as a fallback until the first user interaction.
        if (!bookMusicWebAudioReadyRef.current || ctx.state === 'suspended') {
            audioEl.volume = musicVolume;
            return;
        }

        if (!bookMusicGainRef.current) {
            bookMusicGainRef.current = ctx.createGain();
            bookMusicGainRef.current.connect(ctx.destination);
        }

        // Keep element volume at 1, control loudness via GainNode (reliable on iOS once unlocked)
        audioEl.volume = 1;
        bookMusicGainRef.current.gain.value = musicVolume;

        // Already wired this element? Don't recreate the source (prevents pausing/glitch on random taps)
        if (bookMusicConnectedElRef.current === audioEl && bookMusicSourceRef.current) {
            return;
        }

        // Preserve playback state - iOS can pause/silence when routing changes mid-play.
        const wasPlaying = !audioEl.paused && !audioEl.ended;

        // Re-create source for the current element; disconnect any previous source
        if (bookMusicSourceRef.current) {
            try { bookMusicSourceRef.current.disconnect(); } catch { }
            bookMusicSourceRef.current = null;
        }
        try {
            bookMusicSourceRef.current = ctx.createMediaElementSource(audioEl);
            bookMusicSourceRef.current.connect(bookMusicGainRef.current);
            bookMusicConnectedElRef.current = audioEl;

            // If it was playing before, force a resume after the re-route (helps iOS).
            if (wasPlaying) {
                // Defer to next tick to let the connection settle.
                setTimeout(() => {
                    try {
                        audioEl.play().catch(() => { });
                    } catch { }
                }, 0);
            }
        } catch (e) {
            console.warn('🎵 Could not connect book music to WebAudio graph:', e);
            // fallback: at least keep audio audible
            audioEl.volume = musicVolume;
        }
    }, [musicVolume]);

    const resumeBookMusicContext = useCallback(async () => {
        try {
            if (bookMusicCtxRef.current && bookMusicCtxRef.current.state === 'suspended') {
                await bookMusicCtxRef.current.resume();
            }
        } catch { }
    }, []);

    // Keep gain node in sync with fixed volume
    useEffect(() => {
        if (bookMusicGainRef.current) {
            bookMusicGainRef.current.gain.value = musicVolume;
        }
    }, [musicVolume]);

    // iOS: unlock WebAudio on first user gesture (DO NOT rewire book music here; rewiring on random taps pauses music)
    useEffect(() => {
        const unlock = async () => {
            // Ensure context exists
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
            if (Ctx && !bookMusicCtxRef.current) {
                bookMusicCtxRef.current = new Ctx();
            }

            await resumeBookMusicContext();
            if (bookMusicCtxRef.current && bookMusicCtxRef.current.state === 'running') {
                bookMusicWebAudioReadyRef.current = true;
            }
        };

        // capture=true to run even if something stops propagation
        window.addEventListener('pointerdown', unlock, { capture: true, once: true });
        window.addEventListener('touchstart', unlock, { capture: true, once: true });

        return () => {
            window.removeEventListener('pointerdown', unlock as any, { capture: true } as any);
            window.removeEventListener('touchstart', unlock as any, { capture: true } as any);
        };
    }, [ensureBookMusicGraph, resumeBookMusicContext]);

    const [hasBookMusic, setHasBookMusic] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [copiedLink, setCopiedLink] = useState<'ios' | 'android' | null>(null);

    // App Store Links
    const IOS_APP_LINK = 'https://apps.apple.com/us/app/godly-kids-kid-bible-stories/id6737245412';
    const ANDROID_APP_LINK = 'https://play.google.com/store/apps/details?id=com.kbpublish.godlykidscb';

    // Coloring Page State
    const [coloringPages, setColoringPages] = useState<Page[]>([]);
    const [showColoringModal, setShowColoringModal] = useState(false);
    const [selectedColoringPage, setSelectedColoringPage] = useState<Page | null>(null);
    const openedColoringFromLinkRef = useRef(false);

    // Page Selector State
    const [showPageSelector, setShowPageSelector] = useState(false);

    // Quiz State
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizAttemptCount, setQuizAttemptCount] = useState(0);
    const maxQuizAttempts = 2;

    // Shared AudioContext for all audio (TTS, sound effects, video audio)
    // Creating it early and sharing prevents iOS from suspending audio when video loops
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // Initialize AudioContext early (but it will be in suspended state until user interaction)
    useEffect(() => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                console.log('🔊 Shared AudioContext created (state:', audioContextRef.current.state, ')');
            } catch (e) {
                console.warn('Failed to create AudioContext:', e);
            }
        }
    }, []);
    
    // Resume AudioContext on first user interaction (required by browsers)
    useEffect(() => {
        const resumeContext = () => {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().then(() => {
                    console.log('🔊 AudioContext resumed after user interaction');
                }).catch(() => {});
            }
        };
        
        // Listen for any user interaction
        document.addEventListener('touchstart', resumeContext, { once: true });
        document.addEventListener('click', resumeContext, { once: true });
        
        return () => {
            document.removeEventListener('touchstart', resumeContext);
            document.removeEventListener('click', resumeContext);
        };
    }, []);

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

    // Effect 1: Initialization, Book Data Fetching, and Cleanup
    useEffect(() => {
        console.log('📖 BookReaderPage MOUNTED - KILLING ALL APP MUSIC');

        // Pause app background music immediately (if any)
        setGameMode(false);
        setMusicPaused(true);

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
                
                // Check if book is members-only and user is not subscribed
                const bookIsMembersOnly = (book as any)?.isMembersOnly === true;
                if (bookIsMembersOnly && !isSubscribed) {
                    console.log('🔒 Book is members-only and user is not subscribed. Redirecting to paywall.');
                    navigate('/paywall', { state: { from: `/book/${bookId}` } });
                    return;
                }
                
                // Set book title and orientation
                if (book?.title) {
                    setBookTitle(book.title);
                    // Track book view analytics
                    analyticsService.bookView(bookId, book.title);
                    
                    // Track book read for Report Card
                    activityTrackingService.trackBookRead(bookId, book.title);
                    
                    // Record play event for real-time trending (with total pages for engagement tracking)
                    import('../services/playEventService').then(({ playEventService }) => {
                        playEventService.recordBookPlay(bookId);
                    }).catch(() => {});
                    
                    // Increment book opened counter for review prompt
                    incrementActivityCounter('book');
                    
                    // Set book orientation and intro video from raw data
                    const rawData = (book as any)?.rawData;
                    
                    // Check for intro video (stored in rawData from API)
                    const introVideo = rawData?.introVideoUrl || (book as any)?.introVideoUrl;
                    if (introVideo) {
                        console.log('🎬 Found intro video:', introVideo);
                        setIntroVideoUrl(introVideo);
                        setShowIntroVideo(true);
                    }
                    // Mark that we've checked for intro video (whether found or not)
                    setIntroVideoChecked(true);
                    
                    // Set book orientation
                    const orientation = rawData?.orientation || (book as any)?.orientation || 'portrait';
                    setBookOrientation(orientation);
                    console.log('📖 Book orientation:', orientation);
                    
                    // Load book-specific voice settings
                    const defaultVoice = rawData?.defaultVoiceId || (book as any)?.defaultVoiceId;
                    const rewardVoice = rawData?.rewardVoiceId || (book as any)?.rewardVoiceId;
                    if (defaultVoice) {
                        console.log('🎤 Book has default voice:', defaultVoice);
                        setBookDefaultVoiceId(defaultVoice);
                    }
                    if (rewardVoice) {
                        console.log('🎁 Book has reward voice:', rewardVoice);
                        setBookRewardVoiceId(rewardVoice);
                    }
                    
                    // Load multi-character voice settings
                    const narratorVoice = rawData?.defaultNarratorVoiceId || (book as any)?.defaultNarratorVoiceId;
                    const charVoices = rawData?.characterVoices || (book as any)?.characterVoices;
                    if (narratorVoice) {
                        console.log('🎭 Book has default narrator voice:', narratorVoice);
                        setDefaultNarratorVoiceId(narratorVoice);
                    }
                    if (charVoices && Array.isArray(charVoices) && charVoices.length > 0) {
                        console.log('🎭 Book has character voices:', charVoices);
                        setCharacterVoices(charVoices);
                    }
                    
                    // Increment view count in database (when book is OPENED)
                    try {
                        await ApiService.incrementBookView(bookId);
                        console.log('👁️ Book view tracked in database');
                    } catch (viewErr) {
                        console.warn('Failed to track book view:', viewErr);
                    }
                }
                
                // Load quiz attempts from localStorage
                const savedAttempts = localStorage.getItem(`quiz_attempts_${bookId}`);
                if (savedAttempts) {
                    setQuizAttemptCount(parseInt(savedAttempts, 10));
                }
                
                const rawData = (book as any)?.rawData;
                const files = rawData?.files || (book as any)?.files;

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
                        audio.preload = 'auto';
                        bookBackgroundMusicRef.current = audio;
                        ensureBookMusicGraph(audio);

                        // Start playing book music automatically when loaded
                        audio.addEventListener('canplaythrough', async () => {
                            await resumeBookMusicContext();
                            if (bookMusicEnabledRef.current) {
                                console.log('🎵 Book music ready - starting playback');
                                // Set volume directly for cross-origin audio (CORS-safe)
                                audio.volume = musicVolume;
                                audio.muted = false;
                                audio.play().catch(err => {
                                    console.warn('⚠️ Book music auto-play prevented:', err);
                                    // Update UI to reflect that music isn't actually playing
                                    setBookMusicEnabled(false);
                                });
                            }
                        }, { once: true });

                        // Try to play immediately if already loaded
                        if (audio.readyState >= 3 && bookMusicEnabledRef.current) {
                            await resumeBookMusicContext();
                            audio.volume = musicVolume;
                            audio.muted = false;
                            audio.play().catch(err => {
                                console.warn('⚠️ Book music immediate play prevented:', err);
                                // Update UI to reflect that music isn't actually playing
                                setBookMusicEnabled(false);
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
                // Still mark intro video as checked on error
                setIntroVideoChecked(true);
            }
        };

        fetchBookData();

        // Cleanup function
        return () => {
            console.log('📖 BookReaderPage UNMOUNTING - Cleanup');
            if (killInterval) clearInterval(killInterval);

            // Stop and destroy book background music
            if (bookBackgroundMusicRef.current) {
                bookBackgroundMusicRef.current.pause();
                bookBackgroundMusicRef.current.src = '';
                bookBackgroundMusicRef.current = null;
            }
            // Disconnect WebAudio graph for book music source
            if (bookMusicSourceRef.current) {
                try { bookMusicSourceRef.current.disconnect(); } catch { }
                bookMusicSourceRef.current = null;
            }

            // Resume app music
            setMusicPaused(false);
        };
    }, [bookId, setGameMode, setMusicPaused, ensureBookMusicGraph, resumeBookMusicContext]); // Removed bookMusicEnabled from dependencies

    // Ref to track current audio for cleanup (avoids stale closure issues)
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        currentAudioRef.current = currentAudio;
    }, [currentAudio]);

    // Helper function to stop all book audio
    const stopAllBookAudio = useCallback(() => {
        console.log('📖 Stopping ALL book audio');
        // Stop TTS narration
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = '';
        }
        // Stop book background music
        if (bookBackgroundMusicRef.current) {
            bookBackgroundMusicRef.current.pause();
            bookBackgroundMusicRef.current.src = '';
        }
        // Reset state
        setPlaying(false);
        playingRef.current = false;
        setActiveTextBoxIndex(null);
        setCurrentWordIndex(-1);
        // Clear MediaSession
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.playbackState = 'none';
            } catch (e) { }
        }
    }, []);

    // Keep playingRef in sync with playing state for use in closures
    useEffect(() => {
        playingRef.current = playing;
    }, [playing]);
    

    // Effect: Stop TTS audio when component unmounts OR when navigating away
    useEffect(() => {
        // Listen for beforeunload (page refresh/close)
        const handleBeforeUnload = () => {
            stopAllBookAudio();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // Listen for hash changes (React Router navigation with HashRouter)
        const handleHashChange = () => {
            // If we're no longer on a book reader page, stop audio
            if (!window.location.hash.includes('/read/')) {
                console.log('📖 Navigated away from book reader - stopping audio');
                stopAllBookAudio();
            }
        };
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            console.log('📖 BookReaderPage - Stopping TTS audio on unmount');
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('hashchange', handleHashChange);
            stopAllBookAudio();
        };
    }, [stopAllBookAudio]); // Include stopAllBookAudio in deps

    // Effect: Stop audio when page becomes hidden (user switches tabs/apps)
    // Book music should NOT play in background - only playlists should do that
    useEffect(() => {
        const stopBookAudio = () => {
            console.log('📖 Stopping book audio (app backgrounded)');
            // Stop TTS narration
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
            }
            setPlaying(false);
            
            // Stop book background music - should NOT continue in background
            if (bookBackgroundMusicRef.current) {
                bookBackgroundMusicRef.current.pause();
            }
            
            // Clear MediaSession to prevent lock screen controls for book music
            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.metadata = null;
                    navigator.mediaSession.playbackState = 'none';
                } catch (e) {
                    // Ignore - some browsers don't support clearing
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopBookAudio();
            }
        };

        // iOS: 'pagehide' fires more reliably than visibilitychange when app is backgrounded
        const handlePageHide = () => {
            stopBookAudio();
        };

        // Additional fallback: 'blur' event on window
        const handleBlur = () => {
            // Only stop if document is actually hidden (not just losing focus within app)
            if (document.hidden) {
                stopBookAudio();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('blur', handleBlur);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('blur', handleBlur);
        };
    }, []); // Empty array - event handler uses refs, not stale state

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

                // Separate coloring pages for the end modal
                // All coloring pages are available in end modal
                const coloring = data.filter((p: any) => p.isColoringPage);
                setColoringPages(coloring);
                if (coloring.length > 0) {
                    setSelectedColoringPage(coloring[0]);
                    console.log('🎨 Coloring page found:', {
                        page: coloring[0],
                        backgroundUrl: coloring[0].backgroundUrl,
                        filesUrl: coloring[0].files?.background?.url
                    });
                }

                // Filter pages for the book flow:
                // - Include all non-coloring pages
                // - Include coloring pages that are NOT marked as "end modal only"
                // Note: coloringEndModalOnly defaults to true, so only explicitly false values show inline
                const regularPages = data.filter((p: any) => {
                    // Not a coloring page - always include
                    if (!p.isColoringPage) {
                        return true;
                    }
                    
                    // This is a coloring page - check if it should show inline
                    // coloringEndModalOnly: true (default) = show ONLY in end modal, not inline
                    // coloringEndModalOnly: false = show inline in book AND in end modal
                    const showInline = p.coloringEndModalOnly === false;
                    
                    console.log(`🎨 Coloring page ${p.pageNumber}:`, {
                        isColoringPage: p.isColoringPage,
                        coloringEndModalOnly: p.coloringEndModalOnly,
                        coloringEndModalOnlyType: typeof p.coloringEndModalOnly,
                        showInline,
                        willShowIn: showInline ? 'book + end modal' : 'end modal only'
                    });
                    
                    return showInline;
                });

                const theEndPage: Page = {
                    _id: 'the-end-page',
                    pageNumber: regularPages.length + 1,
                    backgroundUrl: theEndBackground,
                    backgroundType: 'image',
                    scrollUrl: '',
                    scrollHeight: 0,
                    textBoxes: [], // Empty - no text on the page itself, modal will show on top
                };

                // Regular pages + inline coloring pages + The End page
                setPages([...regularPages, theEndPage]);

                // Check if page is specified in URL (from Continue button)
                // URL param "page" = continue from specific page
                // URL param "continue=true" = resume from saved progress
                // No URL params = start fresh from page 1
                const pageParam = searchParams.get('page');
                const continueParam = searchParams.get('continue');
                
                console.log('📖 URL params check:', { pageParam, continueParam, url: window.location.href });
                
                if (pageParam) {
                    // Specific page requested (e.g., from Continue button)
                    const pageNum = parseInt(pageParam, 10);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= data.length) {
                        const pageIndex = pageNum - 1; // Convert to 0-based
                        setCurrentPageIndex(pageIndex);
                        currentPageIndexRef.current = pageIndex;
                        console.log(`📖 Navigated to page ${pageNum} from URL param`);
                    }
                } else if (continueParam === 'true') {
                    // Continue reading - load saved progress
                    const progress = readingProgressService.getProgress(bookId);
                    console.log('📖 Continue reading - progress data:', progress);
                    if (progress && progress.currentPageIndex >= 0 && progress.currentPageIndex < data.length) {
                        setCurrentPageIndex(progress.currentPageIndex);
                        currentPageIndexRef.current = progress.currentPageIndex;
                        console.log(`📖 Restored reading progress: Page ${progress.currentPageIndex + 1} of ${data.length}`);
                    } else {
                        console.log('📖 No valid progress found, starting from page 1');
                    }
                } else {
                    // "Read" button - start fresh from page 1
                    console.log(`📖 Starting book from page 1 (no continue param)`);
                    // Page index is already 0 by default
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

    // Deep link: /read/:bookId?coloring=<pageNumber|pageId> opens coloring modal directly
    useEffect(() => {
        try {
            if (openedColoringFromLinkRef.current) return;
            if (!bookId) return;

            const coloringParam = searchParams.get('coloring');
            if (!coloringParam) return;
            if (!coloringPages || coloringPages.length === 0) return;

            console.log('🎨 Deep link: Looking for coloring page:', coloringParam);
            console.log('🎨 Available coloring pages:', coloringPages.map(p => ({ pageNumber: p.pageNumber, _id: p._id })));

            const match = coloringPages.find((p: any) => {
                const pageNum = p?.pageNumber;
                const pageId = p?._id;
                return String(pageNum) === String(coloringParam) || String(pageId) === String(coloringParam);
            });

            if (match) {
                console.log('🎨 Found matching coloring page:', match);
                setSelectedColoringPage(match);
                setShowColoringModal(true);
                openedColoringFromLinkRef.current = true;
            } else {
                console.warn('🎨 No matching coloring page found for:', coloringParam);
            }
        } catch (err) {
            console.error('🎨 Error handling coloring deep link:', err);
        }
    }, [bookId, coloringPages, searchParams]);

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

    // Close language dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
                setShowLanguageDropdown(false);
            }
        };

        if (showLanguageDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showLanguageDropdown]);

    // Fetch translation when language changes - preload current + next 3 pages
    useEffect(() => {
        const PAGES_TO_PRELOAD = 3;
        
        const fetchTranslation = async (pageIndex: number, showLoading: boolean = false) => {
            if (selectedLanguage === 'en' || pages.length === 0) return;
            
            const page = pages[pageIndex];
            if (!page?._id) return;

            // Check if we already have this translation
            const cacheKey = `${page._id}_${selectedLanguage}`;
            if (translatedContent.has(cacheKey)) return;

            if (showLoading) setIsTranslating(true);
            
            try {
                const result = await translationService.getTranslatedPage(page._id, selectedLanguage);
                if (result) {
                    setTranslatedContent(prev => {
                        const newMap = new Map(prev);
                        newMap.set(cacheKey, {
                            text: result.translatedText,
                            textBoxes: result.translatedTextBoxes,
                        });
                        return newMap;
                    });
                }
            } catch (error) {
                console.error('Translation error:', error);
            } finally {
                if (showLoading) setIsTranslating(false);
            }
        };

        const preloadTranslations = async () => {
            if (selectedLanguage === 'en') {
                setTranslatedContent(new Map());
                return;
            }

            // Fetch current page first (with loading indicator)
            await fetchTranslation(currentPageIndex, true);
            
            // Then preload next pages in background (no loading indicator)
            for (let i = 1; i <= PAGES_TO_PRELOAD; i++) {
                const nextIndex = currentPageIndex + i;
                if (nextIndex < pages.length) {
                    // Don't await - let them load in parallel
                    fetchTranslation(nextIndex, false);
                }
            }
        };

        preloadTranslations();
        
        // Save language preference
        translationService.setPreferredLanguage(selectedLanguage);
        
        // Clear audio cache when translations are being fetched for non-English
        // This ensures we don't use cached English audio
        if (selectedLanguage !== 'en') {
            audioPreloadCacheRef.current.clear();
            preloadingInProgressRef.current.clear();
        }
    }, [selectedLanguage, currentPageIndex, pages]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
            }
        };
    }, [currentAudio]);

    // Track reading progress on unmount
    useEffect(() => {
        return () => {
            // Track reading progress analytics when user leaves the book
            if (bookId && pages.length > 0) {
                const pagesViewed = currentPageIndexRef.current + 1; // 1-indexed count
                const totalPages = pages.length;
                const currentPage = currentPageIndexRef.current + 1;
                analyticsService.bookReadProgress(bookId, pagesViewed, totalPages, currentPage, bookTitle);
                
                // End play event session for trending engagement tracking
                import('../services/playEventService').then(({ playEventService }) => {
                    playEventService.endBookSession(bookId);
                }).catch(() => {});
            }
        };
    }, [bookId, pages.length, bookTitle]);

    // Helper to map page data to include all file URLs
    const mapPage = (page: Page | undefined) => {
        if (!page) return null;
        
        // Extract scroll URL from all possible locations
        const extractedScrollUrl = page.scrollUrl || page.files?.scroll?.url || '';
        
        // Debug: log what we're getting from the API
        console.log('📄 mapPage - Page #' + page.pageNumber + ':', {
            scrollUrl_root: page.scrollUrl,
            scrollUrl_files: page.files?.scroll?.url,
            scrollUrl_FINAL: extractedScrollUrl,
            hasVideoSequence: page.useVideoSequence,
            videoSequenceCount: page.videoSequence?.length || 0,
            hasImageSequence: page.useImageSequence,
            imageSequenceCount: page.imageSequence?.length || 0,
            imageSequenceDuration: page.imageSequenceDuration,
            imageSequenceAnimation: page.imageSequenceAnimation,
        });
        
        const mapped = {
            ...page,
            id: page._id,
            // Extract URLs from files object if not at root level
            soundEffectUrl: page.files?.soundEffect?.url || page.soundEffectUrl,
            scrollUrl: extractedScrollUrl,
            backgroundUrl: page.backgroundUrl || page.files?.background?.url,
        };
        
        console.log('📄 mapPage OUTPUT - scrollUrl:', mapped.scrollUrl);
        
        return mapped;
    };

    const currentPage = mapPage(pages[currentPageIndex]);
    const isTheEndPage = currentPage?.id === 'the-end-page' || currentPageIndex === pages.length - 1;

    // Trigger voice unlock when user reaches "The End" page
    useEffect(() => {
        if (isTheEndPage && pages.length > 0 && bookId) {
            console.log('🎁 User reached The End page - triggering voice unlock check');
            // Mark book as completed
            bookCompletionService.markBookCompleted(bookId);
            // Trigger voice unlock
            handleUnlockRewardVoice();
        }
    }, [isTheEndPage, pages.length, bookId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle unlocking the reward voice when book is completed
    const handleUnlockRewardVoice = async () => {
        console.log('🎁 handleUnlockRewardVoice called, bookRewardVoiceId:', bookRewardVoiceId);
        
        if (!bookRewardVoiceId) {
            console.log('📚 No reward voice for this book (bookRewardVoiceId is null/empty)');
            return;
        }
        
        try {
            const user = authService.getUser();
            const userId = user?.email || user?._id;
            
            console.log('🎁 User info:', { email: user?.email, id: user?._id, userId });
            
            if (!userId) {
                console.log('⚠️ No user logged in, skipping voice unlock');
                return;
            }
            
            console.log(`🎁 Attempting to unlock reward voice: ${bookRewardVoiceId} for user: ${userId}`);
            
            const response = await fetch(`${API_BASE_URL}/api/voices/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    voiceId: bookRewardVoiceId,
                }),
            });
            
            console.log('🎁 Unlock response status:', response.status);
            const data = await response.json();
            console.log('🎁 Unlock response data:', data);
            
            if (data.success && !data.alreadyUnlocked) {
                // Voice was just unlocked - show celebration!
                console.log('🎉 Voice unlocked!', data.voice);
                setUnlockedVoice({
                    name: data.voice.name,
                    characterImage: data.voice.characterImage,
                });
                setShowVoiceUnlockModal(true);
            } else if (data.alreadyUnlocked) {
                console.log('✓ Voice was already unlocked');
            } else {
                console.log('⚠️ Unlock failed or unexpected response:', data);
            }
        } catch (error) {
            console.error('❌ Failed to unlock voice:', error);
        }
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex < pages.length - 1) {
            // Use desired scroll state if set, otherwise preserve current state from ref
            const scrollStateToUse = desiredScrollStateRef.current !== null
                ? desiredScrollStateRef.current
                : scrollStateRef.current; // Use ref to get latest value
            desiredScrollStateRef.current = null; // Reset after use

            setIsPageTurning(true);
            setFlipState({ direction: 'next', isFlipping: true });
            playPageTurnSound(); // Play page turn sound effect

            // Change page content at the halfway point (when page is perpendicular - 90deg)
            setTimeout(() => {
                const nextIndex = currentPageIndex + 1;
                setCurrentPageIndex(nextIndex);
                currentPageIndexRef.current = nextIndex;
                // Track page read for Report Card
                if (bookId) {
                    activityTrackingService.trackPageRead(bookId, nextIndex);
                    // Update engagement for trending (pages viewed)
                    import('../services/playEventService').then(({ playEventService }) => {
                        playEventService.updateBookEngagement(bookId, nextIndex + 1, pages.length);
                    }).catch(() => {});
                }
                // Use the determined scroll state
                setScrollState(scrollStateToUse);
                scrollStateRef.current = scrollStateToUse; // Update ref
            }, 400); // Halfway through 0.8s animation

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
                        // Mark book as completed (unlocks games permanently)
                        bookCompletionService.markBookCompleted(bookId);
                        // Increment read count when book is completed
                        readCountService.incrementReadCount(bookId);
                        // Track book completion analytics
                        analyticsService.bookReadComplete(bookId, bookTitle);
                        // Unlock reward voice if book has one
                        handleUnlockRewardVoice();
                    }
                }
            }, 850); // Slightly after 0.8s animation completes
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPageTurning) return;
        stopAudio();
        if (currentPageIndex > 0) {
            // Preserve scroll state when turning pages manually - use ref to get latest value
            const currentScrollState = scrollStateRef.current;

            setIsPageTurning(true);
            setFlipState({ direction: 'prev', isFlipping: true });
            playPageTurnSound(); // Play page turn sound effect

            // Change page content at the halfway point (when page is perpendicular - 90deg)
            setTimeout(() => {
                const prevIndex = currentPageIndex - 1;
                setCurrentPageIndex(prevIndex);
                currentPageIndexRef.current = prevIndex;
                // Preserve the scroll state from previous page
                setScrollState(currentScrollState);
                scrollStateRef.current = currentScrollState; // Update ref
            }, 400); // Halfway through 0.8s animation

            // End the flip animation
            setTimeout(() => {
                setIsPageTurning(false);
                setFlipState(null);
                // Save progress
                const prevIndex = currentPageIndex - 1;
                if (bookId) {
                    readingProgressService.saveProgress(bookId, prevIndex);
                }
            }, 850); // Slightly after 0.8s animation completes
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
        const swipeThresholdX = 50; // Reduced for more responsive swiping
        const swipeThresholdY = 100; // Allow more vertical tolerance for natural swipes
        const minSwipeTime = 50; // Reduced min time for quick flicks
        const maxSwipeTime = 600; // Faster swipes feel more responsive
        
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

    // Handle scroll state changes
    const handleScrollStateChange = (newState: ScrollState) => {
        setScrollState(newState);
        scrollStateRef.current = newState;
    };

    // Get translated text for a specific page and text box
    const getTranslatedText = (pageId: string, textBoxIndex: number, originalText: string): string => {
        if (selectedLanguage === 'en') return originalText;
        
        const cacheKey = `${pageId}_${selectedLanguage}`;
        const cached = translatedContent.get(cacheKey);
        
        if (cached && cached.textBoxes && cached.textBoxes[textBoxIndex]) {
            return cached.textBoxes[textBoxIndex].translatedText || originalText;
        }
        
        return originalText;
    };

    // Get all translated text boxes for current page
    const getTranslatedTextBoxes = (page: Page): TextBox[] => {
        // Check both locations: content.textBoxes (primary) and textBoxes (legacy)
        // IMPORTANT: Empty array [] is truthy, so check length explicitly
        const contentTextBoxes = page.content?.textBoxes;
        const sourceTextBoxes = (contentTextBoxes && contentTextBoxes.length > 0) 
            ? contentTextBoxes 
            : page.textBoxes;
        if (!sourceTextBoxes || sourceTextBoxes.length === 0) return [];
        
        if (selectedLanguage === 'en') {
            return sourceTextBoxes;
        }
        
        const cacheKey = `${page._id}_${selectedLanguage}`;
        const cached = translatedContent.get(cacheKey);
        
        return sourceTextBoxes.map((tb, index) => {
            const translatedText = cached?.textBoxes?.[index]?.translatedText || tb.text;
            return { ...tb, text: translatedText };
        });
    };

    // Cycle scroll state: mid -> hidden (tap to hide)
    const toggleScrollVisibility = (e?: React.MouseEvent) => {
        // Stop propagation to prevent music unlock
        if (e) {
            e.stopPropagation();
        }

        // Tap to toggle between mid and hidden
        setScrollState(prev => {
            const newState: ScrollState = prev === 'hidden' ? 'mid' : 'hidden';
            scrollStateRef.current = newState;
            return newState;
        });
    };

    // Handle vertical swipe on scroll area to change height
    const handleScrollSwipe = (direction: 'up' | 'down') => {
        setScrollState(prev => {
            let newState: ScrollState;
            if (direction === 'up') {
                // Swipe up: hidden -> mid -> max
                newState = prev === 'hidden' ? 'mid' : prev === 'mid' ? 'max' : 'max';
            } else {
                // Swipe down: max -> mid -> hidden
                newState = prev === 'max' ? 'mid' : prev === 'mid' ? 'hidden' : 'hidden';
            }
            scrollStateRef.current = newState;
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
                if (scrollState !== 'hidden') {
                    setScrollState('hidden');
                    scrollStateRef.current = 'hidden';
                }
            }
        } else {
            // Normal mode: just toggle scroll visibility
            toggleScrollVisibility(e);
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

        // Enable auto-play mode only if TTS mode is 'auto'
        const shouldAutoPlay = ttsMode === 'auto';
        setAutoPlayMode(shouldAutoPlay);
        autoPlayModeRef.current = shouldAutoPlay;

        // Play the first text box on the page (use translated text if available)
        // Note: textBoxes is nested under content in the database schema
        const contentBoxes = currentPage.content?.textBoxes;
        const pageTextBoxes = (contentBoxes && contentBoxes.length > 0) ? contentBoxes : currentPage.textBoxes;
        if (pageTextBoxes && pageTextBoxes.length > 0) {
            const translatedTextBoxes = getTranslatedTextBoxes(currentPage);
            const firstBoxText = translatedTextBoxes[0]?.text || pageTextBoxes[0].text;
            handlePlayText(firstBoxText, 0, e, shouldAutoPlay); // Pass autoPlay flag based on mode
        } else {
            console.warn('⚠️ No text boxes found on current page');
        }
    };
    
    // Toggle TTS mode
    const toggleTtsMode = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newMode = ttsMode === 'auto' ? 'page' : 'auto';
        setTtsMode(newMode);
        ttsModeRef.current = newMode;
        setShowTtsModeMenu(false);
        
        // If currently playing and switching modes, update autoPlayMode accordingly
        if (playing) {
            if (newMode === 'page') {
                setAutoPlayMode(false);
                autoPlayModeRef.current = false;
            } else {
                setAutoPlayMode(true);
                autoPlayModeRef.current = true;
            }
        }
    };

    // Preload audio for upcoming pages (runs in background)
    const preloadUpcomingAudio = async (startPageIndex: number) => {
        const pagesToPreload = 3; // Preload next 3 pages
        // Use ref to get current language value (stable across async operations)
        const currentLang = selectedLanguageRef.current;
        
        for (let i = 0; i < pagesToPreload; i++) {
            const pageIndex = startPageIndex + i;
            if (pageIndex >= pages.length - 1) break; // Don't preload "The End" page
            
            const page = pages[pageIndex];
            const pgContentBoxes = page?.content?.textBoxes;
            const pageTextBoxes = (pgContentBoxes && pgContentBoxes.length > 0) ? pgContentBoxes : page?.textBoxes;
            if (!page || !pageTextBoxes) continue;
            
            // For non-English, check if translation is available before preloading
            // If not available, skip preloading - it will be generated on-demand
            if (currentLang !== 'en') {
                const cacheKey = `${page._id}_${currentLang}`;
                const hasTranslation = translatedContent.has(cacheKey);
                if (!hasTranslation) {
                    console.log(`⏳ Skipping audio preload for page ${pageIndex + 1} - translation not ready yet`);
                    continue; // Skip this page, will preload when translation is ready
                }
            }
            
            // Preload each text box on the page
            for (let textBoxIndex = 0; textBoxIndex < pageTextBoxes.length; textBoxIndex++) {
                const textBox = pageTextBoxes[textBoxIndex];
                if (!textBox.text) continue;
                
                // Get translated text if available
                const rawTextToSpeak = getTranslatedText(page._id, textBoxIndex, textBox.text);
                
                // Parse for @Character tags and get the appropriate voice
                const { voiceId: voiceForText, cleanText: textToPreload, characterName } = getVoiceForText(rawTextToSpeak);
                
                // Include language AND voice in cache key for multilingual + character voice support
                const audioCacheKey = `${pageIndex}-${textBoxIndex}-${voiceForText}${currentLang !== 'en' ? `-${currentLang}` : ''}`;
                
                // Skip if already cached or currently preloading
                if (audioPreloadCacheRef.current.has(audioCacheKey) || preloadingInProgressRef.current.has(audioCacheKey)) {
                    continue;
                }
                
                // Mark as preloading
                preloadingInProgressRef.current.add(audioCacheKey);
                
                // Preload in background (don't await to avoid blocking)
                (async () => {
                    try {
                        // IMPORTANT: For non-English, verify we have the actual translation, not fallback
                        // If textToPreload equals original text but language isn't English, skip preload
                        if (currentLang !== 'en' && textToPreload === textBox.text) {
                            console.log(`⚠️ Skipping audio preload - translation not available for page ${pageIndex + 1}`);
                            preloadingInProgressRef.current.delete(audioCacheKey);
                            return;
                        }
                        
                        const processed = processTextWithEmotionalCues(textToPreload);
                        // For non-English, strip emotional cues (multilingual model doesn't support them)
                        const ttsText = currentLang !== 'en' 
                            ? removeEmotionalCues(textToPreload) 
                            : processed.processedText;
                        
                        console.log(`🎤 Preloading TTS for page ${pageIndex + 1} in ${currentLang}${characterName ? ` [🎭 ${characterName}]` : ''}: "${ttsText.substring(0, 50)}..."`);
                        
                        const result = await ApiService.generateTTS(
                            ttsText,
                            voiceForText, // Use character or narrator voice
                            bookId || undefined,
                            currentLang !== 'en' ? currentLang : undefined
                        );
                        
                        if (result && result.audioUrl) {
                            audioPreloadCacheRef.current.set(audioCacheKey, {
                                audioUrl: result.audioUrl,
                                alignment: result.alignment
                            });
                            console.log(`🎵 Preloaded audio for page ${pageIndex + 1}, text box ${textBoxIndex + 1} (${currentLang})${characterName ? ` [${characterName}]` : ''}`);
                        }
                    } catch (err) {
                        console.warn(`Failed to preload audio for page ${pageIndex + 1}:`, err);
                    } finally {
                        preloadingInProgressRef.current.delete(audioCacheKey);
                    }
                })();
            }
        }
    };

    // Track previous language to detect changes
    const prevLanguageRef = useRef<string>(selectedLanguage);
    
    // Trigger audio preloading when page changes, voice changes, language changes, or translations load
    useEffect(() => {
        const currentLang = selectedLanguageRef.current;
        
        // Check if language actually changed
        if (prevLanguageRef.current !== currentLang) {
            // Clear the audio cache when language changes (BEFORE preloading)
            audioPreloadCacheRef.current.clear();
            preloadingInProgressRef.current.clear();
            console.log(`🌐 Language changed from ${prevLanguageRef.current} to ${currentLang}, cleared audio cache`);
            prevLanguageRef.current = currentLang;
        }
        
        if (pages.length > 0 && effectiveVoiceId) {
            // For non-English, only preload when translations are ready
            if (currentLang !== 'en' && translatedContent.size === 0) {
                console.log(`⏳ Waiting for translations before preloading audio (${currentLang})`);
                return;
            }
            // Start preloading from current page
            console.log(`🎵 Starting audio preload for ${currentLang}, page ${currentPageIndex + 1}`);
            preloadUpcomingAudio(currentPageIndex);
        }
    }, [currentPageIndex, effectiveVoiceId, pages.length, selectedLanguage, translatedContent.size]);

    // Auto-play TTS when book first loads (after intro video if any)
    useEffect(() => {
        // Don't auto-play if:
        // - Already auto-played this session
        // - Still loading
        // - Intro video check not complete
        // - Intro video is still showing
        // - Not on first page
        // - No voice selected
        // - No pages loaded
        if (
            hasAutoPlayedOnStartRef.current ||
            loading ||
            !introVideoChecked ||
            showIntroVideo ||
            currentPageIndex !== 0 ||
            !effectiveVoiceId ||
            pages.length === 0
        ) {
            return;
        }

        const currentPage = pages[0];
        if (!currentPage) return;

        // Get text boxes from the first page
        const pageTextBoxes = currentPage.textBoxes || currentPage.content?.textBoxes;
        if (!pageTextBoxes || pageTextBoxes.length === 0) {
            console.log('🔇 Auto-play: No text boxes on first page, skipping');
            return;
        }

        // For non-English, wait for translations
        const currentLang = selectedLanguageRef.current || 'en';
        if (currentLang !== 'en' && translatedContent.size === 0) {
            console.log('⏳ Auto-play: Waiting for translations...');
            return;
        }

        // Mark as auto-played to prevent repeating
        hasAutoPlayedOnStartRef.current = true;
        
        console.log('▶️ Auto-playing TTS on book start (intro video finished)');
        
        // Enable auto-play mode based on ttsMode setting
        const shouldAutoPlay = ttsModeRef.current === 'auto';
        setAutoPlayMode(shouldAutoPlay);
        autoPlayModeRef.current = shouldAutoPlay;
        
        // Longer delay to ensure intro video transition is complete
        // and the first page is fully rendered
        setTimeout(() => {
            // Get translated text if available
            const translatedTextBoxes = getTranslatedTextBoxes(currentPage);
            const firstBoxText = translatedTextBoxes[0]?.text || pageTextBoxes[0].text;
            
            // Create synthetic event and trigger playback
            const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
            handlePlayText(firstBoxText, 0, syntheticEvent, shouldAutoPlay);
        }, 1500); // 1.5s delay to let intro video fade out and page fully settle
        
    }, [loading, introVideoChecked, showIntroVideo, currentPageIndex, effectiveVoiceId, pages, translatedContent.size]);

    // Preload background images/videos for upcoming pages to prevent black flash
    const preloadBackgrounds = (startPageIndex: number) => {
        const PAGES_TO_PRELOAD = 3;
        
        for (let i = 1; i <= PAGES_TO_PRELOAD; i++) {
            const pageIndex = startPageIndex + i;
            if (pageIndex >= pages.length) break;
            
            const page = pages[pageIndex];
            if (!page) continue;
            
            const backgroundUrl = page.backgroundUrl || page.files?.background?.url;
            const backgroundType = page.backgroundType || page.files?.background?.type || 'image';
            
            if (!backgroundUrl || preloadedBackgroundsRef.current.has(backgroundUrl)) {
                continue; // Skip if no URL or already preloaded
            }
            
            // Mark as preloaded
            preloadedBackgroundsRef.current.add(backgroundUrl);
            
            if (backgroundType === 'video') {
                // Preload video
                const video = document.createElement('video');
                video.preload = 'auto';
                video.muted = true;
                video.src = backgroundUrl;
                video.load();
                console.log(`🎬 Preloading video for page ${pageIndex + 1}`);
            } else {
                // Preload image
                const img = new Image();
                img.src = backgroundUrl;
                console.log(`🖼️ Preloading image for page ${pageIndex + 1}`);
            }
            
            // Also preload scroll image if exists
            const scrollUrl = page.scrollUrl || page.files?.scroll?.url;
            if (scrollUrl && !preloadedBackgroundsRef.current.has(scrollUrl)) {
                preloadedBackgroundsRef.current.add(scrollUrl);
                const scrollImg = new Image();
                scrollImg.src = scrollUrl;
                console.log(`📜 Preloading scroll for page ${pageIndex + 1}`);
            }
        }
    };

    // Trigger background preloading when page changes
    useEffect(() => {
        if (pages.length > 0) {
            preloadBackgrounds(currentPageIndex);
        }
    }, [currentPageIndex, pages.length]);

    // Also preload when pages first load
    useEffect(() => {
        if (pages.length > 0) {
            // Preload first few pages immediately
            preloadBackgrounds(0);
        }
    }, [pages]);

    /**
     * Stop any currently playing multi-segment audio cleanly.
     * Prevents overlapping audio issues.
     */
    const stopMultiSegmentAudio = () => {
        if (multiSegmentAudioRef.current) {
            try {
                multiSegmentAudioRef.current.pause();
                multiSegmentAudioRef.current.onended = null;
                multiSegmentAudioRef.current.ontimeupdate = null;
                multiSegmentAudioRef.current.onplay = null;
                multiSegmentAudioRef.current = null;
            } catch (e) {
                console.warn('Error stopping multi-segment audio:', e);
            }
        }
    };
    
    /**
     * Calculate cumulative word offset for a segment.
     * This ensures highlighting continues correctly across segments.
     */
    const getSegmentWordOffset = (segments: TextSegment[], segmentIdx: number): number => {
        let offset = 0;
        for (let i = 0; i < segmentIdx; i++) {
            // Count words in previous segments (matching how display text is rendered)
            const segmentText = segments[i].text;
            const words = segmentText.split(/\s+/).filter(w => w.length > 0);
            offset += words.length;
            // Add 1 for the space/quote between segments in display
            // This accounts for punctuation that appears in displayed text
        }
        return offset;
    };
    
    /**
     * Play a single segment of multi-segment TTS.
     * Called recursively to play all segments in sequence.
     */
    const playSegment = async (
        segment: TextSegment,
        segmentIdx: number,
        allSegments: TextSegment[],
        textBoxIndex: number,
        isAutoPlay: boolean,
        currentLang: string,
        wordOffset: number = 0 // Cumulative word offset for highlighting
    ) => {
        try {
            // IMPORTANT: Stop any previous audio BEFORE starting new one
            // This prevents overlapping audio
            stopMultiSegmentAudio();
            
            // Check if we've been cancelled
            if (!isPlayingMultiSegmentRef.current) {
                console.log('🛑 Multi-segment playback was cancelled');
                return;
            }
            
            // Generate TTS for this segment
            const processed = processTextWithEmotionalCues(segment.text);
            const ttsText = currentLang !== 'en' 
                ? removeEmotionalCues(segment.text) 
                : processed.processedText;
            
            console.log(`🎭 Multi-segment ${segmentIdx + 1}/${allSegments.length}: "${ttsText.substring(0, 40)}..." [${segment.isNarrator ? 'Narrator' : segment.characterName}] (wordOffset: ${wordOffset})`);
            
            const result = await ApiService.generateTTS(
                ttsText,
                segment.voiceId,
                bookId || undefined,
                currentLang !== 'en' ? currentLang : undefined
            );
            
            if (!result?.audioUrl) {
                console.error(`Failed to generate audio for segment ${segmentIdx + 1}`);
                // Try to continue with next segment
                const nextSegmentIdx = segmentIdx + 1;
                if (nextSegmentIdx < allSegments.length && isPlayingMultiSegmentRef.current) {
                    const nextWordOffset = wordOffset + segment.text.split(/\s+/).filter(w => w.length > 0).length;
                    playSegment(allSegments[nextSegmentIdx], nextSegmentIdx, allSegments, textBoxIndex, isAutoPlay, currentLang, nextWordOffset);
                }
                return;
            }
            
            // Check again if cancelled (TTS generation takes time)
            if (!isPlayingMultiSegmentRef.current) {
                console.log('🛑 Multi-segment playback cancelled during TTS generation');
                return;
            }
            
            const audio = new Audio(result.audioUrl);
            multiSegmentAudioRef.current = audio;
            
            // Calculate words in this segment for highlighting
            const segmentWords = segment.text.split(/\s+/).filter(w => w.length > 0);
            
            // Set up word alignment for this segment WITH OFFSET
            audio.addEventListener('loadedmetadata', () => {
                const audioDuration = audio.duration;
                
                if (segmentWords.length > 0) {
                    const wordDuration = audioDuration / segmentWords.length;
                    const alignment = {
                        words: segmentWords.map((word, idx) => ({
                            word,
                            start: idx * wordDuration,
                            end: (idx + 1) * wordDuration,
                            // Store the GLOBAL index for highlighting
                            globalIndex: wordOffset + idx
                        }))
                    };
                    setWordAlignment(alignment);
                    wordAlignmentRef.current = alignment;
                }
            });
            
            // Track time for highlighting - use GLOBAL word index
            let lastWordIdx = -1;
            audio.ontimeupdate = () => {
                const alignment = wordAlignmentRef.current;
                if (alignment?.words) {
                    for (let i = 0; i < alignment.words.length; i++) {
                        const w = alignment.words[i];
                        if (audio.currentTime >= w.start && audio.currentTime < w.end) {
                            // Use the GLOBAL index for highlighting
                            const globalIdx = wordOffset + i;
                            if (globalIdx !== lastWordIdx) {
                                lastWordIdx = globalIdx;
                                setCurrentWordIndex(globalIdx);
                            }
                            break;
                        }
                    }
                }
            };
            
            // When this segment ends, play the next one or finish
            audio.onended = () => {
                // Don't clear word index immediately - keep last word highlighted briefly
                const nextSegmentIdx = segmentIdx + 1;
                
                if (nextSegmentIdx < allSegments.length && isPlayingMultiSegmentRef.current) {
                    // Play next segment with updated word offset
                    console.log(`▶️ Playing next segment ${nextSegmentIdx + 1}/${allSegments.length}`);
                    currentSegmentIndexRef.current = nextSegmentIdx;
                    setCurrentSegmentIndex(nextSegmentIdx);
                    
                    // Calculate new offset: current offset + words in current segment
                    const nextWordOffset = wordOffset + segmentWords.length;
                    playSegment(allSegments[nextSegmentIdx], nextSegmentIdx, allSegments, textBoxIndex, isAutoPlay, currentLang, nextWordOffset);
                } else {
                    // All segments complete - trigger auto-play to next page if enabled
                    console.log(`✅ All ${allSegments.length} segments complete`);
                    isPlayingMultiSegmentRef.current = false;
                    setCurrentSegments([]);
                    setCurrentSegmentIndex(0);
                    currentSegmentIndexRef.current = 0;
                    multiSegmentAudioRef.current = null;
                    setCurrentWordIndex(-1);
                    setWordAlignment(null);
                    wordAlignmentRef.current = null;
                    
                    // Clear playing state
                    setTimeout(() => {
                        setPlaying(false);
                        playingRef.current = false;
                        setActiveTextBoxIndex(null);
                        
                        // Auto-play: Move to next page if enabled
                        const currentPageIdx = currentPageIndexRef.current;
                        if (autoPlayModeRef.current && !isAutoPlayingRef.current && currentPageIdx < pages.length - 1) {
                            isAutoPlayingRef.current = true;
                            const nextPageIndex = currentPageIdx + 1;
                            console.log('🔄 Multi-segment auto-play: Moving to page', nextPageIndex + 1);
                            
                            setIsPageTurning(true);
                            setFlipState({ direction: 'next', isFlipping: true });
                            playPageTurnSound();
                            
                            setTimeout(() => {
                                setCurrentPageIndex(nextPageIndex);
                                currentPageIndexRef.current = nextPageIndex;
                                setScrollState(scrollStateRef.current);
                            }, 400);
                            
                            setTimeout(() => {
                                setIsPageTurning(false);
                                setFlipState(null);
                                if (bookId) {
                                    readingProgressService.saveProgress(bookId, nextPageIndex);
                                }
                                
                                setTimeout(() => {
                                    if (autoPlayModeRef.current && currentPageIndexRef.current === nextPageIndex) {
                                        const nextPage = pages[nextPageIndex];
                                        const nextPageTextBoxes = nextPage?.content?.textBoxes || nextPage?.textBoxes;
                                        if (nextPage && nextPageTextBoxes && nextPageTextBoxes.length > 0) {
                                            const translatedTextBoxes = getTranslatedTextBoxes(nextPage);
                                            const firstBoxText = translatedTextBoxes[0]?.text || nextPageTextBoxes[0].text;
                                            isAutoPlayingRef.current = false;
                                            const syntheticEvent = { stopPropagation: () => {} } as React.MouseEvent;
                                            handlePlayText(firstBoxText, 0, syntheticEvent, true);
                                        } else {
                                            setAutoPlayMode(false);
                                            autoPlayModeRef.current = false;
                                            isAutoPlayingRef.current = false;
                                        }
                                    } else {
                                        isAutoPlayingRef.current = false;
                                    }
                                }, 300);
                            }, 800);
                        } else if (autoPlayModeRef.current && currentPageIdx >= pages.length - 1) {
                            // End of book
                            setAutoPlayMode(false);
                            autoPlayModeRef.current = false;
                            if (bookId) {
                                bookCompletionService.markBookCompleted(bookId);
                                readCountService.incrementReadCount(bookId);
                                analyticsService.bookReadComplete(bookId, bookTitle);
                                handleUnlockRewardVoice();
                            }
                        }
                    }, 300);
                }
            };
            
            audio.onplay = () => {
                setPlaying(true);
                playingRef.current = true;
                setShowLoadingPopup(false);
            };
            
            audio.onpause = () => {
                // Only set playing false if intentionally paused (not just ended)
                if (!audio.ended) {
                    setPlaying(false);
                    playingRef.current = false;
                }
            };
            
            // Play this segment
            if (audio.readyState >= 3) {
                audio.play().catch(err => console.warn('Segment play failed:', err));
            } else {
                audio.addEventListener('canplaythrough', () => {
                    audio.play().catch(err => console.warn('Segment play failed:', err));
                }, { once: true });
                audio.load();
            }
        } catch (error) {
            console.error(`Error playing segment ${segmentIdx + 1}:`, error);
            isPlayingMultiSegmentRef.current = false;
            setPlaying(false);
            playingRef.current = false;
        }
    };
    
    const handlePlayText = async (text: string, index: number, e: React.MouseEvent, isAutoPlay: boolean = false) => {
        e.stopPropagation();

        // If already playing this text, pause it
        if (playing && activeTextBoxIndex === index) {
            // Pause multi-segment playback if active (but DON'T clear state - allow resume)
            if (multiSegmentAudioRef.current) {
                multiSegmentAudioRef.current.pause();
                console.log('⏸️ Paused multi-segment audio');
            }
            currentAudio?.pause();
            setPlaying(false);
            playingRef.current = false;
            setAutoPlayMode(false);
            autoPlayModeRef.current = false;
            return;
        }
        
        // If paused on this text and we have multi-segment audio, resume it
        if (!playing && activeTextBoxIndex === index && multiSegmentAudioRef.current && isPlayingMultiSegmentRef.current) {
            console.log('▶️ Resuming multi-segment audio');
            multiSegmentAudioRef.current.play().catch(err => console.warn('Resume failed:', err));
            setPlaying(true);
            playingRef.current = true;
            if (isAutoPlay) {
                setAutoPlayMode(true);
                autoPlayModeRef.current = true;
            }
            return;
        }

        // If playing another text, stop it completely
        if (playing && activeTextBoxIndex !== index) {
            stopAudio();
            // Fully stop multi-segment playback
            if (isPlayingMultiSegmentRef.current) {
                stopMultiSegmentAudio();
                isPlayingMultiSegmentRef.current = false;
                setCurrentSegments([]);
                setCurrentSegmentIndex(0);
                currentSegmentIndexRef.current = 0;
            }
        }
        
        // If switching to a new text box, clear any paused multi-segment state
        if (activeTextBoxIndex !== index && isPlayingMultiSegmentRef.current) {
            stopMultiSegmentAudio();
            isPlayingMultiSegmentRef.current = false;
            setCurrentSegments([]);
            setCurrentSegmentIndex(0);
            currentSegmentIndexRef.current = 0;
        }

        // If we have audio for this text already loaded and paused (single segment), resume it
        if (activeTextBoxIndex === index && currentAudio && !isPlayingMultiSegmentRef.current) {
            currentAudio.play();
            setPlaying(true);
            playingRef.current = true;
            if (isAutoPlay) {
                setAutoPlayMode(true);
                autoPlayModeRef.current = true;
            }
            return;
        }

        // Otherwise, generate/fetch new audio
        setActiveTextBoxIndex(index);
        setLoadingAudio(true);
        setShowLoadingPopup(true); // Show dismissible loading popup
        setCurrentWordIndex(-1);
        setWordAlignment(null);
        wordAlignmentRef.current = null;
        alignmentWarningShownRef.current = false; // Reset warning flag for new audio

        try {
            // Check preload cache first - use ref for accurate page index (state might be stale)
            const actualPageIndex = currentPageIndexRef.current;
            // Use ref for language to get latest value in async context
            const currentLang = selectedLanguageRef.current;
            
            // Get translated text if available
            const currentPage = pages[actualPageIndex];
            const rawTextToSpeak = currentPage?._id 
                ? getTranslatedText(currentPage._id, index, text) 
                : text;
            
            // ============ MULTI-SEGMENT TTS ============
            // Parse text into segments for alternating narrator/character voices
            const segments = parseTextIntoSegments(rawTextToSpeak);
            
            // If multiple segments, use multi-segment playback
            if (segments.length > 1) {
                console.log(`🎭 Multi-segment TTS: ${segments.length} segments detected`);
                isPlayingMultiSegmentRef.current = true;
                setCurrentSegments(segments);
                setCurrentSegmentIndex(0);
                currentSegmentIndexRef.current = 0;
                
                if (isAutoPlay) {
                    setAutoPlayMode(true);
                    autoPlayModeRef.current = true;
                }
                
                setLoadingAudio(false);
                // Start playing first segment
                playSegment(segments[0], 0, segments, index, isAutoPlay, currentLang);
                return;
            }
            // ============ END MULTI-SEGMENT ============
            
            // Single segment - use existing logic
            const segment = segments[0];
            const voiceForText = segment.voiceId;
            const textToSpeak = segment.text;
            const characterName = segment.characterName;
            
            // Include language AND voice in cache key for multilingual + character voice support
            const cacheKey = `${actualPageIndex}-${index}-${voiceForText}${currentLang !== 'en' ? `-${currentLang}` : ''}`;
            let result = audioPreloadCacheRef.current.get(cacheKey);
            
            if (result) {
                console.log(`🎵 Using preloaded audio for page ${actualPageIndex + 1}, text box ${index + 1} (lang: ${currentLang})${characterName ? ` [${characterName}]` : ''}`);
                setShowLoadingPopup(false); // Hide popup immediately if cached
            } else {
                // Not in cache, generate now with translated text
                // IMPORTANT: Check if we actually have a translation for non-English
                const isUsingTranslation = currentLang !== 'en' && textToSpeak !== text;
                
                if (currentLang !== 'en' && !isUsingTranslation) {
                    console.warn(`⚠️ No translation available for ${currentLang}, using original text with multilingual TTS`);
                }
                
                const processed = processTextWithEmotionalCues(textToSpeak);
                // For non-English, strip emotional cues (multilingual model doesn't support them)
                const ttsText = currentLang !== 'en' 
                    ? removeEmotionalCues(textToSpeak) 
                    : processed.processedText;
                    
                console.log(`🎤 Generating TTS for page ${actualPageIndex + 1}, text box ${index + 1} (lang: ${currentLang})${characterName ? ` [🎭 ${characterName}]` : ''}${isUsingTranslation ? ' [TRANSLATED]' : ''}`);
                console.log(`📝 Text to speak: "${ttsText.substring(0, 80)}..."`);
                console.log(`🔊 Using voice: ${voiceForText}${characterName ? ` (character: ${characterName})` : ' (narrator)'}`);
                
                result = await ApiService.generateTTS(
                    ttsText,
                    voiceForText, // Use character or narrator voice
                    bookId || undefined,
                    currentLang !== 'en' ? currentLang : undefined
                ) || undefined;
            }

            // Use audio URL (from cache or freshly generated)
            if (result && result.audioUrl) {
                const audio = new Audio(result.audioUrl);

                // Wait for audio metadata to load, then process alignment
                audio.addEventListener('loadedmetadata', () => {
                    const audioDuration = audio.duration;
                    const alignment = result.alignment;
                    
                    // DEBUG: Log alignment data
                    console.log('🔍 ALIGNMENT DEBUG:', {
                        hasAlignment: !!alignment,
                        hasWords: alignment?.words?.length || 0,
                        isEstimated: alignment?.isEstimated,
                        firstWord: alignment?.words?.[0],
                        audioUrl: result.audioUrl?.substring(0, 50)
                    });
                    
                    // Get the clean text (same as what's displayed)
                    const cleanText = text.replace(/\[([^\]]+)\]/g, '').replace(/\s+/g, ' ').trim();
                    const displayWords = cleanText.split(/\s+/).filter(w => w.length > 0);
                    
                    // Use EXACT ElevenLabs timestamps if available
                    if (alignment && alignment.words && alignment.words.length > 0 && !alignment.isEstimated) {
                        // Filter out bracketed words but keep EXACT timestamps
                        // Also normalize words to match displayed text (remove punctuation that gets stripped)
                        const filteredWords: Array<{ word: string; start: number; end: number }> = [];
                        let insideBracket = false;
                        let skipNextPunctuation = false; // Skip punctuation that follows a bracket
                        
                        for (const wordData of alignment.words) {
                            const word = wordData.word || '';
                            
                            // Skip standalone punctuation that follows bracketed content
                            // ElevenLabs might return "," or "." as separate words after [emotion]
                            if (skipNextPunctuation && /^[.,!?;:'"-]+$/.test(word)) {
                                skipNextPunctuation = false;
                                continue;
                            }
                            skipNextPunctuation = false;
                            
                            // Track bracket sequences (multi-word sound effects like "[gentle wind breeze]")
                            if (word.includes('[')) {
                                insideBracket = true;
                            }
                            
                            // Check if this word contains bracketed content
                            const isBracketedWord = /\[.*\]/.test(word);
                            
                            // Skip if we're inside a bracket sequence OR this word contains brackets
                            if (insideBracket || isBracketedWord) {
                                if (word.includes(']')) {
                                    insideBracket = false;
                                    // Flag to skip following punctuation (e.g., comma after [dramatically],)
                                    skipNextPunctuation = true;
                                }
                                continue;
                            }
                            
                            // Clean the word:
                            // 1. Remove any bracket expressions
                            // 2. Remove orphan brackets
                            // 3. Strip trailing punctuation to match displayed text
                            let cleanedWord = word
                                .replace(/\[[^\]]*\]/g, '')  // Remove [bracketed content]
                                .replace(/[\[\]]/g, '')       // Remove orphan brackets
                                .replace(/[.,!?;:'"-]+$/g, '') // Strip TRAILING punctuation
                                .trim();
                            
                            // Skip words that are empty or only punctuation after cleaning
                            if (cleanedWord.length > 0 && !/^[.,!?;:'"-]+$/.test(cleanedWord)) {
                                filteredWords.push({
                                    word: cleanedWord,
                                    start: wordData.start,
                                    end: wordData.end
                                });
                            }
                        }
                        
                        if (filteredWords.length > 0) {
                            const exactAlignment = { words: filteredWords };
                            
                            console.log('📝 Word alignment (EXACT ElevenLabs timestamps):', {
                                audioDuration: audioDuration.toFixed(2),
                                originalWords: alignment.words.length,
                                filteredWords: filteredWords.length,
                                displayWords: displayWords.length,
                                firstWord: filteredWords[0],
                                lastWord: filteredWords[filteredWords.length - 1]
                            });
                            
                            setWordAlignment(exactAlignment);
                            wordAlignmentRef.current = exactAlignment;
                        } else {
                            // Fallback to even distribution only if no words found
                            const wordDuration = audioDuration / displayWords.length;
                            const evenAlignment = {
                                words: displayWords.map((word, idx) => ({
                                    word,
                                    start: idx * wordDuration,
                                    end: (idx + 1) * wordDuration
                                }))
                            };
                            setWordAlignment(evenAlignment);
                            wordAlignmentRef.current = evenAlignment;
                        }
                    } else {
                        // Fallback: spread words evenly across audio duration
                        if (displayWords.length > 0) {
                            const wordDuration = audioDuration / displayWords.length;
                            const evenAlignment = {
                                words: displayWords.map((word, idx) => ({
                                    word,
                                    start: idx * wordDuration,
                                    end: (idx + 1) * wordDuration
                                }))
                            };
                            
                            console.log('📝 Word alignment (even fallback - no ElevenLabs data):', {
                                audioDuration: audioDuration.toFixed(2),
                                wordCount: displayWords.length
                            });
                            
                            setWordAlignment(evenAlignment);
                            wordAlignmentRef.current = evenAlignment;
                        } else {
                            console.warn('⚠️ No words found in text');
                        }
                    }
                });

                // Track audio time for word highlighting
                // Helper to find word index, handling gaps between words (sound effects, etc.)
                const findWordIndex = (currentTime: number, words: Array<{ start: number; end: number; word?: string }>) => {
                    if (!words || words.length === 0) return -1;
                    
                    // First pass: look for exact match (current time is within word boundaries)
                    for (let i = 0; i < words.length; i++) {
                        const w = words[i];
                        if (currentTime >= w.start && currentTime < w.end) {
                            return i; // Exact match
                        }
                    }
                    
                    // Second pass: we're in a gap or edge case
                    // Either before first word, in a gap between words, or after last word
                    
                    // Before first word - show first word
                    if (words.length > 0 && currentTime < words[0].start) {
                        return 0;
                    }
                    
                    // After last word - stay on last word
                    if (words.length > 0 && currentTime >= words[words.length - 1].end) {
                        return words.length - 1;
                    }
                    
                    // In a gap between words - find the NEXT word to move forward
                    // This handles cases where bracketed content creates timing gaps
                    for (let i = 0; i < words.length - 1; i++) {
                        const currentWord = words[i];
                        const nextWord = words[i + 1];
                        
                        // If we're between this word's end and next word's start
                        if (currentTime >= currentWord.end && currentTime < nextWord.start) {
                            // Gap handling: if we're closer to the next word's start, show next word
                            // This prevents getting stuck on a word when there's a long gap (e.g., sound effect)
                            const gapMidpoint = (currentWord.end + nextWord.start) / 2;
                            if (currentTime >= gapMidpoint) {
                                return i + 1; // Move to next word
                            }
                            return i; // Stay on current word
                        }
                    }
                    
                    // Fallback: return last word
                    return words.length - 1;
                };
                
                // Auto-scroll to keep highlighted word in view
                const scrollToHighlightedWord = (wordIdx: number) => {
                    if (wordIdx < 0) return;
                    
                    // Only scroll if the scroll UI is visible - respect user's preference
                    if (scrollStateRef.current === 'hidden') return;
                    
                    // Find the highlighted word element
                    const wordElements = document.querySelectorAll('[data-word-index]');
                    const targetWord = wordElements[wordIdx] as HTMLElement;
                    
                    if (targetWord) {
                        // Find the scrollable container (the text scroll area)
                        const scrollContainer = targetWord.closest('[data-scroll-container]') || targetWord.closest('.overflow-y-auto');
                        
                        if (scrollContainer) {
                            // Scroll within the container only, not the whole page
                            const containerRect = scrollContainer.getBoundingClientRect();
                            const wordRect = targetWord.getBoundingClientRect();
                            const scrollTop = scrollContainer.scrollTop;
                            
                            // Calculate position to center the word in the container
                            const targetScrollTop = scrollTop + (wordRect.top - containerRect.top) - (containerRect.height / 2) + (wordRect.height / 2);
                            
                            scrollContainer.scrollTo({
                                top: Math.max(0, targetScrollTop),
                                behavior: 'smooth'
                            });
                        }
                    }
                };
                
                let lastHighlightedIndex = -1;
                
                // Use ontimeupdate as primary method
                audio.ontimeupdate = () => {
                    const currentAlignment = wordAlignmentRef.current;
                    if (currentAlignment && currentAlignment.words && currentAlignment.words.length > 0) {
                        const wordIndex = findWordIndex(audio.currentTime, currentAlignment.words);

                        if (wordIndex !== -1 && wordIndex !== lastHighlightedIndex) {
                            lastHighlightedIndex = wordIndex;
                            setCurrentWordIndex(wordIndex);
                            
                            // Auto-scroll every few words to avoid too much scrolling
                            if (wordIndex % 3 === 0 || wordIndex === 0) {
                                scrollToHighlightedWord(wordIndex);
                            }
                        }
                    }
                };
                
                // Also use interval for more frequent updates (smoother highlighting)
                const highlightInterval = setInterval(() => {
                    if (audio.paused || audio.ended) return;
                    
                    const currentAlignment = wordAlignmentRef.current;
                    if (currentAlignment && currentAlignment.words && currentAlignment.words.length > 0) {
                        const wordIndex = findWordIndex(audio.currentTime, currentAlignment.words);

                        if (wordIndex !== -1 && wordIndex !== lastHighlightedIndex) {
                            lastHighlightedIndex = wordIndex;
                            setCurrentWordIndex(wordIndex);
                            
                            // Auto-scroll
                            if (wordIndex % 3 === 0) {
                                scrollToHighlightedWord(wordIndex);
                            }
                        }
                    }
                }, 50); // 20 times per second
                
                // Clean up interval on pause/end
                audio.onpause = () => {
                    clearInterval(highlightInterval);
                };

                audio.onended = () => {
                    // Clean up interval
                    clearInterval(highlightInterval);
                    
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
                                
                                // Trigger page turn animation (same as manual swipe)
                                setIsPageTurning(true);
                                setFlipState({ direction: 'next', isFlipping: true });
                                playPageTurnSound(); // Play page turn sound effect
                                
                                // Change page content at the halfway point (when page is perpendicular - 90deg)
                                setTimeout(() => {
                                    setCurrentPageIndex(nextPageIndex);
                                    currentPageIndexRef.current = nextPageIndex; // Update ref
                                    // Preserve scroll state during page turns (both manual and auto-play)
                                    setScrollState(scrollStateRef.current);
                                }, 400); // Halfway through 0.8s animation
                                
                                // End animation after full duration
                                setTimeout(() => {
                                    setIsPageTurning(false);
                                    setFlipState(null);
                                    // Save progress
                                    if (bookId) {
                                        readingProgressService.saveProgress(bookId, nextPageIndex);
                                    }

                                    // Wait for page to render, then auto-play next page
                                    setTimeout(() => {
                                        // Check again if auto-play is still enabled and we're on the correct page
                                        if (autoPlayModeRef.current && currentPageIndexRef.current === nextPageIndex) {
                                            const nextPage = pages[nextPageIndex];
                                            const nextContentBoxes = nextPage?.content?.textBoxes;
                                            const nextPageTextBoxes = (nextContentBoxes && nextContentBoxes.length > 0) ? nextContentBoxes : nextPage?.textBoxes;
                                            if (nextPage && nextPageTextBoxes && nextPageTextBoxes.length > 0) {
                                                // Use translated text if available
                                                const translatedTextBoxes = getTranslatedTextBoxes(nextPage);
                                                const firstBoxText = translatedTextBoxes[0]?.text || nextPageTextBoxes[0].text;
                                                console.log('▶️ Auto-play: Starting next page audio');
                                                isAutoPlayingRef.current = false; // Reset flag before calling
                                                const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                                handlePlayText(firstBoxText, 0, syntheticEvent, true);
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
                                }, 800); // Full animation duration
                            } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                                // Reached end of book, stop auto-play
                                console.log('🏁 Auto-play: Reached end of book, stopping');
                                setAutoPlayMode(false);
                                autoPlayModeRef.current = false;
                                isAutoPlayingRef.current = false;
                                // Mark book as completed (unlocks games permanently)
                                if (bookId) {
                                    bookCompletionService.markBookCompleted(bookId);
                                    readCountService.incrementReadCount(bookId);
                                    // Track book completion analytics
                                    analyticsService.bookReadComplete(bookId, bookTitle);
                                    // Unlock reward voice if book has one
                                    handleUnlockRewardVoice();
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
                            
                            // Trigger page turn animation (same as manual swipe)
                            setIsPageTurning(true);
                            setFlipState({ direction: 'next', isFlipping: true });
                            playPageTurnSound(); // Play page turn sound effect
                            
                            // Change page content at the halfway point (when page is perpendicular - 90deg)
                            setTimeout(() => {
                                setCurrentPageIndex(nextPageIndex);
                                currentPageIndexRef.current = nextPageIndex; // Update ref
                                // Preserve scroll state during page turns (both manual and auto-play)
                                setScrollState(scrollStateRef.current);
                            }, 400); // Halfway through 0.8s animation
                            
                            // End animation after full duration
                            setTimeout(() => {
                                setIsPageTurning(false);
                                setFlipState(null);
                                // Save progress
                                if (bookId) {
                                    readingProgressService.saveProgress(bookId, nextPageIndex);
                                }

                                setTimeout(() => {
                                    // Check again if auto-play is still enabled and we're on the correct page
                                    if (autoPlayModeRef.current && currentPageIndexRef.current === nextPageIndex) {
                                        const nextPage = pages[nextPageIndex];
                                        const nextPageTextBoxes = nextPage?.content?.textBoxes || nextPage?.textBoxes;
                                        if (nextPage && nextPageTextBoxes && nextPageTextBoxes.length > 0) {
                                            // Use translated text if available
                                            const translatedTextBoxes = getTranslatedTextBoxes(nextPage);
                                            const firstBoxText = translatedTextBoxes[0]?.text || nextPageTextBoxes[0].text;
                                            console.log('▶️ Auto-play: Starting next page audio');
                                            isAutoPlayingRef.current = false; // Reset flag before calling
                                            const syntheticEvent = { stopPropagation: () => { } } as React.MouseEvent;
                                            handlePlayText(firstBoxText, 0, syntheticEvent, true);
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
                            }, 800); // Full animation duration
                        } else if (autoPlayModeRef.current && currentPageIndexRef.current >= pages.length - 1) {
                            // Reached end of book, stop auto-play
                            console.log('🏁 Auto-play: Reached end of book, stopping');
                            setAutoPlayMode(false);
                            autoPlayModeRef.current = false;
                            isAutoPlayingRef.current = false;
                            // Mark book as completed (unlocks games permanently)
                            if (bookId) {
                                bookCompletionService.markBookCompleted(bookId);
                                readCountService.incrementReadCount(bookId);
                                // Track book completion analytics
                                analyticsService.bookReadComplete(bookId, bookTitle);
                            }
                        } else if (isAutoPlayingRef.current) {
                            console.log('⏸️ Auto-play: Already processing, skipping');
                        }
                    }
                };

                audio.onplay = () => {
                    setPlaying(true);
                    setShowLoadingPopup(false); // Hide loading popup when audio starts
                };
                audio.onpause = () => setPlaying(false);

                setCurrentAudio(audio);
                
                // IMPORTANT: Set auto-play mode BEFORE playing if isAutoPlay is true
                // This ensures the onended handler will continue auto-playing
                if (isAutoPlay) {
                    setAutoPlayMode(true);
                    autoPlayModeRef.current = true;
                    console.log('▶️ Auto-play mode enabled for new audio');
                }
                
                // Wait for audio to be ready before playing
                // This prevents the first playback from sounding garbled/cut off
                const playWhenReady = () => {
                    audio.play().catch(err => {
                        console.warn('Audio play failed:', err);
                    });
                };
                
                // If audio is already ready (cached), play immediately
                if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
                    console.log('🎵 Audio already ready, playing immediately');
                    playWhenReady();
                } else {
                    // Wait for enough data to play smoothly
                    console.log('🎵 Waiting for audio to load...');
                    audio.addEventListener('canplaythrough', playWhenReady, { once: true });
                    // Fallback: if canplaythrough doesn't fire within 3s, try playing anyway
                    setTimeout(() => {
                        if (audio.readyState < 3 && !audio.paused) return; // Already playing
                        if (audio.paused && audio.currentTime === 0) {
                            console.log('🎵 Fallback: playing after timeout');
                            playWhenReady();
                        }
                    }, 3000);
                    audio.load(); // Ensure loading starts
                }
            } else {
                console.error('No audio URL returned');
                alert('Failed to generate audio. Please check the API key.');
                setActiveTextBoxIndex(null);
            }
        } catch (error) {
            console.error('Failed to play audio:', error);
            alert('Failed to play audio. The TTS service might be unavailable.');
            setActiveTextBoxIndex(null);
            setShowLoadingPopup(false);
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

    // Show intro video (studio animation) before the book starts
    // Check this FIRST before showing any page content
    if (showIntroVideo && introVideoUrl) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <video
                    ref={introVideoRef}
                    src={introVideoUrl}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    onEnded={() => setShowIntroVideo(false)}
                    onError={() => {
                        console.warn('Intro video failed to load, skipping');
                        setShowIntroVideo(false);
                    }}
                />
                {/* Skip button */}
                <button
                    onClick={() => setShowIntroVideo(false)}
                    className="absolute bottom-8 right-8 px-6 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-full backdrop-blur-sm transition-all"
                >
                    Skip
                </button>
            </div>
        );
    }

    // Show loading state while waiting for data AND intro video check
    if (loading || !introVideoChecked) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                <p className="text-lg">Loading book...</p>
            </div>
        );
    }

    // No pages found after loading
    if (pages.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <h2 className="text-2xl font-bold mb-4">No pages found</h2>
                <button
                    onClick={() => {
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

    // Landscape mode styles for books created in landscape orientation
    // Make it truly fullscreen covering status bar
    const isLandscape = bookOrientation === 'landscape';
    const landscapeContainerStyle: React.CSSProperties = isLandscape ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vh',
        height: '100vw',
        transform: 'rotate(90deg) translateY(-100%)',
        transformOrigin: 'top left',
        zIndex: 9999, // Ensure it's above everything including status bar
        backgroundColor: '#000', // Black background to cover any gaps
    } : {};

    return (
        <div
            className={`relative bg-gray-900 overflow-hidden flex flex-col ${isLandscape ? '' : 'w-full h-screen'}`}
            style={{
                ...landscapeContainerStyle,
                // Prevent iOS overscroll/bounce that reveals background
                overscrollBehavior: 'none',
                WebkitOverflowScrolling: 'auto', // Disable momentum scrolling
                touchAction: 'pan-x pinch-zoom', // Allow horizontal swipes and pinch zoom, block vertical overscroll
            }}
            onTouchStart={(e) => {
                // Block any music from playing on touch
                e.stopPropagation();
            }}
            onClick={(e) => {
                // Block any music from playing on click
                e.stopPropagation();
            }}
        >
            {/* Dismissible Loading Popup for TTS Generation */}
            {showLoadingPopup && loadingAudio && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#5D4037] rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl border-4 border-[#3E2723] text-center relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowLoadingPopup(false)}
                            className="absolute top-3 right-3 text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        {/* Animated Icon */}
                        <div className="mb-4 relative">
                            <div className="w-16 h-16 mx-auto bg-[#3E2723] rounded-full flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
                            </div>
                            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-4 border-[#FFD700]/30 animate-ping" />
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-[#FFD700] text-lg font-bold font-display mb-2">
                            Preparing Your Story
                        </h3>
                        
                        {/* Message */}
                        <p className="text-white/90 text-sm leading-relaxed mb-3">
                            This will just take a minute, and then after that, it's clear sailing! ⛵
                        </p>
                        
                        {/* Sub-message */}
                        <div className="bg-[#3E2723] rounded-lg p-2 border border-[#FFD700]/20">
                            <p className="text-[#FFD700]/80 text-xs">
                                ✨ Feel free to keep reading - it will start automatically!
                            </p>
                        </div>
                        
                        {/* Progress dots animation */}
                        <div className="flex justify-center gap-2 mt-4">
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Top Toolbar - Clean and Compact */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-3 z-50 pointer-events-none">
                {/* Back Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();

                        // Restore music before navigating back
                        // Background music toggle has been removed from Header. Nothing to restore here.

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

                {/* Right: Language Selector, Voice Selector and Music Toggle */}
                <div className="pointer-events-auto flex items-center gap-2">
                    {/* Language Selector */}
                    <div
                        ref={languageDropdownRef}
                        className="relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLanguageDropdown(!showLanguageDropdown);
                            }}
                            className="bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-black/60 transition-colors"
                            title="Change language"
                        >
                            <Globe className="w-4 h-4 text-white" />
                            <span className="text-white text-xs">
                                {SUPPORTED_LANGUAGES[selectedLanguage]?.flag || '🌐'}
                            </span>
                            {isTranslating && (
                                <Loader2 className="w-3 h-3 text-white animate-spin" />
                            )}
                        </button>

                        {/* Language Dropdown */}
                        {showLanguageDropdown && (
                            <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 min-w-[180px] max-h-[350px] overflow-y-auto">
                                <div className="py-2">
                                    <div className="px-4 py-1 text-xs text-white/50 uppercase tracking-wider">Select Language</div>
                                    {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
                                        <button
                                            key={code}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedLanguage(code);
                                                setShowLanguageDropdown(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3 ${
                                                selectedLanguage === code ? 'bg-white/20' : ''
                                            }`}
                                        >
                                            <span className="text-lg">{lang.flag}</span>
                                            <div className="flex-1">
                                                <div className={selectedLanguage === code ? 'font-bold' : ''}>
                                                    {lang.nativeName}
                                                </div>
                                                <div className="text-xs text-white/50">{lang.name}</div>
                                            </div>
                                            {selectedLanguage === code && (
                                                <Check className="w-4 h-4 text-[#FFD700]" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Background Music Toggle - Simple on/off */}
                    {hasBookMusic ? (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                // Toggle music on/off
                                const newEnabled = !bookMusicEnabled;
                                setBookMusicEnabled(newEnabled);
                                console.log('🎵 Music toggle clicked. New state:', newEnabled ? 'ENABLED' : 'DISABLED');
                                
                                if (newEnabled) {
                                    // Turn music on - must resume AudioContext FIRST on iOS
                                    if (bookBackgroundMusicRef.current) {
                                        const audio = bookBackgroundMusicRef.current;
                                        console.log('🎵 Attempting to resume music. Audio state:', {
                                            paused: audio.paused,
                                            muted: audio.muted,
                                            volume: audio.volume,
                                            currentTime: audio.currentTime,
                                            readyState: audio.readyState
                                        });
                                        
                                        // Step 1: Resume AudioContext (required on iOS after pause)
                                        try {
                                            await resumeBookMusicContext();
                                            console.log('🎵 AudioContext resumed. State:', bookMusicCtxRef.current?.state);
                                        } catch (err) {
                                            console.warn('🎵 Could not resume AudioContext:', err);
                                        }
                                        
                                        // Step 2: Mark WebAudio as ready if context is running
                                        if (bookMusicCtxRef.current && bookMusicCtxRef.current.state === 'running') {
                                            bookMusicWebAudioReadyRef.current = true;
                                        }
                                        
                                        // Step 3: Ensure audio element is unmuted and has volume
                                        audio.muted = false;
                                        
                                        // Step 4: Ensure graph is connected with proper volume
                                        ensureBookMusicGraph(audio);
                                        
                                        // Step 5: Set volume directly (required for cross-origin audio due to CORS)
                                        // For cross-origin audio, WebAudio GainNode won't work, so always use direct volume
                                        const audioSrc = audio.src || '';
                                        const isCrossOrigin = audioSrc.includes('storage.googleapis.com') || 
                                                              audioSrc.includes('cloudfront') ||
                                                              audioSrc.includes('amazonaws.com');
                                        
                                        if (isCrossOrigin) {
                                            // Cross-origin: use direct volume (WebAudio outputs silence due to CORS)
                                            audio.volume = musicVolume;
                                            console.log('🎵 Direct volume set (CORS-safe):', musicVolume);
                                        } else if (bookMusicGainRef.current) {
                                            // Same-origin: use WebAudio GainNode
                                            bookMusicGainRef.current.gain.value = musicVolume;
                                            audio.volume = 1.0;
                                            console.log('🎵 GainNode volume set to:', musicVolume);
                                        } else {
                                            // Fallback: direct volume
                                            audio.volume = musicVolume;
                                        }
                                        
                                        // Step 6: Play the audio with retry
                                        const tryPlay = async (attempt: number = 1): Promise<void> => {
                                            try {
                                                await audio.play();
                                                console.log('🎵 Book music playing! (attempt ' + attempt + ')');
                                            } catch (err: any) {
                                                console.warn('🎵 Play attempt ' + attempt + ' failed:', err?.message || err);
                                                if (attempt < 3) {
                                                    // Small delay and retry
                                                    await new Promise(r => setTimeout(r, 100));
                                                    return tryPlay(attempt + 1);
                                                }
                                            }
                                        };
                                        await tryPlay();
                                    } else {
                                        console.warn('🎵 No audio element to resume');
                                    }
                                } else {
                                    // Turn music off
                                    if (bookBackgroundMusicRef.current) {
                                        bookBackgroundMusicRef.current.pause();
                                        console.log('🎵 Book music paused');
                                    }
                                }
                            }}
                            className={`bg-black/50 backdrop-blur-md rounded-full p-3 hover:bg-black/70 transition-all border ${bookMusicEnabled
                                ? 'border-yellow-400/50 shadow-lg shadow-yellow-400/20'
                                : 'border-white/20'
                                }`}
                            title={bookMusicEnabled ? "Mute background music" : "Enable background music"}
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
                            className={`backdrop-blur-md rounded-full px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-black/60 transition-colors ${
                                bookDefaultVoiceId && useBookDefaultVoice ? 'bg-amber-600/60 ring-2 ring-amber-400/50' : 'bg-black/40'
                            }`}
                        >
                            <Volume2 className="w-4 h-4 text-white" />
                            <span className="text-white text-xs max-w-[100px] truncate">
                                {/* Show narrator voice name when book has one, otherwise show user's selected voice */}
                                {defaultNarratorVoiceId
                                    ? (voices.find(v => v.voice_id === defaultNarratorVoiceId)?.name || 'Narrator')
                                    : bookDefaultVoiceId && useBookDefaultVoice 
                                        ? 'Default'
                                        : (voices.find(v => v.voice_id === selectedVoiceId)?.name || 
                                           voices.find(v => v.voice_id === selectedVoiceId)?.customName ||
                                           clonedVoices.find(v => v.voice_id === selectedVoiceId)?.name ||
                                           'Voice')}
                            </span>
                            {(defaultNarratorVoiceId || (bookDefaultVoiceId && useBookDefaultVoice)) && <span className="text-amber-300 text-[10px]">📖</span>}
                        </button>

                        {/* Dropdown Menu */}
                        {showVoiceDropdown && (
                            <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 min-w-[220px] max-w-[280px] max-h-[400px] overflow-y-auto">
                                <div className="py-2">
                                    {/* Book Default Voice Section - only show if book has a default */}
                                    {bookDefaultVoiceId && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-amber-400/80 uppercase tracking-wider flex items-center gap-1">
                                                <span>📖</span> Book Narrator
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setUseBookDefaultVoice(true);
                                                    setShowVoiceDropdown(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-amber-600/30 transition-colors flex items-center gap-2 ${
                                                    useBookDefaultVoice ? 'bg-amber-600/40 border-l-2 border-amber-400' : ''
                                                }`}
                                            >
                                                {useBookDefaultVoice && (
                                                    <Check className="w-4 h-4 text-amber-300" />
                                                )}
                                                <span className={useBookDefaultVoice ? 'font-bold text-amber-100' : ''}>
                                                    {voices.find(v => v.voice_id === bookDefaultVoiceId)?.name || 
                                                     voices.find(v => v.voice_id === bookDefaultVoiceId)?.customName ||
                                                     'Book Voice'}
                                                </span>
                                                <span className="text-amber-300/70 text-xs ml-auto">Default</span>
                                            </button>
                                            <div className="border-t border-white/10 my-1"></div>
                                        </>
                                    )}
                                    
                                    {/* Unlocked Voices Section */}
                                    {voices.filter(v => isVoiceUnlocked(v.voice_id)).length > 0 && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-white/50 uppercase tracking-wider">
                                                {bookDefaultVoiceId ? 'Other Voices' : 'Unlocked'}
                                            </div>
                                            {voices.filter(v => isVoiceUnlocked(v.voice_id)).map(v => {
                                                // Skip the book default voice in this section (it's shown above)
                                                if (bookDefaultVoiceId && v.voice_id === bookDefaultVoiceId) return null;
                                                const isSelected = !useBookDefaultVoice && selectedVoiceId === v.voice_id;
                                                return (
                                                    <button
                                                        key={v.voice_id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVoiceId(v.voice_id);
                                                            setUseBookDefaultVoice(false); // User chose different voice
                                                            setShowVoiceDropdown(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 ${
                                                            isSelected ? 'bg-white/20' : ''
                                                        }`}
                                                    >
                                                        {isSelected && (
                                                            <Check className="w-4 h-4 text-[#FFD700]" />
                                                        )}
                                                        <span className={isSelected ? 'font-bold' : ''}>
                                                            {v.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* Cloned voices - Hidden until feature is ready */}
                                    {false && clonedVoices.length > 0 && (
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

                                    {/* Locked Voices Section (only show if not premium) */}
                                    {!isSubscribed && voices.filter(v => !isVoiceUnlocked(v.voice_id)).length > 0 && (
                                        <>
                                            <div className="border-t border-white/20 my-1"></div>
                                            <div className="px-4 py-1 text-xs text-white/50 uppercase tracking-wider">Locked</div>
                                            {voices.filter(v => !isVoiceUnlocked(v.voice_id)).map(v => (
                                                <button
                                                    key={v.voice_id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Navigate to profile page with shop modal open to voices tab
                                                        setShowVoiceDropdown(false);
                                                        navigate('/profile', { state: { openShop: true, shopTab: 'voices' } });
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-white/50 hover:bg-white/5 transition-colors flex items-center gap-2"
                                                >
                                                    <Lock className="w-4 h-4 text-white/30" />
                                                    <span>{v.name}</span>
                                                    <span className="ml-auto text-xs text-[#FFD700]">Unlock</span>
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    {/* Create Voice Option - Hidden until feature is ready */}
                                    {false && (
                                        <>
                                            {/* Separator */}
                                            {(voices.length > 0 || clonedVoices.length > 0) && (
                                                <div className="border-t border-white/20 my-1"></div>
                                            )}
                                        </>
                                    )}

                                    {/* No voices message */}
                                    {voices.length === 0 && clonedVoices.length === 0 && (
                                        <div className="px-4 py-2 text-sm text-white/70 text-center">
                                            No voices available
                                        </div>
                                    )}

                                    {/* Unlock New Voice Button - Always visible */}
                                    <div className="border-t border-white/20 mt-1 pt-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowVoiceDropdown(false);
                                                navigate('/profile', { state: { openShop: true, shopTab: 'voices' } });
                                            }}
                                            className="w-full px-4 py-3 text-sm font-bold text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span>Unlock New Voices</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Reading Area */}
            <div
                className="flex-1 w-full h-full relative overflow-hidden bg-gray-900"
                style={{
                    // Lock background in place - prevent overscroll/bounce
                    overscrollBehavior: 'none',
                    touchAction: 'pan-x', // Only allow horizontal swipes for page turns
                }}
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
                    
                    @keyframes pageCurlPrev {
                        0% { 
                            transform: perspective(2000px) rotateY(180deg) rotateX(0deg) translateZ(0px);
                        }
                        15% {
                            transform: perspective(2000px) rotateY(160deg) rotateX(2deg) translateZ(30px);
                        }
                        35% { 
                            transform: perspective(2000px) rotateY(120deg) rotateX(3deg) translateZ(60px);
                        }
                        50% { 
                            transform: perspective(2000px) rotateY(90deg) rotateX(4deg) translateZ(80px);
                        }
                        65% {
                            transform: perspective(2000px) rotateY(60deg) rotateX(3deg) translateZ(60px);
                        }
                        85% {
                            transform: perspective(2000px) rotateY(20deg) rotateX(2deg) translateZ(30px);
                        }
                        100% { 
                            transform: perspective(2000px) rotateY(0deg) rotateX(0deg) translateZ(0px);
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
                        animation: pageCurlNext 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
                        transform-origin: left center;
                        transform-style: preserve-3d;
                    }
                    
                    .page-curl-prev {
                        animation: pageCurlPrev 0.8s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
                        transform-origin: right center;
                        transform-style: preserve-3d;
                    }
                    
                    .shimmer-wave-1 {
                        animation: shimmerWave1 0.8s ease-out forwards;
                    }
                    
                    .shimmer-wave-2 {
                        animation: shimmerWave2 0.8s ease-out 0.05s forwards;
                    }
                    
                    .shimmer-wave-3 {
                        animation: shimmerWave3 0.8s ease-out 0.02s forwards;
                    }
                    
                    .sheen-pulse {
                        animation: sheenPulse 0.4s ease-in-out infinite;
                    }
                    
                    .curl-shadow {
                        animation: curlShadowGrow 0.8s ease-in-out forwards;
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

                    {/* The actual page content - always visible underneath */}
                    <div className="absolute inset-0 z-10">
                        <BookPageRenderer
                            page={{
                                ...currentPage,
                                // Use translated textBoxes if available
                                textBoxes: getTranslatedTextBoxes(currentPage),
                            }}
                            activeTextBoxIndex={activeTextBoxIndex}
                            scrollState={scrollState}
                            onScrollStateChange={handleScrollStateChange}
                            onPlayText={handlePlayText}
                            highlightedWordIndex={currentWordIndex}
                            wordAlignment={wordAlignment}
                            isTTSPlaying={playing}
                        />
                    </div>

                    {/* High-sheen glossy white page that curls over */}
                    {flipState && (
                        <>
                            {/* Dynamic shadow cast by the curling page */}
                            <div
                                className="absolute top-0 bottom-0 z-40 pointer-events-none curl-shadow"
                                style={{
                                    left: flipState.direction === 'next' ? 0 : 'auto',
                                    right: flipState.direction === 'prev' ? 0 : 'auto',
                                    background: flipState.direction === 'next'
                                        ? 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.05) 70%, transparent 100%)'
                                        : 'linear-gradient(to left, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.05) 70%, transparent 100%)',
                                }}
                            />

                            {/* The curling glossy white page */}
                            <div
                                className={`absolute inset-0 z-50 pointer-events-none ${flipState.direction === 'next' ? 'page-curl-next' : 'page-curl-prev'
                                    }`}
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
                                            ${flipState.direction === 'next' ? '-' : ''}12px 0 35px rgba(0,0,0,0.2),
                                            ${flipState.direction === 'next' ? '-' : ''}4px 0 15px rgba(0,0,0,0.15),
                                            ${flipState.direction === 'next' ? '-' : ''}1px 0 5px rgba(0,0,0,0.1)
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

                                    {/* Bright curl edge highlight */}
                                    <div
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '6px',
                                            right: flipState.direction === 'next' ? 0 : 'auto',
                                            left: flipState.direction === 'prev' ? 0 : 'auto',
                                            background: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0.9) 30%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.9) 70%, rgba(255,255,255,1))',
                                            boxShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)',
                                        }}
                                    />

                                    {/* Gradient shadow near curl edge for depth */}
                                    <div
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '100px',
                                            right: flipState.direction === 'next' ? '6px' : 'auto',
                                            left: flipState.direction === 'prev' ? '6px' : 'auto',
                                            background: flipState.direction === 'next'
                                                ? 'linear-gradient(to left, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 40%, transparent 100%)'
                                                : 'linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 40%, transparent 100%)',
                                        }}
                                    />

                                    {/* Opposite edge subtle highlight */}
                                    <div
                                        className="absolute top-0 bottom-0"
                                        style={{
                                            width: '2px',
                                            left: flipState.direction === 'next' ? 0 : 'auto',
                                            right: flipState.direction === 'prev' ? 0 : 'auto',
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
                                            left: flipState.direction === 'next' ? 0 : 'auto',
                                            right: flipState.direction === 'prev' ? 0 : 'auto',
                                            background: flipState.direction === 'next'
                                                ? 'linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)'
                                                : 'linear-gradient(to left, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)',
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Navigation is now swipe-only - removed click zones */}
            </div>

            {/* Wood Play Button with Auto-Play Toggle - Positioned above the scroll based on scroll state */}
            <div
                className={`absolute left-4 z-40 transition-all duration-500 flex items-center gap-3`}
                style={{
                    // Position based on scroll state: hidden = bottom, mid = above mid scroll, max = above max scroll
                    bottom: scrollState === 'hidden' 
                        ? '1rem' 
                        : scrollState === 'max'
                            ? `calc(${currentPage.scrollMaxHeight || 60}% + ${currentPage.scrollOffsetY || 0}% + 1.5rem)` // Above max scroll + offset
                            : `calc(${currentPage.scrollMidHeight || 30}% + ${currentPage.scrollOffsetY || 0}% + 1.5rem)` // Above mid scroll + offset
                }}
            >
                {/* Main Play Button */}
                <WoodButton
                    onClick={handlePlayPage}
                    className="p-3"
                    icon={
                        loadingAudio ? (
                            <div className="w-6 h-6 border-4 border-[#3e2723] border-t-transparent rounded-full animate-spin" />
                        ) : playing ? (
                            <Pause className="w-8 h-8 fill-current" />
                        ) : (
                            <Play className="w-8 h-8 fill-current ml-1" />
                        )
                    }
                />
                
                {/* Auto-Play Toggle Switch - Beside play button */}
                <button
                    onClick={toggleTtsMode}
                    className="flex flex-col items-center gap-1"
                    title={ttsMode === 'auto' ? 'Auto Page Turn ON - Tap to disable' : 'Auto Page Turn OFF - Tap to enable'}
                >
                    {/* Toggle Switch */}
                    <div className={`
                        relative w-12 h-6 rounded-full transition-all duration-300 shadow-inner
                        ${ttsMode === 'auto' 
                            ? 'bg-gradient-to-r from-green-400 to-green-500' 
                            : 'bg-gray-400'
                        }
                    `}>
                        {/* Toggle Knob */}
                        <div className={`
                            absolute top-0.5 w-5 h-5 rounded-full shadow-md
                            transition-all duration-300 ease-in-out
                            bg-white border-2
                            ${ttsMode === 'auto' 
                                ? 'left-6 border-green-600' 
                                : 'left-0.5 border-gray-500'
                            }
                        `} />
                    </div>
                    {/* Label */}
                    <span className={`
                        text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm
                        ${ttsMode === 'auto' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-gray-500 text-white'
                        }
                    `}>
                        {ttsMode === 'auto' ? 'AUTO' : 'OFF'}
                    </span>
                </button>
            </div>

            {/* Page Counter - Bottom Right (Clickable for page navigation) */}
            <div className="absolute bottom-4 right-4 z-50">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowPageSelector(true);
                    }}
                    className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 hover:bg-black/60 active:scale-95 transition-all"
                >
                    <Grid3X3 className="w-3 h-3" />
                    {currentPageIndex + 1} / {pages.length}
                </button>
            </div>

            {/* Page Selector Modal */}
            {showPageSelector && (
                <div 
                    className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setShowPageSelector(false)}
                >
                    <div 
                        className="bg-[#DEB887] rounded-2xl shadow-2xl border-4 border-[#5D4037] max-w-md w-full mx-4 max-h-[80vh] overflow-hidden animate-[scaleUp_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-[#5D4037] px-4 py-3 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Go to Page</h3>
                            <button
                                onClick={() => setShowPageSelector(false)}
                                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Page Grid - Simple page numbers, no image loading */}
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            <div className="grid grid-cols-4 gap-3">
                                {pages.map((page, index) => {
                                    const isCurrentPage = index === currentPageIndex;
                                    const isTheEnd = page.id === 'the-end';
                                    
                                    return (
                                        <button
                                            key={page.id || index}
                                            onClick={() => {
                                                // Update both state AND ref so audio plays from correct page
                                                setCurrentPageIndex(index);
                                                currentPageIndexRef.current = index;
                                                setShowPageSelector(false);
                                                stopAudio();
                                                // Reset audio state to ensure fresh play on new page
                                                setPlaying(false);
                                                setActiveTextBoxIndex(null);
                                                setCurrentWordIndex(-1);
                                                setWordAlignment(null);
                                                wordAlignmentRef.current = null;
                                            }}
                                            className={`relative aspect-square rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                                                isCurrentPage 
                                                    ? 'bg-[#FFD700] text-[#3E2723] shadow-lg scale-105 ring-2 ring-[#FFA000]' 
                                                    : 'bg-[#8B4513]/20 text-[#5D4037] hover:bg-[#8B4513]/40'
                                            }`}
                                        >
                                            {isTheEnd ? (
                                                <span className="font-bold text-sm">END</span>
                                            ) : (
                                                <span className="font-bold text-xl">{index + 1}</span>
                                            )}
                                            
                                            {/* Current Page Indicator */}
                                            {isCurrentPage && (
                                                <div className="absolute -top-1 -right-1 bg-[#4CAF50] rounded-full p-0.5 shadow">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-center text-[#8B4513]/70 text-sm mt-4">Tap a page to jump to it</p>
                        </div>

                        {/* Footer */}
                        <div className="bg-[#C4A574] px-4 py-2 text-center border-t border-[#8B4513]/20">
                            <p className="text-[#5D4037] text-xs font-medium">
                                Tap a page to jump to it
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                                {/* Quiz Button - Always show but disabled if max attempts reached */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (quizAttemptCount < maxQuizAttempts) {
                                            setShowQuizModal(true);
                                            // Track quiz start analytics
                                            if (bookId) {
                                                analyticsService.quizStart(bookId, bookTitle);
                                            }
                                        }
                                    }}
                                    disabled={quizAttemptCount >= maxQuizAttempts}
                                    className={`p-4 rounded-xl font-bold shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group ${
                                        quizAttemptCount >= maxQuizAttempts
                                            ? 'bg-gray-400 border-gray-500 text-gray-200 cursor-not-allowed'
                                            : 'bg-[#FF9800] hover:bg-[#F57C00] text-white border-[#E65100]'
                                    }`}
                                >
                                    <HelpCircle className="w-6 h-6" />
                                    <span>
                                        {quizAttemptCount >= maxQuizAttempts 
                                            ? 'Quiz Completed!' 
                                            : `Take Quiz (${quizAttemptCount}/${maxQuizAttempts})`
                                        }
                                    </span>
                                </button>

                                {/* Color Button - Only show if book has coloring pages */}
                                {coloringPages.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('🎨 Opening coloring modal with page:', selectedColoringPage);
                                            console.log('🎨 Background URL:', selectedColoringPage?.backgroundUrl || selectedColoringPage?.files?.background?.url);
                                            setShowColoringModal(true);
                                            // Track coloring start analytics
                                            if (bookId) {
                                                analyticsService.coloringStart(bookId, bookTitle);
                                            }
                                        }}
                                        className="bg-[#9C27B0] hover:bg-[#7B1FA2] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#6A1B9A] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <div className="relative">
                                            <Sparkles className="w-6 h-6 group-hover:animate-spin" />
                                        </div>
                                        <span>Color!</span>
                                    </button>
                                )}

                                {/* Read Again */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPageIndex(0);
                                    }}
                                    className="bg-[#4CAF50] hover:bg-[#43A047] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#2E7D32] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <RotateCcw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" />
                                    Read Again
                                </button>

                                {/* Back to Book Details */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/book/${bookId}`);
                                    }}
                                    className="bg-[#8B4513] hover:bg-[#A0522D] text-white p-4 rounded-xl font-bold shadow-lg border-b-4 border-[#5D4037] active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    Back to Book
                                </button>

                                {/* Go Home */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Restore music before navigating
                                        // Background music toggle has been removed from Header. Nothing to restore here.
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
                                            // Track favorite/unfavorite analytics
                                            if (newFavoriteState) {
                                                analyticsService.bookFavorite(bookId, bookTitle);
                                            } else {
                                                analyticsService.bookUnfavorite(bookId, bookTitle);
                                            }
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
                                            // Track like/unlike analytics
                                            if (newLikeState) {
                                                analyticsService.bookLike(bookId, bookTitle);
                                            } else {
                                                analyticsService.bookUnlike(bookId, bookTitle);
                                            }
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

                            {/* Share with Friends Section */}
                            <div className="w-full pt-4 border-t border-[#8B4513]/20">
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <Share2 className="w-5 h-5 text-[#5D4037]" />
                                    <span className="text-[#3E2723] font-bold text-sm">Love the app? Share it!</span>
                                </div>
                                <div className="flex gap-3 justify-center">
                                    {/* iOS Copy Link */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(IOS_APP_LINK).then(() => {
                                                setCopiedLink('ios');
                                                setTimeout(() => setCopiedLink(null), 2000);
                                            });
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-md border-b-2 active:border-b-0 active:translate-y-0.5 transition-all ${
                                            copiedLink === 'ios'
                                                ? 'bg-green-500 border-green-600 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        {copiedLink === 'ios' ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
                                                </svg>
                                                <span>iOS</span>
                                                <Copy className="w-3 h-3 opacity-60" />
                                            </>
                                        )}
                                    </button>

                                    {/* Android Copy Link */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(ANDROID_APP_LINK).then(() => {
                                                setCopiedLink('android');
                                                setTimeout(() => setCopiedLink(null), 2000);
                                            });
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-md border-b-2 active:border-b-0 active:translate-y-0.5 transition-all ${
                                            copiedLink === 'android'
                                                ? 'bg-green-500 border-green-600 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        {copiedLink === 'android' ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M17.6 11.48L19.44 8.3C19.54 8.12 19.48 7.9 19.3 7.8C19.12 7.7 18.9 7.76 18.8 7.94L16.94 11.16C15.68 10.56 14.22 10.22 12.64 10.22C11.06 10.22 9.6 10.56 8.34 11.16L6.48 7.94C6.38 7.76 6.16 7.7 5.98 7.8C5.8 7.9 5.74 8.12 5.84 8.3L7.68 11.48C4.82 13.02 2.88 15.92 2.64 19.38H22.64C22.4 15.92 20.46 13.02 17.6 11.48ZM7.64 16.38C7.09 16.38 6.64 15.93 6.64 15.38C6.64 14.83 7.09 14.38 7.64 14.38C8.19 14.38 8.64 14.83 8.64 15.38C8.64 15.93 8.19 16.38 7.64 16.38ZM17.64 16.38C17.09 16.38 16.64 15.93 16.64 15.38C16.64 14.83 17.09 14.38 17.64 14.38C18.19 14.38 18.64 14.83 18.64 15.38C18.64 15.93 18.19 16.38 17.64 16.38Z"/>
                                                </svg>
                                                <span>Android</span>
                                                <Copy className="w-3 h-3 opacity-60" />
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-[#5D4037] text-xs text-center mt-2 opacity-70">
                                    Tap to copy link, then share with friends!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Coloring Modal */}
            <ColoringModal
                isOpen={showColoringModal}
                onClose={() => setShowColoringModal(false)}
                backgroundImageUrl={selectedColoringPage?.backgroundUrl || selectedColoringPage?.files?.background?.url}
                pageId={selectedColoringPage ? `book-${bookId}-coloring-${selectedColoringPage.pageNumber || selectedColoringPage._id}` : undefined}
            />

            {/* Quiz Modal */}
            <BookQuizModal
                isOpen={showQuizModal}
                onClose={() => setShowQuizModal(false)}
                bookId={bookId || ''}
                bookTitle={bookTitle}
                attemptCount={quizAttemptCount}
                maxAttempts={maxQuizAttempts}
                onQuizComplete={(score, coinsEarned) => {
                    setQuizAttemptCount(prev => prev + 1);
                    // Save attempt count to localStorage
                    if (bookId) {
                        localStorage.setItem(`quiz_attempts_${bookId}`, String(quizAttemptCount + 1));
                        // Track quiz complete analytics
                        analyticsService.quizComplete(bookId, score, score, coinsEarned); // score is both score and totalQuestions since modal handles that
                    }
                }}
            />
            
            {/* Voice Unlock Celebration Modal */}
            {showVoiceUnlockModal && unlockedVoice && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-[90%] max-w-md bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 rounded-3xl p-8 shadow-2xl animate-in zoom-in-75 duration-500">
                        {/* Sparkles decoration */}
                        <div className="absolute -top-4 -left-4 w-8 h-8 text-yellow-300 animate-pulse">✨</div>
                        <div className="absolute -top-2 -right-6 w-10 h-10 text-yellow-300 animate-pulse delay-100">✨</div>
                        <div className="absolute -bottom-3 left-8 w-6 h-6 text-yellow-300 animate-pulse delay-200">✨</div>
                        <div className="absolute -bottom-5 -right-3 w-7 h-7 text-yellow-300 animate-pulse delay-300">✨</div>
                        
                        {/* Content */}
                        <div className="text-center">
                            <div className="text-5xl mb-4 animate-bounce">🎉</div>
                            <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2">
                                Voice Unlocked!
                            </h2>
                            <p className="text-amber-100 text-lg mb-6">
                                You just unlocked a new narrator voice!
                            </p>
                            
                            {/* Voice Character Image */}
                            {unlockedVoice.characterImage ? (
                                <div className="relative w-32 h-32 mx-auto mb-4">
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full animate-pulse"></div>
                                    <img
                                        src={unlockedVoice.characterImage}
                                        alt={unlockedVoice.name}
                                        className="relative w-full h-full object-cover rounded-full border-4 border-white shadow-lg"
                                    />
                                </div>
                            ) : (
                                <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                                    <Mic className="w-16 h-16 text-white" />
                                </div>
                            )}
                            
                            <h3 className="text-2xl font-bold text-white drop-shadow mb-2">
                                {unlockedVoice.name}
                            </h3>
                            <p className="text-amber-100 text-sm mb-6">
                                Now available in your voice library!
                            </p>
                            
                            {/* Close Button */}
                            <button
                                onClick={() => {
                                    setShowVoiceUnlockModal(false);
                                    setUnlockedVoice(null);
                                }}
                                className="bg-white text-amber-600 font-bold px-8 py-3 rounded-full shadow-lg hover:bg-amber-50 transition-colors text-lg"
                            >
                                Awesome! 🎤
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookReaderPage;
