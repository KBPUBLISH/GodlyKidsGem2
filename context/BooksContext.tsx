import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Book } from '../types';
import { ApiService } from '../services/apiService';
import { MOCK_BOOKS, API_BASE_URL } from '../constants';
import { authService } from '../services/authService';

interface BooksContextType {
  books: Book[];
  loading: boolean;
  refreshBooks: () => Promise<void>;
}

const BooksContext = createContext<BooksContextType>({
  books: [],
  loading: true,
  refreshBooks: async () => { },
});

export const useBooks = () => useContext(BooksContext);

export const BooksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    // Prevent infinite loops - don't load if already loading
    if (isLoadingRef.current) {
      console.log('⏸️ BooksContext: Already loading, skipping duplicate request');
      return;
    }

    isLoadingRef.current = true;

    // Only show loading if we have no data to prevent flashing on manual refresh
    if (books.length === 0) setLoading(true);

    try {
      console.log('📚 BooksContext: Loading books...');


      // Check if user is authenticated
      const isAuthenticated = authService.isAuthenticated();
      const isLocalBackend = API_BASE_URL.includes('localhost');
      console.log('🔑 BooksContext: User authenticated:', isAuthenticated);
      console.log('🏠 BooksContext: Using local backend:', isLocalBackend);

      // Skip auth check for local development
      if (!isAuthenticated && !isLocalBackend) {
        console.warn('⚠️ BooksContext: User not authenticated. Using mock data until login.');
        console.warn('💡 Please log in to see real data from the dev database.');
        setBooks(MOCK_BOOKS);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }


      const data = await ApiService.getBooks();
      console.log('📚 BooksContext: Received', data.length, 'books');

      // Check if this is actually mock data by comparing structure
      // Real API data will have different IDs/titles than mock
      const isActuallyMockData = data.length === MOCK_BOOKS.length &&
        data.every((book, index) => {
          const mockBook = MOCK_BOOKS[index];
          return mockBook && book.id === mockBook.id && book.title === mockBook.title;
        });

      // Check for real cover URLs
      const hasRealCovers = data.some(book =>
        book.coverUrl &&
        !book.coverUrl.includes('picsum.photos') &&
        !book.coverUrl.includes('placeholder') &&
        book.coverUrl.length > 0
      );

      if (isActuallyMockData) {
        console.warn('⚠️ BooksContext: Received mock data (structure matches MOCK_BOOKS)');
        console.warn('💡 This means API call failed and fell back to mock data');
        console.warn('📊 Check console for API error messages above');
      } else {
        // This is real API data - use it even if covers are placeholders
        if (hasRealCovers) {
          console.log('✅ BooksContext: Using REAL API data with real covers from dev database');
          console.log('📊 Books with real covers:', data.filter(b => b.coverUrl && !b.coverUrl.includes('picsum')).length);
        } else {
          console.log('✅ BooksContext: Using REAL API data from dev database');
          console.log('💡 Data structure differs from mock - this is real API data');
          console.log('📊 Covers may be placeholders but data is from API');
        }
      }

      setBooks(data);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("❌ BooksContext: Failed to load books", error);
      // On error, use mock data as fallback
      setBooks(MOCK_BOOKS);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    // Check if we're on the landing page - if so, don't load books yet
    const isLandingPage = window.location.hash === '#/' || window.location.hash === '';
    if (isLandingPage) {
      console.log('📚 BooksContext: On landing page, skipping book load');
      setBooks([]);
      setLoading(false);
      return;
    }

    // Check authentication before loading
    const isAuthenticated = authService.isAuthenticated();
    const isLocalBackend = API_BASE_URL.includes('localhost');
    console.log('📚 BooksContext: Initial load, authenticated:', isAuthenticated);
    console.log('📚 BooksContext: Using local backend:', isLocalBackend);

    if (isAuthenticated || isLocalBackend) {
      loadData();
    } else {
      console.log('📚 BooksContext: Not authenticated, using mock data');
      setBooks(MOCK_BOOKS);
      setLoading(false);
    }
  }, []);

  // Also reload when route changes (e.g., after login navigation or guest navigation) - but only once
  useEffect(() => {
    const handleHashChange = () => {
      const isLandingPage = window.location.hash === '#/' || window.location.hash === '';
      if (!isLandingPage && !hasLoadedRef.current) {
        const isAuthenticated = authService.isAuthenticated();
        const isLocalBackend = API_BASE_URL.includes('localhost');
        console.log('📚 BooksContext: Route changed, authenticated:', isAuthenticated);
        console.log('📚 BooksContext: Using local backend:', isLocalBackend);
        if (!isLoadingRef.current) {
          if (isAuthenticated || isLocalBackend) {
            console.log('📚 BooksContext: Reloading books after route change');
            loadData();
          } else {
            // Guest user - load mock books
            console.log('📚 BooksContext: Loading mock books for guest user after route change');
            setBooks(MOCK_BOOKS);
            setLoading(false);
            hasLoadedRef.current = true;
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Track if we've already loaded books to prevent infinite loops
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Listen for storage changes (when token is set manually)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'godly_kids_auth_token' && e.newValue && !isLoadingRef.current) {
        console.log('🔄 Auth token changed (storage event), reloading books...');
        hasLoadedRef.current = false;
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event (for same-window token updates)
    const handleCustomStorage = () => {
      if (isLoadingRef.current) {
        console.log('⏸️ Already loading books, skipping duplicate request');
        return;
      }
      console.log('🔄 Auth token updated (custom event), reloading books...');
      hasLoadedRef.current = false;
      // Small delay to ensure token is stored
      setTimeout(() => {
        loadData();
      }, 100);
    };

    window.addEventListener('authTokenUpdated', handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authTokenUpdated', handleCustomStorage);
    };
  }, []);

  // Expose manual refresh in console for debugging
  if (typeof window !== 'undefined') {
    (window as any).refreshBooks = () => {
      console.log('🔄 Manual books refresh triggered');
      loadData();
    };
  }

  return (
    <BooksContext.Provider value={{ books, loading, refreshBooks: loadData }}>
      {children}
    </BooksContext.Provider>
  );
};