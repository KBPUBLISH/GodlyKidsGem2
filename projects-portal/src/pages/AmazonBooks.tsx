import React, { useEffect, useState, useRef } from 'react';
import { ShoppingCart, Plus, Edit2, Save, X, Upload, Trash2, Star, Eye, ExternalLink, Video, MessageSquare, Image as ImageIcon, CreditCard } from 'lucide-react';
import apiClient from '../services/apiClient';

interface Review {
    _id?: string;
    author: string;
    rating: number;
    text?: string;
    date?: string;
}

interface AmazonBook {
    _id?: string;
    title: string;
    author: string;
    description?: string;
    amazonUrl: string;
    asin?: string;
    price?: string;
    stripePaymentLinkUrl?: string;
    stripePriceId?: string;
    coverImage: string;
    images?: string[];
    promoVideoUrl?: string;
    reviews?: Review[];
    category?: string;
    categories?: string[];
    minAge?: number;
    maxAge?: number;
    status: 'draft' | 'published' | 'archived';
    isFeatured: boolean;
    featuredOrder: number;
    badgeText?: string;
    badgeColor?: string;
    clickCount?: number;
    stripeClickCount?: number;
}

const BADGE_COLORS = [
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
];

const BADGE_PRESETS = [
    'Best Seller',
    'New Release',
    'Staff Pick',
    'Award Winner',
    'Top Rated',
    'Limited Time',
];

