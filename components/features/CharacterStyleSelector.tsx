import React, { useState } from 'react';
import { Check, Sparkles, Wand2, Loader2 } from 'lucide-react';
import WoodButton from '../ui/WoodButton';

export interface CharacterStyle {
  id: string;
  name: string;
  description: string;
  previewEmoji: string;
  gradient: string;
  borderColor: string;
}

interface CharacterStyleSelectorProps {
  isOpen: boolean;
  selfiePreview?: string;
  onSelect: (styleId: string) => void;
  onBack: () => void;
  onClose: () => void;
  isGenerating?: boolean;
  childName?: string;
  /** When provided (e.g. "Next: take selfie"), used instead of "Create My Character!" for the confirm button */
  confirmLabel?: string;
}

// Order: Pixar, Minecraft, Disney first (main styles); then LEGO, Anime, Illustrated.
export const CHARACTER_STYLES: CharacterStyle[] = [
  {
    id: 'pixar',
    name: 'Pixar',
    description: 'Full body on a ship deck',
    previewEmoji: '🎬',
    gradient: 'from-[#11998E] to-[#38EF7D]',
    borderColor: 'border-[#00B894]'
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    description: 'Blocky style on a ship deck',
    previewEmoji: '🟫',
    gradient: 'from-[#7B5B3A] to-[#5D4427]',
    borderColor: 'border-[#8B6914]'
  },
  {
    id: 'disney',
    name: 'Disney',
    description: '2D Disney style on a ship deck',
    previewEmoji: '✨',
    gradient: 'from-[#667EEA] to-[#764BA2]',
    borderColor: 'border-[#5B52CC]'
  },
  {
    id: 'lego',
    name: 'LEGO',
    description: 'Minifigure in a scene',
    previewEmoji: '🧱',
    gradient: 'from-[#FFD500] to-[#E6C200]',
    borderColor: 'border-[#CC0000]'
  },
  {
    id: 'cartoon',
    name: 'Anime',
    description: 'Anime style in a scene',
    previewEmoji: '🎨',
    gradient: 'from-[#FF6B6B] to-[#FF8E53]',
    borderColor: 'border-[#FF4757]'
  },
  {
    id: 'illustrated',
    name: 'Illustrated',
    description: 'Storybook in a scene',
    previewEmoji: '📚',
    gradient: 'from-[#A8E6CF] to-[#7FCDCD]',
    borderColor: 'border-[#3D9970]'
  }
];

const CharacterStyleSelector: React.FC<CharacterStyleSelectorProps> = ({
  isOpen,
  selfiePreview,
  onSelect,
  onBack,
  onClose,
  isGenerating = false,
  childName = 'there',
  confirmLabel,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const handleStyleClick = (styleId: string) => {
    if (!isGenerating) {
      setSelectedStyle(styleId);
    }
  };

  const handleConfirm = () => {
    if (selectedStyle) {
      onSelect(selectedStyle);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 overflow-y-auto py-4">
      <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-[#2A1810] to-[#1A0F0A] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-[#8B4513] to-[#A0522D]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Choose Your Style</h2>
              <p className="text-white/80 text-sm">
                You’ll appear full-body on a ship deck, {childName}!
              </p>
            </div>
          </div>
        </div>

        {/* Selfie Preview */}
        {selfiePreview && (
          <div className="flex justify-center py-4 bg-black/20">
            <div className="relative">
              <img
                src={selfiePreview}
                alt="Your selfie"
                className="w-24 h-24 rounded-full object-cover border-4 border-[#FFD700] shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-[#4CAF50] rounded-full">
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Style Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {CHARACTER_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => handleStyleClick(style.id)}
                disabled={isGenerating}
                className={`
                  relative p-4 rounded-2xl transition-all duration-200
                  ${selectedStyle === style.id 
                    ? `bg-gradient-to-br ${style.gradient} scale-[1.02] shadow-lg ring-4 ring-[#FFD700]` 
                    : 'bg-[#3A2A1A] hover:bg-[#4A3A2A]'
                  }
                  ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Selection checkmark */}
                {selectedStyle === style.id && (
                  <div className="absolute top-2 right-2 p-1 bg-[#FFD700] rounded-full">
                    <Check className="w-4 h-4 text-[#2A1810]" />
                  </div>
                )}

                {/* Style preview */}
                <div className="text-4xl mb-2">{style.previewEmoji}</div>
                
                {/* Style info */}
                <h3 className={`font-bold text-lg ${selectedStyle === style.id ? 'text-white' : 'text-[#FFD700]'}`}>
                  {style.name}
                </h3>
                <p className={`text-xs ${selectedStyle === style.id ? 'text-white/80' : 'text-white/60'}`}>
                  {style.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Generating State */}
        {isGenerating && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-center gap-4 py-5 px-6 bg-gradient-to-r from-[#667EEA] to-[#764BA2] rounded-xl">
              <div className="flex-shrink-0">
                <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin" aria-hidden />
              </div>
              <div className="text-white text-left min-w-0">
                <p className="font-bold">Creating your character...</p>
                <p className="text-sm text-white/80">This takes about 10 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 pt-2 space-y-3">
          <button
            onClick={handleConfirm}
            disabled={!selectedStyle || isGenerating}
            className={`
              w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold text-lg transition-all
              ${selectedStyle && !isGenerating
                ? 'bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] hover:from-[#43A047] hover:to-[#5CB85C] text-white shadow-lg'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Sparkles className="w-6 h-6" />
            {isGenerating ? 'Creating...' : (confirmLabel ?? 'Create My Character!')}
          </button>

          {!isGenerating && (
            <button
              onClick={onBack}
              className="w-full py-3 px-6 bg-transparent border-2 border-white/30 hover:border-white/50 rounded-xl text-white/80 hover:text-white font-medium transition-all"
            >
              ← Take a Different Photo
            </button>
          )}
        </div>

        {/* Style Examples Note */}
        {!isGenerating && (
          <div className="px-6 pb-6">
            <p className="text-center text-white/50 text-xs">
              We’ll place you full-body on a ship deck in your chosen style — not just a portrait!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterStyleSelector;
