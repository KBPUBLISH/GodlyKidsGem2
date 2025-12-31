import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Play, Pause, Music, Filter, Search, ToggleLeft, ToggleRight, FolderPlus, RefreshCw } from 'lucide-react';
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
    enabled: boolean;
    playCount: number;
    sourcePlaylistId?: string;
    createdAt: string;
    description?: string; // For context-aware hosting
}

interface Playlist {
    _id: string;
    title: string;
    coverImage?: string;
    items?: Array<{
        title: string;
        audioUrl: string;
        coverImage?: string;
        duration?: number;
        author?: string;
    }>;
}

interface LibraryStats {
    totalTracks: number;
    enabledTracks: number;
    disabledTracks: number;
    byCategory: Record<string, number>;
    byRotation: Record<string, number>;
    totalDurationFormatted: string;
}

const CATEGORIES = [
    { value: 'worship', label: 'Worship', color: 'bg-purple-500' },
    { value: 'story', label: 'Story', color: 'bg-blue-500' },
    { value: 'devotional', label: 'Devotional', color: 'bg-green-500' },
    { value: 'kids', label: 'Kids', color: 'bg-yellow-500' },
    { value: 'general', label: 'General', color: 'bg-gray-500' },
];

const ROTATIONS = [
    { value: 'high', label: 'High Rotation', color: 'text-red-600' },
    { value: 'medium', label: 'Medium Rotation', color: 'text-yellow-600' },
    { value: 'low', label: 'Low Rotation', color: 'text-gray-600' },
];

