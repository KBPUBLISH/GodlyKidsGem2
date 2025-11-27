import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface Book {
    _id: string;
    title: string;
    author: string;
    status: string;
}

const Books: React.FC = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/books');
                setBooks(response.data);
            } catch (error) {
                console.error('Error fetching books:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBooks();
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Books</h1>
                <Link
                    to="/books/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Book
                </Link>
            </div>

            {loading ? (
                <p>Loading books...</p>
            ) : books.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-gray-500">No books found. Create your first one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {books.map((book) => (
                        <div key={book._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between h-full">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">{book.title}</h2>
                                <p className="text-gray-600">{book.author}</p>
                                <span className={`inline-block mt-4 px-3 py-1 rounded-full text-sm ${book.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                    {book.status}
                                </span>
                            </div>
                            <div className="mt-4 flex space-x-2">
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
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Books;
