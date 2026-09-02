
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ApiService } from '../services/apiService';
import { playHistoryService } from '../services/playHistoryService';
import { analyticsService } from '../services/analyticsService';
import { activityTrackingService } from '../services/activityTrackingService';
import { incrementActivityCounter } from '../components/features/ReviewPromptModal';
import { attachReliableLoop } from '../utils/audioLoop';
import {
    despiaAudioPlayer,
    isNativeAudioAvailable,
    isUnknownNativeAudioCommand,
    subscribeNativeAudio,
    toNativeTracks,
    type NativeAudioEvent,
} from '../services/despiaAudioPlayer';

const NATIVE_PLAYLIST_SNAPSHOT_KEY = 'gk_native_audio_snapshot';

/** HTML/native duration is often Infinity, NaN, or 0 until metadata arrives. */
function finiteDuration(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// --- Interfaces ---
export interface AudioItem {
    _id?: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    /** Optional music video (members-only playback in the app) */
    videoUrl?: string;
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
const STORAGE_BG_MUSIC_ENABLED = 'godlykids_bg_music_enabled';
const STORAGE_BG_MUSIC_VOLUME = 'godlykids_bg_music_volume';

interface AppBackgroundTrack {
    audioUrl: string;
    defaultVolume: number;
    loop: boolean;
    name: string;
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
    /** Pages that want the app-background loop call this on mount; cleanup on unmount. */
    acquireAppAmbient: () => () => void;

    // Playlist Player
    currentPlaylist: Playlist | null;
    currentTrackIndex: number;
    isPlaying: boolean;
    isShuffle: boolean;
    progress: number;
    currentTime: number;
    duration: number;
    playPlaylist: (playlist: Playlist, startIndex?: number, isSubscribed?: boolean, resumeFromSeconds?: number) => void;
    togglePlayPause: () => void;
    toggleShuffle: () => void;
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
    acquireAppAmbient: () => () => { },

    currentPlaylist: null,
    currentTrackIndex: 0,
    isPlaying: false,
    isShuffle: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    playPlaylist: () => { },
    togglePlayPause: () => { },
    toggleShuffle: () => { },
    nextTrack: () => { },
    prevTrack: () => { },
    seek: () => { },
    closePlayer: () => { },
    
    isPreviewMode: false,
    previewLimitReached: false,
    previewTimeRemaining: AUDIO_PREVIEW_SECONDS,
    dismissPreviewLimit: () => { },
});

/** Fisher-Yates shuffle; keeps `startIndex` first so current track continues. */
function buildShuffleOrder(length: number, startIndex: number): number[] {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
    }
    const startPos = order.indexOf(startIndex);
    if (startPos > 0) {
        order.splice(startPos, 1);
        order.unshift(startIndex);
    }
    return order;
}