const RadioLibrary: React.FC = () => {
    const [tracks, setTracks] = useState<RadioTrack[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [stats, setStats] = useState<LibraryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterRotation, setFilterRotation] = useState<string>('');
    const [filterEnabled, setFilterEnabled] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal state - Bulk add from playlist
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
    const [bulkCategory, setBulkCategory] = useState('general');
    const [bulkRotation, setBulkRotation] = useState('medium');
    const [addingBulk, setAddingBulk] = useState(false);
    
    // Modal state - Single track add
    const [showSingleAddModal, setShowSingleAddModal] = useState(false);
    const [singleTrack, setSingleTrack] = useState({
        title: '',
        artist: '',
        audioUrl: '',
        coverImage: '',
        duration: 0,
        category: 'general',
        rotation: 'medium',
        description: ''
    });
    const [addingSingle, setAddingSingle] = useState(false);
    
    // Audio preview
    const [playingTrack, setPlayingTrack] = useState<string | null>(null);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchData();
        return () => {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
        };
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tracksRes, playlistsRes, statsRes] = await Promise.all([
                axios.get(`${API_URL}/radio/library`),
                axios.get(`${API_URL}/playlists?status=all&limit=100`),
                axios.get(`${API_URL}/radio/library/stats`),
            ]);
            
            setTracks(tracksRes.data.tracks || []);
            // Handle playlists API response format
            const playlistsData = playlistsRes.data?.data || playlistsRes.data || [];
            setPlaylists(Array.isArray(playlistsData) ? playlistsData : []);
            setStats(statsRes.data);
        } catch (err: any) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTrack = async (track: RadioTrack) => {
        try {
            await axios.post(`${API_URL}/radio/library/${track._id}/toggle`);
            await fetchData();
        } catch (err: any) {
            console.error('Error toggling track:', err);
            setError(err.response?.data?.message || 'Failed to toggle track');
        }
    };

    const handleDeleteTrack = async (track: RadioTrack) => {
        if (!confirm(`Remove "${track.title}" from the radio library?`)) return;
        
        try {
            await axios.delete(`${API_URL}/radio/library/${track._id}`);
            await fetchData();
        } catch (err: any) {
            console.error('Error deleting track:', err);
            setError(err.response?.data?.message || 'Failed to delete track');
        }
    };

    const handleUpdateTrack = async (trackId: string, field: string, value: string) => {
        try {
            await axios.put(`${API_URL}/radio/library/${trackId}`, { [field]: value });
            await fetchData();
        } catch (err: any) {
            console.error('Error updating track:', err);
            setError(err.response?.data?.message || 'Failed to update track');
        }
    };

    const handleBulkAdd = async () => {
        if (!selectedPlaylist) {
            setError('Please select a playlist');
            return;
        }
        
        try {
            setAddingBulk(true);
            const response = await axios.post(`${API_URL}/radio/library/bulk`, {
                playlistId: selectedPlaylist,
                category: bulkCategory,
                rotation: bulkRotation
            });
            
            alert(response.data.message);
            setShowAddModal(false);
            await fetchData();
        } catch (err: any) {
            console.error('Error bulk adding:', err);
            setError(err.response?.data?.message || 'Failed to add tracks');
        } finally {
            setAddingBulk(false);
        }
    };

    const handleSingleAdd = async () => {
        if (!singleTrack.title || !singleTrack.audioUrl) {
            setError('Title and Audio URL are required');
            return;
        }
        
        try {
            setAddingSingle(true);
            await axios.post(`${API_URL}/radio/library`, {
                title: singleTrack.title,
                artist: singleTrack.artist,
                audioUrl: singleTrack.audioUrl,
                coverImage: singleTrack.coverImage,
                duration: singleTrack.duration || undefined,
                category: singleTrack.category,
                rotation: singleTrack.rotation,
                description: singleTrack.description,
                enabled: true
            });
            
            // Reset form
            setSingleTrack({
                title: '',
                artist: '',
                audioUrl: '',
                coverImage: '',
                duration: 0,
                category: 'general',
                rotation: 'medium',
                description: ''
            });
            setShowSingleAddModal(false);
            await fetchData();
        } catch (err: any) {
            console.error('Error adding track:', err);
            setError(err.response?.data?.message || 'Failed to add track');
        } finally {
            setAddingSingle(false);
        }
    };

    const handlePlayPreview = (track: RadioTrack) => {
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        
        if (playingTrack === track._id) {
            setPlayingTrack(null);
            setAudio(null);
            return;
        }
        
        const newAudio = new Audio(track.audioUrl);
        newAudio.onended = () => {
            setPlayingTrack(null);
            setAudio(null);
        };
        newAudio.play();
        setAudio(newAudio);
        setPlayingTrack(track._id);
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Filter tracks
    const filteredTracks = tracks.filter(track => {
        if (filterCategory && track.category !== filterCategory) return false;
        if (filterRotation && track.rotation !== filterRotation) return false;
        if (filterEnabled === 'true' && !track.enabled) return false;
        if (filterEnabled === 'false' && track.enabled) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!track.title.toLowerCase().includes(query) && 
                !(track.artist || '').toLowerCase().includes(query)) {
                return false;
            }
        }
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link to="/radio" className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Radio Library</h1>
                        <p className="text-gray-600">Manage individual songs for your radio station</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSingleAddModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Song
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <FolderPlus className="w-5 h-5" />
                        Add from Playlist
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                    <button onClick={() => setError(null)} className="float-right text-red-500">×</button>
                </div>
            )}

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <div className="text-sm text-gray-500">Total Tracks</div>
                        <div className="text-2xl font-bold text-gray-800">{stats.totalTracks}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg shadow">
                        <div className="text-sm text-green-600">Enabled</div>
                        <div className="text-2xl font-bold text-green-700">{stats.enabledTracks}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg shadow">
                        <div className="text-sm text-gray-500">Disabled</div>
                        <div className="text-2xl font-bold text-gray-600">{stats.disabledTracks}</div>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg shadow col-span-2">
                        <div className="text-sm text-indigo-600">Total Duration</div>
                        <div className="text-2xl font-bold text-indigo-700">{stats.totalDurationFormatted}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tracks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="border rounded-lg px-3 py-2 w-64"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-400" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="border rounded-lg px-3 py-2"
                        >
                            <option value="">All Categories</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    <select
                        value={filterRotation}
                        onChange={(e) => setFilterRotation(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    >
                        <option value="">All Rotations</option>
                        {ROTATIONS.map(rot => (
                            <option key={rot.value} value={rot.value}>{rot.label}</option>
                        ))}
                    </select>
                    
                    <select
                        value={filterEnabled}
                        onChange={(e) => setFilterEnabled(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    >
                        <option value="">All Status</option>
                        <option value="true">Enabled Only</option>
                        <option value="false">Disabled Only</option>
                    </select>
                    
                    <span className="text-sm text-gray-500">
                        Showing {filteredTracks.length} of {tracks.length} tracks
                    </span>
                </div>
            </div>

            {/* Track List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {filteredTracks.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No tracks in the library yet.</p>
                        <p className="text-sm mt-2">Click "Add from Playlist" to start building your radio library.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-4 font-medium text-gray-600">Track</th>
                                <th className="text-left p-4 font-medium text-gray-600">Category</th>
                                <th className="text-left p-4 font-medium text-gray-600">Rotation</th>
                                <th className="text-left p-4 font-medium text-gray-600 w-48">Description</th>
                                <th className="text-left p-4 font-medium text-gray-600">Duration</th>
                                <th className="text-center p-4 font-medium text-gray-600">Enabled</th>
                                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTracks.map((track) => (
                                <tr key={track._id} className={`border-b hover:bg-gray-50 ${!track.enabled ? 'opacity-50' : ''}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handlePlayPreview(track)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                    playingTrack === track._id
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {playingTrack === track._id ? (
                                                    <Pause className="w-4 h-4" />
                                                ) : (
                                                    <Play className="w-4 h-4 ml-0.5" />
                                                )}
                                            </button>
                                            {track.coverImage ? (
                                                <img src={track.coverImage} alt="" className="w-10 h-10 rounded object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                                                    <Music className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900">{track.title}</div>
                                                {track.artist && (
                                                    <div className="text-sm text-gray-500">{track.artist}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={track.category}
                                            onChange={(e) => handleUpdateTrack(track._id, 'category', e.target.value)}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select
                                            value={track.rotation}
                                            onChange={(e) => handleUpdateTrack(track._id, 'rotation', e.target.value)}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            {ROTATIONS.map(rot => (
                                                <option key={rot.value} value={rot.value}>{rot.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <input
                                            type="text"
                                            defaultValue={track.description || ''}
                                            placeholder="Add description..."
                                            onBlur={(e) => {
                                                if (e.target.value !== (track.description || '')) {
                                                    handleUpdateTrack(track._id, 'description', e.target.value);
                                                }
                                            }}
                                            className="text-sm border rounded px-2 py-1 w-full text-gray-600 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
                                            title={track.description || 'Add a description for context-aware hosting'}
                                        />
                                    </td>
                                    <td className="p-4 text-gray-600">
                                        {formatDuration(track.duration)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggleTrack(track)}
                                            className={`p-1 rounded ${track.enabled ? 'text-green-600' : 'text-gray-400'}`}
                                        >
                                            {track.enabled ? (
                                                <ToggleRight className="w-8 h-8" />
                                            ) : (
                                                <ToggleLeft className="w-8 h-8" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDeleteTrack(track)}
                                            className="text-red-500 hover:text-red-700 p-2"
                                            title="Remove from library"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add from Playlist Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4">Add Tracks from Playlist</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Playlist
                                </label>
                                <select
                                    value={selectedPlaylist}
                                    onChange={(e) => setSelectedPlaylist(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                >
                                    <option value="">-- Choose a playlist --</option>
                                    {playlists.filter(p => p.items && p.items.length > 0).map(playlist => (
                                        <option key={playlist._id} value={playlist._id}>
                                            {playlist.title} ({playlist.items?.length} tracks)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={bulkCategory}
                                        onChange={(e) => setBulkCategory(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rotation
                                    </label>
                                    <select
                                        value={bulkRotation}
                                        onChange={(e) => setBulkRotation(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2"
                                    >
                                        {ROTATIONS.map(rot => (
                                            <option key={rot.value} value={rot.value}>{rot.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-500">
                                All tracks from the selected playlist will be added to your radio library. Duplicates will be skipped.
                            </p>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkAdd}
                                disabled={!selectedPlaylist || addingBulk}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {addingBulk ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Add Tracks
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Single Track Add Modal */}
            {showSingleAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Add Individual Song</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={singleTrack.title}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, title: e.target.value })}
                                    placeholder="Song title"
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Artist
                                </label>
                                <input
                                    type="text"
                                    value={singleTrack.artist}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, artist: e.target.value })}
                                    placeholder="Artist name"
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Audio URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={singleTrack.audioUrl}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, audioUrl: e.target.value })}
                                    placeholder="https://storage.example.com/audio.mp3"
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Cover Image URL
                                </label>
                                <input
                                    type="url"
                                    value={singleTrack.coverImage}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, coverImage: e.target.value })}
                                    placeholder="https://storage.example.com/cover.jpg"
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Duration (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={singleTrack.duration || ''}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, duration: parseInt(e.target.value) || 0 })}
                                    placeholder="180"
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={singleTrack.description}
                                    onChange={(e) => setSingleTrack({ ...singleTrack, description: e.target.value })}
                                    placeholder="Brief description (used for context-aware hosting)"
                                    rows={2}
                                    className="w-full border rounded-lg px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={singleTrack.category}
                                        onChange={(e) => setSingleTrack({ ...singleTrack, category: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2"
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Rotation
                                    </label>
                                    <select
                                        value={singleTrack.rotation}
                                        onChange={(e) => setSingleTrack({ ...singleTrack, rotation: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2"
                                    >
                                        {ROTATIONS.map(rot => (
                                            <option key={rot.value} value={rot.value}>{rot.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowSingleAddModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSingleAdd}
                                disabled={!singleTrack.title || !singleTrack.audioUrl || addingSingle}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {addingSingle ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Music className="w-4 h-4" />
                                        Add Song
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RadioLibrary;

