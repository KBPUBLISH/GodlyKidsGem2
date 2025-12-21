import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Music, Video, ChevronRight, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../constants';

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'book': return 'from-blue-400 to-blue-600';
      case 'playlist': return 'from-purple-400 to-purple-600';
      case 'lesson': return 'from-green-400 to-green-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-amber-800 font-medium">Loading your adventure...</p>
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
    <div className="h-full overflow-auto bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-200/40 rounded-full blur-2xl" />
        <div className="absolute top-32 right-8 w-16 h-16 bg-orange-200/40 rounded-full blur-xl" />
        <div className="absolute bottom-40 left-6 w-24 h-24 bg-amber-200/40 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-12 w-12 h-12 bg-yellow-300/30 rounded-full blur-lg" />
      </div>

      <div className="relative z-10 px-5 py-8 pb-32 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-300/50">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-amber-900 mb-2">
            {config.title}
          </h1>
          <p className="text-amber-700 text-lg">
            {config.subtitle}
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {items.slice(0, config.maxItems).map((item) => (
            <button
              key={item._id}
              onClick={() => handleItemClick(item)}
              className={`relative rounded-2xl overflow-hidden shadow-lg transition-all duration-300 transform ${
                selectedItem?._id === item._id
                  ? 'ring-4 ring-amber-500 ring-offset-2 scale-105'
                  : 'hover:scale-102 active:scale-98'
              }`}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getTypeColor(item.type)}`}>
                    <div className="text-white opacity-50 scale-150">
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                )}
              </div>

              {/* Overlay Info */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-10">
                <p className="text-white font-semibold text-sm line-clamp-2 leading-tight mb-1">
                  {item.title}
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white`}>
                  {getTypeIcon(item.type)}
                  {getTypeLabel(item.type)}
                </div>
              </div>

              {/* Selection Checkmark */}
              {selectedItem?._id === item._id && (
                <div className="absolute top-2 right-2 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Start Button */}
          <button
            onClick={handleStartWithItem}
            disabled={!selectedItem}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
              selectedItem
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-400/50 hover:shadow-xl hover:shadow-amber-400/60 active:scale-98'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedItem ? (
              <>
                Let's Go!
                <ChevronRight className="w-5 h-5" />
              </>
            ) : (
              'Pick something above'
            )}
          </button>

          {/* Skip Button */}
          {config.showSkipButton && (
            <button
              onClick={handleSkip}
              className="w-full py-3 text-amber-700 font-medium hover:text-amber-800 transition-colors"
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

