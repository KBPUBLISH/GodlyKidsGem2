import {useLocalizedString, getLanguage} from '../../localization/LocalizedText';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiService, getApiBaseUrl } from '../../services/apiService';
import { useUser } from '../../context/UserContext';
import PerryGuidePortrait from './PerryGuidePortrait';
import {
  ONBOARDING_GUIDE_VOICE_ID,
  buildOnboardingGuideCopy,
  buildStoryPackGuideBeats,
  buildStoryPackResumeBeats,
  hasSeenStoryPackRundown,
  buildQuizCompleteGuideBeats,
  buildCrewShipGuideBeats,
  buildDiscoverShipGuideBeats,
  buildLibraryGuideBeats,
  buildTapRewardGuideBeats,
} from '../../utils/onboardingJourney';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const BUBBLE_BG = 'rgba(255, 252, 240, 0.96)';
const BUBBLE_BORDER = '#C9A86A';

const TYPE_MS_DEFAULT = 38;
const TYPE_MS_MIN = 22;
const TYPE_MS_MAX = 80;
const AUDIO_WAIT_MS = 3500;
const SCENE_AUDIO_WAIT_MS = 900;

export type GuideCardVariant =
  | 'map'
  | 'storyPack'
  | 'tapReward'
  | 'quizComplete'
  | 'discoverShip'
  | 'crewShip'
  | 'library';

type Props = {
  active: boolean;
  variant?: GuideCardVariant;
  /** Quiz-complete: Continue after the last beat. */
  onContinue?: () => void;
  /** Crew ship: called after the last beat finishes (card should unmount). */
  onFinished?: () => void;
};

const resolveAudioUrl = (url: string): string => {
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const origin = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
};

/**
 * First-time map guide: flame character in a wood card, line types out in a
 * speech bubble while ElevenLabs TTS plays (same feel as crew / bible talk).
 * Story-pack copy plays as short sequential beats.
 */
