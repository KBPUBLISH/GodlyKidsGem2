import React, { useMemo } from 'react';
import { removeEmotionalCues } from '../../utils/textProcessing';

/**
 * Karaoke-style captions over full-screen page art.
 *
 * Instead of the parchment, the page text is shown a phrase at a time
 * (≈5–7 words, broken at punctuation) and the word currently being read is
 * lit up. Purely presentational — the parent passes the same word index it
 * uses for read-along highlighting on the parchment.
 */
interface ReaderCaptionsProps {
  text: string;
  /** Index (into whitespace-split words) of the word being spoken; -1 when idle. */
  highlightedWordIndex: number;
  /** Larger type for younger readers. */
  fontSize?: number;
  fontFamily?: string;
  /** CSS bottom offset so the band clears the reader chrome. */
  bottom?: string;
}

const MAX_WORDS_PER_PHRASE = 6;
const MIN_WORDS_BEFORE_PUNCT_BREAK = 3;

/** Group words into short phrases, breaking early on sentence/clause punctuation. */
export function chunkWordsIntoPhrases(words: string[]): number[][] {
  const phrases: number[][] = [];
  let current: number[] = [];
  words.forEach((w, i) => {
    current.push(i);
    const endsClause = /[.!?;:,—–]["”’)]?$/.test(w);
    if (
      current.length >= MAX_WORDS_PER_PHRASE ||
      (endsClause && current.length >= MIN_WORDS_BEFORE_PUNCT_BREAK)
    ) {
      phrases.push(current);
      current = [];
    }
  });
  if (current.length) {
    // Avoid a dangling one-word tail — fold it into the previous phrase.
    if (current.length === 1 && phrases.length) phrases[phrases.length - 1].push(current[0]);
    else phrases.push(current);
  }
  return phrases;
}

const ReaderCaptions: React.FC<ReaderCaptionsProps> = ({
  text,
  highlightedWordIndex,
  fontSize = 30,
  fontFamily = 'Patrick Hand',
  bottom = '22%',
}) => {
  const words = useMemo(
    () => removeEmotionalCues(text || '').split(/\s+/).filter((w) => w.length > 0),
    [text],
  );
  const phrases = useMemo(() => chunkWordsIntoPhrases(words), [words]);

  if (!words.length) return null;

  const phraseIdx = Math.max(
    0,
    highlightedWordIndex >= 0
      ? phrases.findIndex((p) => p.includes(highlightedWordIndex))
      : 0,
  );
  const phrase = phrases[phraseIdx] || phrases[0];
  const idle = highlightedWordIndex < 0;

  return (
    <div
      aria-live="polite"
      className="absolute left-0 right-0 z-[45] pointer-events-none flex justify-center px-4"
      style={{ bottom }}
    >
      {/* Legibility wash behind the words — soft, never a box. */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-10 -bottom-16 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0) 72%)',
        }}
      />
      <p
        key={phraseIdx}
        className="reader-caption relative text-center font-bold leading-[1.25] max-w-[94%]"
        style={{
          fontFamily: `"${fontFamily}", "Nunito", sans-serif`,
          fontSize,
          color: '#FFFFFF',
          textShadow:
            '0 2px 0 rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.65), 0 4px 14px rgba(0,0,0,0.6)',
          WebkitTextStroke: '0.6px rgba(0,0,0,0.35)',
        }}
      >
        {phrase.map((wIdx) => {
          const isCurrent = wIdx === highlightedWordIndex;
          const isPast = !idle && wIdx < highlightedWordIndex;
          return (
            <span
              key={wIdx}
              className={`reader-caption-word inline-block rounded-lg px-1.5 ${
                isCurrent ? 'reader-caption-word--current' : ''
              }`}
              style={{
                opacity: idle ? 0.95 : isCurrent ? 1 : isPast ? 0.82 : 0.6,
                color: isCurrent ? '#1f1300' : undefined,
                background: isCurrent
                  ? 'linear-gradient(180deg, #FFE68A 0%, #F5C518 100%)'
                  : 'transparent',
                textShadow: isCurrent ? 'none' : undefined,
                WebkitTextStroke: isCurrent ? '0' : undefined,
                boxShadow: isCurrent
                  ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 22px rgba(255,215,0,0.6), 0 4px 10px rgba(0,0,0,0.35)'
                  : 'none',
                transition: 'opacity 160ms ease, background 160ms ease, transform 160ms ease',
                transform: isCurrent ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              {words[wIdx]}
            </span>
          );
        })}
      </p>
      <style>{`
        @keyframes reader-caption-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reader-caption { animation: reader-caption-in 260ms ease-out both; }
        .reader-caption-word { margin: 0 0.08em; }
        @media (prefers-reduced-motion: reduce) {
          .reader-caption { animation: none; }
          .reader-caption-word { transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ReaderCaptions;
