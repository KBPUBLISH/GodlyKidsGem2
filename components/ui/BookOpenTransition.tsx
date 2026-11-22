import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../../utils/bibleMapApi';
import { getCoverFull } from '../../utils/coverImage';

export type BookOpenRequest = {
  coverUrl: string;
  fromRect: DOMRect;
  onZoom?: () => void;
  onComplete?: () => void;
};

type PlayArgs = {
  coverUrl?: string | null;
  fromRect: DOMRect;
  onZoom?: () => void;
};

type Listener = () => void;

let current: BookOpenRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function coverRectFromTarget(target: EventTarget | null): DOMRect | null {
  if (!(target instanceof HTMLElement)) return null;
  const face =
    target.querySelector<HTMLElement>('.hardcover-face') ||
    target.closest('.hardcover-face') ||
    target.querySelector<HTMLElement>('.hardcover-book') ||
    target;
  return face.getBoundingClientRect();
}

/** Start the pop / open. Resolves when the overlay is gone. */
export function playBookOpenTransition(args: PlayArgs): Promise<void> {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      args.onZoom?.();
      resolve();
      return;
    }
    current = {
      coverUrl: getCoverFull(args.coverUrl) || args.coverUrl || '',
      fromRect: args.fromRect,
      onZoom: args.onZoom,
      onComplete: resolve,
    };
    emit();
  });
}

export function playBookOpenFromEvent(
  event: React.MouseEvent<HTMLElement>,
  coverUrl: string | undefined,
  onZoom: () => void,
): void {
  if (prefersReducedMotion()) {
    onZoom();
    return;
  }
  const rect = coverRectFromTarget(event.currentTarget);
  if (!rect || rect.width < 8) {
    onZoom();
    return;
  }
  void playBookOpenTransition({ coverUrl, fromRect: rect, onZoom });
}

const POP_MS = 500;
const OPEN_MS = 800;
const FADE_MS = 220;

const BookOpenOverlay: React.FC<{
  request: BookOpenRequest;
  onFinished: () => void;
}> = ({ request, onFinished }) => {
  const [phase, setPhase] = useState<'from' | 'pop' | 'open' | 'out'>('from');
  const { coverUrl, fromRect } = request;

  const cx = fromRect.left + fromRect.width / 2;
  const cy = fromRect.top + fromRect.height / 2;
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  const destW = Math.min(220, window.innerWidth * 0.42);
  const destH = destW * (4 / 3);
  const fromX = cx - midX;
  const fromY = cy - midY;
  const fromScale = fromRect.width / destW;

  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true');
    const popId = window.setTimeout(() => setPhase('pop'), 20);
    const openId = window.setTimeout(() => setPhase('open'), POP_MS);
    const leaveId = window.setTimeout(() => {
      request.onZoom?.();
      setPhase('out');
    }, POP_MS + OPEN_MS);
    const doneId = window.setTimeout(() => {
      document.body.removeAttribute('data-modal-open');
      request.onComplete?.();
      onFinished();
    }, POP_MS + OPEN_MS + FADE_MS);
    return () => {
      window.clearTimeout(popId);
      window.clearTimeout(openId);
      window.clearTimeout(leaveId);
      window.clearTimeout(doneId);
      document.body.removeAttribute('data-modal-open');
    };
  }, [request, onFinished]);

  const bookTransform =
    phase === 'from'
      ? `translate(${fromX}px, ${fromY}px) scale(${fromScale})`
      : 'translate(0, -6px) scale(1.12)';

  return createPortal(
    <div
      className={`book-open-scrim book-open-scrim-${phase}`}
      role="presentation"
      aria-hidden
    >
      <div
        className={`book-open-stage book-open-${phase}`}
        style={
          {
            '--book-w': `${destW}px`,
            '--book-h': `${destH}px`,
            '--book-tf': bookTransform,
          } as React.CSSProperties
        }
      >
        <div className="book-open-book">
          <div className="book-open-leaf book-open-leaf-left">
            <div className="book-open-leaf-front">
              {coverUrl ? (
                <img src={coverUrl} alt="" draggable={false} />
              ) : (
                <div className="book-open-cover-fallback" />
              )}
            </div>
            <div className="book-open-leaf-back">
              <span className="book-open-lines" />
              {coverUrl ? (
                <img src={coverUrl} alt="" className="book-open-ghost" draggable={false} />
              ) : null}
            </div>
          </div>
          <div className="book-open-spine" />
          <div className="book-open-leaf book-open-leaf-right">
            <span className="book-open-lines" />
          </div>
        </div>
      </div>
      <style>{BOOK_OPEN_CSS}</style>
    </div>,
    document.body,
  );
};

