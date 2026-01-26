import React, { useState, useEffect } from 'react';
import { Play, ArrowUpDown, TrendingUp, TrendingDown, Music, Headphones, Calendar, Clock, Timer, ListMusic, Heart, Bookmark, LayoutGrid, List } from 'lucide-react';
import apiClient from '../services/apiClient';
import { Link } from 'react-router-dom';

interface EpisodeAnalytics {
    _id: string;
    title: string;
    playlistId: string;
    playlistTitle: string;
    playlistCoverImage?: string;
    type: 'Song' | 'Audiobook';
    audioUrl?: string;
    duration?: number;
    playCount: number;
    totalListeningSeconds?: number;
    listeningSessions?: number;
    avgListeningSeconds?: number;
    avgCompletionPercent?: number;
}

interface PlaylistAnalytics {
    _id: string;
    title: string;
    author?: string;
    coverImage?: string;
    type: 'Song' | 'Audiobook';
    status: string;
    itemCount: number;
    viewCount: number;
    playCount: number;
    likeCount: number;
    favoriteCount: number;
    totalListeningSeconds?: number;
    listeningSessions?: number;
    avgListeningSeconds?: number;
    avgCompletionPercent?: number;
}

type EpisodeSortField = 'playCount' | 'avgListeningSeconds' | 'totalListeningSeconds' | 'avgCompletionPercent' | 'duration';
type PlaylistSortField = 'playCount' | 'viewCount' | 'likeCount' | 'favoriteCount' | 'itemCount' | 'totalListeningSeconds' | 'avgCompletionPercent';
type SortDirection = 'asc' | 'desc';
type TimeRange = 'day' | 'week' | 'month' | 'all';
type ViewMode = 'episodes' | 'playlists';

