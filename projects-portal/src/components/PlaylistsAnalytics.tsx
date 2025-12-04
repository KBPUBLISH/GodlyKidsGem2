import React, { useState, useEffect } from 'react';
import { Eye, Play, Heart, Bookmark, ArrowUpDown, TrendingUp, TrendingDown, Music, Headphones } from 'lucide-react';
import apiClient from '../services/apiClient';
import { Link } from 'react-router-dom';

interface PlaylistAnalytics {
    _id: string;
    title: string;
    author: string;
    coverImage?: string;
    type: 'Song' | 'Audiobook';
    status: string;
    viewCount: number;
    playCount: number;
    likeCount: number;
    favoriteCount: number;
    itemCount: number;
}

type SortField = 'viewCount' | 'playCount' | 'likeCount' | 'favoriteCount' | 'itemCount';
type SortDirection = 'asc' | 'desc';

const PlaylistsAnalytics: React.FC = () => {
    const [playlists, setPlaylists] = useState<PlaylistAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('playCount');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    useEffect(() => {
        fetchPlaylistsAnalytics();
    }, []);

    const fetchPlaylistsAnalytics = async () => {
        try {
            // Fetch all playlists with analytics data
            const response = await apiClient.get('/api/playlists?includeAnalytics=true');
            const data = response.data.map((p: any) => ({
                ...p,
                itemCount: p.items?.length || 0,
            }));
            setPlaylists(data);
        } catch (error) {
            console.error('Error fetching playlists analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedPlaylists = [...playlists].sort((a, b) => {
        const aValue = a[sortField] || 0;
        const bValue = b[sortField] || 0;
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    const SortButton: React.FC<{ field: SortField; label: string; icon: React.ReactNode }> = ({ field, label, icon }) => (
        <button
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sortField === field 
                    ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {icon}
            <span>{label}</span>
            {sortField === field && (
                sortDirection === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sort Controls */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SortButton field="playCount" label="Plays" icon={<Play className="w-4 h-4" />} />
                    <SortButton field="viewCount" label="Views" icon={<Eye className="w-4 h-4" />} />
                    <SortButton field="likeCount" label="Likes" icon={<Heart className="w-4 h-4" />} />
                    <SortButton field="favoriteCount" label="Favorites" icon={<Bookmark className="w-4 h-4" />} />
                    <SortButton field="itemCount" label="Track Count" icon={<Music className="w-4 h-4" />} />
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Playlist</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Headphones className="w-4 h-4 inline" /> Plays
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Eye className="w-4 h-4 inline" /> Views
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Heart className="w-4 h-4 inline" /> Likes
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Bookmark className="w-4 h-4 inline" /> Saves
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Music className="w-4 h-4 inline" /> Tracks
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Engagement Rate
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedPlaylists.map((playlist, index) => {
                                // Calculate engagement rate: (likes + favorites) / plays * 100
                                const engagementRate = playlist.playCount > 0 
                                    ? Math.round(((playlist.likeCount + playlist.favoriteCount) / playlist.playCount) * 100)
                                    : 0;

                                return (
                                    <tr key={playlist._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                index === 1 ? 'bg-gray-200 text-gray-700' :
                                                index === 2 ? 'bg-amber-100 text-amber-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Link to={`/playlists/${playlist._id}/edit`} className="flex items-center gap-3 hover:opacity-80">
                                                {playlist.coverImage ? (
                                                    <img 
                                                        src={playlist.coverImage} 
                                                        alt={playlist.title}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                        <Music className="w-5 h-5 text-purple-500" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-800 text-sm">{playlist.title}</p>
                                                    <p className="text-xs text-gray-500">{playlist.author}</p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                playlist.type === 'Song' 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {playlist.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-semibold text-purple-600">{(playlist.playCount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-semibold text-gray-800">{(playlist.viewCount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-semibold text-red-500">{(playlist.likeCount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-semibold text-amber-600">{(playlist.favoriteCount || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-semibold text-blue-600">{playlist.itemCount}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${
                                                            engagementRate >= 20 ? 'bg-green-500' :
                                                            engagementRate >= 10 ? 'bg-yellow-500' :
                                                            'bg-red-400'
                                                        }`}
                                                        style={{ width: `${Math.min(engagementRate, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-gray-600">{engagementRate}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {sortedPlaylists.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No playlists found. Create some playlists to see analytics.
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Plays</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {playlists.reduce((sum, p) => sum + (p.playCount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Views</p>
                    <p className="text-2xl font-bold text-gray-800">
                        {playlists.reduce((sum, p) => sum + (p.viewCount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Likes</p>
                    <p className="text-2xl font-bold text-red-500">
                        {playlists.reduce((sum, p) => sum + (p.likeCount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Tracks</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {playlists.reduce((sum, p) => sum + (p.itemCount || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlaylistsAnalytics;

