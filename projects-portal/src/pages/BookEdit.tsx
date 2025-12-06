import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Upload, X, Music, Gamepad2, Globe, Trash2, Video } from 'lucide-react';
import apiClient from '../services/apiClient';
import ContentAnalytics from '../components/ContentAnalytics';

const BookEdit: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();

    // Form state
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [minAge, setMinAge] = useState<number | ''>('');
    const [category, setCategory] = useState('Other');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [status, setStatus] = useState('draft');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [isMembersOnly, setIsMembersOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [audioFiles, setAudioFiles] = useState<Array<{ url: string; filename: string; uploadedAt?: string }>>([]);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const [availableGames, setAvailableGames] = useState<Array<{ gameId: string; name: string; enabled: boolean }>>([]);
    const [selectedGames, setSelectedGames] = useState<string[]>([]);
    const [bookGames, setBookGames] = useState<Array<{ _id?: string; title: string; url: string; coverImage?: string; description?: string }>>([]);
    const [editingBookGame, setEditingBookGame] = useState<number | null>(null);
    const [newBookGame, setNewBookGame] = useState<{ title: string; url: string; coverImage?: string; description?: string }>({ title: '', url: '', coverImage: '', description: '' });
    const [uploadingGameCover, setUploadingGameCover] = useState(false);
    const gameCoverInputRef = useRef<HTMLInputElement>(null);
    const [bookVideos, setBookVideos] = useState<Array<{ _id?: string; title: string; videoUrl: string; thumbnailUrl?: string; description?: string }>>([]);
    const [editingBookVideo, setEditingBookVideo] = useState<number | null>(null);
    const [newBookVideo, setNewBookVideo] = useState<{ title: string; videoUrl: string; thumbnailUrl?: string; description?: string }>({ title: '', videoUrl: '', thumbnailUrl: '', description: '' });
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingVideoThumbnail, setUploadingVideoThumbnail] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const videoThumbnailInputRef = useRef<HTMLInputElement>(null);

    // Load existing book data
    useEffect(() => {
        const fetchBook = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/books/${bookId}`);
                const b = res.data;
                setTitle(b.title || '');
                setAuthor(b.author || '');
                setDescription(b.description || '');
                setCoverImage(b.coverImage || '');
                setPreviewImage(b.coverImage || '');
                setMinAge(b.minAge ?? '');
                setCategory(b.category || 'Other');
                setStatus(b.status || 'draft');
                setOrientation(b.orientation || 'portrait');
                setIsMembersOnly(b.isMembersOnly || false);
                
                // Load categories array
                if (b.categories && Array.isArray(b.categories)) {
                    setSelectedCategories(b.categories);
                } else if (b.category) {
                    // Fallback to single category if categories array doesn't exist
                    setSelectedCategories([b.category]);
                }
                
                // Load audio files
                if (b.files && b.files.audio && Array.isArray(b.files.audio)) {
                    setAudioFiles(b.files.audio);
                } else {
                    setAudioFiles([]);
                }
                
                // Load associated games
                if (b.games && Array.isArray(b.games)) {
                    setSelectedGames(b.games);
                } else {
                    setSelectedGames([]);
                }
                
                // Load book-specific games
                if (b.bookGames && Array.isArray(b.bookGames)) {
                    setBookGames(b.bookGames);
                } else {
                    setBookGames([]);
                }
                
                // Load book-specific videos
                if (b.bookVideos && Array.isArray(b.bookVideos)) {
                    setBookVideos(b.bookVideos);
                } else {
                    setBookVideos([]);
                }
            } catch (err) {
                console.error('Failed to fetch book:', err);
            } finally {
                setFetching(false);
            }
        };
        fetchBook();
    }, [bookId]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // Only fetch book categories
                const response = await apiClient.get('/api/categories?type=book');
                // Handle paginated response or direct array
                const categoriesData = Array.isArray(response.data) 
                    ? response.data 
                    : (response.data.data || response.data.categories || []);
                setCategories(categoriesData);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchGames = async () => {
            try {
                const response = await apiClient.get('/api/games');
                // Handle paginated response or direct array
                const gamesData = Array.isArray(response.data) 
                    ? response.data 
                    : (response.data.data || response.data.games || []);
                setAvailableGames(gamesData);
            } catch (error) {
                console.error('Error fetching games:', error);
            }
        };
        fetchGames();
    }, []);

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        setUploading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            // Upload with bookId and type=cover for organized structure
            const response = await apiClient.post(
                `/api/upload/image?bookId=${bookId}&type=cover`,
                formDataUpload,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );
            setCoverImage(response.data.url);
            setPreviewImage(response.data.url);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
    };

    const handleRemoveImage = () => {
        setCoverImage('');
        setPreviewImage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAudioUpload = async (file: File) => {
        if (!file.type.startsWith('audio/')) {
            alert('Please select an audio file');
            return;
        }

        if (!bookId) {
            alert('Book ID is required');
            return;
        }

        setUploadingAudio(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await apiClient.post(
                `/api/upload/audio?bookId=${bookId}`,
                formDataUpload,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );
            
            // Add new audio file to the list
            const newAudio = {
                url: response.data.url,
                filename: response.data.filename || file.name,
                uploadedAt: new Date().toISOString(),
            };
            setAudioFiles([...audioFiles, newAudio]);
        } catch (error: any) {
            console.error('Audio upload failed:', error);
            let errorMessage = 'Failed to upload audio file';
            
            if (error.response) {
                // Server responded with error
                errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
            } else if (error.request) {
                // Request made but no response (network error)
                errorMessage = 'Network error: Could not reach server. Is the backend running?';
            } else {
                // Something else happened
                errorMessage = error.message || 'Unknown error occurred';
            }
            
            alert(`Failed to upload audio file:\n${errorMessage}`);
        } finally {
            setUploadingAudio(false);
            if (audioInputRef.current) {
                audioInputRef.current.value = '';
            }
        }
    };

    const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleAudioUpload(file);
        }
    };

    const handleRemoveAudio = (index: number) => {
        setAudioFiles(audioFiles.filter((_, i) => i !== index));
    };

    const handleVideoUpload = async (file: File) => {
        if (!file.type.startsWith('video/') && !file.name.endsWith('.mp4')) {
            alert('Please select an MP4 video file');
            return;
        }

        if (!bookId) {
            alert('Book ID is required');
            return;
        }

        setUploadingVideo(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await apiClient.post(
                `/api/upload/video?bookId=${bookId}&type=video`,
                formDataUpload,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            );
            setNewBookVideo({ ...newBookVideo, videoUrl: response.data.url });
        } catch (error: any) {
            console.error('Video upload failed:', error);
            let errorMessage = 'Failed to upload video file';
            
            if (error.response) {
                errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
            } else if (error.request) {
                errorMessage = 'Network error: Could not reach server. Is the backend running?';
            } else {
                errorMessage = error.message || 'Unknown error occurred';
            }
            
            alert(`Failed to upload video file:\n${errorMessage}`);
        } finally {
            setUploadingVideo(false);
            if (videoInputRef.current) {
                videoInputRef.current.value = '';
            }
        }
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleVideoUpload(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookId) return;
        setLoading(true);
        try {
            const payload = {
                title,
                author,
                description,
                coverImage,
                minAge: minAge === '' ? undefined : minAge,
                category: selectedCategories.length > 0 ? selectedCategories[0] : category, // Keep for backward compatibility
                categories: selectedCategories.length > 0 ? selectedCategories : (category ? [category] : []),
                status,
                orientation,
                isMembersOnly,
                files: {
                    coverImage: coverImage || null,
                    audio: audioFiles,
                },
                games: selectedGames,
                bookGames: bookGames,
                bookVideos: bookVideos,
            };
            console.log('Updating book with payload:', payload);
            await apiClient.put(`/api/books/${bookId}`, payload);
            navigate('/books');
        } catch (err) {
            console.error('Error updating book:', err);
            alert('Failed to update book. Please check the console for details.');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="p-6 text-center">Loading book data...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Edit Book</h2>
            
            {/* Analytics Section */}
            {bookId && (
                <div className="mb-6">
                    <ContentAnalytics contentId={bookId} contentType="book" />
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-3 py-2 transition"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                    <input
                        type="text"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-3 py-2 transition"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                        rows={4}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-3 py-2 transition"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                    <div className="flex items-start gap-4">
                        {previewImage ? (
                            <div className="relative">
                                <img
                                    src={previewImage}
                                    alt="Cover preview"
                                    className="w-32 h-48 object-cover rounded-lg border-2 border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-32 h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                        )}
                        <div className="flex-1">
                            <div
                                ref={dropZoneRef}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                    isDragging
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="cover-upload"
                                />
                                <label
                                    htmlFor="cover-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Upload className={`w-8 h-8 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
                                    <span className="text-sm text-gray-600">
                                        {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        PNG, JPG, GIF up to 10MB
                                    </span>
                                </label>
                            </div>
                            {uploading && (
                                <p className="text-sm text-indigo-600 mt-2">Uploading...</p>
                            )}
                            <p className="text-sm text-gray-500 mt-2">
                                Recommended: 400x600px, PNG or JPG
                            </p>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Age</label>
                    <input
                        type="number"
                        min={0}
                        max={18}
                        value={minAge}
                        onChange={e => setMinAge(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className="w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-3 py-2 transition"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categories (Select Multiple)</label>
                    <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
                        {categories.length === 0 ? (
                            <p className="text-sm text-gray-500">Loading categories...</p>
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
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-4 py-3 transition cursor-pointer min-h-[44px]"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Orientation</label>
                        <div 
                            onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
                            className={`w-full rounded-md border text-base px-4 py-3 transition cursor-pointer min-h-[44px] flex items-center justify-between ${
                                orientation === 'landscape' 
                                    ? 'bg-blue-50 border-blue-300 text-blue-800' 
                                    : 'bg-purple-50 border-purple-300 text-purple-800'
                            }`}
                        >
                            <span className="font-medium">
                                {orientation === 'landscape' ? '📺 Landscape' : '📱 Portrait'}
                            </span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${
                                orientation === 'landscape' ? 'bg-blue-400' : 'bg-purple-400'
                            }`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    orientation === 'landscape' ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {orientation === 'landscape' 
                                ? 'Horizontal view for wider videos' 
                                : 'Vertical view (default)'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Access</label>
                        <div 
                            onClick={() => setIsMembersOnly(!isMembersOnly)}
                            className={`w-full rounded-md border text-base px-4 py-3 transition cursor-pointer min-h-[44px] flex items-center justify-between ${
                                isMembersOnly 
                                    ? 'bg-amber-50 border-amber-300 text-amber-800' 
                                    : 'bg-green-50 border-green-300 text-green-800'
                            }`}
                        >
                            <span className="font-medium">
                                {isMembersOnly ? '👑 Members Only' : '🆓 Free for All'}
                            </span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${
                                isMembersOnly ? 'bg-amber-400' : 'bg-green-400'
                            }`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    isMembersOnly ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {isMembersOnly 
                                ? 'Only subscribers can access this book' 
                                : 'Everyone can access this book'}
                        </p>
                    </div>
                </div>
                
                {/* Background Music Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Background Music
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Upload audio files to play as background music in the book reader. The first file will be used by default.
                    </p>
                    
                    {/* Existing Audio Files */}
                    {audioFiles.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {audioFiles.map((audio, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Music className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {audio.filename}
                                            </p>
                                            {audio.uploadedAt && (
                                                <p className="text-xs text-gray-500">
                                                    {new Date(audio.uploadedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveAudio(index)}
                                        className="ml-3 p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                        title="Remove audio file"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Upload Audio Button */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors">
                        <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioSelect}
                            className="hidden"
                            id="audio-upload"
                        />
                        <label
                            htmlFor="audio-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                        >
                            <Music className={`w-8 h-8 ${uploadingAudio ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                            <span className="text-sm text-gray-600">
                                {uploadingAudio ? 'Uploading...' : 'Click to upload audio file'}
                            </span>
                            <span className="text-xs text-gray-500">
                                MP3, WAV, M4A up to 50MB
                            </span>
                        </label>
                    </div>
                </div>
                
                {/* Games Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Gamepad2 className="w-4 h-4 inline mr-2" />
                        Associated Games
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Select which games should be available for this book. Users will be able to access these games from the book detail page.
                    </p>
                    
                    {availableGames.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No games available. Please create games in the Games management page first.</p>
                    ) : (
                        <div className="space-y-2">
                            {availableGames
                                .filter(game => game.enabled) // Only show enabled games
                                .map((game) => (
                                    <label
                                        key={game.gameId}
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedGames.includes(game.gameId)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedGames([...selectedGames, game.gameId]);
                                                } else {
                                                    setSelectedGames(selectedGames.filter(id => id !== game.gameId));
                                                }
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-gray-900">{game.name}</span>
                                            {!game.enabled && (
                                                <span className="ml-2 text-xs text-gray-500">(Disabled)</span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                        </div>
                    )}
                </div>
                
                {/* Book-Specific Games Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Globe className="w-4 h-4 inline mr-2" />
                        Book-Specific Games (Webview)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Add custom games that unlock after users complete reading this book. These games open in a webview with the URL you provide.
                    </p>
                    
                    {/* Existing Book Games */}
                    {bookGames.length > 0 && (
                        <div className="mb-4 space-y-3">
                            {bookGames.map((game, index) => (
                                <div
                                    key={index}
                                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-4"
                                >
                                    {game.coverImage && (
                                        <img
                                            src={game.coverImage}
                                            alt={game.title}
                                            className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 truncate">{game.title}</h4>
                                        {game.description && (
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{game.description}</p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                            <Globe className="w-3 h-3 inline mr-1" />
                                            {game.url}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingBookGame(index);
                                                setNewBookGame({ ...game });
                                            }}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                            title="Edit game"
                                        >
                                            <X className="w-4 h-4 rotate-45" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBookGames(bookGames.filter((_, i) => i !== index));
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete game"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Add/Edit Book Game Form */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                        <h4 className="font-semibold text-gray-700">
                            {editingBookGame !== null ? 'Edit Game' : 'Add New Game'}
                        </h4>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Game Title *</label>
                            <input
                                type="text"
                                value={newBookGame.title}
                                onChange={(e) => setNewBookGame({ ...newBookGame, title: e.target.value })}
                                placeholder="e.g., Memory Match Game"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Game URL *</label>
                            <input
                                type="url"
                                value={newBookGame.url}
                                onChange={(e) => setNewBookGame({ ...newBookGame, url: e.target.value })}
                                placeholder="https://example.com/game"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                                value={newBookGame.description}
                                onChange={(e) => setNewBookGame({ ...newBookGame, description: e.target.value })}
                                placeholder="Optional description of the game"
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                            {newBookGame.coverImage && (
                                <div className="mb-2 relative inline-block">
                                    <img
                                        src={newBookGame.coverImage}
                                        alt="Game cover"
                                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewBookGame({ ...newBookGame, coverImage: '' });
                                            if (gameCoverInputRef.current) {
                                                gameCoverInputRef.current.value = '';
                                            }
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors">
                                <input
                                    ref={gameCoverInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file && bookId) {
                                            setUploadingGameCover(true);
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const response = await apiClient.post(
                                                    `/api/upload/image?bookId=${bookId}&type=game-cover`,
                                                    formData,
                                                    { headers: { 'Content-Type': 'multipart/form-data' } }
                                                );
                                                setNewBookGame({ ...newBookGame, coverImage: response.data.url || '' });
                                            } catch (error) {
                                                console.error('Failed to upload game cover:', error);
                                                alert('Failed to upload cover image');
                                            } finally {
                                                setUploadingGameCover(false);
                                            }
                                        }
                                    }}
                                    className="hidden"
                                    id="game-cover-upload"
                                />
                                <label
                                    htmlFor="game-cover-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Upload className={`w-6 h-6 ${uploadingGameCover ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                    <span className="text-xs text-gray-600">
                                        {uploadingGameCover ? 'Uploading...' : 'Upload cover image'}
                                    </span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (newBookGame.title && newBookGame.url) {
                                        if (editingBookGame !== null) {
                                            // Update existing game
                                            const updated = [...bookGames];
                                            updated[editingBookGame] = { ...newBookGame };
                                            setBookGames(updated);
                                            setEditingBookGame(null);
                                        } else {
                                            // Add new game
                                            setBookGames([...bookGames, { ...newBookGame }]);
                                        }
                                        setNewBookGame({ title: '', url: '', coverImage: '', description: '' });
                                        if (gameCoverInputRef.current) {
                                            gameCoverInputRef.current.value = '';
                                        }
                                    } else {
                                        alert('Please fill in at least Title and URL');
                                    }
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {editingBookGame !== null ? 'Update Game' : 'Add Game'}
                            </button>
                            {editingBookGame !== null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingBookGame(null);
                                        setNewBookGame({ title: '', url: '', coverImage: '', description: '' });
                                        if (gameCoverInputRef.current) {
                                            gameCoverInputRef.current.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Book-Specific Videos Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Video className="w-4 h-4 inline mr-2" />
                        Book-Specific Videos (Unlockable)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Add MP4 videos that unlock after users complete reading this book. These videos can be educational content, bonus stories, or interactive experiences.
                    </p>
                    
                    {/* Existing Book Videos */}
                    {bookVideos.length > 0 && (
                        <div className="mb-4 space-y-3">
                            {bookVideos.map((video, index) => (
                                <div
                                    key={index}
                                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-4"
                                >
                                    {video.thumbnailUrl && (
                                        <div className="relative w-32 h-20 flex-shrink-0">
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={video.title}
                                                className="w-full h-full object-cover rounded-lg border-2 border-gray-300"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                                                <Video className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 truncate">{video.title}</h4>
                                        {video.description && (
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{video.description}</p>
                                        )}
                                        {video.videoUrl && (
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                                <Video className="w-3 h-3 inline mr-1" />
                                                Video uploaded
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingBookVideo(index);
                                                setNewBookVideo({ ...video });
                                            }}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                            title="Edit video"
                                        >
                                            <X className="w-4 h-4 rotate-45" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBookVideos(bookVideos.filter((_, i) => i !== index));
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete video"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Add/Edit Book Video Form */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                        <h4 className="font-semibold text-gray-700">
                            {editingBookVideo !== null ? 'Edit Video' : 'Add New Video'}
                        </h4>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Video Title *</label>
                            <input
                                type="text"
                                value={newBookVideo.title}
                                onChange={(e) => setNewBookVideo({ ...newBookVideo, title: e.target.value })}
                                placeholder="e.g., Bonus Story: The Lost Treasure"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Video File (MP4) *</label>
                            {newBookVideo.videoUrl && (
                                <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800 flex items-center gap-2">
                                        <Video className="w-4 h-4" />
                                        Video uploaded successfully
                                    </p>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors">
                                <input
                                    ref={videoInputRef}
                                    type="file"
                                    accept="video/mp4,video/*"
                                    onChange={handleVideoSelect}
                                    className="hidden"
                                    id="video-upload"
                                />
                                <label
                                    htmlFor="video-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Video className={`w-6 h-6 ${uploadingVideo ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                    <span className="text-xs text-gray-600">
                                        {uploadingVideo ? 'Uploading...' : 'Upload MP4 video file'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        MP4 format, up to 500MB
                                    </span>
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail Image</label>
                            {newBookVideo.thumbnailUrl && (
                                <div className="mb-2 relative inline-block">
                                    <img
                                        src={newBookVideo.thumbnailUrl}
                                        alt="Video thumbnail"
                                        className="w-32 h-20 object-cover rounded-lg border-2 border-gray-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewBookVideo({ ...newBookVideo, thumbnailUrl: '' });
                                            if (videoThumbnailInputRef.current) {
                                                videoThumbnailInputRef.current.value = '';
                                            }
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-indigo-400 transition-colors">
                                <input
                                    ref={videoThumbnailInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file && bookId) {
                                            setUploadingVideoThumbnail(true);
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const response = await apiClient.post(
                                                    `/api/upload/image?bookId=${bookId}&type=cover`,
                                                    formData,
                                                    { headers: { 'Content-Type': 'multipart/form-data' } }
                                                );
                                                setNewBookVideo({ ...newBookVideo, thumbnailUrl: response.data.url || '' });
                                            } catch (error) {
                                                console.error('Failed to upload video thumbnail:', error);
                                                alert('Failed to upload thumbnail image');
                                            } finally {
                                                setUploadingVideoThumbnail(false);
                                            }
                                        }
                                    }}
                                    className="hidden"
                                    id="video-thumbnail-upload"
                                />
                                <label
                                    htmlFor="video-thumbnail-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Upload className={`w-6 h-6 ${uploadingVideoThumbnail ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                                    <span className="text-xs text-gray-600">
                                        {uploadingVideoThumbnail ? 'Uploading...' : 'Upload thumbnail image'}
                                    </span>
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <textarea
                                value={newBookVideo.description}
                                onChange={(e) => setNewBookVideo({ ...newBookVideo, description: e.target.value })}
                                placeholder="Optional description of the video"
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (newBookVideo.title && newBookVideo.videoUrl) {
                                        if (editingBookVideo !== null) {
                                            // Update existing video
                                            const updated = [...bookVideos];
                                            updated[editingBookVideo] = { ...newBookVideo };
                                            setBookVideos(updated);
                                            setEditingBookVideo(null);
                                        } else {
                                            // Add new video
                                            setBookVideos([...bookVideos, { ...newBookVideo }]);
                                        }
                                        setNewBookVideo({ title: '', videoUrl: '', thumbnailUrl: '', description: '' });
                                        if (videoInputRef.current) {
                                            videoInputRef.current.value = '';
                                        }
                                        if (videoThumbnailInputRef.current) {
                                            videoThumbnailInputRef.current.value = '';
                                        }
                                    } else {
                                        alert('Please fill in at least Title and upload a Video file');
                                    }
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {editingBookVideo !== null ? 'Update Video' : 'Add Video'}
                            </button>
                            {editingBookVideo !== null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingBookVideo(null);
                                        setNewBookVideo({ title: '', videoUrl: '', thumbnailUrl: '', description: '' });
                                        if (videoInputRef.current) {
                                            videoInputRef.current.value = '';
                                        }
                                        if (videoThumbnailInputRef.current) {
                                            videoThumbnailInputRef.current.value = '';
                                        }
                                    }}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => navigate('/books')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || uploading}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : <><Plus className="w-5 h-5" /> Save Changes</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BookEdit;