// Helper to format seconds into readable time
const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const PlaylistsAnalytics: React.FC = () => {
    const [episodes, setEpisodes] = useState<EpisodeAnalytics[]>([]);
    const [playlists, setPlaylists] = useState<PlaylistAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('playlists');
    const [episodeSortField, setEpisodeSortField] = useState<EpisodeSortField>('playCount');
    const [playlistSortField, setPlaylistSortField] = useState<PlaylistSortField>('playCount');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch playlist-level analytics
            const playlistRes = await apiClient.get(`/api/analytics/content?type=playlist&timeRange=${timeRange}`);
            if (playlistRes.data?.playlists) {
                console.log(`📊 Analytics: Loaded ${playlistRes.data.playlists.length} playlists (${timeRange})`);
                setPlaylists(playlistRes.data.playlists);
            }

            // Fetch episode-level analytics
            const episodeRes = await apiClient.get(`/api/analytics/content?type=episodes&timeRange=${timeRange}`);
            if (episodeRes.data?.episodes) {
                console.log(`📊 Analytics: Loaded ${episodeRes.data.episodes.length} episodes (${timeRange})`);
                setEpisodes(episodeRes.data.episodes);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
            
            // Fallback: fetch playlists directly
            try {
                const response = await apiClient.get('/api/playlists?status=all');
                const playlistsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                
                // Map to playlist analytics format
                const mappedPlaylists: PlaylistAnalytics[] = playlistsData.map((p: any) => ({
                    _id: p._id,
                    title: p.title,
                    author: p.author,
                    coverImage: p.coverImage,
                    type: p.type || 'Song',
                    status: p.status || 'published',
                    itemCount: p.items?.length || 0,
                    viewCount: p.viewCount || 0,
                    playCount: p.playCount || 0,
                    likeCount: p.likeCount || 0,
                    favoriteCount: p.favoriteCount || 0,
                    totalListeningSeconds: 0,
                    listeningSessions: 0,
                    avgListeningSeconds: 0,
                    avgCompletionPercent: 0,
                }));
                setPlaylists(mappedPlaylists);

                // Extract all episodes from playlists
                const allEpisodes: EpisodeAnalytics[] = [];
                playlistsData.forEach((playlist: any) => {
                    if (playlist.items && Array.isArray(playlist.items)) {
                        playlist.items.forEach((item: any, index: number) => {
                            allEpisodes.push({
                                _id: item._id || `${playlist._id}-${index}`,
                                title: item.title || `Track ${index + 1}`,
                                playlistId: playlist._id,
                                playlistTitle: playlist.title,
                                playlistCoverImage: playlist.coverImage,
                                type: playlist.type || 'Song',
                                audioUrl: item.audioUrl,
                                duration: item.duration || 0,
                                playCount: item.playCount || 0,
                                totalListeningSeconds: 0,
                                listeningSessions: 0,
                                avgListeningSeconds: 0,
                                avgCompletionPercent: 0,
                            });
                        });
                    }
                });
                setEpisodes(allEpisodes);
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEpisodeSort = (field: EpisodeSortField) => {
        if (episodeSortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setEpisodeSortField(field);
            setSortDirection('desc');
        }
    };

    const handlePlaylistSort = (field: PlaylistSortField) => {
        if (playlistSortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setPlaylistSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedEpisodes = [...episodes].sort((a, b) => {
        const aValue = a[episodeSortField] || 0;
        const bValue = b[episodeSortField] || 0;
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    const sortedPlaylists = [...playlists].sort((a, b) => {
        const aValue = a[playlistSortField] || 0;
        const bValue = b[playlistSortField] || 0;
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    const EpisodeSortButton: React.FC<{ field: EpisodeSortField; label: string; icon: React.ReactNode }> = ({ field, label, icon }) => (
        <button
            onClick={() => handleEpisodeSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                episodeSortField === field 
                    ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {icon}
            <span>{label}</span>
            {episodeSortField === field && (
                sortDirection === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
            )}
        </button>
    );

    const PlaylistSortButton: React.FC<{ field: PlaylistSortField; label: string; icon: React.ReactNode }> = ({ field, label, icon }) => (
        <button
            onClick={() => handlePlaylistSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                playlistSortField === field 
                    ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {icon}
            <span>{label}</span>
            {playlistSortField === field && (
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

    const TimeRangeButton: React.FC<{ range: TimeRange; label: string }> = ({ range, label }) => (
        <button
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
            {/* View Mode Toggle */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setViewMode('playlists')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'playlists'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Playlist Overview
                        </button>
                        <button
                            onClick={() => setViewMode('episodes')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'episodes'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            Episode Analytics
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <TimeRangeButton range="day" label="Today" />
                        <TimeRangeButton range="week" label="Week" />
                        <TimeRangeButton range="month" label="Month" />
                        <TimeRangeButton range="all" label="All" />
                    </div>
                </div>
            </div>

            {/* Playlist Overview Section */}
            {viewMode === 'playlists' && (
                <>
                    {/* Sort Controls */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowUpDown className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Sort by:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <PlaylistSortButton field="playCount" label="Plays" icon={<Play className="w-4 h-4" />} />
                            <PlaylistSortButton field="viewCount" label="Views" icon={<Headphones className="w-4 h-4" />} />
                            <PlaylistSortButton field="likeCount" label="Likes" icon={<Heart className="w-4 h-4" />} />
                            <PlaylistSortButton field="favoriteCount" label="Saved" icon={<Bookmark className="w-4 h-4" />} />
                            <PlaylistSortButton field="itemCount" label="Episodes" icon={<ListMusic className="w-4 h-4" />} />
                            <PlaylistSortButton field="totalListeningSeconds" label="Total Listen" icon={<Clock className="w-4 h-4" />} />
                            <PlaylistSortButton field="avgCompletionPercent" label="Completion %" icon={<TrendingUp className="w-4 h-4" />} />
                        </div>
                    </div>

                    {/* Playlist Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-purple-600" />
                                <h3 className="font-semibold text-gray-800">Playlist Overview</h3>
                                <span className="text-sm text-gray-500">({sortedPlaylists.length} playlists)</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Playlist</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Episodes</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Play className="w-4 h-4 inline" /> Plays
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Headphones className="w-4 h-4 inline" /> Views
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Heart className="w-4 h-4 inline" /> Likes
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Bookmark className="w-4 h-4 inline" /> Saved
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Clock className="w-4 h-4 inline" /> Total Listen
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Completion
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedPlaylists.map((playlist, index) => (
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
                                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                                                            <Music className="w-5 h-5 text-purple-500" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-sm max-w-[200px] truncate">{playlist.title}</p>
                                                        {playlist.author && <p className="text-xs text-gray-500">{playlist.author}</p>}
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
                                                <span className="font-medium text-gray-600">{playlist.itemCount}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-semibold text-purple-600">{(playlist.playCount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-medium text-blue-600">{(playlist.viewCount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-medium text-red-500">{(playlist.likeCount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-medium text-amber-600">{(playlist.favoriteCount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-semibold text-indigo-600">
                                                    {playlist.totalListeningSeconds ? formatDuration(playlist.totalListeningSeconds) : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${
                                                                (playlist.avgCompletionPercent || 0) >= 70 ? 'bg-green-500' :
                                                                (playlist.avgCompletionPercent || 0) >= 40 ? 'bg-yellow-500' :
                                                                'bg-red-400'
                                                            }`}
                                                            style={{ width: `${Math.min(playlist.avgCompletionPercent || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600">{Math.round(playlist.avgCompletionPercent || 0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {sortedPlaylists.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No playlists found.
                            </div>
                        )}
                    </div>

                    {/* Playlist Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Playlists</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {playlists.length.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Plays</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {playlists.reduce((sum, p) => sum + (p.playCount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Views</p>
                            <p className="text-2xl font-bold text-indigo-600">
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
                            <p className="text-sm text-gray-500">Total Saved</p>
                            <p className="text-2xl font-bold text-amber-600">
                                {playlists.reduce((sum, p) => sum + (p.favoriteCount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Episodes</p>
                            <p className="text-2xl font-bold text-teal-600">
                                {playlists.reduce((sum, p) => sum + (p.itemCount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* Episode Analytics Section */}
            {viewMode === 'episodes' && (
                <>
                    {/* Sort Controls */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                            <ArrowUpDown className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Sort by:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <EpisodeSortButton field="playCount" label="Plays" icon={<Play className="w-4 h-4" />} />
                            <EpisodeSortButton field="avgListeningSeconds" label="Avg Listen Time" icon={<Timer className="w-4 h-4" />} />
                            <EpisodeSortButton field="totalListeningSeconds" label="Total Listen Time" icon={<Clock className="w-4 h-4" />} />
                            <EpisodeSortButton field="avgCompletionPercent" label="Completion %" icon={<TrendingUp className="w-4 h-4" />} />
                            <EpisodeSortButton field="duration" label="Duration" icon={<Music className="w-4 h-4" />} />
                        </div>
                    </div>

                    {/* Episode Leaderboard Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <ListMusic className="w-5 h-5 text-purple-600" />
                                <h3 className="font-semibold text-gray-800">Episode Analytics</h3>
                                <span className="text-sm text-gray-500">({sortedEpisodes.length} episodes)</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Episode</th>
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Playlist</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Headphones className="w-4 h-4 inline" /> Plays
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Music className="w-4 h-4 inline" /> Duration
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Timer className="w-4 h-4 inline" /> Avg Listen
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <Clock className="w-4 h-4 inline" /> Total Listen
                                        </th>
                                        <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Completion
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedEpisodes.map((episode, index) => (
                                        <tr key={episode._id} className="hover:bg-gray-50 transition-colors">
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
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                                                        <Music className="w-5 h-5 text-purple-500" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-sm max-w-[200px] truncate">{episode.title}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Link to={`/playlists/${episode.playlistId}/edit`} className="flex items-center gap-2 hover:opacity-80">
                                                    {episode.playlistCoverImage ? (
                                                        <img 
                                                            src={episode.playlistCoverImage} 
                                                            alt={episode.playlistTitle}
                                                            className="w-8 h-8 rounded object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                                            <ListMusic className="w-4 h-4 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-gray-600 max-w-[150px] truncate">{episode.playlistTitle}</span>
                                                </Link>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    episode.type === 'Song' 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {episode.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-semibold text-purple-600">{(episode.playCount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-medium text-gray-600">
                                                    {episode.duration ? formatDuration(episode.duration) : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-semibold text-teal-600">
                                                    {episode.avgListeningSeconds ? formatDuration(episode.avgListeningSeconds) : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="font-semibold text-indigo-600">
                                                    {episode.totalListeningSeconds ? formatDuration(episode.totalListeningSeconds) : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${
                                                                (episode.avgCompletionPercent || 0) >= 70 ? 'bg-green-500' :
                                                                (episode.avgCompletionPercent || 0) >= 40 ? 'bg-yellow-500' :
                                                                'bg-red-400'
                                                            }`}
                                                            style={{ width: `${Math.min(episode.avgCompletionPercent || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600">{Math.round(episode.avgCompletionPercent || 0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {sortedEpisodes.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                No episodes found. Add episodes to your playlists to see analytics.
                            </div>
                        )}
                    </div>

                    {/* Episode Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Episodes</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {episodes.length.toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Plays</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {episodes.reduce((sum, e) => sum + (e.playCount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Total Listening Time</p>
                            <p className="text-2xl font-bold text-indigo-600">
                                {formatDuration(episodes.reduce((sum, e) => sum + (e.totalListeningSeconds || 0), 0))}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Avg Listen Time</p>
                            <p className="text-2xl font-bold text-teal-600">
                                {(() => {
                                    const totalSessions = episodes.reduce((sum, e) => sum + (e.listeningSessions || 0), 0);
                                    const totalSeconds = episodes.reduce((sum, e) => sum + (e.totalListeningSeconds || 0), 0);
                                    return totalSessions > 0 ? formatDuration(Math.round(totalSeconds / totalSessions)) : '-';
                                })()}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500">Avg Completion</p>
                            <p className="text-2xl font-bold text-green-600">
                                {(() => {
                                    const episodesWithData = episodes.filter(e => e.avgCompletionPercent && e.avgCompletionPercent > 0);
                                    if (episodesWithData.length === 0) return '-';
                                    const avgCompletion = Math.round(episodesWithData.reduce((sum, e) => sum + (e.avgCompletionPercent || 0), 0) / episodesWithData.length);
                                    return `${avgCompletion}%`;
                                })()}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PlaylistsAnalytics;
