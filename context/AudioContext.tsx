
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
    isMembersOnly?: boolean;
}

// Premium preview constants
const AUDIO_PREVIEW_SECONDS = 120; // 2 minute preview for premium audio

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
    playPlaylist: (playlist: Playlist, startIndex?: number, isSubscribed?: boolean) => void;
    togglePlayPause: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    seek: (time: number) => void;
    closePlayer: () => void;
    
    // Premium preview
    isPreviewMode: boolean;
    previewLimitReached: boolean;
    previewTimeRemaining: number;
    dismissPreviewLimit: () => void;
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
    
    isPreviewMode: false,
    previewLimitReached: false,
    previewTimeRemaining: AUDIO_PREVIEW_SECONDS,
    dismissPreviewLimit: () => { },
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
    
    // --- Premium Preview State ---
    const [previewLimitReached, setPreviewLimitReached] = useState(false);
    const [previewTimeRemaining, setPreviewTimeRemaining] = useState(AUDIO_PREVIEW_SECONDS);
    const [isPreviewMode, setIsPreviewMode] = useState(false); // True if playing premium content without subscription
    const previewTimeAccumulator = useRef(0);
    const isPreviewModeRef = useRef(false); // Ref for use in event listeners

    // --- Wake Lock for Android background audio ---
    const wakeLockRef = useRef<any>(null);

    // --- Refs ---
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioReady, setAudioReady] = useState(false);
    const updateMediaSessionRef = useRef<() => void>(() => {});
    const sfxAudioRefs = useRef<{
        click: HTMLAudioElement | null;
        back: HTMLAudioElement | null;
        success: HTMLAudioElement | null;
        tab: HTMLAudioElement | null;
    }>({
        click: null,
        back: null,
        success: null,
        tab: null
    });

    // Create reusable HTML audio elements for sound effects
    // Using data URIs with minimal synthesized tones
    useEffect(() => {
        // Create silent/minimal audio elements that can be played on demand
        // These use data URIs to avoid network requests
        
        // Simple beep tones using data URIs (tiny files, instant playback)
        const createToneAudio = (frequency: number, duration: number) => {
            const audio = document.createElement('audio');
            audio.preload = 'auto';
            audio.volume = 0.15;
            // We'll use silent audio and handle sound via native beep
            // For now, using a minimal silent MP3 data URI
            audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////////////////////////////////////AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAhv8xgCQAAAAAAP/7QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGLUZY3BAUUxBVkM1OC4xMwC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//sQRAAP8AAAf4AAAAgAAA0gAAABAAAB/gAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
            return audio;
        };

        sfxAudioRefs.current = {
            click: createToneAudio(400, 0.1),
            back: createToneAudio(200, 0.15),
            success: createToneAudio(440, 0.3),
            tab: createToneAudio(600, 0.05)
        };

        return () => {
            // Cleanup audio elements
            Object.values(sfxAudioRefs.current).forEach(audio => {
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
            });
        };
    }, []);

    // Track listening time - store last tracked time to calculate deltas
    const lastListeningTimeRef = useRef<number>(0);
    const listeningTimeAccumulatorRef = useRef<number>(0);
    // Track engagement update intervals (update every 30 seconds)
    const lastEngagementUpdateRef = useRef<number>(0);
    const ENGAGEMENT_UPDATE_INTERVAL = 30; // seconds
    
    // Keep preview mode ref in sync with state
    useEffect(() => {
        isPreviewModeRef.current = isPreviewMode;
    }, [isPreviewMode]);

    // Setup event listeners for the audio element (runs when audio element is in DOM)
    useEffect(() => {
        if (!audioReady) return;
        const audio = audioRef.current;
        if (!audio) return;

        // Basic event listeners
        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (!isNaN(audio.duration) && audio.duration > 0) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }

            // Track listening time - accumulate seconds listened
            const now = Date.now();
            if (lastListeningTimeRef.current > 0 && !audio.paused) {
                const deltaSeconds = (now - lastListeningTimeRef.current) / 1000;
                // Only count if delta is reasonable (< 5 seconds to avoid big jumps after pause)
                if (deltaSeconds > 0 && deltaSeconds < 5) {
                    listeningTimeAccumulatorRef.current += deltaSeconds;
                    // Sync to localStorage every 10 seconds
                    if (listeningTimeAccumulatorRef.current >= 10) {
                        activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                        listeningTimeAccumulatorRef.current = 0;
                    }
                    
                    // Track preview time for premium content
                    if (isPreviewModeRef.current) {
                        previewTimeAccumulator.current += deltaSeconds;
                        const remaining = Math.max(0, AUDIO_PREVIEW_SECONDS - previewTimeAccumulator.current);
                        setPreviewTimeRemaining(Math.floor(remaining));
                        
                        // Check if preview limit reached
                        if (previewTimeAccumulator.current >= AUDIO_PREVIEW_SECONDS) {
                            console.log('🎵 Preview limit reached - pausing playback');
                            audio.pause();
                            setIsPlaying(false);
                            setPreviewLimitReached(true);
                        }
                    }
                }
            }
            lastListeningTimeRef.current = now;
            
            // Update engagement for trending algorithm (every 30 seconds)
            if (!isNaN(audio.currentTime) && !isNaN(audio.duration) && audio.duration > 0) {
                const shouldUpdate = audio.currentTime - lastEngagementUpdateRef.current >= ENGAGEMENT_UPDATE_INTERVAL;
                if (shouldUpdate) {
                    lastEngagementUpdateRef.current = audio.currentTime;
                    // Send engagement update to backend
                    setCurrentPlaylist(playlist => {
                        if (playlist) {
                            setCurrentTrackIndex(idx => {
                                import('../services/playEventService').then(({ playEventService }) => {
                                    playEventService.updateEpisodeEngagement(
                                        playlist._id,
                                        idx,
                                        audio.currentTime,
                                        audio.duration
                                    );
                                }).catch(() => {});
                                return idx;
                            });
                        }
                        return playlist;
                    });
                }
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            // Send final engagement update for completed track (100%)
            setCurrentPlaylist(playlist => {
                if (playlist) {
                    setCurrentTrackIndex(prev => {
                        // Send final engagement for the track that just ended
                        if (audio.duration > 0) {
                            import('../services/playEventService').then(({ playEventService }) => {
                                playEventService.updateEpisodeEngagement(
                                    playlist._id,
                                    prev,
                                    audio.duration, // Full duration since track completed
                                    audio.duration
                                );
                            }).catch(() => {});
                        }
                        
                        const nextIndex = prev + 1;
                        if (nextIndex < playlist.items.length) {
                            // There's a next track - keep playing
                            console.log('🎵 Track ended, auto-playing next track:', nextIndex + 1, '/', playlist.items.length);
                            setIsPlaying(true); // Keep playing state true for next track
                            
                            // Reset engagement tracking for new track
                            lastEngagementUpdateRef.current = 0;
                            
                            // Record play event for the next track (real-time trending)
                            const track = playlist.items[nextIndex];
                            const trackId = (track as any)?._id;
                            const trackDuration = track?.duration || 0;
                            import('../services/playEventService').then(({ playEventService }) => {
                                playEventService.recordEpisodePlay(playlist._id, nextIndex, trackId, undefined, trackDuration);
                            }).catch(() => {});
                            
                            return nextIndex;
                        } else {
                            // No more tracks - stop playing
                            console.log('🎵 Playlist ended');
                            setIsPlaying(false);
                            return prev; // Stay at last track
                        }
                    });
                }
                return playlist;
            });
        };

        const handlePlay = () => {
            setIsPlaying(true);
            updateMediaSessionRef.current();
        };

        const handlePause = () => {
            setIsPlaying(false);
            // Save any accumulated listening time when paused
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                listeningTimeAccumulatorRef.current = 0;
            }
            lastListeningTimeRef.current = 0;
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            // Save remaining listening time on unmount
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
            }
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.pause();
            audio.src = '';
        };
    }, [audioReady]);

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

    // Android: Update MediaSession position state every 500ms while playing
    // This is critical - without it Android kills the audio process in background
    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            const audio = audioRef.current;
            if (!audio || audio.paused) return;
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
                try {
                    const dur = audio.duration;
                    const pos = audio.currentTime;
                    if (!isNaN(dur) && dur > 0 && !isNaN(pos)) {
                        navigator.mediaSession.setPositionState({
                            duration: dur,
                            playbackRate: 1,
                            position: Math.min(pos, dur),
                        });
                    }
                } catch (e) {
                    // Silently fail
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isPlaying]);

    // Wake Lock: Prevent Android from sleeping/killing audio during playback
    useEffect(() => {
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator && isPlaying) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('🔒 Wake Lock acquired');
                }
            } catch (err) {
                console.log('Wake Lock not supported or failed:', err);
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                    console.log('🔓 Wake Lock released');
                } catch (err) {
                    console.log('Wake Lock release failed:', err);
                }
            }
        };

        if (isPlaying) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        return () => { releaseWakeLock(); };
    }, [isPlaying]);
    // MediaSession: Set metadata AND action handlers together (Faith Defence pattern)
    // This must be called every time track changes or playback starts
    // Android requires both metadata + action handlers to show the widget
    const updateMediaSession = useCallback(() => {
        if (!('mediaSession' in navigator)) return;
        if (!currentPlaylist) return;

        const track = currentPlaylist.items[currentTrackIndex];
        if (!track) return;

        const coverImage = track.coverImage || currentPlaylist.coverImage;
        console.log('📱 Setting Media Session:', track.title, 'Cover:', coverImage);

        try {
            const artwork: MediaImage[] = [];
            if (coverImage) {
                artwork.push(
                    { src: coverImage, sizes: '256x256', type: 'image/jpeg' },
                    { src: coverImage, sizes: '512x512', type: 'image/jpeg' }
                );
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.author || currentPlaylist.author || 'GodlyKids',
                album: currentPlaylist.title,
                artwork
            });

            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

            // Action handlers must be set alongside metadata for Android widget
            navigator.mediaSession.setActionHandler('play', () => {
                audioRef.current?.play();
                setIsPlaying(true);
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                audioRef.current?.pause();
                setIsPlaying(false);
            });

            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                const skipTime = details?.seekOffset || 10;
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
                }
            });

            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                const skipTime = details?.seekOffset || 10;
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(
                        audioRef.current.duration || 0,
                        audioRef.current.currentTime + skipTime
                    );
                }
            });

            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (audioRef.current && details?.seekTime !== undefined) {
                    audioRef.current.currentTime = details.seekTime;
                }
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                setCurrentTrackIndex(prev => {
                    const next = prev + 1;
                    return currentPlaylist && next < currentPlaylist.items.length ? next : prev;
                });
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                setCurrentTrackIndex(prev => prev > 0 ? prev - 1 : 0);
            });

        } catch (e) {
            console.log('Media Session error:', e);
        }
    }, [currentPlaylist, currentTrackIndex, isPlaying]);

    // Keep ref in sync so event listeners always call latest version
    useEffect(() => {
        updateMediaSessionRef.current = updateMediaSession;
    }, [updateMediaSession]);

    // Update media session when track changes or playback state changes
    useEffect(() => {
        if (currentPlaylist) {
            updateMediaSession();
        }
    }, [currentPlaylist, currentTrackIndex, isPlaying, updateMediaSession]);

    // Cleanup media session on unmount
    useEffect(() => {
        return () => {
            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.metadata = null;
                    navigator.mediaSession.setActionHandler('play', null);
                    navigator.mediaSession.setActionHandler('pause', null);
                    navigator.mediaSession.setActionHandler('seekbackward', null);
                    navigator.mediaSession.setActionHandler('seekforward', null);
                    navigator.mediaSession.setActionHandler('seekto', null);
                    navigator.mediaSession.setActionHandler('nexttrack', null);
                    navigator.mediaSession.setActionHandler('previoustrack', null);
                } catch {}
            }
        };
    }, []);

    // --- Simple SFX using HTML Audio Elements ---
    const playSfxAudio = useCallback((type: 'click' | 'back' | 'success' | 'tab') => {
        if (!sfxEnabled) return;
        try {
            const audio = sfxAudioRefs.current[type];
            if (audio) {
                // Reset to beginning and play
                audio.currentTime = 0;
                audio.play().catch(() => {
                    // Silently fail if autoplay is blocked
                });
            }
        } catch (e) {
            console.log('SFX error:', e);
        }
    }, [sfxEnabled]);

    const playClick = useCallback(() => playSfxAudio('click'), [playSfxAudio]);
    const playBack = useCallback(() => playSfxAudio('back'), [playSfxAudio]);
    const playTab = useCallback(() => playSfxAudio('tab'), [playSfxAudio]);
    const playSuccess = useCallback(() => {
        playSfxAudio('success');
    }, [playSfxAudio]);

    // --- Playlist Player Methods ---
    const playPlaylist = useCallback((playlist: Playlist, startIndex: number = 0, isSubscribed: boolean = true) => {
        console.log('🎵 playPlaylist called:', {
            title: playlist.title,
            isMembersOnly: playlist.isMembersOnly,
            isSubscribed: isSubscribed,
            willBePreviewMode: !isSubscribed
        });
        
        setCurrentPlaylist(playlist);
        setCurrentTrackIndex(startIndex);
        setIsPlaying(true);
        
        // Enable preview mode for ALL non-subscribed users (2 min limit on all audio)
        const isPremiumPreview = !isSubscribed;
        setIsPreviewMode(isPremiumPreview);
        if (isPremiumPreview) {
            // Reset preview time when starting a new playlist
            previewTimeAccumulator.current = 0;
            setPreviewTimeRemaining(AUDIO_PREVIEW_SECONDS);
            setPreviewLimitReached(false);
            console.log('🎵 Starting playlist in preview mode (2 min limit) - user not subscribed');
        } else {
            console.log('🎵 Full playback mode - user is subscribed');
            setPreviewLimitReached(false);
        }
        
        // Reset engagement tracking for new track
        lastEngagementUpdateRef.current = 0;

        // Track analytics
        const playlistId = playlist._id;
        const track = playlist.items[startIndex];
        const trackId = (track as any)?._id;
        const trackDuration = track?.duration || 0; // Get track duration in seconds

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
            
            // Record play event for real-time trending (with total duration for engagement tracking)
            import('../services/playEventService').then(({ playEventService }) => {
                playEventService.recordEpisodePlay(playlistId, startIndex, trackId, undefined, trackDuration);
            }).catch(() => {});
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
        
        // Reset preview state
        setPreviewLimitReached(false);
        setIsPreviewMode(false);
        previewTimeAccumulator.current = 0;
        setPreviewTimeRemaining(AUDIO_PREVIEW_SECONDS);
    }, []);
    
    const dismissPreviewLimit = useCallback(() => {
        setPreviewLimitReached(false);
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
            playPlaylist, togglePlayPause, nextTrack, prevTrack, seek, closePlayer,
            isPreviewMode, previewLimitReached, previewTimeRemaining, dismissPreviewLimit
        }}>
            {children}
            {/* Render audio element in DOM for Android background playback support */}
            <audio
                ref={(el) => {
                    if (el && !audioRef.current) {
                        audioRef.current = el;
                        setAudioReady(true);
                    }
                }}
                preload="auto"
                playsInline
                style={{ display: 'none' }}
            />
        </AudioContext.Provider>
    );
};
