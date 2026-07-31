import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Airplay } from 'lucide-react';

export interface MusicVideo {
    _id: string;
    title: string;
    author?: string;
    description?: string;
    thumbnailUrl?: string;
    videoUrl: string;
    duration?: number;
    viewCount?: number;
    isMembersOnly?: boolean;
    isFeatured?: boolean;
    isNew?: boolean;
    isPopular?: boolean;
}

interface MusicVideoOverlayProps {
    video: MusicVideo;
    onClose: () => void;
}

const MusicVideoOverlay: React.FC<MusicVideoOverlayProps> = ({ video, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    // When a landscape (wide) video plays on a portrait screen we rotate it 90°
    // so it fills the whole screen in its native aspect ratio (like fullscreen video).
    const [rotate, setRotate] = useState(false);
    // Whether the WebKit Remote Playback API (explicit AirPlay picker) is available.
    const [canShowAirPlayPicker, setCanShowAirPlayPicker] = useState(false);

    const recomputeRotation = useCallback(() => {
        const v = videoRef.current;
        if (!v || !v.videoWidth || !v.videoHeight) return;
        const landscapeVideo = v.videoWidth > v.videoHeight;
        const portraitScreen = window.innerHeight >= window.innerWidth;
        setRotate(landscapeVideo && portraitScreen);
    }, []);

    useEffect(() => {
        window.addEventListener('resize', recomputeRotation);
        window.addEventListener('orientationchange', recomputeRotation);
        return () => {
            window.removeEventListener('resize', recomputeRotation);
            window.removeEventListener('orientationchange', recomputeRotation);
        };
    }, [recomputeRotation]);

    // Enable AirPlay: `x-webkit-airplay="allow"` lets iOS/Safari show the AirPlay
    // route picker in the native video controls. It's a non-standard attribute so
    // we set it imperatively rather than via JSX. We also detect the explicit
    // WebKit Remote Playback picker API so we can render our own AirPlay button.
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.setAttribute('x-webkit-airplay', 'allow');
        setCanShowAirPlayPicker(
            typeof (v as any).webkitShowPlaybackTargetPicker === 'function'
        );
    }, []);

    const showAirPlayPicker = useCallback(() => {
        const v = videoRef.current as any;
        if (v && typeof v.webkitShowPlaybackTargetPicker === 'function') {
            v.webkitShowPlaybackTargetPicker();
        }
    }, []);

    // Lock background scroll while the fullscreen player is open.
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prevOverflow; };
    }, []);

    const overlay = (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center bg-black animate-in fade-in duration-200"
            style={{ zIndex: 2147483647, touchAction: 'none' }}
        >
            <button
                onClick={onClose}
                className="absolute right-4 z-10 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ top: 'calc(var(--safe-area-top, 12px) + 8px)' }}
                aria-label="Close video"
            >
                <X size={24} strokeWidth={2.5} />
            </button>

            {canShowAirPlayPicker && (
                <button
                    onClick={showAirPlayPicker}
                    className="absolute right-[68px] z-10 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-90 transition-transform"
                    style={{ top: 'calc(var(--safe-area-top, 12px) + 8px)' }}
                    aria-label="AirPlay"
                >
                    <Airplay size={22} strokeWidth={2.5} />
                </button>
            )}

            {!rotate && (
                <div
                    className="absolute left-5 right-16 z-10 text-left pointer-events-none"
                    style={{ top: 'calc(var(--safe-area-top, 12px) + 12px)' }}
                >
                    <p className="text-white font-black text-lg leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                        {video.title}
                    </p>
                    {video.author && (
                        <p className="text-white/70 text-xs font-bold uppercase tracking-wider drop-shadow">
                            {video.author}
                        </p>
                    )}
                </div>
            )}

            <video
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                controls
                autoPlay
                playsInline
                controlsList="nodownload"
                onLoadedMetadata={recomputeRotation}
                onEnded={onClose}
                className="object-contain bg-black"
                style={rotate
                    ? { width: '100vh', height: '100vw', maxWidth: 'none', transform: 'rotate(90deg)' }
                    : { width: '100%', height: '100%' }}
            />
        </div>
    );

    return createPortal(overlay, document.body);
};

export default MusicVideoOverlay;
