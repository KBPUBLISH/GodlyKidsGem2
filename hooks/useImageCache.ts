import { useEffect, useCallback } from 'react';

/**
 * Hook for managing image cache service worker
 */
export const useImageCache = () => {
  // Register service worker on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw-image-cache.js')
        .then((registration) => {
          console.log('✅ Image cache service worker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('❌ Image cache service worker registration failed:', error);
        });
    }
  }, []);
  
  // Clear image cache
  const clearCache = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      console.warn('Service worker not available');
      return false;
    }
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success || false);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_IMAGE_CACHE' },
        [messageChannel.port2]
      );
    });
  }, []);
  
  // Prefetch images
  const prefetchImages = useCallback(async (urls: string[]): Promise<number> => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      console.warn('Service worker not available');
      return 0;
    }
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.count || 0);
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'PREFETCH_IMAGES', urls },
        [messageChannel.port2]
      );
    });
  }, []);
  
  return {
    clearCache,
    prefetchImages,
  };
};

export default useImageCache;
