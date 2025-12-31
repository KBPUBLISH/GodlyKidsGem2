import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Radio, Music, Shuffle, RefreshCw, Mic2, Loader2, BookOpen } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

// Crossfade settings
const CROSSFADE_DURATION = 5000; // 5 seconds crossfade
const CROSSFADE_CHECK_INTERVAL = 100; // Check every 100ms

interface RadioTrack {
    _id: string;
    title: string;
    artist?: string;
    audioUrl: string;
    coverImage?: string;
    duration?: number;
    category: string;
    rotation: string;
    description?: string; // For context-aware hosting
}

interface RadioHost {
    _id: string;
    name: string;
    avatarUrl?: string;
    personality: string;
}

interface HostBreakData {
    hostId: string;
    hostName: string;
    hostAvatar?: string;
    script: string;
    audioUrl: string;
    duration: number;
}

interface QueueItem {
    type: 'song' | 'host_break';
    track?: RadioTrack;
    hostBreak?: HostBreakData;
    pendingHostBreak?: {
        nextSong: RadioTrack;
        previousSong?: RadioTrack;
        contentType?: 'song' | 'story_intro' | 'story_outro' | 'devotional' | 'station_intro';
        contentDescription?: string;
    };
}

interface RadioStation {
    name: string;
    tagline: string;
    coverImageUrl?: string;
    hostBreakFrequency?: number;
}

