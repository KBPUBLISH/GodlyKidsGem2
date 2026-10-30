import {useLocalizedString, getLanguage} from '../../localization/LocalizedText';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users } from 'lucide-react';
import type { UnlockedCharacter } from '../../services/rewardsService';
import { ApiService, getApiBaseUrl } from '../../services/apiService';
import type { TourBeat } from '../../utils/adamTour';

const WOOD_TEX = '/assets/images/wheel-background-wood.webp';
const BUBBLE_BG = 'rgba(255, 252, 240, 0.96)';
const BUBBLE_BORDER = '#C9A86A';
const CARVED_TEXT_SHADOW =
  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)';

const TYPE_MS_DEFAULT = 38;
const TYPE_MS_MIN = 22;
const TYPE_MS_MAX = 80;
/** If TTS hasn't started by then, type anyway (slow network / no audio). */
const AUDIO_WAIT_MS = 1200;

const resolveAudioUrl = (url: string): string => {
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const origin = getApiBaseUrl().replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
};

type Props = {
  character: UnlockedCharacter;
  /** ElevenLabs voice to speak with (character.voiceId with a fallback). */
  voiceId: string;
  beats: TourBeat[];
  /** Controlled: which beat is up. The page advances it via onAdvance. */
  beatIndex: number;
  /**
   * False while the character is still walking to the spot — the card stays
   * hidden and nothing is spoken until he arrives.
   */
  speaking: boolean;
  /** Kid tapped the bubble after a beat finished (page decides what's next). */
  onAdvance: () => void;
  onSkip: () => void;
  /** Distance from the viewport bottom (CSS length). */
  bottom: string;
  /** Label on the last beat's continue hint. */
  lastBeatHint?: string;
};

/**
 * A crew character's guided-tour speech card: face portrait in a wood frame,
 * the beat types out in a cream bubble paced to his TTS line (same chrome
 * as Perry's onboarding card and the deck chat popup). Tap the bubble to
 * finish typing, tap again to advance.
 */
