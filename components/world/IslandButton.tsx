import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

export interface IslandButtonProps {
  /** Display label below the island */
  label: string;
  /** Route to navigate to on click */
  path: string;
  /** Optional icon component (from lucide-react) */
  icon?: LucideIcon;
  /** Optional custom image URL for the island/icon */
  imageUrl?: string;
  /** CSS position - e.g. 'absolute' with top/left for precise placement */
  position?: React.CSSProperties;
  /** Additional className */
  className?: string;
  /** Optional children for custom island content */
  children?: React.ReactNode;
}

/**
 * Clickable island button that navigates to a route.
 * Styled as an island on the ocean with label below.
 */
const IslandButton: React.FC<IslandButtonProps> = ({
  label,
  path,
  icon: Icon,
  imageUrl,
  position = {},
  className = '',
  children,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(path);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex flex-col items-center justify-center
        cursor-pointer select-none
        transition-transform active:scale-95
        hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gk-gold focus:ring-offset-2
        rounded-2xl
        ${className}
      `}
      style={position}
      aria-label={`Go to ${label}`}
    >
      {/* Island visual - rounded container with island aesthetic */}
      <div
        className="
          w-20 h-20 sm:w-24 sm:h-24
          rounded-2xl
          flex items-center justify-center
          bg-gradient-to-b from-amber-100 to-amber-200
          border-2 border-amber-800/40
          shadow-lg shadow-amber-900/30
          overflow-hidden
        "
      >
        {children ?? (
          <>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : Icon ? (
              <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-amber-900" strokeWidth={2} />
            ) : (
              <span className="text-2xl font-bold text-amber-900">{label.charAt(0)}</span>
            )}
          </>
        )}
      </div>
      {/* Label */}
      <span
        className="
          mt-2 text-sm sm:text-base font-bold text-white
          text-center max-w-[100px] leading-tight
          drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]
        "
      >
        {label}
      </span>
    </button>
  );
};

export default IslandButton;
