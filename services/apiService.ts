import { API_BASE_URL, MOCK_BOOKS } from '../constants';
import { Book } from '../types';
import { authService } from './authService';

// ============================================
// LocalStorage-backed caching to survive WebView restarts
// iOS kills WebView when app is backgrounded, clearing module-level vars
// ============================================
const API_CACHE_PREFIX = 'gk_api_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = <T>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(`${API_CACHE_PREFIX}${key}`);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        console.log(`📦 API Cache HIT: ${key}`);
        return data as T;
      }
      // Expired
      localStorage.removeItem(`${API_CACHE_PREFIX}${key}`);
    }
  } catch {}
  return null;
};

const setCache = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(`${API_CACHE_PREFIX}${key}`, JSON.stringify({
      data,
      ts: Date.now()
    }));
  } catch {
    // localStorage full or unavailable - just continue without caching
  }
};

// ============================================

// Get API base URL from environment or use default
export const getApiBaseUrl = (): string => {
  // Check for environment variable (Vite uses import.meta.env)
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const baseUrl = envUrl || API_BASE_URL;

  // Ensure URL ends with a slash
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

// Helper to ensure cover URL is absolute
const normalizeCoverUrl = (url: string | undefined | null): string => {
  if (!url || url.trim() === '') return '';

  // If already absolute URL (starts with http:// or https://), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If relative URL, make it absolute using API base URL
  const baseUrl = getApiBaseUrl();
  // Remove trailing slash from base URL and leading slash from relative URL
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanUrl}`;
};

// Transform API response to match Book interface
// Handles different field names from the API (cover_url, cover, image, etc.)
const transformBook = (apiBook: any): Book => {
  // Handle cover URL - try multiple possible field names
  // From /v3/books/by-categories: coverURI, coverMiniURI
  // Also check nested files.coverImage for new schema structure
  const rawCoverUrl = apiBook.coverURI ||
    apiBook.coverUri ||
    apiBook.coverMiniURI ||
    apiBook.coverMiniUri ||
    apiBook.coverUrl ||
    apiBook.cover_url ||
    apiBook.cover ||
    apiBook.coverImage ||
    apiBook.cover_image ||
    (apiBook.files && apiBook.files.coverImage) ||
    apiBook.image ||
    apiBook.imageUrl ||
    apiBook.image_url ||
    apiBook.thumbnail ||
    apiBook.thumbnailUrl ||
    apiBook.thumbnail_url ||
    '';

  // Handle category - try multiple possible field names
  const category = apiBook.category ||
    apiBook.categoryName ||
    apiBook.genre ||
    apiBook.type ||
    apiBook.bookType ||
    apiBook.book_type ||
    'Uncategorized';

  // Handle level/age - try multiple possible field names
  // From /v3/books/by-categories: minAge (number)
  const level = apiBook.minAge !== undefined ? `${apiBook.minAge}+` :
    apiBook.level ||
    apiBook.age_level ||
    apiBook.ageLevel ||
    apiBook.age ||
    apiBook.recommendedAge ||
    apiBook.recommended_age ||
    '0+';

  return {
    id: apiBook.id || apiBook._id || String(apiBook.id || apiBook._id || Math.random()),
    title: apiBook.title || apiBook.name || 'Untitled',
    coverUrl: normalizeCoverUrl(rawCoverUrl),
    level: String(level),
    category: String(category),
    isAudio: apiBook.isAudio || apiBook.is_audio || apiBook.hasAudio || apiBook.type === 'audio' || false,
    isRead: apiBook.isRead || apiBook.is_read || apiBook.read || false,
    description: apiBook.description || apiBook.summary || apiBook.synopsis || '',
    author: apiBook.author || apiBook.author_name || apiBook.authorName || 'Unknown',
    // Premium/Members only flag
    isMembersOnly: apiBook.isMembersOnly || apiBook.is_members_only || apiBook.isPremium || apiBook.is_premium || false,
    // Analytics counts
    viewCount: apiBook.viewCount || 0,
    readCount: apiBook.readCount || 0,
    likeCount: apiBook.likeCount || 0,
    favoriteCount: apiBook.favoriteCount || 0,
  } as Book & { viewCount: number; readCount: number; likeCount: number; favoriteCount: number; isMembersOnly: boolean };
};

// Transform array of books
const transformBooks = (apiBooks: any[]): Book[] => {
  // Don't filter out books - show them even if they don't have cover URLs
  // The UI will handle missing covers with placeholders
  return apiBooks.map(transformBook);
};

// Simple helper to handle potential API calls with authentication
async function fetchWithTimeout(resource: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => {
    console.warn(`⏱️ Request timeout after ${timeout}ms: ${resource}`);
    controller.abort();
  }, timeout);

  // Get auth token if available
  const token = authService.getToken();
  const headers = new Headers(fetchOptions.headers);

  // Set default headers
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add authorization header if token exists
  // Format: "Bearer <token>"
  if (token) {
    const authHeader = `Bearer ${token}`;
    headers.set('Authorization', authHeader);
    console.log('🔑 Adding Authorization header: Bearer', token.substring(0, 20) + '...');
    console.log('🔑 Full Authorization header length:', authHeader.length, 'characters');
  } else {
    console.log('⚠️ No token available, request will be unauthenticated');
  }

  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    // Re-throw the error so it can be handled by the caller
    throw error;
  }
}

export const ApiService = {
  getBooks: async (): Promise<Book[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authService.getToken();

      // Use the correct endpoint for local backend
      // baseUrl already includes /api/ (e.g., http://localhost:5001/api/)
      const endpoint = `${baseUrl}books`;
      console.log('🔍 Fetching books from API:', endpoint);
      console.log('🔑 Has auth token:', !!token);

      const response = await fetchWithTimeout(endpoint, {
        method: 'GET',
      });

      console.log('📡 API Response status:', response.status, response.statusText);

      if (!response.ok) {
        // Get error details
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('❌ API Error:', errorData);
        } catch {
          // Couldn't parse error response
        }

        // For localhost or production backend, don't use mock data - return empty array instead
        const isLocalBackend = baseUrl.includes('localhost');
        const isProductionBackend = baseUrl.includes('render.com') || baseUrl.includes('backendgk');

        // Handle different error status codes
        if (response.status === 401) {
          if (token) {
            console.warn('⚠️ Token exists but API returned 401 Unauthorized. Token may be expired or invalid.');
            console.warn('💡 Try logging in again to refresh your token.');
          } else {
            console.warn('⚠️ No authentication token. API requires authentication.');
            console.warn('💡 Please log in to access the API and see real data from the dev database.');
          }

          // Throw error so UI can show retry option
          throw new Error('Authentication required. Please sign in to access books.');
        }

        if (response.status === 403) {
          console.error('❌ API returned 403 Forbidden - User is authenticated but lacks permission');
          console.error('💡 This might mean:');
          console.error('   1. Your account doesn\'t have access to the books endpoint');
          console.error('   2. The token is valid but the user role doesn\'t have permission');
          console.error('   3. The endpoint requires a different permission level');
          console.error('   4. The API might require a subscription or premium account');
          console.error('📋 Token being used:', token ? token.substring(0, 20) + '...' : 'None');

          // Try to get more details from error response
          let errorDetails = null;
          try {
            errorDetails = await response.json();
            console.error('📋 Error details from API:', errorDetails);
          } catch {
            // Couldn't parse error - try to get text
            try {
              const errorText = await response.text();
              console.error('📋 Error response text:', errorText);
            } catch {
              console.error('📋 Could not read error response');
            }
          }

          // Try alternative endpoints that might have different permissions
          console.log('🔍 Trying alternative book endpoints...');
          const alternativeEndpoints = [
            `${baseUrl}v3/books/by-categories`, // User endpoint from API docs
            `${baseUrl}v3/books/by-dynamic-categories`, // Alternative user endpoint
            `${baseUrl}books`,
            `${baseUrl}v1/books`,
            `${baseUrl}user/books`,
            `${baseUrl}my-books`,
          ];

          for (const altEndpoint of alternativeEndpoints) {
            try {
              console.log(`🔍 Trying: ${altEndpoint}`);
              const altResponse = await fetchWithTimeout(altEndpoint, {
                method: 'GET',
              });

              if (altResponse.ok) {
                console.log(`✅ Alternative endpoint worked: ${altEndpoint}`);
                const altData = await altResponse.json();
                const altBooksArray = Array.isArray(altData) ? altData : (altData.books || altData.data || []);
                const altTransformedBooks = transformBooks(altBooksArray);
                if (altTransformedBooks.length > 0) {
                  return altTransformedBooks;
                }
              } else {
                console.log(`❌ ${altEndpoint} returned ${altResponse.status}`);
              }
            } catch (altError) {
              console.log(`❌ ${altEndpoint} error:`, altError);
            }
          }

          // Throw error so UI can show retry option
          throw new Error('Unable to access books. Please try again later.');
        }

        // For other errors, throw so UI can show retry
        throw new Error(`Failed to load books (Error ${response.status}). Please try again.`);
      }

      const data = await response.json();
      console.log('✅ API Response received:', data);
      console.log('📊 API Response type:', Array.isArray(data) ? 'Array' : typeof data);
      console.log('📊 API Response keys:', Array.isArray(data) ? 'N/A (array)' : Object.keys(data));
      console.log('📊 Full API Response (first 2000 chars):', JSON.stringify(data, null, 2).substring(0, 2000));
      console.log('📊 Full API Response (complete):', JSON.stringify(data, null, 2));

      // Handle various API response structures
      let booksArray: any[] = [];

      if (Array.isArray(data)) {
        // Direct array response
        console.log('📚 Response is direct array of books');
        booksArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        // Check if data.data contains books directly (paginated response)
        // or categories with nested books
        const firstItem = data.data[0];
        
        if (firstItem && firstItem.books && firstItem.books.data) {
          // It's categories with nested books: { data: [{ name, books: { data: [...] } }] }
          console.log('📂 Processing', data.data.length, 'categories...');
          data.data.forEach((category: any, index: number) => {
            console.log(`📂 Category ${index + 1}:`, category.name || category._id, '- Books:', category.books?.data?.length || 0);
            if (category.books && category.books.data && Array.isArray(category.books.data)) {
              booksArray = booksArray.concat(category.books.data);
            }
          });
          console.log('📚 Extracted', booksArray.length, 'books from', data.data.length, 'categories');
        } else {
          // It's a paginated response: { data: [...books...], pagination: {...} }
          console.log('📚 Paginated response - extracting', data.data.length, 'books from data.data');
          booksArray = data.data;
        }
      } else if (data.books && Array.isArray(data.books)) {
        // Books directly in response
        console.log('📚 Books found directly in response');
        booksArray = data.books;
      }

      console.log('📚 Total books extracted:', booksArray.length, 'items');

      if (booksArray.length === 0) {
        console.warn('📚 API returned no books - returning empty array');
        return [];
      }

      // Log first 3 books to see structure
      console.log('📖 ===== RAW API BOOKS (first 3) =====');
      booksArray.slice(0, 3).forEach((book, idx) => {
        console.log(`📖 Book ${idx + 1} (raw):`, JSON.stringify(book, null, 2));
        console.log(`📖 Book ${idx + 1} - All keys:`, Object.keys(book));
        console.log(`🖼️ Book ${idx + 1} - Cover fields:`, {
          coverURI: book.coverURI,
          coverUri: book.coverUri,
          coverMiniURI: book.coverMiniURI,
          coverMiniUri: book.coverMiniUri,
          coverUrl: book.coverUrl,
          cover_url: book.cover_url,
          cover: book.cover,
          coverImage: book.coverImage,
          cover_image: book.cover_image,
          image: book.image,
          imageUrl: book.imageUrl,
          image_url: book.image_url,
          thumbnail: book.thumbnail,
          thumbnailUrl: book.thumbnailUrl,
          thumbnail_url: book.thumbnail_url,
        });
        console.log(`📝 Book ${idx + 1} - Title:`, book.title || book.name || book._id);
        console.log(`🆔 Book ${idx + 1} - ID:`, book._id || book.id);
      });
      console.log('📖 ===== END RAW API BOOKS =====');

      // Transform API response to match Book interface
      const transformedBooks = transformBooks(booksArray);
      console.log('✨ Transformed books:', transformedBooks.length, 'items');

      // Log first 3 transformed books
      console.log('📖 ===== TRANSFORMED BOOKS (first 3) =====');
      transformedBooks.slice(0, 3).forEach((book, idx) => {
        console.log(`📖 Transformed Book ${idx + 1}:`, JSON.stringify(book, null, 2));
        console.log(`📖 Transformed Book ${idx + 1} - Title:`, book.title);
        console.log(`📖 Transformed Book ${idx + 1} - ID:`, book.id);
        console.log(`📖 Transformed Book ${idx + 1} - CoverUrl:`, book.coverUrl);
      });
      console.log('📖 ===== END TRANSFORMED BOOKS =====');

      // Verify these are NOT mock books by checking titles
      const mockTitles = MOCK_BOOKS.map(b => b.title);
      const apiTitles = transformedBooks.map(b => b.title);
      const isMockData = apiTitles.every(title => mockTitles.includes(title));

      if (isMockData && transformedBooks.length === MOCK_BOOKS.length) {
        console.error('❌ WARNING: Transformed books match MOCK_BOOKS exactly!');
        console.error('❌ This means we might be using mock data instead of API data!');
        console.error('📊 API Titles:', apiTitles);
        console.error('📊 Mock Titles:', mockTitles);
      } else {
        console.log('✅ Verified: These are REAL API books (not mock data)');
        console.log('📊 API returned', transformedBooks.length, 'books with titles:', apiTitles.slice(0, 5));
      }

      // If no valid books after transformation
      if (transformedBooks.length === 0) {
        console.warn("⚠️ API returned no valid books after transformation");
        return [];
      }

      // Check if we have real cover URLs
      const booksWithCovers = transformedBooks.filter(b => b.coverUrl && b.coverUrl.length > 0);
      console.log('🖼️ Books with cover URLs:', booksWithCovers.length, 'out of', transformedBooks.length);

      if (booksWithCovers.length === 0) {
        console.warn('⚠️ No books have cover URLs - covers might be missing in API response');
      }

      // Check if we're getting real data (not mock)
      const hasRealData = transformedBooks.some(book =>
        !book.coverUrl.includes('picsum.photos') &&
        !book.coverUrl.includes('placeholder') &&
        book.coverUrl.length > 0
      );

      if (hasRealData) {
        console.log('🎉 Successfully loaded', transformedBooks.length, 'REAL books from API!');
      } else {
        console.warn('⚠️ Books loaded but all have placeholder images - might still be mock data');
      }

      return transformedBooks;
    } catch (error) {
      console.error("❌ Failed to fetch books from API:", error);
      // Throw error so context can handle it and show error state
      throw error;
    }
  },

  getFeaturedBooks: async (): Promise<Book[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/featured`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        const booksArray = Array.isArray(data) ? data : (data.books || data.data || []);
        return transformBooks(booksArray);
      }

      // Fallback to getting all books and slicing
      const books = await ApiService.getBooks();
      return books.slice(0, 5);
    } catch (error) {
      console.warn("Failed to fetch featured books, using fallback:", error);
      const books = await ApiService.getBooks();
      return books.slice(0, 5);
    }
  },

  getFeaturedPlaylists: async (): Promise<Playlist[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}playlists/featured`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.playlists || data.data || []);
      }

      return [];
    } catch (error) {
      console.warn("Failed to fetch featured playlists:", error);
      return [];
    }
  },

  getFeaturedContent: async (): Promise<Array<Book | Playlist>> => {
    const cacheKey = 'featured_content';
    const cached = getCached<Array<Book | Playlist>>(cacheKey);
    if (cached) return cached;

    try {
      const [featuredBooks, featuredPlaylists] = await Promise.all([
        ApiService.getFeaturedBooks(),
        ApiService.getFeaturedPlaylists(),
      ]);

      // Combine and sort by featuredOrder
      const combined = [
        ...featuredBooks.map(b => ({ ...b, _itemType: 'book' as const })),
        ...featuredPlaylists.map(p => ({ ...p, _itemType: 'playlist' as const })),
      ];

      // Sort by featuredOrder (lower = first)
      combined.sort((a, b) => ((a as any).featuredOrder || 0) - ((b as any).featuredOrder || 0));
      
      setCache(cacheKey, combined);

      return combined;
    } catch (error) {
      console.warn("Failed to fetch featured content:", error);
      return [];
    }
  },

  // Get top-rated books (15%+ likes/favorites to reads ratio)
  getTopRatedBooks: async (minRatio: number = 0.15): Promise<Book[]> => {
    const cacheKey = `top_rated_books_${minRatio}`;
    const cached = getCached<Book[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/top-rated?minRatio=${minRatio}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        const result = transformBooks(Array.isArray(data) ? data : []);
        setCache(cacheKey, result);
        return result;
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch top-rated books:", error);
      return [];
    }
  },

  // Get top-rated playlists (15%+ likes/favorites to plays ratio)
  getTopRatedPlaylists: async (minRatio: number = 0.15): Promise<Playlist[]> => {
    const cacheKey = `top_rated_playlists_${minRatio}`;
    const cached = getCached<Playlist[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}playlists/top-rated?minRatio=${minRatio}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        const result = Array.isArray(data) ? data : [];
        setCache(cacheKey, result);
        return result;
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch top-rated playlists:", error);
      return [];
    }
  },

  // Get all published book series
  getBookSeries: async (): Promise<any[]> => {
    const cacheKey = 'book_series';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}book-series`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        const result = Array.isArray(data) ? data : [];
        setCache(cacheKey, result);
        return result;
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch book series:", error);
      return [];
    }
  },

  // Get featured book series
  getFeaturedBookSeries: async (): Promise<any[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}book-series/featured`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      console.warn("Failed to fetch featured book series:", error);
      return [];
    }
  },

  // Get a single book series by ID
  getBookSeriesById: async (id: string): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}book-series/${id}`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn("Failed to fetch book series:", error);
      return null;
    }
  },

  login: async (provider: 'apple' | 'google' | 'email', credentials?: { email?: string; password?: string }): Promise<{ success: boolean; token?: string; user?: any; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();

      // Get or generate device info
      const getDeviceId = (): string => {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
      };

      // Detect platform
      const getPlatform = (): string => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(userAgent)) return 'android';
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
        return 'web';
      };

      let body: any;
      let endpoint: string;

      // Prepare request body based on provider
      if (provider === 'email' && credentials?.email && credentials?.password) {
        // Standard email/password login using /authentication/sign-in
        endpoint = `${baseUrl}authentication/sign-in`;
        body = {
          email: credentials.email,
          password: credentials.password,
          deviceInfo: {
            deviceId: getDeviceId(),
            pushToken: '', // Can be set later if needed
            platform: getPlatform()
          }
        };
      } else if (provider === 'apple' || provider === 'google') {
        // OAuth providers - try sign-in/skip endpoint for social login
        endpoint = `${baseUrl}authentication/sign-in/skip`;
        body = {
          provider: provider,
          deviceInfo: {
            deviceId: getDeviceId(),
            pushToken: '',
            platform: getPlatform()
          }
        };
      } else {
        // Fallback: try skip endpoint for guest/quick access
        endpoint = `${baseUrl}authentication/sign-in/skip`;
        body = {
          deviceInfo: {
            deviceId: getDeviceId(),
            pushToken: '',
            platform: getPlatform()
          }
        };
      }

      console.log(`🔐 Attempting login with endpoint: ${endpoint}`);
      console.log(`📦 Request body:`, { ...body, password: body.password ? '***' : undefined });
      console.log(`📧 Email provided:`, !!credentials?.email);
      console.log(`🔑 Password provided:`, !!credentials?.password);

      // Make sure we're using the correct endpoint for email login
      if (provider === 'email' && (!credentials?.email || !credentials?.password)) {
        console.error('❌ Email login requires both email and password!');
        return {
          success: false,
          error: 'Email and password are required for email login'
        };
      }

      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      console.log(`📡 Login response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Login successful! Response data:', data);

        // Extract tokens
        const token = data.accessToken;
        const refreshToken = data.refreshToken;

        if (!token) {
          console.error('❌ No accessToken in response:', data);
          return {
            success: false,
            error: 'Login response missing accessToken'
          };
        }

        // Store token
        authService.setToken(token, undefined, refreshToken);
        console.log('✅ Auth token stored successfully');

        // Store user data
        if (data.user) {
          authService.setUser(data.user);
          console.log('✅ User data stored:', data.user);
        }

        // Trigger books reload by dispatching event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('authTokenUpdated'));
        }

        return {
          success: true,
          token: token,
          refreshToken: refreshToken,
          user: data.user
        };
      } else {
        // Handle error response
        let errorMessage = `Login failed: ${response.status} ${response.statusText}`;
        let errorData: any = {};
        try {
          errorData = await response.json();
          console.error('❌ Login error response:', errorData);

          // Handle different error formats
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }

          // Check if this is a legacy account that needs migration
          if (errorData.code === 'LEGACY_ACCOUNT') {
            console.log('🔄 Legacy account detected, needs migration');
            return {
              success: false,
              code: 'LEGACY_ACCOUNT',
              hasSubscription: errorData.hasSubscription || false,
              error: errorData.message || 'Account found in previous app. Please set a new password.'
            };
          }
          
          // Check if error is about email confirmation
          const errorStr = JSON.stringify(errorData).toLowerCase();
          if (errorStr.includes('confirm') || errorStr.includes('verified') || errorStr.includes('verification')) {
            // Allow user to proceed anyway - they can confirm email later
            console.warn('⚠️ Email confirmation required, but allowing access to onboarding');
            // Return success with a flag that email needs confirmation
            return {
              success: true,
              token: null, // No token yet, but allow navigation
              error: 'Email confirmation required. You can confirm your email later.',
              needsConfirmation: true
            };
          }
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          // Try to get error text
          try {
            const text = await response.text();
            console.error('❌ Error response text:', text);
            errorMessage = text || errorMessage;

            // Check if text mentions confirmation
            if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('verified')) {
              return {
                success: true,
                token: null,
                error: 'Email confirmation required. You can confirm your email later.',
                needsConfirmation: true
              };
            }
          } catch {
            // Couldn't get error text either
          }
        }

        console.error('❌ Login failed with error:', errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during login'
      };
    }
  },

  // Sign up endpoint
  signUp: async (email: string, password: string, additionalData?: { firstName?: string; lastName?: string; age?: number }): Promise<{ success: boolean; token?: string; user?: any; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();

      const getDeviceId = (): string => {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
      };

      const getPlatform = (): string => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(userAgent)) return 'android';
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
        return 'web';
      };

      const endpoint = `${baseUrl}authentication/sign-up`;
      const body = {
        email,
        password,
        ...additionalData,
        deviceInfo: {
          deviceId: getDeviceId(),
          pushToken: '',
          platform: getPlatform()
        }
      };

      console.log(`🔐 Attempting sign-up with endpoint: ${endpoint}`);

      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        timeout: 10000, // 10 seconds for sign-up (reasonable timeout)
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.accessToken;
        const refreshToken = data.refreshToken;

        if (token) {
          authService.setToken(token, undefined, refreshToken);
          if (data.user) {
            authService.setUser(data.user);
          }
        }

        return {
          success: true,
          token: token,
          refreshToken: refreshToken,
          user: data.user
        };
      } else {
        let errorData: any = { message: 'Sign-up failed' };
        try {
          errorData = await response.json();
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await response.text();
            errorData = { message: text || `Sign-up failed: ${response.status} ${response.statusText}` };
          } catch {
            errorData = { message: `Sign-up failed: ${response.status} ${response.statusText}` };
          }
        }
        return {
          success: false,
          error: errorData.message || `Sign-up failed: ${response.statusText}`
        };
      }
    } catch (error) {
      console.error("Sign-up error:", error);

      // Handle AbortError specifically
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please check your internet connection and try again.'
        };
      }

      // Handle other errors
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message.includes('aborted')
            ? 'Request was cancelled. Please try again.'
            : error.message
        };
      }

      return {
        success: false,
        error: 'Network error during sign-up. Please check your connection and try again.'
      };
    }
  },

  // Dev helper: Manually set token for testing
  setDevToken: (token: string): void => {
    console.warn('⚠️ DEV MODE: Manually setting auth token');
    authService.setToken(token);
  },

  logout: async (): Promise<void> => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authService.getToken();

      if (token) {
        // Try to call logout endpoint
        await fetchWithTimeout(`${baseUrl}auth/logout`, {
          method: 'POST',
        }).catch(() => {
          // Ignore errors on logout - we'll clear local storage anyway
        });
      }
    } finally {
      // Always clear local storage
      authService.clearToken();
    }
  },

  // Get book by ID
  getBookById: async (id: string): Promise<Book | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching book by ID: ${baseUrl}books/${id}`);

      const response = await fetchWithTimeout(`${baseUrl}books/${id}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Book data received for ID ${id}:`, data);
        // Transform the book but preserve the full raw data structure
        const transformed = transformBook(data);
        // Attach the raw data to preserve files.audio and other nested structures
        (transformed as any).rawData = data;
        return transformed;
      }

      console.warn(`⚠️ Failed to fetch book ${id}: ${response.status}`);
      return null;
    } catch (error) {
      console.warn(`❌ Failed to fetch book ${id}:`, error);
      return null;
    }
  },

  // Increment book view count (called when book is OPENED)
  incrementBookView: async (bookId: string): Promise<{ viewCount: number } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/${bookId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn(`Failed to increment view count for book ${bookId}:`, error);
      return null;
    }
  },

  // Increment book like count
  incrementBookLike: async (bookId: string, action: 'add' | 'remove' = 'add'): Promise<{ likeCount: number } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/${bookId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn(`Failed to update like for book ${bookId}:`, error);
      return null;
    }
  },

  // Get books by category
  getBooksByCategory: async (category: string): Promise<Book[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching books by category: ${category}`);

      // Try different endpoint variations for category filtering
      const categoryEndpoints = [
        `${baseUrl}books?category=${encodeURIComponent(category)}`,
        `${baseUrl}books/category/${encodeURIComponent(category)}`,
        `${baseUrl}books?genre=${encodeURIComponent(category)}`,
        `${baseUrl}categories/${encodeURIComponent(category)}/books`,
      ];

      for (const endpoint of categoryEndpoints) {
        try {
          const response = await fetchWithTimeout(endpoint, {
            method: 'GET',
          });

          if (response.ok) {
            const data = await response.json();
            const booksArray = Array.isArray(data) ? data : (data.books || data.data || []);
            const transformedBooks = transformBooks(booksArray);
            if (transformedBooks.length > 0) {
              console.log(`✅ Found ${transformedBooks.length} books in category "${category}"`);
              return transformedBooks;
            }
          }
        } catch (error) {
          console.log(`❌ Category endpoint failed: ${endpoint}`, error);
        }
      }

      // Fallback: get all books and filter by category
      console.log(`⚠️ Category endpoint not found, filtering all books by category`);
      const allBooks = await ApiService.getBooks();
      return allBooks.filter(book =>
        book.category.toLowerCase() === category.toLowerCase()
      );
    } catch (error) {
      console.error(`❌ Failed to fetch books by category "${category}":`, error);
      return [];
    }
  },

  // Get pages for a book
  getBookPages: async (bookId: string): Promise<any[]> => {
    const cacheKey = `book_pages_${bookId}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching pages for book ID: ${bookId}`);

      const response = await fetchWithTimeout(`${baseUrl}pages/book/${bookId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Pages received for book ${bookId}:`, data.length);
        setCache(cacheKey, data);
        return data;
      }

      console.warn(`⚠️ Failed to fetch pages for book ${bookId}: ${response.status}`);
      return [];
    } catch (error) {
      console.error(`❌ Failed to fetch pages for book ${bookId}:`, error);
      return [];
    }
  },



  // TTS: Generate Audio
  generateTTS: async (
    text: string, 
    voiceId: string, 
    bookId?: string,
    languageCode?: string
  ): Promise<{ audioUrl: string; alignment: any } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId, bookId, languageCode }),
        timeout: 60000 // 60 seconds for TTS generation (can take longer for longer texts)
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      }
      console.error('TTS Generation failed:', await response.text());
      return null;
    } catch (error: any) {
      // Handle AbortError gracefully (expected when request is cancelled or times out)
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
        // Silently handle abort - this is expected behavior
        return null;
      }
      console.error('TTS Error:', error);
      return null;
    }
  },

  // TTS: Get Voices (from enabled voices only - synced with portal)
  getVoices: async (): Promise<any[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      // Use the enabled voices endpoint to get only voices enabled in the portal
      console.log('🔊 Fetching enabled voices from portal...');
      const response = await fetchWithTimeout(`${baseUrl}voices/enabled`, {
        method: 'GET'
      });

      if (response.ok) {
        const voices = await response.json();
        console.log(`✅ Loaded ${voices.length} enabled voice(s) from portal`);
        // Map to expected format for backward compatibility
        const mappedVoices = voices.map((v: any) => ({
          voice_id: v.voiceId,
          name: v.customName || v.name, // Use customName if available, otherwise use name
          preview_url: v.previewUrl,
          category: v.category,
          characterImage: v.characterImage // Include character image
        }));
        
        if (mappedVoices.length === 0) {
          console.warn('⚠️ No voices enabled in portal. Users should enable voices in the portal first.');
        }
        
        return mappedVoices;
      }
      
      // Fallback to TTS endpoint if voices endpoint doesn't exist (for backward compatibility)
      console.warn('⚠️ Enabled voices endpoint not available, falling back to TTS endpoint');
      const fallbackResponse = await fetchWithTimeout(`${baseUrl}tts/voices`, {
        method: 'GET'
      });
      if (fallbackResponse.ok) {
        const fallbackVoices = await fallbackResponse.json();
        console.log(`✅ Loaded ${fallbackVoices.length} voice(s) from TTS endpoint (fallback)`);
        return fallbackVoices;
      }
      
      console.warn('⚠️ No voices available from any endpoint');
      return [];
    } catch (error) {
      console.error('❌ Get Voices Error:', error);
      return [];
    }
  },

  // Get active music from backend (for background music, game music, etc.)
  getActiveMusic: async (): Promise<Record<string, { audioUrl: string; defaultVolume: number; loop: boolean; name: string }> | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log('🎵 Fetching active music from backend...');
      const response = await fetchWithTimeout(`${baseUrl}music/active`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Active music loaded:', Object.keys(data));
        return data;
      }
      
      console.warn('⚠️ Music endpoint returned non-OK status');
      return null;
    } catch (error) {
      console.warn('⚠️ Could not fetch music from backend:', error);
      return null;
    }
  },

  // Increment book read count (called when user completes reading a book)
  incrementBookReadCount: async (bookId: string): Promise<number | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/${bookId}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📖 Book read count incremented to ${data.readCount}`);
        return data.readCount;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not increment book read count:', error);
      return null;
    }
  },

  // Update book favorite count
  updateBookFavoriteCount: async (bookId: string, action: 'add' | 'remove'): Promise<number | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}books/${bookId}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`❤️ Book favorite count: ${data.favoriteCount}`);
        return data.favoriteCount;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not update book favorite count:', error);
      return null;
    }
  },

  // Increment playlist play count
  incrementPlaylistPlayCount: async (playlistId: string): Promise<number | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}playlists/${playlistId}/play`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`🎵 Playlist play count: ${data.playCount}`);
        return data.playCount;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not increment playlist play count:', error);
      return null;
    }
  },

  // Increment individual song/episode play count
  incrementItemPlayCount: async (playlistId: string, itemId: string): Promise<{ itemPlayCount: number; playlistPlayCount: number } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}playlists/${playlistId}/items/${itemId}/play`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`🎵 Song play count: ${data.itemPlayCount}, Playlist total: ${data.playlistPlayCount}`);
        return data;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not increment item play count:', error);
      return null;
    }
  },

  // Get all playlists (optionally filtered by status)
  getPlaylists: async (status?: 'draft' | 'published'): Promise<any[]> => {
    const cacheKey = `playlists_${status || 'all'}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      const queryParam = status ? `?status=${status}` : '';
      const response = await fetchWithTimeout(`${baseUrl}playlists${queryParam}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both paginated response { data: [], pagination: {} } and direct array
        let result: any[];
        if (data.data && Array.isArray(data.data)) {
          result = data.data;
        } else {
          result = Array.isArray(data) ? data : [];
        }
        setCache(cacheKey, result);
        return result;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch playlists:', error);
      return [];
    }
  },

  // Get all categories (returns full category objects with name, color, icon, etc.)
  // Optional type parameter: 'book' or 'audio' to filter categories
  // Optional explore parameter: true to get only categories that show on explore page
  getCategories: async (type?: 'book' | 'audio', explore?: boolean): Promise<Array<{ _id: string; name: string; description?: string; color: string; icon?: string; showOnExplore?: boolean }>> => {
    const cacheKey = `categories_${type || 'all'}_${explore ? 'explore' : 'all'}`;
    const cached = getCached<Array<{ _id: string; name: string; description?: string; color: string; icon?: string; showOnExplore?: boolean }>>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching categories from API${type ? ` (type: ${type})` : ''}${explore ? ' (explore: true)' : ''}`);

      // Build endpoint with filters if provided
      const queryParams = [];
      if (type) queryParams.push(`type=${type}`);
      if (explore) queryParams.push(`explore=true`);
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      
      // Try different endpoint variations for categories
      const categoryEndpoints = [
        `${baseUrl}categories${queryString}`, // New categories endpoint with filters
        `${baseUrl}categories${queryString}`,
        `${baseUrl}books/categories`,
        `${baseUrl}genres`,
        `${baseUrl}books/genres`,
      ];

      for (const endpoint of categoryEndpoints) {
        try {
          const response = await fetchWithTimeout(endpoint, {
            method: 'GET',
          });

          if (response.ok) {
            const data = await response.json();
            const categories = Array.isArray(data) ? data : (data.categories || data.data || []);
            if (categories.length > 0) {
              console.log(`✅ Found ${categories.length} categories${type ? ` (filtered by type: ${type})` : ''}${explore ? ' (explore page)' : ''}`);
              // Return full category objects
              const result = categories.map((cat: any) => ({
                _id: cat._id || cat.id || '',
                name: String(cat.name || cat.title || cat),
                description: cat.description,
                color: cat.color || '#6366f1',
                icon: cat.icon,
                showOnExplore: cat.showOnExplore || false,
              }));
              setCache(cacheKey, result);
              return result;
            }
          }
        } catch (error) {
          console.log(`❌ Category endpoint failed: ${endpoint}`, error);
        }
      }

      // Fallback: extract categories from books
      console.log(`⚠️ Categories endpoint not found, extracting from books`);
      const allBooks = await ApiService.getBooks();
      const uniqueCategories = [...new Set(allBooks.map(book => book.category))];
      // Return as category objects for consistency
      const fallbackResult = uniqueCategories
        .filter(cat => cat && cat !== 'Uncategorized')
        .map((name, index) => ({
          _id: `fallback-${index}`,
          name: String(name),
          color: '#6366f1',
        }));
      setCache(cacheKey, fallbackResult);
      return fallbackResult;
    } catch (error) {
      console.error(`❌ Failed to fetch categories:`, error);
      return [];
    }
  },

  // Get category names only (for backward compatibility)
  getCategoryNames: async (): Promise<string[]> => {
    const categories = await ApiService.getCategories();
    return categories.map(cat => cat.name);
  },

  // Voice Cloning: Clone a voice from audio samples
  cloneVoice: async (
    name: string,
    audioFiles: File[],
    description?: string
  ): Promise<{ success: boolean; voice?: any; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const formData = new FormData();
      formData.append('name', name);
      if (description) {
        formData.append('description', description);
      }
      
      audioFiles.forEach((file) => {
        formData.append('samples', file);
      });

      const token = authService.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Use longer timeout for voice cloning (120 seconds - 2 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(`${baseUrl}voice-cloning/clone`, {
          method: 'POST',
          body: formData,
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return { success: true, voice: data.voice };
        } else {
          const errorData = await response.json();
          return { success: false, error: errorData.message || 'Failed to clone voice' };
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          return { success: false, error: 'Request timeout - voice cloning takes time' };
        }
        throw error;
      }
    } catch (error: any) {
      console.error('❌ Voice Cloning Error:', error);
      
      // Try to extract error message from response
      let errorMessage = 'Failed to clone voice';
      if (error.response) {
        try {
          const errorData = await error.response.json();
          errorMessage = errorData.message || error.message || 'Failed to clone voice';
        } catch {
          errorMessage = error.response.statusText || error.message || 'Failed to clone voice';
        }
      } else {
        errorMessage = error.message || 'Failed to clone voice';
      }
      
      return { success: false, error: errorMessage };
    }
  },

  // Voice Cloning: Delete a cloned voice
  deleteClonedVoice: async (voiceId: string): Promise<boolean> => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authService.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetchWithTimeout(`${baseUrl}voice-cloning/clone/${voiceId}`, {
        method: 'DELETE',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('Delete Cloned Voice Error:', error);
      return false;
    }
  },

  // Lessons API
  getLessons: async (): Promise<any[]> => {
    const cacheKey = 'lessons';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      console.log('📚 Fetching lessons from:', `${baseUrl}lessons?published=true`);
      const response = await fetchWithTimeout(`${baseUrl}lessons?published=true`, {
        method: 'GET',
      });

      console.log('📚 Lessons API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📚 Lessons API response data:', data);
        // Handle both paginated response { data: [], pagination: {} } and direct array
        let result: any[];
        if (data.data && Array.isArray(data.data)) {
          result = data.data;
        } else {
          result = Array.isArray(data) ? data : [];
        }
        setCache(cacheKey, result);
        return result;
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('⚠️ Failed to fetch lessons:', response.status, errorText);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch lessons:', error);
      return [];
    }
  },

  // Games API - Get games for Daily Tasks & IQ Games section
  getDailyTaskGames: async (): Promise<any[]> => {
    const cacheKey = 'daily_task_games';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const baseUrl = getApiBaseUrl();
      console.log('🎮 Fetching daily task games from:', `${baseUrl}games/daily-tasks`);
      const response = await fetchWithTimeout(`${baseUrl}games/daily-tasks`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🎮 Daily task games:', data);
        const result = Array.isArray(data) ? data : [];
        setCache(cacheKey, result);
        return result;
      }

      console.warn('⚠️ Failed to fetch daily task games:', response.status);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch daily task games:', error);
      return [];
    }
  },

  getLesson: async (lessonId: string): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}lessons/${lessonId}`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }

      console.warn(`⚠️ Failed to fetch lesson ${lessonId}:`, response.status);
      return null;
    } catch (error) {
      console.error(`❌ Failed to fetch lesson ${lessonId}:`, error);
      return null;
    }
  },

  completeLesson: async (
    lessonId: string,
    userId: string,
    progress: { videoWatched: boolean; devotionalRead: boolean; activityCompleted: boolean },
    activityResponse?: any,
    coinsAwarded?: number
  ): Promise<{ completion: any; coinsAwarded: number } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, progress, activityResponse, coinsAwarded }),
      });

      if (response.ok) {
        return await response.json();
      }

      console.warn(`⚠️ Failed to complete lesson ${lessonId}:`, response.status);
      return null;
    } catch (error) {
      console.error(`❌ Failed to complete lesson ${lessonId}:`, error);
      return null;
    }
  },

  getLessonCompletion: async (lessonId: string, userId: string): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}lessons/${lessonId}/completion?userId=${userId}`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to fetch lesson completion:`, error);
      return null;
    }
  },

  // === BOOK QUIZ API ===

  // Generate a quiz for a book using AI (age-appropriate)
  generateBookQuiz: async (bookId: string, age?: number): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, age: age || 6 }),
        timeout: 60000, // 60 seconds - OpenAI quiz generation can take a while
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📝 Quiz generated for book ${bookId} (age ${age || 6}):`, data.cached ? 'from cache' : 'newly generated');
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to generate book quiz:', error);
      return null;
    }
  },

  // Generate just the first question quickly (for progressive loading)
  generateFirstQuestion: async (bookId: string, age?: number): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`⚡ Generating first question for book ${bookId}...`);
      const response = await fetchWithTimeout(`${baseUrl}quiz/generate-first`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, age: age || 6 }),
        timeout: 15000, // 15 seconds for just one question
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`⚡ First question ready:`, data.cached ? 'from cache' : 'newly generated');
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to generate first question:', error);
      return null;
    }
  },

  // Generate remaining questions in background
  generateRemainingQuestions: async (bookId: string, age?: number, firstQuestion?: any): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`📝 Generating remaining questions for book ${bookId}...`);
      const response = await fetchWithTimeout(`${baseUrl}quiz/generate-remaining`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, age: age || 6, firstQuestion }),
        timeout: 60000, // 60 seconds for remaining questions
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📝 All questions ready:`, data.questions?.length || 0, 'questions');
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to generate remaining questions:', error);
      return null;
    }
  },

  // Get quiz for a book (age-appropriate)
  getBookQuiz: async (bookId: string, userId?: string, age?: number): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (age) params.append('age', age.toString());
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      const response = await fetchWithTimeout(`${baseUrl}quiz/${bookId}${queryString}`, {
        method: 'GET',
        timeout: 30000, // 30 seconds for fetching quiz
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get book quiz:', error);
      return null;
    }
  },

  // Submit quiz answers (with age for validation)
  submitBookQuiz: async (bookId: string, userId: string, answers: number[], age?: number): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}quiz/${bookId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, answers, age: age || 6 }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Quiz submitted: ${data.score}/${data.totalQuestions} correct, ${data.coinsEarned} coins earned`);
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to submit book quiz:', error);
      return null;
    }
  },

  // Get user's quiz attempts for a book
  getBookQuizAttempts: async (bookId: string, userId: string): Promise<any | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}quiz/${bookId}/attempts/${userId}`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get quiz attempts:', error);
      return null;
    }
  },
};