const AmazonBooks: React.FC = () => {
    const [books, setBooks] = useState<AmazonBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBook, setEditingBook] = useState<AmazonBook | null>(null);
    const [formData, setFormData] = useState<Partial<AmazonBook> | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const coverInputRef = useRef<HTMLInputElement>(null);
    
    const [newBook, setNewBook] = useState<Partial<AmazonBook>>({
        title: '',
        author: '',
        description: '',
        amazonUrl: '',
        asin: '',
        price: '',
        stripePaymentLinkUrl: '',
        stripePriceId: '',
        coverImage: '',
        images: [],
        promoVideoUrl: '',
        reviews: [],
        category: 'Children\'s Books',
        status: 'draft',
        isFeatured: false,
        featuredOrder: 0,
        badgeText: '',
        badgeColor: '#f59e0b',
    });

    useEffect(() => {
        fetchBooks();
    }, []);

    const fetchBooks = async () => {
        try {
            const response = await apiClient.get('/api/amazon-books?status=all');
            setBooks(response.data?.data || response.data || []);
        } catch (error: any) {
            console.error('Error fetching Amazon books:', error);
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (book: AmazonBook) => {
        setEditingBook(book);
        setFormData({ ...book });
    };

    const handleSave = async () => {
        if (!editingBook || !formData) return;

        try {
            await apiClient.put(`/api/amazon-books/${editingBook._id}`, formData);
            await fetchBooks();
            setEditingBook(null);
            setFormData(null);
        } catch (error: any) {
            console.error('Error saving Amazon book:', error);
            alert(error.response?.data?.message || 'Failed to save book');
        }
    };

    const handleCancel = () => {
        setEditingBook(null);
        setFormData(null);
    };

    const handleDelete = async (book: AmazonBook) => {
        if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return;

        try {
            await apiClient.delete(`/api/amazon-books/${book._id}`);
            await fetchBooks();
        } catch (error: any) {
            console.error('Error deleting Amazon book:', error);
            alert(error.response?.data?.message || 'Failed to delete book');
        }
    };

    const handleCreateBook = async () => {
        if (!newBook.title || !newBook.author || !newBook.coverImage) {
            alert('Please fill in Title, Author, and Cover Image');
            return;
        }
        if (!newBook.amazonUrl && !newBook.stripePaymentLinkUrl && !newBook.stripePriceId) {
            alert('Add at least one purchase method: an Amazon URL, a Stripe Payment Link, or a Stripe Price ID.');
            return;
        }

        try {
            await apiClient.post('/api/amazon-books', newBook);
            await fetchBooks();
            setShowCreateModal(false);
            setNewBook({
                title: '',
                author: '',
                description: '',
                amazonUrl: '',
                asin: '',
                price: '',
                stripePaymentLinkUrl: '',
                stripePriceId: '',
                coverImage: '',
                images: [],
                promoVideoUrl: '',
                reviews: [],
                category: 'Children\'s Books',
                status: 'draft',
                isFeatured: false,
                featuredOrder: 0,
                badgeText: '',
                badgeColor: '#f59e0b',
            });
        } catch (error: any) {
            console.error('Error creating Amazon book:', error);
            alert(error.response?.data?.message || 'Failed to create book');
        }
    };

    const handleImageUpload = async (file: File, isNew: boolean) => {
        setUploadingCover(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        try {
            const response = await apiClient.post(
                `/api/upload/image?bookId=amazon-books&type=cover`,
                uploadFormData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            if (isNew) {
                setNewBook({ ...newBook, coverImage: response.data.url });
            } else if (formData) {
                setFormData({ ...formData, coverImage: response.data.url });
            }
        } catch (error) {
            console.error('Failed to upload cover image:', error);
            alert('Failed to upload cover image');
        } finally {
            setUploadingCover(false);
        }
    };

    const uploadGalleryFile = async (file: File): Promise<string | null> => {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        try {
            const response = await apiClient.post(
                `/api/upload/image?bookId=amazon-books&type=cover`,
                uploadFormData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            return response.data.url as string;
        } catch (error) {
            console.error('Failed to upload gallery image:', error);
            alert('Failed to upload gallery image');
            return null;
        }
    };

    const toggleFeatured = async (book: AmazonBook) => {
        try {
            await apiClient.put(`/api/amazon-books/${book._id}`, {
                isFeatured: !book.isFeatured,
            });
            await fetchBooks();
        } catch (error: any) {
            console.error('Error toggling featured:', error);
            alert(error.response?.data?.message || 'Failed to update');
        }
    };

    const toggleStatus = async (book: AmazonBook) => {
        const newStatus = book.status === 'published' ? 'draft' : 'published';
        try {
            await apiClient.put(`/api/amazon-books/${book._id}`, {
                status: newStatus,
            });
            await fetchBooks();
        } catch (error: any) {
            console.error('Error toggling status:', error);
            alert(error.response?.data?.message || 'Failed to update');
        }
    };

    if (loading) {
        return <div className="p-6 text-center">Loading Amazon books...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <ShoppingCart className="w-8 h-8 text-orange-600" />
                        Amazon Book Store
                    </h1>
                    <p className="text-gray-600 mt-2">Manage real-life books for sale from Amazon</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Amazon Book
                </button>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                    <ShoppingCart className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-gray-800">
                            Published books appear live at <span className="text-orange-700">bookstore.godlykids.com</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Only books with status <span className="font-semibold">Published</span> are visible. Featured books show at the top.
                        </p>
                    </div>
                </div>
                <a
                    href="https://bookstore.godlykids.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-100 transition text-sm font-semibold whitespace-nowrap"
                >
                    Open bookstore
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>

            {books.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center border-2 border-dashed border-gray-300">
                    <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Amazon Books Yet</h3>
                    <p className="text-gray-500 mb-6">
                        Add books from Amazon to display in the Featured carousel.
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 mx-auto"
                    >
                        <Plus className="w-5 h-5" />
                        Add Your First Book
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {books.map((book) => (
                        <div
                            key={book._id}
                            className={`bg-white rounded-lg shadow-md overflow-hidden border-2 transition-all ${
                                book.status === 'published' ? 'border-green-500' : 'border-gray-300'
                            }`}
                        >
                            {/* Cover Image */}
                            <div className="relative h-48 bg-gray-100">
                                {book.coverImage ? (
                                    <img
                                        src={book.coverImage}
                                        alt={book.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        No Image
                                    </div>
                                )}
                                {book.badgeText && (
                                    <div
                                        className="absolute top-2 left-2 px-2 py-1 rounded-full text-white text-xs font-bold"
                                        style={{ backgroundColor: book.badgeColor || '#f59e0b' }}
                                    >
                                        {book.badgeText}
                                    </div>
                                )}
                                {book.price && (
                                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {book.price}
                                    </div>
                                )}
                                {book.isFeatured && (
                                    <div className="absolute bottom-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                        <Star className="w-3 h-3" fill="currentColor" />
                                        Featured
                                    </div>
                                )}
                            </div>

                            {/* Book Info */}
                            <div className="p-4">
                                <h3 className="text-lg font-bold text-gray-800 line-clamp-1">{book.title}</h3>
                                <p className="text-sm text-gray-600">by {book.author}</p>
                                
                                {book.description && (
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{book.description}</p>
                                )}

                                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 flex-wrap">
                                    <Eye className="w-3 h-3" />
                                    <span>{book.clickCount || 0} clicks</span>
                                    <span className="mx-1">|</span>
                                    <span className={`px-2 py-0.5 rounded-full ${
                                        book.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {book.status}
                                    </span>
                                    {(book.stripePaymentLinkUrl || book.stripePriceId) && (
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1" title={`${book.stripeClickCount || 0} Stripe clicks`}>
                                            <CreditCard className="w-3 h-3" />
                                            Stripe
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => handleEdit(book)}
                                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1 text-sm"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => toggleFeatured(book)}
                                        className={`px-3 py-2 rounded-lg transition flex items-center justify-center gap-1 text-sm ${
                                            book.isFeatured
                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                        title={book.isFeatured ? 'Remove from featured' : 'Add to featured'}
                                    >
                                        <Star className="w-3 h-3" fill={book.isFeatured ? 'currentColor' : 'none'} />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(book)}
                                        className={`px-3 py-2 rounded-lg transition text-sm ${
                                            book.status === 'published'
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                        title={book.status === 'published' ? 'Unpublish' : 'Publish'}
                                    >
                                        {book.status === 'published' ? 'Live' : 'Draft'}
                                    </button>
                                    {book.amazonUrl && (
                                        <a
                                            href={book.amazonUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition flex items-center justify-center"
                                            title="View on Amazon"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingBook && formData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Edit Amazon Book</h2>
                            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Cover Image */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image *</label>
                                {formData.coverImage && (
                                    <div className="mb-2 relative inline-block">
                                        <img src={formData.coverImage} alt="Cover" className="w-24 h-32 object-cover rounded-lg border-2 border-gray-300" />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, coverImage: '' })}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-orange-400 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file, false);
                                        }}
                                        className="hidden"
                                        id="cover-upload-edit"
                                    />
                                    <label htmlFor="cover-upload-edit" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className={`w-6 h-6 ${uploadingCover ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
                                        <span className="text-xs text-gray-600">{uploadingCover ? 'Uploading...' : 'Upload cover'}</span>
                                    </label>
                                </div>
                                <input
                                    type="url"
                                    value={formData.coverImage || ''}
                                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                                    placeholder="Or paste image URL"
                                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                                    <input
                                        type="text"
                                        value={formData.title || ''}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Author *</label>
                                    <input
                                        type="text"
                                        value={formData.author || ''}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amazon URL</label>
                                    <input
                                        type="url"
                                        value={formData.amazonUrl || ''}
                                        onChange={(e) => setFormData({ ...formData, amazonUrl: e.target.value })}
                                        placeholder="https://www.amazon.com/dp/..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                                    <input
                                        type="text"
                                        value={formData.price || ''}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="$12.99"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <StripeSection
                                paymentLinkUrl={formData.stripePaymentLinkUrl || ''}
                                priceId={formData.stripePriceId || ''}
                                onChange={(patch) => setFormData({ ...formData, ...patch })}
                                stripeClickCount={formData.stripeClickCount}
                            />

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-gray-700 mb-3">Badge Settings</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Text</label>
                                        <select
                                            value={formData.badgeText || ''}
                                            onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="">No Badge</option>
                                            {BADGE_PRESETS.map(badge => (
                                                <option key={badge} value={badge}>{badge}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Color</label>
                                        <div className="flex gap-2">
                                            {BADGE_COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setFormData({ ...formData, badgeColor: color.value })}
                                                    className={`w-8 h-8 rounded-full border-2 ${formData.badgeColor === color.value ? 'border-gray-800' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <GallerySection
                                images={formData.images || []}
                                onChange={(next) => setFormData({ ...formData, images: next })}
                                uploadFile={uploadGalleryFile}
                            />

                            <VideoSection
                                value={formData.promoVideoUrl || ''}
                                onChange={(v) => setFormData({ ...formData, promoVideoUrl: v })}
                            />

                            <ReviewsSection
                                reviews={formData.reviews || []}
                                onChange={(next) => setFormData({ ...formData, reviews: next })}
                            />

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-gray-700 mb-3">Featured Settings</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.isFeatured || false}
                                            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                            className="w-4 h-4 text-orange-600"
                                        />
                                        <span className="text-sm font-medium">Featured in Carousel</span>
                                    </label>
                                    {formData.isFeatured && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600">Order:</label>
                                            <input
                                                type="number"
                                                value={formData.featuredOrder || 0}
                                                onChange={(e) => setFormData({ ...formData, featuredOrder: parseInt(e.target.value) || 0 })}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                                                min="0"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-between">
                            <button
                                onClick={() => handleDelete(editingBook)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                            <div className="flex gap-3">
                                <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button onClick={handleSave} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-800">Add Amazon Book</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Cover Image */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image *</label>
                                {newBook.coverImage && (
                                    <div className="mb-2 relative inline-block">
                                        <img src={newBook.coverImage} alt="Cover" className="w-24 h-32 object-cover rounded-lg border-2 border-gray-300" />
                                        <button
                                            type="button"
                                            onClick={() => setNewBook({ ...newBook, coverImage: '' })}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-orange-400 transition-colors">
                                    <input
                                        ref={coverInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file, true);
                                        }}
                                        className="hidden"
                                        id="cover-upload-new"
                                    />
                                    <label htmlFor="cover-upload-new" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className={`w-6 h-6 ${uploadingCover ? 'text-orange-500 animate-pulse' : 'text-gray-400'}`} />
                                        <span className="text-xs text-gray-600">{uploadingCover ? 'Uploading...' : 'Upload cover'}</span>
                                    </label>
                                </div>
                                <input
                                    type="url"
                                    value={newBook.coverImage || ''}
                                    onChange={(e) => setNewBook({ ...newBook, coverImage: e.target.value })}
                                    placeholder="Or paste image URL"
                                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                                    <input
                                        type="text"
                                        value={newBook.title || ''}
                                        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                                        placeholder="The Action Bible"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Author *</label>
                                    <input
                                        type="text"
                                        value={newBook.author || ''}
                                        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                                        placeholder="Sergio Cariello"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={newBook.description || ''}
                                    onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                                    placeholder="A great book for kids..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amazon URL</label>
                                    <input
                                        type="url"
                                        value={newBook.amazonUrl || ''}
                                        onChange={(e) => setNewBook({ ...newBook, amazonUrl: e.target.value })}
                                        placeholder="https://www.amazon.com/dp/0781444993"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                                    <input
                                        type="text"
                                        value={newBook.price || ''}
                                        onChange={(e) => setNewBook({ ...newBook, price: e.target.value })}
                                        placeholder="$24.99"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            <StripeSection
                                paymentLinkUrl={newBook.stripePaymentLinkUrl || ''}
                                priceId={newBook.stripePriceId || ''}
                                onChange={(patch) => setNewBook({ ...newBook, ...patch })}
                            />

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-gray-700 mb-3">Badge Settings</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Text</label>
                                        <select
                                            value={newBook.badgeText || ''}
                                            onChange={(e) => setNewBook({ ...newBook, badgeText: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="">No Badge</option>
                                            {BADGE_PRESETS.map(badge => (
                                                <option key={badge} value={badge}>{badge}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Color</label>
                                        <div className="flex gap-2">
                                            {BADGE_COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setNewBook({ ...newBook, badgeColor: color.value })}
                                                    className={`w-8 h-8 rounded-full border-2 ${newBook.badgeColor === color.value ? 'border-gray-800' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <GallerySection
                                images={newBook.images || []}
                                onChange={(next) => setNewBook({ ...newBook, images: next })}
                                uploadFile={uploadGalleryFile}
                            />

                            <VideoSection
                                value={newBook.promoVideoUrl || ''}
                                onChange={(v) => setNewBook({ ...newBook, promoVideoUrl: v })}
                            />

                            <ReviewsSection
                                reviews={newBook.reviews || []}
                                onChange={(next) => setNewBook({ ...newBook, reviews: next })}
                            />

                            <div className="border-t pt-4">
                                <h3 className="font-semibold text-gray-700 mb-3">Featured Settings</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={newBook.isFeatured || false}
                                            onChange={(e) => setNewBook({ ...newBook, isFeatured: e.target.checked })}
                                            className="w-4 h-4 text-orange-600"
                                        />
                                        <span className="text-sm font-medium">Featured in Carousel</span>
                                    </label>
                                    {newBook.isFeatured && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600">Order:</label>
                                            <input
                                                type="number"
                                                value={newBook.featuredOrder || 0}
                                                onChange={(e) => setNewBook({ ...newBook, featuredOrder: parseInt(e.target.value) || 0 })}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded"
                                                min="0"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={newBook.status === 'published'}
                                        onChange={(e) => setNewBook({ ...newBook, status: e.target.checked ? 'published' : 'draft' })}
                                        className="w-4 h-4 text-green-600"
                                    />
                                    <span className="text-sm font-medium">Publish immediately</span>
                                </label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleCreateBook} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Add Book
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmazonBooks;

/* ----------------------- Shared form sub-components ----------------------- */

interface GalleryProps {
    images: string[];
    onChange: (next: string[]) => void;
    uploadFile: (file: File) => Promise<string | null>;
}

const GallerySection: React.FC<GalleryProps> = ({ images, onChange, uploadFile }) => {
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const next = [...images];
            for (const file of Array.from(files)) {
                const url = await uploadFile(file);
                if (url) next.push(url);
            }
            onChange(next);
        } finally {
            setUploading(false);
        }
    };

    const removeAt = (idx: number) => onChange(images.filter((_, i) => i !== idx));

    return (
        <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                Gallery images
                <span className="text-xs font-normal text-gray-500">shown on the bookstore detail page</span>
            </h3>

            {images.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-3">
                    {images.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative group">
                            <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-300" />
                            <button
                                type="button"
                                onClick={() => removeAt(idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove image"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-600 hover:border-sky-400 cursor-pointer transition-colors">
                <Upload className={`w-4 h-4 ${uploading ? 'text-sky-500 animate-pulse' : 'text-gray-400'}`} />
                <span>{uploading ? 'Uploading…' : 'Upload one or more images'}</span>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        void handleFiles(e.target.files);
                        e.currentTarget.value = '';
                    }}
                />
            </label>
        </div>
    );
};

interface StripeSectionProps {
    paymentLinkUrl: string;
    priceId: string;
    onChange: (patch: { stripePaymentLinkUrl?: string; stripePriceId?: string }) => void;
    stripeClickCount?: number;
}

const StripeSection: React.FC<StripeSectionProps> = ({ paymentLinkUrl, priceId, onChange, stripeClickCount }) => {
    const priceIdLooksValid = !priceId || /^price_[A-Za-z0-9]+$/.test(priceId.trim());
    const linkLooksValid =
        !paymentLinkUrl || /^https:\/\/(buy\.)?stripe\.com\//.test(paymentLinkUrl.trim());

    return (
        <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Stripe checkout
                <span className="text-xs font-normal text-gray-500">optional — sell direct without Amazon</span>
                {typeof stripeClickCount === 'number' && stripeClickCount > 0 && (
                    <span className="ml-auto text-xs font-normal text-gray-500">
                        {stripeClickCount} Stripe clicks
                    </span>
                )}
            </h3>

            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Use <strong>one</strong> of the two fields below. If both are filled, the Payment Link takes precedence.
                Create these in the <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Stripe Dashboard</a> under Products.
            </p>

            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Payment Link URL
                        <span className="text-xs font-normal text-gray-500 ml-2">simplest — paste from Stripe</span>
                    </label>
                    <input
                        type="url"
                        value={paymentLinkUrl}
                        onChange={(e) => onChange({ stripePaymentLinkUrl: e.target.value })}
                        placeholder="https://buy.stripe.com/…"
                        className={`w-full px-4 py-2 border rounded-lg ${linkLooksValid ? 'border-gray-300' : 'border-red-400'}`}
                    />
                    {!linkLooksValid && (
                        <p className="text-xs text-red-600 mt-1">Expected a URL like https://buy.stripe.com/…</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Price ID
                        <span className="text-xs font-normal text-gray-500 ml-2">advanced — creates a fresh checkout each time</span>
                    </label>
                    <input
                        type="text"
                        value={priceId}
                        onChange={(e) => onChange({ stripePriceId: e.target.value.trim() })}
                        placeholder="price_1Abc123…"
                        className={`w-full px-4 py-2 border rounded-lg font-mono text-sm ${priceIdLooksValid ? 'border-gray-300' : 'border-red-400'}`}
                    />
                    {!priceIdLooksValid && (
                        <p className="text-xs text-red-600 mt-1">
                            That doesn't look like a Price ID. It should start with <code className="bg-gray-100 px-1 rounded">price_</code>. Don't paste a Product ID (<code className="bg-gray-100 px-1 rounded">prod_…</code>) — grab the Price ID from inside the product.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const VideoSection: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
    return (
        <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-600" />
                Promo video URL
                <span className="text-xs font-normal text-gray-500">YouTube, Vimeo, or direct .mp4</span>
            </h3>
            <input
                type="url"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            {value && (
                <p className="text-xs text-gray-500 mt-1">
                    Plays inside the book detail page. Leave blank to hide the video section.
                </p>
            )}
        </div>
    );
};

interface ReviewsProps {
    reviews: Review[];
    onChange: (next: Review[]) => void;
}

const ReviewsSection: React.FC<ReviewsProps> = ({ reviews, onChange }) => {
    const update = (idx: number, patch: Partial<Review>) => {
        onChange(reviews.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };
    const remove = (idx: number) => onChange(reviews.filter((_, i) => i !== idx));
    const add = () =>
        onChange([
            ...reviews,
            { author: '', rating: 5, text: '', date: new Date().toISOString() },
        ]);

    return (
        <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-600" />
                    Reviews
                    <span className="text-xs font-normal text-gray-500">shown on the bookstore detail page</span>
                </h3>
                <button
                    type="button"
                    onClick={add}
                    className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-1"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add review
                </button>
            </div>

            {reviews.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No reviews yet. Add the first one to build trust.</p>
            ) : (
                <div className="space-y-3">
                    {reviews.map((r, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    value={r.author}
                                    onChange={(e) => update(idx, { author: e.target.value })}
                                    placeholder="Reviewer name (e.g. Sarah M.)"
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm sm:col-span-2"
                                />
                                <div className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg bg-white">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            type="button"
                                            key={n}
                                            onClick={() => update(idx, { rating: n })}
                                            className="focus:outline-none"
                                            title={`${n} star${n > 1 ? 's' : ''}`}
                                        >
                                            <Star
                                                className={`w-4 h-4 ${n <= r.rating ? 'text-amber-500' : 'text-gray-300'}`}
                                                fill={n <= r.rating ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                value={r.text || ''}
                                onChange={(e) => update(idx, { text: e.target.value })}
                                placeholder="What did they say about the book?"
                                rows={2}
                                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    type="button"
                                    onClick={() => remove(idx)}
                                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
