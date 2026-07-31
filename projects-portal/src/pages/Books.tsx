import React, { useEffect, useState } from 'react';
import { Plus, Trash2, List, Archive, BookOpen, BarChart3, ArchiveRestore } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import BooksAnalytics from '../components/BooksAnalytics';

interface Book {
    _id: string;
    title: string;
    author: string;
    status: string;
    coverImage?: string;
    bookType?: string;
    /** Creator of kid-created book (Kids Monthly tab only) */
    createdByEmail?: string | null;
    createdByParentName?: string | null;
}

type TabView = 'list' | 'archived' | 'kidsMonthly' | 'analytics';

const PAGE_SIZE = 100;

// Fetch all pages for given query params
async function fetchAllBooks(params: Record<string, string>): Promise<Book[]> {
    let page = 1;
    let results: Book[] = [];
    const search = new URLSearchParams({ ...params, page: '1', limit: String(PAGE_SIZE) });

    while (true) {
        search.set('page', String(page));
        search.set('limit', String(PAGE_SIZE));
        const res = await apiClient.get(`/api/books?${search.toString()}`);
        const payload = res.data;
        const pageItems: Book[] = Array.isArray(payload) ? payload : (payload.data || payload.books || []);
        results = results.concat(pageItems);
        const hasMore = Array.isArray(payload) ? false : Boolean(payload.pagination?.hasMore);
        if (!hasMore) break;
        page += 1;
    }
    return results;
}