export const useAudio = () => useContext(AudioContext);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- State ---
    const [musicVolume, setMusicVolumeState] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_BG_MUSIC_VOLUME);
            if (saved != null) {
                const n = parseFloat(saved);
                if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
            }
        } catch {
            /* ignore */
        }
        return 0.5;
    });
    const [musicEnabled, setMusicEnabled] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_BG_MUSIC_ENABLED) === 'true';
        } catch {
            return false;
        }
    });
    const [sfxEnabled, setSfxEnabled] = useState(true);
    const [appBackgroundTrack, setAppBackgroundTrack] = useState<AppBackgroundTrack | null>(null);
    /** When true, book reader / lessons / modals asked to duck or stop app-loop music */
    const [contentMusicPaused, setContentMusicPaused] = useState(false);
    /** Reserved for mini-games that need to own the mix (strength, etc.) */
    const [gameModeActive, setGameModeActive] = useState(false);
    /** Count of pages currently requesting the app-background ambient loop (e.g. Explore). */
    const [ambientHolders, setAmbientHolders] = useState(0);

    // --- Playlist Player State ---
    const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    
    // --- Premium Preview State ---
    const [previewLimitReached, setPreviewLimitReached] = useState(false);
    const [previewTimeRemaining, setPreviewTimeRemaining] = useState(AUDIO_PREVIEW_SECONDS);
    const [isPreviewMode, setIsPreviewMode] = useState(false); // True if playing premium content without subscription
    const previewTimeAccumulator = useRef(0);
    const isPreviewModeRef = useRef(false); // Ref for use in event listeners
    const isShuffleRef = useRef(false);
    /** Shuffled permutation of playlist item indices; position tracked separately. */
    const shuffleOrderRef = useRef<number[]>([]);
    const shufflePosRef = useRef(0);

    // --- Refs ---
    const audioRef = useRef<HTMLAudioElement | null>(null);
    /** Separate from playlist `audioRef` so book/playlist never clobber the ambience loop */
    const appBgAudioRef = useRef<HTMLAudioElement | null>(null);
    /** Android Despia native player (lock screen + background). Disabled on unknown_command. */
    const [nativeAudioEnabled, setNativeAudioEnabled] = useState(() => isNativeAudioAvailable());
    const nativeAudioEnabledRef = useRef(nativeAudioEnabled);
    const nativeOwnsPlaybackRef = useRef(false);
    const nativeConfirmedRef = useRef(false);
    const nativeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingNativeSeekRef = useRef<number | null>(null);
    const nativePositionRef = useRef(0);
    const nativeDurationRef = useRef(0);
    /** Ignore stale timeupdate/position ticks after the user scrubs (Android snaps back). */
    const lastUserSeekAtRef = useRef(0);
    const lastUserSeekToRef = useRef<number | null>(null);
    const seekRetryUsedRef = useRef(false);
    const currentPlaylistRef = useRef<Playlist | null>(null);
    const currentTrackIndexRef = useRef(0);
    const isPlayingRef = useRef(false);
    const appBgLoopEnabledRef = useRef(true);
    const sfxContextRef = useRef<AudioContext | null>(null);

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
    
    // Keep preview mode ref in sync with state
    useEffect(() => {
        isPreviewModeRef.current = isPreviewMode;
    }, [isPreviewMode]);

    useEffect(() => {
        isShuffleRef.current = isShuffle;
    }, [isShuffle]);

    useEffect(() => {
        nativeAudioEnabledRef.current = nativeAudioEnabled;
    }, [nativeAudioEnabled]);

    useEffect(() => {
        currentPlaylistRef.current = currentPlaylist;
    }, [currentPlaylist]);

    useEffect(() => {
        currentTrackIndexRef.current = currentTrackIndex;
    }, [currentTrackIndex]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // --- Playback position persistence (for "Continue Listening" resume) ---
    // The track currently loaded in the audio element. Updated only by the
    // load-track effect, so saved positions are always attributed to the track
    // the element is actually playing (never to an in-flight track change).
    const activeTrackRef = useRef<{ playlistId: string; itemId?: string } | null>(null);
    // Throttle marker for timeupdate saves (seconds of currentTime)
    const lastPositionSaveRef = useRef(0);
    // Seek to apply once the next loaded track has metadata (set by playPlaylist)
    const pendingSeekRef = useRef<number | null>(null);

    // Save (or clear) the active track's position in play history. Positions in
    // the last 15s of a track are treated as finished and cleared, so completed
    // episodes restart from the beginning next time.
    const persistPlaybackPosition = useCallback(() => {
        const active = activeTrackRef.current;
        if (!active) return;
        const audio = audioRef.current;
        const usingNative = nativeOwnsPlaybackRef.current;
        const pos = usingNative ? nativePositionRef.current : (audio?.currentTime ?? 0);
        const dur = usingNative ? nativeDurationRef.current : (audio?.duration ?? 0);
        if (isNaN(pos) || pos <= 0) return;
        if (!isNaN(dur) && dur > 0 && pos >= dur - 15) {
            playHistoryService.clearPosition(active.playlistId);
            return;
        }
        playHistoryService.savePosition(active.playlistId, active.itemId, pos, !isNaN(dur) ? dur : 0);
    }, []);

    const nativeControlsFor = (playlist: Playlist) =>
        playlist.type === 'Audiobook'
            ? { controls: 'skipforward,skipback,seek', skipInterval: 15 }
            : { controls: 'next,prev,skipforward,skipback,seek', skipInterval: 10 };

    const startNativeQueue = useCallback((
        playlist: Playlist,
        startIndex: number,
        resumeFromSeconds?: number | null,
        order?: number[]
    ) => {
        const tracks = toNativeTracks(playlist, order);
        if (tracks.length === 0) {
            console.warn('🎵 Native audio: no HTTPS tracks, using HTML audio for this playlist');
            nativeOwnsPlaybackRef.current = false;
            return false;
        }

        nativeOwnsPlaybackRef.current = true;
        nativeConfirmedRef.current = false;
        pendingNativeSeekRef.current = resumeFromSeconds && resumeFromSeconds > 0 ? resumeFromSeconds : null;
        const seedDur = finiteDuration(playlist.items[startIndex]?.duration);
        if (seedDur > 0) {
            nativeDurationRef.current = seedDur;
            setDuration(seedDur);
        }

        try {
            localStorage.setItem(NATIVE_PLAYLIST_SNAPSHOT_KEY, JSON.stringify({
                playlist,
                isPreviewMode: isPreviewModeRef.current,
                isShuffle: isShuffleRef.current,
                shuffleOrder: shuffleOrderRef.current,
                shufflePos: shufflePosRef.current,
            }));
        } catch {
            /* ignore quota */
        }

        const html = audioRef.current;
        if (html) {
            html.pause();
            html.removeAttribute('src');
            try { html.load(); } catch { /* ignore */ }
        }

        const startInQueue = order && order.length > 0 ? Math.max(0, order.indexOf(startIndex)) : startIndex;
        despiaAudioPlayer.setQueue(tracks, {
            startIndex: Math.max(0, startInQueue),
            ...nativeControlsFor(playlist),
        });
        despiaAudioPlayer.play();

        if (nativeFallbackTimerRef.current) clearTimeout(nativeFallbackTimerRef.current);
        nativeFallbackTimerRef.current = setTimeout(() => {
            if (nativeOwnsPlaybackRef.current && !nativeConfirmedRef.current) {
                console.warn('🎵 Native audio did not start (enable Native Audio in Despia and rebuild Android). Falling back to HTML audio.');
                nativeOwnsPlaybackRef.current = false;
                try { despiaAudioPlayer.terminate(); } catch { /* ignore */ }
                setNativeAudioEnabled(false);
            }
        }, 4000);

        return true;
    }, []);

    // Create audio element once on mount
    useEffect(() => {
        const audio = document.createElement('audio');
        audio.preload = 'auto';
        audio.setAttribute('data-gk-role', 'playlist');
        // Attached (invisible) so other features (e.g. dance-music ducking)
        // can discover playing audio via the DOM
        document.body.appendChild(audio);
        audioRef.current = audio;

        const trackFallbackDuration = () =>
            finiteDuration(currentPlaylistRef.current?.items[currentTrackIndexRef.current]?.duration);

        const applyKnownDuration = (reported: unknown) => {
            const d = finiteDuration(reported) || trackFallbackDuration();
            if (d > 0) setDuration(d);
            return d;
        };

        // Basic event listeners
        audio.addEventListener('timeupdate', () => {
            const target = lastUserSeekToRef.current;
            if (target != null && Date.now() - lastUserSeekAtRef.current < 1500 && Math.abs(audio.currentTime - target) > 1.25) {
                if (!seekRetryUsedRef.current && audio.readyState >= 1) {
                    seekRetryUsedRef.current = true;
                    try { audio.currentTime = target; } catch { /* ignore */ }
                }
                return;
            }
            if (target != null && Math.abs(audio.currentTime - target) <= 1.25) {
                lastUserSeekToRef.current = null;
            }
            setCurrentTime(audio.currentTime);
            const dur = applyKnownDuration(audio.duration);
            if (dur > 0) {
                setProgress((audio.currentTime / dur) * 100);
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
            
            // Persist playback position for resume, throttled to every ~5s
            // (abs() so seeking backwards also refreshes the save)
            if (Math.abs(audio.currentTime - lastPositionSaveRef.current) >= 5) {
                lastPositionSaveRef.current = audio.currentTime;
                persistPlaybackPosition();
            }

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
            applyKnownDuration(audio.duration);
        });
        audio.addEventListener('durationchange', () => {
            applyKnownDuration(audio.duration);
        });

        audio.addEventListener('ended', () => {
            // Track completed — drop the saved position so it restarts from 0
            if (activeTrackRef.current) {
                playHistoryService.clearPosition(activeTrackRef.current.playlistId);
            }
            lastPositionSaveRef.current = 0;

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

                        let nextIndex: number | null = null;
                        if (isShuffleRef.current && shuffleOrderRef.current.length > 0) {
                            const nextPos = shufflePosRef.current + 1;
                            if (nextPos < shuffleOrderRef.current.length) {
                                shufflePosRef.current = nextPos;
                                nextIndex = shuffleOrderRef.current[nextPos];
                            }
                        } else {
                            const sequential = prev + 1;
                            if (sequential < playlist.items.length) {
                                nextIndex = sequential;
                            }
                        }

                        if (nextIndex != null) {
                            console.log('🎵 Track ended, auto-playing next track:', nextIndex + 1, '/', playlist.items.length);
                            setIsPlaying(true);
                            lastEngagementUpdateRef.current = 0;

                            const track = playlist.items[nextIndex];
                            const trackId = (track as any)?._id;
                            const trackDuration = track?.duration || 0;
                            import('../services/playEventService').then(({ playEventService }) => {
                                playEventService.recordEpisodePlay(playlist._id, nextIndex!, trackId, undefined, trackDuration);
                            }).catch(() => {});

                            return nextIndex;
                        }

                        console.log('🎵 Playlist ended');
                        setIsPlaying(false);
                        return prev;
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
            setIsPlaying(false);
            // Save playback position on pause (the near-end guard inside turns
            // a pause-at-completion into a clear instead of a save)
            persistPlaybackPosition();
            // Save any accumulated listening time when paused
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                listeningTimeAccumulatorRef.current = 0;
            }
            lastListeningTimeRef.current = 0;
        });

        // Save position when the app is backgrounded or the page is unloading —
        // on mobile webviews this is often the only shutdown signal we get
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') persistPlaybackPosition();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', persistPlaybackPosition);

        return () => {
            persistPlaybackPosition();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', persistPlaybackPosition);
            // Save remaining listening time on unmount
            if (listeningTimeAccumulatorRef.current > 0) {
                activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
            }
            audio.pause();
            audio.src = '';
            audio.remove();
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_BG_MUSIC_ENABLED, musicEnabled ? 'true' : 'false');
        } catch {
            /* ignore quota / privacy mode */
        }
    }, [musicEnabled]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_BG_MUSIC_VOLUME, String(musicVolume));
        } catch {
            /* ignore quota / privacy mode */
        }
    }, [musicVolume]);

    // App-wide background loop — dedicated element so playlists never overwrite it
    useEffect(() => {
        const el = document.createElement('audio');
        el.setAttribute('data-gk-role', 'app-background');
        el.preload = 'auto';
        // Attached (invisible) so dance-music ducking can discover it
        document.body.appendChild(el);
        appBgAudioRef.current = el;
        const detachReliableLoop = attachReliableLoop(el, () => appBgLoopEnabledRef.current);

        let cancelled = false;
        (async () => {
            const map = await ApiService.getActiveMusic();
            if (cancelled || !map) return;
            const raw = map['app-background'];
            if (raw?.audioUrl) {
                setAppBackgroundTrack({
                    audioUrl: raw.audioUrl,
                    defaultVolume: typeof raw.defaultVolume === 'number' ? raw.defaultVolume : 0.35,
                    loop: raw.loop !== false,
                    name: raw.name || 'Background',
                });
            }
        })();

        return () => {
            cancelled = true;
            detachReliableLoop();
            el.pause();
            el.removeAttribute('src');
            el.remove();
            appBgAudioRef.current = null;
        };
    }, []);

    useEffect(() => {
        appBgLoopEnabledRef.current = appBackgroundTrack?.loop !== false;
    }, [appBackgroundTrack?.loop]);

    useEffect(() => {
        const el = appBgAudioRef.current;
        if (!el || !appBackgroundTrack?.audioUrl) {
            return;
        }

        const desired = appBackgroundTrack.audioUrl;
        const baseVol = typeof appBackgroundTrack.defaultVolume === 'number' ? appBackgroundTrack.defaultVolume : 0.35;
        el.loop = appBackgroundTrack.loop !== false;
        el.volume = Math.min(1, Math.max(0, baseVol * musicVolume));

        const stripQuery = (u: string) => u.split('?')[0];
        const cur = el.currentSrc || el.src || '';
        if (!cur || stripQuery(cur) !== stripQuery(desired)) {
            el.src = desired;
            try {
                el.load();
            } catch {
                /* ignore */
            }
        }

        const shouldPlay =
            musicEnabled &&
            ambientHolders > 0 &&
            !contentMusicPaused &&
            !gameModeActive &&
            currentPlaylist == null;

        if (!shouldPlay) {
            el.pause();
            return;
        }

        el.play().catch(() => {
            /* Autoplay may be blocked until the user turns this on in Settings (gesture) */
        });
    }, [
        musicEnabled,
        musicVolume,
        contentMusicPaused,
        gameModeActive,
        currentPlaylist,
        appBackgroundTrack,
        ambientHolders,
    ]);

    // Load track when playlist or index changes
    useEffect(() => {
        if (nativeAudioEnabled && nativeOwnsPlaybackRef.current) return;

        const audio = audioRef.current;
        if (!audio || !currentPlaylist) return;

        const track = currentPlaylist.items[currentTrackIndex];
        if (!track?.audioUrl) return;

        // Save the outgoing track's position before switching away from it.
        // Skipped when the "new" track is the same one (a resume re-trigger),
        // so a stale currentTime can't overwrite the saved resume point.
        const nextActive = { playlistId: currentPlaylist._id, itemId: (track as any)?._id as string | undefined };
        const prevActive = activeTrackRef.current;
        if (prevActive && (prevActive.playlistId !== nextActive.playlistId || prevActive.itemId !== nextActive.itemId)) {
            persistPlaybackPosition();
        }
        activeTrackRef.current = nextActive;
        lastPositionSaveRef.current = 0;

        // Set source and load
        audio.src = track.audioUrl;
        audio.load();
        const seedDur = finiteDuration(track.duration);
        if (seedDur > 0) setDuration(seedDur);

        // Apply a pending resume seek once the media has metadata — seeking
        // before loadedmetadata is ignored/throws on some browsers (iOS Safari)
        const resumeAt = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (resumeAt != null && resumeAt > 0) {
            const applySeek = () => {
                audio.removeEventListener('loadedmetadata', applySeek);
                try {
                    // Guard against a saved position past the real duration
                    const dur = audio.duration;
                    audio.currentTime = !isNaN(dur) && dur > 0 ? Math.min(resumeAt, Math.max(0, dur - 1)) : resumeAt;
                } catch { /* start from 0 if the seek fails */ }
            };
            if (audio.readyState >= 1) {
                applySeek();
            } else {
                audio.addEventListener('loadedmetadata', applySeek);
            }
        }

        // Auto-play if isPlaying is true
        if (isPlaying) {
            audio.play().catch(e => console.log('Autoplay blocked:', e.name));
        }

        // Update media session
        updateMediaSession();
    }, [currentPlaylist, currentTrackIndex, nativeAudioEnabled]);

    // Play/pause sync - with recovery for frozen audio (Android WebView kills the element in background)
    useEffect(() => {
        if (nativeAudioEnabled && nativeOwnsPlaybackRef.current) return;

        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        if (isPlaying) {
            const playPromise = audio.play();
            if (playPromise) {
                playPromise.then(() => {
                    // Verify audio is actually progressing after 1.5s
                    const checkTime = audio.currentTime;
                    setTimeout(() => {
                        if (isPlaying && audioRef.current === audio && !audio.paused && audio.currentTime === checkTime && checkTime > 0) {
                            // Audio element is frozen - reload the track
                            console.log('🎵 Audio frozen, reloading track at', checkTime);
                            const src = audio.src;
                            audio.src = src;
                            audio.load();
                            audio.addEventListener('canplay', function resume() {
                                audio.currentTime = checkTime;
                                audio.play().catch(() => {});
                                audio.removeEventListener('canplay', resume);
                            });
                        }
                    }, 1500);
                }).catch(e => {
                    console.log('Play failed:', e.name);
                    // If play fails entirely, try reloading
                    if (currentPlaylist) {
                        const track = currentPlaylist.items[currentTrackIndex];
                        if (track?.audioUrl) {
                            audio.src = track.audioUrl;
                            audio.load();
                            audio.addEventListener('canplay', function retry() {
                                audio.play().catch(() => {});
                                audio.removeEventListener('canplay', retry);
                            });
                        }
                    }
                });
            }
        } else {
            audio.pause();
        }
        
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [isPlaying, nativeAudioEnabled]);

    // Media Session setup with cover image
    const updateMediaSession = useCallback(() => {
        // Native Android player owns lock-screen metadata; don't fight it with HTML Media Session
        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) return;
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
        if (nativeAudioEnabled) return;
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
                if (!currentPlaylist) return;
                if (isShuffleRef.current && shuffleOrderRef.current.length > 0) {
                    const nextPos = shufflePosRef.current + 1;
                    if (nextPos < shuffleOrderRef.current.length) {
                        shufflePosRef.current = nextPos;
                        setCurrentTrackIndex(shuffleOrderRef.current[nextPos]);
                    }
                    return;
                }
                if (currentTrackIndex < currentPlaylist.items.length - 1) {
                    setCurrentTrackIndex(prev => prev + 1);
                }
            });

            safeMediaSessionAction('previoustrack', () => {
                if (isShuffleRef.current && shuffleOrderRef.current.length > 0) {
                    const prevPos = shufflePosRef.current - 1;
                    if (prevPos >= 0) {
                        shufflePosRef.current = prevPos;
                        setCurrentTrackIndex(shuffleOrderRef.current[prevPos]);
                    }
                    return;
                }
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
    }, [currentPlaylist, currentTrackIndex, safeMediaSessionAction, nativeAudioEnabled]);

    // Despia native player events (Android lock screen / background audio)
    useEffect(() => {
        if (!isNativeAudioAvailable()) return;

        const applyNativeIndex = (evt: NativeAudioEvent) => {
            const nativeIndex = evt.state?.current_index;
            if (typeof nativeIndex !== 'number' || nativeIndex < 0) return;

            const queued = evt.state?.queue?.[nativeIndex];
            const originalFromMeta = queued?.metadata?.originalIndex;
            const originalIndex =
                typeof originalFromMeta === 'number'
                    ? originalFromMeta
                    : (shuffleOrderRef.current.length > 0
                        ? shuffleOrderRef.current[nativeIndex]
                        : nativeIndex);

            if (typeof originalIndex === 'number' && originalIndex !== currentTrackIndexRef.current) {
                currentTrackIndexRef.current = originalIndex;
                setCurrentTrackIndex(originalIndex);
            }
            if (shuffleOrderRef.current.length > 0) {
                shufflePosRef.current = nativeIndex;
            }

            const playlist = currentPlaylistRef.current;
            const track = playlist?.items[originalIndex];
            if (playlist && track) {
                activeTrackRef.current = {
                    playlistId: playlist._id,
                    itemId: (track as { _id?: string })?._id,
                };
            }
            return typeof originalIndex === 'number' ? originalIndex : undefined;
        };

        const applyPendingSeek = () => {
            const seekTo = pendingNativeSeekRef.current;
            if (seekTo != null && seekTo > 0) {
                pendingNativeSeekRef.current = null;
                despiaAudioPlayer.seek(seekTo);
            }
        };

        const recordNativeTrackPlay = (originalIndex: number) => {
            const playlist = currentPlaylistRef.current;
            if (!playlist) return;
            const track = playlist.items[originalIndex];
            const trackId = (track as { _id?: string })?._id;
            const trackDuration = track?.duration || 0;
            import('../services/playEventService').then(({ playEventService }) => {
                playEventService.recordEpisodePlay(playlist._id, originalIndex, trackId, undefined, trackDuration);
            }).catch(() => {});
        };

        const onNativeEvent = (evt: NativeAudioEvent) => {
            if (isUnknownNativeAudioCommand(evt.error)) {
                console.warn('🎵 Native audio unavailable in this build, falling back to HTML audio');
                nativeOwnsPlaybackRef.current = false;
                nativeConfirmedRef.current = false;
                if (nativeFallbackTimerRef.current) clearTimeout(nativeFallbackTimerRef.current);
                setNativeAudioEnabled(false);
                return;
            }

            if (evt.type === 'play' || evt.type === 'playing' || evt.type === 'feed_updated' || evt.type === 'state' || evt.type === 'position') {
                nativeConfirmedRef.current = true;
                if (nativeFallbackTimerRef.current) {
                    clearTimeout(nativeFallbackTimerRef.current);
                    nativeFallbackTimerRef.current = null;
                }
            }

            if (evt.type === 'position') {
                const pos = evt.positionSeconds ?? 0;
                const reportedDur = finiteDuration(evt.durationSeconds);
                const fallbackDur = finiteDuration(currentPlaylistRef.current?.items[currentTrackIndexRef.current]?.duration);
                const dur = reportedDur || nativeDurationRef.current || fallbackDur;
                const seekTarget = lastUserSeekToRef.current;
                if (seekTarget != null && Date.now() - lastUserSeekAtRef.current < 1500 && Math.abs(pos - seekTarget) > 1.25) {
                    if (!seekRetryUsedRef.current && Date.now() - lastUserSeekAtRef.current > 350) {
                        seekRetryUsedRef.current = true;
                        despiaAudioPlayer.seek(seekTarget);
                    }
                    return;
                }
                if (seekTarget != null && Math.abs(pos - seekTarget) <= 1.25) {
                    lastUserSeekToRef.current = null;
                }
                nativePositionRef.current = pos;
                if (dur > 0) nativeDurationRef.current = dur;
                setCurrentTime(pos);
                if (dur > 0) {
                    setDuration(dur);
                    setProgress((pos / dur) * 100);
                }

                const now = Date.now();
                if (lastListeningTimeRef.current > 0 && evt.status === 'playing') {
                    const deltaSeconds = (now - lastListeningTimeRef.current) / 1000;
                    if (deltaSeconds > 0 && deltaSeconds < 5) {
                        listeningTimeAccumulatorRef.current += deltaSeconds;
                        if (listeningTimeAccumulatorRef.current >= 10) {
                            activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                            listeningTimeAccumulatorRef.current = 0;
                        }
                        if (isPreviewModeRef.current) {
                            previewTimeAccumulator.current += deltaSeconds;
                            const remaining = Math.max(0, AUDIO_PREVIEW_SECONDS - previewTimeAccumulator.current);
                            setPreviewTimeRemaining(Math.floor(remaining));
                            if (previewTimeAccumulator.current >= AUDIO_PREVIEW_SECONDS) {
                                console.log('🎵 Preview limit reached - pausing native playback');
                                despiaAudioPlayer.pause();
                                setIsPlaying(false);
                                setPreviewLimitReached(true);
                            }
                        }
                    }
                }
                lastListeningTimeRef.current = now;

                if (Math.abs(pos - lastPositionSaveRef.current) >= 5) {
                    lastPositionSaveRef.current = pos;
                    persistPlaybackPosition();
                }

                if (typeof dur === 'number' && dur > 0 && pos - lastEngagementUpdateRef.current >= ENGAGEMENT_UPDATE_INTERVAL) {
                    lastEngagementUpdateRef.current = pos;
                    const playlist = currentPlaylistRef.current;
                    const idx = currentTrackIndexRef.current;
                    if (playlist) {
                        import('../services/playEventService').then(({ playEventService }) => {
                            playEventService.updateEpisodeEngagement(playlist._id, idx, pos, dur);
                        }).catch(() => {});
                    }
                }
                return;
            }

            const status = evt.state?.status;
            if (nativeOwnsPlaybackRef.current) {
                if (status === 'playing' || status === 'buffering') {
                    setIsPlaying(true);
                } else if (status === 'paused' || evt.type === 'pause') {
                    setIsPlaying(false);
                }
            }

            if (typeof evt.state?.position_seconds === 'number') {
                nativePositionRef.current = evt.state.position_seconds;
                setCurrentTime(evt.state.position_seconds);
            }
            if (typeof evt.state?.duration_seconds === 'number' && evt.state.duration_seconds > 0) {
                nativeDurationRef.current = evt.state.duration_seconds;
                setDuration(evt.state.duration_seconds);
            }

            switch (evt.type) {
                case 'seek': {
                    lastUserSeekToRef.current = null;
                    const pos = evt.state?.position_seconds;
                    if (typeof pos === 'number' && Number.isFinite(pos)) {
                        nativePositionRef.current = pos;
                        setCurrentTime(pos);
                        const dur = finiteDuration(evt.state?.duration_seconds) || nativeDurationRef.current;
                        if (dur > 0) setProgress((pos / dur) * 100);
                    }
                    break;
                }
                case 'play':
                case 'playing':
                    applyNativeIndex(evt);
                    applyPendingSeek();
                    break;
                case 'pause':
                    persistPlaybackPosition();
                    if (listeningTimeAccumulatorRef.current > 0) {
                        activityTrackingService.trackAudioListeningTime(Math.floor(listeningTimeAccumulatorRef.current));
                        listeningTimeAccumulatorRef.current = 0;
                    }
                    lastListeningTimeRef.current = 0;
                    break;
                case 'next':
                case 'prev': {
                    const prevIdx = currentTrackIndexRef.current;
                    const nextIdx = applyNativeIndex(evt);
                    lastEngagementUpdateRef.current = 0;
                    lastPositionSaveRef.current = 0;
                    if (typeof nextIdx === 'number' && nextIdx !== prevIdx) {
                        recordNativeTrackPlay(nextIdx);
                    }
                    break;
                }
                case 'ended': {
                    persistPlaybackPosition();
                    if (activeTrackRef.current) {
                        playHistoryService.clearPosition(activeTrackRef.current.playlistId);
                    }
                    setIsPlaying(false);
                    break;
                }
                case 'terminated': {
                    persistPlaybackPosition();
                    const owned = nativeOwnsPlaybackRef.current;
                    nativeOwnsPlaybackRef.current = false;
                    try { localStorage.removeItem(NATIVE_PLAYLIST_SNAPSHOT_KEY); } catch { /* ignore */ }
                    // closePlayer / HTML fallback already released native — don't wipe in-app player
                    if (!owned || !currentPlaylistRef.current) break;
                    currentPlaylistRef.current = null;
                    setCurrentPlaylist(null);
                    setCurrentTrackIndex(0);
                    setIsPlaying(false);
                    setProgress(0);
                    setCurrentTime(0);
                    setDuration(0);
                    break;
                }
                case 'state': {
                    // Rehydrate UI after WebView reload — native playback may still be running
                    if (currentPlaylistRef.current) {
                        applyNativeIndex(evt);
                        break;
                    }
                    const queue = evt.state?.queue;
                    if (!queue?.length || (status !== 'playing' && status !== 'paused' && status !== 'buffering')) {
                        break;
                    }
                    try {
                        const raw = localStorage.getItem(NATIVE_PLAYLIST_SNAPSHOT_KEY);
                        if (!raw) break;
                        const snap = JSON.parse(raw) as {
                            playlist: Playlist;
                            isPreviewMode?: boolean;
                            isShuffle?: boolean;
                            shuffleOrder?: number[];
                            shufflePos?: number;
                        };
                        if (!snap?.playlist?._id) break;
                        nativeOwnsPlaybackRef.current = true;
                        setNativeAudioEnabled(true);
                        setCurrentPlaylist(snap.playlist);
                        currentPlaylistRef.current = snap.playlist;
                        if (snap.isShuffle && Array.isArray(snap.shuffleOrder)) {
                            isShuffleRef.current = true;
                            setIsShuffle(true);
                            shuffleOrderRef.current = snap.shuffleOrder;
                            shufflePosRef.current = snap.shufflePos || 0;
                        }
                        if (snap.isPreviewMode) {
                            setIsPreviewMode(true);
                            isPreviewModeRef.current = true;
                        }
                        applyNativeIndex(evt);
                        setIsPlaying(status === 'playing' || status === 'buffering');
                        console.log('🎵 Restored native audio session after reload:', snap.playlist.title);
                    } catch {
                        /* ignore corrupt snapshot */
                    }
                    break;
                }
                case 'track_error': {
                    console.warn('🎵 Native track error:', evt.error);
                    despiaAudioPlayer.next();
                    break;
                }
                default:
                    break;
            }
        };

        const unsubscribe = subscribeNativeAudio(onNativeEvent);
        despiaAudioPlayer.sync();
        return unsubscribe;
    }, [persistPlaybackPosition]);

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
    // resumeFromSeconds: optional position to seek to once the track loads —
    // used by the Continue Listening affordances; other entry points omit it
    // and start from the beginning as before.
    const playPlaylist = useCallback((playlist: Playlist, startIndex: number = 0, isSubscribed: boolean = true, resumeFromSeconds?: number) => {
        console.log('🎵 playPlaylist called:', {
            title: playlist.title,
            isMembersOnly: playlist.isMembersOnly,
            isSubscribed: isSubscribed,
            willBePreviewMode: !isSubscribed
        });

        const safeStart = Math.max(0, Math.min(startIndex, Math.max(0, playlist.items.length - 1)));

        // Stash (or clear) the resume seek for the load-track effect to apply
        pendingSeekRef.current = resumeFromSeconds && resumeFromSeconds > 0 ? resumeFromSeconds : null;

        setCurrentPlaylist(playlist);
        setCurrentTrackIndex(safeStart);
        setIsPlaying(true);

        if (isShuffleRef.current && playlist.items.length > 0) {
            shuffleOrderRef.current = buildShuffleOrder(playlist.items.length, safeStart);
            shufflePosRef.current = 0;
        } else {
            shuffleOrderRef.current = [];
            shufflePosRef.current = 0;
        }
        
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
            // Subscribed: reset preview state to prevent stale limits from a previous preview session
            previewTimeAccumulator.current = 0;
            setPreviewTimeRemaining(AUDIO_PREVIEW_SECONDS);
            setPreviewLimitReached(false);
        }
        
        // Reset engagement tracking for new track
        lastEngagementUpdateRef.current = 0;

        // Track analytics
        const playlistId = playlist._id;
        const track = playlist.items[safeStart];
        const trackId = (track as any)?._id;
        const trackDuration = track?.duration || 0; // Get track duration in seconds

        if (playlistId) {
            playHistoryService.recordPlay(playlistId, trackId);
            analyticsService.playlistPlay(playlistId, playlist.title);
            if (track) {
                activityTrackingService.trackSongPlayed(trackId || `${playlistId}_${safeStart}`, track.title);
                incrementActivityCounter('song');
            }
            if (trackId) {
                ApiService.incrementItemPlayCount(playlistId, trackId);
            } else {
                ApiService.incrementPlaylistPlayCount(playlistId);
            }
            
            // Record play event for real-time trending (with total duration for engagement tracking)
            import('../services/playEventService').then(({ playEventService }) => {
                playEventService.recordEpisodePlay(playlistId, safeStart, trackId, undefined, trackDuration);
            }).catch(() => {});
        }

        currentPlaylistRef.current = playlist;
        currentTrackIndexRef.current = safeStart;
        isPlayingRef.current = true;
        isPreviewModeRef.current = isPremiumPreview;
        activeTrackRef.current = { playlistId: playlist._id, itemId: trackId };

        if (nativeAudioEnabledRef.current) {
            const order = isShuffleRef.current && shuffleOrderRef.current.length > 0
                ? shuffleOrderRef.current
                : undefined;
            startNativeQueue(playlist, safeStart, resumeFromSeconds, order);
        }
    }, [startNativeQueue]);

    const togglePlayPause = useCallback(() => {
        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) {
            if (isPlayingRef.current) {
                despiaAudioPlayer.pause();
            } else {
                despiaAudioPlayer.play();
            }
        }
        setIsPlaying(prev => !prev);
    }, []);

    const toggleShuffle = useCallback(() => {
        const next = !isShuffleRef.current;
        isShuffleRef.current = next;
        setIsShuffle(next);
        const playlist = currentPlaylistRef.current;
        const idx = currentTrackIndexRef.current;
        if (next) {
            if (playlist && playlist.items.length > 0) {
                shuffleOrderRef.current = buildShuffleOrder(playlist.items.length, idx);
                shufflePosRef.current = 0;
            }
        } else {
            shuffleOrderRef.current = [];
            shufflePosRef.current = 0;
        }
        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current && playlist) {
            const resumeAt = nativePositionRef.current;
            const order = next && shuffleOrderRef.current.length > 0 ? shuffleOrderRef.current : undefined;
            startNativeQueue(playlist, idx, resumeAt, order);
        }
    }, [startNativeQueue]);

    const nextTrack = useCallback(() => {
        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) {
            despiaAudioPlayer.next();
            return;
        }
        if (!currentPlaylist) return;
        if (isShuffle && shuffleOrderRef.current.length > 0) {
            const nextPos = shufflePosRef.current + 1;
            if (nextPos < shuffleOrderRef.current.length) {
                shufflePosRef.current = nextPos;
                setCurrentTrackIndex(shuffleOrderRef.current[nextPos]);
                setIsPlaying(true);
            }
            return;
        }
        if (currentTrackIndex < currentPlaylist.items.length - 1) {
            setCurrentTrackIndex(prev => prev + 1);
            setIsPlaying(true);
        }
    }, [currentPlaylist, currentTrackIndex, isShuffle]);

    const prevTrack = useCallback(() => {
        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) {
            despiaAudioPlayer.prev();
            return;
        }
        if (isShuffle && shuffleOrderRef.current.length > 0) {
            const prevPos = shufflePosRef.current - 1;
            if (prevPos >= 0) {
                shufflePosRef.current = prevPos;
                setCurrentTrackIndex(shuffleOrderRef.current[prevPos]);
                setIsPlaying(true);
            }
            return;
        }
        if (currentTrackIndex > 0) {
            setCurrentTrackIndex(prev => prev - 1);
            setIsPlaying(true);
        }
    }, [currentTrackIndex, isShuffle]);

    const resolveSeekDuration = useCallback(() => {
        if (nativeOwnsPlaybackRef.current) {
            return finiteDuration(nativeDurationRef.current)
                || finiteDuration(currentPlaylistRef.current?.items[currentTrackIndexRef.current]?.duration);
        }
        return finiteDuration(audioRef.current?.duration)
            || finiteDuration(currentPlaylistRef.current?.items[currentTrackIndexRef.current]?.duration);
    }, []);

    const seek = useCallback((time: number) => {
        if (!Number.isFinite(time)) return;
        const dur = resolveSeekDuration();
        const clamped = dur > 0 ? Math.max(0, Math.min(time, Math.max(0, dur - 0.05))) : Math.max(0, time);
        lastUserSeekAtRef.current = Date.now();
        lastUserSeekToRef.current = clamped;
        seekRetryUsedRef.current = false;
        if (dur > 0) setProgress((clamped / dur) * 100);
        setCurrentTime(clamped);

        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) {
            nativePositionRef.current = clamped;
            despiaAudioPlayer.seek(clamped);
            return;
        }
        const audio = audioRef.current;
        if (!audio) return;
        try {
            audio.currentTime = clamped;
        } catch {
            /* some WebViews throw if the resource is not yet seekable */
        }
        if (Math.abs(audio.currentTime - clamped) > 0.5 && audio.readyState < 2) {
            const retry = () => {
                try { audio.currentTime = clamped; } catch { /* ignore */ }
                audio.removeEventListener('canplay', retry);
            };
            audio.addEventListener('canplay', retry);
        }
    }, [resolveSeekDuration]);

    const closePlayer = useCallback(() => {
        // Keep the resume point when the kid dismisses the player mid-episode
        persistPlaybackPosition();
        activeTrackRef.current = null;
        pendingSeekRef.current = null;

        setIsPlaying(false);
        setCurrentPlaylist(null);
        setCurrentTrackIndex(0);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        shuffleOrderRef.current = [];
        shufflePosRef.current = 0;
        currentPlaylistRef.current = null;
        isPlayingRef.current = false;

        if (nativeAudioEnabledRef.current && nativeOwnsPlaybackRef.current) {
            nativeOwnsPlaybackRef.current = false;
            if (nativeFallbackTimerRef.current) {
                clearTimeout(nativeFallbackTimerRef.current);
                nativeFallbackTimerRef.current = null;
            }
            try { localStorage.removeItem(NATIVE_PLAYLIST_SNAPSHOT_KEY); } catch { /* ignore */ }
            despiaAudioPlayer.terminate();
        }

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

    const toggleMusic = useCallback(() => {
        setMusicEnabled((prev) => !prev);
    }, []);
    const toggleSfx = useCallback(() => setSfxEnabled((prev) => !prev), []);
    const setMusicVolume = useCallback((v: number) => {
        const clamped = Math.min(1, Math.max(0, v));
        setMusicVolumeState(clamped);
    }, []);
    const setMusicPaused = useCallback((paused: boolean) => {
        setContentMusicPaused(paused);
    }, []);
    const setGameMode = useCallback((active: boolean, _type?: 'default' | 'workout') => {
        setGameModeActive(active);
    }, []);
    const acquireAppAmbient = useCallback(() => {
        setAmbientHolders((n) => n + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            setAmbientHolders((n) => Math.max(0, n - 1));
        };
    }, []);

    return (
        <AudioContext.Provider value={{
            musicEnabled, sfxEnabled, musicVolume, toggleMusic, toggleSfx, setMusicVolume,
            playClick, playBack, playSuccess, playTab, setGameMode, setMusicPaused, acquireAppAmbient,
            currentPlaylist, currentTrackIndex, isPlaying, isShuffle, progress, currentTime, duration,
            playPlaylist, togglePlayPause, toggleShuffle, nextTrack, prevTrack, seek, closePlayer,
            isPreviewMode, previewLimitReached, previewTimeRemaining, dismissPreviewLimit
        }}>
            {children}
        </AudioContext.Provider>
    );
};

/**
 * Request the shared app-background ambient loop while a page is mounted.
 * Respects Settings → Background Music (`musicEnabled`), content pause, game mode,
 * and the global playlist player (won't fight MiniPlayer).
 */
export function useAppAmbientMusic(active = true) {
    const { acquireAppAmbient } = useAudio();
    useEffect(() => {
        if (!active) return;
        return acquireAppAmbient();
    }, [active, acquireAppAmbient]);
}
