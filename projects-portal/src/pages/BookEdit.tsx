import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Upload, X, Music } from 'lucide-react';

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
    const [status, setStatus] = useState('draft');
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

    // Load existing book data
    useEffect(() => {
        const fetchBook = async () => {
            if (!bookId) return;
            try {
                const res = await axios.get(`http://localhost:5001/api/books/${bookId}`);
                const b = res.data;
                setTitle(b.title || '');
                setAuthor(b.author || '');
                setDescription(b.description || '');
                setCoverImage(b.coverImage || '');
                setPreviewImage(b.coverImage || '');
                setMinAge(b.minAge ?? '');
                setCategory(b.category || 'Other');
                setStatus(b.status || 'draft');
                
                // Load audio files
                if (b.files && b.files.audio && Array.isArray(b.files.audio)) {
                    setAudioFiles(b.files.audio);
                } else {
                    setAudioFiles([]);
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
                const response = await axios.get('http://localhost:5001/api/categories');
                setCategories(response.data);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
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
            const response = await axios.post(
                `http://localhost:5001/api/upload/image?bookId=${bookId}&type=cover`,
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
            const response = await axios.post(
                `http://localhost:5001/api/upload/audio?bookId=${bookId}`,
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
                category,
                status,
                files: {
                    audio: audioFiles,
                },
            };
            await axios.put(`http://localhost:5001/api/books/${bookId}`, payload);
            navigate('/books');
        } catch (err) {
            console.error('Error updating book:', err);
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent px-4 py-3 transition cursor-pointer min-h-[44px]"
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
