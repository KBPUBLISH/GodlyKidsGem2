import React, { useState, useEffect, useRef } from 'react';
import { 
    Image, Upload, Trash2, Plus, Search, Filter, 
    Eye, Edit2, Check, X, Grid, List, Sparkles
} from 'lucide-react';
import apiClient from '../services/apiClient';

interface StoryBackground {
    _id: string;
    name: string;
    description?: string;
    imageUrl: string;
    thumbnailUrl?: string;
    category: string;
    tags: string[];
    moodTags: string[];
    goalTags: string[];
    suggestedCharacterPosition: {
        x: number;
        y: number;
        scale: number;
    };
    orientation: string;
    isPremium: boolean;
    status: string;
    useCount: number;
    createdAt: string;
}

interface CategoryOption {
    id: string;
    name: string;
    emoji: string;
    description: string;
}

interface MoodOption {
    id: string;
    name: string;
    emoji: string;
}

const GOAL_TAGS = ['courage', 'faith', 'gratitude', 'love', 'obedience', 'self-control', 'theology', 'wisdom'];

const GOAL_COLORS: Record<string, string> = {
    courage: 'bg-orange-100 text-orange-700 border-orange-200',
    faith: 'bg-purple-100 text-purple-700 border-purple-200',
    gratitude: 'bg-pink-100 text-pink-700 border-pink-200',
    love: 'bg-red-100 text-red-700 border-red-200',
    obedience: 'bg-blue-100 text-blue-700 border-blue-200',
    'self-control': 'bg-green-100 text-green-700 border-green-200',
    theology: 'bg-amber-100 text-amber-700 border-amber-200',
    wisdom: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const MOOD_COLORS: Record<string, string> = {
    happy: 'bg-yellow-100 text-yellow-700',
    calm: 'bg-blue-100 text-blue-700',
    adventurous: 'bg-orange-100 text-orange-700',
    mysterious: 'bg-purple-100 text-purple-700',
    peaceful: 'bg-green-100 text-green-700',
    exciting: 'bg-red-100 text-red-700',
    cozy: 'bg-amber-100 text-amber-700',
    dramatic: 'bg-gray-100 text-gray-700',
};

const StoryBackgroundLibrary: React.FC = () => {
    const [backgrounds, setBackgrounds] = useState<StoryBackground[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [moods, setMoods] = useState<MoodOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterGoal, setFilterGoal] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedBackground, setSelectedBackground] = useState<StoryBackground | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    // Upload form state
    const [uploadForm, setUploadForm] = useState({
        name: '',
        description: '',
        category: 'other',
        tags: [] as string[],
        moodTags: [] as string[],
        goalTags: [] as string[],
        orientation: 'portrait',
    });
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchOptions();
        fetchBackgrounds();
    }, [filterCategory, filterGoal]);

    const fetchOptions = async () => {
        try {
            const response = await apiClient.get('/api/story-backgrounds/options');
            setCategories(response.data.categories);
            setMoods(response.data.moods);
        } catch (error) {
            console.error('Error fetching options:', error);
        }
    };

    const fetchBackgrounds = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterCategory) params.append('category', filterCategory);
            if (filterGoal) params.append('goalTags', filterGoal);
            
            const response = await apiClient.get(`/api/story-backgrounds?${params}`);
            setBackgrounds(response.data.backgrounds);
        } catch (error) {
            console.error('Error fetching backgrounds:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadForm.name) {
            alert('Please select an image and provide a name');
            return;
        }

        try {
            setUploading(true);
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target?.result as string;
                
                const response = await apiClient.post('/api/story-backgrounds', {
                    imageBase64: base64,
                    ...uploadForm,
                });
                
                setBackgrounds(prev => [response.data.background, ...prev]);
                setShowUploadModal(false);
                resetUploadForm();
            };
            reader.readAsDataURL(uploadFile);
        } catch (error) {
            console.error('Error uploading background:', error);
            alert('Failed to upload background');
        } finally {
            setUploading(false);
        }
    };

    const resetUploadForm = () => {
        setUploadForm({
            name: '',
            description: '',
            category: 'other',
            tags: [],
            moodTags: [],
            goalTags: [],
            orientation: 'portrait',
        });
        setUploadFile(null);
        setPreviewImage(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this background?')) return;
        
        try {
            await apiClient.delete(`/api/story-backgrounds/${id}`);
            setBackgrounds(prev => prev.filter(bg => bg._id !== id));
        } catch (error) {
            console.error('Error deleting background:', error);
        }
    };

    const toggleGoalTag = (tag: string) => {
        setUploadForm(prev => ({
            ...prev,
            goalTags: prev.goalTags.includes(tag)
                ? prev.goalTags.filter(t => t !== tag)
                : [...prev.goalTags, tag]
        }));
    };

    const toggleMoodTag = (tag: string) => {
        setUploadForm(prev => ({
            ...prev,
            moodTags: prev.moodTags.includes(tag)
                ? prev.moodTags.filter(t => t !== tag)
                : [...prev.moodTags, tag]
        }));
    };

    const filteredBackgrounds = backgrounds.filter(bg => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return bg.name.toLowerCase().includes(query) || 
                   bg.description?.toLowerCase().includes(query) ||
                   bg.tags.some(t => t.toLowerCase().includes(query));
        }
        return true;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Image className="w-7 h-7 text-indigo-600" />
                        Story Background Library
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Upload and manage backgrounds for illustrated stories
                    </p>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Background
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search backgrounds..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                {/* Category Filter */}
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.name}
                        </option>
                    ))}
                </select>

                {/* Goal Filter */}
                <select
                    value={filterGoal}
                    onChange={(e) => setFilterGoal(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All Goals</option>
                    {GOAL_TAGS.map(goal => (
                        <option key={goal} value={goal}>
                            {goal.charAt(0).toUpperCase() + goal.slice(1)}
                        </option>
                    ))}
                </select>

                {/* View Toggle */}
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
                    >
                        <Grid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
                    >
                        <List className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                /* Background Grid/List */
                <div className={viewMode === 'grid' 
                    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                    : 'space-y-4'
                }>
                    {filteredBackgrounds.map(bg => (
                        <div
                            key={bg._id}
                            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow ${
                                viewMode === 'list' ? 'flex items-center' : ''
                            }`}
                        >
                            {/* Image */}
                            <div className={`relative ${viewMode === 'list' ? 'w-32 h-24 flex-shrink-0' : 'aspect-[3/4]'}`}>
                                <img
                                    src={bg.imageUrl}
                                    alt={bg.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setSelectedBackground(bg)}
                                            className="p-2 bg-white rounded-full shadow-lg mr-2"
                                        >
                                            <Eye className="w-4 h-4 text-gray-700" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(bg._id)}
                                            className="p-2 bg-white rounded-full shadow-lg"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Category Badge */}
                                <div className="absolute top-2 left-2">
                                    <span className="px-2 py-1 bg-black/50 text-white text-xs rounded-full">
                                        {categories.find(c => c.id === bg.category)?.emoji}
                                    </span>
                                </div>
                                
                                {/* Premium Badge */}
                                {bg.isPremium && (
                                    <div className="absolute top-2 right-2">
                                        <Sparkles className="w-4 h-4 text-yellow-400" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className={`p-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                                <h3 className="font-semibold text-gray-800 truncate">{bg.name}</h3>
                                
                                {viewMode === 'list' && bg.description && (
                                    <p className="text-sm text-gray-500 truncate mt-1">{bg.description}</p>
                                )}
                                
                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {bg.goalTags.slice(0, viewMode === 'grid' ? 2 : 4).map(tag => (
                                        <span 
                                            key={tag} 
                                            className={`text-xs px-2 py-0.5 rounded-full ${GOAL_COLORS[tag] || 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {bg.goalTags.length > (viewMode === 'grid' ? 2 : 4) && (
                                        <span className="text-xs text-gray-400">
                                            +{bg.goalTags.length - (viewMode === 'grid' ? 2 : 4)}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Use Count */}
                                <div className="text-xs text-gray-400 mt-2">
                                    Used {bg.useCount} times
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredBackgrounds.length === 0 && (
                <div className="text-center py-16">
                    <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No backgrounds found</h3>
                    <p className="text-gray-500 mb-4">
                        {searchQuery || filterCategory || filterGoal 
                            ? 'Try adjusting your filters'
                            : 'Upload your first background to get started'
                        }
                    </p>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        Upload Background
                    </button>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Upload New Background</h2>
                                <button 
                                    onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                                    className="p-2 hover:bg-gray-100 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Background Image *
                                    </label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors"
                                    >
                                        {previewImage ? (
                                            <img 
                                                src={previewImage} 
                                                alt="Preview" 
                                                className="max-h-48 mx-auto rounded-lg"
                                            />
                                        ) : (
                                            <>
                                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                                <p className="text-gray-600">Click to select image</p>
                                                <p className="text-sm text-gray-400">PNG, JPG up to 10MB</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadForm.name}
                                        onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Magical Forest, Cozy Bedroom"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={uploadForm.description}
                                        onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Describe the scene for accessibility..."
                                        rows={2}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setUploadForm(prev => ({ ...prev, category: cat.id }))}
                                                className={`px-3 py-2 rounded-lg border transition-colors ${
                                                    uploadForm.category === cat.id
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {cat.emoji} {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Orientation */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Orientation
                                    </label>
                                    <div className="flex gap-2">
                                        {['portrait', 'landscape', 'square'].map(orient => (
                                            <button
                                                key={orient}
                                                onClick={() => setUploadForm(prev => ({ ...prev, orientation: orient }))}
                                                className={`px-4 py-2 rounded-lg border transition-colors capitalize ${
                                                    uploadForm.orientation === orient
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                {orient}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Learning Goals */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Learning Goals (for smart suggestions)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {GOAL_TAGS.map(goal => (
                                            <button
                                                key={goal}
                                                onClick={() => toggleGoalTag(goal)}
                                                className={`px-3 py-1.5 rounded-full border text-sm transition-colors capitalize ${
                                                    uploadForm.goalTags.includes(goal)
                                                        ? GOAL_COLORS[goal]
                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                            >
                                                {uploadForm.goalTags.includes(goal) && <Check className="w-3 h-3 inline mr-1" />}
                                                {goal}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Mood Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Mood
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {moods.map(mood => (
                                            <button
                                                key={mood.id}
                                                onClick={() => toggleMoodTag(mood.id)}
                                                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                                    uploadForm.moodTags.includes(mood.id)
                                                        ? MOOD_COLORS[mood.id] || 'bg-indigo-100 text-indigo-700'
                                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                            >
                                                {mood.emoji} {mood.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                                <button
                                    onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || !uploadFile || !uploadForm.name}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Upload Background
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {selectedBackground && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedBackground(null)}
                >
                    <div 
                        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative aspect-[3/4] max-h-[60vh]">
                            <img
                                src={selectedBackground.imageUrl}
                                alt={selectedBackground.name}
                                className="w-full h-full object-contain bg-gray-100"
                            />
                            <button
                                onClick={() => setSelectedBackground(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <h2 className="text-xl font-bold">{selectedBackground.name}</h2>
                            {selectedBackground.description && (
                                <p className="text-gray-600 mt-2">{selectedBackground.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                                    {categories.find(c => c.id === selectedBackground.category)?.emoji}{' '}
                                    {selectedBackground.category}
                                </span>
                                {selectedBackground.goalTags.map(tag => (
                                    <span 
                                        key={tag}
                                        className={`px-2 py-1 rounded-full text-sm ${GOAL_COLORS[tag]}`}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryBackgroundLibrary;
