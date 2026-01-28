import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { activityTrackingService } from '../services/activityTrackingService';

// Storage key for user preferences
const PREFERENCES_STORAGE_KEY = 'godlykids_content_preferences';

// Interest options with images and category tags
const INTEREST_OPTIONS = [
  {
    id: 'bedtime',
    label: 'Bedtime & calm',
    description: 'Relaxing stories for peaceful nights',
    image: '/interests/bedtime.png',
    tags: ['Bedtime', 'Calm', 'Sleep', 'Relaxing', 'Peaceful'],
  },
  {
    id: 'bible-stories',
    label: 'Learning Bible stories',
    description: 'Explore God\'s Word through stories',
    image: '/interests/bible-stories.png',
    tags: ['Bible', 'Bible Stories', 'Scripture', 'Faith', 'Jesus', 'God'],
  },
  {
    id: 'homeschool',
    label: 'Homeschool faith learning',
    description: 'Curriculum-ready faith education',
    image: '/interests/homeschool.png',
    tags: ['Homeschool', 'Education', 'Learning', 'Curriculum', 'Teaching'],
  },
  {
    id: 'music',
    label: 'Scripture songs & worship',
    description: 'Sing and memorize through music',
    image: '/interests/music.png',
    tags: ['Music', 'Songs', 'Worship', 'Praise', 'Scripture Songs'],
  },
  {
    id: 'interactive',
    label: 'Interactive quizzes & games',
    description: 'Fun learning through play',
    image: '/interests/games.png',
    tags: ['Games', 'Quizzes', 'Interactive', 'Fun', 'Play'],
  },
];

// Helper to get saved preferences
export const getSavedPreferences = (): string[] => {
  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading preferences:', e);
  }
  return [];
};

// Helper to get preference tags for content filtering
export const getPreferenceTags = (): string[] => {
  const selectedIds = getSavedPreferences();
  const tags: string[] = [];
  
  selectedIds.forEach(id => {
    const option = INTEREST_OPTIONS.find(o => o.id === id);
    if (option) {
      tags.push(...option.tags);
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
};

// Check if user has completed interest selection
export const hasCompletedInterestSelection = (): boolean => {
  return localStorage.getItem(PREFERENCES_STORAGE_KEY) !== null;
};

const InterestSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleContinue = () => {
    // Save preferences to localStorage
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(selectedInterests));
    
    // Track the selection
    activityTrackingService.trackOnboardingEvent('interests_selected', {
      interests: selectedInterests,
      count: selectedInterests.length,
    });
    
    // Navigate to the explore page
    navigate('/home');
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSkip = () => {
    // Save empty preferences (user skipped)
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify([]));
    
    // Track skip
    activityTrackingService.trackOnboardingEvent('interests_skipped');
    
    navigate('/home');
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-[#FFF8E7] to-[#FFE4B5] flex flex-col">
      {/* Safe area top padding */}
      <div style={{ height: 'var(--safe-area-top, 0px)' }} />
      
      {/* Header */}
      <div className="relative px-4 pt-4 pb-2">
        <button
          onClick={handleBack}
          className="absolute left-4 top-4 w-10 h-10 rounded-full bg-white/80 shadow-md flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-[#8B4513]" />
        </button>
        
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 text-[#8B4513]/70 text-sm font-medium hover:text-[#8B4513] transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Logo and Title */}
      <div className="flex flex-col items-center px-6 pt-6 pb-4">
        <img 
          src="/logo-full.png" 
          alt="Godly Kids" 
          className="h-20 w-auto object-contain mb-4"
          onError={(e) => {
            // Fallback if logo doesn't exist
            e.currentTarget.style.display = 'none';
          }}
        />
        
        <h1 className="text-2xl font-display font-bold text-[#5c2e0b] text-center">
          What's most helpful
        </h1>
        <h2 className="text-2xl font-display font-bold text-[#5c2e0b] text-center mb-2">
          for your family right now?
        </h2>
        <p className="text-sm text-[#8B4513]/70 text-center">
          Select all that apply
        </p>
      </div>

      {/* Interest Options */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3 max-w-md mx-auto">
          {INTEREST_OPTIONS.map((option) => {
            const isSelected = selectedInterests.includes(option.id);
            
            return (
              <button
                key={option.id}
                onClick={() => toggleInterest(option.id)}
                className={`
                  w-full flex items-center gap-4 p-3 rounded-2xl transition-all
                  ${isSelected 
                    ? 'bg-white ring-3 ring-[#8BC34A] shadow-lg' 
                    : 'bg-white/80 shadow-md hover:shadow-lg hover:bg-white'
                  }
                `}
              >
                {/* Image */}
                <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#E8D5B7] to-[#D4B896]">
                  <img
                    src={option.image}
                    alt={option.label}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Show placeholder gradient on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Label */}
                <div className="flex-1 text-left">
                  <h3 className="font-display font-bold text-[#5c2e0b] text-lg leading-tight">
                    {option.label}
                  </h3>
                </div>
                
                {/* Selection indicator */}
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                  ${isSelected 
                    ? 'bg-[#8BC34A]' 
                    : 'border-2 border-[#D4B896]'
                  }
                `}>
                  {isSelected && (
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Continue Button */}
      <div className="px-6 pb-6" style={{ paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 1.5rem)' }}>
        <WoodButton
          onClick={handleContinue}
          fullWidth
          variant="gold"
          disabled={selectedInterests.length === 0}
          className={`py-4 text-lg ${selectedInterests.length === 0 ? 'opacity-50' : ''}`}
        >
          Continue
        </WoodButton>
      </div>
    </div>
  );
};

export default InterestSelectionPage;