const OnboardingGuideCard: React.FC<Props> = ({
  active,
  variant = 'map',
  onContinue,
  onFinished,
}) => {
  const { kids, currentProfileId } = useUser();
  const kidName = useMemo(() => {
    const fromProfile =
      currentProfileId && kids.find((k: { id?: string }) => k.id === currentProfileId);
    const named = fromProfile || kids.find((k: { name?: string }) => String(k?.name || '').trim());
    const first = String(named?.name || '').trim().split(/\s+/)[0];
    return first || undefined;
  }, [kids, currentProfileId]);
  const beats = useMemo(() => {
    if (variant === 'storyPack') {
      return hasSeenStoryPackRundown()
        ? buildStoryPackResumeBeats(kidName)
        : buildStoryPackGuideBeats(kidName);
    }
    if (variant === 'tapReward') return buildTapRewardGuideBeats(kidName);
    if (variant === 'quizComplete') return buildQuizCompleteGuideBeats(kidName);
    if (variant === 'discoverShip') return buildDiscoverShipGuideBeats();
    if (variant === 'crewShip') return buildCrewShipGuideBeats();
    if (variant === 'library') return buildLibraryGuideBeats();
    return [buildOnboardingGuideCopy(kidName)];
  }, [kidName, variant]);
  const compact = variant !== 'map';
  const aboveTray = variant === 'storyPack' || variant === 'tapReward';
  const aboveNav = variant === 'library';
  const aboveTreasure = variant === 'quizComplete';

  const [beatIndex, setBeatIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [typingActive, setTypingActive] = useState(false);
  const [msPerChar, setMsPerChar] = useState(TYPE_MS_DEFAULT);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const ttsCacheRef = useRef<Record<string, string>>({});
  const beatsRef = useRef(beats);

  const beat = beats[Math.min(beatIndex, beats.length - 1)] ?? beats[0];
  const line = useLocalizedString(beat?.line ?? '');
  const tts = line;
  const lastBeat = beatIndex >= beats.length - 1;
  const doneTyping = typed >= line.length;
  beatsRef.current = beats;

  const clearWait = useCallback(() => {
    if (waitTimerRef.current) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const goNextBeat = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setBeatIndex((i) => Math.min(i + 1, beatsRef.current.length - 1));
  }, []);

  const handleBubbleTap = useCallback(() => {
    if (!doneTyping) {
      setTyped(line.length);
      return;
    }
    if (!lastBeat) {
      goNextBeat();
      return;
    }
    onFinished?.();
  }, [doneTyping, lastBeat, line.length, goNextBeat, onFinished]);

  const playAudio = useCallback(
    (url: string, spokenLen: number) => {
      try {
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        const beginTyping = () => {
          if (!mountedRef.current) return;
          const dur = audio.duration;
          if (Number.isFinite(dur) && dur > 0 && spokenLen > 0) {
            setMsPerChar(
              Math.min(
                TYPE_MS_MAX,
                Math.max(TYPE_MS_MIN, (dur * 1000) / spokenLen),
              ),
            );
          }
          clearWait();
          setTypingActive(true);
        };
        if (Number.isFinite(audio.duration) && audio.duration > 0) beginTyping();
        else audio.addEventListener('loadedmetadata', beginTyping, { once: true });
        void audio.play().catch(beginTyping);
      } catch {
        setTypingActive(true);
      }
    },
    [clearWait],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioRef.current?.pause();
      audioRef.current = null;
      clearWait();
    };
  }, [clearWait]);

  useEffect(() => {
    if (!active) {
      audioRef.current?.pause();
      audioRef.current = null;
      clearWait();
      setBeatIndex(0);
      setTyped(0);
      setTypingActive(false);
      setMsPerChar(TYPE_MS_DEFAULT);
      return;
    }

    setTyped(0);
    setTypingActive(false);
    setMsPerChar(TYPE_MS_DEFAULT);
    if (!line) return;
    const waitMs = compact ? SCENE_AUDIO_WAIT_MS : AUDIO_WAIT_MS;
    waitTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setTypingActive(true);
    }, waitMs);

    let cancelled = false;
    const spoken = tts;
    const nextTts = beats[beatIndex + 1]?.tts;
    void (async () => {
      const cached = ttsCacheRef.current[spoken];
      const url = cached || (await (async () => {
        const result = await ApiService.generateTTS(spoken, ONBOARDING_GUIDE_VOICE_ID, undefined, getLanguage());
        if (!result?.audioUrl) return null;
        const resolved = resolveAudioUrl(result.audioUrl);
        ttsCacheRef.current[spoken] = resolved;
        return resolved;
      })());
      if (cancelled || !mountedRef.current) return;
      if (!url) {
        clearWait();
        setTypingActive(true);
        return;
      }
      playAudio(url, line.length);

    })();

    return () => {
      cancelled = true;
      audioRef.current?.pause();
      audioRef.current = null;
      clearWait();
    };
  }, [
    active,
    beatIndex,
    tts,
    line.length,
    compact,
    beats,
    clearWait,
    playAudio,
  ]);

  useEffect(() => {
    if (!active || !typingActive || doneTyping) return;
    const id = window.setInterval(() => setTyped((n) => n + 1), msPerChar);
    return () => window.clearInterval(id);
  }, [active, typingActive, doneTyping, msPerChar]);

  if (!active) return null;

  return createPortal(
    <div
      className="fixed left-3 right-3 z-[90] flex flex-col items-stretch gap-3 pointer-events-none"
      style={{
        bottom: aboveTreasure
          ? 'max(260px, calc(var(--safe-area-bottom, 0px) + 42vh))'
          : aboveTray
          ? 'max(168px, calc(var(--safe-area-bottom, 0px) + 42vw))'
          : aboveNav
            ? 'max(96px, calc(var(--safe-area-bottom, 0px) + 88px))'
            : 'max(16px, calc(var(--safe-area-bottom, 0px) + 18px))',
      }}
      role="dialog"
      aria-label={
        variant === 'discoverShip' || variant === 'crewShip'
          ? 'Crew ship guide'
          : variant === 'library'
            ? 'Library guide'
            : variant === 'quizComplete'
            ? 'Story pack complete guide'
            : variant === 'tapReward'
              ? 'Tap Reward guide'
            : variant === 'storyPack'
              ? 'Story pack guide'
              : 'Welcome guide'
      }
    >
      <div className="flex items-end gap-3">
      <div
        className="flex-shrink-0 rounded-2xl overflow-hidden"
        style={{
          width: compact ? 88 : 108,
          height: compact ? 102 : 124,
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '3px solid #F5E6A3',
          boxShadow: '0 0 0 2px #8a5a1c, 0 8px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div className="w-full h-full flex items-center justify-center bg-[#7EC8E8] overflow-hidden">
          <PerryGuidePortrait key="perry-guide-v5" />
        </div>
      </div>

      <div
        className="relative flex-1 min-w-0 pointer-events-auto"
        onClick={handleBubbleTap}
        style={{ cursor: doneTyping && lastBeat && !onFinished ? 'default' : 'pointer' }}
      >
        <div
          className={`relative rounded-2xl px-4 py-3 font-display font-semibold leading-snug ${
            compact ? 'text-[14px]' : 'text-[15px]'
          }`}
          style={{
            background: BUBBLE_BG,
            color: '#3D2314',
            border: `2px solid ${BUBBLE_BORDER}`,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          }}
        >
          <span className="relative block whitespace-pre-wrap">
            <span className="invisible" aria-hidden>
              {line}
            </span>
            <span className="absolute inset-0 whitespace-pre-wrap" aria-live="polite">
              {line.slice(0, typed)}
              {!doneTyping && (
                <span className="animate-pulse text-[#7A5A32]" aria-hidden>
                  ▍
                </span>
              )}
            </span>
          </span>
          {compact && doneTyping && (!lastBeat || onFinished) && (
            <span
              className="mt-1.5 block text-[10px] font-bold tracking-wide uppercase text-[#9a7a4a]"
              aria-hidden
            >
              Tap to continue
            </span>
          )}
        </div>
        <span
          aria-hidden
          className="absolute"
          style={{
            left: -6,
            bottom: 28,
            width: 16,
            height: 16,
            transform: 'rotate(45deg)',
            background: BUBBLE_BG,
            borderLeft: `2px solid ${BUBBLE_BORDER}`,
            borderBottom: `2px solid ${BUBBLE_BORDER}`,
          }}
        />
      </div>
      </div>
      {variant === 'quizComplete' && lastBeat && doneTyping && onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="pointer-events-auto self-center ob-guide-continue py-3 px-8 rounded-xl font-black text-lg text-[#3d2314] active:scale-95"
          style={{
            background:
              'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
            boxShadow:
              '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
            border: '2px solid #F5E6A3',
          }}
        >
          Continue
        </button>
      )}
      <style>{`
        @keyframes ob-guide-continue-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .ob-guide-continue {
          animation: ob-guide-continue-pulse 1.15s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ob-guide-continue { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default OnboardingGuideCard;