/** Lives next to the router so the overlay survives the library → book route. */
export const BookOpenHost: React.FC = () => {
  const [request, setRequest] = useState<BookOpenRequest | null>(current);

  useEffect(() => {
    const sync = () => setRequest(current);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (!request) return null;
  return (
    <BookOpenOverlay
      request={request}
      onFinished={() => {
        current = null;
        setRequest(null);
        emit();
      }}
    />
  );
};

const BOOK_OPEN_CSS = `
  .book-open-scrim {
    position: fixed;
    inset: 0;
    z-index: 99970;
    pointer-events: none;
    background: rgba(23, 36, 56, 0);
    transition: background 0.35s ease;
  }
  .book-open-scrim-pop,
  .book-open-scrim-open {
    background: rgba(23, 36, 56, 0.42);
  }
  .book-open-scrim-out {
    background: rgba(23, 36, 56, 0);
    transition: background 0.22s ease, opacity 0.22s ease;
    opacity: 0;
  }
  .book-open-stage {
    position: absolute;
    left: 50%;
    top: 50%;
    width: calc(var(--book-w) * 2);
    height: var(--book-h);
    margin-left: calc(var(--book-w) * -1);
    margin-top: calc(var(--book-h) / -2);
    perspective: 1600px;
    transform: var(--book-tf);
    transform-origin: center center;
    transition: transform 0.5s cubic-bezier(0.22, 1.2, 0.36, 1);
  }
  .book-open-book {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transform: translateX(-25%);
    transition: transform 0.8s cubic-bezier(0.4, 0.05, 0.2, 1);
    filter: drop-shadow(8px 18px 22px rgba(30, 20, 8, 0.38));
  }
  .book-open-open .book-open-book,
  .book-open-out .book-open-book {
    transform: translateX(0) rotateX(6deg);
  }
  .book-open-leaf {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    transform-style: preserve-3d;
  }
  .book-open-leaf-left {
    left: 0;
    transform-origin: right center;
    transform: rotateY(180deg);
    transition: transform 0.8s cubic-bezier(0.4, 0.05, 0.2, 1);
    z-index: 3;
  }
  .book-open-open .book-open-leaf-left,
  .book-open-out .book-open-leaf-left {
    transform: rotateY(0deg);
  }
  .book-open-leaf-right {
    left: 50%;
    z-index: 1;
    border-radius: 0 8px 8px 0;
    overflow: hidden;
    background:
      linear-gradient(90deg, #d9c9a8 0 8px, transparent 18px),
      repeating-linear-gradient(to bottom, #fff8eb 0 22px, #f0e4cc 22px 23px);
    box-shadow: inset 10px 0 14px rgba(80, 50, 20, 0.1);
  }
  .book-open-leaf-front,
  .book-open-leaf-back {
    position: absolute;
    inset: 0;
    overflow: hidden;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  .book-open-leaf-front {
    transform: rotateY(180deg);
    border-radius: 3px 10px 10px 4px;
    box-shadow: 4px 8px 16px rgba(0, 0, 0, 0.28);
  }
  .book-open-leaf-back {
    border-radius: 8px 0 0 8px;
    background:
      linear-gradient(270deg, #d9c9a8 0 8px, transparent 18px),
      repeating-linear-gradient(to bottom, #fff8eb 0 22px, #f0e4cc 22px 23px);
    box-shadow: inset -10px 0 14px rgba(80, 50, 20, 0.1);
  }
  .book-open-spine {
    position: absolute;
    top: 1%;
    bottom: 1%;
    left: 50%;
    width: 14px;
    margin-left: -7px;
    z-index: 2;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      rgba(80, 50, 20, 0.22),
      rgba(255, 248, 235, 0.35) 45%,
      rgba(80, 50, 20, 0.28)
    );
    box-shadow: 0 0 10px rgba(40, 24, 8, 0.25);
    opacity: 0;
    transition: opacity 0.8s ease;
  }
  .book-open-open .book-open-spine,
  .book-open-out .book-open-spine {
    opacity: 1;
  }
  .book-open-lines {
    display: block;
    position: absolute;
    inset: 16% 14% 14% 16%;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0 13px,
      rgba(120, 90, 50, 0.14) 13px 14px
    );
  }
  .book-open-ghost {
    position: absolute;
    inset: 18% 16%;
    width: auto;
    height: auto;
    object-fit: cover;
    opacity: 0.16;
    border-radius: 4px;
    filter: saturate(0.7);
  }
  .book-open-leaf-front img,
  .book-open-cover-fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .book-open-cover-fallback {
    background: linear-gradient(160deg, #6366f1, #312e81);
  }
`;
