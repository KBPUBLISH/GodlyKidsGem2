import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Music, Video } from 'lucide-react';
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

// Small twinkling dot star
const TwinklingStar: React.FC<{ delay: number; size: number; top: string; left: string }> = ({ delay, size, top, left }) => (
  <div
    className="absolute rounded-full bg-white"
    style={{
      width: size,
      height: size,
      top,
      left,
      animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      opacity: 0.6 + Math.random() * 0.4,
    }}
  />
);

// Diamond/Cross shaped star (like in the reference image)
const DiamondStar: React.FC<{ size: number; top: string; left: string; delay: number }> = ({ size, top, left, delay }) => (
  <svg
    className="absolute"
    style={{ top, left, animation: `twinkle ${3 + Math.random()}s ease-in-out infinite`, animationDelay: `${delay}s` }}
    width={size}
    height={size}
    viewBox="0 0 24 24"
  >
    {/* 4-point star shape */}
    <path
      d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z"
      fill="white"
      opacity="0.9"
    />
  </svg>
);

// Shooting star component
const ShootingStar: React.FC<{ delay: number; top: number }> = ({ delay, top }) => (
  <div
    className="absolute w-1 h-1 bg-white rounded-full"
    style={{
      top: `${top}%`,
      left: '-5%',
      animation: `shootingStar 4s linear infinite`,
      animationDelay: `${delay}s`,
      boxShadow: '0 0 6px 2px rgba(255, 255, 255, 0.6)',
    }}
  />
);

const NewUserWelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { playClick } = useAudio();
  const [config, setConfig] = useState<WelcomeConfig>({
    title: 'Choose a Bedtime Story',
    subtitle: 'Pick something to start your adventure',
    skipButtonText: 'Skip for now',
    showSkipButton: true,
    maxItems: 20, // No longer limiting
  });
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  // Generate random small dot stars
  const smallStars = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      delay: Math.random() * 4,
      size: 1 + Math.random() * 2,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
    })), []
  );

  // Generate diamond/cross shaped stars (fewer, larger, more prominent)
  const diamondStars = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: Math.random() * 3,
      size: 8 + Math.random() * 12,
      top: `${5 + Math.random() * 90}%`,
      left: `${5 + Math.random() * 90}%`,
    })), []
  );

  useEffect(() => {
    fetchWelcomeContent();
  }, []);

  // Trigger content animation after loading
  useEffect(() => {
    if (!loading && items.length > 0) {
      setTimeout(() => setShowContent(true), 100);
    }
  }, [loading, items]);

  const fetchWelcomeContent = async () => {
    try {
      const envUrl = import.meta.env.VITE_API_BASE_URL;
      let baseUrl = envUrl || API_BASE_URL;
      // Normalize: remove trailing slashes and ensure single /api
      baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
      const apiBase = `${baseUrl}/api`;
      
      const response = await fetch(`${apiBase}/featured/new-user`);
      const data = await response.json();
      
      if (data.success) {
        if (data.config) {
          setConfig({
            title: data.config.title || 'Choose a Bedtime Story',
            subtitle: data.config.subtitle || 'Pick something to start your adventure',
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

  // Direct navigation - no extra tap needed
  const handleItemClick = (item: ContentItem) => {
    playClick();
    markWelcomeSeen();
    
    // Navigate directly based on content type
    switch (item.type) {
      case 'book':
        navigate(`/book/${item._id}`);
        break;
      case 'playlist':
        navigate(`/audio/playlist/${item._id}`);
        break;
      case 'lesson':
        navigate(`/lesson/${item._id}`);
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
      case 'book': return 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white';
      case 'playlist': return 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a1a3a]';
      case 'lesson': return 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-white';
      default: return 'bg-white/20 text-white';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] via-[#1a1a3a] to-[#0d0d20]">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#FFD700] mx-auto mb-4 animate-pulse" />
          <p className="text-white/80 font-medium text-lg">Loading your adventure...</p>
          <div className="flex justify-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
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
      {/* Deep navy night sky gradient - matching reference */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0c1445 0%, #152057 30%, #1a3068 60%, #1e3a70 100%)',
        }}
      />
      
      {/* Stars layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Small twinkling dots */}
        {smallStars.map((star) => (
          <TwinklingStar key={`small-${star.id}`} {...star} />
        ))}
        
        {/* Larger diamond/cross shaped stars */}
        {diamondStars.map((star) => (
          <DiamondStar key={`diamond-${star.id}`} {...star} />
        ))}
        
        {/* Shooting stars */}
        <ShootingStar delay={3} top={15} />
        <ShootingStar delay={8} top={25} />
        <ShootingStar delay={14} top={10} />
      </div>

      {/* Subtle glow at horizon */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(30, 58, 112, 0.5) 0%, transparent 50%)',
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes shootingStar {
          0% { transform: translateX(0) translateY(0); opacity: 1; }
          70% { opacity: 0.8; }
          100% { transform: translateX(120vw) translateY(30vh); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); }
          50% { box-shadow: 0 0 35px rgba(255, 215, 0, 0.7); }
        }
        @keyframes textGlow {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5), 0 2px 4px rgba(0,0,0,0.3); }
          50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 2px 4px rgba(0,0,0,0.3); }
        }
      `}</style>

      <div className="relative z-10 px-5 py-8 pb-32 max-w-lg mx-auto">
        {/* Header with golden script text - like reference */}
        <div 
          className="text-center mb-8 pt-4"
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'all 0.8s ease-out',
          }}
        >
          {/* Golden script title - matching reference style */}
          <h1 
            className="text-4xl sm:text-5xl font-bold mb-3"
            style={{
              fontFamily: "'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive",
              color: '#E8B923',
              textShadow: '0 0 15px rgba(232, 185, 35, 0.5), 0 2px 4px rgba(0,0,0,0.4)',
              animation: 'textGlow 3s ease-in-out infinite',
              letterSpacing: '1px',
            }}
          >
            {config.title}
          </h1>
          
          <p 
            className="text-white/80 text-lg mt-2"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
          >
            {config.subtitle}
          </p>
          
          {/* Small decorative star divider */}
          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
            <div className="w-8 h-[1px] bg-gradient-to-r from-transparent to-white/30" />
            <Sparkles className="w-5 h-5 text-[#E8B923]" />
            <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-white/30" />
          </div>
        </div>

        {/* Content Grid - Animated cards with pop-in effect - tap to go directly */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {items.slice(0, config.maxItems).map((item, index) => (
            <button
              key={item._id}
              onClick={() => handleItemClick(item)}
              className="relative rounded-xl overflow-hidden shadow-xl transition-all duration-300 transform ring-1 ring-white/10 hover:ring-[#E8B923]/50 hover:scale-[1.02] active:scale-[0.95]"
              style={{
                opacity: showContent ? 1 : 0,
                transform: showContent ? 'scale(1)' : 'scale(0.6) translateY(30px)',
                transition: `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)`,
                transitionDelay: `${0.2 + index * 0.08}s`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {/* Image */}
              <div className="aspect-square bg-[#152057]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a3068] to-[#152057]">
                    <div className="text-white/20 scale-[2]">
                      {getTypeIcon(item.type)}
                    </div>
                  </div>
                )}
              </div>

              {/* Gradient info bar */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c1445]/95 via-[#0c1445]/80 to-transparent p-3 pt-14">
                <p className="text-white font-bold text-sm line-clamp-2 leading-tight mb-1.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {item.title}
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getTypeBadgeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                  {getTypeLabel(item.type)}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Skip Button only - animated */}
        {config.showSkipButton && (
          <div 
            style={{
              opacity: showContent ? 1 : 0,
              transform: showContent ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.6s ease-out',
              transitionDelay: '0.6s',
            }}
          >
            <button
              onClick={handleSkip}
              className="w-full py-3 text-white/50 font-medium hover:text-white/80 transition-colors hover:bg-white/5 rounded-xl"
            >
              {config.skipButtonText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewUserWelcomePage;

// Helper to check if welcome screen should be shown
export const shouldShowWelcome = (): boolean => {
  return !localStorage.getItem('godlykids_welcome_seen');
};
