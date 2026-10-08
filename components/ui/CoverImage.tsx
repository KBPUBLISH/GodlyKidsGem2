import React, { useCallback, useEffect, useState } from 'react';
import { getCoverThumb } from '../../utils/coverImage';
import { DEFAULT_BOOK_COVER } from '../../utils/placeholderImage';

type CoverImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> & {
  /** Full-size cover URL (thumb variant is derived automatically). */
  src?: string | null;
  alt: string;
  /**
   * `thumb` (default) — lightweight ~400px WebP for grids/lists.
   * `full` — original URL for detail heroes and large players.
   */
  variant?: 'thumb' | 'full';
  /** Final fallback when both thumb and full fail (defaults to SVG placeholder). */
  fallback?: string;
};

/**
 * Cover `<img>` that prefers the lightweight `_thumb.webp` variant, then
 * falls back to the full cover, then to a local SVG placeholder.
 */
const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt,
  variant = 'thumb',
  fallback = DEFAULT_BOOK_COVER,
  className,
  loading = 'lazy',
  decoding = 'async',
  ...rest
}) => {
  const fullUrl = (src && src.trim()) || '';
  const preferredUrl =
    variant === 'thumb' && fullUrl ? getCoverThumb(fullUrl) : fullUrl;

  const [stage, setStage] = useState<'preferred' | 'full' | 'fallback'>(
    preferredUrl ? 'preferred' : 'fallback'
  );

  useEffect(() => {
    setStage(preferredUrl ? 'preferred' : 'fallback');
  }, [preferredUrl, fullUrl, variant]);

  const currentSrc =
    stage === 'fallback'
      ? fallback
      : stage === 'full'
        ? fullUrl || fallback
        : preferredUrl || fallback;

  const handleError = useCallback(() => {
    setStage((prev) => {
      if (
        prev === 'preferred' &&
        variant === 'thumb' &&
        fullUrl &&
        fullUrl !== preferredUrl
      ) {
        return 'full';
      }
      return 'fallback';
    });
  }, [variant, fullUrl, preferredUrl]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      {...rest}
    />
  );
};

export default CoverImage;
