import React, { useMemo } from 'react';
import { hashInteractiveSeed } from '../../utils/interactiveWords';

export type PuzzlePieceWordProps = {
    /** Word shown on the piece */
    label: string;
    /** Stable seed (page + chip id) → tab/blank layout + pastel color */
    seed: string;
    compact?: boolean;
};

/** Soft kid-friendly pastel palettes (fill, edge stroke, text). */
const PIECE_PALETTES = [
    { fill: '#FFE9A8', stroke: '#D9B24E', text: '#6E5200' }, // honey
    { fill: '#CBF1D3', stroke: '#7CC894', text: '#1D6238' }, // mint
    { fill: '#CFE9FF', stroke: '#7FB5E4', text: '#1E4E79' }, // sky
    { fill: '#FFDCE3', stroke: '#E79BAD', text: '#872E44' }, // pink
    { fill: '#E6DBFF', stroke: '#B29ADD', text: '#4A3480' }, // lavender
    { fill: '#FFE1C7', stroke: '#DFA870', text: '#7A4A14' }, // peach
];

type PieceEdges = { top: number; right: number; bottom: number; left: number };

/**
 * Classic jigsaw silhouette: rounded-rect body with a round knob (tab, edge = 1)
 * or socket (blank, edge = -1) centered on each side. Knobs bulge outside the
 * body by `r`, so the path is meant to be drawn with a translate(r, r) offset.
 */
function buildPuzzlePiecePath(w: number, h: number, edges: PieceEdges, r: number, corner: number): string {
    const neck = r * 0.62; // arc endpoints closer than 2r → bulbous knob with a narrow neck
    const p: string[] = [`M ${corner} 0`];
    // sweep=1 bulges outward (tab), sweep=0 carves inward (blank) — holds for all four edges below
    const sweep = (dir: number) => (dir > 0 ? 1 : 0);

    if (edges.top) {
        p.push(`L ${w / 2 - neck} 0`, `A ${r} ${r} 0 1 ${sweep(edges.top)} ${w / 2 + neck} 0`);
    }
    p.push(`L ${w - corner} 0`, `Q ${w} 0 ${w} ${corner}`);
    if (edges.right) {
        p.push(`L ${w} ${h / 2 - neck}`, `A ${r} ${r} 0 1 ${sweep(edges.right)} ${w} ${h / 2 + neck}`);
    }
    p.push(`L ${w} ${h - corner}`, `Q ${w} ${h} ${w - corner} ${h}`);
    if (edges.bottom) {
        p.push(`L ${w / 2 + neck} ${h}`, `A ${r} ${r} 0 1 ${sweep(edges.bottom)} ${w / 2 - neck} ${h}`);
    }
    p.push(`L ${corner} ${h}`, `Q 0 ${h} 0 ${h - corner}`);
    if (edges.left) {
        p.push(`L 0 ${h / 2 + neck}`, `A ${r} ${r} 0 1 ${sweep(edges.left)} 0 ${h / 2 - neck}`);
    }
    p.push(`L 0 ${corner}`, `Q 0 0 ${corner} 0`, 'Z');
    return p.join(' ');
}

/**
 * A word rendered inside a jigsaw-piece SVG, sized to fit the word.
 * Purely visual — wrap it in a button for tap handling.
 */
const PuzzlePieceWord: React.FC<PuzzlePieceWordProps> = ({ label, seed, compact = false }) => {
    const { path, palette, width, height, knobR, fontSize, sheenId } = useMemo(() => {
        const h = hashInteractiveSeed(`piece::${seed}`);
        const sheenId = `gkPieceSheen-${h.toString(36)}`;
        const palette = PIECE_PALETTES[h % PIECE_PALETTES.length];
        // Each side gets a seeded tab (out) or blank (in) so pieces look varied
        const bit = (n: number) => (((h >> n) & 1) === 1 ? 1 : -1);
        const edges: PieceEdges = { top: bit(1), right: bit(2), bottom: bit(3), left: bit(4) };

        const height = compact ? 34 : 44;
        const knobR = compact ? 6.5 : 8.5;
        const corner = compact ? 6 : 8;
        const longWord = label.length > 9;
        const fontSize = compact ? 11 : longWord ? 12 : 14;
        // Approximate glyph width so the body hugs the word
        const width = Math.max(
            compact ? 46 : 58,
            Math.round(label.length * fontSize * 0.62) + (compact ? 20 : 26),
        );
        const path = buildPuzzlePiecePath(width, height, edges, knobR, corner);
        return { path, palette, width, height, knobR, fontSize, sheenId };
    }, [label, seed, compact]);

    const svgW = width + knobR * 2;
    const svgH = height + knobR * 2;

    return (
        <span className="relative block" style={{ width: svgW, height: svgH }}>
            <svg
                width={svgW}
                height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="absolute inset-0 block overflow-visible"
                style={{ filter: 'drop-shadow(0 2px 3px rgba(30,30,30,0.35))' }}
                aria-hidden
            >
                <g transform={`translate(${knobR} ${knobR})`}>
                    <path d={path} fill={palette.fill} stroke={palette.stroke} strokeWidth={1.75} strokeLinejoin="round" />
                    {/* Soft top-light so the piece reads as a physical piece */}
                    <path d={path} fill={`url(#${sheenId})`} stroke="none" />
                </g>
                <defs>
                    <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                        <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.06)" />
                    </linearGradient>
                </defs>
            </svg>
            <span
                className="absolute flex items-center justify-center font-bold tracking-wide leading-none select-none"
                style={{
                    inset: knobR,
                    color: palette.text,
                    fontSize,
                    textShadow: '0 1px 0 rgba(255,255,255,0.55)',
                }}
            >
                <span className="block truncate px-1">{label}</span>
            </span>
        </span>
    );
};

export default PuzzlePieceWord;
