import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PartyPopper, RefreshCw, Star } from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { getApiBaseUrl } from '../services/apiService';
import {
  PuzzleScoreEntry,
  defaultPuzzlePlayerName,
  getPuzzleLeaderboard,
  recordPuzzleScore,
} from '../services/puzzleLeaderboardService';
import {
  Board,
  GRID_SIZE_BY_DIFFICULTY,
  PuzzleDifficulty,
  isSolved,
  parseDifficulty,
  scrambleSequence,
  solvedBoard,
  starsForMoves,
  swapTiles,
  tileBackgroundPosition,
} from '../utils/slidingPuzzle';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
} from '../utils/islandSceneReturn';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const TILE_GAP_PX = 2;
const SCRAMBLE_TOTAL_MS = 1100;
const SCRAMBLE_HOLD_SOLVED_MS = 140;
const CONFETTI_COLORS = [
  '#FFD700',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96E6A1',
  '#DDA0DD',
  '#FCD34D',
];

const PuzzleConfetti: React.FC = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        rotation: Math.random() * 360,
        duration: 2 + Math.random() * 2.2,
        delay: Math.random() * 0.55,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        size: 6 + Math.floor(Math.random() * 6),
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-12px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `puzzle-confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes puzzle-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const formatScoreDate = (at: number): string => {
  try {
    return new Date(at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
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

const resolveMediaUrl = (url: string | undefined | null): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  const base = getApiBaseUrl().replace(/\/$/, '');
  const origin = base.replace(/\/api$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
};

type PuzzleCms = {
  enabled?: boolean;
  type?: string;
  imageUrl?: string;
  difficulties?: PuzzleDifficulty[];
  defaultDifficulty?: PuzzleDifficulty;
};

type StoryCms = {
  _id?: string;
  title?: string;
  displayTitle?: string;
  puzzle?: PuzzleCms;
};

type Phase = 'loading' | 'pick' | 'playing' | 'won' | 'missing';

/**
 * Image swap puzzle for island activities.
 * Tap one tile to select, tap another to swap — or tap the same again to deselect.
 * Route: /sail/:islandId/lesson/puzzle
 */
const IslandSlidingPuzzlePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playClick } = useAudio();
  const navState = location.state as {
    title?: string;
    fromMainMap?: boolean;
    fromSail?: boolean;
  } | null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('PUZZLE');
  const [storyId, setStoryId] = useState('');
  const [available, setAvailable] = useState<PuzzleDifficulty[]>([
    'easy',
    'medium',
    'hard',
  ]);
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('easy');
  const [board, setBoard] = useState<Board>([]);
  const [moves, setMoves] = useState(0);
  const [scrambling, setScrambling] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [winStars, setWinStars] = useState<1 | 2 | 3>(1);
  const [leaderboard, setLeaderboard] = useState<PuzzleScoreEntry[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);

  const scrambleTimerRef = useRef<number | null>(null);
  const scrambleGenRef = useRef(0);
  const scoredWinRef = useRef(false);

  const size = GRID_SIZE_BY_DIFFICULTY[difficulty];

  const clearScrambleTimer = useCallback(() => {
    if (scrambleTimerRef.current != null) {
      window.clearTimeout(scrambleTimerRef.current);
      scrambleTimerRef.current = null;
    }
  }, []);

  const startGame = useCallback(
    (diff: PuzzleDifficulty) => {
      const nextSize = GRID_SIZE_BY_DIFFICULTY[diff];
      const frames = scrambleSequence(nextSize);
      const gen = ++scrambleGenRef.current;
      clearScrambleTimer();

      setDifficulty(diff);
      setMoves(0);
      setSelectedIndex(null);
      setWinStars(1);
      setIsNewBest(false);
      scoredWinRef.current = false;
      setPhase('playing');
      setScrambling(true);
      setBoard(frames[0] ?? solvedBoard(nextSize));
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('difficulty', diff);
          return next;
        },
        { replace: true },
      );

      if (frames.length <= 1) {
        setScrambling(false);
        return;
      }

      const stepMs = Math.max(
        28,
        Math.floor(SCRAMBLE_TOTAL_MS / (frames.length - 1)),
      );
      let i = 1;
      const tick = () => {
        if (gen !== scrambleGenRef.current) return;
        setBoard(frames[i]);
        i += 1;
        if (i >= frames.length) {
          setScrambling(false);
          scrambleTimerRef.current = null;
          return;
        }
        scrambleTimerRef.current = window.setTimeout(tick, stepMs);
      };
      scrambleTimerRef.current = window.setTimeout(tick, SCRAMBLE_HOLD_SOLVED_MS);
    },
    [clearScrambleTimer, setSearchParams],
  );

  useEffect(() => () => clearScrambleTimer(), [clearScrambleTimer]);

  useEffect(() => {
    let cancelled = false;
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
        const storyId = searchParams.get('storyId');
        const story =
          (storyId && stories.find((s) => s._id === storyId)) ||
          stories.find(
            (s) =>
              s.puzzle?.enabled &&
              s.puzzle?.type === 'sliding_image' &&
              s.puzzle?.imageUrl,
          ) ||
          stories[0];

        const puzzle = story?.puzzle;
        const url = resolveMediaUrl(puzzle?.imageUrl);
        if (cancelled) return;

        if (
          !puzzle?.enabled ||
          puzzle.type !== 'sliding_image' ||
          !url
        ) {
          setPhase('missing');
          return;
        }

        const diffs =
          Array.isArray(puzzle.difficulties) && puzzle.difficulties.length > 0
            ? puzzle.difficulties.filter(
                (d): d is PuzzleDifficulty =>
                  d === 'easy' || d === 'medium' || d === 'hard',
              )
            : (['easy', 'medium', 'hard'] as PuzzleDifficulty[]);

        const defaultDiff = parseDifficulty(
          searchParams.get('difficulty') || puzzle.defaultDifficulty,
          diffs[0] || 'easy',
        );
        const resolvedDiff = diffs.includes(defaultDiff)
          ? defaultDiff
          : diffs[0] || 'easy';

        setImageUrl(url);
        setTitle(
          (story?.displayTitle || story?.title || 'PUZZLE').toUpperCase(),
        );
        setStoryId(story?._id || searchParams.get('storyId') || '');
        setAvailable(diffs);
        setDifficulty(resolvedDiff);

        // Skip picker when only one difficulty or URL already chose one
        if (diffs.length === 1 || searchParams.get('difficulty')) {
          startGame(resolvedDiff);
        } else {
          setPhase('pick');
        }
      } catch {
        if (!cancelled) setPhase('missing');
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // Intentionally once per island (query changes handled via startGame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandId]);

  const onTileTap = useCallback(
    (index: number) => {
      if (phase !== 'playing' || scrambling) return;

      if (selectedIndex == null) {
        setSelectedIndex(index);
        return;
      }

      if (selectedIndex === index) {
        setSelectedIndex(null);
        return;
      }

      const next = swapTiles(board, selectedIndex, index);
      setSelectedIndex(null);
      if (!next) return;
      playClick();
      setBoard(next);
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      if (isSolved(next)) {
        const stars = starsForMoves(nextMoves, difficulty);
        setWinStars(stars);
        setPhase('won');
      }
    },
    [board, difficulty, moves, phase, playClick, scrambling, selectedIndex],
  );

  // Persist score + load leaderboard once per win
  useEffect(() => {
    if (phase !== 'won' || scoredWinRef.current) return;
    scoredWinRef.current = true;
    const stars = starsForMoves(moves, difficulty);
    setWinStars(stars);
    const previous = getPuzzleLeaderboard(islandId, storyId, difficulty);
    const prevBest = previous[0]?.moves;
    const boardScores = recordPuzzleScore({
      islandId,
      storyId,
      difficulty,
      moves,
      stars,
      name: defaultPuzzlePlayerName(),
    });
    setLeaderboard(boardScores);
    setIsNewBest(prevBest == null || moves < prevBest);
  }, [phase, moves, difficulty, islandId, storyId]);

  const tileIds = useMemo(() => {
    const n = size * size;
    return Array.from({ length: n }, (_, i) => i);
  }, [size]);

  const tileTransition = scrambling
    ? `left ${Math.max(24, Math.floor(SCRAMBLE_TOTAL_MS / 30))}ms linear, top ${Math.max(24, Math.floor(SCRAMBLE_TOTAL_MS / 30))}ms linear`
    : 'left 160ms ease-out, top 160ms ease-out';

  const goBack = useCallback(() => {
    const returnStoryId =
      storyId || searchParams.get('storyId')?.trim() || '';
    const path =
      buildIslandScenePath({
        islandId,
        storyId: returnStoryId || undefined,
      }) || `/sail/${islandId}/lesson`;
    navigate(path, {
      state: buildIslandSceneNavState({
        islandId,
        storyId: returnStoryId || undefined,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
        title: navState?.title || title,
      }),
    });
  }, [navigate, islandId, storyId, searchParams, navState, title]);

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden flex flex-col"
      style={{
        backgroundImage: `url(${WOOD_TEX})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[#2a1810]/70" aria-hidden />

      <header
        className="relative z-10 flex items-center gap-2 px-3 py-2.5"
        style={{
          paddingTop: 'max(var(--safe-area-top, 0px), 8px)',
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.3)',
          borderBottom: '3px solid #5c3a1a',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform"
          style={woodBtnStyle}
          aria-label="Back to island"
        >
          <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
        </button>
        <h1
          className="flex-1 text-center font-display font-black text-white text-[1.05rem] sm:text-lg tracking-wide truncate px-1"
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.55)' }}
        >
          {title}
        </h1>
        <button
          type="button"
          onClick={() => startGame(difficulty)}
          disabled={
            phase === 'loading' ||
            phase === 'missing' ||
            !imageUrl ||
            scrambling
          }
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform disabled:opacity-40"
          style={woodBtnStyle}
          aria-label="Shuffle again"
        >
          <RefreshCw size={20} className="text-white drop-shadow" strokeWidth={2.6} />
        </button>
      </header>

      <main
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4"
        style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 16px)' }}
      >
        {phase === 'loading' && (
          <p className="font-display font-bold text-white/90 text-lg">Loading puzzle…</p>
        )}

        {phase === 'missing' && (
          <div className="text-center space-y-3 max-w-sm mx-auto">
            <p className="font-display font-black text-white text-xl">
              Puzzle coming soon
            </p>
            <p className="text-white/80 text-sm">
              Upload a puzzle image in the Bible Map story pack to unlock this
              activity.
            </p>
            <button
              type="button"
              onClick={goBack}
              className="mt-2 px-5 py-2.5 rounded-full font-display font-bold text-white active:scale-95"
              style={woodBtnStyle}
            >
              Back to island
            </button>
          </div>
        )}

        {phase === 'pick' && (
          <div className="w-full max-w-sm mx-auto space-y-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Puzzle preview"
                className="w-full aspect-square object-cover rounded-xl border-4 border-[#6B4423] shadow-lg"
                draggable={false}
              />
            )}
            <p
              className="text-center font-display font-black text-white text-lg"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
              Pick a difficulty
            </p>
            <div className="flex flex-col gap-2">
              {available.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => startGame(d)}
                  className="w-full py-3 rounded-xl font-display font-black text-white text-lg tracking-wide active:scale-[0.98] transition-transform"
                  style={woodBtnStyle}
                >
                  {d.toUpperCase()}{' '}
                  <span className="opacity-80 text-base font-bold">
                    ({GRID_SIZE_BY_DIFFICULTY[d]}×{GRID_SIZE_BY_DIFFICULTY[d]})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(phase === 'playing' || phase === 'won') && imageUrl && (
          <div className="w-full max-w-[min(100%,360px)] mx-auto flex flex-col items-center gap-4">
            <div className="w-full flex flex-col items-center gap-1 text-white/90 font-display font-bold text-sm text-center">
              <div className="flex items-center justify-center gap-3">
                <span>
                  {difficulty.toUpperCase()} · {size}×{size}
                </span>
                <span aria-hidden>·</span>
                <span>Moves: {moves}</span>
              </div>
              {phase === 'playing' && !scrambling && (
                <span className="text-white/70 text-xs font-semibold">
                  {selectedIndex == null
                    ? 'Tap a piece, then another to swap'
                    : 'Tap another piece to swap'}
                </span>
              )}
            </div>

            <div
              className="relative w-full aspect-square rounded-xl overflow-hidden border-4 border-[#6B4423] shadow-2xl touch-none select-none"
              style={{ background: '#5c3a1a' }}
              role="grid"
              aria-label="Swap puzzle"
              aria-busy={scrambling}
            >
              {tileIds.map((tileId) => {
                const index = board.indexOf(tileId);
                if (index < 0) return null;
                const row = Math.floor(index / size);
                const col = index % size;
                const selected = selectedIndex === index;
                return (
                  <button
                    key={`tile-${tileId}`}
                    type="button"
                    role="gridcell"
                    aria-label={`Tile ${tileId + 1}${selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    disabled={scrambling}
                    className="absolute p-0 border-0 outline-none cursor-pointer active:brightness-95 disabled:cursor-default"
                    style={{
                      width: `calc((100% - ${(size - 1) * TILE_GAP_PX}px) / ${size})`,
                      height: `calc((100% - ${(size - 1) * TILE_GAP_PX}px) / ${size})`,
                      left: `calc(${col} * ((100% - ${(size - 1) * TILE_GAP_PX}px) / ${size} + ${TILE_GAP_PX}px))`,
                      top: `calc(${row} * ((100% - ${(size - 1) * TILE_GAP_PX}px) / ${size} + ${TILE_GAP_PX}px))`,
                      transition: tileTransition,
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: `${size * 100}% ${size * 100}%`,
                      backgroundPosition: tileBackgroundPosition(tileId, size),
                      backgroundRepeat: 'no-repeat',
                      boxShadow: selected
                        ? 'inset 0 0 0 3px #FCD34D, 0 0 0 2px #B45309'
                        : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
                      zIndex: selected ? 2 : 1,
                      filter: selected ? 'brightness(1.08)' : undefined,
                    }}
                    onClick={() => onTileTap(index)}
                  />
                );
              })}
            </div>

            {available.length > 1 && phase === 'playing' && (
              <div className="w-full flex gap-2 flex-wrap justify-center">
                {available.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => startGame(d)}
                    disabled={scrambling}
                    className={`px-3 py-1.5 rounded-full font-display font-bold text-xs text-white active:scale-95 disabled:opacity-50 ${
                      d === difficulty ? 'ring-2 ring-amber-300' : 'opacity-80'
                    }`}
                    style={woodBtnStyle}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {phase === 'won' && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="puzzle-win-title"
        >
          <PuzzleConfetti />
          <div
            className="relative w-full max-w-sm rounded-2xl p-5 text-center space-y-3 max-h-[min(92dvh,640px)] overflow-y-auto"
            style={{
              ...woodBtnStyle,
              boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
              scrollbarWidth: 'none',
            }}
          >
            <PartyPopper
              size={36}
              className="mx-auto text-amber-200 drop-shadow"
              strokeWidth={2.2}
            />
            <h2
              id="puzzle-win-title"
              className="font-display font-black text-white text-2xl"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
            >
              You did it!
            </h2>

            <div
              className="flex items-center justify-center gap-1.5"
              role="img"
              aria-label={`${winStars} out of 3 stars`}
            >
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  size={34}
                  className={
                    n <= winStars
                      ? 'text-amber-300 drop-shadow'
                      : 'text-white/25'
                  }
                  fill={n <= winStars ? '#FCD34D' : 'transparent'}
                  strokeWidth={2.2}
                />
              ))}
            </div>

            <p className="text-white/90 text-sm">
              {moves} move{moves === 1 ? '' : 's'}
              {isNewBest ? ' · New best!' : ''}
            </p>

            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="w-full max-w-[160px] mx-auto aspect-square object-cover rounded-xl border-2 border-[#8B6914]"
                draggable={false}
              />
            )}

            {leaderboard.length > 0 && (
              <div className="text-left rounded-xl bg-black/25 border border-[#8B6914]/60 px-3 py-2.5">
                <p
                  className="font-display font-black text-amber-200 text-xs tracking-wide mb-1.5"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  Best scores · {difficulty}
                </p>
                <ul className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <li
                      key={`${entry.at}-${entry.moves}-${i}`}
                      className="flex items-center gap-2 text-white/90 text-xs"
                    >
                      <span className="w-4 font-display font-bold text-amber-200/90">
                        {i + 1}.
                      </span>
                      <span className="flex-1 truncate font-semibold">
                        {entry.name}
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: entry.stars }).map((_, s) => (
                          <Star
                            key={s}
                            size={11}
                            className="text-amber-300"
                            fill="#FCD34D"
                            strokeWidth={2}
                          />
                        ))}
                      </span>
                      <span className="shrink-0 tabular-nums font-bold w-12 text-right">
                        {entry.moves}m
                      </span>
                      <span className="shrink-0 text-white/55 w-10 text-right">
                        {formatScoreDate(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => startGame(difficulty)}
                className="w-full py-3 rounded-xl font-display font-black text-white text-lg active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                  border: '2px solid #E8C060',
                  boxShadow: '0 3px 0 #5c3a1a',
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={goBack}
                className="w-full py-2.5 rounded-xl font-display font-bold text-white/95 text-base active:scale-[0.98]"
                style={woodBtnStyle}
              >
                Back to island
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IslandSlidingPuzzlePage;
