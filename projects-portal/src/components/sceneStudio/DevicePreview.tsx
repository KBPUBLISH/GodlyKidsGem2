import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { DEVICE_FRAME, type SceneDevice, type ScenePreviewMode } from './types';

interface DevicePreviewProps {
    device: SceneDevice;
    mode: ScenePreviewMode;
    videoUrl: string;
    /** Title shown in the wood header bar (kid app scene title). */
    sceneTitle?: string;
    children?: React.ReactNode;
}

/**
 * Phone/tablet chrome with object-fit:cover video (matches kid app island scene).
 */
const DevicePreview: React.FC<DevicePreviewProps> = ({
    device,
    mode,
    videoUrl,
    sceneTitle = '',
    children,
}) => {
    const frame = DEVICE_FRAME[device];
    const hasVideo = !!videoUrl.trim();
    const title = sceneTitle.trim() || 'SCENE TITLE';
    const videoRef = useRef<HTMLVideoElement>(null);
    const [soundOn, setSoundOn] = useState(false);

    useEffect(() => {
        setSoundOn(false);
    }, [videoUrl, mode]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = !soundOn;
        if (soundOn && el.paused) {
            void el.play().catch(() => {
                /* ignore */
            });
        }
    }, [soundOn]);

    return (
        <div
            className="relative bg-black shadow-xl mx-auto"
            style={{
                width: frame.width,
                height: frame.height,
                borderRadius: frame.borderRadius,
                border: '10px solid #1f2937',
                boxShadow:
                    '0 12px 40px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
                overflow: 'hidden',
            }}
        >
            {device === 'phone' && (
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                    style={{ width: 88, height: 18 }}
                    aria-hidden
                />
            )}
            {hasVideo ? (
                <video
                    ref={videoRef}
                    key={`${mode}-${videoUrl}`}
                    src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted={!soundOn}
                    loop={mode === 'scene'}
                    playsInline
                    autoPlay
                    preload="auto"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a4a28] text-white/70 px-4 text-center text-xs">
                    <p>No {mode === 'intro' ? 'intro' : 'scene BG'} video</p>
                    <p className="text-white/40">Upload above to preview</p>
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35 pointer-events-none" />
            {/* Wood header title bar (matches IslandScenePage) */}
            <div
                className="absolute left-0 right-0 z-[15] pointer-events-none"
                style={{
                    top: device === 'phone' ? 22 : 0,
                    background:
                        'linear-gradient(180deg, #8B6914 0%, #6B4423 55%, #5c3a1a 100%)',
                    borderBottom: '2px solid #5c3a1a',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
                    padding: '6px 10px',
                }}
            >
                <p
                    className="text-center font-bold text-white text-[11px] tracking-wide truncate px-1"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
                >
                    {title}
                </p>
            </div>
            {hasVideo && (
                <button
                    type="button"
                    onClick={() => setSoundOn((v) => !v)}
                    className="absolute z-30 flex items-center justify-center w-8 h-8 rounded-full bg-black/55 border border-white/30 text-white hover:bg-black/70"
                    style={{
                        top: device === 'phone' ? 48 : 36,
                        right: 10,
                    }}
                    title={soundOn ? 'Mute video' : 'Unmute video'}
                    aria-label={soundOn ? 'Mute video' : 'Unmute video'}
                >
                    {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
            )}
            {/* Overlay canvas layer */}
            <div className="absolute inset-0 z-10">{children}</div>
        </div>
    );
};

export default DevicePreview;
