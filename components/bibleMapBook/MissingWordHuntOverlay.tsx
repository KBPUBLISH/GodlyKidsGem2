import React, { useEffect, useMemo, useRef, useState } from 'react';
import { hashInteractiveSeed } from '../../utils/interactiveWords';
import PuzzlePieceWord from './PuzzlePieceWord';

export type MissingWordHuntChip = {
    /** Stable id used for found / next matching */
    id: string;
    /** Visible answer text on the chip */
    label: string;
};

export type MissingWordHuntOverlayProps = {
    pageSeed: string | number;
    chips: MissingWordHuntChip[];
    foundIds: ReadonlySet<string>;
    /** Id of the blank that must be found next (null when done) */
    nextId: string | null;
    onCorrect: (id: string) => void;
    /** Wrong chip / out-of-order tap (for star scoring). */
    onWrong?: (id: string) => void;
    /**
     * `image` — row of pieces along the bottom of the art, just above the scroll.
     * `scroll-top` — row of pieces along the top of the scroll when there is no art.
     */
    placement?: 'image' | 'scroll-top';
    className?: string;
    compact?: boolean;
};

/** Piece pop + snap-toward-blank flight time (ms) — keep in sync with the snap keyframes. */
const SNAP_MS = 480;

type SnapState = { id: string; dx: number; dy: number };

/**
 * Word-hunt puzzle pieces for Bible Map missing words.
 * Pieces sit still in a row just above the scroll, deterministically shuffled
 * per page so the row never gives away the sentence order, each with a slight
 * seeded tilt. Kids tap answers in blank order ("Tap words in order"); a
 * correct tap pops the piece and snaps it toward the blank it fills, a wrong
 * tap shakes (and is counted by the parent for star scoring).
 */
const MissingWordHuntOverlay: React.FC<MissingWordHuntOverlayProps> = ({
    pageSeed,
    chips,
    foundIds,
    nextId,
    onCorrect,
    onWrong,
    placement = 'image',
    className = '',
    compact = false,
}) => {
    const [shakingId, setShakingId] = useState<string | null>(null);
    const [snapping, setSnapping] = useState<SnapState | null>(null);
    const snapTimerRef = useRef<number | null>(null);
    const pieceNodeRefs = useRef<Map<string, HTMLElement>>(new Map());

    // Deterministic per-page shuffle: pieces line up in seeded random order (not
    // sentence order, so the row doesn't give away the answer sequence) and the
    // order is stable across re-renders. Each piece keeps a seeded ±15° tilt.
    const orderedChips = useMemo(() => {
        return chips
            .map((chip) => {
                const hash = hashInteractiveSeed(`${pageSeed}::piece::${chip.id}`);
                return {
                    chip,
                    sortKey: hashInteractiveSeed(`${pageSeed}::shuffle::${chip.id}`),
                    rotDeg: (hash % 31) - 15,
                };
            })
            .sort((a, b) => a.sortKey - b.sortKey || a.chip.id.localeCompare(b.chip.id));
    }, [chips, pageSeed]);

    useEffect(() => {
        return () => {
            if (snapTimerRef.current != null) {
                window.clearTimeout(snapTimerRef.current);
                snapTimerRef.current = null;
            }
        };
    }, []);

    const handleSelect = (id: string) => {
        if (foundIds.has(id) || snapping != null) return;
        if (id === nextId) {
            // Aim the flight at the blank this piece fills (rendered in the scroll).
            let dx = 0;
            let dy = 160; // fallback: glide down toward the parchment
            const pieceNode = pieceNodeRefs.current.get(id);
            const blankNode = document.querySelector(`[data-hunt-blank="${CSS.escape(id)}"]`);
            if (pieceNode && blankNode) {
                const a = pieceNode.getBoundingClientRect();
                const b = blankNode.getBoundingClientRect();
                dx = b.left + b.width / 2 - (a.left + a.width / 2);
                dy = b.top + b.height / 2 - (a.top + a.height / 2);
            }
            setSnapping({ id, dx, dy });
            if (snapTimerRef.current != null) window.clearTimeout(snapTimerRef.current);
            snapTimerRef.current = window.setTimeout(() => {
                snapTimerRef.current = null;
                setSnapping(null);
                onCorrect(id);
            }, SNAP_MS);
            return;
        }
        onWrong?.(id);
        setShakingId(id);
        window.setTimeout(() => {
            setShakingId((cur) => (cur === id ? null : cur));
        }, 420);
    };

    // Compact pieces when the row is crowded so everything stays tappable
    const rowCompact = compact || placement === 'scroll-top' || chips.length >= 5;

    const renderPieceButton = (chip: MissingWordHuntChip, rotDeg: number) => {
        const isShaking = shakingId === chip.id;
        const isSnapping = snapping?.id === chip.id;
        return (
            <button
                type="button"
                ref={(el) => {
                    if (el) pieceNodeRefs.current.set(chip.id, el);
                    else pieceNodeRefs.current.delete(chip.id);
                }}
                className={[
                    'missing-word-hunt-piece pointer-events-auto select-none relative block',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1 rounded-lg',
                    isSnapping ? 'missing-word-hunt-piece-snapping' : '',
                    !isSnapping && isShaking ? 'missing-word-hunt-piece-shake' : '',
                    !isSnapping && !isShaking ? 'active:scale-95' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
                style={
                    {
                        '--piece-rot': `${rotDeg}deg`,
                        '--snap-dx': isSnapping ? `${snapping!.dx}px` : '0px',
                        '--snap-dy': isSnapping ? `${snapping!.dy}px` : '0px',
                    } as React.CSSProperties
                }
                disabled={isSnapping}
                aria-label={`Puzzle piece word ${chip.label}`}
                onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(chip.id);
                }}
            >
                <PuzzlePieceWord
                    label={chip.label}
                    seed={`${pageSeed}::${chip.id}`}
                    compact={rowCompact}
                />
            </button>
        );
    };

    /**
     * Shuffled row of pieces. Found pieces become invisible placeholders that
     * keep their slot, so the remaining pieces never shift under a kid's finger.
     */
    const renderPieceRow = () => (
        <div className="flex flex-wrap-reverse items-center justify-center gap-x-2.5 gap-y-1.5 max-w-full">
            {orderedChips.map(({ chip, rotDeg }) =>
                foundIds.has(chip.id) ? (
                    <span
                        key={chip.id}
                        className="invisible pointer-events-none"
                        aria-hidden
                    >
                        <PuzzlePieceWord
                            label={chip.label}
                            seed={`${pageSeed}::${chip.id}`}
                            compact={rowCompact}
                        />
                    </span>
                ) : (
                    <React.Fragment key={chip.id}>
                        {renderPieceButton(chip, rotDeg)}
                    </React.Fragment>
                ),
            )}
        </div>
    );

    const remaining = chips.filter((c) => !foundIds.has(c.id));
    if (!remaining.length || nextId == null) return null;

    if (placement === 'scroll-top') {
        return (
            <div
                className={`pointer-events-none absolute left-0 right-0 z-[25] flex flex-col items-center gap-1 px-2 pt-1 ${className}`}
                style={{ top: 0 }}
                role="group"
                aria-label="Tap the missing words in order"
            >
                <p className="missing-word-hunt-instruction">Tap words in order</p>
                {renderPieceRow()}
                <style>{PIECE_STYLE}</style>
            </div>
        );
    }

    return (
        <div
            className={`pointer-events-none absolute inset-0 z-[25] flex flex-col items-center justify-end gap-1 pb-1.5 px-16 sm:px-20 ${className}`}
            role="group"
            aria-label="Tap the missing words in order"
        >
            <p className="missing-word-hunt-instruction">Tap words in order</p>
            {renderPieceRow()}
            <style>{PIECE_STYLE}</style>
        </div>
    );
};

