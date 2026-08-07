import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';

const PORTHOLE_FRAME_SRC = '/assets/ui/porthole-frame.png';

/**
 * The porthole PNG is fully opaque (RGB, no alpha): the glass area and the
 * square corners are solid black. So the avatar is layered ON TOP of the
 * frame, clipped to the ring's inner circle, and the container is clipped
 * to a circle (rounded-full + overflow-hidden) so the black corners never
 * show. Inner (glass) diameter measured from the pixels ≈ 68.5% of frame
 * width → inset (100 − 68.5) / 2 ≈ 15.75%; we use a slightly smaller inset
 * so the avatar tucks just under the ring's inner bevel with no black seam.
 */
const GLASS_INSET = '15.2%';

interface PortholeAvatarProps {
  /** Equipped head: an AVATAR_ASSETS key (e.g. "head-toast") or an image URL. */
  avatarSrc?: string | null;
  /** Percentage offset nudging the head inside the glass. */
  headOffset?: { x: number; y: number };
  /** Initial letter shown when there is no avatar; omit for a generic user icon. */
  fallbackInitial?: string;
  /** Tailwind background classes for the glass behind the avatar. */
  glassClassName?: string;
  /** Size via width/height classes, e.g. "w-11 h-11 sm:w-12 sm:h-12". */
  className?: string;
}

/** Kid profile avatar framed inside the brass porthole. */
const PortholeAvatar: React.FC<PortholeAvatarProps> = ({
  avatarSrc,
  headOffset,
  fallbackInitial,
  glassClassName = 'bg-[#f3e5ab]',
  className = '',
}) => {
  const headAsset = avatarSrc ? AVATAR_ASSETS[avatarSrc] : null;

  return (
    <div className={`relative rounded-full overflow-hidden ${className}`}>
      <img
        src={PORTHOLE_FRAME_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
      />

      {/* Glass + avatar layered over the frame's opaque black center */}
      <div
        className={`absolute rounded-full overflow-hidden flex items-center justify-center ${glassClassName}`}
        style={{ inset: GLASS_INSET, boxShadow: 'inset 0 2px 5px rgba(40,20,5,0.35)' }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={
            headOffset
              ? { transform: `translate(${headOffset.x}%, ${headOffset.y}%)` }
              : undefined
          }
        >
          {headAsset ? (
            <div className="w-[90%] h-[90%] flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {headAsset}
              </svg>
            </div>
          ) : avatarSrc ? (
            <img src={avatarSrc} alt="Profile avatar" className="w-full h-full object-cover" />
          ) : fallbackInitial ? (
            <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
              <text
                x="50"
                y="52"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="52"
                fontWeight="900"
                fill="#8B5A2B"
                fontFamily="inherit"
              >
                {fallbackInitial.charAt(0).toUpperCase()}
              </text>
            </svg>
          ) : (
            <UserIcon className="w-[55%] h-[55%] text-[#8B5A2B]" strokeWidth={2.5} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PortholeAvatar;
