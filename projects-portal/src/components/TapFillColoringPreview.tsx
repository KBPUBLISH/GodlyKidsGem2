import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eraser, RefreshCw } from 'lucide-react';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const PHONE_W = 390;
const PHONE_H = 844;
const SCALE = 0.58;

const DEFAULT_PREVIEW_PALETTE = [
  '#E74C3C',
  '#E67E22',
  '#F1C40F',
  '#2ECC71',
  '#3498DB',
  '#9B59B6',
  '#E91E63',
  '#1ABC9C',
  '#87CEEB',
  '#FFB6C1',
  '#8BC34A',
  '#1B4F72',
  '#FFAB91',
  '#95A5A6',
  '#2C3E50',
  '#FFFFFF',
  '#8D6E63',
  '#D4AF37',
  '#C0C0C0',
  '#CD7F32',
];

const METALLIC_SWATCH_GRADIENTS: Record<string, string> = {
  '#D4AF37':
    'linear-gradient(145deg, #8B6914 0%, #D4AF37 28%, #FFF3B0 48%, #E8C547 62%, #A67C00 100%)',
  '#C0C0C0':
    'linear-gradient(145deg, #6E6E6E 0%, #C0C0C0 28%, #FFFFFF 48%, #D8D8D8 62%, #8A8A8A 100%)',
  '#CD7F32':
    'linear-gradient(145deg, #6B3E1A 0%, #CD7F32 28%, #F0C080 48%, #B87333 62%, #7A4A1E 100%)',
};

const getColorSwatchStyle = (hex: string): React.CSSProperties => {
  const key = hex.trim().toUpperCase();
  const gradient = METALLIC_SWATCH_GRADIENTS[key];
  if (gradient) {
    return {
      backgroundImage: gradient,
      backgroundColor: key,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.25)',
    };
  }
  return { backgroundColor: hex };
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

function decodeRegionId(r: number, g: number, a: number): number {
  if (!a) return 0;
  return (r & 0xff) + ((g & 0xff) << 8);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [255, 0, 0, 255];
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
}

function get2d(
  canvas: HTMLCanvasElement,
  willReadFrequently = false,
): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently });
}

/** Make white/light pixels transparent so color fills under the ink show through. */
function knockoutLightPixels(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > 200) {
        data[i + 3] = 0;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = Math.min(255, (255 - brightness) * 2);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return true;
  } catch {
    return false;
  }
}

export interface TapFillColoringPreviewProps {
  lineArtUrl?: string;
  regionMapUrl?: string;
  palette?: string[];
  title?: string;
  regionCount?: number;
}

/**
 * Phone-framed tap-to-fill dry run (mirrors IslandColoringPage).
 * Shows an empty phone state when no line art / region map is provided yet.
 */
