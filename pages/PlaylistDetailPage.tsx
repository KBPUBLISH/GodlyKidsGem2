import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Play, Music, Headphones } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';

interface AudioItem {
    _id?: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order: number;
}

interface Playlist {
    _id: string;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    category?: string;
    type?: 'Song' | 'Audiobook';
    items: AudioItem[];
    status: 'draft' | 'published';
    playCount?: number;
}

const PlaylistDetailPage: React.FC = () => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const [playlist, setPlaylist] = useState<Playlist | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlaylist();
    }, [playlistId]);

    const fetchPlaylist = async () => {
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}playlists/${playlistId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch playlist');
            }
            const data = await response.json();
            // Sort items by order
            if (data.items && Array.isArray(data.items)) {
                data.items.sort((a: AudioItem, b: AudioItem) => (a.order || 0) - (b.order || 0));
            }
            setPlaylist(data);
        } catch (error) {
            console.error('Error fetching playlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = (itemIndex: number) => {
        navigate(`/audio/playlist/${playlistId}/play/${itemIndex}`);
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds || isNaN(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#fdf6e3]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#8B4513]"></div>
            </div>
        );
    }

    if (!playlist || playlist.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#fdf6e3]">
                <Music className="w-16 h-16 text-[#8B4513] mb-4 opacity-50" />
                <p className="text-[#5c2e0b] text-lg font-display mb-4">Playlist not found or empty</p>
                <button
                    onClick={() => navigate('/listen')}
                    className="px-6 py-2 bg-[#8B4513] text-white rounded-lg hover:bg-[#6B3410] transition-colors"
                >
                    Back to Listen
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-[#fdf6e3]">
            {/* TOP SECTION - WOOD BACKGROUND */}
            <div className="relative pb-8 shadow-2xl z-10 overflow-hidden shrink-0 w-full">
                {/* Vertical Wood Plank Pattern */}
                <div className="absolute inset-0 bg-[#8B4513]" style={{
                    backgroundImage: `repeating-linear-gradient(
                        90deg, 
                        #a05f2c 0%, #a05f2c 14%, 
                        #3e1f07 14%, #3e1f07 15%, 
                        #c28246 15%, #c28246 29%, 
                        #3e1f07 29%, #3e1f07 30%, 
                        #945829 30%, #945829 49%, 
                        #3e1f07 49%, #3e1f07 50%, 
                        #b06d36 50%, #b06d36 74%, 
                        #3e1f07 74%, #3e1f07 75%,
                        #a05f2c 75%, #a05f2c 100%
                    )`
                }}></div>

                {/* Subtle Grain Overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}>
                </div>

                {/* Header Icons */}
                <div className="relative z-20 flex justify-between items-center px-4 pt-6 pb-2">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/listen')}
                        className="w-12 h-12 bg-[#90be6d] rounded-full border-4 border-[#f3e5ab] overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.3)] relative flex items-center justify-center transform transition-transform active:scale-95 group"
                    >
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-white border-b-[8px] border-b-transparent mr-1"></div>
                    </button>

                    {/* Crown Icon */}
                    <div className="bg-[#fdf6e3] px-4 py-1 rounded-full border-b-4 border-[#d4c5a0] shadow-lg flex items-center justify-center">
                        <Crown className="text-[#8B4513]" size={24} fill="#8B4513" />
                    </div>
                </div>

                {/* Playlist Info */}
                <div className="relative z-20 px-6 pt-4 pb-6">
                    {/* Cover Image */}
                    {playlist.coverImage && (
                        <div className="w-32 h-32 mx-auto mb-4 rounded-xl overflow-hidden border-4 border-[#d4c5a0] shadow-lg">
                            <img
                                src={playlist.coverImage}
                                alt={playlist.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    
                    {/* Title and Info */}
                    <div className="text-center">
                        <h1 className="text-3xl font-black text-[#fdf6e3] drop-shadow-lg font-display mb-2">
                            {playlist.title}
                        </h1>
                        {playlist.author && (
                            <p className="text-[#e2cba5] font-medium text-lg mb-2">
                                {playlist.author}
                            </p>
                        )}
                        {playlist.description && (
                            <p className="text-[#e2cba5] text-sm mb-2">
                                {playlist.description}
                            </p>
                        )}
                        <p className="text-[#e2cba5] text-sm">
                            {playlist.items.length} {playlist.type === 'Song' ? 'songs' : 'episodes'}
                        </p>
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION - Audio Items List */}
            <div className="flex-1 w-full px-6 pt-8 pb-32">
                <div className="max-w-2xl mx-auto space-y-3">
                    {playlist.items.map((item, index) => (
                        <div
                            key={item._id || index}
                            onClick={() => handleItemClick(index)}
                            className="bg-white rounded-xl overflow-hidden shadow-md border-2 border-[#d4c5a0] hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-4 p-4">
                                {/* Cover Image or Icon */}
                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-[#d4c5a0] shrink-0">
                                    {item.coverImage ? (
                                        <img
                                            src={item.coverImage}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                            {playlist.type === 'Song' ? (
                                                <Music className="w-8 h-8 text-white opacity-50" />
                                            ) : (
                                                <Headphones className="w-8 h-8 text-white opacity-50" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Item Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-[#3E1F07] truncate font-display">
                                        {item.title}
                                    </h3>
                                    {item.author && (
                                        <p className="text-sm text-[#8B4513] truncate">{item.author}</p>
                                    )}
                                    {item.duration && (
                                        <p className="text-xs text-[#5c2e0b] opacity-75 mt-1">
                                            {formatDuration(item.duration)}
                                        </p>
                                    )}
                                </div>

                                {/* Play Button */}
                                <div className="w-12 h-12 bg-[#8B4513] rounded-full flex items-center justify-center shadow-lg group-hover:bg-[#6B3410] transition-colors shrink-0">
                                    <Play className="w-6 h-6 text-white ml-1" fill="white" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PlaylistDetailPage;

