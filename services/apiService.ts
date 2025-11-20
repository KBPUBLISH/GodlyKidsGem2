import { API_BASE_URL, MOCK_BOOKS } from '../constants';
import { Book } from '../types';

// Simple helper to handle potential API calls
async function fetchWithTimeout(resource: string, options: RequestInit = {}) {
  const { timeout = 8000 } = options as any;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });
  clearTimeout(id);
  return response;
}

export const ApiService = {
  getBooks: async (): Promise<Book[]> => {
    try {
      // Attempt to fetch from real backend
      // Note: Since specific endpoints aren't documented, we try a standard one.
      // If it fails, we catch and return mock data.
      const response = await fetchWithTimeout(`${API_BASE_URL}books`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      return data; 
    } catch (error) {
      console.warn("Failed to fetch from API, using mock data:", error);
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 800));
      return MOCK_BOOKS;
    }
  },

  getFeaturedBooks: async (): Promise<Book[]> => {
    // Simulate a featured endpoint
    const books = await ApiService.getBooks();
    return books.slice(0, 3);
  },
  
  login: async (provider: string) => {
     console.log(`Logging in with ${provider}`);
     // Simulate API call
     await new Promise(resolve => setTimeout(resolve, 1000));
     return { success: true, token: 'mock-jwt-token' };
  }
};