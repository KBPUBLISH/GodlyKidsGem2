
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

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

// Ambient Ocean Sound (Main App)
const BG_MUSIC_URL = "https://res.cloudinary.com/dxh8fuq7b/video/upload/v1763747567/Seaside_Adventure_2025-11-21T174503_i3p43n.mp3";
// Upbeat Game Music
const GAME_MUSIC_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";
// Energetic Workout Music
const WORKOUT_MUSIC_URL = "https://res.cloudinary.com/dxh8fuq7b/video/upload/v1763747567/Jump_and_Spin_pczce5.mp3";

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- Background Music State ---
    const [musicVolume, setMusicVolumeState] = useState<number>(() => {
        const saved = localStorage.getItem('godly_kids_music_volume');
        return saved ? parseFloat(saved) : 0.5;
    });
    const [musicEnabled, setMusicEnabled] = useState(true);
    const [sfxEnabled, setSfxEnabled] = useState(true);
    const [musicMode, setMusicMode] = useState<'bg' | 'game' | 'workout'>('bg');
    const [musicForcePaused, setMusicForcePaused] = useState(() => {
        return window.location.pathname.includes('/book-reader') || window.location.pathname.includes('/read/');
    });

    // --- Playlist Player State ---
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Refs
    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const gameAudioRef = useRef<HTMLAudioElement | null>(null);
    const workoutAudioRef = useRef<HTMLAudioElement | null>(null);
    const playlistAudioRef = useRef<HTMLAudioElement | null>(null); // New ref for playlist audio
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context lazily
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

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
                // Auto-advance logic handled in a separate effect or function
                // We'll trigger it via state change or direct call
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
                            // Ignore AbortError - it's expected when audio is paused before play completes
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


    // --- BACKGROUND MUSIC LOGIC ---

    const setGameMode = useCallback((active: boolean, type: 'default' | 'workout' = 'default') => {
        if (!active) {
            setMusicMode('bg');
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (gameAudioRef.current) gameAudioRef.current.pause();
            if (workoutAudioRef.current) workoutAudioRef.current.pause();
        } else {
            setMusicMode(type === 'workout' ? 'workout' : 'game');
        }
    }, []);

    const musicForcePausedRef = useRef(musicForcePaused);
    useEffect(() => {
        musicForcePausedRef.current = musicForcePaused;
    }, [musicForcePaused]);

    useEffect(() => {
        // Initialize BG audio elements (same as before)
        if (!bgAudioRef.current) {
            bgAudioRef.current = new Audio(BG_MUSIC_URL);
            bgAudioRef.current.loop = true;
            bgAudioRef.current.volume = 0;
        }
        if (!gameAudioRef.current) {
            gameAudioRef.current = new Audio(GAME_MUSIC_URL);
            gameAudioRef.current.loop = true;
            gameAudioRef.current.volume = 0;
        }
        if (!workoutAudioRef.current) {
            workoutAudioRef.current = new Audio(WORKOUT_MUSIC_URL);
            workoutAudioRef.current.loop = true;
            workoutAudioRef.current.volume = 0;
        }

        const bg = bgAudioRef.current;
        const game = gameAudioRef.current;
        const workout = workoutAudioRef.current;

        const masterLoop = setInterval(() => {
            // 1. FORCE PAUSED? (e.g. Book Reader OR Playlist Player Active)
            // Note: We use musicForcePaused to suppress BG music when Playlist is playing
            if (musicForcePausedRef.current) {
                if (!bg.paused) bg.pause();
                if (!game.paused) game.pause();
                if (!workout.paused) workout.pause();
                return;
            }

            // 2. Music Disabled?
            if (!musicEnabled) {
                if (!bg.paused) bg.pause();
                if (!game.paused) game.pause();
                if (!workout.paused) workout.pause();
                return;
            }

            // Helper function to safely play audio
            const safePlay = (audio: HTMLAudioElement) => {
                // Double-check conditions before playing
                if (musicForcePausedRef.current || !musicEnabled) {
                    return;
                }
                if (audio.paused && audio.readyState >= 2) {
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.catch((error) => {
                            // Ignore AbortError - it's expected when audio is paused before play completes
                            if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
                                console.warn('Audio play error:', error);
                            }
                        });
                    }
                }
            };

            // 3. Normal BG Music Logic
            if (musicMode === 'bg') {
                safePlay(bg);
                bg.volume = musicVolume * 0.25;
                if (!game.paused) game.pause();
                if (!workout.paused) workout.pause();
            }
            else if (musicMode === 'game') {
                safePlay(game);
                game.volume = musicVolume * 0.3;
                if (!bg.paused) bg.pause();
                if (!workout.paused) workout.pause();
            }
            else if (musicMode === 'workout') {
                safePlay(workout);
                workout.volume = musicVolume * 0.4;
                if (!bg.paused) bg.pause();
                if (!game.paused) game.pause();
            }
        }, 100);

        const unlockAudio = () => {
            if (musicForcePausedRef.current) return;
            if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        };

        if (!musicForcePaused) {
            window.addEventListener('click', unlockAudio, { once: true });
            window.addEventListener('touchstart', unlockAudio, { once: true });
        }

        return () => {
            clearInterval(masterLoop);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, [musicEnabled, musicMode, musicVolume, musicForcePaused]);

    const toggleMusic = () => setMusicEnabled(prev => !prev);
    const toggleSfx = () => setSfxEnabled(prev => !prev);

    const setMusicVolume = useCallback((volume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        setMusicVolumeState(clampedVolume);
        localStorage.setItem('godly_kids_music_volume', clampedVolume.toString());
    }, []);

    const setMusicPaused = useCallback((paused: boolean) => {
        setMusicForcePaused(paused);
        if (paused) {
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (gameAudioRef.current) gameAudioRef.current.pause();
            if (workoutAudioRef.current) workoutAudioRef.current.pause();
        }
    }, []);

    return (
        <AudioContext.Provider value={{
            musicEnabled, sfxEnabled, musicVolume, toggleMusic, toggleSfx, setMusicVolume,
            playClick, playBack, playSuccess, playTab, setGameMode, setMusicPaused,
            // Playlist Player
            currentPlaylist, currentTrackIndex, isPlaying, progress, currentTime, duration,
            playPlaylist, togglePlayPause, nextTrack, prevTrack, seek, closePlayer
        }}>
            {children}
        </AudioContext.Provider>
    );
};