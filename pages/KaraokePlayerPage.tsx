import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { ArrowLeft, Play, Pause } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';

interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
}

interface KaraokeSong {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  videoUrl?: string;
  backgroundAudioUrl?: string;
  duration?: number;
  lyrics: LyricLine[];
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const KaraokePlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<KaraokeSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  const hasVideo = !!song?.videoUrl;
  const mediaSrc = hasVideo ? song?.videoUrl : song?.backgroundAudioUrl;

  useEffect(() => {
    if (!id) return;
    const fetchSong = async () => {
      try {
        setError(null);
        const base = getMonthlyBookBaseUrl();
        const res = await fetch(`${base}/karaoke/${id}`);
        if (!res.ok) throw new Error('Song not found');
        const data = await res.json();
        setSong(data);
        setDuration(data.duration || 0);
      } catch (err) {
        console.error('Karaoke song fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load song');
      } finally {
        setLoading(false);
      }
    };
    fetchSong();
  }, [id]);

  useEffect(() => {
    if (!song) return;
    const base = getMonthlyBookBaseUrl();
    fetch(`${base}/karaoke/${id}/increment-view`, { method: 'POST' }).catch(() => {});
  }, [song?._id, id]);

  const mediaRef = hasVideo ? videoRef : audioRef;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => setDuration(el.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [mediaRef, song]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentTime, song?.lyrics]);

  const handlePlayPause = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = mediaRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * duration;
  };

  const currentLineIndex = song?.lyrics?.findIndex(
    (l) => currentTime >= l.startTime && currentTime <= l.endTime
  ) ?? -1;

  if (loading || (!song && !error)) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-2 px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-white/50 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-2 px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <StormySeaError
            onRetry={() => window.location.reload()}
            message={error || 'Song not found'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
        <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
          <ArrowLeft size={22} /> <span>Back</span>
        </button>
        <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center">{song.title}</h1>
        <div className="w-14" />
      </div>

      {/* Media: video or audio (hidden, or show cover for audio) */}
      <div className="relative w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: '40vh' }}>
        {hasVideo ? (
          <video
            ref={videoRef}
            src={song.videoUrl}
            className="w-full h-full object-contain"
            playsInline
            onClick={handlePlayPause}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-900 to-purple-950">
            {song.coverImage ? (
              <img
                src={song.coverImage}
                alt={song.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-white/50 text-6xl">♪</div>
            )}
          </div>
        )}
        {!hasVideo && (
          <audio ref={audioRef} src={song.backgroundAudioUrl} playsInline />
        )}
      </div>

      {/* Lyrics */}
      <div
        ref={lyricsContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 min-h-0"
      >
        <div className="max-w-xl mx-auto">
          {song.lyrics && song.lyrics.length > 0 ? (
            song.lyrics.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isPast = idx < currentLineIndex;
              return (
                <p
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  className={`py-1.5 text-lg font-display transition-all duration-200 ${
                    isActive
                      ? 'text-[#FFD700] font-bold scale-105'
                      : isPast
                        ? 'text-white/50'
                        : 'text-white/80'
                  }`}
                >
                  {line.text}
                </p>
              );
            })
          ) : (
            <p className="text-white/60 text-center py-8">No lyrics available</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-t from-black to-transparent pt-6 pb-8 px-4 safe-area-bottom">
        <div className="max-w-xl mx-auto">
          <div
            className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-4"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all duration-75"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/60 mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handlePlayPause}
              className="w-14 h-14 rounded-full bg-[#FFD700] flex items-center justify-center text-black shadow-lg active:scale-95 hover:bg-[#FFE44D] transition-all"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KaraokePlayerPage;
