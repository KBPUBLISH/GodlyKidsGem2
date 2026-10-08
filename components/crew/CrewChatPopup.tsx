import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Users, Volume2, X } from 'lucide-react';
import type { UnlockedCharacter } from '../../services/rewardsService';
import { useUser } from '../../context/UserContext';
import {
  fetchCharacterChat,
  fetchTtsAudioUrl,
  GREETING_QUESTION,
  type ChatTurn,
} from '../../services/characterChatService';
import {
  loadChatHistory,
  recordAskedQuestion,
  saveChatHistory,
  seedAskedFromHistory,
  selectSuggestions,
} from './crewChatMemory';

/** Shared wood texture — matches the deck plaques. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

/** Carved/embossed text — same chrome as the deck wood plaques. */
const CARVED_TEXT_SHADOW =
  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)';

/** Cream speech-bubble chrome (bubble body + tail share it). */
const BUBBLE_BG = 'rgba(255, 252, 240, 0.96)';
const BUBBLE_BORDER = '#C9A86A';

/** Typewriter pacing (ms per character). */
const TYPE_MS_DEFAULT = 38;
const TYPE_MS_MIN = 22;
const TYPE_MS_MAX = 80;
/** If TTS hasn't started by then, type anyway (slow network / no audio). */
const AUDIO_WAIT_MS = 3500;

type Reply = {
  /** Monotonic id — guards typing/audio callbacks against stale replies. */
  id: number;
  text: string;
  /** Object URL of the spoken reply (revoked on unmount). */
  audioUrl?: string;
};

type Props = {
  character: UnlockedCharacter;
  onClose: () => void;
};

/** Friendly line when the chat endpoint is unreachable. */
const fallbackGreeting = (name: string) =>
  `Ahoy, matey! I'm ${name}. I'm so happy you came to visit me on deck!`;

/**
 * Face-focused portrait: full-body character art is top-anchored and zoomed
 * so the face fills the frame (same crop technique as CrewPickerDropdown).
 */
const FacePortrait: React.FC<{ imageUrl?: string }> = ({ imageUrl }) => (
  <div className="w-full h-full overflow-hidden bg-[#2a160c]">
    {imageUrl ? (
      <img
        src={imageUrl}
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
        <Users size={36} className="text-amber-200/70" aria-hidden />
      </div>
    )}
  </div>
);

/**
 * Crew-character chat as "character talking on the deck": a big face-cropped
 * portrait sits on the scene, the AI reply types out inside a cream speech
 * bubble with a tail pointing at the face (typing roughly paced to the TTS
 * audio when the character has a voiceId; tap the bubble to finish instantly),
 * and the 3 suggested questions float as wood-cream pills straight on the
 * background once the typing is done. Degrades gracefully: no backend →
 * static friendly line, no suggestions.
 */
