import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Music, BookOpen, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface AudioItem {
    _id?: string;
    title: string;
    author: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order: number;
}

interface Playlist {
    _id: string;
    title: string;
    author: string;
    description?: string;
    coverImage?: string;
    category: 'Music' | 'Stories' | 'Devotionals' | 'Other';
    type: 'Song' | 'Audiobook';
    items: AudioItem[];
    status: 'draft' | 'published';
    playCount: number;
    createdAt: string;
    updatedAt: string;
}

const Playlists: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const navigate = useNavigate();

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const response = await axios.get('http://localhost:5001/api/playlists');
            setPlaylists(response.data);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this playlist?')) return;

        try {
            await axios.delete(`http://localhost:5001/api/playlists/${id}`);
            setPlaylists(playlists.filter(p => p._id !== id));
        } catch (error) {
            console.error('Error deleting playlist:', error);
            alert('Failed to delete playlist');
        }
    };

    const handleToggleStatus = async (playlist: Playlist) => {
        const newStatus = playlist.status === 'published' ? 'draft' : 'published';
        try {
            const response = await axios.put(`http://localhost:5001/api/playlists/${playlist._id}`, {
                ...playlist,
                status: newStatus,
            });
            setPlaylists(playlists.map(p => p._id === playlist._id ? response.data : p));
        } catch (error) {
            console.error('Error updating playlist status:', error);
            alert('Failed to update playlist status');
        }
    };

    const filteredPlaylists = playlists.filter(p => {
        if (filter === 'all') return true;
        return p.status === filter;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Audio Playlists</h1>
                <button
                    onClick={() => navigate('/playlists/new')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create Playlist
                </button>
            </div>

            {/* Filter Tabs */}
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
                            ({status === 'all' ? playlists.length : playlists.filter(p => p.status === status).length})
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredPlaylists.length === 0 ? (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                    <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">No playlists found</p>
                    <p className="text-gray-400 mb-4">Create your first audio playlist to get started!</p>
                    <button
                        onClick={() => navigate('/playlists/new')}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Create Playlist
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlaylists.map((playlist) => (
                        <div key={playlist._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Cover Image */}
                            <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                                {playlist.coverImage ? (
                                    <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {playlist.type === 'Song' ? (
                                            <Music className="w-20 h-20 text-white opacity-50" />
                                        ) : (
                                            <BookOpen className="w-20 h-20 text-white opacity-50" />
                                        )}
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${playlist.status === 'published'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-yellow-500 text-white'
                                        }`}>
                                        {playlist.status}
                                    </span>
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm">
                                        {playlist.type}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <h2 className="text-lg font-semibold text-gray-800 mb-1 truncate">{playlist.title}</h2>
                                <p className="text-sm text-gray-600 mb-2">{playlist.author}</p>
                                <p className="text-sm text-gray-500 mb-3">
                                    {playlist.items.length} {playlist.type === 'Song' ? 'songs' : 'episodes'} • {playlist.category}
                                </p>
                                {playlist.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{playlist.description}</p>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => navigate(`/playlists/edit/${playlist._id}`)}
                                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(playlist)}
                                        className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${playlist.status === 'published'
                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        title={playlist.status === 'published' ? 'Unpublish' : 'Publish'}
                                    >
                                        {playlist.status === 'published' ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(playlist._id)}
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

export default Playlists;
