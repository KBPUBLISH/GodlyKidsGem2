
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

    // --- Refs ---
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const sfxContextRef = useRef<AudioContext | null>(null);
    const wasPlayingBeforeBackgroundRef = useRef<boolean>(false);
    const savedPositionBeforeBackgroundRef = useRef<number>(0);
    const isRecoveringAudioRef = useRef<boolean>(false); // Prevent pause event from interfering during recovery

    // Get or create SFX AudioContext (reuse for all sound effects)
    // Protected against errors during Despia WebView transitions
    const getSfxContext = useCallback(() => {
        try {
            // In Despia during early boot, skip audio context creation to avoid transition errors
            const isDespia = typeof window !== 'undefined' && (window as any).__GK_IS_DESPIA__;
            if (isDespia) {
                const bootTimestamp = (window as any).__GK_BOOT_TIMESTAMP__ || 0;
                const timeSinceBoot = Date.now() - bootTimestamp;
                // Skip audio during first 500ms of boot to avoid transition issues
                if (timeSinceBoot < 500) {
                    throw new Error('Skipping audio during Despia transition');
                }
            }
            
            if (!sfxContextRef.current || sfxContextRef.current.state === 'closed') {
                sfxContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            // Resume if suspended (happens after user interaction is required)
            if (sfxContextRef.current.state === 'suspended') {
                sfxContextRef.current.resume().catch(() => {
                    // Ignore resume errors - can happen during visibility changes
                });
            }
            return sfxContextRef.current;
        } catch (e) {
            // Return a dummy context-like object that won't crash when used
            console.log('AudioContext unavailable:', e);
            return {
                createOscillator: () => ({
                    connect: () => {},
                    start: () => {},
                    stop: () => {},
                    frequency: { setValueAtTime: () => {} },
                    type: 'sine'
                }),
                createGain: () => ({
                    connect: () => {},
                    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
                }),
                destination: {},
                currentTime: 0,
                state: 'suspended'
            } as unknown as AudioContext;
        }
    }, []);

    // Track listening time - store last tracked time to calculate deltas
    const lastListeningTimeRef = useRef<number>(0);
    const listeningTimeAccumulatorRef = useRef<number>(0);
    // Track engagement update intervals (update every 30 seconds)
    const lastEngagementUpdateRef = useRef<number>(0);
    const ENGAGEMENT_UPDATE_INTERVAL = 30; // seconds
    
    // Watchdog: detect when audio is stuck (isPlaying true but not progressing)
    const lastAudioTimeRef = useRef<number>(0);
    const stuckCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Keep preview mode ref in sync with state
    useEffect(() => {
        isPreviewModeRef.current = isPreviewMode;
    }, [isPreviewMode]);

    // Create audio element once on mount
    useEffect(() => {
        const audio = document.createElement('audio');
        audio.preload = 'auto';
        
        // Android: Set additional attributes to prevent suspension
        const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
        if (isAndroid) {
            audio.setAttribute('playsinline', 'true');
            // Try to prevent audio from being suspended by Android WebView
            audio.setAttribute('preload', 'auto');
        }
        
        audioRef.current = audio;

        // Basic event listeners
        audio.addEventListener('timeupdate', () => {
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
                            console.log('🎵 Preview limit reached - pausing playback', {
                                isPreviewMode: isPreviewModeRef.current,
                                accumulated: previewTimeAccumulator.current,
                                limit: AUDIO_PREVIEW_SECONDS
                            });
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
        });

        audio.addEventListener('loadedmetadata', () => {
            setDuration(audio.duration);
        });

        audio.addEventListener('ended', () => {
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
        });

        audio.addEventListener('play', () => {
            setIsPlaying(true);
            updateMediaSession();
        });

        audio.addEventListener('pause', () => {
            // Don't update React state if Android killed audio in background or we're recovering
            if (document.hidden || isRecoveringAudioRef.current) {
                console.log('🎵 Audio paused (background/recovery) - skipping state update');
                return;
            }
            
            setIsPlaying(false);
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                listeningTimeAccumulatorRef.current = 0;
            }
            lastListeningTimeRef.current = 0;
        });

        // Handle audio errors (network issues, codec problems, etc.)
        audio.addEventListener('error', (e) => {
            console.error('🎵 Audio error:', e, 'error code:', audio.error?.code, 'message:', audio.error?.message);
            // Try to recover by reloading
            const currentPos = audio.currentTime;
            audio.load();
            audio.currentTime = currentPos;
            if (!audio.paused) {
                audio.play().catch(() => {});
            }
        });

        // Handle stalled playback (buffering issues) - auto-recover
        audio.addEventListener('stalled', () => {
            console.warn('🎵 Audio stalled (buffering) - attempting recovery');
            // Try to recover by seeking slightly forward
            const currentPos = audio.currentTime;
            audio.currentTime = currentPos + 0.1;
            if (!audio.paused) {
                audio.play().catch(() => {});
            }
        });

        // Handle when browser suspends loading (to save bandwidth)
        audio.addEventListener('suspend', () => {
            console.log('🎵 Audio loading suspended by browser');
            // If we're supposed to be playing but suspended, try to resume
            if (!audio.paused && audio.readyState < audio.HAVE_FUTURE_DATA) {
                audio.load();
            }
        });

        // Handle waiting for data (buffering)
        let waitingTimeout: ReturnType<typeof setTimeout> | null = null;
        audio.addEventListener('waiting', () => {
            console.log('🎵 Audio waiting for data (buffering)');
            // If stuck waiting for more than 5 seconds, try to recover
            if (waitingTimeout) clearTimeout(waitingTimeout);
            waitingTimeout = setTimeout(() => {
                if (!audio.paused && audio.readyState < audio.HAVE_FUTURE_DATA) {
                    console.warn('🎵 Audio stuck buffering - attempting recovery');
                    const currentPos = audio.currentTime;
                    audio.load();
                    audio.currentTime = currentPos;
                    audio.play().catch(() => {});
                }
            }, 5000);
        });

        // Handle when playback can resume after buffering
        audio.addEventListener('canplay', () => {
            console.log('🎵 Audio can play (buffering complete)');
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                waitingTimeout = null;
            }
        });

        return () => {
            // Save remaining listening time on unmount
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
            }
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
            
            // Android: More aggressive watchdog for stuck audio (Android WebView suspends audio more aggressively)
            const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
            const checkInterval = isAndroid ? 3000 : 5000; // Check every 3s on Android, 5s on others
            
            if (stuckCheckIntervalRef.current) {
                clearInterval(stuckCheckIntervalRef.current);
            }
            lastAudioTimeRef.current = audio.currentTime;
            stuckCheckIntervalRef.current = setInterval(() => {
                const currentTime = audio.currentTime;
                const lastTime = lastAudioTimeRef.current;
                
                // If audio should be playing but hasn't progressed, it's stuck
                if (!audio.paused && currentTime === lastTime && currentTime > 0) {
                    console.error('🎵 Audio stuck at', currentTime, isAndroid ? '(Android)' : '');
                    isRecoveringAudioRef.current = true;
                    
                    if (isAndroid) {
                        const src = audio.src;
                        const pos = audio.currentTime;
                        audio.src = src;
                        audio.load();
                        const onReady = () => {
                            audio.currentTime = pos;
                            audio.play().then(() => {
                                isRecoveringAudioRef.current = false;
                            }).catch(() => {
                                isRecoveringAudioRef.current = false;
                            });
                            audio.removeEventListener('canplay', onReady);
                        };
                        audio.addEventListener('canplay', onReady);
                        setTimeout(() => {
                            audio.removeEventListener('canplay', onReady);
                            if (audio.paused) {
                                audio.currentTime = pos;
                                audio.play().catch(() => {});
                            }
                            isRecoveringAudioRef.current = false;
                        }, 3000);
                    } else {
                        audio.currentTime = currentTime + 0.1;
                        audio.play().then(() => {
                            isRecoveringAudioRef.current = false;
                        }).catch(() => {
                            isRecoveringAudioRef.current = false;
                        });
                    }
                }
                
                lastAudioTimeRef.current = currentTime;
            }, checkInterval);
        } else {
            audio.pause();
            
            // Stop watchdog when paused
            if (stuckCheckIntervalRef.current) {
                clearInterval(stuckCheckIntervalRef.current);
                stuckCheckIntervalRef.current = null;
            }
        }
        
        // Update media session playback state
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
        
        return () => {
            if (stuckCheckIntervalRef.current) {
                clearInterval(stuckCheckIntervalRef.current);
                stuckCheckIntervalRef.current = null;
            }
        };
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

    // Auto-resume playback when app returns to foreground.
    // Android WebView kills/freezes audio in background - need aggressive recovery.
    useEffect(() => {
        const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
        
        const handleVisibilityChange = () => {
            const audio = audioRef.current;
            
            if (document.visibilityState === 'hidden') {
                // Going to background - save state before Android kills the audio
                const wasPlaying = !!(currentPlaylist && isPlaying && audio);
                wasPlayingBeforeBackgroundRef.current = wasPlaying;
                if (wasPlaying && audio) {
                    savedPositionBeforeBackgroundRef.current = audio.currentTime;
                }
            } else if (document.visibilityState === 'visible') {
                if (!currentPlaylist || !wasPlayingBeforeBackgroundRef.current || !audio) {
                    wasPlayingBeforeBackgroundRef.current = false;
                    return;
                }
                
                const savedPos = savedPositionBeforeBackgroundRef.current;
                wasPlayingBeforeBackgroundRef.current = false;
                
                // Re-establish MediaSession
                if ('mediaSession' in navigator) {
                    try { updateMediaSession(); } catch (e) { /* ignore */ }
                }
                
                // Set recovery flag so pause events during reload don't mess up state
                isRecoveringAudioRef.current = true;
                
                if (isAndroid) {
                    // Android: Audio element is likely dead/frozen. 
                    // Must fully reload the source and seek back to saved position.
                    const track = currentPlaylist.items[currentTrackIndex];
                    if (track?.audioUrl) {
                        audio.src = track.audioUrl;
                        audio.load();
                        
                        const resumeFromSaved = () => {
                            audio.currentTime = savedPos;
                            audio.play().then(() => {
                                isRecoveringAudioRef.current = false;
                            }).catch(() => {
                                isRecoveringAudioRef.current = false;
                            });
                            setIsPlaying(true);
                            audio.removeEventListener('canplay', resumeFromSaved);
                        };
                        audio.addEventListener('canplay', resumeFromSaved);
                        
                        // Fallback if canplay never fires
                        setTimeout(() => {
                            audio.removeEventListener('canplay', resumeFromSaved);
                            if (audio.paused) {
                                audio.currentTime = savedPos;
                                audio.play().catch(() => {});
                                setIsPlaying(true);
                            }
                            isRecoveringAudioRef.current = false;
                        }, 3000);
                    } else {
                        isRecoveringAudioRef.current = false;
                    }
                } else {
                    // iOS/other: Simple resume is enough
                    audio.play().then(() => {
                        isRecoveringAudioRef.current = false;
                    }).catch(() => {
                        isRecoveringAudioRef.current = false;
                    });
                    setIsPlaying(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [currentPlaylist, currentTrackIndex, isPlaying, updateMediaSession]);

    // Safe wrapper for mediaSession operations - prevents errors during Despia WebView transitions
    const safeMediaSessionAction = useCallback((action: string, handler: ((details?: any) => void) | null) => {
        try {
            if ('mediaSession' in navigator && navigator.mediaSession.setActionHandler) {
                navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
            }
        } catch (e) {
            // Silently fail - this can happen during WebView transitions in Despia
            console.log('MediaSession action setup skipped:', action, e);
        }
    }, []);
    
    // Set up Media Session action handlers once
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        // In Despia, delay media session setup slightly to avoid race conditions during WebView creation
        const isDespia = typeof window !== 'undefined' && (window as any).__GK_IS_DESPIA__;
        const setupDelay = isDespia ? 100 : 0;
        
        const timeoutId = setTimeout(() => {
            safeMediaSessionAction('play', () => {
                audioRef.current?.play();
            });

            safeMediaSessionAction('pause', () => {
                audioRef.current?.pause();
            });

            safeMediaSessionAction('nexttrack', () => {
                if (currentPlaylist && currentTrackIndex < currentPlaylist.items.length - 1) {
                    setCurrentTrackIndex(prev => prev + 1);
                }
            });

            safeMediaSessionAction('previoustrack', () => {
                if (currentTrackIndex > 0) {
                    setCurrentTrackIndex(prev => prev - 1);
                }
            });

            safeMediaSessionAction('seekto', (details: any) => {
                if (audioRef.current && details?.seekTime !== undefined) {
                    audioRef.current.currentTime = details.seekTime;
                }
            });

            safeMediaSessionAction('seekbackward', (details: any) => {
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details?.seekOffset || 10));
                }
            });

            safeMediaSessionAction('seekforward', (details: any) => {
                if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(
                        audioRef.current.duration || 0,
                        audioRef.current.currentTime + (details?.seekOffset || 10)
                    );
                }
            });
        }, setupDelay);

        return () => {
            clearTimeout(timeoutId);
            // Cleanup handlers - wrapped to prevent errors during Despia transitions
            safeMediaSessionAction('play', null);
            safeMediaSessionAction('pause', null);
            safeMediaSessionAction('nexttrack', null);
            safeMediaSessionAction('previoustrack', null);
            safeMediaSessionAction('seekto', null);
            safeMediaSessionAction('seekbackward', null);
            safeMediaSessionAction('seekforward', null);
        };
    }, [currentPlaylist, currentTrackIndex, safeMediaSessionAction]);

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
            // IMPORTANT: Reset preview accumulator for subscribed users to prevent false pauses
            previewTimeAccumulator.current = 0;
            setPreviewTimeRemaining(AUDIO_PREVIEW_SECONDS);
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
        </AudioContext.Provider>
    );
};