// Log API configuration on startup
if (typeof window !== 'undefined') {
  const baseUrl = getApiBaseUrl();
  console.log('🌐 API Configuration:');
  console.log('   Base URL:', baseUrl);
  console.log('   Environment override:', import.meta.env.VITE_API_BASE_URL || 'None (using default)');
  console.log('   Default URL:', API_BASE_URL);
}

// Expose dev helpers in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).setDevAuthToken = (token: string) => {
    ApiService.setDevToken(token);
    console.log('✅ Dev token set. Refresh the page to load books from API.');
  };

  (window as any).testApiConnection = async () => {
    console.log('🧪 Testing API connection...');
    const baseUrl = getApiBaseUrl();
    const token = authService.getToken();

    console.log('📍 API Base URL:', baseUrl);
    console.log('🔑 Has Token:', !!token);
    if (token) {
      console.log('🔑 Token (first 20 chars):', token.substring(0, 20) + '...');
    }

    // Test authentication endpoint first
    console.log('\n📡 Testing Authentication Endpoint...');
    try {
      const authResponse = await fetch(`${baseUrl}authentication/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'test',
          deviceInfo: {
            deviceId: 'test-device',
            pushToken: '',
            platform: 'web'
          }
        })
      });

      console.log('📡 Auth Endpoint Status:', authResponse.status, authResponse.statusText);
      const authData = await authResponse.json().catch(() => ({}));
      console.log('📡 Auth Endpoint Response:', authData);
    } catch (error) {
      console.log('❌ Auth Endpoint Error:', error);
    }

    // Test books endpoint - try the user endpoint first
    console.log('\n📡 Testing Books Endpoints...');

    const booksEndpoints = [
      { url: `${baseUrl}v3/books/by-categories?page=1&limit=10`, name: 'v3/books/by-categories (User endpoint)' },
      { url: `${baseUrl}books`, name: 'books (Admin endpoint)' },
    ];

    for (const endpoint of booksEndpoints) {
      try {
        console.log(`\n🔍 Testing: ${endpoint.name}`);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add authorization header with format: "Bearer <token>"
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('🔑 Test: Adding Authorization header: Bearer', token.substring(0, 20) + '...');
        }

        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers,
        });

        console.log('📡 Response Status:', response.status, response.statusText);
        console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint.name} Response:`, data);

          // Handle v3/books/by-categories structure
          if (data.data && Array.isArray(data.data)) {
            let totalBooks = 0;
            data.data.forEach((cat: any) => {
              if (cat.books?.data) totalBooks += cat.books.data.length;
            });
            console.log('📚 Categories:', data.data.length);
            console.log('📚 Total books across categories:', totalBooks);
            if (data.data[0]?.books?.data?.[0]) {
              console.log('📖 First book sample:', data.data[0].books.data[0]);
            }
          } else {
            console.log('📚 Books count:', Array.isArray(data) ? data.length : (data.books?.length || data.data?.length || 0));
            if (Array.isArray(data) && data.length > 0) {
              console.log('📖 First book sample:', data[0]);
            } else if (data.books && data.books.length > 0) {
              console.log('📖 First book sample:', data.books[0]);
            }
          }

          // If this endpoint worked, we're done
          console.log(`\n✅ ${endpoint.name} works! Use this endpoint.`);
          break;
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error(`❌ ${endpoint.name} Error:`, errorData);
          if (response.status === 401) {
            console.warn('💡 You need to authenticate first. Use the login form or set a token with window.setDevAuthToken()');
          } else if (response.status === 403) {
            console.warn('💡 403 Forbidden - This endpoint requires different permissions');
          }
        }
      } catch (error) {
        console.error(`❌ ${endpoint.name} Connection Error:`, error);
      }
    }

    console.log('\n✅ Connection test complete!');
  };

  console.log('💡 Dev Helpers:');
  console.log('   - window.setDevAuthToken("your-token") - Set auth token manually');
  console.log('   - window.testApiConnection() - Test API connection and see response');
}