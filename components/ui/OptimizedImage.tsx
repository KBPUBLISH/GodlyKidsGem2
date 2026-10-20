import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getOptimizedImageUrl,
  getPlaceholderForType,
  createLazyLoadObserver,
  loadImage,
  ImageSize,
} from '../../utils/imageOptimization';

export interface OptimizedImageProps {
  src: string | undefined | null;
  alt: string;
  size?: ImageSize;
  type?: 'book' | 'audio' | 'avatar' | 'general';
  className?: string;
  eager?: boolean; // Load immediately without lazy loading
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  draggable?: boolean;
}

/**
 * Optimized image component with progressive loading, lazy loading, and placeholders
 * 
 * Features:
 * - Progressive loading (blur placeholder → low-res → high-res)
 * - Intersection Observer lazy loading
 * - Automatic WebP optimization
 * - Fallback handling
 * - Proper aspect ratio preservation
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  size = 'medium',
  type = 'general',
  className = '',
  eager = false,
  onLoad,
  onError,
  fallbackSrc,
  objectFit = 'cover',
  draggable = false,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  
  // Get placeholder
  const placeholder = getPlaceholderForType(type);
  
  // Get optimized URLs
  const thumbUrl = src ? getOptimizedImageUrl(src, 'thumb') : null;
  const optimizedUrl = src ? getOptimizedImageUrl(src, size) : null;
  
  // Set up Intersection Observer for lazy loading
  useEffect(() => {
    if (eager || !imgRef.current) return;
    
    const observer = createLazyLoadObserver((entry) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    });
    
    observer.observe(imgRef.current);
    
    return () => observer.disconnect();
  }, [eager]);
  
  // Progressive loading: placeholder → thumb → full
  useEffect(() => {
    if (!isInView) {
      setCurrentSrc(placeholder);
      return;
    }
    
    if (!src || !optimizedUrl) {
      setCurrentSrc(fallbackSrc || placeholder);
      setIsLoading(false);
      return;
    }
    
    let isMounted = true;
    
    const loadProgressive = async () => {
      try {
        // Start with placeholder
        setCurrentSrc(placeholder);
        setIsLoading(true);
        setHasError(false);
        
        // Load thumbnail first (fast)
        if (thumbUrl && thumbUrl !== optimizedUrl) {
          try {
            await loadImage(thumbUrl);
            if (isMounted) {
              setCurrentSrc(thumbUrl);
            }
          } catch {
            // Thumbnail failed, continue to full image
          }
        }
        
        // Load full resolution
        await loadImage(optimizedUrl);
        if (isMounted) {
          setCurrentSrc(optimizedUrl);
          setIsLoading(false);
          onLoad?.();
        }
      } catch (error) {
        if (isMounted) {
          console.warn(`Failed to load image: ${optimizedUrl}`, error);
          setHasError(true);
          setCurrentSrc(fallbackSrc || placeholder);
          setIsLoading(false);
          onError?.();
        }
      }
    };
    
    loadProgressive();
    
    return () => {
      isMounted = false;
    };
  }, [src, optimizedUrl, thumbUrl, placeholder, fallbackSrc, isInView, onLoad, onError]);
  
  const handleImageError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(fallbackSrc || placeholder);
      setIsLoading(false);
      onError?.();
    }
  }, [hasError, fallbackSrc, placeholder, onError]);
  
  // Determine if we're showing placeholder/loading state
  const isPlaceholder = currentSrc === placeholder || isLoading;
  
  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      className={`${className} ${isPlaceholder ? 'blur-sm' : 'blur-0'} transition-all duration-300`}
      style={{ objectFit }}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={handleImageError}
      draggable={draggable}
    />
  );
};

export default OptimizedImage;
