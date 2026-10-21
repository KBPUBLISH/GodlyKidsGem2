import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Star, Video as VideoIcon, Eye, Crown } from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

interface MusicVideo {
    _id: string;
    title: string;
    author?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    duration?: number;
    status: 'draft' | 'published';
    isFeatured?: boolean;
    isMembersOnly?: boolean;
    viewCount?: number;
}

const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MusicVideoManagement: React.FC = () => {
    const navigate = useNavigate();
    const [videos, setVideos] = useState<MusicVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');

    useEffect(() => { fetchVideos(); }, []);

    const fetchVideos = async () => {
        try {
            const res = await apiClient.get('/api/music-videos?status=all');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setVideos(data);
        } catch (err) {
            console.error('Error fetching music videos:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this music video? This cannot be undone.')) return;
        try {
            await apiClient.delete(`/api/music-videos/${id}`);
            setVideos(videos.filter(v => v._id !== id));
        } catch (err) {
            console.error('Error deleting music video:', err);
            alert('Failed to delete');
        }
    };

    const handleToggleStatus = async (video: MusicVideo) => {
        const newStatus = video.status === 'published' ? 'draft' : 'published';
        try {
            const res = await apiClient.put(`/api/music-videos/${video._id}`, { status: newStatus });
            setVideos(videos.map(v => (v._id === video._id ? res.data : v)));
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    const filtered = videos.filter(v => filter === 'all' || v.status === filter);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Music Videos</h1>
                    <p className="text-sm text-gray-500 mt-1">Create, edit and feature watchable music videos for the Listen page.</p>
                </div>
                <button
                    onClick={() => navigate('/music-videos/new')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" /> Create Music Video
                </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
                {(['all', 'published', 'draft'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                    <VideoIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">No music videos yet.</p>
                    <button onClick={() => navigate('/music-videos/new')} className="mt-4 text-indigo-600 font-medium hover:underline">
                        Create your first music video
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(video => (
                        <div key={video._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="relative aspect-video bg-gray-900">
                                {video.thumbnailUrl ? (
                                    <img src={getMediaUrl(video.thumbnailUrl)} alt={video.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-fuchsia-700">
                                        <VideoIcon className="w-10 h-10 text-white/50" />
                                    </div>
                                )}
                                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${video.status === 'published' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                                    {video.status}
                                </span>
                                <div className="absolute top-2 right-2 flex gap-1">
                                    {video.isFeatured && (
                                        <span className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center" title="Featured"><Star className="w-3.5 h-3.5 text-yellow-900 fill-yellow-900" /></span>
                                    )}
                                    {video.isMembersOnly && (
                                        <span className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center" title="Members only"><Crown className="w-3.5 h-3.5 text-amber-900" /></span>
                                    )}
                                </div>
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[11px] font-bold">
                                    {formatDuration(video.duration)}
                                </span>
                            </div>
                            <div className="p-3">
                                <h3 className="font-bold text-gray-800 truncate">{video.title}</h3>
                                {video.author && <p className="text-xs text-gray-500 truncate">{video.author}</p>}
                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                    <Eye className="w-3.5 h-3.5" /> {video.viewCount || 0} views
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        onClick={() => navigate(`/music-videos/edit/${video._id}`)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                                    >
                                        <Edit className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(video)}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        {video.status === 'published' ? 'Unpublish' : 'Publish'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(video._id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

export default MusicVideoManagement;
