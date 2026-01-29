import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, Volume2, Gamepad2, Sparkles, Check, X } from 'lucide-react';
import { activityTrackingService } from '../../services/activityTrackingService';
import { useSubscription } from '../../context/SubscriptionContext';
import { useBooks } from '../../context/BooksContext';
import { ApiService } from '../../services/apiService';
import { NotificationService } from '../../services/notificationService';
import { DespiaService } from '../../services/despiaService';
import { Bell, BellOff } from 'lucide-react';

interface PremiumOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
}

// Calculate trial end date (7 days from now)
const getTrialEndDate = (): string => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Confetti animation component
const Confetti: React.FC = () => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6', '#3498DB', '#E91E63', '#00BCD4'];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-20px',
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        >
          <div
            style={{
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              width: `${8 + Math.random() * 8}px`,
              height: `${8 + Math.random() * 8}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { 
            transform: translateY(0) rotate(0deg); 
            opacity: 1; 
          }
          100% { 
            transform: translateY(100vh) rotate(720deg); 
            opacity: 0; 
          }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
};

// Progress dots component
const ProgressDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex justify-center gap-2 mt-6">
    {[...Array(total)].map((_, i) => (
      <div
        key={i}
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          i === current
            ? 'bg-[#7C3AED] w-6'
            : i < current
            ? 'bg-[#7C3AED]/60'
            : 'bg-gray-300'
        }`}
      />
    ))}
  </div>
);

