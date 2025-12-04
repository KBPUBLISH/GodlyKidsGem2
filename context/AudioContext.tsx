
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../services/apiService';
import { playHistoryService } from '../services/playHistoryService';
import { analyticsService } from '../services/analyticsService';

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
        // Default to true if not set
        return saved !== null ? saved === 'true' : true;
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

    // Initialize Audio Context lazily
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

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

        // BG Audio - quieter (base 30%)
        bgAudioRef.current = createAudio(BG_MUSIC_URL, 0.3, 'BG');

        // Game Audio - medium (base 50%)
        gameAudioRef.current = createAudio(GAME_MUSIC_URL, 0.5, 'Game');

        // Workout Audio - louder (base 60%)
        workoutAudioRef.current = createAudio(WORKOUT_MUSIC_URL, 0.6, 'Workout');

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

        // Helper to play one and pause others
        const playSelected = async (toPlay: HTMLAudioElement, others: HTMLAudioElement[], name: string) => {
            others.forEach(a => a.pause());
            if (toPlay.paused) {
                console.log(`🎵 Attempting to play ${name}...`, {
                    src: toPlay.src,
                    readyState: toPlay.readyState,
                    networkState: toPlay.networkState,
                    paused: toPlay.paused,
                    error: toPlay.error
                });
                
                try {
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
            playSelected(bg, [game, workout], 'BG');
        } else if (musicMode === 'game') {
            playSelected(game, [bg, workout], 'Game');
        } else if (musicMode === 'workout') {
            playSelected(workout, [bg, game], 'Workout');
        }

    }, [musicEnabled, musicForcePaused, musicMode]);

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
                    setDuration(playlistAudioRef.current.duration);
                }
            });

            playlistAudioRef.current.addEventListener('ended', () => {
                handleTrackEnd();
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
            if (track && playlistAudioRef.current.src !== track.audioUrl) {
                playlistAudioRef.current.src = track.audioUrl;
                if (isPlaying) {
                    const playPromise = playlistAudioRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.catch((e) => {
                            if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                                console.error("Play error:", e);
                            }
                        });
                    }
                }
            }
        }
    }, [currentPlaylist, currentTrackIndex]);

    // Sync play/pause state
    useEffect(() => {
        if (playlistAudioRef.current) {
            if (isPlaying) {
                playlistAudioRef.current.play().catch(e => {
                    // Silently ignore expected autoplay/abort errors
                    if (e.name !== 'NotAllowedError' && e.name !== 'AbortError' && e.name !== 'NotSupportedError') {
                        console.error("Play error:", e);
                    }
                });
            } else {
                playlistAudioRef.current.pause();
            }
        }
    }, [isPlaying]);

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
            
            // Track analytics
            analyticsService.playlistPlay(playlistId, playlist.title);
            if (track) {
                analyticsService.audioPlay(trackId || `${playlistId}_${startIndex}`, track.title, playlistId);
            }
            
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
        
        // Apply volume to all background audio elements
        // Scale the volume based on their default levels
        if (bgAudioRef.current) {
            bgAudioRef.current.volume = clampedVolume * 0.3; // BG is quieter (max 30%)
        }
        if (gameAudioRef.current) {
            gameAudioRef.current.volume = clampedVolume * 0.5; // Game at 50%
        }
        if (workoutAudioRef.current) {
            workoutAudioRef.current.volume = clampedVolume * 0.6; // Workout at 60%
        }
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
