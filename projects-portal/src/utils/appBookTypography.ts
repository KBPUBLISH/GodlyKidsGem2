import type { CSSProperties } from 'react';

/**
 * Typography used by the kid app (`BookPageRenderer`).
 * Keeps portal previews (PageEditor canvas, BookReader) aligned with on-device rendering.
 */

/** Matches BookReader "phone portrait" frame — authored font sizes assume ~this viewport width */
export const APP_BOOK_REF_VIEWPORT_WIDTH = 390;

export interface BookTypographyTextBoxLike {
    fontFamily?: string;
    fontSize?: number;
    showBackground?: boolean;
    shadowColor?: string;
}

/** Scale authored px font to the editor canvas so size matches the app's share of viewport width */
export function scaleAuthoredFontToCanvas(authoredPx: number, canvasWidthPx: number): number {
    if (!canvasWidthPx || canvasWidthPx <= 0) return Math.round(authoredPx);
    return Math.round(authoredPx * (canvasWidthPx / APP_BOOK_REF_VIEWPORT_WIDTH));
}

export function appSideSwipeFontFamily(fontFamily?: string | null): string {
    return fontFamily === 'Comic Sans MS'
        ? "'Patrick Hand', 'Comic Sans MS', 'Bubblegum Sans', cursive"
        : fontFamily || "'Patrick Hand', 'Comic Sans MS', cursive";
}

/** Resolved font-size in px before viewport/canvas scaling (matches app formula) */
export function appSideSwipeAuthoredFontSizePx(box: BookTypographyTextBoxLike): number {
    const base = box.fontSize || 24;
    if (box.fontFamily === 'Comic Sans MS' || !box.fontFamily) return Math.round(base * 1.2);
    return base;
}

export function appSideSwipeTextShadow(box: BookTypographyTextBoxLike): string {
    if (box.showBackground === true) {
        return '1px 1px 2px rgba(255,255,255,0.8)';
    }
    const sc = box.shadowColor;
    // App uses 'black'; some portal code historically used 'dark'
    if (sc === 'black' || sc === 'dark') {
        return '0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.7), 1px 1px 4px rgba(0,0,0,0.8)';
    }
    return '0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.7), 1px 1px 4px rgba(255,255,255,0.8)';
}

export function appStoryParagraphExtras(): Pick<CSSProperties, 'lineHeight' | 'filter'> {
    return {
        lineHeight: 1.625,
        filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.9))',
    };
}
