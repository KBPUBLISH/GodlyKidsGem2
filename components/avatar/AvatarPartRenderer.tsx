/**
 * AvatarPartRenderer
 * 
 * Renders avatar parts from either:
 * - Inline SVGs (legacy AVATAR_ASSETS)
 * - File-based SVGs from /public/avatars/
 * 
 * Usage:
 * <AvatarPartRenderer partId="head-angel" viewBox="0 0 100 100" className="w-full h-full" />
 */

import React, { useState, useEffect } from 'react';
import { AVATAR_ASSETS } from './AvatarAssets';
import { getPartById, getAvatarFilePath, AVATAR_BASE_PATH } from './AvatarConfig';

interface AvatarPartRendererProps {
  partId: string;
  viewBox?: string;
  className?: string;
  style?: React.CSSProperties;
  preserveAspectRatio?: string;
}

/**
 * Component to render an avatar part (works with both inline and file-based SVGs)
 */
const AvatarPartRenderer: React.FC<AvatarPartRendererProps> = ({
  partId,
  viewBox = '0 0 100 100',
  className = 'w-full h-full',
  style,
  preserveAspectRatio = 'xMidYMid meet',
}) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Check if this is an inline asset
  const inlineAsset = AVATAR_ASSETS[partId];
  
  // Get part config
  const partConfig = getPartById(partId);
  const isFileBased = partConfig?.source === 'file';
  const filePath = partConfig ? getAvatarFilePath(partConfig) : null;

  // Load file-based SVG
  useEffect(() => {
    if (!isFileBased || !filePath) return;

    setLoading(true);
    setError(false);

    fetch(filePath)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load SVG');
        return response.text();
      })
      .then(svgText => {
        // Extract just the inner content of the SVG (without the outer <svg> tags)
        // This allows us to wrap it in our own <svg> with controlled viewBox
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        
        if (svgElement) {
          // Get the inner content
          setSvgContent(svgElement.innerHTML);
        } else {
          throw new Error('Invalid SVG');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(`Failed to load avatar part: ${partId}`, err);
        setError(true);
        setLoading(false);
      });
  }, [partId, isFileBased, filePath]);

  // Render inline asset
  if (inlineAsset && !isFileBased) {
    return (
      <svg 
        viewBox={viewBox} 
        className={className} 
        style={style}
        preserveAspectRatio={preserveAspectRatio}
      >
        {inlineAsset}
      </svg>
    );
  }

  // Render file-based asset
  if (isFileBased && filePath) {
    if (loading) {
      return (
        <div className={`${className} flex items-center justify-center`}>
          <div className="w-6 h-6 border-2 border-[#8B4513] border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (error || !svgContent) {
      // Fallback to img tag for simple rendering
      return (
        <img 
          src={filePath} 
          alt={partId}
          className={className}
          style={style}
        />
      );
    }

    return (
      <svg 
        viewBox={viewBox} 
        className={className} 
        style={style}
        preserveAspectRatio={preserveAspectRatio}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  // Fallback: try to render as image URL (for uploaded/external images)
  if (partId && (partId.startsWith('http') || partId.startsWith('/'))) {
    return (
      <img 
        src={partId} 
        alt="Avatar Part"
        className={className}
        style={style}
      />
    );
  }

  // Nothing to render
  return null;
};

/**
 * Simple function to check if a part exists (inline or file-based)
 */
export function hasAvatarPart(partId: string): boolean {
  if (AVATAR_ASSETS[partId]) return true;
  const partConfig = getPartById(partId);
  return partConfig?.source === 'file' && !!partConfig.filePath;
}

/**
 * Get the source URL for a file-based part (for use in img tags)
 */
export function getAvatarPartSrc(partId: string): string | null {
  const partConfig = getPartById(partId);
  if (partConfig?.source === 'file' && partConfig.filePath) {
    return `${AVATAR_BASE_PATH}/${partConfig.filePath}`;
  }
  return null;
}

export default AvatarPartRenderer;
