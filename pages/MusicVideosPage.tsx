import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Play, Music2, Crown } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { useUser } from '../context/UserContext';
import { getCoverThumb } from '../utils/coverImage';
import MusicVideoOverlay, { MusicVideo } from '../components/audio/MusicVideoOverlay';

const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MusicVideosPage: React.FC = () => {
    const navigate = useNavigate();
    const { isSubscribed } = useUser();
    const [videos, setVideos] = useState<MusicVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVideo, setActiveVideo] = useState<MusicVideo | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const baseUrl = getApiBaseUrl();
                // Cache-bust so newly published videos aren't hidden by a stale cached feed.
                const res = await fetch(`${baseUrl}music-videos?_t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) throw new Error('Failed to load music videos');
                const json = await res.json();
                const list: MusicVideo[] = Array.isArray(json) ? json : (json.data || []);
                if (!cancelled) setVideos(list.filter(v => v.videoUrl));
            } catch (e) {
                if (!cancelled) setVideos([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const openVideo = (video: MusicVideo) => {
        if (!isSubscribed) {
            navigate('/paywall', { state: { from: '/music-videos' } });
            return;
        }
        try {
            const baseUrl = getApiBaseUrl();
            fetch(`${baseUrl}music-videos/${video._id}/increment-view`, { method: 'POST' }).catch(() => {});
        } catch { /* ignore */ }
        setActiveVideo(video);
    };

    return (
        <div
            className="flex flex-col h-full overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1b1030 0%, #2a1650 50%, #1b1030 100%)' }}
        >
            {/* Header */}
            <div
                className="relative flex items-center gap-3 px-4 pb-3"
                style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 12px)' }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
                    aria-label="Back"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="flex items-center gap-2 font-display text-2xl font-black text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg, #FFE066, #FFB347)' }}>
                    <Music2 className="w-6 h-6 text-fuchsia-300" />
                    Music Videos
                </h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-28">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-fuchsia-400" />
                    </div>
                ) : videos.length === 0 ? (
                    <div className="text-center text-white/70 font-display mt-20 p-6 bg-black/20 rounded-2xl">
                        <Music2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        No music videos yet. Check back soon!
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {videos.map((video) => {
                            const dur = formatDuration(video.duration);
                            return (
                                <button
                                    key={video._id}
                                    onClick={() => openVideo(video)}
                                    className="text-left active:scale-95 transition-transform"
                                >
                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/15 shadow-lg">
                                        {video.thumbnailUrl ? (
                                            <img
                                                src={getCoverThumb(video.thumbnailUrl)}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-fuchsia-700 flex items-center justify-center">
                                                <Music2 className="w-8 h-8 text-white/50" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                                        {video.isPopular ? (
                                            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white bg-fuchsia-600/90 shadow-md">
                                                Popular
                                            </span>
                                        ) : video.isNew ? (
                                            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white bg-emerald-500/90 shadow-md">
                                                New
                                            </span>
                                        ) : null}

                                        {dur && (
                                            <span className="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                                                {dur}
                                            </span>
                                        )}

                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm border-2 border-[#FFD700] flex items-center justify-center shadow-[0_0_18px_rgba(255,215,0,0.45)]">
                                                {isSubscribed ? (
                                                    <Play size={20} className="text-white ml-0.5" fill="white" />
                                                ) : (
                                                    <Crown size={18} className="text-[#FFD700]" fill="#FFD700" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-white text-xs font-bold mt-1.5 truncate">{video.title}</p>
                                    {video.author && (
                                        <p className="text-white/55 text-[10px] truncate">{video.author}</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {activeVideo && (
                <MusicVideoOverlay video={activeVideo} onClose={() => setActiveVideo(null)} />
            )}
        </div>
    );
};

export default MusicVideosPage;
