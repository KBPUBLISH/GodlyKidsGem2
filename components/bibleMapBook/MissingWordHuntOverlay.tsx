import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hashInteractiveSeed, puzzleChipPosition } from '../../utils/interactiveWords';

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
     * `image` — scatter chips over the art container (percentage positions).
     * `scroll-top` — row of chips along the top of the scroll when there is no art.
     */
    placement?: 'image' | 'scroll-top';
    /** Bounds for image placement (% of overlay container) — used as spawn area */
    areaTopMin?: number;
    areaTopMax?: number;
    areaLeftMin?: number;
    areaLeftMax?: number;
    className?: string;
    compact?: boolean;
};

type ChipMotion = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    halfW: number;
    halfH: number;
};

type SpawnArea = {
    pageSeed: string | number;
    topMin: number;
    topMax: number;
    leftMin: number;
    leftMax: number;
};

/** Soft kid-friendly drift: ~12–26 px/s with varied headings. */
function seedChipVelocity(pageSeed: string | number, chipId: string, index: number): { vx: number; vy: number } {
    const h = hashInteractiveSeed(`${pageSeed}::drift::${chipId}`);
    const speed = 12 + (h % 15); // 12–26 px/s
    const angle = ((((h >> 8) % 360) + index * 47) % 360) * (Math.PI / 180);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    if (Math.abs(vx) < 4) vx = (vx < 0 ? -1 : 1) * (4 + (h % 3));
    if (Math.abs(vy) < 4) vy = (vy < 0 ? -1 : 1) * (4 + ((h >> 4) % 3));
    return { vx, vy };
}

function spawnChipMotion(
    chip: MissingWordHuntChip,
    remIndex: number,
    chipCount: number,
    w: number,
    h: number,
    area: SpawnArea,
): ChipMotion {
    const pos = puzzleChipPosition(area.pageSeed, chip.id, {
        topMin: area.topMin,
        topMax: area.topMax,
        leftMin: area.leftMin,
        leftMax: area.leftMax,
        chipIndex: remIndex,
        chipCount,
    });
    const { vx, vy } = seedChipVelocity(area.pageSeed, chip.id, remIndex);
    return {
        id: chip.id,
        x: (pos.leftPct / 100) * Math.max(w, 1),
        y: (pos.topPct / 100) * Math.max(h, 1),
        vx,
        vy,
        rot: ((hashInteractiveSeed(`${area.pageSeed}::rot::${chip.id}`) % 9) - 4) * 0.4,
        halfW: 28,
        halfH: 16,
    };
}

