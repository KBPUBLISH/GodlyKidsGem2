import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { prefersReducedMotion } from '../../utils/bibleMapApi';
import { getCoverFull } from '../../utils/coverImage';

export type CdSpinRequest = {
  coverUrl: string;
  fromRect: DOMRect;
  onReady?: () => void;
  onComplete?: () => void;
};

type PlayArgs = {
  coverUrl?: string | null;
  fromRect: DOMRect;
  onReady?: () => void;
};

type Listener = () => void;

let current: CdSpinRequest | null = null;
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

/** Start the pop / CD spin. Resolves when the overlay is gone. */
export function playCdSpinTransition(args: PlayArgs): Promise<void> {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      args.onReady?.();
      resolve();
      return;
    }
    current = {
      coverUrl: getCoverFull(args.coverUrl) || args.coverUrl || '',
      fromRect: args.fromRect,
      onReady: args.onReady,
      onComplete: resolve,
    };
    emit();
  });
}

export function playCdSpinFromEvent(
  event: React.MouseEvent<HTMLElement>,
  coverUrl: string | undefined,
  onReady: () => void,
): void {
  if (prefersReducedMotion()) {
    onReady();
    return;
  }
  const rect = coverRectFromTarget(event.currentTarget);
  if (!rect || rect.width < 8) {
    onReady();
    return;
  }
  void playCdSpinTransition({ coverUrl, fromRect: rect, onReady });
}

const POP_MS = 300;
const SLIDE_MS = 360;
const SPIN_HOLD_MS = 480;
const FADE_MS = 220;

const CdSpinOverlay: React.FC<{
  request: CdSpinRequest;
  onFinished: () => void;
}> = ({ request, onFinished }) => {
  const [phase, setPhase] = useState<'from' | 'pop' | 'spin' | 'out'>('from');
  const { coverUrl, fromRect } = request;

  const cx = fromRect.left + fromRect.width / 2;
  const cy = fromRect.top + fromRect.height / 2;
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  const destW = Math.min(196, window.innerWidth * 0.4);
  const destH = destW * (fromRect.height / Math.max(fromRect.width, 1));
  const fromX = cx - midX;
  const fromY = cy - midY;
  const fromScale = fromRect.width / destW;

  useEffect(() => {
    document.body.setAttribute('data-modal-open', 'true');
    const popId = window.setTimeout(() => setPhase('pop'), 20);
    const spinId = window.setTimeout(() => setPhase('spin'), POP_MS);
    const leaveId = window.setTimeout(() => {
      request.onReady?.();
      setPhase('out');
    }, POP_MS + SLIDE_MS + SPIN_HOLD_MS);
    const doneId = window.setTimeout(() => {
      document.body.removeAttribute('data-modal-open');
      request.onComplete?.();
      onFinished();
    }, POP_MS + SLIDE_MS + SPIN_HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(popId);
      window.clearTimeout(spinId);
      window.clearTimeout(leaveId);
      window.clearTimeout(doneId);
      document.body.removeAttribute('data-modal-open');
    };
  }, [request, onFinished]);

  const packTransform =
    phase === 'from'
      ? `translate(${fromX}px, ${fromY}px) scale(${fromScale})`
      : 'translate(-18px, -8px) scale(1.08)';

  return createPortal(
    <div
      className={`cd-spin-scrim cd-spin-scrim-${phase}`}
      role="presentation"
      aria-hidden
    >
      <div
        className={`cd-spin-stage cd-spin-${phase}`}
        style={
          {
            '--cd-w': `${destW}px`,
            '--cd-h': `${destH}px`,
            '--cd-tf': packTransform,
          } as React.CSSProperties
        }
      >
        <div className="cd-disc-slide">
          <div className="cd-disc">
            <span className="cd-disc-grooves" />
            {coverUrl ? (
              <img src={coverUrl} alt="" className="cd-disc-label" draggable={false} />
            ) : (
              <span className="cd-disc-label cd-disc-label-fallback" />
            )}
            <span className="cd-disc-hole" />
          </div>
        </div>
        <div className="cd-case">
          {coverUrl ? (
            <img src={coverUrl} alt="" draggable={false} />
          ) : (
            <div className="cd-case-fallback" />
          )}
        </div>
      </div>
      <style>{CD_SPIN_CSS}</style>
    </div>,
    document.body,
  );
};

