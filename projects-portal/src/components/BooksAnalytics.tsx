import React, { useState, useEffect } from 'react';
import { Eye, BookOpen, Heart, Bookmark, Trophy, HelpCircle, Palette, Gamepad2, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import apiClient from '../services/apiClient';
import { Link } from 'react-router-dom';

interface BookAnalytics {
    _id: string;
    title: string;
    author: string;
    coverImage?: string;
    status: string;
    viewCount: number;
    readCount: number;
    likeCount: number;
    favoriteCount: number;
    quizStartCount: number;
    quizCompletionCount: number;
    coloringSessionsCount: number;
    gameUnlockCount: number;
    gameOpenCount: number;
    averageCompletionRate: number;
}

type SortField = 'viewCount' | 'readCount' | 'likeCount' | 'favoriteCount' | 'quizCompletionCount' | 'averageCompletionRate' | 'gameOpenCount';
type SortDirection = 'asc' | 'desc';

const BooksAnalytics: React.FC = () => {
    const [books, setBooks] = useState<BookAnalytics[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<SortField>('viewCount');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    useEffect(() => {
        fetchBooksAnalytics();
    }, []);

    const fetchBooksAnalytics = async () => {
        try {
            // Fetch all books with analytics data
            const response = await apiClient.get('/api/books?includeAnalytics=true');
            setBooks(response.data);
        } catch (error) {
            console.error('Error fetching books analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedBooks = [...books].sort((a, b) => {
        const aValue = a[sortField] || 0;
        const bValue = b[sortField] || 0;
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    const SortButton: React.FC<{ field: SortField; label: string; icon: React.ReactNode }> = ({ field, label, icon }) => (
        <button
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sortField === field 
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {icon}
            <span>{label}</span>
            {sortField === field && (
                sortDirection === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
            )}
        </button>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sort Controls */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Sort by:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <SortButton field="viewCount" label="Views" icon={<Eye className="w-4 h-4" />} />
                    <SortButton field="readCount" label="Reads" icon={<BookOpen className="w-4 h-4" />} />
                    <SortButton field="likeCount" label="Likes" icon={<Heart className="w-4 h-4" />} />
                    <SortButton field="favoriteCount" label="Favorites" icon={<Bookmark className="w-4 h-4" />} />
                    <SortButton field="quizCompletionCount" label="Quiz Completions" icon={<HelpCircle className="w-4 h-4" />} />
                    <SortButton field="averageCompletionRate" label="Completion %" icon={<Trophy className="w-4 h-4" />} />
                    <SortButton field="gameOpenCount" label="Games Played" icon={<Gamepad2 className="w-4 h-4" />} />
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Book</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Eye className="w-4 h-4 inline" /> Views
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <BookOpen className="w-4 h-4 inline" /> Reads
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Heart className="w-4 h-4 inline" /> Likes
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Bookmark className="w-4 h-4 inline" /> Saves
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Completion %
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <HelpCircle className="w-4 h-4 inline" /> Quizzes
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Gamepad2 className="w-4 h-4 inline" /> Games
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <Palette className="w-4 h-4 inline" /> Coloring
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedBooks.map((book, index) => (
                                <tr key={book._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            index === 1 ? 'bg-gray-200 text-gray-700' :
                                            index === 2 ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <Link to={`/books/${book._id}/edit`} className="flex items-center gap-3 hover:opacity-80">
                                            {book.coverImage ? (
                                                <img 
                                                    src={book.coverImage} 
                                                    alt={book.title}
                                                    className="w-10 h-10 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5 text-indigo-500" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm">{book.title}</p>
                                                <p className="text-xs text-gray-500">{book.author}</p>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-gray-800">{(book.viewCount || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-green-600">{(book.readCount || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-red-500">{(book.likeCount || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-amber-600">{(book.favoriteCount || 0).toLocaleString()}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 rounded-full"
                                                    style={{ width: `${book.averageCompletionRate || 0}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-gray-600">{book.averageCompletionRate || 0}%</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="text-sm">
                                            <span className="font-semibold text-purple-600">{book.quizCompletionCount || 0}</span>
                                            <span className="text-gray-400">/{book.quizStartCount || 0}</span>
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="text-sm">
                                            <span className="font-semibold text-blue-600">{book.gameOpenCount || 0}</span>
                                            <span className="text-gray-400">/{book.gameUnlockCount || 0}</span>
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-semibold text-pink-600">{(book.coloringSessionsCount || 0).toLocaleString()}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {sortedBooks.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No books found. Create some books to see analytics.
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Views</p>
                    <p className="text-2xl font-bold text-gray-800">
                        {books.reduce((sum, b) => sum + (b.viewCount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Reads</p>
                    <p className="text-2xl font-bold text-green-600">
                        {books.reduce((sum, b) => sum + (b.readCount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Avg Completion Rate</p>
                    <p className="text-2xl font-bold text-indigo-600">
                        {books.length > 0 
                            ? Math.round(books.reduce((sum, b) => sum + (b.averageCompletionRate || 0), 0) / books.length)
                            : 0}%
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500">Total Quiz Completions</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {books.reduce((sum, b) => sum + (b.quizCompletionCount || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BooksAnalytics;

