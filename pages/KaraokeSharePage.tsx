import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { ArrowLeft, Play, Pause } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';

interface ShareData {
  mixedAudioUrl: string;
  duration: number;
  recordedAt?: string;
  song?: { title: string; coverImage?: string };
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const KaraokeSharePage: React.FC = () => {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!recordingId) return;
    const fetchData = async () => {
      try {
        setError(null);
        const base = getMonthlyBookBaseUrl();
        const res = await fetch(`${base}/karaoke/share/${recordingId}`);
        if (!res.ok) throw new Error('Recording not found');
        const json = await res.json();
        setData(json);
        setDuration(json.duration || 0);
      } catch (err) {
        console.error('Share fetch error:', err);
        setError(err instanceof Error ? err.message : 'Recording not found');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [recordingId]);

  useEffect(() => {
    const el = audioRef.current;
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
  }, [data?.mixedAudioUrl]);

  const handlePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play().catch(() => {});
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * duration;
  };

  if (loading || (!data && !error)) {
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

  if (error || !data) {
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
            message={error || 'Recording not found'}
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
        <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center">
          {data.song?.title || 'Shared karaoke'}
        </h1>
        <div className="w-14" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div
          className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-violet-900 to-purple-950 flex items-center justify-center"
          style={{ maxHeight: '40vh' }}
        >
          {data.song?.coverImage ? (
            <img src={data.song.coverImage} alt={data.song.title} className="w-full h-full object-contain" />
          ) : (
            <span className="text-white/50 text-6xl">♪</span>
          )}
        </div>
        <p className="text-white/80 font-display mt-4 text-center">Music + voice recording</p>
      </div>

      <audio ref={audioRef} src={data.mixedAudioUrl} preload="metadata" />

      <div className="bg-gradient-to-t from-black to-transparent pt-6 pb-8 px-4 safe-area-bottom">
        <div className="max-w-xl mx-auto">
          <div
            className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-4"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all"
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
              className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300 via-[#FFD700] to-amber-500 text-black shadow-[0_4px_20px_rgba(251,191,36,0.4)] active:scale-95"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KaraokeSharePage;
