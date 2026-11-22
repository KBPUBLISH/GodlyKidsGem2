import React, { useRef, useState } from 'react';

function finiteDuration(value: number | undefined | null): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export type AudioScrubberProps = {
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    /** `full` = playlist player gold bar + thumb. `mini` = thin top bar. */
    variant?: 'full' | 'mini';
    className?: string;
};

/**
 * Mobile-safe timeline scrubber.
 *
 * The old 8px custom bar used mouse/touch handlers without pointer capture or
 * `touch-action: none`. Android WebView treated the drag as a scroll, and
 * React's async `isDragging` state dropped the first touchmoves — so the
 * playhead never sought.
 *
 * This control uses a 44px hit target, pointer capture, and local drag state
 * so the thumb follows the finger and `onSeek` fires for the chosen time.
 */
const AudioScrubber: React.FC<AudioScrubberProps> = ({
    currentTime,
    duration,
    onSeek,
    variant = 'full',
    className = '',
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const [dragging, setDragging] = useState(false);
    const [dragTime, setDragTime] = useState(0);

    const max = finiteDuration(duration);
    const shown = dragging ? dragTime : currentTime;
    const percent = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;
    const disabled = max <= 0;

    const timeFromClientX = (clientX: number) => {
        const el = trackRef.current;
        if (!el || max <= 0) return 0;
        const rect = el.getBoundingClientRect();
        const width = rect.width || 1;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / width));
        return pct * max;
    };

    const apply = (clientX: number) => {
        const t = timeFromClientX(clientX);
        setDragTime(t);
        onSeek(t);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;
        setDragging(true);
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            /* capture unsupported — move/up still fire on this node while over it */
        }
        apply(e.clientX);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        e.preventDefault();
        apply(e.clientX);
    };

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        apply(e.clientX);
        setDragging(false);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            /* already released */
        }
    };

    const isFull = variant === 'full';

    return (
        <div
            className={`relative w-full ${isFull ? 'h-2 sm:h-3' : 'h-1'} ${className}`}
            style={{ touchAction: 'none' }}
        >
            {/* Fat hit target — does not affect layout height */}
            <div
                ref={trackRef}
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(max)}
                aria-valuenow={Math.round(shown)}
                aria-disabled={disabled}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={`absolute -top-4 -bottom-4 left-0 right-0 z-10 ${
                    disabled ? 'cursor-not-allowed' : dragging ? 'cursor-grabbing' : 'cursor-pointer'
                }`}
                style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            />

            <div
                className={`absolute inset-0 rounded-full pointer-events-none ${
                    isFull ? 'bg-[#3E1F07] shadow-inner' : 'bg-[#3e1f07]'
                }`}
            >
                <div
                    className="h-full bg-[#FFD700] rounded-full"
                    style={{ width: `${percent}%` }}
                />
            </div>

            {isFull && (
                <div
                    className={`absolute top-1/2 h-5 w-5 sm:h-6 sm:w-6 bg-[#f3e5ab] border-[3px] sm:border-4 border-[#8B4513] rounded-full shadow-lg pointer-events-none ${
                        dragging ? 'scale-125' : ''
                    }`}
                    style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
                />
            )}
        </div>
    );
};

export default AudioScrubber;
