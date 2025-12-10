
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../services/apiService';
import { playHistoryService } from '../services/playHistoryService';
import { analyticsService } from '../services/analyticsService';
import { activityTrackingService } from '../services/activityTrackingService';
import { incrementActivityCounter } from '../components/features/ReviewPromptModal';

// --- Interfaces ---
export interface AudioItem {
    _id?: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order: number;
}

export interface Playlist {
    _id: string;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    category?: string;
    type?: 'Song' | 'Audiobook';
    items: AudioItem[];
    playCount?: number;
}

interface AudioContextType {
    // Background Music & SFX
    musicEnabled: boolean;
    sfxEnabled: boolean;
    musicVolume: number;
    toggleMusic: () => void;
    toggleSfx: () => void;
    setMusicVolume: (volume: number) => void;
    playClick: () => void;
    playBack: () => void;
    playSuccess: () => void;
    playTab: () => void;
    setGameMode: (active: boolean, type?: 'default' | 'workout') => void;
    setMusicPaused: (paused: boolean) => void;

    // Playlist Player
    currentPlaylist: Playlist | null;
    currentTrackIndex: number;
    isPlaying: boolean;
    progress: number;
    currentTime: number;
    duration: number;
    playPlaylist: (playlist: Playlist, startIndex?: number) => void;
    togglePlayPause: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    seek: (time: number) => void;
    closePlayer: () => void;
}

const AudioContext = createContext<AudioContextType>({
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.5,
    toggleMusic: () => { },
    toggleSfx: () => { },
    setMusicVolume: () => { },
    playClick: () => { },
    playBack: () => { },
    playSuccess: () => { },
    playTab: () => { },
    setGameMode: () => { },
    setMusicPaused: () => { },

    currentPlaylist: null,
    currentTrackIndex: 0,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    playPlaylist: () => { },
    togglePlayPause: () => { },
    nextTrack: () => { },
    prevTrack: () => { },
    seek: () => { },
    closePlayer: () => { },
});

export const useAudio = () => useContext(AudioContext);

