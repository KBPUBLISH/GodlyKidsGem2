import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Radio, Music, Shuffle, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

interface RadioTrack {
    _id: string;
    title: string;
    artist?: string;
    audioUrl: string;
    coverImage?: string;
    duration?: number;
    category: string;
    rotation: string;
}

interface RadioHost {
    _id: string;
    name: string;
    avatarUrl?: string;
    personality: string;
}

interface QueueItem {
    type: 'song' | 'host_break';
    track?: RadioTrack;
    host?: RadioHost;
    message?: string;
}

interface RadioStation {
    name: string;
    tagline: string;
    coverImageUrl?: string;
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
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        fetchData();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, []);

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
            setHosts(hostsRes.data || []);
            
            // Build initial queue
            const libraryTracks = libraryRes.data.tracks || [];
            const radioHosts = hostsRes.data || [];
            
            if (libraryTracks.length > 0) {
                buildQueue(libraryTracks);
            }
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to load radio data');
        } finally {
            setLoading(false);
        }
    };

    // Build a shuffled queue with songs, weighted by rotation
    const buildQueue = (libraryTracks: RadioTrack[]) => {
        // Weight tracks by rotation
        const weightedTracks: RadioTrack[] = [];
        libraryTracks.forEach(track => {
            const weight = track.rotation === 'high' ? 3 : track.rotation === 'medium' ? 2 : 1;
            for (let i = 0; i < weight; i++) {
                weightedTracks.push(track);
            }
        });
        
        // Shuffle
        const shuffled = weightedTracks.sort(() => Math.random() - 0.5);
        
        // Remove consecutive duplicates
        const uniqueQueue: RadioTrack[] = [];
        shuffled.forEach(track => {
            if (uniqueQueue.length === 0 || uniqueQueue[uniqueQueue.length - 1]._id !== track._id) {
                uniqueQueue.push(track);
            }
        });
        
        // Build queue items (just songs for now - host breaks can be added later)
        const queueItems: QueueItem[] = uniqueQueue.slice(0, 20).map(track => ({
            type: 'song' as const,
            track
        }));
        
        setQueue(queueItems);
    };

    const getCurrentItem = () => queue[currentIndex];

    const playItem = async (index: number) => {
        const item = queue[index];
        if (!item || item.type !== 'song' || !item.track) return;

        const url = item.track.audioUrl;
        if (!url) {
            // Skip to next if no audio
            if (index + 1 < queue.length) {
                playItem(index + 1);
            }
            return;
        }

        setCurrentIndex(index);

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(url);
        audio.volume = isMuted ? 0 : volume;
        
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

        audioRef.current = audio;
        
        try {
            await audio.play();
            setIsPlaying(true);
            startProgressTracking();
        } catch (err) {
            console.error('Failed to play:', err);
        }
    };

    const startProgressTracking = () => {
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
        }
        progressInterval.current = setInterval(() => {
            if (audioRef.current) {
                setProgress(audioRef.current.currentTime);
            }
        }, 100);
    };

    const handlePlayPause = () => {
        if (!audioRef.current && queue.length > 0) {
            playItem(currentIndex);
            return;
        }

        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
                startProgressTracking();
            }
        }
    };

    const handleNext = () => {
        if (currentIndex + 1 < queue.length) {
            playItem(currentIndex + 1);
        } else {
            // Loop back or rebuild queue
            buildQueue(tracks);
            setCurrentIndex(0);
            if (isPlaying) {
                setTimeout(() => playItem(0), 100);
            }
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            playItem(currentIndex - 1);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setProgress(time);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : vol;
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? volume : 0;
        }
    };

    const handleShuffle = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setIsPlaying(false);
        setCurrentIndex(0);
        setProgress(0);
        buildQueue(tracks);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentItem = getCurrentItem();

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
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl overflow-hidden shadow-2xl">
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
            <div className="p-8">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Album Art */}
                    <div className="w-48 h-48 rounded-xl overflow-hidden shadow-2xl bg-black/30 flex-shrink-0">
                        {currentItem?.track?.coverImage ? (
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

                    {/* Track Info */}
                    <div className="flex-1 text-center md:text-left">
                        <div className="mb-1 flex items-center justify-center md:justify-start gap-2">
                            <Music className="w-4 h-4 text-pink-400" />
                            <span className="text-xs text-pink-300 uppercase tracking-wider">Now Playing</span>
                        </div>
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
                        className="p-4 bg-white text-indigo-900 rounded-full hover:scale-105 transition shadow-lg"
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

                {/* Volume */}
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Volume2 className="w-4 h-4 text-white/50" />
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                </div>
            </div>

            {/* Up Next */}
            <div className="border-t border-white/10 p-4">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Up Next</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {queue.slice(currentIndex + 1, currentIndex + 6).map((item, idx) => (
                        <div
                            key={`${item.track?._id}-${idx}`}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                            onClick={() => playItem(currentIndex + 1 + idx)}
                        >
                            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {item.track?.coverImage ? (
                                    <img src={item.track.coverImage} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Music className="w-5 h-5 text-white/30" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{item.track?.title}</p>
                                <p className="text-white/50 text-xs truncate">{item.track?.artist}</p>
                            </div>
                        </div>
                    ))}
                    {queue.length <= currentIndex + 1 && (
                        <p className="text-white/40 text-sm text-center py-4">Queue will refresh automatically</p>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="border-t border-white/10 p-4 flex items-center justify-center gap-6 text-xs text-white/40">
                <span>{tracks.length} songs in library</span>
                <span>•</span>
                <span>{hosts.length} hosts</span>
                <span>•</span>
                <span>{queue.length} in queue</span>
            </div>
        </div>
    );
};

export default RadioPreview;
