import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, BookOpen, Play, ChevronLeft, Crown, Headphones } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { getApiBaseUrl } from '../services/apiService';

interface AudioItem {
    _id?: string;
    title: string;
    author?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order?: number;
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

const AudioPage: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedType, setSelectedType] = useState<'All' | 'Song' | 'Audiobook'>('All');
    const navigate = useNavigate();

    console.log('📻 AudioPage: Component rendered');

    useEffect(() => {
        console.log('📻 AudioPage: useEffect triggered, calling fetchPlaylists');
        fetchPlaylists();
    }, []);

    // Debug: Log playlists state changes
    useEffect(() => {
        console.log('📻 AudioPage: playlists state changed:', playlists.length, 'playlists');
        console.log('📻 AudioPage: playlists:', playlists);
        console.log('📻 AudioPage: selectedCategory:', selectedCategory);
    }, [playlists, selectedCategory]);

    const fetchPlaylists = async () => {
        console.log('📻 AudioPage: fetchPlaylists function called');
        try {
            setLoading(true);
            const baseUrl = getApiBaseUrl();
            const endpoint = `${baseUrl}playlists?status=published`;
            console.log('📻 AudioPage: Fetching playlists from:', endpoint);
            console.log('📻 AudioPage: baseUrl:', baseUrl);
            
            // Fetch only published playlists from the backend
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            console.log('📻 AudioPage: Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('📻 AudioPage: Failed to fetch playlists:', response.status, errorText);
                throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📻 AudioPage: Raw API response:', data);
            console.log('📻 AudioPage: Response type:', Array.isArray(data) ? 'Array' : typeof data);
            console.log('📻 AudioPage: Fetched playlists count:', Array.isArray(data) ? data.length : 'Not an array');
            
            // Ensure data is an array
            const playlistsArray = Array.isArray(data) ? data : [];
            
            // Filter out any playlists without required fields
            const validPlaylists = playlistsArray.filter((p: any) => {
                const hasId = !!p._id;
                const hasTitle = !!p.title && p.title.trim().length > 0;
                const isPublished = p.status === 'published';
                const hasItems = p.items && Array.isArray(p.items) && p.items.length > 0;
                
                const isValid = hasId && hasTitle && isPublished && hasItems;
                
                if (!isValid) {
                    console.warn('📻 AudioPage: Filtered out invalid playlist:', {
                        _id: p._id,
                        title: p.title,
                        status: p.status,
                        itemsCount: p.items?.length || 0,
                        hasId,
                        hasTitle,
                        isPublished,
                        hasItems
                    });
                } else {
                    console.log('📻 AudioPage: Valid playlist:', {
                        _id: p._id,
                        title: p.title,
                        status: p.status,
                        itemsCount: p.items.length,
                        hasCover: !!p.coverImage
                    });
                }
                return isValid;
            });
            
            console.log('📻 AudioPage: Valid playlists after filtering:', validPlaylists.length);
            if (validPlaylists.length > 0) {
                console.log('📻 AudioPage: First valid playlist details:', {
                    id: validPlaylists[0]._id,
                    title: validPlaylists[0].title,
                    status: validPlaylists[0].status,
                    itemsCount: validPlaylists[0].items?.length,
                    hasCover: !!validPlaylists[0].coverImage,
                    category: validPlaylists[0].category,
                    type: validPlaylists[0].type
                });
                console.log('📻 AudioPage: Setting playlists state with', validPlaylists.length, 'playlists');
            } else {
                console.warn('📻 AudioPage: No valid playlists found after filtering');
                console.warn('📻 AudioPage: Total playlists received:', playlistsArray.length);
                if (playlistsArray.length > 0) {
                    console.warn('📻 AudioPage: First playlist (invalid) details:', {
                        _id: playlistsArray[0]._id,
                        title: playlistsArray[0].title,
                        status: playlistsArray[0].status,
                        items: playlistsArray[0].items,
                        hasId: !!playlistsArray[0]._id,
                        hasTitle: !!playlistsArray[0].title && playlistsArray[0].title.trim().length > 0,
                        isPublished: playlistsArray[0].status === 'published',
                        hasItems: playlistsArray[0].items && Array.isArray(playlistsArray[0].items) && playlistsArray[0].items.length > 0
                    });
                }
            }
            
            console.log('📻 AudioPage: About to set playlists state');
            setPlaylists(validPlaylists);
            console.log('📻 AudioPage: Playlists state set');
        } catch (error) {
            console.error('📻 AudioPage: Error fetching playlists:', error);
            setPlaylists([]);
        } finally {
            setLoading(false);
        }
    };

    // Get unique categories from playlists, or use default ones
    const defaultCategories = ['All', 'Music', 'Stories', 'Devotionals', 'Other'];
    const playlistCategories = ['All', ...new Set(playlists.map(p => p.category).filter(Boolean))];
    const categories = playlistCategories.length > 1 ? playlistCategories : defaultCategories;

    // Filter by both type and category
    const filteredPlaylists = playlists.filter(p => {
        const matchesType = selectedType === 'All' || p.type === selectedType;
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesType && matchesCategory;
    });
    
    // Count playlists by type for the badges
    const musicCount = playlists.filter(p => p.type === 'Song').length;
    const audiobookCount = playlists.filter(p => p.type === 'Audiobook').length;

    // Debug logging
    console.log('📻 AudioPage: Render - playlists:', playlists.length, 'filtered:', filteredPlaylists.length, 'category:', selectedCategory);

    const handlePlaylistClick = (playlistId: string) => {
        navigate(`/audio/playlist/${playlistId}`);
    };

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
                        onClick={() => navigate('/home')}
                        className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full border-2 border-white/30 flex items-center justify-center transform transition-transform active:scale-95 hover:bg-black/60"
                    >
                        <ChevronLeft size={24} className="text-white" />
                    </button>

                    {/* Crown Icon */}
                    <div className="bg-[#fdf6e3] px-4 py-1 rounded-full border-b-4 border-[#d4c5a0] shadow-lg flex items-center justify-center">
                        <Crown className="text-[#8B4513]" size={24} fill="#8B4513" />
                    </div>
                </div>

                {/* Title Section */}
                <div className="relative z-20 px-6 pt-4 pb-4 text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Headphones className="w-10 h-10 text-[#f3e5ab]" />
                        <h1 className="text-4xl font-black text-[#fdf6e3] drop-shadow-lg font-display">
                            Audio Library
                        </h1>
                    </div>
                    <p className="text-[#e2cba5] font-medium text-lg">
                        Songs, Stories & More
                    </p>
                </div>

                {/* Type Filter Tabs (Music vs Audiobooks) */}
                <div className="relative z-20 px-4 pb-3">
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={() => setSelectedType('All')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                selectedType === 'All'
                                    ? 'bg-[#fdf6e3] text-[#8B4513] shadow-lg'
                                    : 'bg-[#5c2e0b]/50 text-[#e2cba5] hover:bg-[#5c2e0b]/70'
                            }`}
                        >
                            All
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                selectedType === 'All' ? 'bg-[#8B4513]/20' : 'bg-white/10'
                            }`}>
                                {playlists.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setSelectedType('Song')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                selectedType === 'Song'
                                    ? 'bg-[#fdf6e3] text-[#8B4513] shadow-lg'
                                    : 'bg-[#5c2e0b]/50 text-[#e2cba5] hover:bg-[#5c2e0b]/70'
                            }`}
                        >
                            <Music size={16} />
                            Music
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                selectedType === 'Song' ? 'bg-[#8B4513]/20' : 'bg-white/10'
                            }`}>
                                {musicCount}
                            </span>
                        </button>
                        <button
                            onClick={() => setSelectedType('Audiobook')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                selectedType === 'Audiobook'
                                    ? 'bg-[#fdf6e3] text-[#8B4513] shadow-lg'
                                    : 'bg-[#5c2e0b]/50 text-[#e2cba5] hover:bg-[#5c2e0b]/70'
                            }`}
                        >
                            <BookOpen size={16} />
                            Audiobooks
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                selectedType === 'Audiobook' ? 'bg-[#8B4513]/20' : 'bg-white/10'
                            }`}>
                                {audiobookCount}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="relative z-20 px-4 pb-4">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all border-2 ${selectedCategory === category
                                        ? 'bg-[#fdf6e3] text-[#8B4513] border-[#d4c5a0] shadow-lg'
                                        : 'bg-[#5c2e0b]/50 text-[#e2cba5] border-[#3e1f07] hover:bg-[#5c2e0b]/70'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT SECTION */}
            <div className="flex-1 w-full px-6 pt-8 pb-32">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#8B4513]"></div>
                    </div>
                ) : filteredPlaylists.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl shadow-sm border-2 border-[#d4c5a0] text-center">
                        <Music className="w-16 h-16 text-[#8B4513] mx-auto mb-4 opacity-50" />
                        <p className="text-[#5c2e0b] text-lg font-bold mb-2">No playlists found</p>
                        <p className="text-[#8B4513] mb-4">Check back soon for new audio content!</p>
                        <div className="text-xs text-gray-500 mt-4">
                            <p>Debug: Total playlists in state: {playlists.length}</p>
                            <p>Debug: Selected category: {selectedCategory}</p>
                            <p>Debug: Filtered count: {filteredPlaylists.length}</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {filteredPlaylists.map((playlist) => (
                            <div
                                key={playlist._id}
                                onClick={() => handlePlaylistClick(playlist._id)}
                                className="bg-white rounded-2xl overflow-hidden shadow-lg border-2 border-[#d4c5a0] hover:shadow-2xl hover:scale-105 transition-all cursor-pointer group"
                            >
                                {/* Cover Image */}
                                <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                                    {playlist.coverImage ? (
                                        <img
                                            src={playlist.coverImage}
                                            alt={playlist.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {playlist.type === 'Song' ? (
                                                <Music className="w-24 h-24 text-white opacity-50" />
                                            ) : (
                                                <BookOpen className="w-24 h-24 text-white opacity-50" />
                                            )}
                                        </div>
                                    )}

                                    {/* Play Button Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl">
                                            <Play className="w-8 h-8 text-[#8B4513] ml-1" fill="#8B4513" />
                                        </div>
                                    </div>

                                    {/* Type Badge */}
                                    {playlist.type && (
                                        <div className="absolute top-3 right-3">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-sm">
                                                {playlist.type}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="text-lg font-bold text-[#3E1F07] mb-1 truncate font-display">
                                        {playlist.title}
                                    </h3>
                                    {playlist.author && (
                                        <p className="text-sm text-[#8B4513] mb-2">{playlist.author}</p>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-[#5c2e0b] opacity-75">
                                        <span>{playlist.items?.length || 0} {playlist.type === 'Song' ? 'songs' : playlist.type === 'Audiobook' ? 'episodes' : 'tracks'}</span>
                                        {playlist.category && <span>{playlist.category}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudioPage;
