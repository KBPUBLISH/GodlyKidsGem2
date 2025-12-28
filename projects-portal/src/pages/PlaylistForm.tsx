import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, GripVertical, Music, Save, X, Lock, Unlock } from 'lucide-react';
import apiClient from '../services/apiClient';
import ContentAnalytics from '../components/ContentAnalytics';

interface AudioItem {
    _id?: string;
    title: string;
    author: string;
    description?: string;
    coverImage?: string;
    audioUrl: string;
    duration?: number;
    order: number;
    isMembersOnly?: boolean; // Whether this specific song/episode requires membership
}

interface Category {
    _id: string;
    name: string;
    type: 'book' | 'audio';
}

interface PlaylistFormData {
    title: string;
    author: string;
    description: string;
    coverImage: string;
    category: string; // Category name (for backward compatibility)
    categories?: string[]; // Multiple categories
    type: 'Song' | 'Audiobook';
    items: AudioItem[];
    status: 'draft' | 'published';
    isMembersOnly?: boolean;
    minAge?: number;
    level?: string;
}

const PlaylistForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [formData, setFormData] = useState<PlaylistFormData>({
        title: '',
        author: 'Kingdom Builders Publishing',
        description: '',
        coverImage: '',
        category: '',
        categories: [],
        type: 'Song',
        items: [],
        status: 'draft',
        isMembersOnly: false,
        minAge: undefined,
        level: '',
    });
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    useEffect(() => {
        fetchCategories();
        if (id) {
            fetchPlaylist();
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            // Only fetch audio categories
            const response = await apiClient.get('/api/categories?type=audio');
            // Handle paginated response or direct array
            const categoriesData = Array.isArray(response.data) 
                ? response.data 
                : (response.data.data || response.data.categories || []);
            setCategories(categoriesData);
            if (categoriesData.length > 0 && !formData.category) {
                setFormData(prev => ({ ...prev, category: categoriesData[0].name }));
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchPlaylist = async () => {
        try {
            const response = await apiClient.get(`/api/playlists/${id}`);
            setFormData(response.data);
            // Initialize selectedCategories from the playlist data
            if (response.data.categories && Array.isArray(response.data.categories)) {
                setSelectedCategories(response.data.categories);
            } else if (response.data.category) {
                setSelectedCategories([response.data.category]);
            }
        } catch (error) {
            console.error('Error fetching playlist:', error);
            alert('Failed to load playlist');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate that all items have required fields
        const missingFields = formData.items.some(item => 
            !item.title || !item.audioUrl || !item.coverImage
        );
        
        if (missingFields) {
            alert('Please ensure all songs/episodes have a title, audio file (MP3), and cover image.');
            return;
        }
        
        if (!formData.coverImage) {
            alert('Please upload a cover image for the playlist.');
            return;
        }
        
        setLoading(true);

        try {
            // Include selectedCategories in the payload
            const payload = {
                ...formData,
                categories: selectedCategories,
            };
            
            if (id) {
                await apiClient.put(`/api/playlists/${id}`, payload);
            } else {
                await apiClient.post('/api/playlists', payload);
            }
            navigate('/playlists');
        } catch (error: any) {
            console.error('Error saving playlist:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to save playlist';
            const errorDetails = error.response?.data?.details ? JSON.stringify(error.response.data.details, null, 2) : '';
            alert(`Failed to save playlist: ${errorMessage}${errorDetails ? '\n\nDetails: ' + errorDetails : ''}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (file: File, type: 'cover' | 'audio' | 'itemCover', itemIndex?: number) => {
        setUploading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            let endpoint: string;
            let queryParams = '';

            if (type === 'cover') {
                // Playlist cover image - always use playlists folder
                endpoint = '/api/upload/image';
                queryParams = `?bookId=playlists&type=cover`;
            } else if (type === 'itemCover' && itemIndex !== undefined) {
                // Song/episode cover image - always use playlists folder
                endpoint = '/api/upload/image';
                queryParams = `?bookId=playlists&type=cover`;
            } else if (type === 'audio' && itemIndex !== undefined) {
                // Audio file (MP3) - always use playlists folder
                endpoint = '/api/upload/audio';
                queryParams = `?bookId=playlists&type=audio`;
            } else {
                throw new Error('Invalid upload type or missing parameters');
            }
            
            const response = await apiClient.post(`${endpoint}${queryParams}`, formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000, // 2 minutes for large audio files
            });

            if (type === 'cover') {
                setFormData({ ...formData, coverImage: response.data.url });
            } else if (type === 'itemCover' && itemIndex !== undefined) {
                const newItems = [...formData.items];
                newItems[itemIndex].coverImage = response.data.url;
                setFormData({ ...formData, items: newItems });
            } else if (type === 'audio' && itemIndex !== undefined) {
                const newItems = [...formData.items];
                newItems[itemIndex].audioUrl = response.data.url;
                setFormData({ ...formData, items: newItems });
            }
        } catch (error: any) {
            console.error('Error uploading file:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            alert(`Failed to upload file: ${errorMessage}`);
        } finally {
            setUploading(false);
        }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    title: '',
                    author: formData.author,
                    audioUrl: '',
                    order: formData.items.length,
                    isMembersOnly: false, // Default to free for new items
                },
            ],
        });
    };

    const removeItem = (index: number) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index),
        });
    };

    const updateItem = (index: number, field: keyof AudioItem, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/playlists')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">
                    {id ? 'Edit Playlist' : 'Create Playlist'}
                </h1>
            </div>

            {/* Analytics Section - Only show when editing */}
            {id && (
                <div className="mb-6">
                    <ContentAnalytics contentId={id} contentType="playlist" />
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="My Awesome Playlist"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Author
                            </label>
                            <input
                                type="text"
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type *
                            </label>
                            <select
                                required
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Song' | 'Audiobook' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="Song">Song</option>
                                <option value="Audiobook">Audiobook</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Access
                            </label>
                            <div 
                                onClick={() => setFormData({ ...formData, isMembersOnly: !formData.isMembersOnly })}
                                className={`w-full rounded-lg border text-base px-3 py-2 transition cursor-pointer flex items-center justify-between ${
                                    formData.isMembersOnly 
                                        ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                        : 'bg-green-50 border-green-300 text-green-800'
                                }`}
                            >
                                <span className="font-medium text-sm">
                                    {formData.isMembersOnly ? '👑 Members Only' : '🆓 Free for All'}
                                </span>
                                <div className={`w-10 h-5 rounded-full relative transition-colors ${
                                    formData.isMembersOnly ? 'bg-amber-400' : 'bg-green-400'
                                }`}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                        formData.isMembersOnly ? 'translate-x-5' : 'translate-x-0.5'
                                    }`} />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {formData.isMembersOnly 
                                    ? 'Only subscribers can access' 
                                    : 'Everyone can access'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categories (Select Multiple)
                            </label>
                            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
                                {categories.length === 0 ? (
                                    <p className="text-sm text-gray-500">No categories available</p>
                                ) : (
                                    categories.map((cat) => (
                                        <label
                                            key={cat._id}
                                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedCategories.includes(cat.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedCategories([...selectedCategories, cat.name]);
                                                    } else {
                                                        setSelectedCategories(selectedCategories.filter(c => c !== cat.name));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700">{cat.name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                            {selectedCategories.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedCategories.map((catName) => (
                                        <span
                                            key={catName}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs"
                                        >
                                            {catName}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== catName))}
                                                className="hover:text-indigo-900"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Age Level (e.g., "3+", "5+")
                            </label>
                            <input
                                type="text"
                                value={formData.level || ''}
                                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="3+"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Minimum Age
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={18}
                                value={formData.minAge || ''}
                                onChange={(e) => setFormData({ ...formData, minAge: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="3"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="A brief description of this playlist..."
                        />
                    </div>

                    {/* Cover Image */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cover Image *
                        </label>
                        <div className="flex items-start gap-4">
                            {formData.coverImage && (
                                <img
                                    src={formData.coverImage}
                                    alt="Cover"
                                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                                />
                            )}
                            <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-indigo-500 transition-colors">
                                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-600">Click to upload cover image</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'cover', undefined)}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Audio Items Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {formData.type === 'Song' ? 'Songs' : 'Episodes'}
                        </h2>
                        <button
                            type="button"
                            onClick={addItem}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add {formData.type === 'Song' ? 'Song' : 'Episode'}
                        </button>
                    </div>

                    {formData.items.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No {formData.type === 'Song' ? 'songs' : 'episodes'} added yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {formData.items.map((item, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Title *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={item.title}
                                                    onChange={(e) => updateItem(index, 'title', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    placeholder={formData.type === 'Song' ? 'Song title' : 'Episode title'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Author
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.author}
                                                    onChange={(e) => updateItem(index, 'author', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Description <span className="text-gray-400 font-normal">(optional)</span>
                                                </label>
                                                <textarea
                                                    value={item.description || ''}
                                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    placeholder={formData.type === 'Song' ? 'Brief description of the song...' : 'Brief description of the episode...'}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Cover Image *
                                                </label>
                                                <div className="flex items-center gap-3 mb-3">
                                                    {item.coverImage && (
                                                        <img
                                                            src={item.coverImage}
                                                            alt="Cover"
                                                            className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                                                        />
                                                    )}
                                                    <label className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-indigo-500 transition-colors">
                                                        <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                                        <span className="text-sm text-gray-600">Upload cover</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'itemCover', index)}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Audio File (MP3) *
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={item.audioUrl}
                                                        onChange={(e) => updateItem(index, 'audioUrl', e.target.value)}
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                        placeholder="Audio file URL"
                                                        readOnly
                                                    />
                                                    <label className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors">
                                                        <Upload className="w-4 h-4" />
                                                        Upload MP3
                                                        <input
                                                            type="file"
                                                            accept="audio/mpeg,audio/mp3,.mp3"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    // Validate file type
                                                                    if (!file.type.includes('audio') && !file.name.toLowerCase().endsWith('.mp3')) {
                                                                        alert('Please upload an MP3 audio file');
                                                                        return;
                                                                    }
                                                                    handleFileUpload(file, 'audio', index);
                                                                }
                                                            }}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            
                                            {/* Access Control for Individual Item */}
                                            <div className="md:col-span-2">
                                                <div 
                                                    onClick={() => updateItem(index, 'isMembersOnly', !item.isMembersOnly)}
                                                    className={`w-full rounded-lg border text-sm px-3 py-2 transition cursor-pointer flex items-center justify-between ${
                                                        item.isMembersOnly 
                                                            ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                                            : 'bg-green-50 border-green-300 text-green-800'
                                                    }`}
                                                >
                                                    <span className="font-medium flex items-center gap-2">
                                                        {item.isMembersOnly ? (
                                                            <>
                                                                <Lock className="w-4 h-4" />
                                                                👑 Premium Only
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Unlock className="w-4 h-4" />
                                                                🆓 Free for Everyone
                                                            </>
                                                        )}
                                                    </span>
                                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${
                                                        item.isMembersOnly ? 'bg-amber-400' : 'bg-green-400'
                                                    }`}>
                                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                                            item.isMembersOnly ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center">
                    <button
                        type="button"
                        onClick={() => navigate('/playlists')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            onClick={() => setFormData({ ...formData, status: 'draft' })}
                            disabled={loading || uploading}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Save as Draft
                        </button>
                        <button
                            type="submit"
                            onClick={() => setFormData({ ...formData, status: 'published' })}
                            disabled={loading || uploading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save & Publish'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default PlaylistForm;
