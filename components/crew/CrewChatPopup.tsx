import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Send, Users, Volume2, X } from 'lucide-react';
import type { UnlockedCharacter } from '../../services/rewardsService';
import { useUser } from '../../context/UserContext';
import {
  fetchCharacterChat,
  fetchTtsAudioUrl,
  GREETING_QUESTION,
  spokenTextForTts,
  stripEmotionTags,
  type ChatTurn,
} from '../../services/characterChatService';
import {
  loadChatHistory,
  recordAskedQuestion,
  saveChatHistory,
  seedAskedFromHistory,
  selectSuggestions,
} from './crewChatMemory';
import { noteJourneyActivity } from '../../utils/journeyStudy';
import {
  parseIslandIntent,
  taskGoLine,
  taskGoalPrompt,
  answerWorldQuestion,
  sanitizeAiTask,
  islandGreeting,
  type IslandTask,
  type WorldBrief,
} from '../../utils/islandIntents';

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
  /** Island talks stay to one short line and skip the portrait. */
  variant?: 'deck' | 'island';
  /** Island only: the kid agreed on a job, hand it to the world. */
  onTask?: (task: IslandTask) => void;
  /** Island only: what the character knows about their island right now. */
  world?: WorldBrief | null;
};

export type { IslandTask };

/** A pending follow-up: the job plus the one detail still missing. */
type TaskFlow = { task: IslandTask; ask: string; options: { label: string; task: IslandTask }[] };

/** Tapped pills always ask the goal first (typed text only asks when the detail is missing). */
const PILL_TASKS: Record<string, IslandTask> = {
  'Chop some wood': { type: 'chop' },
  'Break rocks': { type: 'mine', goal: 'any', count: 1 },
  'Catch a fish': { type: 'fish', goal: 'one', count: 1 },
  'Water the garden': { type: 'water', goal: 'all' },
  'Plant seeds': { type: 'plant' },
  'Pick the crops': { type: 'harvest' },
  'Build something': { type: 'build' },
  'Go to sleep': { type: 'sleep' },
};
const PILL_GOALS: Record<string, TaskFlow> = {
  'Catch a fish': { task: { type: 'fish' }, ask: 'How many fish should I catch?', options: [
    { label: 'Just one', task: { type: 'fish', goal: 'one', count: 1 } },
    { label: 'Three for supper', task: { type: 'fish', goal: 'few', count: 3 } },
  ] },
  'Water the garden': { task: { type: 'water' }, ask: 'Which plants?', options: [
    { label: 'Every thirsty plant', task: { type: 'water', goal: 'all' } },
    { label: 'Just one', task: { type: 'water', goal: 'one', count: 1 } },
  ] },
  'Break rocks': { task: { type: 'mine' }, ask: 'What are we after?', options: [
    { label: 'Any rock', task: { type: 'mine', goal: 'any', count: 1 } },
    { label: 'Stone for building', task: { type: 'mine', goal: 'stone', count: 2 } },
    { label: 'Shiny minerals', task: { type: 'mine', goal: 'copper', count: 1 } },
  ] },
};

/** Pills offered after "I have a task" — picked from what makes sense right now. */
function taskPills(w: WorldBrief | null): string[] {
  const pills = ['Chop some wood', 'Break rocks', 'Catch a fish'];
  if (w?.garden?.thirsty) pills.push('Water the garden');
  if (w?.garden?.ready) pills.push('Pick the crops');
  if (w && Object.keys(w.seeds).length) pills.push('Plant seeds');
  pills.push('Build something');
  if (w?.canSleep && w.energy < 60) pills.push('Go to sleep');
  return pills.slice(0, 6);
}

/** Friendly line when the chat endpoint is unreachable. */
const fallbackGreeting = (name: string) =>
  `Ahoy, matey! I'm ${name}. I'm so happy you came to visit me on deck!`;

/** Island talk always offers something to tap next. */
const ISLAND_OPENERS = ['I have a task', 'I just want to chat'];
const ISLAND_CHATS = ['Tell me about your day', 'What do you like here?', 'Are you happy?'];
/** Chat-only island talks: jobs are given with the Task button beside the character. */
const TASK_BUTTON_LINE = 'I would love to help! Tap the Task button next to me on the island and I will get right to it.';

