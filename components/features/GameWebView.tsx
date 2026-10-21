import React, { useEffect, useState } from 'react';
import { X, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '../../context/AudioContext';
import { usePreventPullToRefresh } from '../../hooks/usePreventPullToRefresh';

interface GameWebViewProps {
  url: string;
  title: string;
  onClose: () => void;
}

const GameWebView: React.FC<GameWebViewProps> = ({ url, title, onClose }) => {
  usePreventPullToRefresh(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const { currentPlaylist } = useAudio();
  
  // Check if MiniPlayer is visible (playlist is playing)
  const hasMiniPlayer = !!currentPlaylist;

  // Unlock audio session before game loads - helps iframe inherit unlocked state
  useEffect(() => {
    const unlockAudio = async () => {
      try {
        // Create and resume an AudioContext to unlock iOS audio
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          await ctx.resume();
          
          // Play a brief silent tone to fully unlock
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          gainNode.gain.value = 0.001; // Nearly silent
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.1);
          
          console.log('🎮 Game audio context unlocked');
        }
        setAudioUnlocked(true);
      } catch (e) {
        console.log('🎮 Audio unlock not needed:', e);
        setAudioUnlocked(true);
      }
    };
    
    unlockAudio();
  }, []);

  useEffect(() => {
    // Reset loading state when URL changes
    setLoading(true);
    setError(null);
  }, [url]);

  const handleLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleError = () => {
    setLoading(false);
    setError('Failed to load game. Please check the URL and try again.');
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoading(true);
      setError(null);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex flex-col overscroll-none overflow-hidden ${hasMiniPlayer ? 'pb-20' : ''}`}
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Header */}
      <div className="bg-[#1a103c] text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 bg-[#1a103c] flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-sm">Loading game...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 bg-[#1a103c] flex items-center justify-center z-10 p-4">
          <div className="text-center max-w-md">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* WebView iframe - only load after audio is unlocked */}
      {audioUnlocked && (
        <iframe
          ref={iframeRef}
          src={url}
          className="flex-1 w-full min-h-0 border-0 overscroll-none"
          style={{ overscrollBehavior: 'none' }}
          onLoad={handleLoad}
          onError={handleError}
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture; speaker; microphone; web-share"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-presentation"
          title={title}
        />
      )}
    </div>
  );
};

export default GameWebView;




