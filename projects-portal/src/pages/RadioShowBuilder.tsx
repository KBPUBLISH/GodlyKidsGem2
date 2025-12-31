import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RefreshCw, Trash2, Music, Mic2, Sparkles, Volume2, AlertCircle, Edit2, Save } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com') + '/api';

interface Playlist {
    _id: string;
    title: string;
    coverImage?: string;
    type: string;
    items: any[];
}

interface RadioHost {
    _id: string;
    name: string;
    avatarUrl?: string;
}

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
    previousTrack?: {
        title: string;
        artist: string;
    };
    status: 'pending' | 'generating' | 'ready' | 'error';
}

const RadioShowBuilder: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [hosts, setHosts] = useState<RadioHost[]>([]);
    const [segments, setSegments] = useState<RadioSegment[]>([]);
    const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingScripts, setGeneratingScripts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Preview state
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
    const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
    
    // Script editing
    const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
    const [editingScript, setEditingScript] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [playlistsRes, hostsRes, segmentsRes] = await Promise.all([
                axios.get(`${API_URL}/playlists`),
                axios.get(`${API_URL}/radio/hosts`),
                axios.get(`${API_URL}/radio/segments`),
            ]);
            
            // Filter to only published playlists with items
            const publishedPlaylists = (playlistsRes.data || []).filter(
                (p: Playlist) => p.items && p.items.length > 0
            );
            
            setPlaylists(publishedPlaylists);
            setHosts(hostsRes.data || []);
            setSegments(segmentsRes.data || []);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const togglePlaylist = (playlistId: string) => {
        setSelectedPlaylists(prev => 
            prev.includes(playlistId)
                ? prev.filter(id => id !== playlistId)
                : [...prev, playlistId]
        );
    };

    const generateSegments = async () => {
        if (selectedPlaylists.length === 0) {
            setError('Please select at least one playlist');
            return;
        }

        if (hosts.length === 0) {
            setError('Please create at least one radio host first');
            return;
        }

        try {
            setGenerating(true);
            setError(null);
            
            const response = await axios.post(`${API_URL}/radio/segments/generate`, {
                playlistIds: selectedPlaylists,
                clearExisting: true,
            });
            
            setSegments(response.data.segments || []);
            console.log(`Generated ${response.data.totalSegments} segments`);
        } catch (err: any) {
            console.error('Error generating segments:', err);
            setError(err.response?.data?.message || 'Failed to generate segments');
        } finally {
            setGenerating(false);
        }
    };

    const generateScriptsForSegments = async () => {
        const pendingSegments = segments.filter(s => s.type === 'host_break' && s.status === 'pending');
        
        if (pendingSegments.length === 0) {
            setError('No pending host breaks to generate scripts for');
            return;
        }

        try {
            setGeneratingScripts(true);
            setError(null);

            // Generate scripts one by one to show progress
            for (let i = 0; i < pendingSegments.length; i++) {
                const segment = pendingSegments[i];
                const host = hosts.find(h => h._id === (segment.hostId as any)?._id || segment.hostId);
                
                try {
                    // Generate script
                    const scriptRes = await axios.post(`${API_URL}/ai/radio-script`, {
                        hostName: host?.name || 'Radio Host',
                        nextSongTitle: segment.nextTrack?.title,
                        nextSongArtist: segment.nextTrack?.artist,
                        previousSongTitle: segment.previousTrack?.title,
                        previousSongArtist: segment.previousTrack?.artist,
                        targetDuration: 30,
                    });

                    // Generate TTS audio
                    const ttsRes = await axios.post(`${API_URL}/google-tts/generate`, {
                        text: scriptRes.data.script,
                        voiceName: 'en-US-Studio-O', // Could get from host config
                    });

                    // Update segment with script and audio
                    await axios.put(`${API_URL}/radio/segments/${segment._id}`, {
                        scriptText: scriptRes.data.script,
                        audioUrl: ttsRes.data.audioUrl,
                        status: 'ready',
                    });

                    // Update local state
                    setSegments(prev => prev.map(s => 
                        s._id === segment._id
                            ? { ...s, scriptText: scriptRes.data.script, audioUrl: ttsRes.data.audioUrl, status: 'ready' }
                            : s
                    ));

                    console.log(`Generated script ${i + 1}/${pendingSegments.length}`);
                } catch (err) {
                    console.error(`Error generating script for segment ${segment._id}:`, err);
                    // Mark as error
                    await axios.put(`${API_URL}/radio/segments/${segment._id}`, { status: 'error' });
                    setSegments(prev => prev.map(s => 
                        s._id === segment._id ? { ...s, status: 'error' } : s
                    ));
                }
            }

            await fetchData(); // Refresh to get updated data
        } catch (err: any) {
            console.error('Error generating scripts:', err);
            setError(err.response?.data?.message || 'Failed to generate scripts');
        } finally {
            setGeneratingScripts(false);
        }
    };

    const clearSegments = async () => {
        if (!confirm('Are you sure you want to clear all segments?')) return;

        try {
            await axios.delete(`${API_URL}/radio/segments`);
            setSegments([]);
        } catch (err: any) {
            console.error('Error clearing segments:', err);
            setError(err.response?.data?.message || 'Failed to clear segments');
        }
    };

    const startEditing = (segment: RadioSegment) => {
        setEditingSegmentId(segment._id);
        setEditingScript(segment.scriptText || '');
    };

    const saveScript = async (segmentId: string) => {
        try {
            await axios.put(`${API_URL}/radio/segments/${segmentId}`, {
                scriptText: editingScript,
                status: 'pending', // Mark as pending so TTS can be regenerated
            });
            
            setSegments(prev => prev.map(s => 
                s._id === segmentId
                    ? { ...s, scriptText: editingScript, status: 'pending', audioUrl: undefined }
                    : s
            ));
            
            setEditingSegmentId(null);
            setEditingScript('');
        } catch (err: any) {
            console.error('Error saving script:', err);
            setError(err.response?.data?.message || 'Failed to save script');
        }
    };

    const regenerateSegmentAudio = async (segment: RadioSegment) => {
        if (!segment.scriptText) {
            setError('No script to generate audio from');
            return;
        }

        try {
            const ttsRes = await axios.post(`${API_URL}/google-tts/generate`, {
                text: segment.scriptText,
                voiceName: 'en-US-Studio-O', // TODO: Get from host config
            });

            await axios.put(`${API_URL}/radio/segments/${segment._id}`, {
                audioUrl: ttsRes.data.audioUrl,
                status: 'ready',
            });

            setSegments(prev => prev.map(s => 
                s._id === segment._id
                    ? { ...s, audioUrl: ttsRes.data.audioUrl, status: 'ready' }
                    : s
            ));
        } catch (err: any) {
            console.error('Error regenerating audio:', err);
            setError(err.response?.data?.message || 'Failed to regenerate audio');
        }
    };

    const playPreview = (index: number) => {
        if (previewAudio) {
            previewAudio.pause();
        }

        const segment = segments[index];
        const audioUrl = segment.type === 'song' ? segment.songInfo?.audioUrl : segment.audioUrl;
        
        if (!audioUrl) {
            setError('No audio available for this segment');
            return;
        }

        const audio = new Audio(audioUrl);
        audio.onended = () => {
            setPreviewPlaying(false);
            // Auto-play next segment
            if (index + 1 < segments.length) {
                playPreview(index + 1);
            }
        };
        audio.onpause = () => setPreviewPlaying(false);
        
        setPreviewAudio(audio);
        setCurrentPreviewIndex(index);
        setPreviewPlaying(true);
        audio.play().catch(err => {
            console.error('Error playing audio:', err);
            setError('Failed to play audio');
        });
    };

    const stopPreview = () => {
        if (previewAudio) {
            previewAudio.pause();
            setPreviewAudio(null);
        }
        setPreviewPlaying(false);
    };

    const getTotalDuration = () => {
        return segments.reduce((total, seg) => total + (seg.duration || 0), 0);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const hostBreaks = segments.filter(s => s.type === 'host_break');
    const pendingBreaks = hostBreaks.filter(s => s.status === 'pending');
    const readyBreaks = hostBreaks.filter(s => s.status === 'ready');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/radio"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Show Builder</h1>
                        <p className="text-gray-500">Build your radio show with songs and host segments</p>
                    </div>
                </div>
                
                {segments.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={previewPlaying ? stopPreview : () => playPreview(0)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                previewPlaying
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                        >
                            {previewPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            {previewPlaying ? 'Stop Preview' : 'Preview Show'}
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Playlist Selection */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Select Playlists</h2>
                        
                        {playlists.length === 0 ? (
                            <p className="text-gray-500 text-sm">No playlists available</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {playlists.map((playlist) => (
                                    <label
                                        key={playlist._id}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                            selectedPlaylists.includes(playlist._id)
                                                ? 'bg-indigo-50 border-2 border-indigo-300'
                                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedPlaylists.includes(playlist._id)}
                                            onChange={() => togglePlaylist(playlist._id)}
                                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        {playlist.coverImage && (
                                            <img
                                                src={playlist.coverImage}
                                                alt={playlist.title}
                                                className="w-10 h-10 rounded object-cover"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{playlist.title}</p>
                                            <p className="text-xs text-gray-500">{playlist.items.length} songs</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 space-y-2">
                            <button
                                onClick={generateSegments}
                                disabled={generating || selectedPlaylists.length === 0}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {generating ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Sparkles className="w-5 h-5" />
                                )}
                                {generating ? 'Generating...' : 'Generate Show'}
                            </button>

                            {segments.length > 0 && (
                                <button
                                    onClick={clearSegments}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear All
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    {segments.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
                            <h3 className="text-sm font-bold text-gray-600 mb-3">Show Stats</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total Segments</span>
                                    <span className="font-medium">{segments.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Songs</span>
                                    <span className="font-medium">{segments.filter(s => s.type === 'song').length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Host Breaks</span>
                                    <span className="font-medium">{hostBreaks.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Ready</span>
                                    <span className="font-medium text-green-600">{readyBreaks.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Pending</span>
                                    <span className="font-medium text-yellow-600">{pendingBreaks.length}</span>
                                </div>
                                <hr className="my-2" />
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Est. Duration</span>
                                    <span className="font-medium">{formatDuration(getTotalDuration())}</span>
                                </div>
                            </div>

                            {pendingBreaks.length > 0 && (
                                <button
                                    onClick={generateScriptsForSegments}
                                    disabled={generatingScripts}
                                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                    {generatingScripts ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Mic2 className="w-4 h-4" />
                                    )}
                                    {generatingScripts ? 'Generating...' : `Generate ${pendingBreaks.length} Scripts`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Segment List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Show Segments</h2>
                        
                        {segments.length === 0 ? (
                            <div className="text-center py-12">
                                <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Select playlists and generate your show</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {segments.map((segment, index) => (
                                    <div
                                        key={segment._id}
                                        className={`p-4 rounded-lg border-2 transition-colors ${
                                            previewPlaying && currentPreviewIndex === index
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Order Number */}
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                                                {index + 1}
                                            </div>

                                            {/* Segment Content */}
                                            <div className="flex-1 min-w-0">
                                                {segment.type === 'song' ? (
                                                    <div className="flex items-center gap-3">
                                                        {segment.songInfo?.coverImage && (
                                                            <img
                                                                src={segment.songInfo.coverImage}
                                                                alt={segment.songInfo.title}
                                                                className="w-12 h-12 rounded object-cover"
                                                            />
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Music className="w-4 h-4 text-purple-500" />
                                                                <span className="font-medium text-gray-800">
                                                                    {segment.songInfo?.title || 'Unknown Song'}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-500">
                                                                {segment.songInfo?.artist || 'Unknown Artist'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Mic2 className="w-4 h-4 text-indigo-500" />
                                                            <span className="font-medium text-gray-800">
                                                                Host Break - {(segment.hostId as any)?.name || 'Unknown Host'}
                                                            </span>
                                                            {segment.status === 'ready' && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Ready</span>
                                                            )}
                                                            {segment.status === 'pending' && (
                                                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Pending</span>
                                                            )}
                                                            {segment.status === 'error' && (
                                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Error</span>
                                                            )}
                                                        </div>
                                                        
                                                        {editingSegmentId === segment._id ? (
                                                            <div className="mt-2">
                                                                <textarea
                                                                    value={editingScript}
                                                                    onChange={(e) => setEditingScript(e.target.value)}
                                                                    rows={3}
                                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                                />
                                                                <div className="flex gap-2 mt-2">
                                                                    <button
                                                                        onClick={() => saveScript(segment._id)}
                                                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                                                    >
                                                                        <Save className="w-3 h-3" />
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingSegmentId(null)}
                                                                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {segment.scriptText ? (
                                                                    <p className="text-sm text-gray-600 line-clamp-2">
                                                                        "{segment.scriptText}"
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-sm text-gray-400 italic">
                                                                        Introducing: {segment.nextTrack?.title}
                                                                    </p>
                                                                )}
                                                                <div className="flex gap-2 mt-2">
                                                                    <button
                                                                        onClick={() => startEditing(segment)}
                                                                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                        Edit
                                                                    </button>
                                                                    {segment.scriptText && !segment.audioUrl && (
                                                                        <button
                                                                            onClick={() => regenerateSegmentAudio(segment)}
                                                                            className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                                                                        >
                                                                            <Volume2 className="w-3 h-3" />
                                                                            Generate Audio
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Duration & Play */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500">
                                                    {formatDuration(segment.duration || 0)}
                                                </span>
                                                {(segment.type === 'song' || segment.audioUrl) && (
                                                    <button
                                                        onClick={() => playPreview(index)}
                                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RadioShowBuilder;