/** One short spoken line. Island replies must not run on into a story. */
function shortenReply(text: string) {
  const clean = stripEmotionTags(text);
  let sentence = (clean.split(/(?<=[.!?])\s/)[0] || clean).trim();
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length > 16) sentence = `${words.slice(0, 16).join(' ').replace(/[,:;–—-]+$/, '')}.`;
  return sentence;
}

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
const CrewChatPopup: React.FC<Props> = ({ character, onClose, variant = 'deck', onTask, world = null }) => {
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
  // Island: the task waiting on its goal answer ("what's the wood for?").
  const [pendingTask, setPendingTask] = useState<TaskFlow | null>(null);
  const [thinking, setThinking] = useState(false);
  const [retryQuestion, setRetryQuestion] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [kbInset, setKbInset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
    async (spoken: string, replyId: number, displayChars: number) => {
      const url = await fetchTtsAudioUrl(character.voiceId!, spoken);
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
      playAudio(url, { replyId, chars: displayChars });
    },
    [character.voiceId, clearAudioWait, playAudio],
  );

  /** Show a new character reply and kick off typewriter (+ voice when able). */
  const showReply = useCallback(
    (text: string, withVoice: boolean) => {
      const id = ++replyIdRef.current;
      const display = stripEmotionTags(text) || text;
      setReply({ id, text: display });
      setTyped(0);
      setMsPerChar(TYPE_MS_DEFAULT);
      clearAudioWait();
      if (withVoice && character.voiceId) {
        // Hold typing until audio starts (or the fallback timer fires).
        setTypingActive(false);
        audioWaitTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current && replyIdRef.current === id) setTypingActive(true);
        }, AUDIO_WAIT_MS);
        void speakReply(spokenTextForTts(text), id, display.length);
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
          brief: variant === 'island',
          world: variant === 'island' ? world ?? undefined : undefined,
        });
        if (!mountedRef.current) return;
        const replyText = variant === 'island' ? shortenReply(res.reply) : res.reply;
        // The character may decide to act on what the kid said ("sure, I'll
        // go fish") — hand a validated task to the island after the line lands.
        const aiTask = variant === 'island' && onTask ? sanitizeAiTask(res.task) : null;
        if (aiTask) window.setTimeout(() => onTask(aiTask), 1600);
        const nextHistory: ChatTurn[] = isGreeting
          ? [...historySnapshot, { role: 'character', text: replyText }]
          : [
              ...historySnapshot,
              { role: 'user', text: question },
              { role: 'character', text: replyText },
            ];
        setHistory(nextHistory);
        // Remember the conversation so reopening picks up where we left off.
        saveChatHistory(character.id, nextHistory);
        showReply(replyText, true);
        // Cached responses can suggest questions the kid already asked —
        // swap those out for fresh ones (backfilled from earlier responses).
        const picked = selectSuggestions(character.id, res.suggestedQuestions.map(stripEmotionTags));
        setSuggestions(variant === 'island' && picked.length === 0 ? (onTask ? ISLAND_OPENERS : ISLAND_CHATS) : picked);
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
    [character.id, character.name, character.persona, character.sourceStoryId, userName, showReply, variant, world, onTask],
  );

  // Open with the greeting sentinel. If this character has (unexpired) saved
  // history, send it along — the backend then welcomes the kid back and picks
  // up where they left off instead of re-introducing itself.
  useEffect(() => {
    noteJourneyActivity('character_talk', {
      source: 'opened',
      label: character.name,
      eventId: `char_${character.id}_${Date.now()}`,
    });
    const saved = loadChatHistory(character.id);
    // Ensure past user turns count as "already asked" for suggestion picking
    // (covers histories saved before asked-question tracking existed).
    seedAskedFromHistory(character.id, saved);
    setComposing(false);
    setDraft('');
    if (variant === 'island') {
      // Keep the last few turns so the character can refer back to them,
      // but open with a fresh, situation-aware line rather than an AI greeting.
      const recent = saved.slice(-6);
      setHistory(recent);
      setPendingTask(null);
      setSuggestions(onTask ? ISLAND_OPENERS : ISLAND_CHATS);
      const lastUser = [...saved].reverse().find((t) => t.role === 'user' && !ISLAND_OPENERS.includes(t.text))?.text || null;
      showReply(islandGreeting({ characterId: character.id, userName, world, lastUserLine: lastUser }), true);
      return;
    }
    setHistory(saved);
    void ask(GREETING_QUESTION, saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id, variant, userName]);

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
    noteJourneyActivity('character_talk', { source: 'message', label: character.name });
    recordAskedQuestion(character.id, question);
    setLastQuestion(question);
    setComposing(false);
    setDraft('');
    if (variant === 'island') {
      const say = (line: string, next: string[]) => {
        const nextHistory: ChatTurn[] = [...history, { role: 'user', text: question }, { role: 'character', text: line }];
        setHistory(nextHistory);
        saveChatHistory(character.id, nextHistory);
        setSuggestions(next);
        showReply(line, true);
      };
      // Hand a decided job to the island after the line is spoken.
      const go = (task: IslandTask) => {
        setPendingTask(null);
        say(taskGoLine(task), []);
        window.setTimeout(() => onTask?.(task), 1400);
      };
      // A job that still needs one detail: ask, offer the choices as pills.
      const askGoal = (task: IslandTask) => {
        const prompt = taskGoalPrompt(task);
        if (!prompt) return go(task);
        setPendingTask({ task, ask: prompt.ask, options: prompt.options });
        say(prompt.ask, prompt.options.map((o) => o.label));
      };
      if (ISLAND_OPENERS.includes(question)) {
        const task = question === 'I have a task';
        setPendingTask(null);
        say(task ? 'What should I do?' : 'What do you want to talk about?', task ? taskPills(world) : ISLAND_CHATS);
        return;
      }
      if (onTask) {
        // 1. Answer to a pending goal question.
        const picked = pendingTask?.options.find((o) => o.label === question);
        if (pendingTask && picked) return go(picked.task);
        // 2. A tapped task pill.
        if (PILL_GOALS[question]) {
          const flow = PILL_GOALS[question];
          setPendingTask(flow);
          say(flow.ask, flow.options.map((o) => o.label));
          return;
        }
        if (PILL_TASKS[question]) return askGoal(PILL_TASKS[question]);
        // 3. Free text: do we understand it as a job or a question about the island?
        const intent = parseIslandIntent(question);
        if (intent.kind === 'task') {
          if (['stop', 'pause', 'resume'].includes(intent.task.type)) {
            say(taskGoLine(intent.task), ISLAND_OPENERS);
            onTask(intent.task);
            return;
          }
          return intent.needsGoal ? askGoal(intent.task) : go(intent.task);
        }
        if (intent.kind === 'ask') {
          say(answerWorldQuestion(intent.topic, world), ISLAND_OPENERS);
          return;
        }
      } else {
        // Talk only: a job request points the kid at the Task button; island questions still get answered.
        const intent = parseIslandIntent(question);
        if (intent.kind === 'task') {
          say(TASK_BUTTON_LINE, ISLAND_CHATS);
          return;
        }
        if (intent.kind === 'ask') {
          say(answerWorldQuestion(intent.topic, world), ISLAND_CHATS);
          return;
        }
      }
    }
    // History updates only when the reply lands — `ask` appends the user
    // turn and the character turn together (see its doc comment).
    void ask(question, history);
  };

  const submitOwnQuestion = () => {
    const q = draft.trim();
    if (!q || thinking) return;
    sendQuestion(q);
  };

  useEffect(() => {
    if (!composing) {
      setKbInset(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    const vv = window.visualViewport;
    if (!vv) return () => window.clearTimeout(id);
    const syncKb = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(covered);
    };
    vv.addEventListener('resize', syncKb);
    vv.addEventListener('scroll', syncKb);
    syncKb();
    return () => {
      window.clearTimeout(id);
      vv.removeEventListener('resize', syncKb);
      vv.removeEventListener('scroll', syncKb);
    };
  }, [composing]);

  const showBubble = thinking || retryQuestion || reply;
  const showSuggestions =
    suggestions.length > 0 && !thinking && !retryQuestion && doneTyping && !composing;
  const showAskOwn = !thinking && !retryQuestion && doneTyping;

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

      {/* Character talking — bubble above, big face + floating pills below */}
      <div
        className="absolute left-3 right-3 z-10 flex flex-col gap-3 pointer-events-none"
        style={{
          bottom: `max(16px, calc(var(--safe-area-bottom, 0px) + 14px + ${kbInset}px))`,
        }}
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

        {/* Close X — just above the left of the word bubble */}
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto self-start w-10 h-10 rounded-full flex items-center justify-center text-[#F5E6C8] active:scale-95 transition-transform -mb-1"
          style={{
            background: 'rgba(42,22,12,0.72)',
            border: '2px solid #6B4423',
            boxShadow:
              'inset 0 1px 0 rgba(255,230,180,0.25), 0 3px 8px rgba(0,0,0,0.4)',
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

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
            {variant !== 'island' && <span
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
            />}

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
          {variant !== 'island' && <div className="flex flex-col items-center flex-shrink-0 pointer-events-none">
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
          </div>}

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

            {showAskOwn && !composing && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="pointer-events-auto w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-display font-bold text-sm leading-tight text-[#F5E6C8] active:scale-[0.97] transition-transform"
                style={{
                  minHeight: 44,
                  backgroundImage: `url(${WOOD_TEX})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '2px solid #6B4423',
                  textShadow: CARVED_TEXT_SHADOW,
                  boxShadow:
                    '0 3px 0 rgba(62,31,7,0.6), 0 5px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
                }}
                aria-label={`Ask ${character.name} your own question`}
              >
                <MessageCircle size={16} />
                Ask my own question
              </button>
            )}

            {showAskOwn && composing && (
              <form
                className="pointer-events-auto flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOwnQuestion();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  maxLength={200}
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="on"
                  placeholder={`Ask ${character.name} anything…`}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1 min-w-0 rounded-full px-4 py-2.5 font-display font-semibold text-sm text-[#3D2314] placeholder:text-[#9a7a4a] outline-none"
                  style={{
                    minHeight: 44,
                    background: 'rgba(255,252,240,0.96)',
                    border: '2px solid #A8834C',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.28)',
                  }}
                  aria-label={`Type a question for ${character.name}`}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-[#F5E6C8] active:scale-95 transition-transform disabled:opacity-45"
                  style={{
                    backgroundImage: `url(${WOOD_TEX})`,
                    backgroundSize: 'cover',
                    border: '2px solid #6B4423',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.4)',
                  }}
                  aria-label="Send question"
                >
                  <Send size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrewChatPopup;
