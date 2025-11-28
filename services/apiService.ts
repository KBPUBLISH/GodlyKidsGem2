import { API_BASE_URL, MOCK_BOOKS } from '../constants';
import { Book } from '../types';
import { authService } from './authService';

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
  const rawCoverUrl = apiBook.coverURI ||
    apiBook.coverUri ||
    apiBook.coverMiniURI ||
    apiBook.coverMiniUri ||
    apiBook.coverUrl ||
    apiBook.cover_url ||
    apiBook.cover ||
    apiBook.coverImage ||
    apiBook.cover_image ||
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
  };
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

        // Handle different error status codes
        if (response.status === 401) {
          if (token) {
            console.warn('⚠️ Token exists but API returned 401 Unauthorized. Token may be expired or invalid.');
            console.warn('💡 Try logging in again to refresh your token.');
          } else {
            console.warn('⚠️ No authentication token. API requires authentication.');
            console.warn('💡 Please log in to access the API and see real data from the dev database.');
          }

          console.warn('⚠️ Returning mock data due to 401 Unauthorized');
          await new Promise(resolve => setTimeout(resolve, 300));
          return MOCK_BOOKS;
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

          console.warn('⚠️ Returning mock data due to 403 Forbidden - no alternative endpoints worked');
          await new Promise(resolve => setTimeout(resolve, 300));
          return MOCK_BOOKS;
        }

        // For other errors, also return mock data as fallback
        console.warn(`⚠️ API request failed with status ${response.status}, returning mock data as fallback`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return MOCK_BOOKS;
      }

      const data = await response.json();
      console.log('✅ API Response received:', data);
      console.log('📊 API Response type:', Array.isArray(data) ? 'Array' : typeof data);
      console.log('📊 API Response keys:', Array.isArray(data) ? 'N/A (array)' : Object.keys(data));
      console.log('📊 Full API Response (first 2000 chars):', JSON.stringify(data, null, 2).substring(0, 2000));
      console.log('📊 Full API Response (complete):', JSON.stringify(data, null, 2));

      // Handle the /v3/books/by-categories response structure
      // Response structure: { data: [{ _id, name, books: { data: [...] } }], total, pagesTotal, page, limit }
      let booksArray: any[] = [];

      if (data.data && Array.isArray(data.data)) {
        // Extract books from all categories
        console.log('📂 Processing', data.data.length, 'categories...');
        data.data.forEach((category: any, index: number) => {
          console.log(`📂 Category ${index + 1}:`, category.name || category._id, '- Books:', category.books?.data?.length || 0);
          if (category.books && category.books.data && Array.isArray(category.books.data)) {
            booksArray = booksArray.concat(category.books.data);
          }
        });
        console.log('📚 Extracted', booksArray.length, 'books from', data.data.length, 'categories');
      } else if (Array.isArray(data)) {
        // Fallback: if response is directly an array
        console.log('📚 Response is direct array of books');
        booksArray = data;
      } else if (data.books && Array.isArray(data.books)) {
        // Fallback: if books is directly in response
        console.log('📚 Books found directly in response');
        booksArray = data.books;
      } else if (data.data && Array.isArray(data.data) && data.data.length > 0 && !data.data[0].books) {
        // Fallback: if data is directly an array of books (not categories)
        console.log('📚 Data is direct array of books');
        booksArray = data.data;
      }

      console.log('📚 Total books extracted:', booksArray.length, 'items');

      if (booksArray.length === 0) {
        console.error('❌ API returned no books after extraction');
        console.error('📊 Full API response structure:', JSON.stringify(data, null, 2));
        console.error('💡 Check if the API response structure matches expected format');
        return MOCK_BOOKS;
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

      // If no valid books after transformation, fall back to mock data
      if (transformedBooks.length === 0) {
        console.error("❌ API returned no valid books after transformation");
        console.error('📊 Original books array length:', booksArray.length);
        console.error('📊 First original book:', booksArray[0]);
        console.error('💡 Check if field mapping is correct (coverURI, minAge, etc.)');
        return MOCK_BOOKS;
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
      console.error("❌ Failed to fetch from API, using mock data:", error);
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 800));
      return MOCK_BOOKS;
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
        return transformBooks(booksArray).slice(0, 3);
      }

      // Fallback to getting all books and slicing
      const books = await ApiService.getBooks();
      return books.slice(0, 3);
    } catch (error) {
      console.warn("Failed to fetch featured books, using fallback:", error);
      const books = await ApiService.getBooks();
      return books.slice(0, 3);
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
        return transformBook(data);
      }

      console.warn(`⚠️ Failed to fetch book ${id}: ${response.status}`);
      // Fallback to searching in mock data
      return MOCK_BOOKS.find(book => book.id === id) || null;
    } catch (error) {
      console.warn(`❌ Failed to fetch book ${id}, using mock data:`, error);
      return MOCK_BOOKS.find(book => book.id === id) || null;
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
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching pages for book ID: ${bookId}`);

      const response = await fetchWithTimeout(`${baseUrl}pages/book/${bookId}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Pages received for book ${bookId}:`, data.length);
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
  // bookId is optional - if provided, audio will be organized under books/{bookId}/audio/
  generateTTS: async (text: string, voiceId: string, bookId?: string): Promise<{ audioUrl: string; alignment: any } | null> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}api/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voiceId, bookId })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Normalize audioUrl to ensure it's absolute
        if (result.audioUrl) {
          // If it's already absolute (starts with http), use as is
          if (result.audioUrl.startsWith('http://') || result.audioUrl.startsWith('https://')) {
            return result;
          }
          
          // If it's relative, make it absolute
          if (result.audioUrl.startsWith('/uploads/')) {
            const backendBaseUrl = baseUrl.replace(/\/api\/?$/, ''); // Remove /api if present
            result.audioUrl = `${backendBaseUrl}${result.audioUrl}`;
          }
        }
        
        return result;
      }
      const errorText = await response.text();
      console.error('TTS Generation failed:', response.status, errorText);
      return null;
    } catch (error) {
      console.error('TTS Error:', error);
      return null;
    }
  },

  // TTS: Get Voices
  getVoices: async (): Promise<any[]> => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetchWithTimeout(`${baseUrl}api/tts/voices`, {
        method: 'GET'
      });

      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Get Voices Error:', error);
      return [];
    }
  },

  // Get all categories (returns full category objects with name, color, icon, etc.)
  getCategories: async (): Promise<Array<{ _id: string; name: string; description?: string; color: string; icon?: string }>> => {
    try {
      const baseUrl = getApiBaseUrl();
      console.log(`🔍 Fetching categories from API`);

      // Try different endpoint variations for categories
      const categoryEndpoints = [
        `${baseUrl}categories`, // New categories endpoint
        `${baseUrl}categories`,
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
              console.log(`✅ Found ${categories.length} categories`);
              // Return full category objects
              return categories.map((cat: any) => ({
                _id: cat._id || cat.id || '',
                name: String(cat.name || cat.title || cat),
                description: cat.description,
                color: cat.color || '#6366f1',
                icon: cat.icon,
              }));
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
      return uniqueCategories
        .filter(cat => cat && cat !== 'Uncategorized')
        .map((name, index) => ({
          _id: `fallback-${index}`,
          name: String(name),
          color: '#6366f1',
        }));
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