const CrewGuideCard: React.FC<Props> = ({
  character,
  voiceId,
  beats,
  beatIndex,
  speaking,
  onAdvance,
  onSkip,
  bottom,
  lastBeatHint = 'Tap to finish',
}) => {
  const beat = beats[Math.min(beatIndex, beats.length - 1)];
  const line = useLocalizedString(beat?.line ?? '');
  const tts = line;
  const lastBeat = beatIndex >= beats.length - 1;

  const [typed, setTyped] = useState(0);
  const [typingActive, setTypingActive] = useState(false);
  const [msPerChar, setMsPerChar] = useState(TYPE_MS_DEFAULT);
  const doneTyping = typed >= line.length;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const ttsCacheRef = useRef<Record<string, string>>({});

  const clearWait = useCallback(() => {
    if (waitTimerRef.current) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAudio();
      clearWait();
    };
  }, [clearWait, stopAudio]);

  const playAudio = useCallback(
    (url: string, spokenLen: number) => {
      try {
        stopAudio();
        const audio = new Audio(url);
        audioRef.current = audio;
        const beginTyping = () => {
          if (!mountedRef.current) return;
          const dur = audio.duration;
          if (Number.isFinite(dur) && dur > 0 && spokenLen > 0) {
            setMsPerChar(
              Math.min(TYPE_MS_MAX, Math.max(TYPE_MS_MIN, (dur * 1000) / spokenLen)),
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
    [clearWait, stopAudio],
  );

  // Prefetch the first line while he's still walking so it plays on arrival.
  useEffect(() => {
    if (!tts || ttsCacheRef.current[tts]) return;
    let cancelled = false;
    void ApiService.generateTTS(tts, voiceId, undefined, getLanguage()).then((result) => {
      if (cancelled || !result?.audioUrl) return;
      ttsCacheRef.current[tts] = resolveAudioUrl(result.audioUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [tts, voiceId]);

  // Speak + type the current beat once he's in place.
  useEffect(() => {
    setTyped(0);
    setTypingActive(false);
    setMsPerChar(TYPE_MS_DEFAULT);
    stopAudio();
    clearWait();
    if (!speaking || !line) return;

    waitTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setTypingActive(true);
    }, AUDIO_WAIT_MS);

    let cancelled = false;
    const nextTts = beats[beatIndex + 1]?.tts;
    void (async () => {
      const cached = ttsCacheRef.current[tts];
      const url =
        cached ||
        (await (async () => {
          const result = await ApiService.generateTTS(tts, voiceId, undefined, getLanguage());
          if (!result?.audioUrl) return null;
          const resolved = resolveAudioUrl(result.audioUrl);
          ttsCacheRef.current[tts] = resolved;
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
      stopAudio();
      clearWait();
    };
    // `beats` identity changes with lock refreshes; the beat text is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking, beatIndex, tts, line, voiceId, clearWait, playAudio, stopAudio]);

  useEffect(() => {
    if (!speaking || !typingActive || doneTyping) return;
    const id = window.setInterval(() => setTyped((n) => n + 1), msPerChar);
    return () => window.clearInterval(id);
  }, [speaking, typingActive, doneTyping, msPerChar]);

  const handleBubbleTap = useCallback(() => {
    if (!doneTyping) {
      setTyped(line.length);
      return;
    }
    stopAudio();
    onAdvance();
  }, [doneTyping, line.length, onAdvance, stopAudio]);

  if (!speaking || !beat) return null;

  return createPortal(
    <div
      className="fixed left-3 right-3 z-[90] flex flex-col items-stretch gap-2 pointer-events-none"
      style={{ bottom }}
      role="dialog"
      aria-label={`${character.name}'s tour`}
    >
      <button
        type="button"
        onClick={onSkip}
        className="pointer-events-auto self-end rounded-full px-3 py-1 font-display font-bold text-[11px] uppercase tracking-wide text-[#F5E6C8] active:scale-95 transition-transform"
        style={{
          background: 'rgba(42,22,12,0.72)',
          border: '1.5px solid rgba(245,230,163,0.45)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        }}
      >
        Skip tour
      </button>

      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className="w-[88px] h-[88px] rounded-2xl overflow-hidden bg-[#2a160c]"
            style={{
              border: '3px solid #F5E6A3',
              boxShadow: '0 0 0 2px #8a5a1c, 0 8px 20px rgba(0,0,0,0.5)',
            }}
          >
            {character.imageUrl ? (
              <img
                src={character.imageUrl}
                alt=""
                draggable={false}
                className="w-full h-full object-cover pointer-events-none select-none"
                style={{
                  objectPosition: 'center top',
                  transform: 'scale(1.45)',
                  transformOrigin: '50% 8%',
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Users size={34} className="text-amber-200/70" aria-hidden />
              </div>
            )}
          </div>
          <span
            className="mt-1 max-w-[96px] truncate font-display font-black uppercase tracking-[0.06em] text-[#F5E6C8] text-center"
            style={{
              padding: '0.24rem 0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.66rem',
              lineHeight: 1,
              backgroundImage: `url(${WOOD_TEX})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '2px solid #6B4423',
              boxShadow:
                '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
              textShadow: CARVED_TEXT_SHADOW,
            }}
          >
            {character.name}
          </span>
        </div>

        <div
          className="relative flex-1 min-w-0 pointer-events-auto cursor-pointer"
          onClick={handleBubbleTap}
        >
          <div
            className="relative rounded-2xl px-4 py-3 font-display font-semibold leading-snug text-[14px]"
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
            {doneTyping && (
              <span
                className="mt-1.5 block text-[10px] font-bold tracking-wide uppercase text-[#9a7a4a] crew-guide-hint"
                aria-hidden
              >
                {lastBeat ? lastBeatHint : 'Tap to continue'}
              </span>
            )}
          </div>
          <span
            aria-hidden
            className="absolute"
            style={{
              left: -6,
              bottom: 32,
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
      <style>{`
        @keyframes crew-guide-hint-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .crew-guide-hint { animation: crew-guide-hint-pulse 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .crew-guide-hint { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default CrewGuideCard;
