import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMonthlyBookBaseUrl } from '../services/apiService';
import { getKaraokeShareUrl } from '../constants';
import { authService } from '../services/authService';
import { useUser } from '../context/UserContext';
import { ArrowLeft, Play, Pause, Mic, Share2, Check, ImagePlus, RotateCcw, Pencil, Music, Disc } from 'lucide-react';
import StormySeaError from '../components/ui/StormySeaError';
import SelfieCapture from '../components/features/SelfieCapture';
import { DespiaService } from '../services/despiaService';
import { prepareVoicePlayback, createVoiceAudioContext, getReverbLabel, type ReverbLevel, type VoiceController } from '../utils/reverbUtils';

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
  coverImagePrompts?: string[];
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
  const [showCoverStyleSelector, setShowCoverStyleSelector] = useState(false);
  const [selectedCoverStyle, setSelectedCoverStyle] = useState<'pixar' | 'illustration' | 'disney'>('illustration');
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isEditingArtistName, setIsEditingArtistName] = useState(false);
  const [artistNameInput, setArtistNameInput] = useState('');
  const [showCongratsOverlay, setShowCongratsOverlay] = useState(false);
  const [showHeadphonePrompt, setShowHeadphonePrompt] = useState(true);

  const currentKid = kids?.find((k: any) => k.id === currentProfileId);
  const artistName = currentKid?.name || parentName || 'Artist';
  const [reverbLevel, setReverbLevel] = useState<ReverbLevel>(0);
  const voiceControllerRef = useRef<VoiceController | null>(null);
  const myTakeMusicRef = useRef<HTMLAudioElement | null>(null);
  const myTakeVoiceRef = useRef<HTMLAudioElement | null>(null);
  const myTakeUsedMainRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mixedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartOffsetRef = useRef(0);
  const recordingCtxRef = useRef<AudioContext | null>(null);

  // Use background MP3 for playback; video is no longer used
  const mediaSrc = song?.backgroundAudioUrl || song?.videoUrl;

  useEffect(() => {
    if (!id) return;
    const fetchSong = async () => {
      try {
        setError(null);
        const base = getMonthlyBookBaseUrl();
        // Cache-bust so we get fresh song data (including updated backgroundAudioUrl)
        // after re-uploading audio in the portal
        const res = await fetch(`${base}/karaoke/${id}?t=${Date.now()}`);
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

  const mediaRef = audioRef;
  const stopRecordingRef = useRef<() => void>(() => {});

  const playheadSourceRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const updateDurationFromMedia = () => {
      const d = el.duration;
      if (typeof d === 'number' && Number.isFinite(d) && d > 0 && d < 86400) setDuration(d);
    };
    const onDurationChange = updateDurationFromMedia;
    const onLoadedMetadata = updateDurationFromMedia;
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      updateDurationFromMedia();
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Do NOT stop recording here - the "ended" event can fire early (e.g. at ~1:04
      // on some platforms) before the song actually finishes. Recording stops via
      // duration-based timer or user tap instead.
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    onLoadedMetadata();
    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [mediaRef, song]);

  const isPlayingMyTakeRef = useRef(false);
  // Keep ref in sync immediately (useEffect would be delayed by a frame)
  isPlayingMyTakeRef.current = isPlayingMyTake;

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
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [currentTime, song?.lyrics]);

  // Live volume: update music HTMLAudioElement when slider moves during preview
  useEffect(() => {
    const el = myTakeMusicRef.current;
    if (el) el.volume = musicVolume;
    if (myTakeUsedMainRef.current && mediaRef.current) {
      mediaRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Live volume: update voice AudioContext gain when slider moves during preview
  useEffect(() => {
    voiceControllerRef.current?.setVolume?.(voiceVolume);
  }, [voiceVolume]);

  const handleMicPress = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isRecording) {
      handleStopRecording();
      el.pause();
    } else {
      // iOS: Start playback FIRST (in user gesture), before requesting mic.
      // getUserMedia takes over the audio session and can mute playback otherwise.
      await el.play().catch(() => {});
      const ok = await handleStartRecording();
      if (!ok) el.pause();
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
      // iOS Safari: Request play-and-record audio session so music and mic work together.
      if (typeof navigator !== 'undefined' && (navigator as any).audioSession?.setType) {
        try {
          (navigator as any).audioSession.setType('play-and-record');
        } catch (_) { /* not supported */ }
      } else if (typeof navigator !== 'undefined' && (navigator as any).audioSession !== undefined) {
        try {
          (navigator as any).audioSession.type = 'play-and-record';
        } catch (_) { /* not supported */ }
      }
      // Always disable echo cancellation / noise suppression / auto gain.
      // On iOS, echo cancellation aggressively cancels out music playing from the speaker,
      // making the recording nearly silent. These constraints are critical for karaoke.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      // Adaptive mic boost: DynamicsCompressor automatically amplifies quiet input
      // (e.g. iOS reducing mic gain when speaker is active) while limiting loud input
      // (e.g. headphones where mic runs at full sensitivity).
      const recCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (recCtx.state === 'suspended') await recCtx.resume().catch(() => {});
      const micSource = recCtx.createMediaStreamSource(stream);
      const compressor = recCtx.createDynamicsCompressor();
      compressor.threshold.value = -40;
      compressor.knee.value = 20;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      const makeupGain = recCtx.createGain();
      makeupGain.gain.value = 2.5;
      const dest = recCtx.createMediaStreamDestination();
      micSource.connect(compressor);
      compressor.connect(makeupGain);
      makeupGain.connect(dest);
      recordingCtxRef.current = recCtx;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(dest.stream, {
        audioBitsPerSecond: 128000,
      });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        try { recordingCtxRef.current?.close(); } catch {} finally { recordingCtxRef.current = null; }
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        console.log(`🎤 Recording: ${recordedChunksRef.current.length} chunks, ${(blob.size / 1024).toFixed(1)}KB, type=${mimeType}`);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = recorder;
      // Avoid timeslice - Safari/WebKit has a bug (Bug #216076) where timeslice causes
      // recordings longer than ~1 min to fail/truncate. Without timeslice we get one
      // blob on stop, which avoids the cutoff.
      recorder.start();
      // Capture music position when recording starts - used for sync on mix (iOS: playback starts before mic, so recording begins late)
      const offset = mediaRef.current?.currentTime;
      recordingStartOffsetRef.current = typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;
      setIsRecording(true);
      // Poll progress bar while recording (fallback for platforms where timeupdate/rAF may not fire)
      if (progressPollRef.current) clearInterval(progressPollRef.current);
      progressPollRef.current = setInterval(() => {
        const el = mediaRef.current;
        if (el) {
          if (typeof el.currentTime === 'number' && Number.isFinite(el.currentTime)) {
            setCurrentTime(el.currentTime);
          }
          const d = el.duration;
          if (typeof d === 'number' && Number.isFinite(d) && d > 0 && d < 86400) {
            setDuration(d);
          }
        }
      }, 100);
      stopRecordingRef.current = () => {
        if (recorder.state !== 'inactive') {
          if (progressPollRef.current) {
            clearInterval(progressPollRef.current);
            progressPollRef.current = null;
          }
          if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
          }
          recorder.stop();
          mediaRecorderRef.current = null;
          setIsRecording(false);
          mediaRef.current?.pause();
        }
      };
      // Stop recording after song duration - don't rely on "ended" which can fire early
      const d = duration > 0 && Number.isFinite(duration) ? duration : (mediaRef.current?.duration > 0 ? mediaRef.current.duration : 120);
      const stopAfterSec = Math.ceil(d + 2);
      recordingTimeoutRef.current = setTimeout(() => {
        recordingTimeoutRef.current = null;
        stopRecordingRef.current();
      }, stopAfterSec * 1000);
      return true;
    } catch (err) {
      console.error('Mic access failed:', err);
      const isDespia = DespiaService.isNative();
      setMicError(
        isDespia
          ? 'Microphone access is needed. Please allow it in your device Settings.'
          : 'Microphone access is needed to record. Please allow it in your browser settings.'
      );
      return false;
    }
  };

  const handleStopRecording = () => {
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
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
    setCurrentTime(0);
    // Restore the original song/media duration so the bar resets properly
    const d = main?.duration;
    if (typeof d === 'number' && Number.isFinite(d) && d > 0 && d < 86400) {
      setDuration(d);
    }
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
    setCurrentTime(0);
    myTakeStartRef.current = performance.now();
    setIsPlayingMyTake(true);

    // Create AudioContext NOW in the user gesture (click handler) before any async work.
    // iOS blocks AudioContext created after awaits/fetches.
    const voiceCtx = createVoiceAudioContext();

    try {
      const voiceController = await prepareVoicePlayback(recordedUrl, reverbLevel, voiceVolume, handleStopMyTake, voiceCtx);
      voiceControllerRef.current = voiceController;
      const recDuration = voiceController.duration || 0;
      if (recDuration > 0) {
        setDuration(recDuration);
        myTakeDurationRef.current = recDuration;
      }

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
        musicEl.play().catch(() => onMusicPlaying());
      } else {
        const el = mediaRef.current;
        if (el) {
          myTakeUsedMainRef.current = true;
          playheadSourceRef.current = null;
          el.volume = musicVolume;
          el.currentTime = 0;
          el.addEventListener('playing', onMusicPlaying, { once: true });
          voiceController.start();
          el.play().catch(() => onMusicPlaying());
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

  // Load recording duration when we have a recorded blob.
  // iOS blob URLs often report Infinity at loadedmetadata; seek to a huge time to force resolution.
  useEffect(() => {
    if (!recordedUrl) {
      setRecordingDuration(null);
      return;
    }
    const audio = new Audio(recordedUrl);
    let resolved = false;
    const tryResolve = () => {
      const d = audio.duration;
      if (!resolved && typeof d === 'number' && Number.isFinite(d) && d > 0) {
        resolved = true;
        setRecordingDuration(d);
      }
    };
    audio.addEventListener('loadedmetadata', () => {
      tryResolve();
      if (!resolved) {
        // iOS workaround: seek to large value to force duration calculation
        audio.currentTime = 1e10;
      }
    }, { once: true });
    audio.addEventListener('durationchange', tryResolve);
    audio.addEventListener('seeked', tryResolve, { once: true });
    audio.addEventListener('error', () => setRecordingDuration(null), { once: true });
    return () => {
      audio.removeEventListener('durationchange', tryResolve);
      audio.src = '';
    };
  }, [recordedUrl]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      handleStopMyTake();
    };
  }, [recordedUrl]);

  // Initialize artist name when entering edit screen (after recording)
  useEffect(() => {
    if (recordedUrl) {
      setArtistNameInput(currentKid?.name || parentName || 'Artist');
    }
  }, [recordedUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- init once when we have a recording

  // Auto-dismiss congrats overlay after 3 seconds
  useEffect(() => {
    if (!showCongratsOverlay) return;
    const t = setTimeout(() => setShowCongratsOverlay(false), 3000);
    return () => clearTimeout(t);
  }, [showCongratsOverlay]);

  // Auto-save to library when master is created
  useEffect(() => {
    if (!masterCreated || !mixedAudioUrl || !song || !id || savedRecordingId || savingRecording) return;
    setSaveError(null);
    setSavingRecording(true);
    const base = getMonthlyBookBaseUrl();
    fetch(`${base}/karaoke/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authService.getUserIdForBackend() || undefined,
        karaokeSongId: id,
        mixedAudioUrl,
        duration: mixDuration,
        ...(customCoverUrl && { customCoverImageUrl: customCoverUrl }),
        artistName: (artistNameInput || artistName || '').trim() || 'Artist',
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then((saved) => setSavedRecordingId(saved._id))
      .catch((err) => setSaveError(err instanceof Error ? err.message : 'Could not save'))
      .finally(() => setSavingRecording(false));
  }, [masterCreated, mixedAudioUrl, song?._id, id]); // eslint-disable-line react-hooks/exhaustive-deps -- only trigger on master create

  const handleCreateMasterTrack = async () => {
    if (!recordedUrl || !song || !id || (!song.backgroundAudioUrl && !song.videoUrl)) return;
    setMasterError(null);
    setCreatingMaster(true);
    try {
      const base = getMonthlyBookBaseUrl();
      const blob = await fetch(recordedUrl).then((r) => r.blob());
      const form = new FormData();
      const recExt = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('recording', blob, `recording.${recExt}`);
      form.append('recordingMimeType', blob.type || `audio/${recExt}`);
      form.append('karaokeSongId', id);
      form.append('reverbLevel', String(reverbLevel));
      form.append('musicVolume', String(musicVolume));
      form.append('voiceVolume', String(voiceVolume));
      form.append('recordingStartOffset', String(recordingStartOffsetRef.current));
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
      setShowCongratsOverlay(true);
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
          artistName: (artistNameInput || artistName || '').trim() || 'Artist',
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

  const shareUrl = savedRecordingId ? getKaraokeShareUrl(savedRecordingId) : null;

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
      if (!navigator.share) alert('📋 Link copied! Share it with family and friends.');
    } catch (err) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('📋 Link copied! Share it with family and friends.');
      } catch {
        prompt('Copy this link to share:', shareUrl);
      }
    }
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
        body: JSON.stringify({
          selfieBase64: imageBase64,
          songTitle: song.title,
          coverPrompts: song.coverImagePrompts ?? [],
          style: selectedCoverStyle,
        }),
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

  const effectiveTime = currentTime + syncOffset;
  const lyrics = song?.lyrics ?? [];
  // Match lyric: within [startTime, endTime] with small epsilon for float precision.
  // Fallback: when in a gap between lines, highlight the last line we've passed (startTime <= t).
  let currentLineIndex = lyrics.findIndex(
    (l) => effectiveTime >= l.startTime - 0.05 && effectiveTime <= l.endTime + 0.05
  );
  if (currentLineIndex < 0 && lyrics.length > 0) {
    const lastPassed = lyrics.map((l, i) => ({ i, startTime: l.startTime }))
      .filter(({ startTime }) => startTime <= effectiveTime)
      .pop();
    if (lastPassed) currentLineIndex = lastPassed.i;
  }

  if (showHeadphonePrompt) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center gap-2 px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
          <div className="text-6xl mb-2">🎧</div>
          <h2 className="text-white font-display font-bold text-2xl leading-tight">
            Best with headphones!
          </h2>
          <p className="text-white/70 font-display text-base max-w-xs leading-relaxed">
            For the best recording quality, plug in your headphones or earbuds before singing. Your voice will sound clearer and the music won't bleed into the mic.
          </p>
          <div className="flex flex-col items-center gap-3 w-full max-w-xs mt-4">
            <button
              onClick={() => setShowHeadphonePrompt(false)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-bold text-base active:scale-[0.98] shadow-lg"
            >
              Continue
            </button>
            <p className="text-white/40 text-xs font-display">You can still record without headphones</p>
          </div>
        </div>
      </div>
    );
  }

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
    try { recordingCtxRef.current?.close(); } catch {} finally { recordingCtxRef.current = null; }
    setRecordedUrl(null);
    setRecordingDuration(null);
    recordingStartOffsetRef.current = 0;
    setSavedRecordingId(null);
    setMasterCreated(false);
    setMixedAudioUrl(null);
    setMixDuration(0);
    setShowCongratsOverlay(false);
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

  // When preview is playing, prefer the duration we stored when playback started.
  // Otherwise fall back to recording → mix → song duration in that order.
  const effectiveDurationForDisplay = isPlayingMyTake && myTakeDurationRef.current > 0
    ? myTakeDurationRef.current
    : masterCreated
      ? (typeof mixDuration === 'number' && Number.isFinite(mixDuration) ? mixDuration : 0)
      : (recordingDuration ?? duration);
  const safeDuration = typeof effectiveDurationForDisplay === 'number' && Number.isFinite(effectiveDurationForDisplay) && effectiveDurationForDisplay > 0 ? effectiveDurationForDisplay : 0;

  // Edit screen: two tracks, volume sliders, reverb, Create Master Track
  if (recordedUrl && !isRecording && !masterCreated) {
    const canCreateMaster = (!!song?.backgroundAudioUrl || !!song?.videoUrl) && !creatingMaster;
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex items-center px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
        </div>

        <audio ref={audioRef} src={mediaSrc || undefined} className="hidden" />

        <div className="flex-1 flex flex-col px-4 py-6 min-h-0 overflow-y-auto">
          {/* Artist name - first thing for the user to fill in */}
          <div className="mb-8">
            <label htmlFor="artist-name" className="block text-white/80 font-display text-sm mb-2">
              Your name
            </label>
            <input
              id="artist-name"
              type="text"
              value={artistNameInput}
              onChange={(e) => setArtistNameInput(e.target.value)}
              placeholder="Artist"
              className="w-full py-3 px-4 rounded-xl bg-white/10 border border-white/30 text-white font-display text-base placeholder-white/40 focus:outline-none focus:border-amber-500"
            />
          </div>

          <p className="text-white font-display font-bold text-lg text-center mb-6">{song.title}</p>

          <button
            onClick={handlePlayRecording}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-white/10 border border-white/30 mb-8"
          >
            {isPlayingMyTake ? (
              <Pause size={24} className="text-white" />
            ) : (
              <Play size={24} className="text-white ml-0.5" fill="currentColor" />
            )}
            <span className="text-white font-display font-bold">{isPlayingMyTake ? 'Pause' : 'Play preview'}</span>
          </button>

          <div className="w-full max-w-xs mx-auto mb-6">
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

          <div className="w-full max-w-xs mx-auto space-y-5 mt-8">
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

          <div className="w-full max-w-xs mx-auto mt-10">
            <div className="flex items-center justify-between mb-3">
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
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white/70 font-display text-sm hover:text-white/90 active:scale-[0.98] mt-6"
            >
              <RotateCcw size={18} />
              Record again
            </button>
            {masterError && <p className="text-amber-400 text-xs text-center mt-2">{masterError}</p>}

            <button
              onClick={handleCreateMasterTrack}
              disabled={!canCreateMaster}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-bold text-sm mt-8 mb-10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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

  // Congrats overlay: shows for ~3 seconds after "Create my song" before final screen
  if (recordedUrl && !isRecording && masterCreated && showCongratsOverlay) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
        <style>{`
          @keyframes karaoke-confetti {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .karaoke-confetti {
            animation: karaoke-confetti 2.5s ease-out forwards;
          }
        `}</style>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute karaoke-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFA500', '#96E6A1'][Math.floor(Math.random() * 5)],
                width: '10px',
                height: '10px',
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
        <div className="relative text-center px-6">
          <p className="text-5xl mb-4">🎤</p>
          <h2 className="text-white font-display font-bold text-2xl mb-2">Congratulations!</h2>
          <p className="text-amber-400 font-display text-lg">Beautiful singer!</p>
          <p className="text-white/70 font-display text-sm mt-4">Your song is saved to your library</p>
        </div>
      </div>
    );
  }

  // Final screen: cover, save, share (after master created)
  if (recordedUrl && !isRecording && masterCreated) {
    const coverSrc = customCoverUrl || song.coverImage;
    return (
      <div className="relative flex flex-col h-full overflow-hidden bg-black">
        {/* Blurred cover image as background */}
        {coverSrc && (
          <>
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${coverSrc})`,
                filter: 'blur(40px)',
              }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-black/60" aria-hidden />
          </>
        )}
        <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95 drop-shadow-md">
            <ArrowLeft size={22} /> <span>Back</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 min-h-0">
          <p className="text-white font-display font-bold text-lg text-center mb-1 drop-shadow-md">{song.title}</p>
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
                      setArtistNameInput(artistNameInput || artistName);
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
                <p className="text-white/80 font-display text-sm">{artistNameInput || artistName}</p>
                <button
                  type="button"
                  onClick={() => {
                    setArtistNameInput(artistNameInput || artistName);
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
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center">
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
            {savingRecording ? (
              <div className="flex items-center justify-center gap-2 py-3 text-white/70 font-display text-sm">
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Saving to library…
              </div>
            ) : savedRecordingId ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-display font-bold text-sm py-2">
                <Check size={20} />
                Saved to library!
              </div>
            ) : null}
            <button
              onClick={savedRecordingId && shareUrl ? handleShare : undefined}
              disabled={!savedRecordingId || !shareUrl}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 text-white font-display font-bold text-sm border border-white/30 hover:bg-white/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 size={20} />
              Share
            </button>
            {coverError && <p className="text-amber-400 text-xs text-center">{coverError}</p>}
            {saveError && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-amber-400 text-xs text-center">{saveError}</p>
                <button
                  type="button"
                  onClick={handleSaveAndShare}
                  className="text-amber-400 text-xs font-display underline hover:text-amber-300"
                >
                  Try again
                </button>
              </div>
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

        {showCoverStyleSelector && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowCoverStyleSelector(false)}>
            <div
              className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 pb-safe"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-display font-bold text-lg mb-3">Choose cover style</h3>
              <div className="grid grid-cols-1 gap-2">
                {(['illustration', 'pixar', 'disney'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedCoverStyle(s);
                      setShowCoverStyleSelector(false);
                      setShowSelfieModal(true);
                    }}
                    className="flex items-center justify-between w-full py-3 px-4 rounded-xl bg-white/10 text-white font-display hover:bg-white/20 active:scale-[0.98]"
                  >
                    <span className="capitalize">{s}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCoverStyleSelector(false)}
                className="w-full mt-3 py-2 text-white/70 font-display text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <SelfieCapture
          isOpen={showSelfieModal}
          onCapture={handleAlbumCoverCapture}
          onClose={() => setShowSelfieModal(false)}
          childName="you"
        />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-full bg-black bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/karokebg.webp)' }}
    >
      {/* Dark overlay over background (80% opacity) */}
      <div className="absolute inset-0 bg-black/80 pointer-events-none z-0" aria-hidden />
      <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
        <button onClick={() => navigate('/karaoke')} className="flex items-center gap-2 text-white/90 hover:text-white font-display text-sm active:scale-95 drop-shadow-md">
          <ArrowLeft size={22} /> <span>Back</span>
        </button>
        <h1 className="text-white font-display font-bold text-sm truncate flex-1 mx-2 text-center drop-shadow-md">{song.title}</h1>
        <div className="w-14" />
      </div>

      {/* Media: tap to start/stop recording */}
      <div
        className="relative w-[min(100%,28vh)] aspect-square mx-auto cursor-pointer flex-shrink-0 rounded-2xl overflow-hidden"
        onClick={handleMicPress}
      >
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          {song.coverImage ? (
            <img
              src={song.coverImage}
              alt={song.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="text-white/70 text-6xl drop-shadow-lg">♪</div>
          )}
        </div>
        <audio ref={audioRef} src={mediaSrc || undefined} playsInline preload="auto" />
      </div>

      {/* Controls - below the stage */}
      <div className="flex-shrink-0 px-4 pt-4 pb-5">
        <div className="max-w-xl mx-auto">
          <div
            className="h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-4 mt-2"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full transition-all duration-75"
              style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/60 mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          {micError && (
            <p className="text-amber-400 text-xs text-center mb-2">{micError}</p>
          )}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleMicPress}
              className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 drop-shadow-lg ${
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
            <p className="text-red-400 text-xs text-center mt-2 font-display drop-shadow-md">Recording…</p>
          )}
        </div>
      </div>

      {/* Lyrics - scrollable below the controls */}
      <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-2 min-h-0 scroll-smooth" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-xl mx-auto text-center pb-8">
          {song.lyrics && song.lyrics.length > 0 ? (
            song.lyrics.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isPast = idx < currentLineIndex;
              return (
                <p
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  className={`py-1.5 text-lg font-display transition-all duration-200 text-center scroll-mt-24 scroll-mb-24 ${
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

      <SelfieCapture
        isOpen={showSelfieModal}
        onCapture={handleAlbumCoverCapture}
        onClose={() => setShowSelfieModal(false)}
        childName="you"
      />
      </div>
    </div>
  );
};

export default KaraokePlayerPage;
