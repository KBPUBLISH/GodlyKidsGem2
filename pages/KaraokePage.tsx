import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PremiumBadge from '../components/ui/PremiumBadge';
import { useUser } from '../context/UserContext';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { authService } from '../services/authService';
import { Mic, Lock, ArrowLeft, Library, Play, Share2 } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';

interface KaraokeRecording {
  _id: string;
  karaokeSongId: { title: string; coverImage?: string } | null;
  mixedAudioUrl: string;
  customCoverImageUrl?: string | null;
  duration?: number;
  recordedAt?: string;
}

interface KaraokeSong {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  videoUrl?: string;
  backgroundAudioUrl?: string;
  duration?: number;
  isMembersOnly?: boolean;
  viewCount?: number;
}

const KaraokePage: React.FC = () => {
  const navigate = useNavigate();
  const { isSubscribed } = useUser();
  const [songs, setSongs] = useState<KaraokeSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRecordings, setMyRecordings] = useState<KaraokeRecording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      const userId = authService.getUserIdForBackend();
      if (!userId) {
        setRecordingsLoading(false);
        return;
      }
      try {
        const base = getMonthlyBookBaseUrl();
        const res = await fetch(`${base}/karaoke/recordings/list?userId=${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => ({}));
        setMyRecordings(data.data || []);
      } catch {
        setMyRecordings([]);
      } finally {
        setRecordingsLoading(false);
      }
    };
    fetchRecordings();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setError(null);
        const base = getMonthlyBookBaseUrl();
        const res = await fetch(`${base}/karaoke?limit=50`);
        if (!res.ok) throw new Error('Failed to load karaoke songs');
        const data = await res.json();
        setSongs(data.data || []);
      } catch (err) {
        console.error('Karaoke fetch error:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setSongs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  const handleSongClick = (song: KaraokeSong) => {
    const isLocked = song.isMembersOnly && !isSubscribed;
    if (isLocked) {
      navigate('/paywall', { state: { from: '/karaoke' } });
      return;
    }
    navigate(`/karaoke/${song._id}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-blue-400">
      <div className="flex items-center gap-2 px-4 pt-2 pb-2" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
        <button
          onClick={() => navigate('/listen')}
          className="flex items-center gap-2 text-white/90 hover:text-white transition-colors font-display text-sm active:scale-95"
          aria-label="Back to Listen"
        >
          <ArrowLeft size={22} />
          <span>Back</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Ocean wave accent */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
          <svg className="absolute opacity-30" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '10%', height: '12%', width: '200%' }}>
            <path fill="rgba(255,255,255,0.15)" d="M0,280L60,274C120,268,240,256,360,250C480,244,600,244,720,250C840,256,960,268,1080,274C1200,280,1320,280,1440,274L2880,268L2880,320L0,320Z" />
          </svg>
        </div>

        <div className="relative z-10 px-4 pt-4 pb-24">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-6 h-6 text-white/90" />
            <h2 className="text-lg font-display font-bold text-white drop-shadow-md">
              Sing along with worship songs
            </h2>
          </div>

          {myRecordings.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Library className="w-5 h-5 text-white/90" />
                <h3 className="text-base font-display font-bold text-white drop-shadow-md">
                  My karaoke songs
                </h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {myRecordings.map((rec) => (
                  <div
                    key={rec._id}
                    className="flex-shrink-0 w-36 rounded-xl overflow-hidden bg-white/10 border border-white/20"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/karaoke/share/${rec._id}`)}
                      className="w-full text-left block"
                    >
                      <div className="aspect-square relative bg-gradient-to-br from-violet-700 to-purple-800">
                        {(rec.customCoverImageUrl || rec.karaokeSongId?.coverImage) ? (
                          <img
                            src={rec.customCoverImageUrl || rec.karaokeSongId!.coverImage}
                            alt={rec.karaokeSongId?.title || 'Recording'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Mic className="w-10 h-10 text-white/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                          <Play size={28} className="text-white drop-shadow-lg" fill="currentColor" />
                        </div>
                      </div>
                      <p className="text-white text-xs font-display font-bold truncate px-2 py-1.5">
                        {rec.karaokeSongId?.title || 'My recording'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}${window.location.pathname || '/'}#/karaoke/share/${rec._id}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                      }}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-white/80 hover:text-white text-xs font-display"
                    >
                      <Share2 size={14} />
                      Share
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {error ? (
            <StormySeaError
              onRetry={() => window.location.reload()}
              message={error}
            />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-3 border-white/50 border-t-white rounded-full animate-spin" />
              <p className="text-white/80 font-display mt-4">Loading songs...</p>
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Mic className="w-12 h-12 text-white/60 mx-auto mb-3" />
              <p className="text-white/90 font-display font-bold">No karaoke songs yet</p>
              <p className="text-white/70 font-display text-sm mt-1">
                Check back soon for new songs to sing along with!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {songs.map((song) => {
                const isLocked = song.isMembersOnly && !isSubscribed;
                return (
                  <button
                    key={song._id}
                    type="button"
                    onClick={() => handleSongClick(song)}
                    className="w-full cursor-pointer select-none focus:outline-none group text-left"
                  >
                    <div
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 border-white/30 shadow-lg group-hover:border-white/50 group-hover:scale-[1.02] transition-all ${isLocked ? 'opacity-85' : ''}`}
                    >
                      {song.coverImage ? (
                        <img
                          src={song.coverImage}
                          alt={song.title}
                          className={`w-full h-full object-cover ${isLocked ? 'brightness-75' : ''}`}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 ${isLocked ? 'brightness-75' : ''}`}
                        >
                          <Mic className="w-12 h-12 text-white/50" />
                        </div>
                      )}
                      {isLocked && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                          <div className="bg-black/70 rounded-full p-2 border-2 border-[#FFD700]">
                            <Lock size={18} className="text-[#FFD700]" />
                          </div>
                        </div>
                      )}
                      {song.isMembersOnly && !isSubscribed && (
                        <PremiumBadge className="absolute top-1.5 right-1.5 z-20" />
                      )}
                    </div>
                    <p className="text-white text-sm font-display font-bold mt-2 truncate drop-shadow-md">
                      {song.title}
                    </p>
                    {song.duration && song.duration > 0 && (
                      <p className="text-white/70 text-xs font-display">
                        {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KaraokePage;
