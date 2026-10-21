/**
 * Image preloading utilities for critical content
 * Preloads images that will be needed soon to improve perceived performance
 */

import { globalImagePreloader } from './imageOptimization';

/**
 * Preload images for a specific page/section
 */
export const preloadPageImages = (page: string, imageUrls: string[]): void => {
  if (!imageUrls || imageUrls.length === 0) return;
  
  console.log(`🖼️ Preloading ${imageUrls.length} images for ${page}`);
  globalImagePreloader.add(imageUrls);
};

/**
 * Preload featured content images (homepage carousel)
 */
export const preloadFeaturedContent = (items: Array<{ coverUrl?: string; coverImage?: string }>): void => {
  const urls = items
    .slice(0, 5) // Only preload first 5 items
    .map(item => item.coverUrl || item.coverImage)
    .filter((url): url is string => !!url);
  
  if (urls.length > 0) {
    preloadPageImages('featured-carousel', urls);
  }
};

/**
 * Preload book grid images (visible books)
 */
export const preloadBookGrid = (books: Array<{ coverUrl?: string }>, limit: number = 12): void => {
  const urls = books
    .slice(0, limit)
    .map(book => book.coverUrl)
    .filter((url): url is string => !!url);
  
  if (urls.length > 0) {
    preloadPageImages('book-grid', urls);
  }
};

/**
 * Preload audio/playlist covers
 */
export const preloadAudioCovers = (items: Array<{ coverUrl?: string; coverImage?: string }>, limit: number = 12): void => {
  const urls = items
    .slice(0, limit)
    .map(item => item.coverUrl || item.coverImage)
    .filter((url): url is string => !!url);
  
  if (urls.length > 0) {
    preloadPageImages('audio-covers', urls);
  }
};

/**
 * Preload avatar images for profile section
 */
export const preloadAvatarImages = (avatarUrls: string[]): void => {
  if (avatarUrls.length > 0) {
    preloadPageImages('avatars', avatarUrls);
  }
};

/**
 * Prefetch images using service worker (more aggressive caching)
 */
export const prefetchImagesInBackground = async (urls: string[]): Promise<void> => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    // Fallback to regular preloading
    globalImagePreloader.add(urls);
    return;
  }
  
  try {
    const messageChannel = new MessageChannel();
    
    const promise = new Promise<void>((resolve) => {
      messageChannel.port1.onmessage = () => {
        resolve();
      };
    });
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'PREFETCH_IMAGES', urls },
      [messageChannel.port2]
    );
    
    await promise;
    console.log(`✅ Prefetched ${urls.length} images via service worker`);
  } catch (error) {
    console.warn('Failed to prefetch via service worker:', error);
    // Fallback to regular preloading
    globalImagePreloader.add(urls);
  }
};

/**
 * Smart preloader that analyzes user behavior and preloads likely next content
 */
export class SmartImagePreloader {
  private userScrollDirection: 'down' | 'up' | null = null;
  private lastScrollY = 0;
  private preloadThreshold = 300; // pixels before element comes into view
  
  constructor() {
    this.setupScrollTracking();
  }
  
  private setupScrollTracking(): void {
    let scrollTimeout: NodeJS.Timeout;
    
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      this.userScrollDirection = currentScrollY > this.lastScrollY ? 'down' : 'up';
      this.lastScrollY = currentScrollY;
      
      // Reset direction after 200ms of no scrolling
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.userScrollDirection = null;
      }, 200);
    }, { passive: true });
  }
  
  /**
   * Preload images that are likely to be viewed soon based on scroll direction
   */
  preloadUpcomingImages(imageElements: HTMLElement[]): void {
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    
    imageElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const elementTop = scrollY + rect.top;
      const distanceFromViewport = elementTop - (scrollY + viewportHeight);
      
      // Preload if element is within threshold
      if (distanceFromViewport > 0 && distanceFromViewport < this.preloadThreshold) {
        const imgUrl = element.getAttribute('data-src') || 
                       element.getAttribute('src');
        
        if (imgUrl) {
          globalImagePreloader.add(imgUrl);
        }
      }
    });
  }
}

// Global smart preloader instance
export const smartPreloader = new SmartImagePreloader();

/**
 * Cleanup preloader on page unload
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalImagePreloader.clear();
  });
}
