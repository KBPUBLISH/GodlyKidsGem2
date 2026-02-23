import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { authService } from '../services/authService';
import { useUser } from '../context/UserContext';
import { ArrowLeft, Play, Pause, Mic, Save, Share2, Check, ImagePlus, RotateCcw, Pencil, Music, Disc } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';
import SelfieCapture from '../components/features/SelfieCapture';
import { prepareVoicePlayback, getReverbLabel, type ReverbLevel } from '../utils/reverbUtils';

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
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const KaraokePlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { kids, currentProfileId, updateKid, parentName, setParentName } = useUser();
  const [song, setSong] = useState<KaraokeSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlayingMyTake, setIsPlayingMyTake] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  const [savedRecordingId, setSavedRecordingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncOffset, setSyncOffset] = useState(0);
  const [masterCreated, setMasterCreated] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [mixDuration, setMixDuration] = useState(0);
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isEditingArtistName, setIsEditingArtistName] = useState(false);
  const [artistNameInput, setArtistNameInput] = useState('');

  const currentKid = kids?.find((k: any) => k.id === currentProfileId);
  const artistName = currentKid?.name || parentName || 'Artist';
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
  const mixedAudioRef = useRef<HTMLAudioElement | null>(null);

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
        const d = data.duration;
        setDuration(typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : 0);
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

    const onDurationChange = () => {
      const d = el.duration;
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) setDuration(d);
    };
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

  const isPlayingMyTakeRef = useRef(false);
  useEffect(() => {
    isPlayingMyTakeRef.current = isPlayingMyTake;
  }, [isPlayingMyTake]);

  useEffect(() => {
    if (!isPlayingMyTake) playheadSourceRef.current = mediaRef.current;
    return () => { if (!isPlayingMyTakeRef.current) playheadSourceRef.current = null; };
  }, [mediaRef, song, isPlayingMyTake]);

  // requestAnimationFrame for smooth lyrics sync (60fps vs timeupdate's ~4Hz)
  // When playing My Take, use elapsed time capped at recording duration
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (isPlayingMyTakeRef.current) {
        const elapsed = (performance.now() - myTakeStartRef.current) / 1000;
        const cap = myTakeDurationRef.current || 999;
        setCurrentTime(Math.min(elapsed, cap));
      } else {
        const src = playheadSourceRef.current ?? mediaRef.current;
        if (src) setCurrentTime(src.currentTime);
      }
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
    if (isPlayingMyTake) return;
    const el = masterCreated && mixedAudioRef.current ? mixedAudioRef.current : mediaRef.current;
    const dur = masterCreated ? mixDuration : duration;
    if (!el || typeof dur !== 'number' || !Number.isFinite(dur) || dur <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = pct * dur;
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

  const myTakeStartRef = useRef<number>(0);
  const myTakeDurationRef = useRef<number>(0);

  const handlePlayRecording = async () => {
    if (isPlayingMyTake) {
      handleStopMyTake();
      return;
    }
    if (masterCreated && mixedAudioUrl) {
      let audio = mixedAudioRef.current;
      if (!audio || audio.src !== mixedAudioUrl) {
        audio = new Audio(mixedAudioUrl);
        mixedAudioRef.current = audio;
      }
      myTakeMusicRef.current = audio;
      playheadSourceRef.current = audio;
      myTakeStartRef.current = performance.now();
      myTakeDurationRef.current = mixDuration || 0;
      setDuration(mixDuration || 0);
      audio.addEventListener('ended', handleStopMyTake, { once: true });
      audio.play().catch(() => handleStopMyTake());
      setIsPlayingMyTake(true);
      return;
    }
    if (!recordedUrl || !song) return;
    myTakeUsedMainRef.current = false;
    setIsPlayingMyTake(true);

    try {
      const voiceController = await prepareVoicePlayback(recordedUrl, reverbLevel, voiceVolume, handleStopMyTake);
      voiceControllerRef.current = voiceController;
      const recDuration = voiceController.duration || 0;
      if (recDuration > 0) {
        setDuration(recDuration);
        myTakeDurationRef.current = recDuration;
      }

      // Start voice first, then music after a small delay. Voice has output latency so
      // starting it early lets it align with the music when both are audible.
      const VOICE_LEAD_MS = 250;
      const onMusicPlaying = () => {
        myTakeStartRef.current = performance.now();
      };

      if (song.backgroundAudioUrl) {
        const musicEl = new Audio(song.backgroundAudioUrl);
        musicEl.volume = musicVolume;
        musicEl.currentTime = 0;
        musicEl.addEventListener('ended', handleStopMyTake, { once: true });
        myTakeMusicRef.current = musicEl;
        playheadSourceRef.current = null;
        musicEl.addEventListener('playing', onMusicPlaying, { once: true });
        voiceController.start();
        setTimeout(() => musicEl.play().catch(() => onMusicPlaying()), VOICE_LEAD_MS);
      } else {
        const el = mediaRef.current;
        if (el) {
          myTakeUsedMainRef.current = true;
          playheadSourceRef.current = null;
          el.volume = musicVolume;
          el.currentTime = 0;
          el.addEventListener('playing', onMusicPlaying, { once: true });
          voiceController.start();
          setTimeout(() => el.play().catch(() => onMusicPlaying()), VOICE_LEAD_MS);
        } else {
          myTakeStartRef.current = performance.now();
          voiceController.start();
        }
      }
    } catch (e) {
      console.error('Play failed:', e);
      setIsPlayingMyTake(false);
    }
  };

  // Load recording duration when we have a recorded blob (for post-recording screen display)
  useEffect(() => {
    if (!recordedUrl) {
      setRecordingDuration(null);
      return;
    }
    const audio = new Audio(recordedUrl);
    const onLoaded = () => {
      const d = audio.duration;
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
        setRecordingDuration(d);
      }
    };
    audio.addEventListener('loadedmetadata', onLoaded, { once: true });
    audio.addEventListener('error', () => setRecordingDuration(null), { once: true });
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.src = '';
    };
  }, [recordedUrl]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      handleStopMyTake();
    };
  }, [recordedUrl]);

  const handleCreateMasterTrack = async () => {
    if (!recordedUrl || !song || !id || (!song.backgroundAudioUrl && !song.videoUrl)) return;
    setMasterError(null);
    setCreatingMaster(true);
    try {
      const base = getMonthlyBookBaseUrl();
      const blob = await fetch(recordedUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('recording', blob, 'recording.webm');
      form.append('karaokeSongId', id);
      form.append('reverbLevel', String(reverbLevel));
      form.append('musicVolume', String(musicVolume));
      form.append('voiceVolume', String(voiceVolume));
      const mixRes = await fetch(`${base}/karaoke/mix`, {
        method: 'POST',
        body: form,
      });
      if (!mixRes.ok) {
        const err = await mixRes.json().catch(() => ({}));
        throw new Error(err.message || 'Mixing failed');
      }
      const mixData = await mixRes.json();
      setMixedAudioUrl(mixData.mixedAudioUrl);
      setMixDuration(mixData.duration ?? recordingDuration ?? duration ?? 0);
      setMasterCreated(true);
      handleStopMyTake();
    } catch (err) {
      console.error('Create master error:', err);
      setMasterError(err instanceof Error ? err.message : 'Could not create master');
    } finally {
      setCreatingMaster(false);
    }
  };

  const handleSaveAndShare = async () => {
    const urlToSave = masterCreated ? mixedAudioUrl : null;
    if (!urlToSave || !song || !id) return;
    setSaveError(null);
    setSavingRecording(true);
    try {
      const base = getMonthlyBookBaseUrl();
      const saveRes = await fetch(`${base}/karaoke/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authService.getUserIdForBackend() || undefined,
          karaokeSongId: id,
          mixedAudioUrl: urlToSave,
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

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: song?.title || 'My karaoke recording',
          url: shareUrl,
          text: `Check out my karaoke recording: ${song?.title || 'My recording'}`,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
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

  const canSave = masterCreated && !!mixedAudioUrl && !savingRecording && !savedRecordingId;

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
    setRecordingDuration(null);
    setSavedRecordingId(null);
    setMasterCreated(false);
    setMixedAudioUrl(null);
    setMixDuration(0);
    mixedAudioRef.current = null;
    setMasterError(null);
    setCustomCoverUrl(null);
    setSaveError(null);
    setCoverError(null);
    setReverbLevel(0);
    setMusicVolume(0.7);
    setVoiceVolume(1);
    handleStopMyTake();
  };

  const effectiveDurationForDisplay = masterCreated
    ? (typeof mixDuration === 'number' && Number.isFinite(mixDuration) ? mixDuration : 0)
    : (recordingDuration ?? duration);
  const safeDuration = typeof effectiveDurationForDisplay === 'number' && Number.isFinite(effectiveDurationForDisplay) && effectiveDurationForDisplay > 0 ? effectiveDurationForDisplay : 0;

  // Edit screen: two tracks, volume sliders, reverb, Create Master Track
  if (recordedUrl && !isRecording && !masterCreated) {
    const canCreateMaster = (!!song?.backgroundAudioUrl || !!song?.videoUrl) && !creatingMaster;
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
          <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center">{song.title}</h1>
          <div className="w-14" />
        </div>

        {hasVideo ? (
          <video ref={videoRef} src={song.videoUrl} className="hidden" />
        ) : (
          <audio ref={audioRef} src={song.backgroundAudioUrl} className="hidden" />
        )}

        <div className="flex-1 flex flex-col px-4 py-6 min-h-0 overflow-y-auto">
          <p className="text-white font-display font-bold text-lg text-center mb-4">{song.title}</p>

          <button
            onClick={handlePlayRecording}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 border border-white/30 mb-6"
          >
            {isPlayingMyTake ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white ml-0.5" fill="currentColor" />
            )}
            <span className="text-white font-display font-bold">{isPlayingMyTake ? 'Pause' : 'Play preview'}</span>
          </button>

          <div className="w-full max-w-xs mx-auto mb-2">
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
              <div
                className="h-full bg-amber-500/80 rounded-full transition-all"
                style={{ width: `${safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/50 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          <div className="w-full max-w-xs mx-auto space-y-4 mt-6">
            <div className="flex items-center gap-3">
              <Music size={18} className="text-white/70 shrink-0" />
              <div className="flex-1">
                <p className="text-white/80 text-xs font-display mb-1">Background music</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVolume * 100}
                  onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mic size={18} className="text-white/70 shrink-0" />
              <div className="flex-1">
                <p className="text-white/80 text-xs font-display mb-1">Your recording</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={voiceVolume * 100}
                  onChange={(e) => setVoiceVolume(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="w-full max-w-xs mx-auto mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 font-display text-sm">Reverb</span>
              <div className="flex gap-1">
                {([0, 1, 2, 3] as ReverbLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setReverbLevel(level)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-display transition-all ${
                      reverbLevel === level ? 'bg-amber-500/80 text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {level === 0 ? 'Off' : getReverbLabel(level)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRecordAgain}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white/70 font-display text-sm hover:text-white/90 active:scale-[0.98] mt-4"
            >
              <RotateCcw size={18} />
              Record again
            </button>
            {masterError && <p className="text-amber-400 text-xs text-center mt-2">{masterError}</p>}

            <button
              onClick={handleCreateMasterTrack}
              disabled={!canCreateMaster}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-bold text-sm mt-6 mb-8 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingMaster ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Disc size={20} />
                  Create my song
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final screen: cover, save, share (after master created)
  if (recordedUrl && !isRecording && masterCreated) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
          <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center">{song.title}</h1>
          <div className="w-14" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 min-h-0">
          <p className="text-white font-display font-bold text-lg text-center mb-1">{song.title}</p>
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {isEditingArtistName ? (
              <>
                <input
                  type="text"
                  value={artistNameInput}
                  onChange={(e) => setArtistNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const name = artistNameInput.trim();
                      if (name) {
                        if (currentKid) updateKid(currentKid.id, { name });
                        else setParentName(name);
                      }
                      setIsEditingArtistName(false);
                    }
                    if (e.key === 'Escape') {
                      setArtistNameInput(artistName);
                      setIsEditingArtistName(false);
                    }
                  }}
                  className="bg-white/10 text-white border border-white/30 rounded-lg px-2 py-1 text-sm font-display w-32 text-center focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = artistNameInput.trim();
                    if (name) {
                      if (currentKid) updateKid(currentKid.id, { name });
                      else setParentName(name);
                    }
                    setIsEditingArtistName(false);
                  }}
                  className="text-amber-400 text-xs font-display"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="text-white/80 font-display text-sm">{artistName}</p>
                <button
                  type="button"
                  onClick={() => {
                    setArtistNameInput(artistName);
                    setIsEditingArtistName(true);
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                  aria-label="Edit artist name"
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
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
            <div className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-2" onClick={handleSeek}>
              <div
                className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all"
                style={{ width: `${safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(safeDuration)}</span>
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
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSaveAndShare}
                disabled={!canSave || savingRecording}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-display font-bold text-sm shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingRecording ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Save to library
                  </>
                )}
              </button>
              <button
                onClick={savedRecordingId && shareUrl ? handleShare : undefined}
                disabled={!savedRecordingId || !shareUrl}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 text-white font-display font-bold text-sm border border-white/30 hover:bg-white/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Share2 size={20} />
                Share
              </button>
            </div>
            {savedRecordingId && (
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-display font-bold text-sm py-1">
                <Check size={20} />
                Saved to library!
              </div>
            )}
            {coverError && <p className="text-amber-400 text-xs text-center">{coverError}</p>}
            {saveError && <p className="text-amber-400 text-xs text-center">{saveError}</p>}

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
