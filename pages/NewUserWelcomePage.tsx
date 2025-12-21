import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Music, Video, ChevronRight, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../constants';
import WoodButton from '../components/ui/WoodButton';
import { useAudio } from '../context/AudioContext';

interface ContentItem {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: 'book' | 'playlist' | 'lesson';
}

interface WelcomeConfig {
  title: string;
  subtitle: string;
  skipButtonText: string;
  showSkipButton: boolean;
  maxItems: number;
}

const NewUserWelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { playClick } = useAudio();
  const [config, setConfig] = useState<WelcomeConfig>({
    title: 'Welcome to Godly Kids!',
    subtitle: 'Pick something to start your adventure.',
    skipButtonText: 'Skip for now',
    showSkipButton: true,
    maxItems: 6,
  });
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    fetchWelcomeContent();
  }, []);

  const fetchWelcomeContent = async () => {
    try {
      const envUrl = import.meta.env.VITE_API_BASE_URL;
      const baseUrl = envUrl || API_BASE_URL;
      const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      
      const response = await fetch(`${apiBase}/featured/new-user`);
      const data = await response.json();
      
      if (data.success) {
        if (data.config) {
          setConfig({
            title: data.config.title || 'Welcome to Godly Kids!',
            subtitle: data.config.subtitle || 'Pick something to start your adventure.',
            skipButtonText: data.config.skipButtonText || 'Skip for now',
            showSkipButton: data.config.showSkipButton !== false,
            maxItems: data.config.maxItems || 6,
          });
        }
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching welcome content:', error);
    } finally {
      setLoading(false);
    }
  };

  const markWelcomeSeen = () => {
    localStorage.setItem('godlykids_welcome_seen', 'true');
  };

  const handleItemClick = (item: ContentItem) => {
    playClick();
    setSelectedItem(item);
  };

  const handleStartWithItem = () => {
    if (!selectedItem) return;
    
    markWelcomeSeen();
    
    // Navigate based on content type
    switch (selectedItem.type) {
      case 'book':
        navigate(`/book/${selectedItem._id}`);
        break;
      case 'playlist':
        navigate(`/audio/playlist/${selectedItem._id}`);
        break;
      case 'lesson':
        navigate(`/lesson/${selectedItem._id}`);
        break;
      default:
        navigate('/home');
    }
  };

  const handleSkip = () => {
    playClick();
    markWelcomeSeen();
    navigate('/home');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'book': return <BookOpen className="w-4 h-4" />;
      case 'playlist': return <Music className="w-4 h-4" />;
      case 'lesson': return <Video className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'book': return 'Book';
      case 'playlist': return 'Music';
      case 'lesson': return 'Lesson';
      default: return '';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'book': return 'bg-[#8B4513]/80 text-white';
      case 'playlist': return 'bg-[#FFD700]/90 text-[#5c2e0b]';
      case 'lesson': return 'bg-[#228B22]/80 text-white';
      default: return 'bg-[#8B4513]/80 text-white';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FFD700] mx-auto mb-4" />
          <p className="text-white/80 font-medium">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  // If no items configured, skip to home
  if (items.length === 0) {
    markWelcomeSeen();
    navigate('/home');
    return null;
  }

  return (
    <div className="h-full overflow-auto">
      {/* Wood panel background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a1810] via-[#3d2317] to-[#1a0f0a]" />
      
      {/* Wood grain texture overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ 
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 51px)',
        }}
      />

      <div className="relative z-10 px-5 py-8 pb-32 max-w-lg mx-auto">
        {/* Header with gold accent */}
        <div className="text-center mb-8">
          {/* Golden sparkle icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-[#FFD700] to-[#B8860B] rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#FFD700]/30 border-4 border-[#8B4513]">
            <Sparkles className="w-10 h-10 text-[#5c2e0b]" />
          </div>
          
          {/* Wood plank title */}
          <div className="bg-[#8B4513] rounded-xl px-6 py-4 shadow-lg border-b-4 border-[#5c2e0b] mb-4 inline-block">
            <h1 className="text-2xl font-bold text-white drop-shadow-md font-display">
              {config.title}
            </h1>
          </div>
          
          <p className="text-white/80 text-lg">
            {config.subtitle}
          </p>
        </div>

        {/* Content Grid - Wood card style */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {items.slice(0, config.maxItems).map((item) => (
            <button
              key={item._id}
              onClick={() => handleItemClick(item)}
              className={`relative rounded-xl overflow-hidden shadow-lg transition-all duration-300 transform border-4 ${
                selectedItem?._id === item._id
                  ? 'border-[#FFD700] scale-105 shadow-[#FFD700]/30'
                  : 'border-[#5c2e0b] hover:border-[#8B4513] hover:scale-102 active:scale-98'
              }`}
            >
              {/* Image */}
              <div className="aspect-square bg-[#3d2317]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#8B4513] to-[#5c2e0b]">
                    <div className="text-white/30 scale-150">
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                )}
              </div>

              {/* Wood plank info bar */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2a1810] via-[#3d2317]/95 to-transparent p-3 pt-10">
                <p className="text-white font-bold text-sm line-clamp-2 leading-tight mb-1 drop-shadow-md">
                  {item.title}
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getTypeBadgeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                  {getTypeLabel(item.type)}
                </div>
              </div>

              {/* Gold checkmark for selected */}
              {selectedItem?._id === item._id && (
                <div className="absolute top-2 right-2 w-8 h-8 bg-gradient-to-br from-[#FFD700] to-[#B8860B] rounded-full flex items-center justify-center shadow-lg border-2 border-[#8B4513]">
                  <svg className="w-5 h-5 text-[#5c2e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Gold "Let's Go" Button */}
          <WoodButton
            variant="gold"
            fullWidth
            onClick={handleStartWithItem}
            disabled={!selectedItem}
            className={`text-lg py-4 ${!selectedItem ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="flex items-center justify-center gap-2">
              {selectedItem ? (
                <>
                  Let's Go!
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                'Pick something above'
              )}
            </span>
          </WoodButton>

          {/* Skip Button - wood style */}
          {config.showSkipButton && (
            <button
              onClick={handleSkip}
              className="w-full py-3 text-white/70 font-medium hover:text-white transition-colors"
            >
              {config.skipButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewUserWelcomePage;

// Helper to check if welcome screen should be shown
export const shouldShowWelcome = (): boolean => {
  return !localStorage.getItem('godlykids_welcome_seen');
};
