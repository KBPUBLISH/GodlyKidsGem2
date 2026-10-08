import React from 'react';

const BACK_BUTTON_SRC = '/assets/ui/back-button.png';

interface WoodBackButtonProps {
  onClick: () => void;
  /** Sizing + positioning classes from the call site (e.g. "fixed z-[60] w-12 h-12"). */
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  tabIndex?: number;
  'aria-label'?: string;
}

/**
 * Circular wooden back button (3D art asset) shared across the sail map pages.
 * The source PNG has an opaque black background baked in (no alpha channel),
 * so the button clips itself and the image to a circle.
 */
const WoodBackButton: React.FC<WoodBackButtonProps> = ({
  onClick,
  className = '',
  style,
  disabled,
  tabIndex,
  'aria-label': ariaLabel = 'Back',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    tabIndex={tabIndex}
    aria-label={ariaLabel}
    className={`p-0 m-0 border-0 appearance-none bg-transparent rounded-full overflow-hidden active:scale-[0.92] transition-transform disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 ${className}`}
    style={{ boxShadow: '0 3px 8px rgba(0,0,0,0.35)', ...style }}
  >
    <img
      src={BACK_BUTTON_SRC}
      alt=""
      draggable={false}
      className="w-full h-full rounded-full object-cover pointer-events-none select-none"
    />
  </button>
);

export default WoodBackButton;
