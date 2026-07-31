import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import TapFillCanvas, { TapFillCanvasHandle } from '../components/features/TapFillCanvas';
import DrawingCanvas from '../components/features/DrawingCanvas';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const DEFAULT_PALETTE = [
  '#E74C3C',
  '#E67E22',
  '#F1C40F',
  '#2ECC71',
  '#3498DB',
  '#9B59B6',
  '#E91E63',
  '#1ABC9C',
  '#FFFFFF',
  '#8D6E63',
];

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

type TapFillCms = {
  enabled?: boolean;
  regionMapUrl?: string;
  regionPreviewUrl?: string;
  regionCount?: number;
  palette?: string[];
};

type ColoringPageCms = {
  _id?: string;
  pageNumber?: number;
  backgroundUrl?: string;
  files?: { background?: { url?: string } };
  tapFill?: TapFillCms;
};

type StoryCms = {
  _id?: string;
  title?: string;
  displayTitle?: string;
  coloringPageIds?: ColoringPageCms[] | string[];
};

type Phase = 'loading' | 'ready' | 'missing';

/**
 * Island tap-to-fill coloring (falls back to freehand DrawingCanvas if no region map).
 * Route: /sail/:islandId/lesson/coloring
 */
const IslandColoringPage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const scenePath = `/sail/${islandId}/lesson`;
  const canvasRef = useRef<TapFillCanvasHandle>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('COLORING');
  const [pages, setPages] = useState<ColoringPageCms[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [color, setColor] = useState(DEFAULT_PALETTE[0]);

  const goBack = useCallback(() => {
    navigate(scenePath, { state: { skipIntro: true, title } });
  }, [navigate, scenePath, title]);

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
            (s) => Array.isArray(s.coloringPageIds) && s.coloringPageIds.length > 0,
          ) ||
          stories[0];

        if (cancelled) return;

        setTitle(
          (story?.displayTitle || story?.title || 'COLORING').toUpperCase(),
        );

        const raw = Array.isArray(story?.coloringPageIds)
          ? story!.coloringPageIds!
          : [];
        const resolved: ColoringPageCms[] = raw
          .map((p) => (typeof p === 'string' ? { _id: p } : p))
          .filter((p) => p && (p.backgroundUrl || p.files?.background?.url || p.tapFill?.regionMapUrl));

        if (resolved.length === 0) {
          setPages([]);
          setPhase('missing');
          return;
        }

        setPages(resolved);
        const pageParam = searchParams.get('page');
        let idx = 0;
        if (pageParam) {
          const found = resolved.findIndex((p) => p._id === pageParam);
          if (found >= 0) idx = found;
        }
        setPageIndex(idx);
        const palette =
          resolved[idx]?.tapFill?.palette && resolved[idx].tapFill!.palette!.length > 0
            ? resolved[idx].tapFill!.palette!
            : DEFAULT_PALETTE;
        setColor(palette[0]);
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('missing');
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [islandId, searchParams]);

  const current = pages[pageIndex];
  const lineArtUrl = resolveMediaUrl(
    current?.files?.background?.url || current?.backgroundUrl,
  );
  const regionMapUrl = resolveMediaUrl(current?.tapFill?.regionMapUrl);
  // Prefer tap-fill whenever a region map exists (enabled defaults true on preprocess).
  const useTapFill = !!(
    regionMapUrl &&
    lineArtUrl &&
    current?.tapFill?.enabled !== false
  );
  const palette = useMemo(() => {
    const p = current?.tapFill?.palette;
    return p && p.length > 0 ? p : DEFAULT_PALETTE;
  }, [current]);

  useEffect(() => {
    if (palette.length && !palette.includes(color)) {
      setColor(palette[0]);
    }
  }, [palette, color]);

  const selectPage = (idx: number) => {
    setPageIndex(idx);
    const p = pages[idx];
    if (p?._id) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', p._id!);
          return next;
        },
        { replace: true },
      );
    }
    const nextPalette =
      p?.tapFill?.palette && p.tapFill.palette.length > 0
        ? p.tapFill.palette
        : DEFAULT_PALETTE;
    setColor(nextPalette[0]);
  };

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
          paddingTop: 'max(var(--safe-area-top, 0px), 10px)',
          backgroundImage: `url(${WOOD_TEX})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
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
          onClick={() => canvasRef.current?.clear()}
          disabled={phase !== 'ready' || !useTapFill}
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform disabled:opacity-40"
          style={woodBtnStyle}
          aria-label="Clear colors"
        >
          <RefreshCw size={20} className="text-white drop-shadow" strokeWidth={2.6} />
        </button>
      </header>

      <main
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-2.5 sm:px-4 gap-3"
        style={{ paddingBottom: 'max(var(--safe-area-bottom, 0px), 16px)' }}
      >
        {phase === 'loading' && (
          <p className="font-display font-bold text-white/90 text-lg">
            Loading coloring…
          </p>
        )}

        {phase === 'missing' && (
          <div className="text-center space-y-3 max-w-sm mx-auto">
            <p className="font-display font-black text-white text-xl">
              Coloring coming soon
            </p>
            <p className="text-white/80 text-sm">
              Upload a tap-fill coloring page in the Bible Map story pack to
              unlock this activity.
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

        {phase === 'ready' && current && (
          <>
            {pages.length > 1 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {pages.map((p, i) => (
                  <button
                    key={p._id || i}
                    type="button"
                    onClick={() => selectPage(i)}
                    className={`px-3 py-1.5 rounded-full font-display font-bold text-xs text-white active:scale-95 ${
                      i === pageIndex ? 'ring-2 ring-amber-300' : 'opacity-80'
                    }`}
                    style={woodBtnStyle}
                  >
                    Page {p.pageNumber ?? i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full max-w-[min(100%,440px)] mx-auto flex flex-col items-center gap-3">
              {useTapFill ? (
                <>
                  <p className="text-white/80 text-xs font-display font-semibold text-center">
                    Pick a color, then tap a region to fill
                  </p>
                  <TapFillCanvas
                    ref={canvasRef}
                    lineArtUrl={lineArtUrl}
                    regionMapUrl={regionMapUrl}
                    color={color}
                    saveKey={`${islandId}-${current._id || pageIndex}`}
                    className="w-full"
                  />
                  <div className="w-full flex flex-wrap gap-2 justify-center">
                    {palette.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-10 h-10 rounded-full border-2 active:scale-95 ${
                          color === c
                            ? 'ring-2 ring-amber-300 border-white'
                            : 'border-[#6B4423]/70'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                        aria-pressed={color === c}
                      />
                    ))}
                  </div>
                </>
              ) : lineArtUrl ? (
                <div className="w-full h-[min(70dvh,520px)]">
                  <DrawingCanvas
                    prompt="Color the picture!"
                    backgroundImageUrl={lineArtUrl}
                    saveKey={`island-coloring-${islandId}-${current._id || pageIndex}`}
                    layeredMode
                  />
                </div>
              ) : (
                <p className="text-white/90">No image for this page.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default IslandColoringPage;