const CrewChatPopup: React.FC<Props> = ({ character, onClose }) => {
  const { kids, currentProfileId } = useUser();

  // Kid's first name from the active profile (same source as the Listen page
  // "Ahoy, {name}!" greeting) — lets the character address the child by name.
  // undefined on the parent profile or when the kid has no name set.
  const userName = useMemo(() => {
    if (!currentProfileId) return undefined;
    const kid = kids.find((k: any) => k.id === currentProfileId);
    const firstName = String(kid?.name || '').trim().split(/\s+/)[0];
    return firstName || undefined;
  }, [kids, currentProfileId]);

  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [reply, setReply] = useState<Reply | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [retryQuestion, setRetryQuestion] = useState<string | null>(null);

  // Typewriter: number of chars revealed for the current reply.
  const [typed, setTyped] = useState(0);
  const [typingActive, setTypingActive] = useState(false);
  const [msPerChar, setMsPerChar] = useState(TYPE_MS_DEFAULT);

  const replyIdRef = useRef(0);
  const audioWaitTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioRef.current?.pause();
      if (audioWaitTimerRef.current) window.clearTimeout(audioWaitTimerRef.current);
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, []);

  const clearAudioWait = useCallback(() => {
    if (audioWaitTimerRef.current) {
      window.clearTimeout(audioWaitTimerRef.current);
      audioWaitTimerRef.current = null;
    }
  }, []);

  /**
   * Play a reply's audio. With `sync`, pace the typewriter to the clip
   * (duration / char count, clamped) and start typing when playback starts —
   * a rough "he's saying it as it's written" feel, no word-level alignment.
   */
  const playAudio = useCallback(
    (url: string, sync?: { replyId: number; chars: number }) => {
      try {
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        if (sync) {
          const beginTyping = () => {
            if (!mountedRef.current || replyIdRef.current !== sync.replyId) return;
            const dur = audio.duration;
            if (Number.isFinite(dur) && dur > 0 && sync.chars > 0) {
              setMsPerChar(
                Math.min(TYPE_MS_MAX, Math.max(TYPE_MS_MIN, (dur * 1000) / sync.chars)),
              );
            }
            clearAudioWait();
            setTypingActive(true);
          };
          if (Number.isFinite(audio.duration) && audio.duration > 0) beginTyping();
          else audio.addEventListener('loadedmetadata', beginTyping, { once: true });
          // Autoplay blocked → still type the reply out.
          void audio.play().catch(beginTyping);
        } else {
          void audio.play().catch(() => {});
        }
      } catch {
        /* voice is best-effort */
      }
    },
    [clearAudioWait],
  );

  const speakReply = useCallback(
    async (text: string, replyId: number) => {
      const url = await fetchTtsAudioUrl(character.voiceId!, text);
      if (!mountedRef.current) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        // TTS failed — don't hold the typewriter for the full wait.
        if (replyIdRef.current === replyId) {
          clearAudioWait();
          setTypingActive(true);
        }
        return;
      }
      objectUrlsRef.current.push(url);
      if (replyIdRef.current !== replyId) return; // a newer reply took over
      setReply((prev) => (prev && prev.id === replyId ? { ...prev, audioUrl: url } : prev));
      playAudio(url, { replyId, chars: text.length });
    },
    [character.voiceId, clearAudioWait, playAudio],
  );

  /** Show a new character reply and kick off typewriter (+ voice when able). */
  const showReply = useCallback(
    (text: string, withVoice: boolean) => {
      const id = ++replyIdRef.current;
      setReply({ id, text });
      setTyped(0);
      setMsPerChar(TYPE_MS_DEFAULT);
      clearAudioWait();
      if (withVoice && character.voiceId) {
        // Hold typing until audio starts (or the fallback timer fires).
        setTypingActive(false);
        audioWaitTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current && replyIdRef.current === id) setTypingActive(true);
        }, AUDIO_WAIT_MS);
        void speakReply(text, id);
      } else {
        setTypingActive(true);
      }
    },
    [character.voiceId, clearAudioWait, speakReply],
  );

  /**
   * Send a question. `historySnapshot` is the conversation BEFORE this
   * question — the question travels only in the `question` field and is
   * folded into history together with the reply once it arrives. (Sending it
   * in both places made the model see the child ask twice and answer as if
   * the question were a repeat.)
   */
  const ask = useCallback(
    async (question: string, historySnapshot: ChatTurn[]) => {
      const isGreeting = question === GREETING_QUESTION;
      setThinking(true);
      setRetryQuestion(null);
      setSuggestions([]);
      try {
        const res = await fetchCharacterChat({
          characterName: character.name,
          persona: character.persona,
          storyId: character.sourceStoryId,
          userName,
          question,
          history: historySnapshot,
        });
        if (!mountedRef.current) return;
        const nextHistory: ChatTurn[] = isGreeting
          ? [...historySnapshot, { role: 'character', text: res.reply }]
          : [
              ...historySnapshot,
              { role: 'user', text: question },
              { role: 'character', text: res.reply },
            ];
        setHistory(nextHistory);
        // Remember the conversation so reopening picks up where we left off.
        saveChatHistory(character.id, nextHistory);
        showReply(res.reply, true);
        // Cached responses can suggest questions the kid already asked —
        // swap those out for fresh ones (backfilled from earlier responses).
        setSuggestions(selectSuggestions(character.id, res.suggestedQuestions));
      } catch {
        if (!mountedRef.current) return;
        if (isGreeting) {
          // No backend / offline: static friendly line, typed out, no voice.
          showReply(fallbackGreeting(character.name), false);
        } else {
          setRetryQuestion(question);
        }
      } finally {
        if (mountedRef.current) setThinking(false);
      }
    },
    [character.id, character.name, character.persona, character.sourceStoryId, userName, showReply],
  );

  // Open with the greeting sentinel. If this character has (unexpired) saved
  // history, send it along — the backend then welcomes the kid back and picks
  // up where they left off instead of re-introducing itself.
  useEffect(() => {
    const saved = loadChatHistory(character.id);
    // Ensure past user turns count as "already asked" for suggestion picking
    // (covers histories saved before asked-question tracking existed).
    seedAskedFromHistory(character.id, saved);
    setHistory(saved);
    void ask(GREETING_QUESTION, saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  const doneTyping = !!reply && typed >= reply.text.length;

  // Typewriter interval — reveals one char per tick until the reply is done.
  useEffect(() => {
    if (!typingActive || !reply || doneTyping) return;
    const id = window.setInterval(() => setTyped((n) => n + 1), msPerChar);
    return () => window.clearInterval(id);
  }, [typingActive, reply, msPerChar, doneTyping]);

  const skipTyping = useCallback(() => {
    if (reply && !doneTyping) setTyped(reply.text.length);
  }, [reply, doneTyping]);

  const sendQuestion = (question: string) => {
    if (thinking) return;
    recordAskedQuestion(character.id, question);
    setLastQuestion(question);
    // History updates only when the reply lands — `ask` appends the user
    // turn and the character turn together (see its doc comment).
    void ask(question, history);
  };

  const showBubble = thinking || retryQuestion || reply;
  const showSuggestions =
    suggestions.length > 0 && !thinking && !retryQuestion && doneTyping;

  return (
    <div
      className="fixed inset-0 z-[220]"
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${character.name}`}
    >
      {/* Light scrim — dims just enough to read; the deck stays visible. */}
      <button
        type="button"
        className="absolute inset-0 bg-black/25"
        aria-label="Close chat"
        onClick={onClose}
      />

      {/* Close X — floats top-right on the scene */}
      <button
        type="button"
        onClick={onClose}
        className="absolute z-20 w-10 h-10 rounded-full flex items-center justify-center text-[#F5E6C8] active:scale-95 transition-transform"
        style={{
          right: 'max(12px, env(safe-area-inset-right, 0px))',
          top: 'max(12px, calc(var(--safe-area-top, 0px) + 8px))',
          background: 'rgba(42,22,12,0.72)',
          border: '2px solid #6B4423',
          boxShadow:
            'inset 0 1px 0 rgba(255,230,180,0.25), 0 3px 8px rgba(0,0,0,0.4)',
        }}
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {/* Character talking — bubble above, big face + floating pills below */}
      <div
        className="absolute left-3 right-3 z-10 flex flex-col gap-3 pointer-events-none"
        style={{ bottom: 'max(16px, calc(var(--safe-area-bottom, 0px) + 14px))' }}
      >
        {/* The kid's tapped question — small dark pill, right-aligned */}
        {lastQuestion && (
          <div
            className="self-end max-w-[80%] rounded-xl px-3 py-1.5 font-display font-semibold text-xs leading-snug"
            style={{
              background: 'rgba(52,30,14,0.88)',
              color: '#F5E6C8',
              border: '1.5px solid rgba(245,230,163,0.35)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            }}
          >
            {lastQuestion}
          </div>
        )}

        {/* Speech bubble — tail points down-left at the face below */}
        {showBubble && (
          <div
            className="relative pointer-events-auto"
            onClick={skipTyping}
            style={{ cursor: reply && !doneTyping ? 'pointer' : 'default' }}
          >
            <div
              className="relative rounded-2xl px-4 py-3 font-display font-semibold text-[15px] leading-snug max-h-[38vh] overflow-y-auto no-scrollbar"
              style={{
                background: BUBBLE_BG,
                color: '#3D2314',
                border: `2px solid ${BUBBLE_BORDER}`,
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
              }}
            >
              {thinking ? (
                <span className="inline-flex items-center gap-2 italic text-[#7A5A32]">
                  {character.name} is thinking
                  <span className="inline-flex gap-0.5" aria-hidden>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7A5A32] animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#7A5A32] animate-bounce"
                      style={{ animationDelay: '120ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#7A5A32] animate-bounce"
                      style={{ animationDelay: '240ms' }}
                    />
                  </span>
                </span>
              ) : retryQuestion ? (
                <>Oops — {character.name} got distracted by a seagull! Want to try again?</>
              ) : reply ? (
                // Invisible full text reserves the bubble's final size so it
                // doesn't grow line-by-line while typing.
                <span className="relative block whitespace-pre-wrap">
                  <span className="invisible" aria-hidden>
                    {reply.text}
                  </span>
                  <span className="absolute inset-0 whitespace-pre-wrap" aria-live="polite">
                    {reply.text.slice(0, typed)}
                    {!doneTyping && (
                      <span className="animate-pulse text-[#7A5A32]" aria-hidden>
                        ▍
                      </span>
                    )}
                  </span>
                </span>
              ) : null}
            </div>

            {/* Bubble tail — diamond aimed at the face below-left */}
            <span
              aria-hidden
              className="absolute"
              style={{
                left: 42,
                bottom: -8,
                width: 18,
                height: 18,
                transform: 'rotate(45deg)',
                background: BUBBLE_BG,
                borderRight: `2px solid ${BUBBLE_BORDER}`,
                borderBottom: `2px solid ${BUBBLE_BORDER}`,
              }}
            />

            {/* Replay — hear it again; perched on the bubble's corner */}
            {reply?.audioUrl && !thinking && !retryQuestion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playAudio(reply.audioUrl!);
                }}
                className="absolute -top-3 -right-2 w-9 h-9 rounded-full flex items-center justify-center text-[#F5E6C8] active:scale-90 transition-transform"
                style={{
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  border: '2px solid #6B4423',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
                }}
                aria-label={`Hear ${character.name} say it again`}
              >
                <Volume2 size={16} />
              </button>
            )}
          </div>
        )}

        {/* Big face (left) + floating question pills (right, on the scene) */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-center flex-shrink-0 pointer-events-none">
            <div
              className="w-[104px] h-[104px] rounded-2xl overflow-hidden"
              style={{
                border: '3px solid #F5E6A3',
                boxShadow: '0 0 0 2px #8a5a1c, 0 8px 20px rgba(0,0,0,0.5)',
              }}
            >
              <FacePortrait imageUrl={character.imageUrl} />
            </div>
            <span
              className="mt-1 max-w-[112px] truncate font-display font-black uppercase tracking-[0.06em] text-[#F5E6C8] text-center"
              style={{
                padding: '0.24rem 0.5rem',
                borderRadius: '0.5rem',
                fontSize: '0.68rem',
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

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {showSuggestions &&
              suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="pointer-events-auto w-full text-left rounded-full px-4 py-2.5 font-display font-bold text-sm leading-tight text-[#3D2314] active:scale-[0.97] transition-transform"
                  style={{
                    minHeight: 44,
                    background: 'rgba(255,252,240,0.94)',
                    border: '2px solid #A8834C',
                    boxShadow:
                      '0 3px 0 rgba(107,68,35,0.55), 0 5px 12px rgba(0,0,0,0.35)',
                  }}
                >
                  {q}
                </button>
              ))}

            {retryQuestion && !thinking && (
              <button
                type="button"
                onClick={() => void ask(retryQuestion, history)}
                className="pointer-events-auto self-start inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 font-display font-bold text-sm uppercase tracking-wide text-[#F5E6C8] active:scale-95 transition-transform"
                style={{
                  minHeight: 44,
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  border: '2px solid #6B4423',
                  textShadow: '0 1px 0 #3E1F07',
                  boxShadow:
                    '0 3px 0 rgba(62,31,7,0.6), 0 5px 12px rgba(0,0,0,0.35)',
                }}
              >
                <RefreshCw size={15} />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrewChatPopup;
