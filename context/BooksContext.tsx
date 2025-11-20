import React, { createContext, useContext, useState, useEffect } from 'react';
import { Book } from '../types';
import { ApiService } from '../services/apiService';

interface BooksContextType {
  books: Book[];
  loading: boolean;
  refreshBooks: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType>({
  books: [],
  loading: true,
  refreshBooks: async () => {},
});

export const useBooks = () => useContext(BooksContext);

export const BooksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    // Only show loading if we have no data to prevent flashing on manual refresh
    if (books.length === 0) setLoading(true);
    try {
      const data = await ApiService.getBooks();
      setBooks(data);
    } catch (error) {
      console.error("Failed to load books", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <BooksContext.Provider value={{ books, loading, refreshBooks: loadData }}>
      {children}
    </BooksContext.Provider>
  );
};