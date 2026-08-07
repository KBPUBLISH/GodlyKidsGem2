import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Gift, PartyPopper, X } from 'lucide-react';
import WoodBackButton from '../components/WoodBackButton';
import { getApiBaseUrl } from '../services/apiService';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import {
  resolveRewardPool,
  type RewardDefinition,
} from '../services/rewardsService';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
} from '../utils/islandSceneReturn';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

type QuizLevel = 'easy' | 'medium' | 'hard';

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type StoryCms = {
  _id?: string;
  title?: string;
  displayTitle?: string;
  quizMode?: 'book_quiz' | 'custom' | 'none';
  customQuestions?: QuizQuestion[];
  quiz?: {
    defaultLevel?: QuizLevel;
    levels?: Partial<Record<QuizLevel, QuizQuestion[]>>;
  };
  bookId?: string | { _id?: string };
  heroImageUrl?: string;
  /** Story pack rewards config (used for the Claim Treasure reveal). */
  rewards?: { enabled?: boolean; pool?: RewardDefinition[] };
  game?: {
    enabled?: boolean;
    kind?: string;
    gameId?: string;
    webview?: { title?: string; url?: string; coverImage?: string };
  };
};

type Phase = 'loading' | 'pick' | 'playing' | 'done' | 'missing';

const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

const normalizeQuestions = (list: QuizQuestion[] | undefined): QuizQuestion[] =>
  (Array.isArray(list) ? list : [])
    .map((q) => ({
      question: String(q.question || '').trim(),
      options: (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o ?? '').trim())
        .filter(Boolean)
        .slice(0, 4),
      correctIndex:
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 ? q.correctIndex : 0,
      explanation: String(q.explanation || '').trim(),
    }))
    .filter((q) => q.question && q.options.length >= 2);

const levelsFromStory = (
  story: StoryCms | undefined,
): { levels: Partial<Record<QuizLevel, QuizQuestion[]>>; defaultLevel: QuizLevel } => {
  const easy = normalizeQuestions(story?.quiz?.levels?.easy);
  const medium = normalizeQuestions(story?.quiz?.levels?.medium);
  const hard = normalizeQuestions(story?.quiz?.levels?.hard);
  if (easy.length || medium.length || hard.length) {
    const defaultLevel =
      story?.quiz?.defaultLevel === 'medium' || story?.quiz?.defaultLevel === 'hard'
        ? story.quiz.defaultLevel
        : 'easy';
    return { levels: { easy, medium, hard }, defaultLevel };
  }
  const legacy = normalizeQuestions(story?.customQuestions);
  return { levels: { easy: legacy, medium: [], hard: [] }, defaultLevel: 'easy' };
};

const IslandQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId = 'genesis' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navState = location.state as {
    title?: string;
    fromMainMap?: boolean;
    fromSail?: boolean;
  } | null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('QUIZZ');
  const [storyId, setStoryId] = useState('');
  const [available, setAvailable] = useState<QuizLevel[]>([]);
  const [difficulty, setDifficulty] = useState<QuizLevel>('easy');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [score, setScore] = useState(0);
  /** Full CMS story — needed for its reward pool when claiming treasure. */
  const [rewardStory, setRewardStory] = useState<StoryCms | null>(null);

  const current = questions[index];

  const returnStoryId =
    storyId || searchParams.get('storyId')?.trim() || undefined;

  const sceneBackPath =
    buildIslandScenePath({
      islandId,
      storyId: returnStoryId,
    }) || `/sail/${islandId}/lesson`;

  const goBackToScene = useCallback(() => {
    navigate(sceneBackPath, {
      state: buildIslandSceneNavState({
        islandId,
        storyId: returnStoryId,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
        title: navState?.title || title,
      }),
    });
  }, [navigate, sceneBackPath, islandId, returnStoryId, navState, title]);

  // Persist quiz completion as soon as the results screen is shown
  useEffect(() => {
    if (phase !== 'done') return;
    const sid = storyId || searchParams.get('storyId') || '';
    if (!sid) return;
    islandStoryProgressService.markComplete(islandId, sid, 'quiz');
  }, [phase, islandId, storyId, searchParams]);

  const loadStoryQuiz = useCallback(
    async (controller: AbortController) => {
      const res = await fetch(
        `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error('Island not found');
      const data = (await res.json()) as { stories?: StoryCms[] };
      const stories = Array.isArray(data.stories) ? data.stories : [];
      const wantedId = searchParams.get('storyId');

      const story =
        (wantedId && stories.find((s) => s._id === wantedId)) ||
        stories.find((s) => {
          if (s.quizMode === 'none') return false;
          const { levels } = levelsFromStory(s);
          return (['easy', 'medium', 'hard'] as QuizLevel[]).some(
            (l) => (levels[l]?.length || 0) > 0,
          );
        }) ||
        stories.find((s) => s.quizMode === 'custom' || s.quizMode === 'book_quiz');

      if (!story || story.quizMode === 'none') {
        setPhase('missing');
        return;
      }

      const { levels, defaultLevel } = levelsFromStory(story);
      const diffs = (['easy', 'medium', 'hard'] as QuizLevel[]).filter(
        (l) => (levels[l]?.length || 0) > 0,
      );

      // book_quiz with no custom levels — send kids to book reader quiz for now
      if (diffs.length === 0) {
        const bookId =
          typeof story.bookId === 'object' ? story.bookId?._id : story.bookId;
        if (story.quizMode === 'book_quiz' && bookId) {
          navigate(`/book/${bookId}`, {
            replace: true,
            state: { fromIslandLesson: islandId, openQuiz: true },
          });
          return;
        }
        setPhase('missing');
        return;
      }

      const urlDiff = searchParams.get('difficulty') as QuizLevel | null;
      const resolved =
        urlDiff && diffs.includes(urlDiff)
          ? urlDiff
          : diffs.includes(defaultLevel)
            ? defaultLevel
            : diffs[0]!;

      setTitle((story.displayTitle || story.title || 'QUIZZ').toUpperCase());
      setStoryId(story._id || wantedId || '');
      setRewardStory(story);
      setAvailable(diffs);
      setDifficulty(resolved);

      if (diffs.length === 1 || searchParams.get('difficulty')) {
        setQuestions(levels[resolved] || []);
        setIndex(0);
        setSelected(null);
        setRevealed(false);
        setWasCorrect(false);
        setScore(0);
        setPhase('playing');
      } else {
        setPhase('pick');
      }
    },
    [islandId, navigate, searchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    setPhase('loading');
    void loadStoryQuiz(controller).catch(() => setPhase('missing'));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandId]);

  const startLevel = (level: QuizLevel) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('difficulty', level);
        if (storyId) next.set('storyId', storyId);
        return next;
      },
      { replace: true },
    );
    // Reload questions for chosen level from already-fetched available path:
    // re-fetch quickly to stay consistent with CMS
    void (async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { stories?: StoryCms[] };
        const stories = Array.isArray(data.stories) ? data.stories : [];
        const story =
          (storyId && stories.find((s) => s._id === storyId)) ||
          stories.find((s) => levelsFromStory(s).levels[level]?.length);
        const qs = levelsFromStory(story).levels[level] || [];
        if (story) setRewardStory(story);
        setDifficulty(level);
        setQuestions(qs);
        setIndex(0);
        setSelected(null);
        setRevealed(false);
        setWasCorrect(false);
        setScore(0);
        setPhase(qs.length ? 'playing' : 'missing');
      } catch {
        setPhase('missing');
      }
    })();
  };

  const onPick = (optionIndex: number) => {
    if (!current || revealed) return;
    const correct = optionIndex === current.correctIndex;
    setSelected(optionIndex);
    setRevealed(true);
    setWasCorrect(correct);
    if (correct) setScore((s) => s + 1);
  };

  const goNext = () => {
    if (!revealed) return;
    if (index >= questions.length - 1) {
      setPhase('done');
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setWasCorrect(false);
  };

  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return ((index + (revealed ? 1 : 0)) / questions.length) * 100;
  }, [index, questions.length, revealed]);

  /** Treasure is earned at half right or better. */
  const earnedTreasure = questions.length > 0 && score / questions.length >= 0.5;

  const claimTreasure = useCallback(() => {
    const sid = storyId || searchParams.get('storyId')?.trim() || '';
    if (sid) {
      // Same bookkeeping as the scene's REWARDS activity (goRewards).
      islandStoryProgressService.markComplete(islandId, sid, 'rewards');
    }
    navigate('/sail/treasure', {
      state: {
        storyId: sid,
        storyTitle:
          rewardStory?.displayTitle || rewardStory?.title || navState?.title,
        pool: resolveRewardPool(rewardStory),
        returnTo: sceneBackPath,
      },
    });
  }, [
    navigate,
    storyId,
    searchParams,
    islandId,
    rewardStory,
    navState?.title,
    sceneBackPath,
  ]);

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden"
      style={{
        backgroundImage: `url(${WOOD_TEX})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Warm brown darken — same as puzzle/coloring; avoid green under translucent wood */}
      <div className="absolute inset-0 bg-[#2a1810]/70 pointer-events-none" aria-hidden />

      <div className="relative z-10 flex flex-col h-full px-4 pt-[max(12px,var(--safe-area-top))] pb-[max(12px,var(--safe-area-bottom))]">
        <div className="flex items-center gap-3 mb-3">
          <WoodBackButton
            onClick={goBackToScene}
            className="w-11 h-11 flex-shrink-0"
            aria-label="Back"
          />
          <h1
            className="flex-1 text-center text-white text-xl font-black tracking-wide drop-shadow"
            style={{ fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif' }}
          >
            {title}
          </h1>
          <div className="w-11" />
        </div>

        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center text-white/90 font-bold">
            Loading quiz…
          </div>
        )}

        {phase === 'missing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-white text-lg font-bold mb-2">Quiz coming soon</p>
            <p className="text-white/80 text-sm mb-6">
              This island doesn&apos;t have quiz questions yet.
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

        {phase === 'pick' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <p className="text-white text-lg font-bold drop-shadow mb-2">Choose a level</p>
            {available.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => startLevel(level)}
                className="w-full max-w-xs py-3 rounded-xl text-white text-lg font-black active:scale-95 transition-transform"
                style={woodBtnStyle}
              >
                {LEVEL_LABEL[level]}
              </button>
            ))}
          </div>
        )}

        {phase === 'playing' && current && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-3">
              <div className="flex justify-between text-white/90 text-xs font-bold mb-1">
                <span>
                  {LEVEL_LABEL[difficulty]} · {index + 1}/{questions.length}
                </span>
                <span>{score} correct</span>
              </div>
              <div className="h-2 rounded-full bg-black/25 overflow-hidden">
                <div
                  className="h-full bg-[#F5C518] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl bg-[#FFF8E7]/95 border-2 border-[#6B4423] p-4 shadow-lg">
              <h2
                className="text-[#3E2723] text-xl font-black mb-4 leading-snug"
                style={{ fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif' }}
              >
                {current.question}
              </h2>

              <div className="space-y-2.5">
                {current.options.map((opt, oi) => {
                  const isCorrect = oi === current.correctIndex;
                  const isSelected = selected === oi;
                  let cls =
                    'w-full text-left px-3 py-3 rounded-xl border-2 font-bold transition-all ';
                  if (!revealed) {
                    cls +=
                      'border-[#c4a574] bg-white text-[#3E2723] active:scale-[0.98] hover:border-[#8B4513]';
                  } else if (isCorrect) {
                    cls += 'border-[#2E7D32] bg-[#C8E6C9] text-[#1B5E20]';
                  } else if (isSelected) {
                    cls += 'border-[#C62828] bg-[#FFCDD2] text-[#B71C1C] line-through';
                  } else {
                    cls += 'border-transparent bg-[#eee6d6] text-[#5D4037]/70';
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={revealed}
                      onClick={() => onPick(oi)}
                      className={cls}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[#d4c59a] text-[#3E2723] text-sm flex items-center justify-center shrink-0">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {revealed && isCorrect && (
                          <Check className="w-5 h-5 text-[#2E7D32] shrink-0" />
                        )}
                        {revealed && isSelected && !isCorrect && (
                          <X className="w-5 h-5 text-[#C62828] shrink-0" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div
                  className={`mt-4 rounded-xl px-3 py-3 text-sm font-semibold ${
                    wasCorrect
                      ? 'bg-[#E8F5E9] text-[#1B5E20] border border-[#81C784]'
                      : 'bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D]'
                  }`}
                >
                  {wasCorrect ? (
                    <p>Great job! That&apos;s right.</p>
                  ) : (
                    <>
                      <p className="mb-1">
                        Not quite — the correct answer is{' '}
                        <span className="font-black">
                          {current.options[current.correctIndex]}
                        </span>
                        .
                      </p>
                      {current.explanation ? (
                        <p className="text-[#5D4037] font-medium">{current.explanation}</p>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!revealed}
                onClick={goNext}
                className="px-6 py-3 rounded-xl text-white font-black disabled:opacity-40 active:scale-95"
                style={woodBtnStyle}
              >
                {index >= questions.length - 1 ? 'See results' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative">
            <PartyPopper className="w-14 h-14 text-[#F5C518] mb-3 drop-shadow" />
            <h2 className="text-white text-2xl font-black mb-2 drop-shadow">Quiz complete!</h2>
            <p className="text-white/90 text-lg font-bold mb-6">
              You got {score} of {questions.length} right
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {earnedTreasure && (
                <button
                  type="button"
                  onClick={claimTreasure}
                  className="py-3.5 rounded-xl font-black text-lg text-[#3d2314] flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{
                    background:
                      'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
                    boxShadow:
                      '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
                    border: '2px solid #F5E6A3',
                  }}
                >
                  <Gift size={22} strokeWidth={2.4} />
                  Claim Treasure
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setSelected(null);
                  setRevealed(false);
                  setWasCorrect(false);
                  setScore(0);
                  setPhase(available.length > 1 ? 'pick' : 'playing');
                }}
                className="py-3 rounded-xl text-white font-black"
                style={woodBtnStyle}
              >
                Play again
              </button>
              <button
                type="button"
                onClick={goBackToScene}
                className="py-3 rounded-xl text-white/95 font-bold border-2 border-white/40"
              >
                Back to activities
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IslandQuizPage;
