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

// Marquee-style multi-color light bulbs that hug the container's rounded frame.
// Bulbs run along the straight edges AND follow the corner arcs (radius R),
// so they match the container's border-radius instead of cutting the corners.
const BULB_COLORS = ['#ff4d6d', '#ffd60a', '#4cc9f0', '#52ffb8', '#b06bff', '#ff9e3d', '#ff8fd6'];

const FrameLights: React.FC = () => {
    const R = 24; // must match the container's rounded-3xl (1.5rem = 24px)
    const bulbs: React.CSSProperties[] = [];

    // Straight edges between the corner tangent points (calc mixes % and px).
    // Everything is expressed via left/top so the -50%/-50% transform centers each
    // bulb exactly on the frame line.
    const edgePos = (t: number) => `calc(${R}px + ${t} * (100% - ${2 * R}px))`;
    const topBottomN = 6; // segments along each horizontal edge
    const leftRightN = 3; // segments along each vertical edge
    for (let k = 0; k <= topBottomN; k++) {
        const p = edgePos(k / topBottomN);
        bulbs.push({ left: p, top: 0 });
        bulbs.push({ left: p, top: '100%' });
    }
    for (let k = 1; k < leftRightN; k++) {
        const p = edgePos(k / leftRightN);
        bulbs.push({ left: 0, top: p });
        bulbs.push({ left: '100%', top: p });
    }

    // Corner arcs (interior points only; tangent points already covered by edges).
    const cornerN = 2; // interior bulbs per corner
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const cos = Math.cos, sin = Math.sin;
    for (let k = 1; k <= cornerN; k++) {
        const f = k / (cornerN + 1);
        // top-left: 180°→270°
        let a = rad(180 + f * 90);
        bulbs.push({ left: `${R + R * cos(a)}px`, top: `${R + R * sin(a)}px` });
        // top-right: 270°→360°
        a = rad(270 + f * 90);
        bulbs.push({ left: `calc(100% - ${R - R * cos(a)}px)`, top: `${R + R * sin(a)}px` });
        // bottom-right: 0°→90°
        a = rad(0 + f * 90);
        bulbs.push({ left: `calc(100% - ${R - R * cos(a)}px)`, top: `calc(100% - ${R - R * sin(a)}px)` });
        // bottom-left: 90°→180°
        a = rad(90 + f * 90);
        bulbs.push({ left: `${R + R * cos(a)}px`, top: `calc(100% - ${R - R * sin(a)}px)` });
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-20">
            <style>{`@keyframes gkBulbTwinkle{0%,100%{opacity:1;filter:brightness(1.2)}50%{opacity:.25;filter:brightness(.65)}}`}</style>
            {bulbs.map((pos, idx) => {
                const c = BULB_COLORS[idx % BULB_COLORS.length];
                return (
                    <span
                        key={idx}
                        className="absolute w-[7px] h-[7px] rounded-full -translate-x-1/2 -translate-y-1/2"
                        style={{
                            ...pos,
                            background: `radial-gradient(circle, #ffffff 0%, ${c} 55%, ${c}00 100%)`,
                            boxShadow: `0 0 5px 1.5px ${c}F2, 0 0 12px 3px ${c}99`,
                            animation: `gkBulbTwinkle 1.5s ease-in-out ${(idx % 3) * 0.5}s infinite`,
                        }}
                    />
                );
            })}
        </div>
    );
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
                // Cache-bust so a video published in the Portal shows up on next load
                // (webviews/CDNs can otherwise serve a stale feed).
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
          <div className="relative">
            {/* Soft warm halo behind the frame so the bulbs read as glowing lights */}
            <div
                className="pointer-events-none absolute -inset-2 rounded-[32px] blur-2xl opacity-50 animate-pulse"
                style={{ background: 'radial-gradient(ellipse at center, rgba(255,200,90,0.55), rgba(217,70,239,0.25) 60%, transparent 80%)' }}
            />

            <div
                className="relative rounded-3xl p-3 sm:p-4 border-2 border-fuchsia-400/40 overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, #2a1650 0%, #3b1d6e 45%, #1b1030 100%)',
                    boxShadow: '0 0 18px rgba(217,70,239,0.55), 0 0 45px rgba(168,85,247,0.35), 0 10px 40px rgba(120, 40, 200, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
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

            {/* Light bulbs around the frame */}
            <FrameLights />
          </div>

            {activeVideo && (
                <MusicVideoOverlay video={activeVideo} onClose={() => setActiveVideo(null)} />
            )}
        </div>
    );
};

export default MusicVideosShelf;
