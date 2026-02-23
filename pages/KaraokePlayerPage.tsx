import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { authService } from '../services/authService';
import { ArrowLeft, Play, Pause, Mic, Save, Share2, Check, ImagePlus, RotateCcw } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';
import SelfieCapture from '../components/features/SelfieCapture';
import { playWithReverb, getReverbLabel, type ReverbLevel } from '../utils/reverbUtils';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlayingMyTake, setIsPlayingMyTake] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncOffset, setSyncOffset] = useState(0);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [reverbLevel, setReverbLevel] = useState<ReverbLevel>(0);
  const voiceControllerRef = useRef<{ stop: () => void } | null>(null);
  const myTakeMusicRef = useRef<HTMLAudioElement | null>(null);
  const myTakeVoiceRef = useRef<HTMLAudioElement | null>(null);
  const myTakeUsedMainRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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
  const stopRecordingRef = useRef<() => void>(() => {});

  const playheadSourceRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onDurationChange = () => setDuration(el.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (typeof stopRecordingRef.current === 'function') stopRecordingRef.current();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [mediaRef, song]);

  useEffect(() => {
    playheadSourceRef.current = mediaRef.current;
    return () => { playheadSourceRef.current = null; };
  }, [mediaRef, song]);

  // requestAnimationFrame for smooth lyrics sync (60fps vs timeupdate's ~4Hz)
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const src = playheadSourceRef.current ?? mediaRef.current;
      if (src) setCurrentTime(src.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mediaRef]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentTime, song?.lyrics]);

  const handleMicPress = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isRecording) {
      handleStopRecording();
      el.pause();
    } else {
      const ok = await handleStartRecording();
      if (ok) el.play().catch(() => {});
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

  const handleStartRecording = async (): Promise<boolean> => {
    setMicError(null);
    setSavedRecordingId(null);
    setSaveError(null);
    setCustomCoverUrl(null);
    setCoverError(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      stopRecordingRef.current = () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
          mediaRecorderRef.current = null;
          setIsRecording(false);
        }
      };
      return true;
    } catch (err) {
      console.error('Mic access failed:', err);
      setMicError('Microphone access is needed to record. Please allow it in your browser settings.');
      return false;
    }
  };

  const handleStopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    rec.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const handleStopMyTake = () => {
    const music = myTakeMusicRef.current;
    const main = mediaRef.current;
    if (music) {
      music.pause();
      music.currentTime = 0;
      myTakeMusicRef.current = null;
    }
    voiceControllerRef.current?.stop();
    voiceControllerRef.current = null;
    myTakeVoiceRef.current = null;
    if (main && myTakeUsedMainRef.current) {
      main.pause();
      main.currentTime = 0;
      main.volume = 1;
      myTakeUsedMainRef.current = false;
    }
    playheadSourceRef.current = mediaRef.current;
    setIsPlayingMyTake(false);
  };

  const handlePlayRecording = async () => {
    if (!recordedUrl || !song) return;
    if (isPlayingMyTake) {
      handleStopMyTake();
      return;
    }
    const done = () => setIsPlayingMyTake(false);
    myTakeUsedMainRef.current = false;
    if (song.backgroundAudioUrl) {
      const musicEl = new Audio(song.backgroundAudioUrl);
      musicEl.volume = 0.45;
      musicEl.currentTime = 0;
      musicEl.addEventListener('ended', done, { once: true });
      musicEl.play().catch(() => {});
      myTakeMusicRef.current = musicEl;
      playheadSourceRef.current = musicEl;
    } else {
      const el = mediaRef.current;
      if (el) {
        myTakeUsedMainRef.current = true;
        playheadSourceRef.current = el;
        el.volume = 0.45;
        el.currentTime = 0;
        el.play().catch(() => {});
      }
    }
    try {
      const controller = await playWithReverb(recordedUrl, reverbLevel, 1, done);
      voiceControllerRef.current = controller;
    } catch (e) {
      console.error('Play with reverb failed:', e);
    }
    setIsPlayingMyTake(true);
  };

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      handleStopMyTake();
    };
  }, [recordedUrl]);

  const handleSaveAndShare = async () => {
    if (!recordedUrl || !song || !id || !song.backgroundAudioUrl) return;
    setSaveError(null);
    setSavingRecording(true);
    try {
      const base = getMonthlyBookBaseUrl();
      const blob = await fetch(recordedUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('recording', blob, 'recording.webm');
      form.append('karaokeSongId', id);
      form.append('reverbLevel', String(reverbLevel));
      const mixRes = await fetch(`${base}/karaoke/mix`, {
        method: 'POST',
        body: form,
      });
      if (!mixRes.ok) {
        const err = await mixRes.json().catch(() => ({}));
        throw new Error(err.message || 'Mixing failed');
      }
      const mixData = await mixRes.json();
      const mixedAudioUrl = mixData.mixedAudioUrl;
      const mixDuration = mixData.duration ?? duration ?? 0;

      const userId = authService.getUserIdForBackend();
      const saveRes = await fetch(`${base}/karaoke/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || undefined,
          karaokeSongId: id,
          mixedAudioUrl,
          duration: mixDuration,
          ...(customCoverUrl && { customCoverImageUrl: customCoverUrl }),
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.message || 'Save failed');
      }
      const saved = await saveRes.json();
      setSavedRecordingId(saved._id);
    } catch (err) {
      console.error('Save recording error:', err);
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingRecording(false);
    }
  };

  const shareUrl = savedRecordingId
    ? `${window.location.origin}${window.location.pathname || '/'}#/karaoke/share/${savedRecordingId}`
    : null;

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {}
  };

  const handleAlbumCoverCapture = async (imageBase64: string) => {
    setShowSelfieModal(false);
    if (!song?.title) return;
    setCoverError(null);
    setGeneratingCover(true);
    try {
      const base = getMonthlyBookBaseUrl();
      const res = await fetch(`${base}/karaoke/album-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfieBase64: imageBase64, songTitle: song.title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not create album cover');
      }
      const data = await res.json();
      setCustomCoverUrl(data.imageUrl || null);
    } catch (err) {
      console.error('Album cover error:', err);
      setCoverError(err instanceof Error ? err.message : 'Could not create album cover');
    } finally {
      setGeneratingCover(false);
    }
  };

  const canSave = !!recordedUrl && !!song?.backgroundAudioUrl && !savingRecording && !savedRecordingId;

  const effectiveTime = currentTime + syncOffset;
  const currentLineIndex = song?.lyrics?.findIndex(
    (l) => effectiveTime >= l.startTime && effectiveTime <= l.endTime
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

  const handleRecordAgain = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setSavedRecordingId(null);
    setCustomCoverUrl(null);
    setSaveError(null);
    setCoverError(null);
    setReverbLevel(0);
    handleStopMyTake();
  };

  // Post-recording review screen — like a new page
  if (recordedUrl && !isRecording) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
          <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center">Your recording</h1>
          <div className="w-14" />
        </div>

        {/* Keep media refs mounted for "My take" playback (video songs use main media) */}
        {hasVideo ? (
          <video ref={videoRef} src={song.videoUrl} className="hidden" />
        ) : (
          <audio ref={audioRef} src={song.backgroundAudioUrl} className="hidden" />
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 min-h-0">
          <p className="text-white/80 font-display text-center mb-4">{song.title}</p>
          <button
            onClick={handlePlayRecording}
            className="relative w-56 aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-violet-900 to-purple-950 border-2 border-white/20 shadow-xl active:scale-[0.98] transition-transform"
          >
            {(customCoverUrl || song.coverImage) ? (
              <img
                src={customCoverUrl || song.coverImage}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white/50 text-6xl">♪</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                  isPlayingMyTake
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/90 text-black'
                }`}
              >
                {isPlayingMyTake ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" className="ml-1" />
                )}
              </span>
            </div>
          </button>
          {isPlayingMyTake && (
            <p className="text-emerald-400 text-sm font-display mt-3">Playing your take</p>
          )}

          <div className="w-full max-w-xs mt-6">
            <div
              className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-2"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
            <div className="flex items-center justify-between">
              <span className="text-white/80 font-display text-sm">Reverb</span>
              <div className="flex gap-1">
                {([0, 1, 2, 3] as ReverbLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setReverbLevel(level)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display transition-all ${
                      reverbLevel === level
                        ? 'bg-amber-500/80 text-black'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {level === 0 ? 'Off' : getReverbLabel(level)}
                  </button>
                ))}
              </div>
            </div>

            {canSave && (
              <>
                <button
                  onClick={() => setShowSelfieModal(true)}
                  disabled={generatingCover}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white/10 text-white font-display font-bold text-sm border border-white/30 hover:bg-white/20 active:scale-[0.98] disabled:opacity-70"
                >
                  {generatingCover ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <ImagePlus size={20} />
                      {customCoverUrl ? 'Change album cover' : 'Create album cover'}
                    </>
                  )}
                </button>
                {customCoverUrl && (
                  <div className="flex justify-center">
                    <img src={customCoverUrl} alt="Cover" className="w-16 h-16 rounded-lg object-cover border-2 border-emerald-500/50" />
                  </div>
                )}
                <button
                  onClick={handleSaveAndShare}
                  disabled={savingRecording}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-display font-bold text-sm shadow-lg active:scale-[0.98] disabled:opacity-70"
                >
                  {savingRecording ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Save to my library
                    </>
                  )}
                </button>
              </>
            )}
            {savedRecordingId && shareUrl && (
              <>
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-display font-bold text-sm py-2">
                  <Check size={20} />
                  Saved!
                </div>
                <button
                  onClick={handleCopyShareLink}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white/10 text-white font-display font-bold text-sm border border-white/30 hover:bg-white/20 active:scale-[0.98]"
                >
                  <Share2 size={20} />
                  Copy share link
                </button>
              </>
            )}
            {coverError && <p className="text-amber-400 text-xs text-center">{coverError}</p>}
            {saveError && <p className="text-amber-400 text-xs text-center">{saveError}</p>}
            {!song?.backgroundAudioUrl && (
              <p className="text-white/50 text-xs text-center">Save is available for audio songs only</p>
            )}

            <button
              onClick={handleRecordAgain}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white/70 font-display text-sm hover:text-white/90 active:scale-[0.98] mt-2"
            >
              <RotateCcw size={18} />
              Record again
            </button>
          </div>
        </div>

        <SelfieCapture
          isOpen={showSelfieModal}
          onCapture={handleAlbumCoverCapture}
          onClose={() => setShowSelfieModal(false)}
          childName="you"
        />
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
            onClick={handleMicPress}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-900 to-purple-950 cursor-pointer"
            onClick={handleMicPress}
          >
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
      <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
        <div className="max-w-xl mx-auto text-center">
          {song.lyrics && song.lyrics.length > 0 ? (
            song.lyrics.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isPast = idx < currentLineIndex;
              return (
                <p
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  className={`py-1.5 text-lg font-display transition-all duration-200 text-center ${
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
          <div className="flex items-center justify-between gap-2 text-sm text-white/60 mb-4">
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-1">
              {syncOffset !== 0 && (
                <span className="text-amber-400/90 text-xs">Sync {syncOffset > 0 ? '+' : ''}{syncOffset.toFixed(1)}s</span>
              )}
              <button
                type="button"
                onClick={() => setSyncOffset((s) => Math.max(-2, s - 0.3))}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-xs font-display"
                aria-label="Lyrics earlier"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setSyncOffset((s) => Math.min(2, s + 0.3))}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-xs font-display"
                aria-label="Lyrics later"
              >
                +
              </button>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
          {micError && (
            <p className="text-amber-400 text-xs text-center mb-2">{micError}</p>
          )}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleMicPress}
              className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 ${
                isRecording
                  ? 'bg-red-600 text-white shadow-[0_0_24px_rgba(220,38,38,0.9)] ring-4 ring-red-400/60 animate-pulse'
                  : 'bg-gradient-to-br from-amber-300 via-[#FFD700] to-amber-500 text-black shadow-[0_4px_20px_rgba(251,191,36,0.4)] hover:shadow-[0_4px_24px_rgba(251,191,36,0.5)] hover:from-amber-200 hover:via-[#FFE44D] hover:to-amber-400'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start singing (record)'}
            >
              <Mic size={32} strokeWidth={2.5} className={isRecording ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]' : ''} />
            </button>
          </div>
          {isRecording && (
            <p className="text-red-400 text-xs text-center mt-2 font-display">Recording…</p>
          )}
        </div>
      </div>

      <SelfieCapture
        isOpen={showSelfieModal}
        onCapture={handleAlbumCoverCapture}
        onClose={() => setShowSelfieModal(false)}
        childName="you"
      />
    </div>
  );
};

export default KaraokePlayerPage;
