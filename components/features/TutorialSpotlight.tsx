import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TutorialSpotlightProps {
  targetElement?: string; // CSS selector or element ID
  targetRef?: React.RefObject<HTMLElement>; // Direct ref to element
  title: string;
  description: string;
  isVisible: boolean;
  onNext?: () => void;
  fingerPosition?: 'top' | 'bottom' | 'left' | 'right';
  popupPosition?: 'top' | 'bottom' | 'center' | 'bottom-screen'; // bottom-screen = fixed to bottom of viewport
  customContent?: React.ReactNode;
  requiresElementClick?: boolean; // If true, user must click the highlighted element
  compactPopup?: boolean; // If true, use smaller popup styling
  showContinueButton?: boolean; // If true, show a Continue button
  hideOverlay?: boolean; // If true, don't show dark overlay (for modal steps)
}

const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  targetElement,
  targetRef,
  title,
  description,
  isVisible,
  onNext,
  fingerPosition = 'top',
  popupPosition = 'bottom',
  customContent,
  requiresElementClick = true, // Default: must click highlighted element to proceed
  compactPopup = false,
  showContinueButton = false,
  hideOverlay = false,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const spotlightRef = useRef<HTMLDivElement>(null);

  // Find and track the target element
  useEffect(() => {
    if (!isVisible) {
      setTargetRect(null);
      return;
    }

    const findElement = () => {
      let element: HTMLElement | null = null;

      if (targetRef?.current) {
        element = targetRef.current;
      } else if (targetElement) {
        // Try by ID first
        element = document.getElementById(targetElement);
        // Try by data attribute
        if (!element) {
          element = document.querySelector(`[data-tutorial="${targetElement}"]`);
        }
        // Try by selector
        if (!element) {
          element = document.querySelector(targetElement);
        }
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        setIsAnimating(true);
      }
    };

    // Initial find
    findElement();

    // Re-find on scroll/resize
    const handleUpdate = () => findElement();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Poll for element (in case it appears later)
    const pollInterval = setInterval(findElement, 100);
    setTimeout(() => clearInterval(pollInterval), 2000);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearInterval(pollInterval);
    };
  }, [isVisible, targetElement, targetRef]);

  if (!isVisible) return null;

  // Calculate spotlight hole position with padding
  const padding = 12;
  const holeStyle = targetRect ? {
    left: targetRect.left - padding,
    top: targetRect.top - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    borderRadius: '16px',
  } : null;

  // Calculate finger pointer position
  const getFingerStyle = () => {
    if (!targetRect) return {};
    
    const fingerSize = 60;
    
    switch (fingerPosition) {
      case 'top':
        return {
          left: targetRect.left + targetRect.width / 2 - fingerSize / 2,
          top: targetRect.top - fingerSize - 10,
          transform: 'rotate(180deg)',
        };
      case 'bottom':
        return {
          left: targetRect.left + targetRect.width / 2 - fingerSize / 2,
          top: targetRect.bottom + 10,
          transform: 'rotate(0deg)',
        };
      case 'left':
        return {
          left: targetRect.left - fingerSize - 10,
          top: targetRect.top + targetRect.height / 2 - fingerSize / 2,
          transform: 'rotate(90deg)',
        };
      case 'right':
        return {
          left: targetRect.right + 10,
          top: targetRect.top + targetRect.height / 2 - fingerSize / 2,
          transform: 'rotate(-90deg)',
        };
      default:
        return {};
    }
  };

  // Calculate popup position
  const getPopupStyle = (): React.CSSProperties => {
    // bottom-screen is always at the bottom of viewport
    if (popupPosition === 'bottom-screen') {
      return {
        left: '50%',
        bottom: 100, // Above the navigation wheel
        transform: 'translateX(-50%)',
      };
    }

    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    switch (popupPosition) {
      case 'top':
        return {
          left: '50%',
          bottom: window.innerHeight - targetRect.top + 80,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          left: '50%',
          top: targetRect.bottom + 80,
          transform: 'translateX(-50%)',
        };
      case 'center':
      default:
        return {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  const content = (
    <div
      ref={spotlightRef}
      className={`fixed inset-0 z-[9999] transition-opacity duration-300 pointer-events-none ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Dark overlay with hole - only show if hideOverlay is false */}
      {!hideOverlay && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {holeStyle && (
                <rect
                  x={holeStyle.left}
                  y={holeStyle.top}
                  width={holeStyle.width}
                  height={holeStyle.height}
                  rx="16"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.85)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      )}

      {/* Glowing border around spotlight hole - only show if valid position */}
      {holeStyle && holeStyle.width > 0 && holeStyle.height > 0 && targetElement && (
        <div
          className="absolute pointer-events-none animate-pulse"
          style={{
            left: holeStyle.left - 3,
            top: holeStyle.top - 3,
            width: holeStyle.width + 6,
            height: holeStyle.height + 6,
            borderRadius: '19px',
            border: '3px solid #FFD700',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(255, 215, 0, 0.2)',
          }}
        />
      )}

      {/* Finger Pointer */}
      {targetRect && (
        <div
          className="absolute pointer-events-none animate-bounce z-[10001]"
          style={{
            ...getFingerStyle(),
            width: 60,
            height: 60,
          }}
        >
          <img
            src="/assets/images/finger-pointer.png"
            alt="Tap here"
            className="w-full h-full object-contain drop-shadow-lg"
            onError={(e) => {
              // Fallback to emoji if image not found
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<span style="font-size: 48px;">👆</span>';
            }}
          />
        </div>
      )}

      {/* Click blocker overlay - blocks clicks everywhere except the highlighted area */}
      {requiresElementClick && (
        <>
          {/* Top blocker */}
          <div 
            className="absolute left-0 right-0 top-0"
            style={{ 
              height: holeStyle ? holeStyle.top : '100%',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Bottom blocker */}
          <div 
            className="absolute left-0 right-0 bottom-0"
            style={{ 
              top: holeStyle ? holeStyle.top + holeStyle.height : '100%',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Left blocker */}
          {holeStyle && (
            <div 
              className="absolute left-0"
              style={{ 
                top: holeStyle.top,
                width: holeStyle.left,
                height: holeStyle.height,
                pointerEvents: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {/* Right blocker */}
          {holeStyle && (
            <div 
              className="absolute right-0"
              style={{ 
                top: holeStyle.top,
                left: holeStyle.left + holeStyle.width,
                height: holeStyle.height,
                pointerEvents: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </>
      )}

      {/* Instruction Popup */}
      <div
        className={`absolute z-[10002] bg-gradient-to-br from-[#3E1F07] to-[#5c2e0b] rounded-2xl border-2 border-[#FFD700] shadow-2xl ${
          showContinueButton ? 'pointer-events-auto' : 'pointer-events-none'
        } ${
          compactPopup 
            ? 'w-[85%] max-w-xs px-4 py-3' 
            : 'w-[90%] max-w-sm px-6 py-5'
        }`}
        style={getPopupStyle()}
      >
        {/* Title */}
        {title && (
          <h3 className={`text-[#FFD700] font-display font-bold ${compactPopup ? 'text-base mb-1' : 'text-xl mb-2'}`}>
            {title}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className={`text-white/90 leading-relaxed ${compactPopup ? 'text-xs' : 'text-sm'}`}>
            {description}
          </p>
        )}

        {/* Custom Content - enable pointer events for interactive content */}
        {customContent && (
          <div className={`${compactPopup ? 'mt-2' : 'mt-4'} pointer-events-auto`}>
            {customContent}
          </div>
        )}

        {/* Continue Button */}
        {showContinueButton && onNext && (
          <button
            onClick={onNext}
            className={`w-full mt-3 py-2 px-4 bg-[#FFD700] hover:bg-[#FFA500] text-[#3E1F07] font-bold rounded-xl transition-colors shadow-lg ${
              compactPopup ? 'text-sm' : 'text-base'
            }`}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default TutorialSpotlight;
