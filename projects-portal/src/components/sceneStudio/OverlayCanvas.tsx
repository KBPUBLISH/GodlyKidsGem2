import React, { useCallback, useRef, useState } from 'react';
import {
    BookOpen,
    HelpCircle,
    Puzzle,
    Palette,
    Gamepad2,
    Lock,
} from 'lucide-react';
import type { SceneButton, SceneActivityId } from './types';
import { SCENE_ACTIVITY_DEFS } from './types';
import { getMediaUrl } from '../../services/apiClient';

const ICONS: Record<SceneActivityId, React.ElementType> = {
    read: BookOpen,
    quiz: HelpCircle,
    puzzle: Puzzle,
    coloring: Palette,
    game: Gamepad2,
};

interface OverlayCanvasProps {
    buttons: SceneButton[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onChangeButtons: (next: SceneButton[]) => void;
    showActivitiesBoard: boolean;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Drag activity buttons as % of the device frame.
 */
const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
    buttons,
    selectedId,
    onSelect,
    onChangeButtons,
    showActivitiesBoard,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        id: string;
        mode: 'move' | 'resize';
        startX: number;
        startY: number;
        orig: SceneButton;
    } | null>(null);
    const [dragging, setDragging] = useState(false);

    const updateButton = useCallback(
        (id: string, patch: Partial<SceneButton>) => {
            onChangeButtons(
                buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
            );
        },
        [buttons, onChangeButtons],
    );

    const onPointerDown = (
        e: React.PointerEvent,
        id: string,
        mode: 'move' | 'resize',
    ) => {
        e.stopPropagation();
        e.preventDefault();
        const btn = buttons.find((b) => b.id === id);
        if (!btn || !rootRef.current) return;
        onSelect(id);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        dragRef.current = {
            id,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            orig: { ...btn },
        };
        setDragging(true);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        const drag = dragRef.current;
        const root = rootRef.current;
        if (!drag || !root) return;
        const rect = root.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
        const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

        if (drag.mode === 'move') {
            updateButton(drag.id, {
                x: clamp(drag.orig.x + dxPct, 0, 100 - drag.orig.w),
                y: clamp(drag.orig.y + dyPct, 0, 100 - drag.orig.h),
            });
        } else {
            updateButton(drag.id, {
                w: clamp(drag.orig.w + dxPct, 8, 100 - drag.orig.x),
                h: clamp(drag.orig.h + dyPct, 8, 100 - drag.orig.y),
            });
        }
    };

    const onPointerUp = () => {
        dragRef.current = null;
        setDragging(false);
    };

    return (
        <div
            ref={rootRef}
            className={`absolute inset-0 ${dragging ? 'cursor-grabbing' : ''}`}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => onSelect(null)}
        >
            {showActivitiesBoard && (
                <div
                    className="absolute left-[4%] right-[4%] bottom-0 pointer-events-none"
                    style={{ height: '32%' }}
                    aria-hidden
                >
                    <div
                        className="w-full h-full rounded-t-md opacity-80"
                        style={{
                            background:
                                'linear-gradient(180deg, rgba(92,58,26,0.15) 0%, rgba(92,58,26,0.55) 40%, rgba(60,30,8,0.75) 100%)',
                            border: '2px solid rgba(107,68,35,0.7)',
                        }}
                    />
                    <p
                        className="absolute left-0 right-0 text-center font-bold text-[#FFF6E8] text-[10px] tracking-[0.14em] pointer-events-none"
                        style={{ top: '8%', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                    >
                        ACTIVITIES
                    </p>
                </div>
            )}

            {buttons.map((btn) => {
                const selected = selectedId === btn.id;
                const def = SCENE_ACTIVITY_DEFS.find((d) => d.id === btn.id);
                const activityId = (def?.id || 'read') as SceneActivityId;
                const Icon = ICONS[activityId] || BookOpen;
                const label = btn.label || def?.label || btn.id;
                const iconSrc = btn.iconUrl ? getMediaUrl(btn.iconUrl) : '';

                return (
                    <button
                        key={btn.id}
                        type="button"
                        className={`absolute flex flex-col items-center justify-end touch-none select-none ${
                            selected
                                ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-transparent z-20'
                                : 'z-10'
                        } ${dragging && selected ? 'opacity-90' : ''}`}
                        style={{
                            left: `${btn.x}%`,
                            top: `${btn.y}%`,
                            width: `${btn.w}%`,
                            height: `${btn.h}%`,
                            cursor: dragging && selected ? 'grabbing' : 'grab',
                        }}
                        onPointerDown={(e) => onPointerDown(e, btn.id, 'move')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(btn.id);
                        }}
                        aria-label={label}
                    >
                        <span className="relative flex items-center justify-center w-full flex-1 min-h-0">
                            {iconSrc ? (
                                <img
                                    src={iconSrc}
                                    alt=""
                                    className="max-w-full max-h-full object-contain drop-shadow-md pointer-events-none"
                                    draggable={false}
                                />
                            ) : (
                                <span className="flex items-center justify-center w-[85%] aspect-square rounded-xl bg-[#6B4423]/border-2 border-[#8B5A2B] text-white shadow-md">
                                    <Icon className="w-[55%] h-[55%]" strokeWidth={2.2} />
                                </span>
                            )}
                            {btn.lockedUntil === 'content' && btn.id !== 'read' && (
                                <Lock className="absolute bottom-0 right-0 w-3 h-3 text-amber-300 drop-shadow" />
                            )}
                        </span>
                        <span
                            className="text-[7px] leading-tight font-bold text-white tracking-wide truncate w-full text-center px-0.5"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                        >
                            {label}
                        </span>
                        {selected && (
                            <span
                                className="absolute right-0 bottom-0 w-3 h-3 bg-indigo-500 border border-white rounded-sm cursor-nwse-resize"
                                onPointerDown={(e) => onPointerDown(e, btn.id, 'resize')}
                                aria-label="Resize"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default OverlayCanvas;
