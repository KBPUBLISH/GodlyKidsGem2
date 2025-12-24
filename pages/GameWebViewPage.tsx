import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

const GameWebViewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameUrl = searchParams.get('url') || '';
  const gameName = searchParams.get('name') || 'Game';
  
  // Detect if running in Despia WebView
  const isDespia = !!(window as any).__GK_IS_DESPIA__;
  
  // Debug logging
  console.log('🎮 GameWebViewPage loaded');
  console.log('🎮 URL param:', gameUrl);
  console.log('🎮 Name param:', gameName);
  console.log('🎮 Full search params:', searchParams.toString());
  console.log('🎮 Is Despia:', isDespia);
  
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);

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
    if (!gameUrl) {
      console.log('🎮 GameWebViewPage: No URL provided, redirecting to home');
      localStorage.removeItem('gk_last_route');
      navigate('/home', { replace: true });
    }
  }, [gameUrl, navigate]);
  
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

  if (!gameUrl) {
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

  return (
    <div className="min-h-screen bg-black flex flex-col">
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
      <div className={`flex-1 relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
        <iframe
          src={gameUrl}
          className="w-full h-full border-0"
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


