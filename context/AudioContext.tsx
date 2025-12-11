
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
    // Background Music & SFX (simplified - disabled by default)
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
    musicEnabled: false,
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

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- State ---
    const [musicVolume, setMusicVolumeState] = useState(0.5);
    const [musicEnabled, setMusicEnabled] = useState(false); // Background music disabled by default
    const [sfxEnabled, setSfxEnabled] = useState(true);

    // --- Playlist Player State ---
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- Refs ---
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const sfxContextRef = useRef<AudioContext | null>(null);

    // Get or create SFX AudioContext (reuse for all sound effects)
    const getSfxContext = useCallback(() => {
        if (!sfxContextRef.current || sfxContextRef.current.state === 'closed') {
            sfxContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        // Resume if suspended (happens after user interaction is required)
        if (sfxContextRef.current.state === 'suspended') {
            sfxContextRef.current.resume();
        }
        return sfxContextRef.current;
    }, []);

    // Create audio element once on mount
    useEffect(() => {
        const audio = document.createElement('audio');
        audio.preload = 'auto';
        audioRef.current = audio;

        // Basic event listeners
        audio.addEventListener('timeupdate', () => {
            setCurrentTime(audio.currentTime);
            if (!isNaN(audio.duration) && audio.duration > 0) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            setDuration(audio.duration);
        });

        audio.addEventListener('ended', () => {
            // Auto-advance to next track
            setCurrentTrackIndex(prev => {
                setCurrentPlaylist(playlist => {
                    if (playlist && prev < playlist.items.length - 1) {
                        return playlist;
                    }
                    setIsPlaying(false);
                    return playlist;
                });
                return prev + 1;
            });
        });

        audio.addEventListener('play', () => {
            setIsPlaying(true);
            updateMediaSession();
        });

        audio.addEventListener('pause', () => {
            setIsPlaying(false);
        });

        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    // Load track when playlist or index changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentPlaylist) return;

        const track = currentPlaylist.items[currentTrackIndex];
        if (!track?.audioUrl) return;

        // Set source and load
        audio.src = track.audioUrl;
        audio.load();

        // Auto-play if isPlaying is true
        if (isPlaying) {
            audio.play().catch(e => console.log('Autoplay blocked:', e.name));
        }

        // Update media session
        updateMediaSession();
    }, [currentPlaylist, currentTrackIndex]);

    // Simple play/pause sync
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        if (isPlaying) {
            audio.play().catch(e => console.log('Play failed:', e.name));
        } else {
            audio.pause();
        }
        
        // Update media session playback state
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [isPlaying]);

    // Media Session setup with cover image
    const updateMediaSession = useCallback(() => {
        if (!('mediaSession' in navigator) || !currentPlaylist) return;

        const track = currentPlaylist.items[currentTrackIndex];
        if (!track) return;

        const coverImage = track.coverImage || currentPlaylist.coverImage;
        console.log('📱 Setting Media Session:', track.title, 'Cover:', coverImage);

        try {
            // Build artwork array with multiple sizes for iOS
            const artwork: MediaImage[] = [];
            if (coverImage) {
                artwork.push(
                    { src: coverImage, sizes: '96x96', type: 'image/png' },
                    { src: coverImage, sizes: '128x128', type: 'image/png' },
                    { src: coverImage, sizes: '192x192', type: 'image/png' },
                    { src: coverImage, sizes: '256x256', type: 'image/png' },
                    { src: coverImage, sizes: '384x384', type: 'image/png' },
                    { src: coverImage, sizes: '512x512', type: 'image/png' }
                );
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.author || currentPlaylist.author || 'GodlyKids',
                album: currentPlaylist.title,
                artwork
            });
            
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (e) {
            console.log('Media Session error:', e);
        }
    }, [currentPlaylist, currentTrackIndex, isPlaying]);

    // Update media session when track changes
    useEffect(() => {
        if (currentPlaylist) {
            updateMediaSession();
        }
    }, [currentPlaylist, currentTrackIndex, updateMediaSession]);

    // Set up Media Session action handlers once
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => {
            audioRef.current?.play();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            audioRef.current?.pause();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            if (currentPlaylist && currentTrackIndex < currentPlaylist.items.length - 1) {
                setCurrentTrackIndex(prev => prev + 1);
            }
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            if (currentTrackIndex > 0) {
                setCurrentTrackIndex(prev => prev - 1);
            }
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (audioRef.current && details.seekTime !== undefined) {
                audioRef.current.currentTime = details.seekTime;
            }
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset || 10));
            }
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            if (audioRef.current) {
                audioRef.current.currentTime = Math.min(
                    audioRef.current.duration || 0,
                    audioRef.current.currentTime + (details.seekOffset || 10)
                );
            }
        });

        return () => {
            try {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                navigator.mediaSession.setActionHandler('seekto', null);
                navigator.mediaSession.setActionHandler('seekbackward', null);
                navigator.mediaSession.setActionHandler('seekforward', null);
            } catch { }
        };
    }, [currentPlaylist, currentTrackIndex]);

    // --- Simple SFX using Web Audio API ---
    const playTone = useCallback((freq: number, dur: number, vol: number = 0.15) => {
        if (!sfxEnabled) return;
        try {
            const ctx = getSfxContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + dur);
        } catch (e) {
            console.log('SFX error:', e);
        }
    }, [sfxEnabled, getSfxContext]);

    const playClick = useCallback(() => playTone(400, 0.1), [playTone]);
    const playBack = useCallback(() => playTone(200, 0.15), [playTone]);
    const playTab = useCallback(() => playTone(600, 0.05), [playTone]);
    const playSuccess = useCallback(() => {
        playTone(440, 0.2);
        setTimeout(() => playTone(660, 0.2), 100);
        setTimeout(() => playTone(880, 0.3), 200);
    }, [playTone]);

    // --- Playlist Player Methods ---
    const playPlaylist = useCallback((playlist: Playlist, startIndex: number = 0) => {
        setCurrentPlaylist(playlist);
        setCurrentTrackIndex(startIndex);
        setIsPlaying(true);

        // Track analytics
        const playlistId = playlist._id;
        const track = playlist.items[startIndex];
        const trackId = (track as any)?._id;

        if (playlistId) {
            playHistoryService.recordPlay(playlistId, trackId);
            analyticsService.playlistPlay(playlistId, playlist.title);
            if (track) {
                activityTrackingService.trackSongPlayed(trackId || `${playlistId}_${startIndex}`, track.title);
                incrementActivityCounter('song');
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
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    const closePlayer = useCallback(() => {
        setIsPlaying(false);
        setCurrentPlaylist(null);
        setCurrentTrackIndex(0);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }

        // Clear media session
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = null;
            } catch { }
        }
    }, []);

    // Stub methods for background music (disabled)
    const toggleMusic = useCallback(() => setMusicEnabled(prev => !prev), []);
    const toggleSfx = useCallback(() => setSfxEnabled(prev => !prev), []);
    const setMusicVolume = useCallback((v: number) => setMusicVolumeState(v), []);
    const setGameMode = useCallback(() => { }, []);
    const setMusicPaused = useCallback(() => { }, []);

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
