import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import { DespiaService } from '../services/despiaService';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
  resolveIslandSceneReturn,
  type IslandSceneReaderState,
} from '../utils/islandSceneReturn';
import {
  ensureFamobiCdnSrc,
  installParentWindowOpenGuard,
  isFamobiCdnUrl,
  isFamobiGameUrl,
  isFamobiSplashUrl,
  kidSafeIframeProps,
  resolveFamobiEmbedUrl,
  toKidSafeGameUrl,
} from '../utils/kidSafeGameIframe';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const GameWebViewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawGameUrl = searchParams.get('url') || '';
  const gameName = searchParams.get('name') || 'Game';
  const isFamobi = isFamobiGameUrl(rawGameUrl);

  const islandReturn = useMemo(
    () =>
      resolveIslandSceneReturn(
        location.state as IslandSceneReaderState | null,
        searchParams,
      ),
    [location.state, searchParams],
  );
  const fromIslandScene = Boolean(islandReturn);

  const [resolvedUrl, setResolvedUrl] = useState(() =>
    rawGameUrl ? toKidSafeGameUrl(rawGameUrl) : '',
  );
  const [iframeKey, setIframeKey] = useState(0);

  // Cache-bust once per resolved URL so remounts don't reload on every render.
  const gameUrl = useMemo(() => {
    if (!resolvedUrl) return '';
    const sep = resolvedUrl.includes('?') ? '&' : '?';
    return `${resolvedUrl}${sep}_cb=${Date.now()}`;
  }, [resolvedUrl, iframeKey]);

  const isDespia = !!(window as any).__GK_IS_DESPIA__;

  console.log('🎮 GameWebViewPage loaded');
  console.log('🎮 Raw URL:', rawGameUrl);
  console.log('🎮 Resolved URL:', resolvedUrl);
  console.log('🎮 Cache-busted URL:', gameUrl);
  console.log('🎮 Name param:', gameName);
  console.log('🎮 Is Despia:', isDespia);
  console.log('🎮 Famobi kid-safe:', isFamobi);
  console.log('🎮 From island scene:', fromIslandScene);

  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(fromIslandScene);
  const [iframeError, setIframeError] = useState(false);

  usePreventPullToRefresh(!!rawGameUrl);

  // Resolve Famobi CDN embed (skip play.famobi "Play" splash).
  useEffect(() => {
    if (!rawGameUrl || !isFamobi) {
      setResolvedUrl(rawGameUrl ? toKidSafeGameUrl(rawGameUrl) : '');
      return;
    }
    const ac = new AbortController();
    const initial = ensureFamobiCdnSrc(toKidSafeGameUrl(rawGameUrl));
    setResolvedUrl(initial);
    resolveFamobiEmbedUrl(rawGameUrl, ac.signal).then((url) => {
      if (ac.signal.aborted || !url) return;
      const safe = ensureFamobiCdnSrc(url);
      if (!isFamobiSplashUrl(safe)) setResolvedUrl(safe);
    });
    return () => ac.abort();
  }, [rawGameUrl, isFamobi, iframeKey]);

  // Never leave Famobi iframes on the splash host.
  useEffect(() => {
    if (!isFamobi || !resolvedUrl) return;
    if (isFamobiSplashUrl(resolvedUrl) || !isFamobiCdnUrl(resolvedUrl)) {
      const safe = ensureFamobiCdnSrc(resolvedUrl || rawGameUrl);
      if (safe && safe !== resolvedUrl) setResolvedUrl(safe);
    }
  }, [isFamobi, resolvedUrl, rawGameUrl]);

  useEffect(() => {
    if (!gameUrl || !isFamobi) return;
    return installParentWindowOpenGuard();
  }, [gameUrl, isFamobi]);

  // Some hosts refuse iframe embedding. For Games-tab opens, bounce to external
  // browser. Famobi stays in-app (kid-safe). Island Scene keeps overlay.
  const cannotIframe = rawGameUrl
    ? !isFamobi && DespiaService.cannotBeIframed(rawGameUrl)
    : false;
  useEffect(() => {
    if (!rawGameUrl || !cannotIframe || fromIslandScene || isFamobi) return;
    console.log('🎮 URL is not iframeable, opening externally:', rawGameUrl);
    DespiaService.openExternalUrl(rawGameUrl);
    const t = setTimeout(() => {
      if (window.history.length > 2) navigate(-1);
      else navigate('/home', { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [rawGameUrl, cannotIframe, fromIslandScene, isFamobi, navigate]);

  const handleBack = useCallback(() => {
    localStorage.removeItem('gk_last_route');
    if (islandReturn) {
      const path = buildIslandScenePath(islandReturn);
      if (path) {
        navigate(path, { state: buildIslandSceneNavState(islandReturn) });
        return;
      }
    }
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  }, [islandReturn, navigate]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const retryLoad = useCallback(() => {
    setIframeError(false);
    setLoading(true);
    setResolvedUrl(rawGameUrl ? toKidSafeGameUrl(rawGameUrl) : '');
    setIframeKey((k) => k + 1);
  }, [rawGameUrl]);

  // If no game URL provided, redirect to home immediately
  useEffect(() => {
    if (!rawGameUrl) {
      console.log('🎮 GameWebViewPage: No URL provided, redirecting to home');
      localStorage.removeItem('gk_last_route');
      navigate('/home', { replace: true });
    }
  }, [rawGameUrl, navigate]);

  // Timeout detection - if iframe doesn't load within 10 seconds, show fallback
  useEffect(() => {
    if (!gameUrl || cannotIframe) return;

    const timeout = setTimeout(() => {
      if (loading) {
        console.log('🎮 iframe loading timeout - showing fallback');
        setLoading(false);
        setIframeError(true);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [gameUrl, loading, cannotIframe, iframeKey]);

  const woodBackOverlay = (
    <button
      type="button"
      onClick={handleBack}
      className="fixed z-[60] flex items-center justify-center w-12 h-12 rounded-full active:scale-95 transition-transform"
      style={{
        ...woodBtnStyle,
        bottom: 'max(var(--safe-area-bottom, 0px), 12px)',
        left: 'max(var(--safe-area-left, 0px), 12px)',
      }}
      aria-label={fromIslandScene ? 'Back to island scene' : 'Back'}
    >
      <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
    </button>
  );

  if (!rawGameUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" />
          <p className="text-lg">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Un-iframeable host: Island Scene keeps overlay + manual open; others splash then leave.
  if (cannotIframe) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center px-6">
        {fromIslandScene && woodBackOverlay}
        <div className="text-center text-white max-w-sm">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" />
          <p className="text-lg mb-2">Opening {gameName}…</p>
          <p className="text-white/60 text-sm mb-6">
            This site can't be displayed inside the app, so we're opening it in your browser.
          </p>
          <button
            onClick={() => DespiaService.openExternalUrl(rawGameUrl)}
            className="bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto"
          >
            <ExternalLink size={18} />
            Open in Browser
          </button>
          {!fromIslandScene && (
            <button
              onClick={handleBack}
              className="mt-4 text-white/70 hover:text-white underline"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const iframeProps = kidSafeIframeProps(gameName, {
    famobiCdn: isFamobi && isFamobiCdnUrl(resolvedUrl),
  });

  return (
    <div
      className="h-[100dvh] min-h-0 bg-black flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Island Scene: floating wood back only. Games tab: keep chrome header. */}
      {fromIslandScene ? (
        woodBackOverlay
      ) : (
        !isFullscreen && (
          <div className="bg-gradient-to-r from-[#2d1b4e] to-[#1a1a2e] px-4 py-3 flex items-center justify-between safe-area-top">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
              <span className="font-semibold">Back</span>
            </button>

            <h1 className="text-white font-bold text-lg truncate max-w-[50%]">
              {gameName}
            </h1>

            <button
              onClick={toggleFullscreen}
              className="text-white/90 hover:text-white transition-colors p-2"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        )
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center">
            <Loader2 size={48} className="text-[#4CAF50] animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Loading {gameName}...</p>
          </div>
        </div>
      )}

      {/* Game WebView (iframe) — preferred so HTML back overlay always works */}
      <div
        className={`flex-1 relative min-h-0 overscroll-none ${isFullscreen && !fromIslandScene ? 'fixed inset-0 z-50' : ''}`}
        style={{ overscrollBehavior: 'none' }}
      >
        <iframe
          key={iframeKey}
          src={gameUrl}
          className="w-full h-full border-0 overscroll-none"
          {...iframeProps}
          onLoad={() => {
            console.log('🎮 iframe loaded successfully for:', gameUrl);
            setLoading(false);
          }}
          onError={(e) => {
            console.error('🎮 iframe error:', e);
            setLoading(false);
            setIframeError(true);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overscrollBehavior: 'none',
          }}
        />

        {/* Fullscreen Exit Button (Games tab only) */}
        {isFullscreen && !fromIslandScene && (
          <>
            {woodBackOverlay}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-50 bg-black/70 text-white p-3 rounded-full hover:bg-black/90 transition-colors"
              style={{ top: 'max(var(--safe-area-top, 0px), 16px)' }}
            >
              <Minimize2 size={24} />
            </button>
          </>
        )}

        {/* Iframe Error Fallback — Famobi stays in-app (no external browser). */}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e] z-20">
            <div className="text-center p-6">
              <p className="text-white text-lg mb-4">
                This game couldn&apos;t load in the app.
              </p>
              {isFamobi ? (
                <button
                  type="button"
                  onClick={retryLoad}
                  className="bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 px-6 rounded-xl mx-auto"
                >
                  Try again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    DespiaService.openExternalUrl(rawGameUrl || gameUrl);
                  }}
                  className="bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto"
                >
                  <ExternalLink size={20} />
                  Open in Browser
                </button>
              )}
              {!fromIslandScene && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="mt-4 text-white/70 hover:text-white underline"
                >
                  Go Back
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameWebViewPage;
