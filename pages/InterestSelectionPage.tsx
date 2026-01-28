import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { activityTrackingService } from '../services/activityTrackingService';

// Storage key for user preferences (curriculum subjects)
const PREFERENCES_STORAGE_KEY = 'godlykids_content_preferences';

// Curriculum subject options - for homeschool families (ages 7-12)
// These tags match content categories in the portal
export const SUBJECT_OPTIONS = [
  {
    id: 'bible-stories',
    label: 'Bible Stories',
    icon: '📖',
    image: '/daily-session/biblestory.png',
    tags: ['Bible', 'Bible Stories', 'Scripture', 'Faith', 'Jesus', 'God', 'Old Testament', 'New Testament'],
  },
  {
    id: 'history',
    label: 'History',
    icon: '🏛️',
    image: '/daily-session/History.png',
    tags: ['History', 'Historical', 'Ancient', 'Timeline', 'Past'],
  },
  {
    id: 'fantasy',
    label: 'Fantasy & Adventure',
    icon: '🐉',
    image: '/daily-session/adventure.png',
    tags: ['Fantasy', 'Adventure', 'Fiction', 'Imagination', 'Quest'],
  },
  {
    id: 'character',
    label: 'Character & Virtues',
    icon: '💪',
    image: '/daily-session/character.png',
    tags: ['Character', 'Virtues', 'Values', 'Morals', 'Courage', 'Kindness', 'Honesty'],
  },
];

// Helper to get saved subject preferences
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
    const option = SUBJECT_OPTIONS.find(o => o.id === id);
    if (option) {
      tags.push(...option.tags);
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
};

// Check if user has completed subject selection
export const hasCompletedInterestSelection = (): boolean => {
  return localStorage.getItem(PREFERENCES_STORAGE_KEY) !== null;
};

// Get subject option by ID
export const getSubjectById = (id: string) => {
  return SUBJECT_OPTIONS.find(o => o.id === id);
};

const InterestSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      // Limit to 3 subjects max
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleContinue = () => {
    // Save preferences to localStorage
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(selectedSubjects));
    
    // Track the selection
    activityTrackingService.trackOnboardingEvent('subjects_selected', {
      subjects: selectedSubjects,
      count: selectedSubjects.length,
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
    activityTrackingService.trackOnboardingEvent('subjects_skipped');
    
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
          className="h-16 w-auto object-contain mb-3"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        
        <h1 className="text-2xl font-display font-bold text-[#5c2e0b] text-center">
          Choose Your Subjects
        </h1>
        <p className="text-sm text-[#8B4513]/70 text-center mt-2">
          Pick up to 3 subjects for today's learning
        </p>
        
        {/* Selection counter */}
        <div className="mt-3 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i < selectedSubjects.length 
                  ? 'bg-[#8BC34A]' 
                  : 'bg-[#D4B896]/50'
              }`}
            />
          ))}
          <span className="text-xs text-[#8B4513]/60 ml-1">
            {selectedSubjects.length}/3 selected
          </span>
        </div>
      </div>

      {/* Subject Options */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {SUBJECT_OPTIONS.map((option) => {
            const isSelected = selectedSubjects.includes(option.id);
            const isDisabled = !isSelected && selectedSubjects.length >= 3;
            
            return (
              <button
                key={option.id}
                onClick={() => toggleSubject(option.id)}
                disabled={isDisabled}
                className={`
                  relative flex flex-col items-center p-4 rounded-2xl transition-all
                  ${isSelected 
                    ? 'bg-white ring-3 ring-[#8BC34A] shadow-lg scale-[1.02]' 
                    : isDisabled
                      ? 'bg-white/40 opacity-50'
                      : 'bg-white/80 shadow-md hover:shadow-lg hover:bg-white'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-2
                  ${isSelected 
                    ? 'bg-[#8BC34A]/20' 
                    : 'bg-gradient-to-br from-[#E8D5B7] to-[#D4B896]'
                  }
                `}>
                  {option.icon}
                </div>
                
                {/* Label */}
                <h3 className="font-display font-bold text-[#5c2e0b] text-sm text-center leading-tight">
                  {option.label}
                </h3>
                
                {/* Selection checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8BC34A] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  </div>
                )}
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
          disabled={selectedSubjects.length === 0}
          className={`py-4 text-lg ${selectedSubjects.length === 0 ? 'opacity-50' : ''}`}
        >
          {selectedSubjects.length === 0 
            ? 'Select at least 1 subject' 
            : `Continue with ${selectedSubjects.length} subject${selectedSubjects.length > 1 ? 's' : ''}`
          }
        </WoodButton>
      </div>
    </div>
  );
};

export default InterestSelectionPage;
