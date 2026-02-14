import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Check, Volume2, Sparkles } from 'lucide-react';

// ElevenLabs narrators with preview URLs
const NARRATORS = [
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    gender: 'female',
    description: 'Calm & warm',
    personality: 'Like a gentle grandmother telling bedtime stories',
    previewText: 'Hello little one! I\'m Rachel, and I love telling stories about brave kids just like you!',
    emoji: '👵',
    color: 'from-pink-400 to-rose-500',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    gender: 'female',
    description: 'Soft & friendly',
    personality: 'Your kind and cheerful friend',
    previewText: 'Hi there! I\'m Bella! Are you ready for an amazing adventure today?',
    emoji: '🌸',
    color: 'from-purple-400 to-pink-500',
  },
  {
    id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    gender: 'female',
    description: 'Warm & nurturing',
    personality: 'A caring teacher who loves every child',
    previewText: 'Welcome, dear child! I\'m Matilda, and I have a wonderful story to share with you!',
    emoji: '📚',
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    gender: 'male',
    description: 'Deep & warm',
    personality: 'A wise storyteller with a comforting voice',
    previewText: 'Hey there, friend! I\'m Adam. Let me tell you an incredible story about faith and courage!',
    emoji: '🎭',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    gender: 'male',
    description: 'Young & energetic',
    personality: 'An excited big brother ready for adventure',
    previewText: 'Woohoo! I\'m Josh! Get ready because this story is going to be AWESOME!',
    emoji: '🚀',
    color: 'from-green-400 to-emerald-500',
  },
  {
    id: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum',
    gender: 'male',
    description: 'Storyteller voice',
    personality: 'A magical narrator from faraway lands',
    previewText: 'Greetings, young adventurer! I\'m Callum, keeper of the most wondrous tales!',
    emoji: '🏰',
    color: 'from-cyan-400 to-blue-500',
  },
];

interface NarratorSelectorProps {
  kidName: string;
  currentNarratorId?: string;
  onSelect: (narratorId: string, narratorName: string) => void;
  onBack?: () => void;
}

const NarratorSelector: React.FC<NarratorSelectorProps> = ({
  kidName,
  currentNarratorId,
  onSelect,
  onBack,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(currentNarratorId || null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePreview = async (narrator: typeof NARRATORS[0]) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // If clicking the same one that's playing, just stop
    if (playingId === narrator.id) {
      setPlayingId(null);
      return;
    }

    setLoadingId(narrator.id);

    try {
      // Check cache first
      let audioUrl = audioCache[narrator.id];

      if (!audioUrl) {
        // Generate TTS preview
        const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';
        const response = await fetch(`${API_URL}/api/devotional-stories/preview-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: narrator.id,
            text: narrator.previewText,
          }),
        });

        if (!response.ok) throw new Error('Failed to generate preview');

        const data = await response.json();
        audioUrl = data.audioUrl ?? (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : undefined);

        // Cache for later
        setAudioCache(prev => ({ ...prev, [narrator.id]: audioUrl }));
      }

      // Play the audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingId(null);
      };

      audio.onerror = () => {
        setPlayingId(null);
        console.error('Audio playback error');
      };

      await audio.play();
      setPlayingId(narrator.id);
    } catch (error) {
      console.error('Preview error:', error);
      // Show a fallback message or animation instead
    } finally {
      setLoadingId(null);
    }
  };

  const handleSelect = (narrator: typeof NARRATORS[0]) => {
    setSelectedId(narrator.id);
  };

  const handleConfirm = () => {
    if (selectedId) {
      const narrator = NARRATORS.find(n => n.id === selectedId);
      if (narrator) {
        onSelect(narrator.id, narrator.name);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-900 p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="text-white/80 text-sm">Choose Your Storyteller</span>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Hi {kidName}! 👋
        </h1>
        <p className="text-white/70 text-sm max-w-xs mx-auto">
          Pick someone to read your personalized stories. You can always change this later!
        </p>
      </div>

      {/* Narrator Grid */}
      <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto mb-6">
        {NARRATORS.map((narrator) => {
          const isSelected = selectedId === narrator.id;
          const isPlaying = playingId === narrator.id;
          const isLoading = loadingId === narrator.id;

          return (
            <div
              key={narrator.id}
              onClick={() => handleSelect(narrator)}
              className={`
                relative rounded-2xl p-4 cursor-pointer transition-all duration-300
                ${isSelected 
                  ? 'bg-white ring-4 ring-yellow-400 shadow-lg shadow-yellow-400/20 scale-105' 
                  : 'bg-white/10 backdrop-blur-sm hover:bg-white/20'
                }
              `}
            >
              {/* Selected badge */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-yellow-900" />
                </div>
              )}

              {/* Avatar */}
              <div className={`
                w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center text-3xl
                bg-gradient-to-br ${narrator.color}
              `}>
                {narrator.emoji}
              </div>

              {/* Info */}
              <h3 className={`font-bold text-center ${isSelected ? 'text-gray-900' : 'text-white'}`}>
                {narrator.name}
              </h3>
              <p className={`text-xs text-center ${isSelected ? 'text-gray-600' : 'text-white/60'}`}>
                {narrator.description}
              </p>

              {/* Preview button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(narrator);
                }}
                className={`
                  mt-3 w-full py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all
                  ${isSelected 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                  }
                  ${isLoading ? 'opacity-50' : ''}
                `}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Playing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Preview
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Personality hint for selected */}
      {selectedId && (
        <div className="max-w-lg mx-auto mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-start gap-3">
            <Volume2 className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-white/80 text-sm">
              <span className="font-semibold text-white">
                {NARRATORS.find(n => n.id === selectedId)?.name}:
              </span>{' '}
              {NARRATORS.find(n => n.id === selectedId)?.personality}
            </p>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-indigo-900 via-indigo-900/95 to-transparent">
        <div className="max-w-lg mx-auto flex gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-xl font-semibold bg-white/10 text-white"
            >
              Back
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className={`
              flex-1 py-3 rounded-xl font-semibold transition-all
              ${selectedId
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 shadow-lg shadow-yellow-500/30'
                : 'bg-white/20 text-white/50 cursor-not-allowed'
              }
            `}
          >
            {selectedId ? `Continue with ${NARRATORS.find(n => n.id === selectedId)?.name}` : 'Select a Narrator'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NarratorSelector;
