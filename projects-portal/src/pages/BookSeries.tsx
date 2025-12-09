import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, BookOpen, Eye, EyeOff, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

interface BookInSeries {
    book: {
        _id: string;
        title: string;
        coverImage?: string;
        author?: string;
    };
    order: number;
}

interface BookSeriesType {
    _id: string;
    title: string;
    description?: string;
    coverImage: string;
    books: BookInSeries[];
    minAge: number;
    maxAge: number;
    level: string;
    category?: {
        _id: string;
        name: string;
    };
    status: 'draft' | 'published';
    isMembersOnly: boolean;
    isFeatured: boolean;
    displayOrder: number;
    author?: string;
    viewCount: number;
    createdAt: string;
    updatedAt: string;
}

const BookSeries: React.FC = () => {
    const [series, setSeries] = useState<BookSeriesType[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const navigate = useNavigate();

    useEffect(() => {
        fetchSeries();
    }, []);

    const fetchSeries = async () => {
        try {
            const response = await apiClient.get('/api/book-series?status=all');
            const seriesData = Array.isArray(response.data) 
                ? response.data 
                : (response.data.data || []);
            setSeries(seriesData);
        } catch (error) {
            console.error('Error fetching book series:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this book series?')) return;

        try {
            await apiClient.delete(`/api/book-series/${id}`);
            setSeries(series.filter(s => s._id !== id));
        } catch (error) {
            console.error('Error deleting book series:', error);
            alert('Failed to delete book series');
        }
    };

    const handleToggleStatus = async (item: BookSeriesType) => {
        const newStatus = item.status === 'published' ? 'draft' : 'published';
        try {
            const response = await apiClient.put(`/api/book-series/${item._id}`, {
                ...item,
                status: newStatus,
            });
            setSeries(series.map(s => s._id === item._id ? response.data : s));
        } catch (error) {
            console.error('Error updating book series status:', error);
            alert('Failed to update book series status');
        }
    };

    const filteredSeries = series.filter(s => {
        if (filter === 'all') return true;
        return s.status === filter;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Book Series</h1>
                <button
                    onClick={() => navigate('/book-series/new')}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={20} />
                    Create Book Series
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {(['all', 'published', 'draft'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            filter === status
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                        <span className="ml-2 text-xs opacity-75">
                            ({series.filter(s => status === 'all' ? true : s.status === status).length})
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : filteredSeries.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Library size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Book Series Found</h3>
                    <p className="text-gray-500 mb-4">Create your first book series to group related books together.</p>
                    <button
                        onClick={() => navigate('/book-series/new')}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={20} />
                        Create Book Series
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSeries.map((item) => (
                        <div
                            key={item._id}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {/* Cover Image */}
                            <div className="relative aspect-[16/9] bg-gray-100">
                                {item.coverImage ? (
                                    <img
                                        src={item.coverImage}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                                        <BookOpen size={48} className="text-white/50" />
                                    </div>
                                )}
                                
                                {/* Status Badge */}
                                <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                                    item.status === 'published' 
                                        ? 'bg-green-500 text-white' 
                                        : 'bg-yellow-500 text-white'
                                }`}>
                                    {item.status}
                                </div>
                                
                                {/* Premium Badge */}
                                {item.isMembersOnly && (
                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white">
                                        Premium
                                    </div>
                                )}
                                
                                {/* Book Count */}
                                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs font-medium bg-black/60 text-white flex items-center gap-1">
                                    <BookOpen size={12} />
                                    {item.books?.length || 0} books
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <h3 className="font-semibold text-gray-800 text-lg mb-1 truncate">{item.title}</h3>
                                {item.author && (
                                    <p className="text-sm text-gray-500 mb-2">by {item.author}</p>
                                )}
                                {item.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                                )}
                                
                                {/* Meta Info */}
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                                    <span>Ages {item.minAge}-{item.maxAge}</span>
                                    {item.category && (
                                        <>
                                            <span>•</span>
                                            <span>{item.category.name}</span>
                                        </>
                                    )}
                                    <span>•</span>
                                    <span>{item.viewCount} views</span>
                                </div>

                                {/* Books Preview */}
                                {item.books && item.books.length > 0 && (
                                    <div className="flex -space-x-2 mb-4">
                                        {item.books.slice(0, 5).map((b, idx) => (
                                            <div 
                                                key={idx}
                                                className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-200"
                                                title={b.book?.title}
                                            >
                                                {b.book?.coverImage ? (
                                                    <img 
                                                        src={b.book.coverImage} 
                                                        alt={b.book.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-indigo-100">
                                                        <BookOpen size={12} className="text-indigo-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {item.books.length > 5 && (
                                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                                +{item.books.length - 5}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleStatus(item)}
                                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            item.status === 'published'
                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                    >
                                        {item.status === 'published' ? (
                                            <>
                                                <EyeOff size={16} />
                                                Unpublish
                                            </>
                                        ) : (
                                            <>
                                                <Eye size={16} />
                                                Publish
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => navigate(`/book-series/${item._id}`)}
                                        className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                                    >
                                        <Edit size={16} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item._id)}
                                        className="flex items-center justify-center p-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 size={16} />
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

export default BookSeries;

