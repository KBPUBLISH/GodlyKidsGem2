import React, { useState, useEffect } from 'react';
import { Eye, Play, Heart, Bookmark, ArrowUpDown, TrendingUp, TrendingDown, Music, Headphones, Calendar, Clock, Timer, ListMusic } from 'lucide-react';
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

type SortField = 'playCount' | 'avgListeningSeconds' | 'totalListeningSeconds' | 'avgCompletionPercent' | 'duration';
type SortDirection = 'asc' | 'desc';
type TimeRange = 'day' | 'week' | 'month' | 'all';

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
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('playCount');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    useEffect(() => {
        fetchEpisodeAnalytics();
    }, [timeRange]);

    const fetchEpisodeAnalytics = async () => {
        setLoading(true);
        try {
            // First try to get episode-level analytics
            const res = await apiClient.get(`/api/analytics/content?type=episodes&timeRange=${timeRange}`);
            if (res.data?.episodes) {
                console.log(`📊 Analytics: Loaded ${res.data.episodes.length} episodes (${timeRange})`);
                setEpisodes(res.data.episodes);
                return;
            }
        } catch (error) {
            console.error('Error fetching episode analytics:', error);
        }

        // Fallback: fetch playlists and extract episodes
        try {
            const response = await apiClient.get('/api/playlists?status=all');
            const playlistsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            
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
                            totalListeningSeconds: item.totalListeningSeconds || 0,
                            listeningSessions: item.listeningSessions || 0,
                            avgListeningSeconds: item.avgListeningSeconds || 0,
                            avgCompletionPercent: item.avgCompletionPercent || 0,
                        });
                    });
                }
            });
            
            console.log(`📊 Analytics: Extracted ${allEpisodes.length} episodes from ${playlistsData.length} playlists`);
            setEpisodes(allEpisodes);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
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

    const sortedEpisodes = [...episodes].sort((a, b) => {
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
            {/* Time Range Selector */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Time Range:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <TimeRangeButton range="day" label="Today" />
                    <TimeRangeButton range="week" label="This Week" />
                    <TimeRangeButton range="month" label="This Month" />
                    <TimeRangeButton range="all" label="All Time" />
                </div>
            </div>

            {/* Sort Controls */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SortButton field="playCount" label="Plays" icon={<Play className="w-4 h-4" />} />
                    <SortButton field="avgListeningSeconds" label="Avg Listen Time" icon={<Timer className="w-4 h-4" />} />
                    <SortButton field="totalListeningSeconds" label="Total Listen Time" icon={<Clock className="w-4 h-4" />} />
                    <SortButton field="avgCompletionPercent" label="Completion %" icon={<TrendingUp className="w-4 h-4" />} />
                    <SortButton field="duration" label="Duration" icon={<Music className="w-4 h-4" />} />
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

            {/* Summary Stats */}
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
        </div>
    );
};

export default PlaylistsAnalytics;


