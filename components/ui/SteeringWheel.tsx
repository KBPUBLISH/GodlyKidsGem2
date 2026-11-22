import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { DespiaService } from '../../services/despiaService';

/** Same art as SailScenePage / CrewPage. */
export const SAIL_STEERING_WHEEL = '/assets/images/sail-steering-wheel.png';

/** Degrees between stops — matches SailScenePage / historic bottom-nav ITEM_ANGLE. */
export const WHEEL_STEP_ANGLE = 36;
/** Accumulated movement below this is a tap (same as SailScenePage). */
export const WHEEL_TAP_THRESHOLD = 22;
/** Settle easing after release — matches SailScenePage. */
export const WHEEL_SNAP_EASING = 'transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)';
/** Full clockwise spin on tap before the screen fades. */
export const WHEEL_TAP_SPIN_MS = 750;
const TAP_SPIN_EASING = `transform ${WHEEL_TAP_SPIN_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SteeringWheelProps {
  /** Current detent index (0-based). */
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  /** Tiny move / tap. Use as the accessibility fallback for “advance”. */
  onActivate?: () => void;
  /** Clockwise past the last detent (e.g. finish onboarding). */
  onPastMax?: () => void;
  /** Counterclockwise past the first detent (e.g. exit to splash). */
  onPastMin?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  ariaValueText?: string;
  /** Curved “turn me” arrow, hidden after the first drag. */
  showHint?: boolean;
  /** Soft scale/glow — splash “turn to begin”. */
  pulse?: boolean;
  /** CSS width of the hit target. */
  size?: string;
  className?: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Steerable ship’s wheel — same drag / rotate / snap language as SailScenePage.
 * Clockwise increases `value` by one detent per ~36° (18° is enough to snap).
 */
const SteeringWheel: React.FC<SteeringWheelProps> = ({
  value,
  min = 0,
  max,
  onChange,
  onActivate,
  onPastMax,
  onPastMin,
  disabled = false,
  ariaLabel,
  ariaValueText,
  showHint = false,
  pulse = false,
  size = 'min(46vw, 208px)',
  className = '',
}) => {
  const { playTab } = useAudio();
  const arrowMarkerId = `gk-helm-arrow-${useId().replace(/:/g, '')}`;
  const wheelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const totalMoveRef = useRef(0);
  const lastTouchEndRef = useRef(0);
  const dragRotationRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const spinningRef = useRef(false);
  const spinTimerRef = useRef<number | null>(null);

  const [dragRotation, setDragRotation] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(showHint);
  const [spinBonus, setSpinBonus] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  valueRef.current = value;
  dragRotationRef.current = dragRotation;

  const locked = disabled || isSpinning;

  useEffect(() => {
    if (showHint) setHintVisible(true);
  }, [showHint]);

  const restingRotation = value * WHEEL_STEP_ANGLE;
  const visualRotation =
    (isDragging && dragRotation !== null ? dragRotation : restingRotation) + spinBonus;

  const bump = useCallback(() => {
    playTab();
    DespiaService.haptics.light();
  }, [playTab]);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
  }, []);

  const playTapSpin = useCallback(
    (then?: () => void) => {
      if (spinningRef.current || disabled) return;
      spinningRef.current = true;
      setIsSpinning(true);
      dismissHint();
      bump();
      const finish = () => {
        spinTimerRef.current = null;
        then?.();
        // Unlock after the parent can set `disabled` (fade / navigate).
        requestAnimationFrame(() => {
          spinningRef.current = false;
          setIsSpinning(false);
        });
      };
      if (prefersReducedMotion()) {
        finish();
        return;
      }
      setSpinBonus((prev) => prev + 360);
      spinTimerRef.current = window.setTimeout(finish, WHEEL_TAP_SPIN_MS);
    },
    [bump, disabled, dismissHint],
  );

  useEffect(
    () => () => {
      if (spinTimerRef.current != null) {
        window.clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
    },
    [],
  );

  const getAngle = useCallback((clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const onStart = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || spinningRef.current) return;
      dismissHint();
      draggingRef.current = true;
      startAngleRef.current = getAngle(clientX, clientY);
      startRotationRef.current = valueRef.current * WHEEL_STEP_ANGLE;
      totalMoveRef.current = 0;
      setDragRotation(startRotationRef.current);
      setIsDragging(true);
    },
    [disabled, dismissHint, getAngle],
  );

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;
      const currentAngle = getAngle(clientX, clientY);
      let delta = currentAngle - startAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      totalMoveRef.current += Math.abs(delta);
      setDragRotation(startRotationRef.current + delta);
    },
    [getAngle],
  );

  const settle = useCallback(() => {
    draggingRef.current = false;
    setDragRotation(null);
    setIsDragging(false);
  }, []);

  const onEnd = useCallback(() => {
    if (!draggingRef.current || disabled || spinningRef.current) return;

    const currentDrag = dragRotationRef.current;
    if (currentDrag === null) {
      settle();
      return;
    }

    if (totalMoveRef.current < WHEEL_TAP_THRESHOLD) {
      settle();
      if (onActivate) playTapSpin(onActivate);
      return;
    }

    const rawIndex = Math.round(currentDrag / WHEEL_STEP_ANGLE);
    settle();

    if (rawIndex > max) {
      if (rawIndex !== valueRef.current) bump();
      if (onPastMax && valueRef.current >= max) {
        onPastMax();
        return;
      }
      if (valueRef.current !== max) onChange(max);
      return;
    }

    if (rawIndex < min) {
      if (rawIndex !== valueRef.current) bump();
      if (onPastMin && valueRef.current <= min) {
        onPastMin();
        return;
      }
      if (valueRef.current !== min) onChange(min);
      return;
    }

    const next = clamp(rawIndex, min, max);
    if (next !== valueRef.current) {
      bump();
      onChange(next);
    }
  }, [bump, disabled, max, min, onActivate, onChange, onPastMax, onPastMin, playTapSpin, settle]);

  const handleTouchStart = (e: React.TouchEvent) => {
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    onMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    lastTouchEndRef.current = Date.now();
    onEnd();
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchEndRef.current < 400) return;
    e.preventDefault();
    onStart(e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (locked) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (value >= max) {
        onPastMax?.();
        return;
      }
      bump();
      onChange(value + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (value <= min) {
        onPastMin?.();
        return;
      }
      bump();
      onChange(value - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onActivate) playTapSpin(onActivate);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => onEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMove, onEnd]);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', preventDefault, { passive: false });
    return () => el.removeEventListener('touchmove', preventDefault);
  }, []);

  return (
    <div
      ref={wheelRef}
      className={`relative touch-none select-none outline-none ${pulse && !isSpinning ? 'gk-steering-wheel-pulse' : ''} ${className}`}
      style={{
        width: size,
        aspectRatio: '1',
        cursor: locked ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.45))',
        pointerEvents: locked ? 'none' : 'auto',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      role="slider"
      tabIndex={locked ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={ariaValueText}
      aria-disabled={locked}
    >
      <style>{`
        @keyframes gk-steering-wheel-pulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 8px 18px rgba(0,0,0,0.45));
          }
          50% {
            transform: scale(1.055);
            filter: drop-shadow(0 8px 18px rgba(0,0,0,0.45)) drop-shadow(0 0 14px rgba(255, 138, 26, 0.55));
          }
        }
        .gk-steering-wheel-pulse {
          animation: gk-steering-wheel-pulse 2.4s ease-in-out infinite;
        }
        @keyframes gk-wheel-hint-rock {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes gk-wheel-hint-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .gk-wheel-hint {
          animation:
            gk-wheel-hint-rock 1.6s ease-in-out infinite,
            gk-wheel-hint-fade 1.6s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        @media (prefers-reduced-motion: reduce) {
          .gk-steering-wheel-pulse,
          .gk-wheel-hint {
            animation: none;
          }
          .gk-wheel-hint {
            opacity: 0.9;
            transform: rotate(0deg);
          }
        }
      `}</style>
      <img
        src={SAIL_STEERING_WHEEL}
        alt=""
        draggable={false}
        className="w-full h-full object-contain pointer-events-none select-none will-change-transform"
        style={{
          transform: `rotate(${visualRotation}deg)`,
          transition: isDragging
            ? 'none'
            : isSpinning
              ? TAP_SPIN_EASING
              : WHEEL_SNAP_EASING,
        }}
      />
      {hintVisible && !locked && (
        <div className="absolute inset-0 pointer-events-none gk-wheel-hint" aria-hidden>
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
          >
            <defs>
              <marker
                id={arrowMarkerId}
                viewBox="0 0 10 10"
                refX="0.35"
                refY="5"
                markerWidth="2.8"
                markerHeight="2.8"
                markerUnits="strokeWidth"
                orient="auto"
              >
                <path d="M 0 0.6 L 10 5 L 0 9.4 Z" fill="#F5E6C8" />
              </marker>
            </defs>
            {/* Clockwise rim arc; marker orients to the end tangent (down). */}
            <path
              d="M 72 22 A 36 36 0 0 1 88 58"
              fill="none"
              stroke="#F5E6C8"
              strokeWidth="4.5"
              strokeLinecap="butt"
              markerEnd={`url(#${arrowMarkerId})`}
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default SteeringWheel;
