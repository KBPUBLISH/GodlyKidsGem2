import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, PartyPopper, RefreshCw, Star } from 'lucide-react';
import {
  GRID_SIZE_BY_DIFFICULTY,
  isSolved,
  scrambleSequence,
  solvedBoard,
  starsForMoves,
  swapTiles,
  tileBackgroundPosition,
} from '../utils/slidingPuzzle';
import type { Board, PuzzleDifficulty } from '../utils/slidingPuzzle';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const PHONE_W = 390;
const PHONE_H = 844;
const SCALE = 0.58;
const TILE_GAP_PX = 2;
const SCRAMBLE_TOTAL_MS = 1100;
const SCRAMBLE_HOLD_SOLVED_MS = 140;
const PREVIEW_LB_KEY = 'godlykids_puzzle_lb_preview';
const CONFETTI_COLORS = [
  '#FFD700',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96E6A1',
  '#DDA0DD',
  '#FCD34D',
];

/** Soft click matching kid-app `useAudio().playClick` (Web Audio sine, no CMS asset). */
let previewSfxCtx: AudioContext | null = null;
const playPreviewSwapClick = () => {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!previewSfxCtx) previewSfxCtx = new AC();
    const ctx = previewSfxCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    /* ignore autoplay / AudioContext errors in portal */
  }
};

type PreviewScore = {
  boardId: string;
  difficulty: PuzzleDifficulty;
  moves: number;
  stars: 1 | 2 | 3;
  name: string;
  at: number;
};

const previewBoardId = (imageUrl: string, difficulty: PuzzleDifficulty) =>
  `${imageUrl.slice(0, 80)}::${difficulty}`;

const readPreviewScores = (): PreviewScore[] => {
  try {
    const raw = localStorage.getItem(PREVIEW_LB_KEY);
    return raw ? (JSON.parse(raw) as PreviewScore[]) : [];
  } catch {
    return [];
  }
};

const recordPreviewScore = (
  imageUrl: string,
  difficulty: PuzzleDifficulty,
  moves: number,
  stars: 1 | 2 | 3,
): PreviewScore[] => {
  const boardId = previewBoardId(imageUrl, difficulty);
  const entry: PreviewScore = {
    boardId,
    difficulty,
    moves,
    stars,
    name: 'Editor',
    at: Date.now(),
  };
  const all = readPreviewScores();
  const others = all.filter((e) => e.boardId !== boardId);
  const board = all
    .filter((e) => e.boardId === boardId)
    .concat(entry)
    .sort((a, b) => a.moves - b.moves || b.at - a.at)
    .slice(0, 5);
  try {
    localStorage.setItem(PREVIEW_LB_KEY, JSON.stringify([...others, ...board]));
  } catch {
    /* ignore quota */
  }
  return board;
};

