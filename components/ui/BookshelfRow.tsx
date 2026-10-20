import React, { useEffect } from 'react';

const STYLE_ID = 'gk-bookshelf-row-css-v2';
const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const SHELF_CSS = `
  .bookshelf-scroller {
    overflow-x: auto;
    padding-bottom: 16px;
  }
  .bookshelf-inner {
    position: relative;
    width: max-content;
    min-width: 100%;
    padding-bottom: 2px;
  }
  .bookshelf-books {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    position: relative;
    z-index: 2;
  }
  .bookshelf-books > * {
    flex-shrink: 0;
  }
  .bookshelf-books .hardcover-stage {
    margin-bottom: 1.35rem;
    padding-bottom: 2px;
  }
  .bookshelf-plank {
    position: absolute;
    left: -1rem;
    right: -1rem;
    top: calc(10rem * 4 / 3 - 11px);
    height: 28px;
    z-index: 1;
    pointer-events: none;
    filter: drop-shadow(0 8px 12px rgba(70, 38, 10, 0.28));
  }
  .bookshelf-plank-top,
  .bookshelf-plank-edge {
    display: block;
    background-image: url(${WOOD_TEX});
    background-repeat: repeat-x;
  }
  .bookshelf-plank-top {
    height: 10px;
    border-radius: 5px 5px 0 0;
    background-size: 240px 78px;
    background-position: 0 18%;
    box-shadow:
      inset 0 1px 0 rgba(255, 248, 220, 0.55),
      inset 0 -1px 0 rgba(90, 50, 18, 0.22);
  }
  .bookshelf-plank-top::after {
    content: '';
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255, 246, 220, 0.4) 0%,
      rgba(255, 230, 180, 0.08) 50%,
      rgba(120, 70, 24, 0.12) 100%
    );
  }
  .bookshelf-plank-edge {
    position: relative;
    height: 18px;
    border-radius: 0 0 6px 6px;
    background-size: 240px 78px;
    background-position: 28px 72%;
    box-shadow:
      inset 0 2px 0 rgba(255, 220, 160, 0.22),
      inset 0 -4px 6px rgba(40, 20, 6, 0.32);
  }
  .bookshelf-plank-edge::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0 17px,
        rgba(70, 38, 12, 0.1) 17px 18px,
        transparent 18px 39px,
        rgba(40, 22, 8, 0.08) 39px 40px
      ),
      linear-gradient(
        180deg,
        rgba(90, 50, 18, 0.16) 0%,
        rgba(70, 38, 10, 0.38) 100%
      );
  }
  .bookshelf-plank-edge::after {
    content: '';
    position: absolute;
    left: 6%;
    right: 6%;
    bottom: -5px;
    height: 7px;
    border-radius: 50%;
    background: rgba(40, 20, 8, 0.22);
    filter: blur(4px);
  }
`;

function ensureShelfStyles(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('gk-bookshelf-row-css')?.remove();
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  if (el.textContent !== SHELF_CSS) el.textContent = SHELF_CSS;
}

type BookshelfRowProps = {
  children: React.ReactNode;
  className?: string;
  /** Skip the plank and wrap cards in a results grid (search / filters). */
  grid?: boolean;
};

/** Horizontal book row sitting on a light wood 3D shelf plank. */
const BookshelfRow: React.FC<BookshelfRowProps> = ({ children, className = '', grid = false }) => {
  ensureShelfStyles();
  useEffect(() => {
    ensureShelfStyles();
  }, []);

  if (grid) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`bookshelf-scroller no-scrollbar -mx-4 px-4 ${className}`}>
      <div className="bookshelf-inner">
        <div className="bookshelf-books">{children}</div>
        <div className="bookshelf-plank" aria-hidden>
          <span className="bookshelf-plank-top" />
          <span className="bookshelf-plank-edge" />
        </div>
      </div>
    </div>
  );
};

export default BookshelfRow;