const Books: React.FC = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabView>('list');
    // Lazy-loaded: only kid-created books (made from Kids Monthly templates)
    const [kidsMonthlyBooks, setKidsMonthlyBooks] = useState<Book[] | null>(null);
    const [kidsMonthlyLoading, setKidsMonthlyLoading] = useState(false);
    const [archivedBooks, setArchivedBooks] = useState<Book[] | null>(null);
    const [archivedLoading, setArchivedLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const booksData = await fetchAllBooks({ status: 'all' });
                setBooks(booksData);
            } catch (error) {
                console.error('Error fetching books:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Lazy-load Kids Monthly Books tab: only books created from Kids Monthly templates (Create Your Story)
    useEffect(() => {
        if (activeTab !== 'kidsMonthly' || kidsMonthlyBooks !== null) return;
        setKidsMonthlyLoading(true);
        fetchAllBooks({ status: 'all', onlyGeneratedMonthly: '1' })
            .then((data) => {
                setKidsMonthlyBooks(data);
            })
            .catch((err) => console.error('Error fetching kids monthly books:', err))
            .finally(() => setKidsMonthlyLoading(false));
    }, [activeTab, kidsMonthlyBooks]);

    // Lazy-load Archived tab
    useEffect(() => {
        if (activeTab !== 'archived' || archivedBooks !== null) return;
        setArchivedLoading(true);
        fetchAllBooks({ status: 'archived' })
            .then((data) => setArchivedBooks(data))
            .catch((err) => console.error('Error fetching archived books:', err))
            .finally(() => setArchivedLoading(false));
    }, [activeTab, archivedBooks]);

    const handleDeleteBook = async (bookId: string, bookTitle: string) => {
        if (!window.confirm(`Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`)) {
            return;
        }

        setDeletingBookId(bookId);
        try {
            await apiClient.delete(`/api/books/${bookId}`);
            setBooks((prev) => prev.filter((b) => b._id !== bookId));
            setKidsMonthlyBooks((prev) => (prev ? prev.filter((b) => b._id !== bookId) : null));
            setArchivedBooks((prev) => (prev ? prev.filter((b) => b._id !== bookId) : null));
        } catch (error) {
            console.error('Error deleting book:', error);
            alert('Failed to delete book. Please try again.');
        } finally {
            setDeletingBookId(null);
        }
    };

    const loadList = () => {
        setLoading(true);
        fetchAllBooks({ status: 'all' })
            .then((data) => setBooks(data))
            .catch((err) => console.error('Error fetching books:', err))
            .finally(() => setLoading(false));
    };

    const handleArchiveBook = async (bookId: string) => {
        try {
            await apiClient.put(`/api/books/${bookId}`, { status: 'archived' });
            setBooks((prev) => prev.filter((b) => b._id !== bookId));
            setArchivedBooks(null); // so Archived tab refetches and shows the book
        } catch (error) {
            console.error('Error archiving book:', error);
            alert('Failed to archive book. Please try again.');
        }
    };

    const handleRestoreBook = async (bookId: string) => {
        try {
            await apiClient.put(`/api/books/${bookId}`, { status: 'draft' });
            setArchivedBooks((prev) => (prev ? prev.filter((b) => b._id !== bookId) : null));
            loadList(); // refetch list so restored book appears
        } catch (error) {
            console.error('Error restoring book:', error);
            alert('Failed to restore book. Please try again.');
        }
    };

    return (
        <div>
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
                <h1 className="text-3xl font-bold text-gray-800">Books</h1>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Tab Buttons - scroll on small screens so Archived + Kids Monthly Books are visible */}
                    <div className="flex flex-nowrap bg-gray-100 rounded-lg p-1 overflow-x-auto min-w-0">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'list'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            List
                        </button>
                        <button
                            onClick={() => setActiveTab('archived')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'archived'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Archive className="w-4 h-4" />
                            Archived
                            {archivedBooks !== null && (
                                <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {archivedBooks.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('kidsMonthly')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'kidsMonthly'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <BookOpen className="w-4 h-4" />
                            Kids Monthly Books
                            {(kidsMonthlyBooks !== null || kidsMonthlyLoading) && (
                                <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-0.5 rounded-full">
                                    {kidsMonthlyLoading ? '...' : kidsMonthlyBooks?.length ?? 0}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'analytics'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            Analytics
                        </button>
                    </div>
                    
                    <Link
                        to="/books/new"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Book
                    </Link>
                </div>
            </div>

            {activeTab === 'analytics' ? (
                <BooksAnalytics />
            ) : (
                <>
                    {(() => {
                        const isList = activeTab === 'list';
                        const isArchived = activeTab === 'archived';
                        const isKidsMonthly = activeTab === 'kidsMonthly';
                        const tabLoading = isList ? loading : isArchived ? archivedLoading : kidsMonthlyLoading;
                        const tabBooks: Book[] = isList
                            ? books.filter((b) => b.status !== 'archived')
                            : isArchived
                                ? (archivedBooks ?? [])
                                : (kidsMonthlyBooks ?? []);
                        return tabLoading ? (
                            <p>Loading books...</p>
                        ) : tabBooks.length === 0 ? (
                            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                                <p className="text-gray-500">
                                    {isKidsMonthly
                                        ? 'No kid-created books yet. These are books created by users from Kids Monthly templates (Create Your Story).'
                                        : isArchived
                                            ? 'No archived books.'
                                            : 'No books found. Create your first one!'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {tabBooks.map((book) => (
                                <div key={book._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between h-full">
                                    <div>
                                        {book.coverImage && (
                                            <div className="mb-4 rounded-lg overflow-hidden">
                                                <img 
                                                    src={book.coverImage} 
                                                    alt={book.title}
                                                    className="w-full h-48 object-cover"
                                                    onError={(e) => {
                                                        // Hide image if it fails to load
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <h2 className="text-xl font-semibold text-gray-800">{book.title}</h2>
                                        {isKidsMonthly && (book.createdByEmail != null || book.createdByParentName != null) ? (
                                            <div className="text-gray-600 text-sm space-y-0.5">
                                                <p className="font-medium text-gray-700">Created by</p>
                                                <p>
                                                    {book.createdByParentName && book.createdByEmail
                                                        ? `${book.createdByParentName} (${book.createdByEmail})`
                                                        : book.createdByParentName || book.createdByEmail || '—'}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-600">{book.author}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-4">
                                            <span className={`inline-block px-3 py-1 rounded-full text-sm ${book.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {book.status}
                                            </span>
                                            {book.bookType === 'kids_monthly' && (
                                                <span className="inline-block px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 font-medium">
                                                    Kids Monthly
                                                </span>
                                            )}
                                            {book.bookType === 'bible_map' && (
                                                <span className="inline-block px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 font-medium">
                                                    Bible Map
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex space-x-2 flex-wrap gap-2">
                                        <Link
                                            to={`/books/edit/${book._id}`}
                                            className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition"
                                        >
                                            Edit
                                        </Link>
                                        <Link
                                            to={`/pages/new/${book._id}`}
                                            className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition"
                                        >
                                            Add Page
                                        </Link>
                                        <Link
                                            to={`/books/read/${book._id}`}
                                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                                        >
                                            Read
                                        </Link>
                                        {isArchived ? (
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreBook(book._id)}
                                                className="bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition flex items-center gap-1"
                                            >
                                                <ArchiveRestore className="w-4 h-4" />
                                                Restore
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleArchiveBook(book._id)}
                                                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition flex items-center gap-1"
                                            >
                                                <Archive className="w-4 h-4" />
                                                Archive
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDeleteBook(book._id, book.title);
                                            }}
                                            disabled={deletingBookId === book._id}
                                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {deletingBookId === book._id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

export default Books;
