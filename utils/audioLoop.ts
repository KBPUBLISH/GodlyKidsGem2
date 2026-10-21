/**
 * iOS/WKWebView often stops after one cycle even when HTMLMediaElement.loop is true.
 * Manually restart on ended and when playback stalls at the track end.
 */
export function attachReliableLoop(
    media: HTMLMediaElement,
    shouldLoop: boolean | (() => boolean) = true
): () => void {
    const loopEnabled = (): boolean =>
        typeof shouldLoop === 'function' ? shouldLoop() : shouldLoop;

    const restart = (): void => {
        if (!loopEnabled()) return;
        try {
            media.currentTime = 0;
            const playPromise = media.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        } catch {
            /* ignore */
        }
    };

    const onEnded = (): void => {
        if (loopEnabled()) restart();
    };

    const onTimeUpdate = (): void => {
        if (!loopEnabled()) return;
        const duration = media.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        if (media.currentTime >= duration - 0.08 && (media.paused || media.ended)) {
            restart();
        }
    };

    media.addEventListener('ended', onEnded);
    media.addEventListener('timeupdate', onTimeUpdate);

    return () => {
        media.removeEventListener('ended', onEnded);
        media.removeEventListener('timeupdate', onTimeUpdate);
    };
}