/** GPU compositing path only — never touch left/top in the animation loop. */
function writeChipTransform(node: HTMLElement, x: number, y: number, rot: number) {
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rot}deg)`;
}

/**
 * Playful word-hunt chips for Bible Map missing words.
 * Kids find and tap answers in blank order; wrong taps get a light shake.
 * Image placement: chips slowly drift and bounce off overlay edges (screensaver-style).
 */
const MissingWordHuntOverlay: React.FC<MissingWordHuntOverlayProps> = ({
    pageSeed,
    chips,
    foundIds,
    nextId,
    onCorrect,
    onWrong,
    placement = 'image',
    areaTopMin = 10,
    areaTopMax = 52,
    areaLeftMin = 6,
    areaLeftMax = 86,
    className = '',
    compact = false,
}) => {
    const [shakingId, setShakingId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chipNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const motionsRef = useRef<Map<string, ChipMotion>>(new Map());
    const sizeRef = useRef({ w: 0, h: 0 });
    const remainingRef = useRef<MissingWordHuntChip[]>([]);
    const areaRef = useRef<SpawnArea>({
        pageSeed,
        topMin: areaTopMin,
        topMax: areaTopMax,
        leftMin: areaLeftMin,
        leftMax: areaLeftMax,
    });

    const remaining = chips.filter((c) => !foundIds.has(c.id));
    const remainingIds = remaining.map((c) => c.id).join('|');
    const hasImageChips = placement === 'image' && remaining.length > 0 && nextId != null;
    remainingRef.current = remaining;
    areaRef.current = {
        pageSeed,
        topMin: areaTopMin,
        topMax: areaTopMax,
        leftMin: areaLeftMin,
        leftMax: areaLeftMax,
    };

    const handleSelect = (id: string) => {
        if (foundIds.has(id)) return;
        if (id === nextId) {
            onCorrect(id);
            return;
        }
        onWrong?.(id);
        setShakingId(id);
        window.setTimeout(() => {
            setShakingId((cur) => (cur === id ? null : cur));
        }, 420);
    };

    /** Duolingo-style 3D tactile chip: cream face + thick bottom edge + press. */
    const chipClass = (id: string, shakeClass: string) => {
        const isNext = id === nextId;
        const shaking = shakingId === id;
        return [
            'pointer-events-auto select-none font-semibold tracking-wide',
            'rounded-xl border-2 border-b-4',
            'bg-gradient-to-b from-[#fff8e7] to-[#f3e6c8] text-[#3d2e1f]',
            // Transform transition only for press feedback — not on the mover wrapper.
            'transition-[border-width,box-shadow] duration-75 ease-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1',
            compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-1 text-xs sm:text-sm',
            isNext
                ? 'border-amber-500 border-b-amber-700'
                : 'border-[#c4a574] border-b-[#8b6914]',
            shaking
                ? shakeClass
                : 'active:translate-y-[2px] active:border-b-2 hover:-translate-y-px',
        ].join(' ');
    };

    const measureChip = (id: string) => {
        const node = chipNodeRefs.current.get(id);
        const motion = motionsRef.current.get(id);
        if (!node || !motion) return;
        const w = node.offsetWidth;
        const h = node.offsetHeight;
        if (w > 0) motion.halfW = w / 2;
        if (h > 0) motion.halfH = h / 2;
    };

    const paintChip = (m: ChipMotion) => {
        const node = chipNodeRefs.current.get(m.id);
        if (node) writeChipTransform(node, m.x, m.y, m.rot);
    };

    // Sync motion bodies when remaining chips change; spawn at seeded % positions.
    useLayoutEffect(() => {
        if (placement !== 'image') return;
        const container = containerRef.current;
        const w = container?.clientWidth || sizeRef.current.w;
        const h = container?.clientHeight || sizeRef.current.h;
        if (w > 0 && h > 0) sizeRef.current = { w, h };

        const motions = motionsRef.current;
        const liveList = remainingRef.current;
        const live = new Set(liveList.map((c) => c.id));
        for (const id of [...motions.keys()]) {
            if (!live.has(id)) {
                motions.delete(id);
                chipNodeRefs.current.delete(id);
            }
        }

        const area = areaRef.current;
        liveList.forEach((chip, remIndex) => {
            if (motions.has(chip.id)) {
                measureChip(chip.id);
                paintChip(motions.get(chip.id)!);
                return;
            }
            const m = spawnChipMotion(chip, remIndex, liveList.length, w, h, area);
            motions.set(chip.id, m);
            measureChip(chip.id);
            paintChip(m);
        });
    }, [placement, remainingIds, pageSeed, areaTopMin, areaTopMax, areaLeftMin, areaLeftMax]);

    // rAF drift + bounce; pause when tab hidden. Restart only when hunt starts/ends.
    useEffect(() => {
        if (!hasImageChips) return;
        const container = containerRef.current;
        if (!container) return;

        let raf = 0;
        let last = performance.now();
        let paused = document.hidden;

        const applyContainerSize = (nw: number, nh: number) => {
            const { w, h } = sizeRef.current;
            if ((w < 8 || h < 8) && nw >= 8 && nh >= 8) {
                const liveList = remainingRef.current;
                const area = areaRef.current;
                liveList.forEach((chip, remIndex) => {
                    const m = spawnChipMotion(chip, remIndex, liveList.length, nw, nh, area);
                    motionsRef.current.set(chip.id, m);
                    measureChip(chip.id);
                    paintChip(m);
                });
                sizeRef.current = { w: nw, h: nh };
                return;
            }
            if (w > 0 && h > 0 && nw > 0 && nh > 0 && (w !== nw || h !== nh)) {
                const sx = nw / w;
                const sy = nh / h;
                for (const m of motionsRef.current.values()) {
                    m.x *= sx;
                    m.y *= sy;
                    measureChip(m.id);
                    paintChip(m);
                }
            }
            sizeRef.current = { w: nw, h: nh };
        };

        applyContainerSize(container.clientWidth, container.clientHeight);

        // Re-measure chip sizes once after layout settles (labels/fonts).
        const measureAll = () => {
            for (const id of motionsRef.current.keys()) measureChip(id);
        };
        measureAll();
        const measureRaf = requestAnimationFrame(measureAll);

        const ro = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect) return;
            applyContainerSize(rect.width, rect.height);
        });
        ro.observe(container);

        const onVisibility = () => {
            paused = document.hidden;
            if (!paused) last = performance.now();
        };
        document.addEventListener('visibilitychange', onVisibility);

        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            const { w, h } = sizeRef.current;
            if (paused || w < 8 || h < 8) {
                last = now;
                return;
            }
            const motions = motionsRef.current;
            if (motions.size === 0) {
                last = now;
                return;
            }

            // Frame-rate independent; clamp large gaps (tab resume / hitch).
            const dt = Math.min((now - last) / 1000, 0.048);
            last = now;
            if (dt <= 0) return;

            for (const m of motions.values()) {
                m.x += m.vx * dt;
                m.y += m.vy * dt;

                const pad = 2;
                const minX = m.halfW + pad;
                const maxX = Math.max(minX, w - m.halfW - pad);
                const minY = m.halfH + pad;
                const maxY = Math.max(minY, h - m.halfH - pad);

                if (m.x <= minX) {
                    m.x = minX;
                    m.vx = Math.abs(m.vx);
                } else if (m.x >= maxX) {
                    m.x = maxX;
                    m.vx = -Math.abs(m.vx);
                }
                if (m.y <= minY) {
                    m.y = minY;
                    m.vy = Math.abs(m.vy);
                } else if (m.y >= maxY) {
                    m.y = maxY;
                    m.vy = -Math.abs(m.vy);
                }

                // Subtle lean toward travel — cheap, no layout.
                const targetRot = Math.max(-5, Math.min(5, m.vx * 0.12));
                m.rot += (targetRot - m.rot) * Math.min(1, dt * 4);

                const node = chipNodeRefs.current.get(m.id);
                if (node) writeChipTransform(node, m.x, m.y, m.rot);
            }
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            cancelAnimationFrame(measureRaf);
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [hasImageChips]);

    if (!remaining.length || nextId == null) return null;

    if (placement === 'scroll-top') {
        return (
            <div
                className={`pointer-events-none absolute left-0 right-0 z-[25] flex flex-wrap justify-center gap-2 px-2 pt-1 ${className}`}
                style={{ top: 0 }}
                role="group"
                aria-label="Find the missing words in order"
            >
                {remaining.map((chip) => (
                    <button
                        key={chip.id}
                        type="button"
                        className={chipClass(chip.id, 'missing-word-hunt-shake-row')}
                        aria-label={`Puzzle word ${chip.label}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(chip.id);
                        }}
                    >
                        {chip.label}
                    </button>
                ))}
                <style>{SHAKE_STYLE}</style>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`pointer-events-none absolute inset-0 z-[25] overflow-hidden ${className}`}
            role="group"
            aria-label="Find the missing words on the picture"
        >
            {remaining.map((chip) => (
                <div
                    key={chip.id}
                    ref={(el) => {
                        if (el) {
                            chipNodeRefs.current.set(chip.id, el);
                            // Pin to origin; motion writes translate3d only.
                            el.style.left = '0';
                            el.style.top = '0';
                            const m = motionsRef.current.get(chip.id);
                            if (m) {
                                if (el.offsetWidth > 0) m.halfW = el.offsetWidth / 2;
                                if (el.offsetHeight > 0) m.halfH = el.offsetHeight / 2;
                                writeChipTransform(el, m.x, m.y, m.rot);
                            }
                        } else {
                            chipNodeRefs.current.delete(chip.id);
                        }
                    }}
                    className="absolute left-0 top-0 max-w-[42%]"
                    style={{
                        // Promote once; rAF updates transform only.
                        willChange: 'transform',
                        transform: 'translate3d(0,0,0) translate(-50%, -50%)',
                        backfaceVisibility: 'hidden',
                    }}
                >
                    <button
                        type="button"
                        className={chipClass(chip.id, 'missing-word-hunt-shake-row')}
                        aria-label={`Puzzle word ${chip.label}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(chip.id);
                        }}
                    >
                        <span className="block truncate">{chip.label}</span>
                    </button>
                </div>
            ))}
            <style>{SHAKE_STYLE}</style>
        </div>
    );
};

const SHAKE_STYLE = `
@keyframes missing-word-hunt-shake-row-kf {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px) rotate(-2deg); }
  40% { transform: translateX(4px) rotate(2deg); }
  60% { transform: translateX(-3px) rotate(-1deg); }
  80% { transform: translateX(3px) rotate(1deg); }
}
.missing-word-hunt-shake-row {
  animation: missing-word-hunt-shake-row-kf 0.4s ease-in-out;
  border-color: #b45309 !important;
  border-bottom-color: #92400e !important;
  background-image: none !important;
  background-color: #fde68a !important;
}
`;

export default MissingWordHuntOverlay;
