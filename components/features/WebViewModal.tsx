import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Loader2 } from 'lucide-react';

interface WebViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

const WebViewModal: React.FC<WebViewModalProps> = ({ isOpen, onClose, url, title }) => {
  const [isLoading, setIsLoading] = React.useState(true);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#fdf6e3]">
      {/* Header */}
      <div className="relative z-30 pt-8 pb-4 px-4 bg-[#CD853F] shadow-md border-b border-[#8B4513] shrink-0">
        {/* Wood Texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
        
        <div className="relative flex items-center justify-between z-10">
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-[#8B4513] hover:bg-[#A0522D] rounded-full flex items-center justify-center text-[#f3e5ab] border-2 border-[#eecaa0] active:scale-95 transition-transform shadow-md"
            aria-label="Close"
          >
            <X size={24} strokeWidth={3} />
          </button>
          
          <h1 className="flex-1 text-center font-display font-extrabold text-[#5c2e0b] text-lg tracking-wide drop-shadow-sm uppercase truncate px-2">
            {title}
          </h1>
          
          <a 
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 bg-[#8B4513] hover:bg-[#A0522D] rounded-full flex items-center justify-center text-[#f3e5ab] border-2 border-[#eecaa0] active:scale-95 transition-transform shadow-md"
            aria-label="Open in browser"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#fdf6e3] z-10 pt-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#8B4513]" />
            <span className="text-[#5c2e0b] font-bold">Loading...</span>
          </div>
        </div>
      )}

      {/* WebView (iframe) */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title={title}
          onLoad={() => setIsLoading(false)}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>,
    document.body
  );
};

export default WebViewModal;

