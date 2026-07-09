import React from 'react';
import { X } from 'lucide-react';

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
    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black animate-in fade-in duration-200">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ top: 'calc(var(--safe-area-top, 12px) + 8px)' }}
                aria-label="Close video"
            >
                <X size={24} strokeWidth={2.5} />
            </button>

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

            <video
                src={video.videoUrl}
                poster={video.thumbnailUrl}
                controls
                autoPlay
                playsInline
                controlsList="nodownload"
                onEnded={onClose}
                className="w-full h-full object-contain bg-black"
            />
        </div>
    );
};

export default MusicVideoOverlay;