const PuzzleConfetti: React.FC = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        rotation: Math.random() * 360,
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 0.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        size: 6 + Math.floor(Math.random() * 5),
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
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animation: `portal-puzzle-confetti ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes portal-puzzle-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const displayFont: React.CSSProperties = {
  fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif',
};

type Phase = 'pick' | 'playing' | 'won';

export interface SlidingPuzzlePreviewProps {
  imageUrl: string;
  title?: string;
  difficulties?: PuzzleDifficulty[];
  defaultDifficulty?: PuzzleDifficulty;
}

/**
 * Phone-framed mirror of the kid-app swap puzzle (IslandSlidingPuzzlePage).
 * Playable Start → scramble → tap-to-swap so editors can verify image cut/framing.
 */
const SlidingPuzzlePreview: React.FC<SlidingPuzzlePreviewProps> = ({
  imageUrl,
  title = 'PUZZLE',
  difficulties,
  defaultDifficulty = 'easy',
}) => {
  const available = useMemo(() => {
    const list =
      Array.isArray(difficulties) && difficulties.length > 0
        ? difficulties.filter(
            (d): d is PuzzleDifficulty =>
              d === 'easy' || d === 'medium' || d === 'hard',
          )
        : (['easy', 'medium', 'hard'] as PuzzleDifficulty[]);
    return list.length > 0 ? list : (['easy'] as PuzzleDifficulty[]);
  }, [difficulties]);

  const resolvedDefault = available.includes(defaultDifficulty)
    ? defaultDifficulty
    : available[0];

  const [phase, setPhase] = useState<Phase>('pick');
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>(resolvedDefault);
  const [board, setBoard] = useState<Board>([]);
  const [moves, setMoves] = useState(0);
  const [scrambling, setScrambling] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [winStars, setWinStars] = useState<1 | 2 | 3>(1);
  const [leaderboard, setLeaderboard] = useState<PreviewScore[]>([]);
  const scrambleTimerRef = useRef<number | null>(null);
  const scrambleGenRef = useRef(0);
  const scoredWinRef = useRef(false);

  const availableKey = available.join(',');

  const clearScrambleTimer = useCallback(() => {
    if (scrambleTimerRef.current != null) {
      window.clearTimeout(scrambleTimerRef.current);
      scrambleTimerRef.current = null;
    }
  }, []);

  // Reset to pick when image / difficulty config changes
  useEffect(() => {
    scrambleGenRef.current += 1;
    clearScrambleTimer();
    setScrambling(false);
    setSelectedIndex(null);
    setPhase('pick');
    setBoard([]);
    setMoves(0);
    setDifficulty(resolvedDefault);
  }, [imageUrl, resolvedDefault, availableKey, clearScrambleTimer]);

  useEffect(() => () => clearScrambleTimer(), [clearScrambleTimer]);

  const size = GRID_SIZE_BY_DIFFICULTY[difficulty];

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
      scoredWinRef.current = false;
      setPhase('playing');
      setScrambling(true);
      setBoard(frames[0] ?? solvedBoard(nextSize));

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
    [clearScrambleTimer],
  );

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
      playPreviewSwapClick();
      setBoard(next);
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      if (isSolved(next)) {
        setWinStars(starsForMoves(nextMoves, difficulty));
        setPhase('won');
      }
    },
    [board, difficulty, moves, phase, scrambling, selectedIndex],
  );

  useEffect(() => {
    if (phase !== 'won' || scoredWinRef.current) return;
    scoredWinRef.current = true;
    const stars = starsForMoves(moves, difficulty);
    setWinStars(stars);
    setLeaderboard(recordPreviewScore(imageUrl, difficulty, moves, stars));
  }, [phase, moves, difficulty, imageUrl]);

  const tileIds = useMemo(() => {
    const n = size * size;
    return Array.from({ length: n }, (_, i) => i);
  }, [size]);

  const tileTransition = scrambling
    ? `left ${Math.max(24, Math.floor(SCRAMBLE_TOTAL_MS / 30))}ms linear, top ${Math.max(24, Math.floor(SCRAMBLE_TOTAL_MS / 30))}ms linear`
    : 'left 160ms ease-out, top 160ms ease-out';

  const heading = (title || 'PUZZLE').toUpperCase();
  const hasImage = !!imageUrl.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">App preview</h3>
        <span className="text-[11px] text-gray-500">
          Matches /sail/…/lesson/puzzle
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Tap Start (or a difficulty), then tap two tiles to swap and verify the
        image cut.
      </p>

      <div className="flex justify-center py-2">
        <div
          className="relative bg-black shadow-xl"
          style={{
            width: PHONE_W * SCALE,
            height: PHONE_H * SCALE,
            borderRadius: 28,
            border: '10px solid #1f2937',
            // Keep bezel outside the scaled screen so content isn't clipped right/bottom
            boxSizing: 'content-box',
            boxShadow:
              '0 12px 40px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Notch */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 z-30 bg-[#1f2937] rounded-b-xl"
            style={{ width: 72, height: 14 }}
            aria-hidden
          />

          <div
            className="origin-top-left"
            style={{
              width: PHONE_W,
              height: PHONE_H,
              transform: `scale(${SCALE})`,
            }}
          >
            <div
              className="relative w-full h-full overflow-hidden flex flex-col"
              style={{
                backgroundImage: `url(${WOOD_TEX})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                ...displayFont,
              }}
            >
              <div className="absolute inset-0 bg-[#2a1810]/70" aria-hidden />

              <header
                className="relative z-10 flex items-center gap-2 px-3 py-2.5"
                style={{
                  paddingTop: 28,
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
                  onClick={() => {
                    scrambleGenRef.current += 1;
                    clearScrambleTimer();
                    setScrambling(false);
                    setSelectedIndex(null);
                    setPhase('pick');
                    setBoard([]);
                    setMoves(0);
                  }}
                  className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform"
                  style={woodBtnStyle}
                  aria-label="Back to difficulty pick"
                >
                  <ArrowLeft
                    size={22}
                    className="text-white drop-shadow"
                    strokeWidth={2.6}
                  />
                </button>
                <h1
                  className="flex-1 text-center font-black text-white text-[1.05rem] tracking-wide truncate px-1"
                  style={{
                    ...displayFont,
                    textShadow: '0 2px 4px rgba(0,0,0,0.55)',
                  }}
                >
                  {heading}
                </h1>
                <button
                  type="button"
                  onClick={() => startGame(difficulty)}
                  disabled={!hasImage || phase === 'pick' || scrambling}
                  className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform disabled:opacity-40"
                  style={woodBtnStyle}
                  aria-label="Shuffle again"
                >
                  <RefreshCw
                    size={20}
                    className="text-white drop-shadow"
                    strokeWidth={2.6}
                  />
                </button>
              </header>

              <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 pb-5">
                {!hasImage && (
                  <div className="text-center space-y-2 max-w-sm mx-auto px-2">
                    <p
                      className="font-black text-white text-xl"
                      style={displayFont}
                    >
                      Puzzle coming soon
                    </p>
                    <p className="text-white/80 text-sm">
                      Upload a puzzle image to preview the swap board.
                    </p>
                  </div>
                )}

                {hasImage && phase === 'pick' && (
                  <div className="w-full max-w-sm mx-auto space-y-4">
                    <img
                      src={imageUrl}
                      alt="Puzzle preview"
                      className="w-full aspect-square object-cover rounded-xl border-4 border-[#6B4423] shadow-lg"
                      draggable={false}
                    />
                    <p
                      className="text-center font-black text-white text-lg"
                      style={{
                        ...displayFont,
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      }}
                    >
                      Pick a difficulty
                    </p>
                    <div className="flex flex-col gap-2">
                      {available.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => startGame(d)}
                          className="w-full py-3 rounded-xl font-black text-white text-lg tracking-wide active:scale-[0.98] transition-transform"
                          style={
                            available.length === 1
                              ? {
                                  background:
                                    'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                                  border: '2px solid #E8C060',
                                  boxShadow: '0 3px 0 #5c3a1a',
                                  ...displayFont,
                                }
                              : { ...woodBtnStyle, ...displayFont }
                          }
                        >
                          {available.length === 1 ? 'Start · ' : ''}
                          {d.toUpperCase()}{' '}
                          <span className="opacity-80 text-base font-bold">
                            ({GRID_SIZE_BY_DIFFICULTY[d]}×
                            {GRID_SIZE_BY_DIFFICULTY[d]})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasImage && (phase === 'playing' || phase === 'won') && (
                  <div className="w-full max-w-[min(100%,360px)] mx-auto flex flex-col items-center gap-4">
                    <div
                      className="w-full flex flex-col items-center gap-1 text-white/90 font-bold text-sm text-center"
                      style={displayFont}
                    >
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
                      aria-label="Swap puzzle preview"
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
                              backgroundPosition: tileBackgroundPosition(
                                tileId,
                                size,
                              ),
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
                            className={`px-3 py-1.5 rounded-full font-bold text-xs text-white active:scale-95 disabled:opacity-50 ${
                              d === difficulty
                                ? 'ring-2 ring-amber-300'
                                : 'opacity-80'
                            }`}
                            style={{ ...woodBtnStyle, ...displayFont }}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </main>

              {phase === 'won' && hasImage && (
                <div
                  className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/55"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="portal-puzzle-win-title"
                >
                  <PuzzleConfetti />
                  <div
                    className="relative w-full max-w-sm rounded-2xl p-5 text-center space-y-3 max-h-[90%] overflow-y-auto"
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
                      id="portal-puzzle-win-title"
                      className="font-black text-white text-2xl"
                      style={{
                        ...displayFont,
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      }}
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
                          size={32}
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
                    </p>
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full max-w-[140px] mx-auto aspect-square object-cover rounded-xl border-2 border-[#8B6914]"
                      draggable={false}
                    />
                    {leaderboard.length > 0 && (
                      <div className="text-left rounded-xl bg-black/25 border border-[#8B6914]/60 px-3 py-2">
                        <p
                          className="font-black text-amber-200 text-xs tracking-wide mb-1"
                          style={displayFont}
                        >
                          Best scores · {difficulty}
                        </p>
                        <ul className="space-y-1">
                          {leaderboard.slice(0, 4).map((entry, i) => (
                            <li
                              key={`${entry.at}-${i}`}
                              className="flex items-center gap-2 text-white/90 text-xs"
                              style={displayFont}
                            >
                              <span className="w-4 font-bold text-amber-200/90">
                                {i + 1}.
                              </span>
                              <span className="flex-1 truncate font-semibold">
                                {entry.name}
                              </span>
                              <span className="flex items-center gap-0.5 shrink-0">
                                {Array.from({ length: entry.stars }).map(
                                  (_, s) => (
                                    <Star
                                      key={s}
                                      size={10}
                                      className="text-amber-300"
                                      fill="#FCD34D"
                                      strokeWidth={2}
                                    />
                                  ),
                                )}
                              </span>
                              <span className="shrink-0 tabular-nums font-bold">
                                {entry.moves}m
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => startGame(difficulty)}
                      className="w-full py-3 rounded-xl font-black text-white text-lg active:scale-[0.98]"
                      style={{
                        background:
                          'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                        border: '2px solid #E8C060',
                        boxShadow: '0 3px 0 #5c3a1a',
                        ...displayFont,
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidingPuzzlePreview;
