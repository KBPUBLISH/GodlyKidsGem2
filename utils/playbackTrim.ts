/**
 * Optional in/out trim for HTMLMediaElement playback (video/audio).
 */

export interface PlaybackTrimConfig {
    trimStartSec?: number | null;
    trimEndSec?: number | null;
    /** Dynamic so callers can update after metadata without re-attaching */
    segmentLoop?: boolean | (() => boolean);
    /** When not looping the segment: fires once near trim end */
    onSegmentEnded?: () => void;
}

function parseSec(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
}

export function trimHasEffect(
    durationSec: number,
    trimStartSec?: number | null,
    trimEndSec?: number | null,
    epsilon = 0.12
): boolean {
    const d = durationSec > 0 && Number.isFinite(durationSec) ? durationSec : 0;
    if (d <= 0) return false;
    const ts = Math.max(0, parseSec(trimStartSec) ?? 0);
    let te = parseSec(trimEndSec);
    if (te === undefined || te <= 0 || te > d) te = d;
    te = Math.max(ts + epsilon / 4, te);
    return ts > epsilon / 2 || te < d - epsilon / 2;
}

export function resolvePlaybackWindow(
    durationSec: number,
    trimStartSec?: number | null,
    trimEndSec?: number | null
): { start: number; end: number } {
    const d = durationSec > 0 && Number.isFinite(durationSec) ? durationSec : 0;
    let start = parseSec(trimStartSec) ?? 0;
    if (!Number.isFinite(start) || start < 0) start = 0;

    let end = parseSec(trimEndSec);
    if (end === undefined || !Number.isFinite(end) || end <= 0 || end > d) {
        end = d || start + 1;
    }

    start = Math.min(start, Math.max(0, d ? d - 0.06 : start));
    if (end <= start + 0.04 && d > 0) {
        end = Math.min(d, start + Math.max(0.2, (d - start) / 4));
    } else if (end <= start + 0.04) {
        end = start + 0.25;
    }
    return { start, end };
}

/**
 * Applies segment clamping during playback.
 * When duration is unknown or trim is meaningless, behaves like native playback (minimal hooks).
 */
export function attachPlaybackTrim(media: HTMLMediaElement, cfg: PlaybackTrimConfig): () => void {
    const epsilon = 0.05;
    let start = 0;
    let end = Number.POSITIVE_INFINITY;
    let segmentEndedFired = false;

    /** Returns true while trim logically applies (after duration known). */
    const snapshot = (): boolean => {
        const d = media.duration > 0 && Number.isFinite(media.duration) ? media.duration : 0;
        if (d <= 0 || !trimHasEffect(d, cfg.trimStartSec, cfg.trimEndSec)) {
            start = 0;
            end = Number.POSITIVE_INFINITY;
            segmentEndedFired = false;
            return false;
        }
        const w = resolvePlaybackWindow(d, cfg.trimStartSec, cfg.trimEndSec);
        start = w.start;
        end = w.end;
        return true;
    };

    const onLoadedMeta = () => {
        if (!snapshot()) return;
        segmentEndedFired = false;
        if (media.currentTime < start) media.currentTime = start;
    };

    const onPlay = () => {
        if (!snapshot()) return;
        if (media.currentTime < start - 0.01 || media.currentTime >= end - epsilon) {
            media.currentTime = start;
            segmentEndedFired = false;
        }
    };

    const onTimeUpdate = () => {
        if (!snapshot()) return;
        if (media.currentTime >= end - epsilon) {
            const shouldLoop = typeof cfg.segmentLoop === 'function' ? cfg.segmentLoop() : !!cfg.segmentLoop;
            if (shouldLoop) {
                media.currentTime = start;
                segmentEndedFired = false;
                return;
            }
            media.pause();
            media.currentTime = Math.min(end, media.duration || end);
            if (!segmentEndedFired) {
                segmentEndedFired = true;
                cfg.onSegmentEnded?.();
            }
        }
    };

    media.addEventListener('loadedmetadata', onLoadedMeta);
    media.addEventListener('play', onPlay);
    media.addEventListener('timeupdate', onTimeUpdate);

    if (media.readyState >= HTMLMediaElement.HAVE_METADATA) {
        onLoadedMeta();
    }

    return () => {
        media.removeEventListener('loadedmetadata', onLoadedMeta);
        media.removeEventListener('play', onPlay);
        media.removeEventListener('timeupdate', onTimeUpdate);
    };
}
