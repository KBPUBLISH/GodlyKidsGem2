import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Mic, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { getMediaUrl } from '../services/apiClient';

interface LyricLine {
    text: string;
    startTime: number;
    endTime: number;
}

interface KaraokeSong {
    _id: string;
    title: string;
    description?: string;
    coverImage?: string;
    videoUrl?: string;
    backgroundAudioUrl?: string;
    duration: number;
    lyrics: LyricLine[];
    status: 'draft' | 'published';
    order: number;
    viewCount: number;
    recordCount: number;
    createdAt: string;
}

const KaraokeManagement: React.FC = () => {
    const [songs, setSongs] = useState<KaraokeSong[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const navigate = useNavigate();

    useEffect(() => {
        fetchSongs();
    }, []);

    const fetchSongs = async () => {
        try {
            const response = await apiClient.get('/api/karaoke?status=all&limit=100');
            const data = response.data.data || response.data.songs || response.data || [];
            setSongs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching karaoke songs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this karaoke song?')) return;

        try {
            await apiClient.delete(`/api/karaoke/${id}`);
            setSongs(songs.filter(s => s._id !== id));
        } catch (error) {
            console.error('Error deleting karaoke song:', error);
            alert('Failed to delete song');
        }
    };

    const handleToggleStatus = async (song: KaraokeSong) => {
        const newStatus = song.status === 'published' ? 'draft' : 'published';
        try {
            const response = await apiClient.put(`/api/karaoke/${song._id}`, {
                ...song,
                status: newStatus,
            });
            setSongs(songs.map(s => s._id === song._id ? response.data : s));
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    const filteredSongs = songs.filter(s => {
        if (filter === 'all') return true;
        return s.status === filter;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Karaoke</h1>
                <button
                    onClick={() => navigate('/karaoke/new')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create Karaoke Song
                </button>
            </div>

            <div className="flex gap-2 mb-6">
                {(['all', 'draft', 'published'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        <span className="ml-2 text-sm opacity-75">
                            ({status === 'all' ? songs.length : songs.filter(s => s.status === status).length})
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredSongs.length === 0 ? (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                    <Mic className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">No karaoke songs found</p>
                    <p className="text-gray-400 mb-4">Create your first karaoke song to get started!</p>
                    <button
                        onClick={() => navigate('/karaoke/new')}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Create Karaoke Song
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSongs.map((song) => (
                        <div key={song._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="aspect-video bg-gradient-to-br from-violet-500 to-purple-600 relative">
                                {song.coverImage ? (
                                    <img
                                        src={getMediaUrl(song.coverImage)}
                                        alt={song.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Mic className="w-20 h-20 text-white opacity-50" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${song.status === 'published'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-yellow-500 text-white'
                                        }`}>
                                        {song.status}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1 truncate">{song.title}</h2>
                                {song.description && (
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{song.description}</p>
                                )}
                                <p className="text-sm text-gray-500 mb-3">
                                    {song.duration ? `${Math.round(song.duration / 60)} min` : '—'} • {song.viewCount ?? 0} views • {song.recordCount ?? 0} recordings
                                </p>

                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => navigate(`/karaoke/edit/${song._id}`)}
                                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(song)}
                                        className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${song.status === 'published'
                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        title={song.status === 'published' ? 'Unpublish' : 'Publish'}
                                    >
                                        {song.status === 'published' ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(song._id)}
                                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KaraokeManagement;
