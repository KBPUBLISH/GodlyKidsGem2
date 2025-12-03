
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../services/apiService';
import { playHistoryService } from '../services/playHistoryService';

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
        // BG Audio
        bgAudioRef.current = new Audio(BG_MUSIC_URL);
        bgAudioRef.current.loop = true;
        bgAudioRef.current.volume = 0.15;
        bgAudioRef.current.preload = 'auto';
        bgAudioRef.current.crossOrigin = 'anonymous';

        // Game Audio
        gameAudioRef.current = new Audio(GAME_MUSIC_URL);
        gameAudioRef.current.loop = true;
        gameAudioRef.current.volume = 0.25;
        gameAudioRef.current.preload = 'auto';
        gameAudioRef.current.crossOrigin = 'anonymous';

        // Workout Audio
        workoutAudioRef.current = new Audio(WORKOUT_MUSIC_URL);
        workoutAudioRef.current.loop = true;
        workoutAudioRef.current.volume = 0.3;
        workoutAudioRef.current.preload = 'auto';
        workoutAudioRef.current.crossOrigin = 'anonymous';

        console.log('🎵 Audio System Initialized with hardcoded URLs');

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

        if (!bg || !game || !workout) return;

        const shouldPlay = musicEnabled && !musicForcePaused;

        if (!shouldPlay) {
            // Pause all if disabled or force paused
            bg.pause();
            game.pause();
            workout.pause();
            return;
        }

        // Helper to play one and pause others
        const playSelected = (toPlay: HTMLAudioElement, others: HTMLAudioElement[]) => {
            others.forEach(a => a.pause());
            if (toPlay.paused) {
                toPlay.play().catch(e => {
                    // Auto-play might be blocked until user interaction
                    // console.warn('Autoplay prevented:', e); 
                });
            }
        };

        if (musicMode === 'bg') {
            playSelected(bg, [game, workout]);
        } else if (musicMode === 'game') {
            playSelected(game, [bg, workout]);
        } else if (musicMode === 'workout') {
            playSelected(workout, [bg, game]);
        }

    }, [musicEnabled, musicForcePaused, musicMode]);

    // --- User Interaction Unlock ---
    useEffect(() => {
        const unlock = () => {
            // Resume AudioContext if suspended
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }

            // Try to play background music if it should be playing
            if (musicEnabled && !musicForcePaused) {
                const bg = bgAudioRef.current;
                if (bg && musicMode === 'bg' && bg.paused) {
                    bg.play().then(() => {
                        console.log('🎵 BG Music unlocked by user interaction');
                    }).catch(e => console.warn('Unlock failed:', e));
                }
            }
        };

        const events = ['click', 'touchstart', 'keydown'];
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
                playlistAudioRef.current.play().catch(e => console.error("Play error:", e));
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
            setCurrentTrackIndex(prev => prev + 1);
            setIsPlaying(true);
        }
    }, [currentPlaylist, currentTrackIndex]);

    const prevTrack = useCallback(() => {
        if (currentTrackIndex > 0) {
            setCurrentTrackIndex(prev => prev - 1);
            setIsPlaying(true);
        }
    }, [currentTrackIndex]);

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
