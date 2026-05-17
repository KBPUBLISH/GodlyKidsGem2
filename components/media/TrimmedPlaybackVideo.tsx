import React, { useEffect, useRef } from 'react';
import { attachPlaybackTrim, trimHasEffect } from '../../utils/playbackTrim';

export interface TrimmedPlaybackVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    src: string;
    trimStartSec?: number | null;
    trimEndSec?: number | null;
    /** Like native HTML loop; when trims apply we segment-loop instead */
    loop?: boolean;
}

/**
 * <video> with optional start/end trim (seconds relative to uploaded file).
 * When trims apply, disables native HTML `loop` and restarts inside the trimmed window.
 */
const TrimmedPlaybackVideo = React.forwardRef<HTMLVideoElement, TrimmedPlaybackVideoProps>(
    ({ src, trimStartSec, trimEndSec, loop = false, onEnded, muted, ...rest }, forwardedRef) => {
        const innerRef = useRef<HTMLVideoElement | null>(null);
        const loopRef = useRef(!!loop);
        loopRef.current = !!loop;

        useEffect(() => {
            const el = innerRef.current;
            if (!el) return undefined;

            return attachPlaybackTrim(el, {
                trimStartSec,
                trimEndSec,
                segmentLoop: () => loopRef.current,
                onSegmentEnded: () => {
                    if (trimHasEffect(el.duration || 0, trimStartSec, trimEndSec) && onEnded) {
                        onEnded({
                            target: el,
                            currentTarget: el,
                            preventDefault() {},
                            stopPropagation() {},
                        } as unknown as React.SyntheticEvent<HTMLVideoElement>);
                    }
                },
            });
        }, [src, trimStartSec, trimEndSec, onEnded]);

        const setRefs = (node: HTMLVideoElement | null) => {
            innerRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
        };

        const trimProbably = trimStartSec != null || trimEndSec != null;

        return (
            <video
                ref={setRefs}
                src={src}
                muted={muted}
                loop={trimProbably ? false : !!loop}
                onEnded={(e) => {
                    const d = e.currentTarget.duration;
                    const trimmed = !!(d && trimHasEffect(d, trimStartSec, trimEndSec));
                    if (!trimmed) {
                        onEnded?.(e);
                    }
                }}
                {...rest}
            />
        );
    },
);

TrimmedPlaybackVideo.displayName = 'TrimmedPlaybackVideo';

export default TrimmedPlaybackVideo;
