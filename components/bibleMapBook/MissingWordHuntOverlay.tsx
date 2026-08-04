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

const POP_MS = 340;

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
        halfH: 28,
    };
}

/** GPU compositing path only — never touch left/top in the animation loop. */
function writeChipTransform(node: HTMLElement, x: number, y: number, rot: number) {
    node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rot}deg)`;
}

/** Tiny splash droplets rendered during the pop burst. */
const BubbleSplash: React.FC = () => (
    <span className="missing-word-hunt-splash" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`missing-word-hunt-droplet missing-word-hunt-droplet-${i}`} />
        ))}
    </span>
);

/**
 * Playful word-hunt bubbles for Bible Map missing words.
 * Kids find and tap answers in blank order; wrong taps get a light shake.
 * Image placement: chips slowly drift and bounce off overlay edges (screensaver-style).
 * Correct tap: bubble pops, then the blank fills as usual.
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
    const [poppingId, setPoppingId] = useState<string | null>(null);
    const popTimerRef = useRef<number | null>(null);
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

    useEffect(() => {
        return () => {
            if (popTimerRef.current != null) {
                window.clearTimeout(popTimerRef.current);
                popTimerRef.current = null;
            }
        };
    }, []);

    const handleSelect = (id: string) => {
        if (foundIds.has(id) || poppingId != null) return;
        if (id === nextId) {
            setPoppingId(id);
            if (popTimerRef.current != null) window.clearTimeout(popTimerRef.current);
            popTimerRef.current = window.setTimeout(() => {
                popTimerRef.current = null;
                setPoppingId(null);
                onCorrect(id);
            }, POP_MS);
            return;
        }
        onWrong?.(id);
        setShakingId(id);
        window.setTimeout(() => {
            setShakingId((cur) => (cur === id ? null : cur));
        }, 420);
    };

    /** Water-bubble chip: glossy translucent orb with readable letter. */
    const chipClass = (id: string) => {
        const isNext = id === nextId;
        const shaking = shakingId === id;
        const popping = poppingId === id;
        return [
            'missing-word-hunt-bubble pointer-events-auto select-none relative isolate overflow-visible',
            'font-bold tracking-wide text-[#1e3a5f]',
            'rounded-full border border-white/70',
            'backdrop-blur-[2px]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1',
            compact
                ? 'min-w-[1.65rem] min-h-[1.65rem] px-1.5 py-0.5 text-[10px] leading-none'
                : 'min-w-[2.15rem] min-h-[2.15rem] px-2.5 py-1.5 text-xs sm:text-sm leading-none',
            isNext ? 'missing-word-hunt-bubble-next' : 'missing-word-hunt-bubble-idle',
            shaking ? 'missing-word-hunt-shake-row' : '',
            popping ? 'missing-word-hunt-popping' : 'missing-word-hunt-bob',
            !shaking && !popping ? 'active:scale-95' : '',
        ]
            .filter(Boolean)
            .join(' ');
    };

    const renderBubbleButton = (chip: MissingWordHuntChip) => {
        const bobDelayMs = hashInteractiveSeed(`${pageSeed}::bob::${chip.id}`) % 900;
        const bobDurationS = 2.1 + (hashInteractiveSeed(`${pageSeed}::bobdur::${chip.id}`) % 8) / 10;
        return (
            <button
                type="button"
                className={chipClass(chip.id)}
                aria-label={`Puzzle word ${chip.label}`}
                disabled={poppingId === chip.id}
                style={
                    poppingId === chip.id || shakingId === chip.id
                        ? undefined
                        : { animationDelay: `${bobDelayMs}ms`, animationDuration: `${bobDurationS}s` }
                }
                onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(chip.id);
                }}
            >
                <span className="missing-word-hunt-gloss" aria-hidden />
                <span className="relative z-[1] block truncate px-0.5">{chip.label}</span>
                {poppingId === chip.id ? <BubbleSplash /> : null}
            </button>
        );
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
                    <React.Fragment key={chip.id}>{renderBubbleButton(chip)}</React.Fragment>
                ))}
                <style>{BUBBLE_STYLE}</style>
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
                    {renderBubbleButton(chip)}
                </div>
            ))}
            <style>{BUBBLE_STYLE}</style>
        </div>
    );
};

const BUBBLE_STYLE = `
.missing-word-hunt-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.35) 22%, transparent 48%),
    linear-gradient(165deg, rgba(224,244,255,0.88) 0%, rgba(147,210,243,0.72) 45%, rgba(96,178,224,0.78) 100%);
  box-shadow:
    0 4px 10px rgba(56, 120, 168, 0.28),
    0 1px 2px rgba(255,255,255,0.65) inset,
    0 -2px 6px rgba(40, 110, 160, 0.18) inset;
  transition: transform 75ms ease-out, box-shadow 75ms ease-out;
}
.missing-word-hunt-bubble-next {
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 22%, transparent 48%),
    linear-gradient(165deg, rgba(210,240,255,0.95) 0%, rgba(125,205,245,0.82) 45%, rgba(70,170,220,0.88) 100%);
  box-shadow:
    0 5px 14px rgba(40, 130, 190, 0.34),
    0 0 0 2px rgba(255,255,255,0.55),
    0 1px 2px rgba(255,255,255,0.75) inset,
    0 -2px 6px rgba(30, 100, 150, 0.2) inset;
}
.missing-word-hunt-gloss {
  position: absolute;
  top: 10%;
  left: 16%;
  width: 42%;
  height: 26%;
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.15) 100%);
  pointer-events: none;
  z-index: 0;
}
@keyframes missing-word-hunt-bob-kf {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) scale(1.04); }
}
.missing-word-hunt-bob {
  animation: missing-word-hunt-bob-kf 2.4s ease-in-out infinite;
}
@keyframes missing-word-hunt-pop-kf {
  0% { transform: scale(1); opacity: 1; filter: blur(0); }
  28% { transform: scale(1.38); opacity: 1; filter: blur(0); }
  55% { transform: scale(1.12); opacity: 0.85; }
  100% { transform: scale(0); opacity: 0; filter: blur(1px); }
}
.missing-word-hunt-popping {
  animation: missing-word-hunt-pop-kf 0.34s cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
  pointer-events: none;
}
.missing-word-hunt-splash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.missing-word-hunt-droplet {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff 0%, rgba(180,230,255,0.95) 40%, rgba(100,190,230,0.7) 100%);
  box-shadow: 0 0 4px rgba(255,255,255,0.7);
  animation: missing-word-hunt-droplet-kf 0.34s ease-out forwards;
}
.missing-word-hunt-droplet-0 { --dx: 18px; --dy: -16px; animation-delay: 0ms; }
.missing-word-hunt-droplet-1 { --dx: -16px; --dy: -14px; width: 5px; height: 5px; }
.missing-word-hunt-droplet-2 { --dx: 20px; --dy: 8px; width: 6px; height: 6px; }
.missing-word-hunt-droplet-3 { --dx: -18px; --dy: 10px; width: 5px; height: 5px; }
.missing-word-hunt-droplet-4 { --dx: 4px; --dy: 20px; width: 4px; height: 4px; }
.missing-word-hunt-droplet-5 { --dx: -6px; --dy: -22px; width: 4px; height: 4px; }
@keyframes missing-word-hunt-droplet-kf {
  0% { transform: translate(0, 0) scale(0.6); opacity: 1; }
  70% { opacity: 0.85; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.15); opacity: 0; }
}
@keyframes missing-word-hunt-shake-row-kf {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px) rotate(-2deg); }
  40% { transform: translateX(4px) rotate(2deg); }
  60% { transform: translateX(-3px) rotate(-1deg); }
  80% { transform: translateX(3px) rotate(1deg); }
}
.missing-word-hunt-shake-row {
  animation: missing-word-hunt-shake-row-kf 0.4s ease-in-out !important;
  background:
    radial-gradient(circle at 30% 28%, rgba(255,255,255,0.85) 0%, transparent 45%),
    linear-gradient(165deg, rgba(255,236,200,0.95) 0%, rgba(251,191,120,0.85) 100%) !important;
  border-color: rgba(245, 158, 11, 0.75) !important;
  box-shadow: 0 3px 8px rgba(180, 100, 20, 0.25) !important;
}
`;

export default MissingWordHuntOverlay;
