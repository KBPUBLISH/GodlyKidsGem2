import React, { useEffect, useRef } from 'react';
import { attachPlaybackTrim, trimHasEffect } from '../utils/playbackTrim';

export interface TrimmedPlaybackVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    src: string;
    trimStartSec?: number | null;
    trimEndSec?: number | null;
    loop?: boolean;
}

/** Portal copy — keep in sync with `components/media/TrimmedPlaybackVideo.tsx` (import path only differs). */
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
