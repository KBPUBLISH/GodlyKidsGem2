import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Radio, Mic2, Music } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

interface RadioSegment {
    _id: string;
    type: 'host_break' | 'song';
    order: number;
    hostId?: {
        _id: string;
        name: string;
        avatarUrl?: string;
    };
    scriptText?: string;
    audioUrl?: string;
    duration?: number;
    songInfo?: {
        title: string;
        artist: string;
        coverImage?: string;
        audioUrl: string;
        duration: number;
    };
    nextTrack?: {
        title: string;
        artist: string;
    };
    status: 'pending' | 'generating' | 'ready' | 'error';
}

interface RadioStation {
    name: string;
    tagline: string;
    coverImageUrl?: string;
}

const RadioPreview: React.FC = () => {
    const [station, setStation] = useState<RadioStation | null>(null);
    const [segments, setSegments] = useState<RadioSegment[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [loading, setLoading] = useState(true);
    
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
            const [stationRes, segmentsRes] = await Promise.all([
                axios.get(`${API_URL}/radio/station`),
                axios.get(`${API_URL}/radio/segments`),
            ]);
            setStation(stationRes.data);
            // Filter to only playable segments
            const playableSegments = (segmentsRes.data || []).filter((s: RadioSegment) => 
                (s.type === 'song' && s.songInfo?.audioUrl) || 
                (s.type === 'host_break' && s.audioUrl)
            );
            setSegments(playableSegments);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentSegment = () => segments[currentIndex];

    const getAudioUrl = (segment: RadioSegment) => {
        return segment.type === 'song' ? segment.songInfo?.audioUrl : segment.audioUrl;
    };

    const playSegment = async (index: number) => {
        const segment = segments[index];
        if (!segment) return;

        const url = getAudioUrl(segment);
        if (!url) {
            // Skip to next if no audio
            if (index + 1 < segments.length) {
                playSegment(index + 1);
            }
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(url);
        audio.volume = isMuted ? 0 : volume;
        
        audio.onloadedmetadata = () => {
            setDuration(audio.duration);
        };

        audio.onended = () => {
            setIsPlaying(false);
            // Auto-play next segment
            if (index + 1 < segments.length) {
                setCurrentIndex(index + 1);
                playSegment(index + 1);
            }
        };

        audio.onplay = () => {
            setIsPlaying(true);
            // Start progress tracking
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
            progressInterval.current = setInterval(() => {
                if (audio && !audio.paused) {
                    setProgress(audio.currentTime);
                }
            }, 100);
        };

        audio.onpause = () => {
            setIsPlaying(false);
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };

        audioRef.current = audio;
        setCurrentIndex(index);
        setProgress(0);

        try {
            await audio.play();
        } catch (err) {
            console.error('Error playing audio:', err);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) {
            playSegment(currentIndex);
            return;
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    const skipNext = () => {
        if (currentIndex + 1 < segments.length) {
            playSegment(currentIndex + 1);
        }
    };

    const skipPrev = () => {
        if (currentIndex > 0) {
            playSegment(currentIndex - 1);
        } else if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? volume : 0;
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        setProgress(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentSegment = getCurrentSegment();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (segments.length === 0) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-center text-white">
                <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">No Segments Ready</h3>
                <p className="text-indigo-200">Generate segments in the Show Builder first</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Station Header */}
            <div className="px-6 py-4 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                        <Radio className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{station?.name || 'Praise Station Radio'}</h3>
                        <p className="text-xs text-indigo-200">{station?.tagline || 'Uplifting music for the whole family'}</p>
                    </div>
                </div>
                {isPlaying && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-red-300 font-medium">LIVE</span>
                    </div>
                )}
            </div>

            {/* Now Playing */}
            <div className="p-6">
                <div className="flex items-center gap-6">
                    {/* Album Art / Host Avatar */}
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                        {currentSegment?.type === 'song' && currentSegment.songInfo?.coverImage ? (
                            <img
                                src={currentSegment.songInfo.coverImage}
                                alt={currentSegment.songInfo.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {currentSegment?.type === 'host_break' ? (
                                    <Mic2 className="w-12 h-12 text-white/80" />
                                ) : (
                                    <Music className="w-12 h-12 text-white/80" />
                                )}
                            </div>
                        )}
                        {isPlaying && (
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                <div className="flex items-end gap-1">
                                    <div className="w-1 bg-white rounded-full animate-bounce" style={{ height: '16px', animationDelay: '0ms' }}></div>
                                    <div className="w-1 bg-white rounded-full animate-bounce" style={{ height: '24px', animationDelay: '150ms' }}></div>
                                    <div className="w-1 bg-white rounded-full animate-bounce" style={{ height: '20px', animationDelay: '300ms' }}></div>
                                    <div className="w-1 bg-white rounded-full animate-bounce" style={{ height: '28px', animationDelay: '450ms' }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {currentSegment?.type === 'host_break' ? (
                                <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded">HOST</span>
                            ) : (
                                <span className="text-xs bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded">NOW PLAYING</span>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white truncate">
                            {currentSegment?.type === 'song' 
                                ? currentSegment.songInfo?.title || 'Unknown Song'
                                : (currentSegment?.hostId as any)?.name || 'Radio Host'
                            }
                        </h2>
                        <p className="text-indigo-200 truncate">
                            {currentSegment?.type === 'song'
                                ? currentSegment.songInfo?.artist || 'Unknown Artist'
                                : 'Introducing next song...'
                            }
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={progress}
                        onChange={handleSeek}
                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                    <div className="flex justify-between text-xs text-indigo-200 mt-1">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mt-6">
                    <button
                        onClick={skipPrev}
                        disabled={currentIndex === 0}
                        className="p-3 text-white/70 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        <SkipBack className="w-6 h-6" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="p-4 bg-white rounded-full text-indigo-900 hover:scale-105 transition-transform shadow-lg"
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8" />
                        ) : (
                            <Play className="w-8 h-8 ml-1" />
                        )}
                    </button>

                    <button
                        onClick={skipNext}
                        disabled={currentIndex >= segments.length - 1}
                        className="p-3 text-white/70 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        <SkipForward className="w-6 h-6" />
                    </button>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-center gap-3 mt-6">
                    <button onClick={toggleMute} className="text-white/70 hover:text-white">
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                </div>
            </div>

            {/* Up Next */}
            <div className="px-6 pb-6">
                <h4 className="text-xs font-bold text-indigo-300 uppercase mb-3">Up Next</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {segments.slice(currentIndex + 1, currentIndex + 5).map((segment, idx) => (
                        <button
                            key={segment._id}
                            onClick={() => playSegment(currentIndex + 1 + idx)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                {segment.type === 'song' && segment.songInfo?.coverImage ? (
                                    <img
                                        src={segment.songInfo.coverImage}
                                        alt={segment.songInfo.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-indigo-500/30 flex items-center justify-center">
                                        {segment.type === 'host_break' ? (
                                            <Mic2 className="w-4 h-4 text-indigo-300" />
                                        ) : (
                                            <Music className="w-4 h-4 text-indigo-300" />
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm text-white font-medium truncate">
                                    {segment.type === 'song'
                                        ? segment.songInfo?.title
                                        : `${(segment.hostId as any)?.name || 'Host'}`
                                    }
                                </p>
                                <p className="text-xs text-indigo-300 truncate">
                                    {segment.type === 'song'
                                        ? segment.songInfo?.artist
                                        : 'Host Break'
                                    }
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RadioPreview;

