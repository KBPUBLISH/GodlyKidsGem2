import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, Save, Video, X } from 'lucide-react';
import apiClient from '../services/apiClient';

interface BookFormData {
    title: string;
    author: string;
    description: string;
    minAge: number;
    category: string;
    coverImage: string;
    status: string;
    orientation: 'portrait' | 'landscape';
    isMembersOnly: boolean;
    introVideoUrl: string;
    bookType: 'standard' | 'kids_monthly';
    featuredCharacterId: string;
}

interface Category {
    _id: string;
    name: string;
}

interface SavedCharacterOption {
    _id: string;
    internalTag: string;
    displayName: string;
}

const BookForm: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingIntroVideo, setUploadingIntroVideo] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string>(''); // Local preview before upload
    const [coverFile, setCoverFile] = useState<File | null>(null); // Store file for re-upload after book creation
    const [introVideoFile, setIntroVideoFile] = useState<File | null>(null); // Store intro video file
    const [introVideoPreview, setIntroVideoPreview] = useState<string>(''); // Local preview for intro video
    const [formData, setFormData] = useState<BookFormData>({
        title: '',
        author: '',
        description: '',
        minAge: 3,
        category: '',
        coverImage: '',
        status: 'draft',
        orientation: 'portrait',
        isMembersOnly: false,
        introVideoUrl: '',
        bookType: 'standard',
        featuredCharacterId: '',
    });
    const [characters, setCharacters] = useState<SavedCharacterOption[]>([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // Only fetch book categories
                const response = await apiClient.get('/api/categories?type=book');
                setCategories(response.data);
                if (response.data.length > 0 && !formData.category) {
                    setFormData(prev => ({ ...prev, category: response.data[0].name }));
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchCharacters = async () => {
            try {
                const response = await apiClient.get('/api/monthly-book/admin/characters');
                setCharacters(response.data.characters || []);
            } catch (error) {
                console.error('Error fetching characters:', error);
            }
        };
        fetchCharacters();
    }, []);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'minAge' ? parseInt(value) || 0 : value,
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Store the file for later upload (after book creation)
        setCoverFile(file);

        // Show local preview immediately
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);
        
        // Don't upload yet - we'll upload after book creation with bookId
        // This allows us to use the organized folder structure
    };

    const handleIntroVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Store the file for later upload (after book creation)
        setIntroVideoFile(file);

        // Show local preview immediately
        const localPreview = URL.createObjectURL(file);
        setIntroVideoPreview(localPreview);
    };

    const removeIntroVideo = () => {
        if (introVideoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(introVideoPreview);
        }
        setIntroVideoFile(null);
        setIntroVideoPreview('');
        setFormData(prev => ({ ...prev, introVideoUrl: '' }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Step 1: Create the book first (without cover image or intro video)
            const bookData: Record<string, unknown> = { ...formData, coverImage: '', introVideoUrl: '' };
            if (formData.bookType !== 'kids_monthly') {
                bookData.featuredCharacterId = '';
            }
            
            // Create book
            const response = await apiClient.post('/api/books', bookData);
            const newBook = response.data;
            const bookId = newBook._id;
            
            const updateData: { coverImage?: string; introVideoUrl?: string; featuredCharacterId?: string } = {};
            
            // Step 2: Upload cover image with bookId for organized structure
            if (coverFile) {
                setUploading(true);
                const formDataUpload = new FormData();
                formDataUpload.append('file', coverFile);

                try {
                    const uploadResponse = await apiClient.post(
                        `/api/upload/image?bookId=${bookId}&type=cover`,
                        formDataUpload,
                        {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        }
                    );
                    
                    updateData.coverImage = uploadResponse.data.url;
                    
                    // Clean up local preview
                    if (previewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(previewUrl);
                    }
                } catch (uploadError) {
                    console.error('Failed to upload cover image:', uploadError);
                    alert('Book created, but cover image upload failed. You can add it later by editing the book.');
                } finally {
                    setUploading(false);
                }
            }
            
            // Step 3: Upload intro video with bookId
            if (introVideoFile) {
                setUploadingIntroVideo(true);
                const videoFormData = new FormData();
                videoFormData.append('file', introVideoFile);

                try {
                    const uploadResponse = await apiClient.post(
                        `/api/upload/video?bookId=${bookId}&type=intro`,
                        videoFormData,
                        {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        }
                    );
                    
                    updateData.introVideoUrl = uploadResponse.data.url;
                    
                    // Clean up local preview
                    if (introVideoPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(introVideoPreview);
                    }
                } catch (uploadError) {
                    console.error('Failed to upload intro video:', uploadError);
                    alert('Book created, but intro video upload failed. You can add it later by editing the book.');
                } finally {
                    setUploadingIntroVideo(false);
                }
            }
            
            // Step 4: Update book with uploaded files (and featuredCharacterId if set on create)
            if (Object.keys(updateData).length > 0 || (formData.bookType === 'kids_monthly' && formData.featuredCharacterId)) {
                if (formData.bookType === 'kids_monthly' && formData.featuredCharacterId) {
                    updateData.featuredCharacterId = formData.featuredCharacterId;
                }
                await apiClient.put(`/api/books/${bookId}`, updateData);
            }
            
            navigate('/books');
        } catch (error) {
            console.error('Failed to create book:', error);
            alert('Failed to create book');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/books')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800">Create New Book</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                {/* Cover Image */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cover Image
                    </label>
                    <div className="flex items-start gap-4">
                        {(previewUrl || formData.coverImage) ? (
                            <div className="relative">
                            <img
                                    src={previewUrl || formData.coverImage}
                                alt="Cover preview"
                                className="w-32 h-48 object-cover rounded-lg border-2 border-gray-200"
                                    onError={(e) => {
                                        console.error('Image failed to load:', previewUrl || formData.coverImage);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                {uploading && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                        <div className="text-white text-sm">Uploading...</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-32 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                        )}
                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                                id="cover-upload"
                            />
                            <label
                                htmlFor="cover-upload"
                                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors"
                            >
                                {uploading ? 'Uploading...' : 'Upload Cover'}
                            </label>
                            <p className="text-sm text-gray-500 mt-2">
                                Recommended: 400x600px, PNG or JPG
                            </p>
                        </div>
                    </div>
                </div>

                {/* Introduction Video */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Introduction Video (Optional)
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                        This video will play before the book starts. Great for production company intros.
                    </p>
                    <div className="flex items-start gap-4">
                        {(introVideoPreview || formData.introVideoUrl) ? (
                            <div className="relative">
                                <video
                                    src={introVideoPreview || formData.introVideoUrl}
                                    className="w-48 h-32 object-cover rounded-lg border-2 border-gray-200"
                                    controls
                                />
                                <button
                                    type="button"
                                    onClick={removeIntroVideo}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                {uploadingIntroVideo && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                        <div className="text-white text-sm">Uploading...</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-48 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <Video className="w-8 h-8 text-gray-400" />
                            </div>
                        )}
                        <div>
                            <input
                                type="file"
                                accept="video/mp4,video/*"
                                onChange={handleIntroVideoSelect}
                                className="hidden"
                                id="intro-video-upload"
                            />
                            <label
                                htmlFor="intro-video-upload"
                                className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 transition-colors"
                            >
                                {uploadingIntroVideo ? 'Uploading...' : 'Select Intro Video'}
                            </label>
                            <p className="text-sm text-gray-500 mt-2">
                                MP4 recommended. Will upload when you save.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="mb-6">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Title *
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter book title"
                    />
                </div>

                {/* Author */}
                <div className="mb-6">
                    <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                        Author *
                    </label>
                    <input
                        type="text"
                        id="author"
                        name="author"
                        value={formData.author}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter author name"
                    />
                </div>

                {/* Description */}
                <div className="mb-6">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter book description"
                    />
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Min Age */}
                    <div>
                        <label htmlFor="minAge" className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Age
                        </label>
                        <input
                            type="number"
                            id="minAge"
                            name="minAge"
                            value={formData.minAge}
                            onChange={handleInputChange}
                            min="0"
                            max="18"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                        </label>
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer min-h-[44px]"
                            required
                        >
                            {categories.length === 0 ? (
                                <option value="">Loading categories...</option>
                            ) : (
                                categories.map((cat) => (
                                    <option key={cat._id} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                </div>

                {/* Book type & Featured character (Kids Monthly Book) */}
                <div className="mb-6">
                    <label htmlFor="bookType" className="block text-sm font-medium text-gray-700 mb-2">
                        Book type
                    </label>
                    <select
                        id="bookType"
                        name="bookType"
                        value={formData.bookType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, bookType: e.target.value as 'standard' | 'kids_monthly', featuredCharacterId: e.target.value === 'kids_monthly' ? prev.featuredCharacterId : '' }))}
                        className="w-full max-w-xs px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer min-h-[44px]"
                    >
                        <option value="standard">Standard Book</option>
                        <option value="kids_monthly">Kids Monthly Book</option>
                    </select>
                    {formData.bookType === 'kids_monthly' && (
                        <div className="mt-4">
                            <label htmlFor="featuredCharacterId" className="block text-sm font-medium text-gray-700 mb-2">
                                Featured character (optional)
                            </label>
                            <select
                                id="featuredCharacterId"
                                name="featuredCharacterId"
                                value={formData.featuredCharacterId}
                                onChange={(e) => setFormData((prev) => ({ ...prev, featuredCharacterId: e.target.value }))}
                                className="w-full max-w-md px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer min-h-[44px]"
                            >
                                <option value="">— None —</option>
                                {characters.map((c) => (
                                    <option key={c._id} value={c._id}>
                                        {c.displayName} ({c.internalTag})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Link this book to a character from Kids Monthly Book Character Design (e.g. Journey with Noah).</p>
                        </div>
                    )}
                </div>

                {/* Status, Orientation & Access */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <select
                            id="status"
                            name="status"
                            value={formData.status}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer min-h-[44px]"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Orientation
                        </label>
                        <div 
                            onClick={() => setFormData({ ...formData, orientation: formData.orientation === 'portrait' ? 'landscape' : 'portrait' })}
                            className={`w-full rounded-lg border text-base px-4 py-3 transition cursor-pointer min-h-[44px] flex items-center justify-between ${
                                formData.orientation === 'landscape' 
                                    ? 'bg-blue-50 border-blue-300 text-blue-800' 
                                    : 'bg-purple-50 border-purple-300 text-purple-800'
                            }`}
                        >
                            <span className="font-medium">
                                {formData.orientation === 'landscape' ? '📺 Landscape' : '📱 Portrait'}
                            </span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${
                                formData.orientation === 'landscape' ? 'bg-blue-400' : 'bg-purple-400'
                            }`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    formData.orientation === 'landscape' ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {formData.orientation === 'landscape' 
                                ? 'Horizontal view for wider videos' 
                                : 'Vertical view (default)'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Access
                        </label>
                        <div 
                            onClick={() => setFormData({ ...formData, isMembersOnly: !formData.isMembersOnly })}
                            className={`w-full rounded-lg border text-base px-4 py-3 transition cursor-pointer min-h-[44px] flex items-center justify-between ${
                                formData.isMembersOnly 
                                    ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                    : 'bg-green-50 border-green-300 text-green-800'
                            }`}
                        >
                            <span className="font-medium">
                                {formData.isMembersOnly ? '👑 Members Only' : '🆓 Free for All'}
                            </span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${
                                formData.isMembersOnly ? 'bg-amber-400' : 'bg-green-400'
                            }`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    formData.isMembersOnly ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {formData.isMembersOnly 
                                ? 'Only subscribers can access this book' 
                                : 'Everyone can access this book'}
                        </p>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/books')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || uploading || uploadingIntroVideo || !formData.title || !formData.author}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        {loading ? 'Creating...' : 'Create Book'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BookForm;
