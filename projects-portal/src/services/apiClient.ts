import axios from 'axios';

// Base URL for API requests - defaults to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// Create axios instance with base URL
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get full URL for uploads (useful for form submissions)
export const getApiUrl = (path: string): string => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// Helper to get upload URL with query params
export const getUploadUrl = (endpoint: string, params?: Record<string, string>): string => {
  const url = new URL(endpoint, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
};

// Helper to transform stored URLs to full URLs (for displaying images/media)
export const getMediaUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  // If it's a blob URL (local file preview), return as-is
  if (url.startsWith('blob:')) {
    return url;
  }
  
  // If it's already a full URL (GCS or other), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it starts with /uploads, prepend the API base URL
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }
  
  // Otherwise, assume it's a relative path and prepend API base URL with /
  return `${API_BASE_URL}/${url}`;
};

export default apiClient;



