import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import WoodBackButton from '../components/WoodBackButton';
import { getBibleMapApiRoot, resolveBibleMapMediaUrl } from '../utils/bibleMapApi';
import {
  fillBlankCount,
  normalizeTryItPrompts,
  storyHasTryIt,
  type TryItPrompt,
} from '../utils/tryItContent';
import {
  applyUnmutedPlayback,
  enableFirstCaptionTrack,
  takePrimedTryItVideo,
} from '../utils/tryItPlayback';
import { storyPackUnlockUxService } from '../services/storyPackUnlockUxService';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
} from '../utils/islandSceneReturn';
import { isOnboardingJourneyActive } from '../utils/onboardingJourney';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

type Phase = 'loading' | 'video' | 'prompt' | 'missing';

type StoryCms = {
  _id?: string;
  title?: string;
  displayTitle?: string;
  tryIt?: {
    videoUrl?: string;
    prompts?: TryItPrompt[];
  };
};

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const goldBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
  border: '2px solid #F5E6A3',
};

const IslandTryItPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId = 'genesis' } = useParams();
  const [searchParams] = useSearchParams();
  const navState = location.state as {
    title?: string;
    fromMainMap?: boolean;
    fromSail?: boolean;
    onboardingJourney?: boolean;
  } | null;
  const onboardingJourney =
    Boolean(navState?.onboardingJourney) || isOnboardingJourneyActive();

  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('TRY IT!');
  const [storyId, setStoryId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [prompts, setPrompts] = useState<TryItPrompt[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [blankValues, setBlankValues] = useState<string[]>([]);
  const [writeValue, setWriteValue] = useState('');
  const [needSoundTap, setNeedSoundTap] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const showPromptsRef = useRef<() => void>(() => undefined);

  const returnStoryId =
    storyId || searchParams.get('storyId')?.trim() || undefined;

  const sceneBackPath =
    buildIslandScenePath({
      islandId,
      storyId: returnStoryId,
    }) || `/sail/${islandId}/lesson`;

  const goBackToScene = useCallback(() => {
    navigate(sceneBackPath, {
      state: {
        ...buildIslandSceneNavState({
          islandId,
          storyId: returnStoryId,
          fromMainMap: Boolean(navState?.fromMainMap),
          fromSail: Boolean(navState?.fromSail),
          title: navState?.title || title,
        }),
        onboardingJourney,
      },
    });
  }, [navigate, sceneBackPath, islandId, returnStoryId, navState, title, onboardingJourney]);

  const finishTryIt = useCallback(() => {
    const sid = storyId || searchParams.get('storyId') || '';
    if (sid) {
      storyPackUnlockUxService.markActivityAndFlagUnlock(islandId, sid, 'tryIt');
    }
    goBackToScene();
  }, [storyId, searchParams, islandId, goBackToScene]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Island not found');
        const data = (await res.json()) as { stories?: StoryCms[] };
        const stories = Array.isArray(data.stories) ? data.stories : [];
        const wantedId = searchParams.get('storyId');
        const story =
          (wantedId && stories.find((s) => s._id === wantedId && storyHasTryIt(s))) ||
          stories.find((s) => storyHasTryIt(s));

        if (!story || !storyHasTryIt(story)) {
          setPhase('missing');
          return;
        }

        const nextPrompts = normalizeTryItPrompts(story.tryIt?.prompts);
        const src = resolveBibleMapMediaUrl(story.tryIt?.videoUrl);
        if (!src || nextPrompts.length < 1) {
          setPhase('missing');
          return;
        }

        setTitle((story.displayTitle || story.title || 'TRY IT!').toUpperCase());
        setStoryId(story._id || wantedId || '');
        setVideoUrl(src);
        setPrompts(nextPrompts);
        setPromptIndex(0);
        setPhase('video');
      } catch {
        if (!controller.signal.aborted) setPhase('missing');
      }
    };
    void load();
    return () => controller.abort();
  }, [islandId, searchParams]);

  const current = prompts[promptIndex];

  useEffect(() => {
    if (phase !== 'prompt' || !current) return;
    if (current.type === 'fill_blank') {
      setBlankValues(Array.from({ length: fillBlankCount(current) }, () => ''));
    } else {
      setBlankValues([]);
    }
    setWriteValue('');
  }, [phase, promptIndex, current]);

  const showPrompts = useCallback(() => {
    if (prompts.length < 1) {
      finishTryIt();
      return;
    }
    setPromptIndex(0);
    setPhase('prompt');
  }, [prompts.length, finishTryIt]);
  showPromptsRef.current = showPrompts;

  useLayoutEffect(() => {
    if (phase !== 'video' || !videoUrl) return;
    const host = videoHostRef.current;
    if (!host) return;

    setVideoProgress(0);
    const primed = takePrimedTryItVideo(videoUrl);
    const video = primed || document.createElement('video');
    if (!primed) video.src = videoUrl;
    video.className = 'absolute inset-0 w-full h-full bg-black';
    video.style.objectFit = 'cover';
    video.style.objectPosition = 'center';
    video.controls = false;
    video.removeAttribute('controls');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.setAttribute('aria-label', 'Try it video');
    video.style.pointerEvents = 'none';
    video.controlsList?.add?.('nodownload');
    video.disablePictureInPicture = true;
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;

    const onEnded = () => showPromptsRef.current();
    const onTimeUpdate = () => {
      if (scrubbingRef.current) return;
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        setVideoProgress(0);
        return;
      }
      setVideoProgress(Math.min(100, Math.max(0, (video.currentTime / duration) * 100)));
    };
    const showCaptions = () => enableFirstCaptionTrack(video);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', showCaptions);
    video.textTracks?.addEventListener('addtrack', showCaptions);
    showCaptions();
    onTimeUpdate();

    host.replaceChildren(video);
    videoRef.current = video;

    setSoundOn(!video.muted);
    const alreadyPlaying = !video.paused && !video.ended;
    if (alreadyPlaying) {
      setNeedSoundTap(false);
    } else {
      void applyUnmutedPlayback(video)
        .then(() => setNeedSoundTap(false))
        .catch(() => setNeedSoundTap(true));
    }

    return () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', showCaptions);
      video.textTracks?.removeEventListener('addtrack', showCaptions);
      try {
        video.pause();
      } catch {
        /* ignore */
      }
      if (video.parentNode === host) host.removeChild(video);
      if (videoRef.current === video) videoRef.current = null;
    };
  }, [phase, videoUrl]);

  const advancePrompt = useCallback(() => {
    if (promptIndex >= prompts.length - 1) {
      finishTryIt();
      return;
    }
    setPromptIndex((i) => i + 1);
  }, [promptIndex, prompts.length, finishTryIt]);

  const clearPractice = useCallback(() => {
    if (!current) return;
    if (current.type === 'fill_blank') {
      setBlankValues(Array.from({ length: fillBlankCount(current) }, () => ''));
    } else if (current.type === 'practice_write') {
      setWriteValue('');
    }
  }, [current]);

  const onPracticeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearPractice();
  };

  const tapForSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    void applyUnmutedPlayback(el)
      .then(() => {
        setNeedSoundTap(false);
        setSoundOn(true);
      })
      .catch(() => undefined);
  };

  const togglePlayPause = () => {
    const el = videoRef.current;
    if (!el || el.ended) return;
    if (el.paused) {
      el.muted = !soundOn;
      el.volume = soundOn ? 1 : 0;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const seekToClientX = (clientX: number) => {
    const bar = scrubBarRef.current;
    const video = videoRef.current;
    if (!bar || !video) return;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    const nextTime = ratio * duration;
    try {
      if (Math.abs(video.currentTime - nextTime) > 0.04) video.currentTime = nextTime;
    } catch {
      /* ignore seek before metadata */
    }
    setVideoProgress(ratio * 100);
  };

  const onScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    scrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToClientX(e.clientX);
  };

  const onScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
  };

  const endScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    seekToClientX(e.clientX);
    scrubbingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onScrubKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.key === 'ArrowRight' ? 5 : -5;
    const nextTime = Math.min(video.duration, Math.max(0, video.currentTime + delta));
    try {
      video.currentTime = nextTime;
    } catch {
      /* ignore */
    }
    setVideoProgress((nextTime / video.duration) * 100);
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    const next = !soundOn;
    setSoundOn(next);
    if (!el) return;
    el.muted = !next;
    el.defaultMuted = !next;
    el.volume = next ? 1 : 0;
    if (next && el.paused && !el.ended) {
      void el.play().catch(() => undefined);
    }
  };

  const videoFullBleed = phase === 'video' && Boolean(videoUrl);

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden"
      style={
        videoFullBleed
          ? { backgroundColor: '#000' }
          : {
              backgroundImage: `url(${WOOD_TEX})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
      }
    >
      {!videoFullBleed && (
        <div className="absolute inset-0 bg-[#2a1810]/70 pointer-events-none" aria-hidden />
      )}

      {videoFullBleed && (
        <div className="absolute inset-0 z-10 bg-black">
          <div
            ref={videoHostRef}
            className="absolute inset-0"
            onClick={togglePlayPause}
            role="button"
            tabIndex={0}
            aria-label="Play or pause video"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePlayPause();
              }
            }}
          />
          {!onboardingJourney && (
            <div
              className="absolute z-30"
              style={{
                top: 'max(12px, var(--safe-area-top))',
                left: 'max(12px, var(--safe-area-left, 0px))',
              }}
            >
              <WoodBackButton
                onClick={goBackToScene}
                className="w-11 h-11 flex-shrink-0"
                aria-label="Back"
              />
            </div>
          )}
          <button
            type="button"
            onClick={toggleSound}
            className="absolute z-30 flex items-center justify-center w-11 h-11 rounded-full bg-black/45 border border-white/35 active:scale-95 transition-transform"
            style={{
              top: 'max(12px, var(--safe-area-top))',
              right: 'max(12px, var(--safe-area-right, 0px))',
            }}
            aria-label={soundOn ? 'Sound off' : 'Sound on'}
          >
            {soundOn ? (
              <Volume2 size={20} className="text-white" />
            ) : (
              <VolumeX size={20} className="text-white/85" />
            )}
          </button>
          <div
            className="absolute left-0 right-0 bottom-0 z-30 flex items-end"
            style={{
              height: 'max(64px, calc(var(--safe-area-bottom) + 52px))',
              paddingLeft: 'max(32px, 9vw)',
              paddingRight: 'max(32px, 9vw)',
              paddingBottom: 'max(22px, calc(var(--safe-area-bottom) + 12px))',
              touchAction: 'none',
            }}
            onPointerDown={onScrubPointerDown}
            onPointerMove={onScrubPointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
          >
            <div
              ref={scrubBarRef}
              role="slider"
              tabIndex={0}
              aria-label="Video position"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(videoProgress)}
              onKeyDown={onScrubKeyDown}
              className="relative w-full h-2 rounded-full bg-white/35"
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-[#F5C518]"
                style={{ width: `${videoProgress}%` }}
              />
              <div
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-[#F5C518] shadow-md"
                style={{ left: `${videoProgress}%` }}
              />
            </div>
          </div>
          {needSoundTap && (
            <button
              type="button"
              onClick={tapForSound}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/45"
              aria-label="Tap for sound"
            >
              <span
                className="px-5 py-3 rounded-xl font-black text-lg text-[#3d2314]"
                style={goldBtnStyle}
              >
                Tap for sound
              </span>
            </button>
          )}
        </div>
      )}

      {!videoFullBleed && (
      <div className="relative z-10 flex flex-col h-full px-4 pt-[max(12px,var(--safe-area-top))] pb-[max(12px,var(--safe-area-bottom))]">
        {!onboardingJourney && (
          <div className="mb-3">
            <WoodBackButton
              onClick={goBackToScene}
              className="w-11 h-11 flex-shrink-0"
              aria-label="Back"
            />
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center text-white/90 font-bold">
            Loading Try it!…
          </div>
        )}

        {phase === 'missing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-white text-lg font-bold mb-2">Try it! coming soon</p>
            <p className="text-white/80 text-sm mb-6">
              This story pack doesn&apos;t have a Try it! video yet.
            </p>
            <button
              type="button"
              onClick={goBackToScene}
              className="px-5 py-2.5 rounded-xl text-white font-bold"
              style={woodBtnStyle}
            >
              Back to activities
            </button>
          </div>
        )}

        {phase === 'prompt' && current && (
          <div className="flex-1 flex flex-col min-h-0">
            <p className="text-white/90 text-xs font-bold mb-2">
              {promptIndex + 1} / {prompts.length}
            </p>
            <div className="flex-1 overflow-y-auto rounded-2xl bg-[#FFF8E7]/95 border-2 border-[#6B4423] p-4 shadow-lg">
              <h2
                className="text-[#3E2723] text-xl font-black mb-4 leading-snug"
                style={{ fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif' }}
              >
                {current.text}
              </h2>

              {current.type === 'fill_blank' && (
                <div className="space-y-2.5">
                  {blankValues.map((value, i) => (
                    <input
                      key={`${promptIndex}-${i}`}
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const next = [...blankValues];
                        next[i] = e.target.value;
                        setBlankValues(next);
                      }}
                      onKeyDown={onPracticeKeyDown}
                      placeholder={`${i + 1}.`}
                      className="w-full px-3 py-3 rounded-xl border-2 border-[#c4a574] bg-white text-[#3E2723] font-bold outline-none focus:border-[#8B4513]"
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  ))}
                  <p className="text-[#8B6914] text-xs font-semibold">
                    Practice only — Enter clears. Nothing is saved.
                  </p>
                </div>
              )}

              {current.type === 'practice_write' && (
                <div>
                  <textarea
                    value={writeValue}
                    onChange={(e) => setWriteValue(e.target.value)}
                    onKeyDown={onPracticeKeyDown}
                    rows={5}
                    className="w-full px-3 py-3 rounded-xl border-2 border-[#c4a574] bg-white text-[#3E2723] font-bold outline-none focus:border-[#8B4513] resize-none"
                    placeholder="Write here…"
                  />
                  <p className="text-[#8B6914] text-xs font-semibold mt-2">
                    Practice only — Enter clears. Nothing is saved.
                  </p>
                </div>
              )}

              {current.type === 'statement' && (
                <p className="text-[#8B6914] text-sm font-semibold">
                  Tap continue when you&apos;re ready.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={advancePrompt}
              className="mt-3 py-3.5 rounded-xl font-black text-lg text-[#3d2314] active:scale-95 transition-transform"
              style={goldBtnStyle}
            >
              {promptIndex >= prompts.length - 1 ? 'Did it' : 'Continue'}
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default IslandTryItPage;
