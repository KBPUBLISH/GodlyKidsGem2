import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
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

function get2d(
  canvas: HTMLCanvasElement,
  willReadFrequently = false,
): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently });
}

export interface TapFillCanvasProps {
  lineArtUrl: string;
  regionMapUrl: string;
  color: string;
  saveKey?: string;
  className?: string;
  onReadyChange?: (ready: boolean) => void;
  onFill?: (regionId: number) => void;
}

export type TapFillCanvasHandle = { clear: () => void };

/**
 * Tap a region on the region map to flood-fill with the selected palette color.
 * Colors draw under the line-art layer (line art white is knocked out to alpha).
 */
const TapFillCanvas = React.forwardRef<TapFillCanvasHandle, TapFillCanvasProps>(
  function TapFillCanvas(
    { lineArtUrl, regionMapUrl, color, saveKey, className = '', onReadyChange, onFill },
    ref,
  ) {
    const colorCanvasRef = useRef<HTMLCanvasElement>(null);
    const lineCanvasRef = useRef<HTMLCanvasElement>(null);
    const colorCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const regionIdsRef = useRef<Uint16Array | null>(null);
    const dimsRef = useRef({ w: 0, h: 0 });
    const [ready, setReady] = useState(false);
    const [useMultiplyFallback, setUseMultiplyFallback] = useState(false);
    const [aspect, setAspect] = useState('1 / 1');
    const storageKey = saveKey ? `godlykids_tapfill_${saveKey}` : null;

    const setReadyState = useCallback(
      (v: boolean) => {
        setReady(v);
        onReadyChange?.(v);
      },
      [onReadyChange],
    );

    const persist = useCallback(() => {
      if (!storageKey) return;
      const canvas = colorCanvasRef.current;
      if (!canvas) return;
      try {
        localStorage.setItem(storageKey, canvas.toDataURL('image/png'));
      } catch {
        /* quota */
      }
    }, [storageKey]);

    const clear = useCallback(() => {
      const ctx = colorCtxRef.current;
      const { w, h } = dimsRef.current;
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
    }, [storageKey]);

    useImperativeHandle(ref, () => ({ clear }), [clear]);

    useEffect(() => {
      let cancelled = false;
      setReadyState(false);
      setUseMultiplyFallback(false);
      regionIdsRef.current = null;
      colorCtxRef.current = null;

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

          if (storageKey) {
            try {
              const saved = localStorage.getItem(storageKey);
              if (saved) {
                const img = await loadImage(saved);
                if (!cancelled) colorCtx.drawImage(img, 0, 0, w, h);
              }
            } catch {
              /* ignore corrupt save */
            }
          }

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
          setReadyState(true);
        } catch (err) {
          console.error('TapFillCanvas load failed', err);
          if (!cancelled) setReadyState(false);
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    }, [lineArtUrl, regionMapUrl, storageKey, setReadyState]);

    const fillRegion = useCallback(
      (regionId: number, hex: string) => {
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
          persist();
          onFill?.(regionId);
        }
      },
      [onFill, persist],
    );

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

    return (
      <div
        className={`relative w-full rounded-xl overflow-hidden border-4 border-[#6B4423] shadow-2xl bg-white touch-none select-none ${className}`}
        style={{ aspectRatio: aspect }}
        onPointerDown={onPointer}
        role="img"
        aria-label="Tap regions to color"
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
          <div className="absolute inset-0 flex items-center justify-center bg-white/85 font-display font-bold text-[#5c3a1a]">
            Loading…
          </div>
        )}
      </div>
    );
  },
);

export default TapFillCanvas;
