import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface AudioFileItemProps {
  file: File;
  onRemove: () => void;
}

const AudioFileItem: React.FC<AudioFileItemProps> = ({ file, onRemove }) => {
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setLoading(false);
      URL.revokeObjectURL(url);
    };

    const handleError = () => {
      setLoading(false);
      URL.revokeObjectURL(url);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
      URL.revokeObjectURL(url);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="flex items-center justify-between p-3 bg-[#3E1F07] rounded-xl border border-[#5D2E0E]">
      <div className="flex-1 text-white text-sm">
        <p className="font-bold">{file.name}</p>
        <div className="flex gap-3 text-white/70">
          <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          {loading && <p className="text-white/50">Loading duration...</p>}
          {!loading && duration !== null && (
            <p className={duration >= 60 ? 'text-green-400' : 'text-yellow-400'}>
              • {Math.floor(duration)}s {duration >= 60 ? '✓' : '(need more)'}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-2 hover:bg-red-600 rounded-lg transition-colors"
      >
        <Trash2 className="text-white" size={18} />
      </button>
    </div>
  );
};

export default AudioFileItem;