/** Lives next to the router so the overlay survives Listen → playlist. */
export const CdSpinHost: React.FC = () => {
  const [request, setRequest] = useState<CdSpinRequest | null>(current);

  useEffect(() => {
    const sync = () => setRequest(current);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (!request) return null;
  return (
    <CdSpinOverlay
      request={request}
      onFinished={() => {
        current = null;
        setRequest(null);
        emit();
      }}
    />
  );
};

const CD_SPIN_CSS = `
  .cd-spin-scrim {
    position: fixed;
    inset: 0;
    z-index: 99970;
    pointer-events: none;
    background: rgba(23, 36, 56, 0);
    transition: background 0.32s ease, opacity 0.22s ease;
  }
  .cd-spin-scrim-pop,
  .cd-spin-scrim-spin {
    background: rgba(23, 36, 56, 0.42);
  }
  .cd-spin-scrim-out {
    background: rgba(23, 36, 56, 0);
    opacity: 0;
  }
  .cd-spin-stage {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--cd-w);
    height: var(--cd-h);
    margin-left: calc(var(--cd-w) / -2);
    margin-top: calc(var(--cd-h) / -2);
    transform: var(--cd-tf);
    transform-origin: center center;
    transition: transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1);
  }
  .cd-disc-slide {
    position: absolute;
    left: 50%;
    top: 50%;
    width: calc(var(--cd-w) * 0.96);
    height: calc(var(--cd-w) * 0.96);
    margin-left: calc(var(--cd-w) * -0.48);
    margin-top: calc(var(--cd-w) * -0.48);
    transform: translateX(8%);
    transition: transform 0.36s cubic-bezier(0.22, 0.8, 0.3, 1);
    z-index: 1;
  }
  .cd-spin-spin .cd-disc-slide,
  .cd-spin-out .cd-disc-slide {
    transform: translateX(46%);
  }
  .cd-disc {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 50%;
    overflow: hidden;
    transform-origin: center center;
    background:
      radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0 8%, transparent 22%),
      repeating-radial-gradient(
        circle at 50% 50%,
        rgba(255,255,255,0.16) 0 1px,
        rgba(20, 16, 10, 0.05) 1.6px 3px
      ),
      conic-gradient(
        from 200deg,
        #b7d4ee,
        #d9c0f2,
        #f3d7a8,
        #b8ead8,
        #b7d4ee
      );
    box-shadow:
      0 12px 22px rgba(20, 12, 6, 0.32),
      inset 0 0 0 2px rgba(255,255,255,0.38),
      inset 0 0 18px rgba(255,255,255,0.18);
  }
  .cd-spin-spin .cd-disc,
  .cd-spin-out .cd-disc {
    animation: cd-disc-rotate 0.72s linear infinite;
  }
  .cd-disc-grooves {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: repeating-radial-gradient(
      circle at 50% 50%,
      transparent 0 4px,
      rgba(255,255,255,0.08) 4px 5px
    );
    pointer-events: none;
  }
  .cd-disc-label {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 34%;
    height: 34%;
    object-fit: cover;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 3px #efe6d2, 0 0 0 4px rgba(80, 50, 20, 0.25);
  }
  .cd-disc-label-fallback {
    display: block;
    background: linear-gradient(160deg, #6366f1, #312e81);
  }
  .cd-disc-hole {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12%;
    height: 12%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle, #2a3344 0 62%, #111 100%);
    box-shadow: inset 0 0 0 2px #d8d0c4, 0 0 0 1px rgba(0,0,0,0.25);
  }
  .cd-case {
    position: absolute;
    inset: 0;
    z-index: 2;
    overflow: hidden;
    border-radius: 4px 10px 10px 4px;
    box-shadow:
      6px 10px 18px rgba(40, 24, 8, 0.32),
      inset 8px 0 10px rgba(0, 0, 0, 0.18);
    background: #1e293b;
  }
  .cd-case img,
  .cd-case-fallback {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .cd-case-fallback {
    background: linear-gradient(160deg, #6366f1, #312e81);
  }
  @keyframes cd-disc-rotate {
    to { transform: rotate(360deg); }
  }
`;
