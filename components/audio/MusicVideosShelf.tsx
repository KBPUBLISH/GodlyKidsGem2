import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronRight, Music2, Crown } from 'lucide-react';
import { getApiBaseUrl } from '../../services/apiService';
import { useUser } from '../../context/UserContext';
import { getCoverThumb } from '../../utils/coverImage';
import MusicVideoOverlay, { MusicVideo } from './MusicVideoOverlay';

const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const Badge: React.FC<{ video: MusicVideo }> = ({ video }) => {
    if (video.isPopular) {
        return (
            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white bg-fuchsia-600/90 shadow-md">
                Popular
            </span>
        );
    }
    if (video.isNew) {
        return (
            <span className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-white bg-emerald-500/90 shadow-md">
                New
            </span>
        );
    }
    return null;
};

const MusicVideosShelf: React.FC = () => {
    const navigate = useNavigate();
    const { isSubscribed } = useUser();
    const [videos, setVideos] = useState<MusicVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVideo, setActiveVideo] = useState<MusicVideo | null>(null);
    const [heroIndex, setHeroIndex] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const baseUrl = getApiBaseUrl();
                const res = await fetch(`${baseUrl}music-videos`);
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

    // Featured videos rotate through the hero slot; if none are flagged featured,
    // rotate through everything.
    const featured = videos.filter(v => v.isFeatured);
    const heroPool = featured.length > 0 ? featured : videos;
    const rest = (featured.length > 0 ? videos.filter(v => !v.isFeatured) : videos.slice(1)).slice(0, 8);

    // Auto-advance the hero carousel
    const heroPoolLen = heroPool.length;
    const advanceRef = useRef<number | null>(null);
    useEffect(() => {
        if (heroPoolLen <= 1) return;
        advanceRef.current = window.setInterval(() => {
            setHeroIndex(i => (i + 1) % heroPoolLen);
        }, 6000);
        return () => {
            if (advanceRef.current) window.clearInterval(advanceRef.current);
        };
    }, [heroPoolLen]);

    const openVideo = (video: MusicVideo) => {
        // Music videos are a members-only perk
        if (!isSubscribed) {
            navigate('/paywall', { state: { from: '/listen' } });
            return;
        }
        // Fire-and-forget view count
        try {
            const baseUrl = getApiBaseUrl();
            fetch(`${baseUrl}music-videos/${video._id}/increment-view`, { method: 'POST' }).catch(() => {});
        } catch { /* ignore */ }
        setActiveVideo(video);
    };

    if (loading || heroPoolLen === 0) return null;

    const hero = heroPool[heroIndex % heroPoolLen];

    return (
        <div className="mb-5 px-3">
            <div
                className="relative rounded-3xl p-3 sm:p-4 border-2 border-fuchsia-400/40 overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, #2a1650 0%, #3b1d6e 45%, #1b1030 100%)',
                    boxShadow: '0 10px 40px rgba(120, 40, 200, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
            >
                {/* Title */}
                <div className="flex items-center justify-center gap-2 mb-3">
                    <Music2 className="w-5 h-5 text-fuchsia-300" />
                    <h3
                        className="font-display text-xl sm:text-2xl font-black tracking-wide text-transparent bg-clip-text"
                        style={{ backgroundImage: 'linear-gradient(90deg, #FFE066, #FFB347)' }}
                    >
                        Music Videos
                    </h3>
                    <Music2 className="w-5 h-5 text-fuchsia-300" />
                </div>

                {/* Hero (rotating featured carousel) */}
                <button
                    key={hero._id}
                    onClick={() => openVideo(hero)}
                    className="group relative w-full aspect-video rounded-2xl overflow-hidden border border-fuchsia-300/30 shadow-lg active:scale-[0.99] transition-transform animate-in fade-in duration-700"
                >
                    {hero.thumbnailUrl ? (
                        <img
                            src={getCoverThumb(hero.thumbnailUrl)}
                            alt={hero.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-fuchsia-700 flex items-center justify-center">
                            <Music2 className="w-12 h-12 text-white/60" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                    {/* Play button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm border-[3px] border-[#FFD700] flex items-center justify-center shadow-[0_0_25px_rgba(255,215,0,0.5)] group-hover:scale-110 transition-transform">
                            <Play size={30} className="text-white ml-1" fill="white" />
                        </div>
                    </div>

                    {/* Bottom info + Watch Now */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
                        <div className="text-left min-w-0">
                            <p className="text-white font-black text-base sm:text-lg leading-tight truncate drop-shadow">
                                {hero.title}
                            </p>
                            {hero.author && (
                                <p className="text-white/70 text-xs font-bold truncate">{hero.author}</p>
                            )}
                        </div>
                        <span
                            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-sm font-bold shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                        >
                            {!isSubscribed && <Crown size={14} className="text-[#FFD700]" fill="#FFD700" />}
                            <Play size={14} fill="white" />
                            Watch Now
                        </span>
                    </div>
                </button>

                {/* Carousel dots */}
                {heroPoolLen > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                        {heroPool.map((v, i) => (
                            <button
                                key={v._id}
                                onClick={() => setHeroIndex(i)}
                                aria-label={`Show video ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${i === heroIndex % heroPoolLen ? 'w-5 bg-[#FFD700]' : 'w-1.5 bg-white/30'}`}
                            />
                        ))}
                    </div>
                )}

                {/* Row of other videos */}
                {rest.length > 0 && (
                    <div className="flex gap-2.5 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
                        {rest.map((video) => {
                            const dur = formatDuration(video.duration);
                            return (
                                <button
                                    key={video._id}
                                    onClick={() => openVideo(video)}
                                    className="shrink-0 w-[128px] text-left active:scale-95 transition-transform"
                                >
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/15 shadow-md">
                                        {video.thumbnailUrl ? (
                                            <img
                                                src={getCoverThumb(video.thumbnailUrl)}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-fuchsia-700 flex items-center justify-center">
                                                <Music2 className="w-6 h-6 text-white/50" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <Badge video={video} />
                                        {dur && (
                                            <span className="absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                                                {dur}
                                            </span>
                                        )}
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

                {/* Explore All */}
                <button
                    onClick={() => navigate('/music-videos')}
                    className="mt-3 w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-black/25 border border-white/10 text-white active:scale-[0.99] transition-transform hover:bg-black/35"
                >
                    <span className="flex items-center gap-2 font-display font-bold text-sm">
                        <Music2 className="w-4 h-4 text-fuchsia-300" />
                        Explore All Music Videos
                    </span>
                    <ChevronRight className="w-5 h-5 text-white/70" />
                </button>
            </div>

            {activeVideo && (
                <MusicVideoOverlay video={activeVideo} onClose={() => setActiveVideo(null)} />
            )}
        </div>
    );
};

export default MusicVideosShelf;