// Auto-scrolling book cover carousel component
const BookCoverCarousel: React.FC<{ covers: string[] }> = ({ covers }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Auto-scroll effect
  useEffect(() => {
    if (!scrollRef.current || covers.length === 0 || isHovered) return;
    
    const scroll = scrollRef.current;
    let animationId: number;
    let scrollPos = 0;
    const speed = 0.5; // pixels per frame
    
    const animate = () => {
      scrollPos += speed;
      // Reset when we've scrolled half (since we duplicate the content)
      if (scrollPos >= scroll.scrollWidth / 2) {
        scrollPos = 0;
      }
      scroll.scrollLeft = scrollPos;
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationId);
  }, [covers, isHovered]);

  if (covers.length === 0) {
    // Fallback to placeholder if no covers
    return (
      <div className="flex justify-center gap-3 my-4">
        {['📖', '📚', '📕', '📗'].map((emoji, i) => (
          <div
            key={i}
            className="w-16 h-20 rounded-lg shadow-md flex items-center justify-center text-3xl bg-gradient-to-br from-blue-100 to-purple-100"
          >
            {emoji}
          </div>
        ))}
      </div>
    );
  }

  // Duplicate covers for seamless loop
  const duplicatedCovers = [...covers, ...covers];

  return (
    <div 
      className="w-full overflow-hidden my-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {duplicatedCovers.map((cover, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-20 h-28 rounded-xl shadow-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100"
          >
            <img 
              src={cover} 
              alt="Book cover" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Voice character data type
interface VoiceCharacter {
  name: string;
  image: string | null;
}

// Voice avatar grid component with real character images
const VoiceAvatarGrid: React.FC<{ voices: VoiceCharacter[] }> = ({ voices }) => {
  // Fallback emojis if no voices
  const fallbackEmojis = ['👨', '👩', '🧒', '👴', '👵', '🧑', '😊', '😄'];
  
  if (voices.length === 0) {
    return (
      <div className="grid grid-cols-4 gap-3 my-4 px-4">
        {fallbackEmojis.map((emoji, i) => (
          <div
            key={i}
            className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center text-2xl border-2 border-gray-100"
          >
            {emoji}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-4 gap-3 my-4 px-2">
      {voices.slice(0, 8).map((voice, i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center border-2 border-gray-100 overflow-hidden"
          >
            {voice.image ? (
              <img 
                src={voice.image} 
                alt={voice.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-2xl">{fallbackEmojis[i % fallbackEmojis.length]}</span>
            )}
          </div>
          <span className="text-[10px] text-gray-600 mt-1 truncate w-14 text-center">
            {voice.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// Notification toggle component for the final screen
const NotificationToggle: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if running in native app
  const isNative = DespiaService.isNative();
  
  // Check notification status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (isNative) {
        // In native app, we can't directly check - assume not enabled unless user acts
        // Check if user previously enabled in this session
        const enabled = sessionStorage.getItem('godlykids_notifications_enabled') === 'true';
        setIsEnabled(enabled);
      } else {
        // Web - check via Notification API
        if ('Notification' in window) {
          setIsEnabled(Notification.permission === 'granted');
        } else {
          setIsEnabled(false);
        }
      }
    };
    checkStatus();
  }, [isNative]);

  const handleToggle = async () => {
    setIsLoading(true);
    
    try {
      if (isNative) {
        // Open app settings for user to enable notifications
        DespiaService.openSettings();
        // Optimistically assume they'll enable
        sessionStorage.setItem('godlykids_notifications_enabled', 'true');
        setIsEnabled(true);
      } else {
        // Web - prompt for permission
        if ('Notification' in window) {
          if (Notification.permission === 'denied') {
            // Can't re-prompt if denied - show alert
            alert('Notifications are blocked. Please enable them in your browser settings.');
          } else {
            await NotificationService.promptForPermission();
            setIsEnabled(Notification.permission === 'granted');
          }
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xs bg-white rounded-2xl p-4 mb-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEnabled ? 'bg-[#7C3AED]/10' : 'bg-gray-100'}`}>
            {isEnabled ? (
              <Bell className="w-5 h-5 text-[#7C3AED]" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-800 text-sm">Trial Reminders</p>
            <p className="text-xs text-gray-500">Get notified before trial ends</p>
          </div>
        </div>
        
        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            isEnabled ? 'bg-[#7C3AED]' : 'bg-gray-300'
          } ${isLoading ? 'opacity-50' : ''}`}
        >
          <div
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

// Screen content components - function to create screens with dynamic data
const createScreens = (bookCovers: string[], voiceCharacters: VoiceCharacter[]) => [
  // Screen 1: Welcome to Premium
  {
    id: 'welcome',
    content: (props: { onNext: () => void }) => (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 relative">
        <Confetti />
        
        {/* Celebration emoji */}
        <div className="text-7xl mb-6 animate-bounce">🎉</div>
        
        {/* Headline */}
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Welcome to Premium!
        </h1>
        
        {/* Subtext */}
        <p className="text-gray-600 text-lg mb-6 max-w-xs">
          Enjoy a full week of premium features on us.{' '}
          <span className="font-semibold text-[#7C3AED]">No credit card needed.</span>
        </p>
        
        {/* Happy kids illustration placeholder */}
        <div className="w-48 h-32 bg-gradient-to-br from-[#E9D5FF] to-[#DDD6FE] rounded-2xl flex items-center justify-center mb-8">
          <span className="text-5xl">📖👧👦</span>
        </div>
        
        {/* Button */}
        <button
          onClick={props.onNext}
          className="w-full max-w-xs bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Let's See What You Unlocked</span>
          <ChevronRight size={20} />
        </button>
      </div>
    ),
  },
  
  // Screen 2: Unlimited Bible Stories
  {
    id: 'stories',
    content: (props: { onNext: () => void }) => (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        {/* Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-6">
          <BookOpen className="w-12 h-12 text-blue-600" />
          <Sparkles className="w-6 h-6 text-yellow-500 absolute ml-16 -mt-8" />
        </div>
        
        {/* Headline */}
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Unlimited Bible Stories
        </h2>
        
        {/* Subtext */}
        <p className="text-gray-600 mb-4 max-w-xs">
          Access our entire library of <span className="font-semibold">100+ illustrated Bible stories</span>. New stories added weekly!
        </p>
        
        {/* Book covers carousel - real covers */}
        <BookCoverCarousel covers={bookCovers} />
        
        {/* Button */}
        <button
          onClick={props.onNext}
          className="w-full max-w-xs bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-2"
        >
          <span>Next</span>
          <ChevronRight size={20} />
        </button>
      </div>
    ),
  },
  
  // Screen 3: All Voices Unlocked
  {
    id: 'voices',
    content: (props: { onNext: () => void }) => (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        {/* Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mb-6">
          <Volume2 className="w-12 h-12 text-purple-600" />
        </div>
        
        {/* Headline */}
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Every Voice, Every Story
        </h2>
        
        {/* Subtext */}
        <p className="text-gray-600 mb-4 max-w-xs">
          Choose from <span className="font-semibold">{voiceCharacters.length > 0 ? `${voiceCharacters.length}+` : '10+'} narration voices</span>. Find the perfect storyteller for your family.
        </p>
        
        {/* Voice avatars grid with real characters */}
        <VoiceAvatarGrid voices={voiceCharacters} />
        
        {/* Button */}
        <button
          onClick={props.onNext}
          className="w-full max-w-xs bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
        >
          <span>Next</span>
          <ChevronRight size={20} />
        </button>
      </div>
    ),
  },
  
  // Screen 5: Unlimited Quizzes & Games
  {
    id: 'games',
    content: (props: { onNext: () => void }) => (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        {/* Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mb-6">
          <Gamepad2 className="w-10 h-10 text-amber-600" />
          <Check className="w-6 h-6 text-green-500 absolute ml-14 -mt-6" />
        </div>
        
        {/* Headline */}
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Learn Through Play
        </h2>
        
        {/* Subtext */}
        <p className="text-gray-600 mb-6 max-w-xs">
          Unlimited access to <span className="font-semibold">quizzes, memory games, and coloring pages</span>. Make Bible learning fun!
        </p>
        
        {/* Quiz preview */}
        <div className="w-full max-w-xs bg-white rounded-2xl shadow-lg p-4 mb-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">❓</span>
            <span className="font-semibold text-gray-700">Who built the ark?</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              <span className="text-gray-600">Moses</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-300">
              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-green-700 font-medium">Noah</span>
              <span className="ml-auto text-green-600">✓</span>
            </div>
          </div>
        </div>
        
        {/* Button */}
        <button
          onClick={props.onNext}
          className="w-full max-w-xs bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Next</span>
          <ChevronRight size={20} />
        </button>
      </div>
    ),
  },
  
  // Screen 6: Start Exploring (Final)
  {
    id: 'complete',
    content: (props: { onNext: () => void }) => (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        {/* Success icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg">
          <Check className="w-10 h-10 text-white" />
        </div>
        
        {/* Headline */}
        <h2 className="text-3xl font-bold text-gray-800 mb-3">
          You're All Set!
        </h2>
        
        {/* Subtext */}
        <p className="text-gray-600 mb-6 max-w-xs">
          Your <span className="font-semibold text-[#7C3AED]">7-day premium trial</span> is now active. Explore everything Godly Kids has to offer!
        </p>
        
        {/* Notification Toggle */}
        <NotificationToggle />
        
        {/* Button */}
        <button
          onClick={props.onNext}
          className="w-full max-w-xs bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>Start Exploring</span>
          <ChevronRight size={20} />
        </button>
        
        {/* Trial end note */}
        <p className="text-gray-500 text-sm mt-4 max-w-xs">
          Your trial ends {getTrialEndDate()}. We'll remind you before it expires.
        </p>
      </div>
    ),
  },
];

const PremiumOnboarding: React.FC<PremiumOnboardingProps> = ({ isOpen, onComplete }) => {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState(0);
  const { reverseTrial } = useSubscription();
  const { books } = useBooks();
  const [voiceCharacters, setVoiceCharacters] = useState<VoiceCharacter[]>([]);
  
  // Fetch voices on mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voices = await ApiService.getVoices();
        const characters: VoiceCharacter[] = voices
          .filter((v: any) => v.characterImage || v.name)
          .slice(0, 8)
          .map((v: any) => ({
            name: v.customName || v.name || 'Voice',
            image: v.characterImage || null,
          }));
        setVoiceCharacters(characters);
      } catch (error) {
        console.error('Error fetching voices for onboarding:', error);
      }
    };
    
    if (isOpen) {
      fetchVoices();
    }
  }, [isOpen]);
  
  // Get book covers for the carousel (up to 12 books)
  const bookCovers = React.useMemo(() => {
    return books
      .filter(book => book.coverUrl && book.coverUrl.trim() !== '')
      .slice(0, 12)
      .map(book => book.coverUrl);
  }, [books]);
  
  // Create screens with dynamic book covers and voice characters
  const screens = React.useMemo(() => createScreens(bookCovers, voiceCharacters), [bookCovers, voiceCharacters]);
  
  // Track screen views
  useEffect(() => {
    if (isOpen && screens[currentScreen]) {
      const screenId = screens[currentScreen].id;
      activityTrackingService.trackOnboardingEvent(`reverse_trial_screen_${currentScreen + 1}_viewed`).catch(() => {});
    }
  }, [currentScreen, isOpen, screens]);

  const handleNext = useCallback(() => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(prev => prev + 1);
    } else {
      // Final screen - complete onboarding
      activityTrackingService.trackOnboardingEvent('reverse_trial_onboarding_completed').catch(() => {});
      onComplete();
      navigate('/home');
    }
  }, [currentScreen, screens.length, navigate, onComplete]);

  const handleSkip = useCallback(() => {
    activityTrackingService.trackOnboardingEvent('reverse_trial_onboarding_skipped').catch(() => {});
    onComplete();
    navigate('/home');
  }, [navigate, onComplete]);

  // Handle swipe gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentScreen < screens.length - 1) {
      setCurrentScreen(prev => prev + 1);
    } else if (isRightSwipe && currentScreen > 0) {
      setCurrentScreen(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const CurrentScreenContent = screens[currentScreen]?.content;

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-b from-white via-[#F5F3FF] to-white">
      {/* Skip button (not on last screen) */}
      {currentScreen < screens.length - 1 && (
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors"
          style={{ top: 'calc(var(--safe-area-top, 0px) + 16px)' }}
        >
          Skip
        </button>
      )}
      
      {/* Screen content with swipe support */}
      <div
        className="h-full overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentScreen * 100}%)` }}
        >
          {screens.map((screen, index) => (
            <div key={screen.id} className="w-full h-full flex-shrink-0 overflow-y-auto">
              <screen.content onNext={handleNext} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Progress dots */}
      <div 
        className="absolute bottom-8 left-0 right-0"
        style={{ bottom: 'calc(var(--safe-area-bottom, 0px) + 32px)' }}
      >
        <ProgressDots current={currentScreen} total={screens.length} />
      </div>
    </div>
  );
};

export default PremiumOnboarding;