const TapFillColoringPreview: React.FC<TapFillColoringPreviewProps> = ({
  lineArtUrl = '',
  regionMapUrl = '',
  palette: paletteProp,
  title = 'COLORING',
  regionCount,
}) => {
  const palette =
    paletteProp && paletteProp.length > 0
      ? paletteProp
      : DEFAULT_PREVIEW_PALETTE;
  const hasAssets = !!(lineArtUrl.trim() && regionMapUrl.trim());

  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const regionIdsRef = useRef<Uint16Array | null>(null);
  const dimsRef = useRef({ w: 0, h: 0 });

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [useMultiplyFallback, setUseMultiplyFallback] = useState(false);
  const [aspect, setAspect] = useState('1 / 1');
  const [color, setColor] = useState(palette[0] || '#E74C3C');
  const [fillCount, setFillCount] = useState(0);

  useEffect(() => {
    if (palette.length && !palette.includes(color)) {
      setColor(palette[0]);
    }
  }, [palette, color]);

  const clearFills = useCallback(() => {
    const ctx = colorCtxRef.current;
    const { w, h } = dimsRef.current;
    if (!ctx || !w) return;
    ctx.clearRect(0, 0, w, h);
    setFillCount(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    setFillCount(0);
    setUseMultiplyFallback(false);
    regionIdsRef.current = null;
    colorCtxRef.current = null;
    dimsRef.current = { w: 0, h: 0 };

    if (!hasAssets) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        const [lineImg, mapImg] = await Promise.all([
          loadImage(lineArtUrl),
          loadImage(regionMapUrl),
        ]);
        if (cancelled) return;

        const w = mapImg.naturalWidth || mapImg.width;
        const h = mapImg.naturalHeight || mapImg.height;
        dimsRef.current = { w, h };
        setAspect(`${w} / ${h}`);

        const colorCanvas = colorCanvasRef.current;
        const lineCanvas = lineCanvasRef.current;
        if (!colorCanvas || !lineCanvas) return;

        colorCanvas.width = w;
        colorCanvas.height = h;
        lineCanvas.width = w;
        lineCanvas.height = h;

        const colorCtx = get2d(colorCanvas, true);
        const lineCtx = get2d(lineCanvas, true);
        if (!colorCtx || !lineCtx) return;
        colorCtxRef.current = colorCtx;

        colorCtx.clearRect(0, 0, w, h);
        lineCtx.clearRect(0, 0, w, h);
        lineCtx.drawImage(lineImg, 0, 0, w, h);
        const knocked = knockoutLightPixels(lineCtx, w, h);
        if (!knocked && !cancelled) setUseMultiplyFallback(true);

        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const offCtx = get2d(off, true);
        if (!offCtx) throw new Error('No 2d context');
        offCtx.drawImage(mapImg, 0, 0, w, h);
        const mapData = offCtx.getImageData(0, 0, w, h).data;
        const ids = new Uint16Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const o = i * 4;
          ids[i] = decodeRegionId(mapData[o], mapData[o + 1], mapData[o + 3]);
        }
        regionIdsRef.current = ids;
        setReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError('Failed to load coloring assets');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [lineArtUrl, regionMapUrl, hasAssets]);

  const fillRegion = useCallback((regionId: number, hex: string) => {
    if (!regionId) return;
    const ctx = colorCtxRef.current;
    const ids = regionIdsRef.current;
    const { w, h } = dimsRef.current;
    if (!ctx || !ids || !w) return;

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const [r, g, b, a] = hexToRgba(hex);
    let painted = 0;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== regionId) continue;
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
      painted += 1;
    }
    if (painted > 0) {
      ctx.putImageData(img, 0, 0);
      setFillCount((n) => n + 1);
    }
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    e.preventDefault();
    const wrap = e.currentTarget;
    const rect = wrap.getBoundingClientRect();
    const { w, h } = dimsRef.current;
    if (!w || !h || rect.width <= 0 || rect.height <= 0) return;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * w);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const ids = regionIdsRef.current;
    if (!ids) return;
    fillRegion(ids[y * w + x], color);
  };

  const heading = (title || 'COLORING').toUpperCase();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">App preview</h3>
        <span className="text-[11px] text-gray-500">
          Matches /sail/…/lesson/coloring
        </span>
      </div>
      <p className="text-xs text-gray-500">
        {hasAssets
          ? `Pick a color, then tap a region to fill (dry run — not saved).${
              typeof regionCount === 'number' ? ` ${regionCount} regions detected.` : ''
            }`
          : 'Upload line art to preview tap-to-fill in the phone frame.'}
      </p>

      <div className="flex justify-center py-2">
        <div
          className="relative bg-black shadow-xl"
          style={{
            width: PHONE_W * SCALE,
            height: PHONE_H * SCALE,
            borderRadius: 28,
            border: '10px solid #1f2937',
            boxSizing: 'content-box',
            boxShadow:
              '0 12px 40px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
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
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                <button
                  type="button"
                  className="flex items-center justify-center w-11 h-11 rounded-full"
                  style={woodBtnStyle}
                  aria-label="Back"
                  tabIndex={-1}
                >
                  <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
                </button>
                <h1
                  className="flex-1 text-center font-black text-white text-[1.05rem] tracking-wide truncate px-1"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.55)' }}
                >
                  {heading}
                </h1>
                <button
                  type="button"
                  onClick={clearFills}
                  disabled={!hasAssets}
                  className="flex items-center justify-center w-11 h-11 rounded-full active:scale-95 disabled:opacity-40"
                  style={woodBtnStyle}
                  aria-label="Clear fills"
                >
                  <RefreshCw size={20} className="text-white drop-shadow" strokeWidth={2.6} />
                </button>
              </header>

              <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-2.5 gap-3">
                {!hasAssets && (
                  <div className="text-center space-y-2 max-w-sm mx-auto px-2">
                    <p className="font-black text-white text-xl" style={displayFont}>
                      Coloring coming soon
                    </p>
                    <p className="text-white/80 text-sm">
                      Upload a line-art image to preview tap-to-fill.
                    </p>
                  </div>
                )}
                {hasAssets && loadError && (
                  <p className="text-white/90 text-sm text-center">{loadError}</p>
                )}
                {hasAssets && !loadError && (
                  <div
                    className="relative w-full max-w-[368px] rounded-xl overflow-hidden border-4 border-[#6B4423] shadow-2xl bg-white touch-none select-none"
                    style={{ aspectRatio: aspect }}
                    onPointerDown={onPointer}
                    role="img"
                    aria-label="Tap-to-fill coloring preview"
                  >
                    <canvas
                      ref={colorCanvasRef}
                      className="absolute inset-0 w-full h-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <canvas
                      ref={lineCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        imageRendering: 'pixelated',
                        mixBlendMode: useMultiplyFallback ? 'multiply' : 'normal',
                      }}
                    />
                    {!ready && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-bold text-[#5c3a1a]">
                        Loading…
                      </div>
                    )}
                  </div>
                )}

                {hasAssets && (
                  <>
                    <div className="w-full max-w-[368px] max-h-[84px] overflow-y-auto flex flex-wrap gap-2 justify-center content-start">
                      {palette.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-9 h-9 rounded-full border-2 active:scale-95 flex-shrink-0 ${
                            color === c
                              ? 'ring-2 ring-amber-300 border-white'
                              : 'border-[#6B4423]/60'
                          }`}
                          style={getColorSwatchStyle(c)}
                          aria-label={`Color ${c}`}
                          aria-pressed={color === c}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={clearFills}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-95"
                        style={woodBtnStyle}
                        aria-label="Eraser / clear"
                        title="Clear all"
                      >
                        <Eraser size={16} />
                      </button>
                    </div>
                    <p className="text-white/75 text-xs font-semibold">
                      Taps: {fillCount}
                      {!ready && !loadError ? ' · preparing…' : ''}
                    </p>
                  </>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

export default TapFillColoringPreview;
