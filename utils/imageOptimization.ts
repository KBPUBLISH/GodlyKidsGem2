/**
 * Comprehensive image optimization utilities for Godly Kids app.
 * 
 * Features:
 * - Progressive image loading with blur-up placeholders
 * - Intersection Observer for lazy loading
 * - WebP format with fallback support
 * - Optimized image sizes for different viewports
 * - Image preloading for critical content
 * - CDN optimization hints
 */

// Tiny blur placeholder generator
export const generateBlurPlaceholder = (width: number = 40, height: number = 40): string => {
  // Create a tiny canvas for blur effect
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Create gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3E1F07');
    gradient.addColorStop(0.5, '#5c2e0b');
    gradient.addColorStop(1, '#8B4513');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  return canvas.toDataURL('image/png');
};

// Default SVG placeholder for book covers
export const BOOK_COVER_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%233E1F07'/%3E%3Cstop offset='50%25' style='stop-color:%235c2e0b'/%3E%3Cstop offset='100%25' style='stop-color:%238B4513'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='600' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23FFD700' font-size='48' font-family='Arial' opacity='0.3'%3E📖%3C/text%3E%3C/svg%3E`;

// Avatar placeholder
export const AVATAR_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23CD853F'/%3E%3Ccircle cx='100' cy='80' r='35' fill='%235c2e0b'/%3E%3Ccircle cx='100' cy='160' r='50' fill='%235c2e0b'/%3E%3C/svg%3E`;

// Audio/Music placeholder
export const AUDIO_PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cdefs%3E%3ClinearGradient id='ag' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234ECDC4'/%3E%3Cstop offset='100%25' style='stop-color:%2344A08D'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23ag)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='72' font-family='Arial'%3E🎵%3C/text%3E%3C/svg%3E`;

// Image size breakpoints
export type ImageSize = 'thumb' | 'small' | 'medium' | 'large' | 'full';

export interface ImageSizeConfig {
  width: number;
  quality?: number;
}

export const IMAGE_SIZES: Record<ImageSize, ImageSizeConfig> = {
  thumb: { width: 150, quality: 75 },   // Grid cards, mini-player
  small: { width: 300, quality: 80 },   // List items
  medium: { width: 600, quality: 85 },  // Detail pages on mobile
  large: { width: 1200, quality: 90 },  // Detail pages on desktop
  full: { width: 2400, quality: 95 },   // Full-screen, hero images
};

/**
 * Get optimized image URL with size and format hints
 */
export const getOptimizedImageUrl = (
  url: string | undefined | null,
  size: ImageSize = 'medium'
): string => {
  if (!url) return BOOK_COVER_PLACEHOLDER;
  
  // If it's already a data URI or placeholder, return as-is
  if (url.startsWith('data:')) return url;
  
  // Check if URL is from our CDN/storage
  const isOurStorage = 
    url.includes('storage.googleapis.com') ||
    url.includes('/uploads/') ||
    url.includes('cloudinary.com');
  
  // If it's our storage and WebP, derive the size variant
  if (isOurStorage && url.includes('.webp')) {
    const sizeConfig = IMAGE_SIZES[size];
    
    // For Cloudinary URLs, add transformation parameters
    if (url.includes('cloudinary.com')) {
      const baseUrl = url.split('/upload/')[0];
      const path = url.split('/upload/')[1];
      if (baseUrl && path) {
        const transforms = `w_${sizeConfig.width},q_${sizeConfig.quality || 85},f_auto`;
        return `${baseUrl}/upload/${transforms}/${path}`;
      }
    }
    
    // For GCS URLs, use size suffix convention
    if (size === 'thumb' && !url.includes('_thumb.webp')) {
      return url.replace(/\.webp(\?|$)/i, '_thumb.webp$1');
    }
  }
  
  return url;
};

/**
 * Preload critical images (above-the-fold content)
 */