// Hardcoded Music URLs (GCS for reliability)
const BG_MUSIC_URL = "https://storage.googleapis.com/productiongk/music/1764722776514_app-background.mp3";
const GAME_MUSIC_URL = "https://storage.googleapis.com/productiongk/music/1764719639973_workout.mp3"; // Using workout music as game fallback if needed
const WORKOUT_MUSIC_URL = "https://storage.googleapis.com/productiongk/music/1764719639973_workout.mp3";

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- State ---
    const [musicVolume, setMusicVolumeState] = useState<number>(() => {
        const saved = localStorage.getItem('godly_kids_music_volume');
        return saved ? parseFloat(saved) : 0.5;
    });
    const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem('godly_kids_music_enabled');
        // Default to false - background music disabled to prevent conflicts with playlist player
        return saved !== null ? saved === 'true' : false;
    });
    const [sfxEnabled, setSfxEnabled] = useState(true);
    const [musicMode, setMusicMode] = useState<'bg' | 'game' | 'workout'>('bg');
    
    // Initialize force paused based on URL (e.g. if landing directly on book reader)
    const [musicForcePaused, setMusicForcePaused] = useState(() => {
        const path = window.location.pathname + window.location.hash;
        return path.includes('/book-reader') || path.includes('/read/');
    });

    // --- Playlist Player State ---
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- Refs ---
    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const gameAudioRef = useRef<HTMLAudioElement | null>(null);
    const workoutAudioRef = useRef<HTMLAudioElement | null>(null);
    const playlistAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // GainNodes for volume control (works in iOS WKWebView where volume property doesn't)
    const bgGainRef = useRef<GainNode | null>(null);
    const gameGainRef = useRef<GainNode | null>(null);
    const workoutGainRef = useRef<GainNode | null>(null);
    const playlistGainRef = useRef<GainNode | null>(null);
    
    // Track if audio elements are connected to Web Audio API
    const audioConnectedRef = useRef<Set<HTMLAudioElement>>(new Set());

    // Initialize Audio Context lazily
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);
    
    // Connect an audio element to Web Audio API with gain control
    // This allows volume control in iOS WKWebView where volume property is read-only
    const connectAudioToGain = useCallback((audio: HTMLAudioElement, gainRef: React.MutableRefObject<GainNode | null>, volume: number) => {
        // Only connect once per audio element
        if (audioConnectedRef.current.has(audio)) {
            // Just update the gain value
            if (gainRef.current) {
                gainRef.current.gain.value = volume;
            }
            return;
        }
        
        try {
            const ctx = getAudioContext();
            
            // Create media element source
            const source = ctx.createMediaElementSource(audio);
            
            // Create gain node
            const gainNode = ctx.createGain();
            gainNode.gain.value = volume;
            gainRef.current = gainNode;
            
            // Connect: source -> gain -> destination
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            // Mark as connected
            audioConnectedRef.current.add(audio);
            
            console.log('🎵 Audio connected to GainNode with volume:', volume);
        } catch (e) {
            console.warn('⚠️ Could not connect audio to Web Audio API:', e);
            // Fallback to regular volume property
            audio.volume = volume;
        }
    }, [getAudioContext]);

    // --- Initialization of Background Audio ---
    useEffect(() => {
        // Get saved volume for scaling
        const savedVolume = parseFloat(localStorage.getItem('godly_kids_music_volume') || '0.5');
        
        // Helper to create audio with error handling
        const createAudio = (url: string, baseVolume: number, name: string): HTMLAudioElement => {
            const audio = new Audio();
            audio.loop = true;
            // Apply saved volume scaled by base volume
            audio.volume = savedVolume * baseVolume;
            audio.preload = 'auto';
            // Don't set crossOrigin - it can cause CORS issues with some hosts
            
            // Add comprehensive error handling
            audio.onerror = (e) => {
                console.error(`🔴 ${name} Audio Error:`, {
                    error: audio.error,
                    code: audio.error?.code,
                    message: audio.error?.message,
                    src: url
                });
            };
            
            audio.oncanplaythrough = () => {
                console.log(`✅ ${name} Audio ready to play`);
            };
            
            audio.onloadstart = () => {
                console.log(`⏳ ${name} Audio loading...`);
            };
            
            audio.onplay = () => {
                console.log(`▶️ ${name} Audio playing at volume:`, audio.volume);
            };
            
            audio.onpause = () => {
                console.log(`⏸️ ${name} Audio paused`);
            };
            
            // Set source last to trigger loading
            audio.src = url;
            
            return audio;
        };

        // BG Audio - moderate (base 50%)
        bgAudioRef.current = createAudio(BG_MUSIC_URL, 0.5, 'BG');

        // Game Audio - louder (base 70%)
        gameAudioRef.current = createAudio(GAME_MUSIC_URL, 0.7, 'Game');

        // Workout Audio - loudest (base 80%)
        workoutAudioRef.current = createAudio(WORKOUT_MUSIC_URL, 0.8, 'Workout');

        console.log('🎵 Audio System Initialized with volume:', savedVolume, {
            bg: BG_MUSIC_URL,
            game: GAME_MUSIC_URL,
            workout: WORKOUT_MUSIC_URL
        });

        return () => {
            bgAudioRef.current?.pause();
            gameAudioRef.current?.pause();
            workoutAudioRef.current?.pause();
        };
    }, []);

    // --- Reactive Playback Logic ---
    // This replaces the complex interval loop
    useEffect(() => {
        const bg = bgAudioRef.current;
        const game = gameAudioRef.current;
        const workout = workoutAudioRef.current;

        if (!bg || !game || !workout) {
            console.log('🎵 Audio refs not ready yet');
            return;
        }

        const shouldPlay = musicEnabled && !musicForcePaused;
        console.log('🎵 Music state:', { musicEnabled, musicForcePaused, shouldPlay, musicMode });

        if (!shouldPlay) {
            // Pause all if disabled or force paused
            bg.pause();
            game.pause();
            workout.pause();
            console.log('🎵 All music paused (disabled or force paused)');
            return;
        }

        // Helper to play one and pause others, applying current volume
        const playSelected = async (
            toPlay: HTMLAudioElement, 
            others: HTMLAudioElement[], 
            name: string, 
            volumeMultiplier: number,
            gainRef: React.MutableRefObject<GainNode | null>
        ) => {
            others.forEach(a => a.pause());
            
            // Connect to GainNode for volume control (works in iOS WKWebView)
            connectAudioToGain(toPlay, gainRef, musicVolume * volumeMultiplier);
            
            // Also set volume property as fallback
            toPlay.volume = musicVolume * volumeMultiplier;
            console.log(`🎵 ${name} volume applied:`, musicVolume * volumeMultiplier);
            
            if (toPlay.paused) {
                console.log(`🎵 Attempting to play ${name}...`, {
                    src: toPlay.src,
                    readyState: toPlay.readyState,
                    networkState: toPlay.networkState,
                    paused: toPlay.paused,
                    error: toPlay.error
                });
                
                try {
                    // Resume AudioContext if suspended (required for iOS)
                    if (audioContextRef.current?.state === 'suspended') {
                        await audioContextRef.current.resume();
                    }
                    await toPlay.play();
                    console.log(`🎵 ${name} music started successfully`);
                } catch (e: any) {
                    if (e.name === 'NotAllowedError') {
                        console.log(`🎵 ${name} autoplay blocked - will play after user interaction`);
                    } else if (e.name === 'NotSupportedError') {
                        console.error(`🔴 ${name} audio format not supported or source invalid`);
                    } else {
                        console.error(`🔴 ${name} play error:`, e);
                    }
                }
            }
        };

        if (musicMode === 'bg') {
            playSelected(bg, [game, workout], 'BG', 0.5, bgGainRef);
        } else if (musicMode === 'game') {
            playSelected(game, [bg, workout], 'Game', 0.7, gameGainRef);
        } else if (musicMode === 'workout') {
            playSelected(workout, [bg, game], 'Workout', 0.8, workoutGainRef);
        }

    }, [musicEnabled, musicForcePaused, musicMode, musicVolume]);

    // --- User Interaction Unlock ---
    useEffect(() => {
        const unlock = async () => {
            console.log('🎵 User interaction detected, attempting to unlock audio...');
            
            // Resume AudioContext if suspended
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume();
                console.log('🎵 AudioContext resumed');
            }

            // Try to play the appropriate music based on mode
            if (musicEnabled && !musicForcePaused) {
                let audioToPlay: HTMLAudioElement | null = null;
                let audioName = '';
                
                if (musicMode === 'bg') {
                    audioToPlay = bgAudioRef.current;
                    audioName = 'BG';
                } else if (musicMode === 'game') {
                    audioToPlay = gameAudioRef.current;
                    audioName = 'Game';
                } else if (musicMode === 'workout') {
                    audioToPlay = workoutAudioRef.current;
                    audioName = 'Workout';
                }
                
                if (audioToPlay && audioToPlay.paused && audioToPlay.src) {
                    console.log(`🎵 Trying to play ${audioName} after unlock...`, {
                        readyState: audioToPlay.readyState,
                        src: audioToPlay.src
                    });
                    
                    try {
                        await audioToPlay.play();
                        console.log(`🎵 ${audioName} Music started after user interaction`);
                    } catch (e: any) {
                        console.warn(`🎵 ${audioName} play failed after unlock:`, e.message);
                    }
                }
            }
        };

        // Listen for multiple interaction types
        const events = ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'];
        events.forEach(evt => window.addEventListener(evt, unlock, { once: true }));

        return () => {
            events.forEach(evt => window.removeEventListener(evt, unlock));
        };
    }, [musicEnabled, musicForcePaused, musicMode]);


    // --- SOUND GENERATORS (Synthesizers) ---
    const playTone = useCallback((freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }, [sfxEnabled, getAudioContext]);

    const playClick = useCallback(() => { playTone(300, 'sine', 0.1, 0.15); playTone(400, 'triangle', 0.05, 0.05); }, [playTone]);
    const playBack = useCallback(() => { playTone(200, 'sine', 0.15, 0.1); }, [playTone]);
    const playTab = useCallback(() => { playTone(600, 'sine', 0.05, 0.05); }, [playTone]);
    const playSuccess = useCallback(() => {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.3);
        });
    }, [sfxEnabled, getAudioContext]);

    // --- PLAYLIST PLAYER LOGIC ---

    // Initialize playlist audio element
    useEffect(() => {
        if (!playlistAudioRef.current) {
            playlistAudioRef.current = new Audio();
            playlistAudioRef.current.preload = 'auto';
            // DO NOT set crossOrigin - GCS doesn't have CORS configured for our domain
            // This means we can't use Web Audio API, but basic playback will work
            playlistAudioRef.current.volume = 1.0; // Full volume for playlist audio

            // Event listeners
            playlistAudioRef.current.addEventListener('timeupdate', () => {
                if (playlistAudioRef.current) {
                    setCurrentTime(playlistAudioRef.current.currentTime);
                    const dur = playlistAudioRef.current.duration;
                    if (!isNaN(dur)) {
                        setDuration(dur);
                        setProgress((playlistAudioRef.current.currentTime / dur) * 100);
                    }
                }
            });

            playlistAudioRef.current.addEventListener('loadedmetadata', () => {
                if (playlistAudioRef.current) {
                    console.log('🎵 Playlist audio metadata loaded, duration:', playlistAudioRef.current.duration);
                    setDuration(playlistAudioRef.current.duration);
                }
            });

            playlistAudioRef.current.addEventListener('ended', () => {
                handleTrackEnd();
            });
            
            // Error listener to debug audio loading issues
            playlistAudioRef.current.addEventListener('error', (e) => {
                const audio = e.target as HTMLAudioElement;
                const error = audio.error;
                console.error('🔇 Playlist audio error:', {
                    code: error?.code,
                    message: error?.message,
                    src: audio.src
                });
            });
            
            // Playing event to confirm audio is actually playing
            playlistAudioRef.current.addEventListener('playing', () => {
                console.log('🎵 Playlist audio is now playing!');
                // Sync state - audio is actually playing
                setIsPlaying(true);
                
                // Ensure media session is set when playback starts/resumes
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                }
            });
            
            // Pause event - sync state when audio is paused (e.g., by iOS interruption or lock screen)
            playlistAudioRef.current.addEventListener('pause', () => {
                console.log('🎵 Playlist audio paused (event) - refreshing media session');
                setIsPlaying(false);
                
                // CRITICAL: Immediately refresh media session metadata when paused from native widget
                // iOS tends to drop the lock screen widget if we don't do this
                if ('mediaSession' in navigator) {
                    // Re-set playback state
                    navigator.mediaSession.playbackState = 'paused';
                    
                    // Schedule a metadata refresh to prevent iOS from dropping the widget
                    setTimeout(() => {
                        if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
                            console.log('📱 Refreshing metadata after pause');
                            // Re-set the same metadata to keep the widget alive
                            const currentMetadata = navigator.mediaSession.metadata;
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: currentMetadata.title,
                                artist: currentMetadata.artist,
                                album: currentMetadata.album,
                                artwork: currentMetadata.artwork as MediaImage[]
                            });
                        }
                    }, 100);
                }
            });
            
            // Handle stalled/waiting states (buffering issues)
            playlistAudioRef.current.addEventListener('waiting', () => {
                console.log('🎵 Playlist audio waiting/buffering...');
            });
            
            playlistAudioRef.current.addEventListener('stalled', () => {
                console.log('🎵 Playlist audio stalled, attempting recovery...');
                // Try to recover by reloading
                if (playlistAudioRef.current && playlistAudioRef.current.src) {
                    const currentSrc = playlistAudioRef.current.src;
                    const currentPosition = playlistAudioRef.current.currentTime;
                    playlistAudioRef.current.load();
                    playlistAudioRef.current.currentTime = currentPosition;
                }
            });
            
            // Handle iOS audio session interruptions (e.g., phone calls)
            playlistAudioRef.current.addEventListener('suspend', () => {
                console.log('🎵 Audio suspended (iOS interruption or background)');
            });
            
            // canplay event - audio can be played again after stall/suspend
            playlistAudioRef.current.addEventListener('canplay', () => {
                console.log('🎵 Audio can play now');
            });
        }
    }, []);

    const handleTrackEnd = useCallback(() => {
        setCurrentPlaylist(prevPlaylist => {
            if (!prevPlaylist) return null;
            setCurrentTrackIndex(prevIndex => {
                if (prevIndex < prevPlaylist.items.length - 1) {
                    return prevIndex + 1;
                } else {
                    setIsPlaying(false);
                    return prevIndex; // Stop at end
                }
            });
            return prevPlaylist;
        });
    }, []);

    // Sync audio source when track changes
    useEffect(() => {
        if (currentPlaylist && playlistAudioRef.current) {
            const track = currentPlaylist.items[currentTrackIndex];
            if (track && track.audioUrl) {
                console.log('🎵 Loading track:', track.title, 'URL:', track.audioUrl);
                
                // Always set the source (the URL comparison was buggy due to absolute vs relative paths)
                playlistAudioRef.current.src = track.audioUrl;
                playlistAudioRef.current.load(); // Force reload
                
                if (isPlaying) {
                    // Wait for canplay event before playing
                    const handleCanPlay = () => {
                        console.log('🎵 Track ready to play:', track.title);
                        playlistAudioRef.current?.play().catch((e) => {
                            console.error('🔇 Play error after load:', e.name, e.message);
                        });
                        playlistAudioRef.current?.removeEventListener('canplay', handleCanPlay);
                    };
                    playlistAudioRef.current.addEventListener('canplay', handleCanPlay);
                }
            } else {
                console.warn('🔇 No audio URL for track:', track?.title);
            }
        }
    }, [currentPlaylist, currentTrackIndex, isPlaying]);

    // Sync play/pause state
    useEffect(() => {
        if (playlistAudioRef.current) {
            if (isPlaying) {
                // Set full volume directly (don't use GainNode - causes CORS issues with GCS)
                playlistAudioRef.current.volume = 1.0;
                
                console.log('🎵 Playing playlist audio:', playlistAudioRef.current.src);
                console.log('🎵 Audio readyState:', playlistAudioRef.current.readyState);
                
                const attemptPlay = async (retryCount = 0) => {
                    if (!playlistAudioRef.current) return;
                    
                    try {
                        // Save current position before any operations
                        const savedPosition = playlistAudioRef.current.currentTime;
                        
                        // If audio element needs reloading (e.g., after iOS suspension)
                        if (playlistAudioRef.current.readyState < 2 && playlistAudioRef.current.src) {
                            console.log('🎵 Audio needs reload before playing, saving position:', savedPosition);
                            playlistAudioRef.current.load();
                            // Wait for it to be ready
                            await new Promise<void>((resolve) => {
                                const handleCanPlay = () => {
                                    playlistAudioRef.current?.removeEventListener('canplay', handleCanPlay);
                                    resolve();
                                };
                                playlistAudioRef.current?.addEventListener('canplay', handleCanPlay);
                                // Timeout fallback
                                setTimeout(resolve, 2000);
                            });
                            // Restore position after reload
                            if (savedPosition > 0 && playlistAudioRef.current) {
                                playlistAudioRef.current.currentTime = savedPosition;
                                console.log('🎵 Restored position after reload:', savedPosition);
                            }
                        }
                        
                        await playlistAudioRef.current.play();
                        console.log('🎵 Play successful at position:', playlistAudioRef.current?.currentTime);
                    } catch (e: any) {
                        console.error('🔇 Playlist play error:', e.name, e.message);
                        
                        // Retry logic for recoverable errors
                        if (retryCount < 2 && e.name !== 'NotAllowedError') {
                            console.log('🔇 Retrying play in 200ms...');
                            setTimeout(() => attemptPlay(retryCount + 1), 200);
                        } else if (e.name === 'NotAllowedError') {
                            // User interaction required - sync state back
                            console.log('🔇 User interaction required, pausing state');
                            setIsPlaying(false);
                        }
                    }
                };
                
                attemptPlay();
            } else {
                playlistAudioRef.current.pause();
            }
        }
    }, [isPlaying]);

    // --- MEDIA SESSION API ---
    // Helper function to set media session metadata - keeps lock screen widget alive
    const setMediaSessionMetadata = useCallback(() => {
        if (!('mediaSession' in navigator) || !currentPlaylist) return;
        
        const track = currentPlaylist.items[currentTrackIndex];
        if (!track) return;
        
        const coverImage = track.coverImage || currentPlaylist.coverImage;
        
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.author || currentPlaylist.author || 'GodlyKids',
                album: currentPlaylist.title,
                artwork: coverImage ? [
                    { src: coverImage, sizes: '96x96', type: 'image/jpeg' },
                    { src: coverImage, sizes: '128x128', type: 'image/jpeg' },
                    { src: coverImage, sizes: '192x192', type: 'image/jpeg' },
                    { src: coverImage, sizes: '256x256', type: 'image/jpeg' },
                    { src: coverImage, sizes: '384x384', type: 'image/jpeg' },
                    { src: coverImage, sizes: '512x512', type: 'image/jpeg' },
                ] : []
            });
            console.log('📱 Media Session metadata set:', track.title);
        } catch (e) {
            console.warn('📱 Failed to set media session metadata:', e);
        }
    }, [currentPlaylist, currentTrackIndex]);

    // Updates lock screen / notification widget with current track info
    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            console.log('📱 Media Session API not supported');
            return;
        }

        if (currentPlaylist && currentPlaylist.items[currentTrackIndex]) {
            setMediaSessionMetadata();
        }
        // Note: Don't clear metadata when paused - iOS loses the lock screen widget
        // Only clear when playlist is explicitly closed via closePlayer()

        // Update playback state
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    }, [currentPlaylist, currentTrackIndex, isPlaying, setMediaSessionMetadata]);
    
    // Periodically refresh metadata while paused to prevent iOS from dropping it
    useEffect(() => {
        if (!currentPlaylist) return;
        
        if (!isPlaying) {
            // Immediately refresh when paused
            console.log('📱 Audio paused - setting up metadata refresh');
            setMediaSessionMetadata();
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
            }
            
            // Refresh metadata every 10 seconds while paused to keep lock screen alive
            const refreshInterval = setInterval(() => {
                if (currentPlaylist && !isPlaying) {
                    console.log('📱 Refreshing media session metadata (paused)');
                    setMediaSessionMetadata();
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = 'paused';
                    }
                }
            }, 10000);
            
            return () => clearInterval(refreshInterval);
        }
    }, [currentPlaylist, isPlaying, setMediaSessionMetadata]);

    // Set up Media Session action handlers (once on mount)
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        // Play/Pause from lock screen or headphones
        navigator.mediaSession.setActionHandler('play', async () => {
            console.log('📱 Media Session: play');
            
            // Directly try to play the audio element first
            if (playlistAudioRef.current) {
                try {
                    // Save current position before any operations
                    const savedPosition = playlistAudioRef.current.currentTime;
                    console.log('📱 Saved position:', savedPosition);
                    
                    // If audio was suspended, we may need to reload
                    if (playlistAudioRef.current.readyState < 2) {
                        console.log('📱 Audio needs reload, readyState:', playlistAudioRef.current.readyState);
                        playlistAudioRef.current.load();
                        // Wait for audio to be ready
                        await new Promise<void>((resolve) => {
                            const onCanPlay = () => {
                                playlistAudioRef.current?.removeEventListener('canplay', onCanPlay);
                                resolve();
                            };
                            playlistAudioRef.current?.addEventListener('canplay', onCanPlay);
                            // Timeout fallback
                            setTimeout(resolve, 1000);
                        });
                        // Restore position after reload
                        if (savedPosition > 0 && playlistAudioRef.current) {
                            playlistAudioRef.current.currentTime = savedPosition;
                            console.log('📱 Restored position after reload:', savedPosition);
                        }
                    }
                    
                    await playlistAudioRef.current.play();
                    setIsPlaying(true);
                    console.log('📱 Media Session: play successful at position:', playlistAudioRef.current.currentTime);
                } catch (e: any) {
                    console.error('📱 Media Session: play failed:', e.name, e.message);
                    // Try again after a short delay
                    setTimeout(async () => {
                        try {
                            await playlistAudioRef.current?.play();
                            setIsPlaying(true);
                        } catch (e2) {
                            console.error('📱 Media Session: retry play failed');
                        }
                    }, 100);
                }
            } else {
                setIsPlaying(true);
            }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            console.log('📱 Media Session: pause');
            if (playlistAudioRef.current) {
                playlistAudioRef.current.pause();
            }
            setIsPlaying(false);
        });

        // Next/Previous track from lock screen or headphones
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            console.log('📱 Media Session: nexttrack');
            if (currentPlaylist && currentTrackIndex < currentPlaylist.items.length - 1) {
                setCurrentTrackIndex(prev => prev + 1);
                setIsPlaying(true);
            }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            console.log('📱 Media Session: previoustrack');
            if (currentTrackIndex > 0) {
                setCurrentTrackIndex(prev => prev - 1);
                setIsPlaying(true);
            }
        });

        // Seek backward/forward (for headphone buttons)
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            if (playlistAudioRef.current) {
                playlistAudioRef.current.currentTime = Math.max(0, playlistAudioRef.current.currentTime - skipTime);
            }
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            if (playlistAudioRef.current) {
                playlistAudioRef.current.currentTime = Math.min(
                    playlistAudioRef.current.duration || 0,
                    playlistAudioRef.current.currentTime + skipTime
                );
            }
        });

        // Seek to specific position (scrubbing on lock screen)
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (playlistAudioRef.current && details.seekTime !== undefined) {
                playlistAudioRef.current.currentTime = details.seekTime;
            }
        });

        // Stop (close player)
        navigator.mediaSession.setActionHandler('stop', () => {
            console.log('📱 Media Session: stop');
            setIsPlaying(false);
            setCurrentPlaylist(null);
            if (playlistAudioRef.current) {
                playlistAudioRef.current.pause();
                playlistAudioRef.current.currentTime = 0;
            }
        });

        console.log('📱 Media Session handlers registered');

        return () => {
            // Clean up handlers on unmount
            try {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                navigator.mediaSession.setActionHandler('seekbackward', null);
                navigator.mediaSession.setActionHandler('seekforward', null);
                navigator.mediaSession.setActionHandler('seekto', null);
                navigator.mediaSession.setActionHandler('stop', null);
            } catch (e) {
                // Some handlers might not be supported
            }
        };
    }, [currentPlaylist, currentTrackIndex]);

    // Update position state for lock screen progress bar
    useEffect(() => {
        if (!('mediaSession' in navigator) || !playlistAudioRef.current) return;
        
        const updatePositionState = () => {
            if (playlistAudioRef.current && !isNaN(playlistAudioRef.current.duration)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: playlistAudioRef.current.duration,
                        playbackRate: playlistAudioRef.current.playbackRate,
                        position: playlistAudioRef.current.currentTime
                    });
                } catch (e) {
                    // setPositionState might not be supported in all browsers
                }
            }
        };

        // Update position every second while playing
        let interval: NodeJS.Timeout | null = null;
        if (isPlaying) {
            updatePositionState(); // Update immediately
            interval = setInterval(updatePositionState, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, duration]);

    // Handle app visibility changes (foreground/background)
    // This helps recover audio when user returns to the app
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isPlaying && playlistAudioRef.current) {
                console.log('📱 App returned to foreground, checking audio state...');
                
                // Check if audio is actually paused when it should be playing
                if (playlistAudioRef.current.paused) {
                    console.log('📱 Audio was paused while in background, attempting resume...');
                    
                    try {
                        // Re-ensure metadata is set (iOS sometimes loses it)
                        if ('mediaSession' in navigator && currentPlaylist) {
                            const track = currentPlaylist.items[currentTrackIndex];
                            const coverImage = track?.coverImage || currentPlaylist.coverImage;
                            
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: track?.title || 'Unknown',
                                artist: track?.author || currentPlaylist.author || 'GodlyKids',
                                album: currentPlaylist.title,
                                artwork: coverImage ? [
                                    { src: coverImage, sizes: '512x512', type: 'image/jpeg' }
                                ] : []
                            });
                        }
                        
                        // Try to resume playback
                        await playlistAudioRef.current.play();
                        console.log('📱 Audio resumed successfully');
                    } catch (e: any) {
                        console.error('📱 Could not auto-resume audio:', e.name);
                        // If we can't auto-resume, sync state to paused
                        // so user knows they need to tap play again
                        if (e.name === 'NotAllowedError') {
                            setIsPlaying(false);
                        }
                    }
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isPlaying, currentPlaylist, currentTrackIndex]);

    const playPlaylist = useCallback((playlist: Playlist, startIndex: number = 0) => {
        setCurrentPlaylist(playlist);
        setCurrentTrackIndex(startIndex);
        setIsPlaying(true);
        // Ensure background music is paused when playlist starts
        setMusicPaused(true);
        
        // Increment play count and record play history
        const playlistId = (playlist as any)._id || (playlist as any).id;
        const track = playlist.items[startIndex];
        const trackId = (track as any)._id || (track as any).id;
        
        if (playlistId) {
            // Record in local play history for "Recently Played" section
            playHistoryService.recordPlay(playlistId, trackId);
            
            // Increment PERSONAL play count (for "My Plays" display)
            import('../services/playCountService').then(({ playCountService }) => {
                playCountService.incrementPlayCount(playlistId, 'playlist');
                if (trackId) {
                    playCountService.incrementPlayCount(trackId, playlist.type === 'Audiobook' ? 'episode' : 'song');
                }
            });
            
            // Track analytics (for portal/global stats)
            analyticsService.playlistPlay(playlistId, playlist.title);
            if (track) {
                analyticsService.audioPlay(trackId || `${playlistId}_${startIndex}`, track.title, playlistId);
                // Track for Report Card
                activityTrackingService.trackSongPlayed(trackId || `${playlistId}_${startIndex}`, track.title);
                // Increment song played counter for review prompt
                incrementActivityCounter('song');
            }
            
            // Increment server-side counts (for portal analytics)
            if (trackId) {
                ApiService.incrementItemPlayCount(playlistId, trackId);
            } else {
                ApiService.incrementPlaylistPlayCount(playlistId);
            }
        }
    }, []);

    const togglePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const nextTrack = useCallback(() => {
        if (currentPlaylist && currentTrackIndex < currentPlaylist.items.length - 1) {
            const nextIndex = currentTrackIndex + 1;
            setCurrentTrackIndex(nextIndex);
            setIsPlaying(true);
            
            // Track analytics for next track play
            const playlistId = (currentPlaylist as any)._id || (currentPlaylist as any).id;
            const track = currentPlaylist.items[nextIndex];
            const trackId = (track as any)._id || (track as any).id;
            
            if (playlistId && track) {
                analyticsService.audioPlay(trackId || `${playlistId}_${nextIndex}`, track.title, playlistId);
                // Track for Report Card
                activityTrackingService.trackSongPlayed(trackId || `${playlistId}_${nextIndex}`, track.title);
                if (trackId) {
                    ApiService.incrementItemPlayCount(playlistId, trackId);
                }
            }
        }
    }, [currentPlaylist, currentTrackIndex]);

    const prevTrack = useCallback(() => {
        if (currentTrackIndex > 0) {
            const prevIndex = currentTrackIndex - 1;
            setCurrentTrackIndex(prevIndex);
            setIsPlaying(true);
            
            // Track analytics for prev track play
            if (currentPlaylist) {
                const playlistId = (currentPlaylist as any)._id || (currentPlaylist as any).id;
                const track = currentPlaylist.items[prevIndex];
                const trackId = (track as any)._id || (track as any).id;
                
                if (playlistId && track) {
                    analyticsService.audioPlay(trackId || `${playlistId}_${prevIndex}`, track.title, playlistId);
                    // Track for Report Card
                    activityTrackingService.trackSongPlayed(trackId || `${playlistId}_${prevIndex}`, track.title);
                    if (trackId) {
                        ApiService.incrementItemPlayCount(playlistId, trackId);
                    }
                }
            }
        }
    }, [currentTrackIndex, currentPlaylist]);

    const seek = useCallback((time: number) => {
        if (playlistAudioRef.current) {
            playlistAudioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    const closePlayer = useCallback(() => {
        setIsPlaying(false);
        setCurrentPlaylist(null);
        setCurrentTrackIndex(0);
        if (playlistAudioRef.current) {
            playlistAudioRef.current.pause();
            playlistAudioRef.current.currentTime = 0;
        }
        // Clear media session metadata when player is explicitly closed
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
        }
        // Resume background music if it was enabled
        setMusicPaused(false);
    }, []);

    const setGameMode = useCallback((active: boolean, type: 'default' | 'workout' = 'default') => {
        if (!active) {
            setMusicMode('bg');
        } else {
            setMusicMode(type === 'workout' ? 'workout' : 'game');
        }
    }, []);

    const toggleMusic = useCallback(() => {
        setMusicEnabled(prev => {
            const newState = !prev;
            localStorage.setItem('godly_kids_music_enabled', newState.toString());
            console.log('🎵 Music toggled:', newState ? 'ON' : 'OFF');
            return newState;
        });
    }, []);

    const toggleSfx = useCallback(() => {
        setSfxEnabled(prev => !prev);
    }, []);

    const setMusicVolume = useCallback((volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        setMusicVolumeState(clampedVolume);
        localStorage.setItem('godly_kids_music_volume', clampedVolume.toString());
        
        // Apply volume through GainNodes (works in iOS WKWebView)
        // If GainNode exists, use it; otherwise fall back to volume property
        const applyVolume = (gainRef: React.MutableRefObject<GainNode | null>, audioRef: React.MutableRefObject<HTMLAudioElement | null>, multiplier: number, name: string) => {
            const targetVolume = clampedVolume * multiplier;
            
            if (gainRef.current) {
                // Use GainNode (works in iOS)
                gainRef.current.gain.value = targetVolume;
                console.log(`🎵 ${name} GainNode volume set to:`, targetVolume);
            } else if (audioRef.current) {
                // Fallback to volume property (works in browsers, not iOS WKWebView)
                audioRef.current.volume = targetVolume;
                console.log(`🎵 ${name} volume property set to:`, targetVolume);
            }
        };
        
        applyVolume(bgGainRef, bgAudioRef, 0.5, 'BG');
        applyVolume(gameGainRef, gameAudioRef, 0.7, 'Game');
        applyVolume(workoutGainRef, workoutAudioRef, 0.8, 'Workout');
        // Playlist audio uses native volume (no GainNode) to avoid CORS issues with GCS
        
        console.log('🎵 Volume set to:', clampedVolume);
    }, []);

    const setMusicPaused = useCallback((paused: boolean) => {
        setMusicForcePaused(paused);
        // The reactive useEffect will handle pausing/playing
    }, []);

    return (
        <AudioContext.Provider value={{
            musicEnabled, sfxEnabled, musicVolume, toggleMusic, toggleSfx, setMusicVolume,
            playClick, playBack, playSuccess, playTab, setGameMode, setMusicPaused,
            currentPlaylist, currentTrackIndex, isPlaying, progress, currentTime, duration,
            playPlaylist, togglePlayPause, nextTrack, prevTrack, seek, closePlayer
        }}>
            {children}
        </AudioContext.Provider>
    );
};
