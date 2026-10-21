import React from 'react';
import { getAvatarWebpUrl, getShopThumbUrl, isAvatarPngPath } from '../../utils/avatarImageUrl';

interface AvatarPartImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /** Use small WebP thumb for shop grid tiles (160px). */
  thumb?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
}

/**
 * Renders avatar PNG parts with WebP when available (PNG fallback for older caches).
 */
const AvatarPartImage: React.FC<AvatarPartImageProps> = ({
  src,
  alt,
  className,
  style,
  thumb = false,
  loading = 'lazy',
  decoding = 'async',
}) => {
  if (!isAvatarPngPath(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        decoding={decoding}
      />
    );
  }

  const webpSrc = thumb ? getShopThumbUrl(src) : getAvatarWebpUrl(src);

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
};

export default AvatarPartImage;