const PIECE_STYLE = `
/* Kid-friendly instruction above the row of pieces */
.missing-word-hunt-instruction {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fdf6e3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75), 0 0 6px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  user-select: none;
}
/* Still, fully opaque pieces (no idle animation) */
.missing-word-hunt-piece {
  transform: rotate(var(--piece-rot, 0deg));
  transition: transform 90ms ease-out;
}
/* Correct tap: quick joyful pop, then the piece flies to the blank it fills */
@keyframes missing-word-hunt-piece-snap-kf {
  0% { transform: translate(0, 0) rotate(var(--piece-rot, 0deg)) scale(1); opacity: 1; }
  28% { transform: translate(0, 0) rotate(0deg) scale(1.22); opacity: 1; }
  100% { transform: translate(var(--snap-dx, 0px), var(--snap-dy, 160px)) rotate(0deg) scale(0.2); opacity: 0; }
}
.missing-word-hunt-piece-snapping {
  animation: missing-word-hunt-piece-snap-kf ${SNAP_MS}ms cubic-bezier(0.3, 0.9, 0.35, 1) forwards;
  pointer-events: none;
  z-index: 5;
}
@keyframes missing-word-hunt-piece-shake-kf {
  0%, 100% { transform: translateX(0) rotate(var(--piece-rot, 0deg)); }
  20% { transform: translateX(-5px) rotate(calc(var(--piece-rot, 0deg) - 3deg)); }
  40% { transform: translateX(5px) rotate(calc(var(--piece-rot, 0deg) + 3deg)); }
  60% { transform: translateX(-4px) rotate(calc(var(--piece-rot, 0deg) - 2deg)); }
  80% { transform: translateX(4px) rotate(calc(var(--piece-rot, 0deg) + 2deg)); }
}
.missing-word-hunt-piece-shake {
  animation: missing-word-hunt-piece-shake-kf 0.4s ease-in-out;
}
`;

export default MissingWordHuntOverlay;