const RadioPreview: React.FC = () => {
    const [station, setStation] = useState<RadioStation | null>(null);
    const [tracks, setTracks] = useState<RadioTrack[]>([]);
    const [hosts, setHosts] = useState<RadioHost[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generatingHostBreak, setGeneratingHostBreak] = useState(false);
    const [hostBreaksEnabled, setHostBreaksEnabled] = useState(true);
    const [crossfadeEnabled, setCrossfadeEnabled] = useState(true);
    const [isCrossfading, setIsCrossfading] = useState(false);
    
    // Audio refs for crossfade (current and next)
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const nextAudioRef = useRef<HTMLAudioElement | null>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const crossfadeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const crossfadeStarted = useRef(false);
    
    // Ref to track current index (avoids stale closure issues)
    const currentIndexRef = useRef(currentIndex);
    const queueRef = useRef(queue);
    
    // Keep refs in sync with state
    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);
    
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    useEffect(() => {
        fetchData();
        return () => {
            cleanupAudio();
        };
    }, []);

    const cleanupAudio = () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }
        if (nextAudioRef.current) {
            nextAudioRef.current.pause();
            nextAudioRef.current = null;
        }
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
        if (crossfadeInterval.current) {
            clearInterval(crossfadeInterval.current);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [stationRes, libraryRes, hostsRes] = await Promise.all([
                axios.get(`${API_URL}/radio/station`),
                axios.get(`${API_URL}/radio/library?enabled=true`),
                axios.get(`${API_URL}/radio/hosts`),
            ]);
            
            setStation(stationRes.data);
            setTracks(libraryRes.data.tracks || []);
            const enabledHosts = (hostsRes.data || []).filter((h: RadioHost) => h);
            setHosts(enabledHosts);
            
            const libraryTracks = libraryRes.data.tracks || [];
            
            if (libraryTracks.length > 0) {
                buildQueue(libraryTracks, enabledHosts.length > 0);
            }
        } catch (err: unknown) {
            console.error('Error fetching data:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load radio data';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const buildQueue = (libraryTracks: RadioTrack[], includeHostBreaks: boolean = true) => {
        const weightedTracks: RadioTrack[] = [];
        libraryTracks.forEach(track => {
            const weight = track.rotation === 'high' ? 3 : track.rotation === 'medium' ? 2 : 1;
            for (let i = 0; i < weight; i++) {
                weightedTracks.push(track);
            }
        });
        
        const shuffled = weightedTracks.sort(() => Math.random() - 0.5);
        
        const uniqueQueue: RadioTrack[] = [];
        shuffled.forEach(track => {
            if (uniqueQueue.length === 0 || uniqueQueue[uniqueQueue.length - 1]._id !== track._id) {
                uniqueQueue.push(track);
            }
        });
        
        const queueItems: QueueItem[] = [];
        const hostBreakFrequency = station?.hostBreakFrequency || 3;
        
        // Helper to determine if a track is a story/audiobook
        // Check category OR title keywords for better auto-detection
        const storyKeywords = ['story', 'audiobook', 'episode', 'chapter', 'tale', 'adventure', 'book'];
        const isStoryContent = (track: RadioTrack) => {
            if (track.category === 'story' || track.category === 'kids') return true;
            // Also check title for story keywords
            const titleLower = track.title.toLowerCase();
            return storyKeywords.some(keyword => titleLower.includes(keyword));
        };
        
        const isDevotional = (track: RadioTrack) => 
            track.category === 'devotional' || track.title.toLowerCase().includes('devotion');
        
        // Add station intro at the very beginning
        if (includeHostBreaks && hostBreaksEnabled && hosts.length > 0 && uniqueQueue.length > 0) {
            queueItems.push({
                type: 'host_break',
                pendingHostBreak: {
                    nextSong: uniqueQueue[0],
                    contentType: 'station_intro',
                }
            });
        }
        
        uniqueQueue.slice(0, 15).forEach((track, index) => {
            const previousTrack = index > 0 ? uniqueQueue[index - 1] : undefined;
            const isStory = isStoryContent(track);
            const wasStory = previousTrack && isStoryContent(previousTrack);
            
            if (includeHostBreaks && hostBreaksEnabled && hosts.length > 0) {
                // Add story outro after a story ends (before next non-story)
                if (wasStory && !isStory && previousTrack) {
                    queueItems.push({
                        type: 'host_break',
                        pendingHostBreak: {
                            nextSong: previousTrack, // Reference the story that just ended
                            contentType: 'story_outro',
                            contentDescription: previousTrack.description, // Use description for context
                        }
                    });
                }
                
                // Add story intro before a story
                if (isStory) {
                    queueItems.push({
                        type: 'host_break',
                        pendingHostBreak: {
                            nextSong: track,
                            previousSong: previousTrack,
                            contentType: 'story_intro',
                            contentDescription: track.description, // Use description for story teaser
                        }
                    });
                }
                // Add devotional intro
                else if (isDevotional(track)) {
                    queueItems.push({
                        type: 'host_break',
                        pendingHostBreak: {
                            nextSong: track,
                            previousSong: previousTrack,
                            contentType: 'devotional',
                            contentDescription: track.description,
                        }
                    });
                }
                // Regular host break every N songs (only for regular songs)
                else if (index > 0 && index % hostBreakFrequency === 0) {
                    queueItems.push({
                        type: 'host_break',
                        pendingHostBreak: {
                            nextSong: track,
                            previousSong: previousTrack,
                            contentType: 'song',
                        }
                    });
                }
            }
            
            // Add the actual track
            queueItems.push({
                type: 'song',
                track
            });
        });
        
        setQueue(queueItems);
        
        // Pre-generate host breaks in the background
        preGenerateHostBreaks(queueItems);
    };

    // Pre-generate host break TTS audio for smoother playback
    const preGenerateHostBreaks = async (queueItems: QueueItem[]) => {
        const hostBreakItems = queueItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.type === 'host_break' && item.pendingHostBreak && !item.hostBreak);
        
        // Generate host breaks sequentially to avoid overwhelming the API
        for (const { item, index } of hostBreakItems) {
            if (!item.pendingHostBreak) continue;
            
            try {
                console.log(`📻 Pre-generating host break ${index}: ${item.pendingHostBreak.contentType}`);
                
                const hostBreakData = await generateHostBreakSilent(
                    item.pendingHostBreak.nextSong,
                    item.pendingHostBreak.previousSong,
                    item.pendingHostBreak.contentType || 'song',
                    item.pendingHostBreak.contentDescription
                );
                
                if (hostBreakData) {
                    // Update the queue with the generated host break
                    setQueue(prevQueue => {
                        const newQueue = [...prevQueue];
                        if (newQueue[index] && newQueue[index].type === 'host_break') {
                            newQueue[index] = { 
                                ...newQueue[index], 
                                hostBreak: hostBreakData, 
                                pendingHostBreak: undefined 
                            };
                        }
                        return newQueue;
                    });
                    console.log(`✅ Pre-generated host break ${index}`);
                }
            } catch (err) {
                console.error(`Failed to pre-generate host break ${index}:`, err);
            }
        }
    };

    // Silent version that doesn't update the main loading state
    const generateHostBreakSilent = async (
        nextSong: RadioTrack, 
        previousSong?: RadioTrack,
        contentType: string = 'song',
        contentDescription?: string
    ): Promise<HostBreakData | undefined> => {
        try {
            const targetDuration = contentType === 'station_intro' ? 25 :
                                   contentType === 'story_intro' ? 20 : 
                                   contentType === 'story_outro' ? 18 : 15;
            
            const response = await axios.post(`${API_URL}/radio/host-break/generate`, {
                nextSongTitle: nextSong.title,
                nextSongArtist: nextSong.artist,
                previousSongTitle: previousSong?.title,
                previousSongArtist: previousSong?.artist,
                targetDuration,
                contentType,
                contentDescription,
                contentCategory: nextSong.category
            });
            
            return response.data.hostBreak;
        } catch (err) {
            console.error('Failed to generate host break:', err);
            return undefined;
        }
    };

    const getCurrentItem = () => queue[currentIndex];

    const generateHostBreak = async (
        nextSong: RadioTrack, 
        previousSong?: RadioTrack,
        contentType: string = 'song',
        contentDescription?: string
    ): Promise<HostBreakData | undefined> => {
        try {
            setGeneratingHostBreak(true);
            
            // Adjust duration based on content type
            const targetDuration = contentType === 'station_intro' ? 25 :
                                   contentType === 'story_intro' ? 20 : 
                                   contentType === 'story_outro' ? 18 : 15;
            
            const response = await axios.post(`${API_URL}/radio/host-break/generate`, {
                nextSongTitle: nextSong.title,
                nextSongArtist: nextSong.artist,
                previousSongTitle: previousSong?.title,
                previousSongArtist: previousSong?.artist,
                targetDuration,
                contentType,
                contentDescription,
                contentCategory: nextSong.category
            });
            
            return response.data.hostBreak;
        } catch (err) {
            console.error('Failed to generate host break:', err);
            return undefined;
        } finally {
            setGeneratingHostBreak(false);
        }
    };

    // Smooth fade function
    const fadeAudio = useCallback((audio: HTMLAudioElement, fromVol: number, toVol: number, durationMs: number, onComplete?: () => void) => {
        const startTime = Date.now();
        const volumeDiff = toVol - fromVol;
        
        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            
            // Ease-in-out curve for smoother fade
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            const newVolume = fromVol + (volumeDiff * easeProgress);
            audio.volume = Math.max(0, Math.min(1, newVolume));
            
            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                if (onComplete) onComplete();
            }
        };
        
        requestAnimationFrame(fade);
    }, []);

    // Start crossfade to next track
    const startCrossfade = useCallback(async (nextIndex: number) => {
        if (crossfadeStarted.current || isCrossfading) return;
        crossfadeStarted.current = true;
        setIsCrossfading(true);

        const nextItem = queue[nextIndex];
        if (!nextItem) {
            crossfadeStarted.current = false;
            setIsCrossfading(false);
            return;
        }

        // For host breaks, don't crossfade - just fade out current
        if (nextItem.type === 'host_break') {
            if (currentAudioRef.current) {
                fadeAudio(currentAudioRef.current, currentAudioRef.current.volume, 0, CROSSFADE_DURATION / 2, () => {
                    currentAudioRef.current?.pause();
                    crossfadeStarted.current = false;
                    setIsCrossfading(false);
                    playItem(nextIndex);
                });
            }
            return;
        }

        // Get next song URL
        const nextUrl = nextItem.track?.audioUrl;
        if (!nextUrl) {
            crossfadeStarted.current = false;
            setIsCrossfading(false);
            handleNext();
            return;
        }

        // Create and prepare next audio
        const nextAudio = new Audio(nextUrl);
        nextAudio.volume = 0;
        nextAudioRef.current = nextAudio;

        try {
            // Start playing next audio at volume 0
            await nextAudio.play();
            
            // Fade out current, fade in next
            if (currentAudioRef.current) {
                fadeAudio(currentAudioRef.current, currentAudioRef.current.volume, 0, CROSSFADE_DURATION);
            }
            fadeAudio(nextAudio, 0, isMuted ? 0 : volume, CROSSFADE_DURATION, () => {
                // Crossfade complete - swap audio refs
                if (currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    currentAudioRef.current.onended = null; // Remove old handler
                }
                currentAudioRef.current = nextAudio;
                nextAudioRef.current = null;
                
                setCurrentIndex(nextIndex);
                currentIndexRef.current = nextIndex;
                setDuration(nextAudio.duration || 0);
                crossfadeStarted.current = false;
                setIsCrossfading(false);
                
                // Set up ended handler for new current audio
                nextAudio.onended = () => handleNext();
            });
        } catch (err) {
            console.error('Crossfade failed:', err);
            crossfadeStarted.current = false;
            setIsCrossfading(false);
            handleNext();
        }
    }, [queue, volume, isMuted, fadeAudio, isCrossfading]);

    const playItem = async (index: number) => {
        const item = queueRef.current[index];
        if (!item) return;

        crossfadeStarted.current = false;
        setCurrentIndex(index);
        currentIndexRef.current = index;

        // Handle host break
        if (item.type === 'host_break') {
            let hostBreakData = item.hostBreak;
            
            if (!hostBreakData && item.pendingHostBreak) {
                hostBreakData = await generateHostBreak(
                    item.pendingHostBreak.nextSong,
                    item.pendingHostBreak.previousSong,
                    item.pendingHostBreak.contentType || 'song',
                    item.pendingHostBreak.contentDescription
                );
                
                if (hostBreakData) {
                    const newQueue = [...queue];
                    newQueue[index] = { ...item, hostBreak: hostBreakData, pendingHostBreak: undefined };
                    setQueue(newQueue);
                } else {
                    handleNext();
                    return;
                }
            }

            if (!hostBreakData?.audioUrl) {
                handleNext();
                return;
            }

            // Fade out current song before host break
            if (currentAudioRef.current && currentAudioRef.current.volume > 0) {
                fadeAudio(currentAudioRef.current, currentAudioRef.current.volume, 0, 1000, async () => {
                    currentAudioRef.current?.pause();
                    await playAudio(hostBreakData!.audioUrl, false); // No crossfade for host breaks
                });
            } else {
                await playAudio(hostBreakData.audioUrl, false);
            }
            return;
        }

        // Handle song
        if (item.type === 'song' && item.track) {
            const url = item.track.audioUrl;
            if (!url) {
                handleNext();
                return;
            }
            await playAudio(url, true);
        }
    };

    const playAudio = async (url: string, enableCrossfadeCheck: boolean = true) => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
        }

        const audio = new Audio(url);
        audio.volume = isMuted ? 0 : volume;
        currentAudioRef.current = audio;
        
        audio.onloadedmetadata = () => {
            setDuration(audio.duration);
        };

        audio.onended = () => {
            handleNext();
        };

        audio.onerror = () => {
            console.error('Audio error, skipping to next');
            handleNext();
        };

        try {
            await audio.play();
            setIsPlaying(true);
            startProgressTracking(enableCrossfadeCheck);
        } catch (err) {
            console.error('Failed to play:', err);
        }
    };

    const startProgressTracking = (enableCrossfadeCheck: boolean = true) => {
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
        
        progressInterval.current = setInterval(() => {
            if (currentAudioRef.current) {
                const currentTime = currentAudioRef.current.currentTime;
                const totalDuration = currentAudioRef.current.duration;
                setProgress(currentTime);
                
                // Use refs to avoid stale closure values
                const idx = currentIndexRef.current;
                const q = queueRef.current;
                
                // Check if we should start crossfade (for songs only)
                if (
                    enableCrossfadeCheck &&
                    crossfadeEnabled && 
                    !crossfadeStarted.current && 
                    !isCrossfading &&
                    totalDuration > 0 &&
                    totalDuration - currentTime <= CROSSFADE_DURATION / 1000 &&
                    idx + 1 < q.length
                ) {
                    // Check if next item is a song (crossfade) or host break (fade out only)
                    startCrossfade(idx + 1);
                }
            }
        }, CROSSFADE_CHECK_INTERVAL);
    };

    const handlePlayPause = () => {
        if (!currentAudioRef.current && queue.length > 0) {
            playItem(currentIndex);
            return;
        }

        if (currentAudioRef.current) {
            if (isPlaying) {
                currentAudioRef.current.pause();
                setIsPlaying(false);
            } else {
                currentAudioRef.current.play();
                setIsPlaying(true);
                startProgressTracking();
            }
        }
    };

    const handleNext = useCallback(() => {
        crossfadeStarted.current = false;
        const idx = currentIndexRef.current;
        const q = queueRef.current;
        
        if (idx + 1 < q.length) {
            playItem(idx + 1);
        } else {
            // End of queue - rebuild and restart
            buildQueue(tracks, hosts.length > 0);
            setCurrentIndex(0);
            currentIndexRef.current = 0;
            if (isPlaying) {
                setTimeout(() => playItem(0), 100);
            }
        }
    }, [tracks, hosts.length, isPlaying]);

    const handlePrev = () => {
        crossfadeStarted.current = false;
        if (currentIndex > 0) {
            playItem(currentIndex - 1);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (currentAudioRef.current) {
            currentAudioRef.current.currentTime = time;
            setProgress(time);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (currentAudioRef.current) {
            currentAudioRef.current.volume = isMuted ? 0 : vol;
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (currentAudioRef.current) {
            currentAudioRef.current.volume = isMuted ? volume : 0;
        }
    };

    const handleShuffle = () => {
        cleanupAudio();
        setIsPlaying(false);
        setCurrentIndex(0);
        setProgress(0);
        crossfadeStarted.current = false;
        buildQueue(tracks, hosts.length > 0);
    };

    const toggleHostBreaks = () => {
        setHostBreaksEnabled(!hostBreaksEnabled);
        cleanupAudio();
        setIsPlaying(false);
        setCurrentIndex(0);
        setProgress(0);
        buildQueue(tracks, !hostBreaksEnabled && hosts.length > 0);
    };

    const toggleCrossfade = () => {
        setCrossfadeEnabled(!crossfadeEnabled);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentItem = getCurrentItem();
    const isHostBreak = currentItem?.type === 'host_break';

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl p-8 text-white flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl p-8 text-white min-h-[400px]">
                <div className="text-center">
                    <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-red-300 mb-4">{error}</p>
                    <button
                        onClick={fetchData}
                        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (tracks.length === 0) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl p-8 text-white min-h-[400px]">
                <div className="text-center">
                    <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-bold mb-2">No Music in Library</h3>
                    <p className="text-white/70 mb-4">Add songs to your Radio Library to start playing!</p>
                    <a
                        href="/radio/library"
                        className="inline-block bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg"
                    >
                        Go to Music Library
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Crossfade indicator */}
            {isCrossfading && (
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white flex items-center gap-2 z-20">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Crossfading...
                </div>
            )}

            {/* Station Header */}
            <div className="p-6 text-white text-center border-b border-white/10">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <Radio className="w-5 h-5 text-red-400 animate-pulse" />
                    <span className="text-sm font-medium text-red-300">LIVE</span>
                </div>
                <h2 className="text-2xl font-bold">{station?.name || 'Praise Station Radio'}</h2>
                <p className="text-white/70 text-sm">{station?.tagline || 'Uplifting music for the whole family'}</p>
            </div>

            {/* Now Playing */}
            <div className="p-8 relative">
                {generatingHostBreak && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-2xl">
                        <div className="text-center text-white">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            <p className="text-sm">Generating host break...</p>
                        </div>
                    </div>
                )}
                
                <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Album Art / Host Avatar */}
                    <div className={`w-48 h-48 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 transition-all duration-500 ${
                        isHostBreak ? 'bg-gradient-to-br from-yellow-500 to-orange-600' : 'bg-black/30'
                    } ${isCrossfading ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
                        {isHostBreak ? (
                            <div className="w-full h-full flex items-center justify-center">
                                {currentItem?.hostBreak?.hostAvatar ? (
                                    <img
                                        src={currentItem.hostBreak.hostAvatar}
                                        alt={currentItem.hostBreak.hostName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Mic2 className="w-20 h-20 text-white" />
                                )}
                            </div>
                        ) : currentItem?.track?.coverImage ? (
                            <img
                                src={currentItem.track.coverImage}
                                alt={currentItem.track.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-20 h-20 text-white/30" />
                            </div>
                        )}
                    </div>

                    {/* Track/Host Info */}
                    <div className="flex-1 text-center md:text-left">
                        <div className="mb-1 flex items-center justify-center md:justify-start gap-2">
                            {isHostBreak ? (
                                <>
                                    {currentItem?.pendingHostBreak?.contentType === 'station_intro' ? (
                                        <>
                                            <Radio className="w-4 h-4 text-pink-400" />
                                            <span className="text-xs text-pink-300 uppercase tracking-wider">Welcome to Praise Station!</span>
                                        </>
                                    ) : currentItem?.pendingHostBreak?.contentType === 'story_intro' ? (
                                        <>
                                            <BookOpen className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-purple-300 uppercase tracking-wider">Story Time!</span>
                                        </>
                                    ) : currentItem?.pendingHostBreak?.contentType === 'story_outro' ? (
                                        <>
                                            <BookOpen className="w-4 h-4 text-green-400" />
                                            <span className="text-xs text-green-300 uppercase tracking-wider">Story Reflection</span>
                                        </>
                                    ) : currentItem?.pendingHostBreak?.contentType === 'devotional' ? (
                                        <>
                                            <Mic2 className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs text-blue-300 uppercase tracking-wider">Devotional</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mic2 className="w-4 h-4 text-yellow-400" />
                                            <span className="text-xs text-yellow-300 uppercase tracking-wider">Host Break</span>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Music className="w-4 h-4 text-pink-400" />
                                    <span className="text-xs text-pink-300 uppercase tracking-wider">Now Playing</span>
                                </>
                            )}
                        </div>
                        
                        {isHostBreak ? (
                            <>
                                <h3 className="text-2xl font-bold text-white mb-1">
                                    {currentItem?.hostBreak?.hostName || 'Host'}
                                </h3>
                                <p className="text-white/70 text-sm italic">
                                    "{currentItem?.hostBreak?.script?.substring(0, 100)}..."
                                </p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-2xl font-bold text-white mb-1">
                                    {currentItem?.track?.title || 'Select a track to play'}
                                </h3>
                                <p className="text-white/70">
                                    {currentItem?.track?.artist || 'Unknown Artist'}
                                </p>
                                {currentItem?.track?.category && (
                                    <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                                        {currentItem.track.category}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-8">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={progress}
                        onChange={handleSeek}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                    <div className="flex justify-between text-xs text-white/50 mt-1">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        onClick={handleShuffle}
                        className="p-2 text-white/60 hover:text-white transition"
                        title="Shuffle Queue"
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="p-3 text-white hover:bg-white/10 rounded-full transition disabled:opacity-30"
                    >
                        <SkipBack className="w-6 h-6" />
                    </button>

                    <button
                        onClick={handlePlayPause}
                        disabled={generatingHostBreak}
                        className="p-4 bg-white text-indigo-900 rounded-full hover:scale-105 transition shadow-lg disabled:opacity-50"
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8" />
                        ) : (
                            <Play className="w-8 h-8 ml-1" />
                        )}
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={queue.length === 0}
                        className="p-3 text-white hover:bg-white/10 rounded-full transition disabled:opacity-30"
                    >
                        <SkipForward className="w-6 h-6" />
                    </button>

                    <button
                        onClick={toggleMute}
                        className="p-2 text-white/60 hover:text-white transition"
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                </div>

                {/* Volume & Toggles */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                    <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-white/50" />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        />
                    </div>
                    
                    {/* Crossfade Toggle */}
                    <button
                        onClick={toggleCrossfade}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition ${
                            crossfadeEnabled 
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                                : 'bg-white/10 text-white/50 border border-white/10'
                        }`}
                        title="DJ-style crossfade between songs"
                    >
                        <span className="text-sm">🎧</span>
                        Crossfade {crossfadeEnabled ? 'ON' : 'OFF'}
                    </button>
                    
                    {hosts.length > 0 && (
                        <button
                            onClick={toggleHostBreaks}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition ${
                                hostBreaksEnabled 
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' 
                                    : 'bg-white/10 text-white/50 border border-white/10'
                            }`}
                        >
                            <Mic2 className="w-3 h-3" />
                            Host Breaks {hostBreaksEnabled ? 'ON' : 'OFF'}
                        </button>
                    )}
                </div>
            </div>

            {/* Up Next */}
            <div className="border-t border-white/10 p-4">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Up Next</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {queue.slice(currentIndex + 1, currentIndex + 6).map((item, idx) => (
                        <div
                            key={`queue-${currentIndex + 1 + idx}`}
                            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition ${
                                idx === 0 && isCrossfading ? 'bg-white/10 ring-1 ring-green-400/50' : ''
                            }`}
                            onClick={() => !isCrossfading && playItem(currentIndex + 1 + idx)}
                        >
                            <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden ${
                                item.type === 'host_break' ? 'bg-yellow-500/30' : 'bg-white/10'
                            }`}>
                                {item.type === 'host_break' ? (
                                    <Mic2 className="w-5 h-5 text-yellow-400" />
                                ) : item.track?.coverImage ? (
                                    <img src={item.track.coverImage} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Music className="w-5 h-5 text-white/30" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                {item.type === 'host_break' ? (
                                    <>
                                        <p className="text-yellow-300 text-sm font-medium flex items-center gap-2">
                                            {/* Show content type label */}
                                            {(item.pendingHostBreak?.contentType || item.hostBreak) === 'station_intro' || item.pendingHostBreak?.contentType === 'station_intro' ? '📻 Station Intro' : null}
                                            {item.pendingHostBreak?.contentType === 'story_intro' && '📚 Story Time!'}
                                            {item.pendingHostBreak?.contentType === 'story_outro' && '📖 Story Reflection'}
                                            {item.pendingHostBreak?.contentType === 'devotional' && '🙏 Devotional Time'}
                                            {(!item.pendingHostBreak?.contentType || item.pendingHostBreak?.contentType === 'song') && !item.hostBreak && '🎙️ Host Break'}
                                            {item.hostBreak && !item.pendingHostBreak && '🎙️ Host Break'}
                                            
                                            {/* Ready/Loading indicator */}
                                            {item.hostBreak ? (
                                                <span className="text-green-400 text-xs">✓ Ready</span>
                                            ) : (
                                                <span className="text-yellow-400/60 text-xs flex items-center gap-1">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Loading...
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-white/50 text-xs truncate">
                                            {item.hostBreak?.script 
                                                ? `"${item.hostBreak.script.substring(0, 50)}..."`
                                                : item.pendingHostBreak?.contentType === 'story_outro' 
                                                    ? `Reflecting on: ${item.pendingHostBreak?.nextSong.title}`
                                                    : `Introducing: ${item.pendingHostBreak?.nextSong.title}`
                                            }
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-white text-sm font-medium truncate">{item.track?.title}</p>
                                        <p className="text-white/50 text-xs truncate">{item.track?.artist}</p>
                                    </>
                                )}
                            </div>
                            {idx === 0 && isCrossfading && (
                                <span className="text-xs text-green-400">Fading in...</span>
                            )}
                        </div>
                    ))}
                    {queue.length <= currentIndex + 1 && (
                        <p className="text-white/40 text-sm text-center py-4">Queue will refresh automatically</p>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="border-t border-white/10 p-4 flex items-center justify-center gap-6 text-xs text-white/40">
                <span>{tracks.length} songs</span>
                <span>•</span>
                <span>{hosts.length} hosts</span>
                <span>•</span>
                <span>🎧 {crossfadeEnabled ? '3s' : 'Off'}</span>
            </div>
        </div>
    );
};

export default RadioPreview;
