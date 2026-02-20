import React from 'react';

/** Default world background - use custom /world-background.png in public/ when provided, else panorama */
const DEFAULT_WORLD_BACKGROUND = '/world-background.png';
const FALLBACK_BACKGROUND = '/assets/images/panorama-background.png';

export interface WorldBackgroundProps {
  /** Optional custom background URL. Defaults to /world-background.png */
  backgroundUrl?: string;
  /** Optional className for the container */
  className?: string;
  /** Use fixed positioning (stays in place when content scrolls). Default false. */
  fixed?: boolean;
}

/**
 * Full-viewport background for the World/Island layer.
 * Displays the provided ocean/island background asset behind island content.
 * Respects safe-area insets for Despia Native.
 */
const WorldBackground: React.FC<WorldBackgroundProps> = ({
  backgroundUrl = DEFAULT_WORLD_BACKGROUND,
  className = '',
  fixed = false,
}) => {
  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 z-0 overflow-hidden ${className}`}
      style={{
        // Safe area padding - background extends under safe areas
        paddingTop: 'var(--safe-area-top, 0px)',
        paddingBottom: 'var(--safe-area-bottom, 0px)',
        paddingLeft: 'var(--safe-area-left, 0px)',
        paddingRight: 'var(--safe-area-right, 0px)',
      }}
    >
      {/* Background image - cover for full viewport fill. Use fallback if custom asset not in public/ */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${backgroundUrl}), url(${FALLBACK_BACKGROUND})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#1a5a7a',
        }}
      />
    </div>
  );
};

export default WorldBackground;
