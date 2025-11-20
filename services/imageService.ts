import { authService } from './authService';
import { API_BASE_URL } from '../constants';

// Get API base URL (same logic as apiService)
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const baseUrl = envUrl || API_BASE_URL;
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

// Helper to check if URL needs authentication (is from our API)
const isApiUrl = (url: string): boolean => {
  if (!url) return false;
  const baseUrl = getApiBaseUrl();
  return url.startsWith(baseUrl) || url.startsWith('/');
};

// Try alternative URL patterns for images
const tryAlternativeUrls = (originalUrl: string): string[] => {
  const alternatives: string[] = [originalUrl];
  const baseUrl = getApiBaseUrl();
  
  // If URL contains /books/ (not /v3/books/), try /v3/books/ instead
  if (originalUrl.includes('/books/') && !originalUrl.includes('/v3/books/')) {
    const altUrl = originalUrl.replace('/books/', '/v3/books/');
    alternatives.push(altUrl);
    console.log(`🔄 Trying alternative URL pattern: /v3/books/`);
  }
  
  // If URL contains /v3/books/, try /books/ instead
  if (originalUrl.includes('/v3/books/')) {
    const altUrl = originalUrl.replace('/v3/books/', '/books/');
    alternatives.push(altUrl);
    console.log(`🔄 Trying alternative URL pattern: /books/`);
  }
  
  // Try with /api/ prefix if not already there
  if (originalUrl.includes(baseUrl) && !originalUrl.includes('/api/')) {
    const path = originalUrl.replace(baseUrl, '');
    alternatives.push(`${baseUrl}api/${path}`);
    console.log(`🔄 Trying alternative URL pattern: /api/`);
  }
  
  return alternatives;
};

// Fetch image as blob with authentication
export const fetchAuthenticatedImage = async (url: string): Promise<string> => {
  if (!url || url.trim() === '') {
    return '';
  }

  // If it's not from our API, return as-is (external URLs don't need auth)
  if (!isApiUrl(url)) {
    return url;
  }

  const token = authService.getToken();
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Try the original URL and alternatives
  const urlsToTry = tryAlternativeUrls(url);
  
  for (const tryUrl of urlsToTry) {
    try {
      const response = await fetch(tryUrl, { headers });
      
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        console.log(`✅ Fetched authenticated image: ${tryUrl.substring(0, 60)}...`);
        return objectUrl;
      } else if (response.status === 401 || response.status === 403) {
        // If auth fails, try without auth (might be public)
        console.log(`🔓 Trying public access for: ${tryUrl.substring(0, 60)}...`);
        const publicResponse = await fetch(tryUrl);
        if (publicResponse.ok) {
          const blob = await publicResponse.blob();
          return URL.createObjectURL(blob);
        }
      } else if (response.status === 404) {
        // Try next alternative URL
        console.log(`⚠️ 404 for image, trying alternative: ${tryUrl.substring(0, 60)}...`);
        continue;
      }
    } catch (error) {
      // Try next URL
      console.log(`⚠️ Error fetching ${tryUrl.substring(0, 60)}..., trying next...`);
      continue;
    }
  }
  
  // If all URLs failed, return the original URL and let browser handle it
  // The browser's img tag might handle it differently (CORS, etc.)
  console.warn(`⚠️ All image URL attempts failed, using direct URL: ${url.substring(0, 60)}...`);
  return url;
};

// Clean up object URLs to prevent memory leaks
export const revokeImageUrl = (url: string): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

