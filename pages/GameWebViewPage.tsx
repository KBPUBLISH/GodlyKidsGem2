import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { usePreventPullToRefresh } from '../hooks/usePreventPullToRefresh';
import { DespiaService } from '../services/despiaService';

const GameWebViewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawGameUrl = searchParams.get('url') || '';
  const gameName = searchParams.get('name') || 'Game';
  
  // Add cache-busting param to avoid stale content
  const gameUrl = rawGameUrl ? `${rawGameUrl}${rawGameUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}` : '';
  
  // Detect if running in Despia WebView
  const isDespia = !!(window as any).__GK_IS_DESPIA__;
  
  // Debug logging
  console.log('🎮 GameWebViewPage loaded');
  console.log('🎮 Raw URL:', rawGameUrl);
  console.log('🎮 Cache-busted URL:', gameUrl);
  console.log('🎮 Name param:', gameName);
  console.log('🎮 Is Despia:', isDespia);
  
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  usePreventPullToRefresh(!!rawGameUrl);

  // Some hosts (Amazon, Apple, PayPal, etc.) explicitly refuse iframe embedding
  // via X-Frame-Options / CSP frame-ancestors. Detect those up front and bounce
  // out to the in-app browser so the user actually lands on the destination
  // instead of staring at a blank loader.
  const cannotIframe = rawGameUrl ? DespiaService.cannotBeIframed(rawGameUrl) : false;
  useEffect(() => {
    if (rawGameUrl && cannotIframe) {
      console.log('🎮 URL is not iframeable, opening externally:', rawGameUrl);
      DespiaService.openExternalUrl(rawGameUrl);
      // Pop back so user isn't stuck on a blank page after coming back.
      const t = setTimeout(() => {
        if (window.history.length > 2) navigate(-1);
        else navigate('/home', { replace: true });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [rawGameUrl, cannotIframe, navigate]);

  const handleBack = () => {
    // Clear any saved route that might have the game URL
    localStorage.removeItem('gk_last_route');
    // Navigate back or to home if no history
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // If no game URL provided, redirect to home immediately
  // This handles the case where app reopens on this page after force quit
  useEffect(() => {
    if (!rawGameUrl) {
      console.log('🎮 GameWebViewPage: No URL provided, redirecting to home');
      localStorage.removeItem('gk_last_route');
      navigate('/home', { replace: true });
    }
  }, [rawGameUrl, navigate]);
  
  // Timeout detection - if iframe doesn't load within 10 seconds, show fallback
  useEffect(() => {
    if (!gameUrl) return;
    
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('🎮 iframe loading timeout - showing fallback');
        setLoading(false);
        setIframeError(true);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [gameUrl, loading]);

  if (!rawGameUrl) {
    // Show loading while redirecting
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" />
          <p className="text-lg">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Un-iframeable host (Amazon, etc.): show a tiny "Opening…" splash with a manual
  // retry button in case the popup blocker swallowed the auto-redirect.
  if (cannotIframe) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center px-6">
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
          <button
            onClick={handleBack}
            className="mt-4 text-white/70 hover:text-white underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] min-h-0 bg-black flex flex-col overflow-hidden overscroll-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
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

      {/* Game WebView (iframe) */}
      <div
        className={`flex-1 relative min-h-0 overscroll-none ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        style={{ overscrollBehavior: 'none' }}
      >
        <iframe
          src={gameUrl}
          className="w-full h-full border-0 overscroll-none"
          title={gameName}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
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
        
        {/* Fullscreen Exit Button */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 bg-black/70 text-white p-3 rounded-full hover:bg-black/90 transition-colors"
          >
            <Minimize2 size={24} />
          </button>
        )}
        
        {/* Iframe Error Fallback - Option to open in external browser */}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e] z-20">
            <div className="text-center p-6">
              <p className="text-white text-lg mb-4">
                This game couldn't load in the app.
              </p>
              <button
                onClick={() => {
                  // Open in external browser
                  window.open(gameUrl, '_blank');
                }}
                className="bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 mx-auto"
              >
                <ExternalLink size={20} />
                Open in Browser
              </button>
              <button
                onClick={handleBack}
                className="mt-4 text-white/70 hover:text-white underline"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameWebViewPage;


