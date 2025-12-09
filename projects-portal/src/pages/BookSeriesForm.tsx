import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, GripVertical, BookOpen, Save, X, Lock, Unlock, Search, Check } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Book {
    _id: string;
    title: string;
    author?: string;
    coverImage?: string;
    description?: string;
    minAge?: number;
    maxAge?: number;
    status: string;
    isMembersOnly?: boolean;
}

interface BookInSeries {
    book: string | Book;
    order: number;
}

interface Category {
    _id: string;
    name: string;
    type: 'book' | 'audio';
}

interface BookSeriesFormData {
    title: string;
    description: string;
    coverImage: string;
    books: BookInSeries[];
    minAge: number;
    maxAge: number;
    level: string;
    category: string;
    status: 'draft' | 'published';
    isMembersOnly: boolean;
    isFeatured: boolean;
    displayOrder: number;
    author: string;
}

const BookSeriesForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showBookPicker, setShowBookPicker] = useState(false);
    const [formData, setFormData] = useState<BookSeriesFormData>({
        title: '',
        description: '',
        coverImage: '',
        books: [],
        minAge: 0,
        maxAge: 12,
        level: 'all',
        category: '',
        status: 'draft',
        isMembersOnly: false,
        isFeatured: false,
        displayOrder: 0,
        author: 'Kingdom Builders Publishing',
    });

    // Selected books with full data for display
    const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);

    useEffect(() => {
        fetchCategories();
        fetchAvailableBooks();
        if (id) {
            fetchSeries();
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            const response = await apiClient.get('/api/categories?type=book');
            const categoriesData = Array.isArray(response.data) 
                ? response.data 
                : (response.data.data || []);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchAvailableBooks = async () => {
        try {
            const response = await apiClient.get('/api/books?status=all');
            const booksData = Array.isArray(response.data) 
                ? response.data 
                : (response.data.data || response.data.books || []);
            setAvailableBooks(booksData);
        } catch (error) {
            console.error('Error fetching books:', error);
        }
    };

    const fetchSeries = async () => {
        try {
            const response = await apiClient.get(`/api/book-series/${id}`);
            const series = response.data;
            
            // Extract book IDs and full book data
            const bookIds = series.books?.map((b: any) => 
                typeof b.book === 'object' ? b.book._id : b.book
            ) || [];
            
            const booksWithData = series.books?.map((b: any) => 
                typeof b.book === 'object' ? b.book : null
            ).filter(Boolean) || [];
            
            setSelectedBooks(booksWithData);
            
            setFormData({
                title: series.title || '',
                description: series.description || '',
                coverImage: series.coverImage || '',
                books: series.books || [],
                minAge: series.minAge || 0,
                maxAge: series.maxAge || 12,
                level: series.level || 'all',
                category: series.category?._id || series.category || '',
                status: series.status || 'draft',
                isMembersOnly: series.isMembersOnly || false,
                isFeatured: series.isFeatured || false,
                displayOrder: series.displayOrder || 0,
                author: series.author || 'Kingdom Builders Publishing',
            });
        } catch (error) {
            console.error('Error fetching book series:', error);
            alert('Failed to load book series');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.coverImage) {
            alert('Please upload a cover image for the series.');
            return;
        }
        
        if (selectedBooks.length === 0) {
            alert('Please add at least one book to the series.');
            return;
        }
        
        setLoading(true);

        try {
            // Prepare payload with book IDs
            const payload = {
                ...formData,
                books: selectedBooks.map(book => book._id),
            };
            
            if (id) {
                await apiClient.put(`/api/book-series/${id}`, payload);
            } else {
                await apiClient.post('/api/book-series', payload);
            }
            navigate('/book-series');
        } catch (error: any) {
            console.error('Error saving book series:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to save book series';
            alert(`Failed to save book series: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const response = await apiClient.post('/api/upload/image', formDataUpload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setFormData(prev => ({ ...prev, coverImage: response.data.url }));
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const addBook = (book: Book) => {
        if (selectedBooks.find(b => b._id === book._id)) {
            return; // Already added
        }
        setSelectedBooks([...selectedBooks, book]);
        setShowBookPicker(false);
        setSearchQuery('');
    };

    const removeBook = (bookId: string) => {
        setSelectedBooks(selectedBooks.filter(b => b._id !== bookId));
    };

    const moveBook = (index: number, direction: 'up' | 'down') => {
        const newBooks = [...selectedBooks];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newBooks.length) return;
        [newBooks[index], newBooks[newIndex]] = [newBooks[newIndex], newBooks[index]];
        setSelectedBooks(newBooks);
    };

    const filteredAvailableBooks = availableBooks.filter(book => {
        const matchesSearch = !searchQuery || 
            book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author?.toLowerCase().includes(searchQuery.toLowerCase());
        const notAlreadyAdded = !selectedBooks.find(b => b._id === book._id);
        return matchesSearch && notAlreadyAdded;
    });

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/book-series')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                    {id ? 'Edit Book Series' : 'Create Book Series'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cover Image */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Cover Image</h2>
                    <div className="flex items-start gap-6">
                        <div className="w-48 h-48 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                            {formData.coverImage ? (
                                <img
                                    src={formData.coverImage}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <BookOpen size={48} className="text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="block">
                                <span className="sr-only">Choose cover image</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    className="block w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-lg file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-indigo-50 file:text-indigo-700
                                        hover:file:bg-indigo-100
                                        cursor-pointer"
                                    disabled={uploading}
                                />
                            </label>
                            {uploading && (
                                <p className="mt-2 text-sm text-indigo-600">Uploading...</p>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                Recommended: 1200x630px, JPG or PNG
                            </p>
                        </div>
                    </div>
                </div>

                {/* Basic Info */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Author
                            </label>
                            <input
                                type="text"
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">Select a category</option>
                                {categories.map((cat) => (
                                    <option key={cat._id} value={cat._id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Level
                            </label>
                            <select
                                value={formData.level}
                                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="all">All Levels</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Min Age
                            </label>
                            <input
                                type="number"
                                value={formData.minAge}
                                onChange={(e) => setFormData({ ...formData, minAge: parseInt(e.target.value) || 0 })}
                                min="0"
                                max="18"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Age
                            </label>
                            <input
                                type="number"
                                value={formData.maxAge}
                                onChange={(e) => setFormData({ ...formData, maxAge: parseInt(e.target.value) || 12 })}
                                min="0"
                                max="18"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Display Order
                            </label>
                            <input
                                type="number"
                                value={formData.displayOrder}
                                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                                min="0"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Settings</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-gray-800">Status</h3>
                                <p className="text-sm text-gray-500">Publish or keep as draft</p>
                            </div>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'published' })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-gray-800">Members Only</h3>
                                <p className="text-sm text-gray-500">Restrict to premium users</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isMembersOnly: !formData.isMembersOnly })}
                                className={`relative w-14 h-7 rounded-full transition-colors ${
                                    formData.isMembersOnly ? 'bg-amber-500' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                    formData.isMembersOnly ? 'left-8' : 'left-1'
                                }`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-gray-800">Featured</h3>
                                <p className="text-sm text-gray-500">Show in featured section</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                                className={`relative w-14 h-7 rounded-full transition-colors ${
                                    formData.isFeatured ? 'bg-indigo-500' : 'bg-gray-300'
                                }`}
                            >
                                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                    formData.isFeatured ? 'left-8' : 'left-1'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Books in Series */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Books in Series</h2>
                        <button
                            type="button"
                            onClick={() => setShowBookPicker(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={18} />
                            Add Book
                        </button>
                    </div>

                    {selectedBooks.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl">
                            <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500">No books added yet. Click "Add Book" to start.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selectedBooks.map((book, index) => (
                                <div
                                    key={book._id}
                                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => moveBook(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                                        >
                                            <GripVertical size={16} className="rotate-180" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveBook(index, 'down')}
                                            disabled={index === selectedBooks.length - 1}
                                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                                        >
                                            <GripVertical size={16} />
                                        </button>
                                    </div>
                                    
                                    <span className="w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full font-bold text-sm">
                                        {index + 1}
                                    </span>
                                    
                                    <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                        {book.coverImage ? (
                                            <img
                                                src={book.coverImage}
                                                alt={book.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <BookOpen size={20} className="text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-800 truncate">{book.title}</h4>
                                        <p className="text-sm text-gray-500 truncate">{book.author}</p>
                                    </div>
                                    
                                    {book.isMembersOnly && (
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                            Premium
                                        </span>
                                    )}
                                    
                                    <button
                                        type="button"
                                        onClick={() => removeBook(book._id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/book-series')}
                        className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                {id ? 'Update Series' : 'Create Series'}
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Book Picker Modal */}
            {showBookPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setShowBookPicker(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">Add Book to Series</h3>
                                <button
                                    onClick={() => setShowBookPicker(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search books..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-[60vh] p-4">
                            {filteredAvailableBooks.length === 0 ? (
                                <div className="text-center py-8">
                                    <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-500">No books found</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredAvailableBooks.map((book) => (
                                        <button
                                            key={book._id}
                                            type="button"
                                            onClick={() => addBook(book)}
                                            className="w-full flex items-center gap-4 p-3 hover:bg-indigo-50 rounded-lg transition-colors text-left"
                                        >
                                            <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                                {book.coverImage ? (
                                                    <img
                                                        src={book.coverImage}
                                                        alt={book.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen size={20} className="text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-800 truncate">{book.title}</h4>
                                                <p className="text-sm text-gray-500 truncate">{book.author}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {book.status === 'draft' && (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                                                        Draft
                                                    </span>
                                                )}
                                                {book.isMembersOnly && (
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                                        Premium
                                                    </span>
                                                )}
                                                <Plus size={20} className="text-indigo-600" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookSeriesForm;