export const preloadImage = (url: string, priority: 'high' | 'low' = 'high'): void => {
  if (!url || url.startsWith('data:')) return;
  
  // Check if already preloaded
  const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  if (priority === 'high') {
    link.setAttribute('fetchpriority', 'high');
  }
  
  // Add to head
  document.head.appendChild(link);
};

/**
 * Preload multiple images
 */
export const preloadImages = (urls: string[], priority: 'high' | 'low' = 'low'): void => {
  urls.forEach(url => preloadImage(url, priority));
};

/**
 * Create an Intersection Observer for lazy loading
 */
export const createLazyLoadObserver = (
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver => {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px', // Start loading 50px before entering viewport
    threshold: 0.01,
    ...options,
  };
  
  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry);
      }
    });
  }, defaultOptions);
};

/**
 * Load image with promise
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

/**
 * Get appropriate placeholder for content type
 */
export const getPlaceholderForType = (type: 'book' | 'audio' | 'avatar' | 'general'): string => {
  switch (type) {
    case 'book':
      return BOOK_COVER_PLACEHOLDER;
    case 'audio':
      return AUDIO_PLACEHOLDER;
    case 'avatar':
      return AVATAR_PLACEHOLDER;
    default:
      return BOOK_COVER_PLACEHOLDER;
  }
};

/**
 * Check if WebP is supported
 */
export const isWebPSupported = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Progressive image loader state machine
 */
export interface ProgressiveImageState {
  placeholder: string;
  lowRes?: string;
  highRes: string;
  currentSrc: string;
  isLoading: boolean;
  hasError: boolean;
}

export const createProgressiveImageState = (
  url: string,
  type: 'book' | 'audio' | 'avatar' | 'general' = 'general'
): ProgressiveImageState => {
  return {
    placeholder: getPlaceholderForType(type),
    lowRes: getOptimizedImageUrl(url, 'thumb'),
    highRes: getOptimizedImageUrl(url, 'medium'),
    currentSrc: getPlaceholderForType(type),
    isLoading: false,
    hasError: false,
  };
};

/**
 * Batch image preloader for smoother navigation
 */
export class ImagePreloader {
  private queue: Set<string> = new Set();
  private loading: Set<string> = new Set();
  private loaded: Set<string> = new Set();
  private maxConcurrent: number = 6;
  
  constructor(maxConcurrent: number = 6) {
    this.maxConcurrent = maxConcurrent;
  }
  
  add(url: string | string[]): void {
    const urls = Array.isArray(url) ? url : [url];
    urls.forEach(u => {
      if (!this.loaded.has(u) && !this.loading.has(u) && !u.startsWith('data:')) {
        this.queue.add(u);
      }
    });
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.loading.size >= this.maxConcurrent) return;
    
    const url = this.queue.values().next().value;
    if (!url) return;
    
    this.queue.delete(url);
    this.loading.add(url);
    
    try {
      await loadImage(url);
      this.loaded.add(url);
    } catch (error) {
      console.warn(`Failed to preload: ${url}`);
    } finally {
      this.loading.delete(url);
      this.processQueue();
    }
  }
  
  clear(): void {
    this.queue.clear();
    this.loading.clear();
    this.loaded.clear();
  }
  
  isLoaded(url: string): boolean {
    return this.loaded.has(url);
  }
}

// Global preloader instance
export const globalImagePreloader = new ImagePreloader();

/**
 * Image cache manager using IndexedDB for offline support
 */
export class ImageCache {
  private dbName = 'godlykids_image_cache';
  private storeName = 'images';
  private db: IDBDatabase | null = null;
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'url' });
        }
      };
    });
  }
  
  async get(url: string): Promise<Blob | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }
      
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(url);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < this.maxAge) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    });
  }
  
  async set(url: string, blob: Blob): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.put({
        url,
        blob,
        timestamp: Date.now(),
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
  
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

// Global image cache instance
export const globalImageCache = new ImageCache();
