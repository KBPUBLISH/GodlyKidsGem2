import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, ChevronRight, Play, BookOpen, Sparkles } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import PrayerGameModal from '../components/features/PrayerGameModal';
import SessionCelebrationModal from '../components/modals/SessionCelebrationModal';
import { useUser } from '../context/UserContext';
import { useBooks } from '../context/BooksContext';
import { activityTrackingService } from '../services/activityTrackingService';
import { ApiService } from '../services/apiService';
import {
  DailySession,
  SessionStep,
  createDailySession,
  getCurrentSession,
  getCurrentStep,
  startCurrentStep,
  completeCurrentStep,
  skipCurrentStep,
  exitSession,
  setStepContent,
  getRecommendedBookFilter,
  isSessionCompletedToday,
} from '../services/dailySessionService';
import { getSavedPreferences, SUBJECT_OPTIONS } from './InterestSelectionPage';

const DailySessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { addCoins } = useUser();
  const { books } = useBooks();
  
  const [session, setSession] = useState<DailySession | null>(null);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recommendedBook, setRecommendedBook] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize or load session
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      
      let currentSession = getCurrentSession();
      
      // If no session exists, create one
      if (!currentSession) {
        currentSession = createDailySession();
        
        // Track session start
        activityTrackingService.trackOnboardingEvent('godly_kids_time_started', {
          subjects: currentSession.subjects,
        });
      }
      
      setSession(currentSession);
      
      // Load lessons for devotional step
      try {
        const lessonsData = await ApiService.getLessons();
        // Filter to Daily Verse / devotional type lessons
        const devotionalLessons = lessonsData.filter(
          (l: any) => l.type === 'Daily Verse' || l.type === 'Bible Study'
        );
        setLessons(devotionalLessons);
        
        // Select a random devotional if we have any
        if (devotionalLessons.length > 0) {
          const randomIndex = Math.floor(Math.random() * devotionalLessons.length);
          setSelectedLesson(devotionalLessons[randomIndex]);
        }
      } catch (e) {
        console.error('Error loading lessons:', e);
      }
      
      // Find recommended book based on subjects
      findRecommendedBook();
      
      setIsLoading(false);
    };
    
    loadSession();
  }, []);

  // Find a book matching user's selected subjects
  const findRecommendedBook = () => {
    const filterTags = getRecommendedBookFilter();
    
    if (filterTags.length === 0 || books.length === 0) {
      // No filters, pick random book
      const randomBook = books[Math.floor(Math.random() * books.length)];
      setRecommendedBook(randomBook);
      return;
    }
    
    // Find books matching any tag
    const matchingBooks = books.filter((book: any) => {
      const bookCategories = book.categories || [book.category];
      return bookCategories.some((cat: string) =>
        filterTags.some(tag => 
          cat?.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(cat?.toLowerCase() || '')
        )
      );
    });
    
    if (matchingBooks.length > 0) {
      // Pick random from matching
      const randomBook = matchingBooks[Math.floor(Math.random() * matchingBooks.length)];
      setRecommendedBook(randomBook);
    } else {
      // Fallback to any book
      const randomBook = books[Math.floor(Math.random() * books.length)];
      setRecommendedBook(randomBook);
    }
  };

  // Handle exit button
  const handleExit = () => {
    if (session && !session.completed) {
      // Track early exit
      activityTrackingService.trackOnboardingEvent('godly_kids_time_exited', {
        step: session.currentStepIndex,
        stepType: session.steps[session.currentStepIndex]?.type,
      });
    }
    exitSession();
    navigate('/home');
  };

  // Handle starting current step
  const handleStartStep = () => {
    if (!session) return;
    
    const step = session.steps[session.currentStepIndex];
    startCurrentStep();
    
    switch (step.type) {
      case 'prayer':
        setShowPrayerModal(true);
        break;
      case 'devotional':
        if (selectedLesson) {
          // Navigate to lesson player
          navigate(`/lesson/${selectedLesson._id}`, { 
            state: { fromDailySession: true } 
          });
        }
        break;
      case 'book':
        if (recommendedBook) {
          // Set the book content
          setStepContent(session.currentStepIndex, recommendedBook._id, recommendedBook.title);
          // Navigate to book reader
          navigate(`/read/${recommendedBook._id}`, { 
            state: { fromDailySession: true } 
          });
        }
        break;
    }
  };

  // Handle prayer modal close (prayer completed or cancelled)
  const handlePrayerClose = () => {
    setShowPrayerModal(false);
    
    // PrayerGameModal handles coins internally (adds 30 coins)
    // We just need to mark the step as complete
    const coinsEarned = 30;
    
    // Track step completion
    activityTrackingService.trackOnboardingEvent('godly_kids_time_prayer_completed', {
      coinsEarned,
    });
    
    // Complete step and update session (don't add coins again, modal already did)
    const updatedSession = completeCurrentStep(coinsEarned);
    setSession(updatedSession);
    
    // Check if session is now complete
    if (updatedSession?.completed) {
      setShowCelebration(true);
    }
  };

  // Handle skipping current step
  const handleSkipStep = () => {
    const updatedSession = skipCurrentStep();
    setSession(updatedSession);
    
    if (updatedSession?.completed) {
      setShowCelebration(true);
    }
  };

  // Handle celebration close
  const handleCelebrationClose = () => {
    setShowCelebration(false);
    navigate('/home');
  };

  // Get step status icon
  const getStepStatusIcon = (step: SessionStep, index: number) => {
    if (step.status === 'completed') {
      return <Check className="w-5 h-5 text-white" />;
    }
    if (session?.currentStepIndex === index) {
      return <span className="text-lg">{step.icon}</span>;
    }
    return <span className="text-lg opacity-50">{step.icon}</span>;
  };

  // Get selected subjects display
  const getSubjectsDisplay = () => {
    const subjects = session?.subjects || getSavedPreferences();
    return subjects.map(id => {
      const subject = SUBJECT_OPTIONS.find(s => s.id === id);
      return subject ? `${subject.icon} ${subject.label}` : id;
    }).join(', ');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Preparing your session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const currentStep = session.steps[session.currentStepIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col">
      {/* Safe area top */}
      <div style={{ height: 'var(--safe-area-top, 0px)' }} />
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={handleExit}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white/70" />
        </button>
        
        <div className="text-center">
          <h1 className="text-white font-display font-bold text-lg">Godly Kids Time</h1>
          <p className="text-white/50 text-xs">Daily Learning Session</p>
        </div>
        
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {session.steps.map((step, index) => (
            <React.Fragment key={step.type}>
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${step.status === 'completed' 
                    ? 'bg-[#8BC34A]' 
                    : session.currentStepIndex === index
                      ? 'bg-[#FFD700] ring-4 ring-[#FFD700]/30'
                      : 'bg-white/10'
                  }
                `}>
                  {getStepStatusIcon(step, index)}
                </div>
                <span className={`
                  text-xs mt-2 font-medium
                  ${session.currentStepIndex === index 
                    ? 'text-[#FFD700]' 
                    : step.status === 'completed'
                      ? 'text-[#8BC34A]'
                      : 'text-white/50'
                  }
                `}>
                  {step.label}
                </span>
              </div>
              
              {/* Connector line */}
              {index < session.steps.length - 1 && (
                <div className={`
                  flex-1 h-1 mx-2 rounded-full transition-all
                  ${step.status === 'completed' 
                    ? 'bg-[#8BC34A]' 
                    : 'bg-white/10'
                  }
                `} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="flex-1 px-6 py-4 flex flex-col">
        {/* Step Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 flex-1 flex flex-col">
          {/* Step icon and title */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] mx-auto flex items-center justify-center mb-4">
              <span className="text-4xl">{currentStep.icon}</span>
            </div>
            <h2 className="text-white font-display font-bold text-2xl">
              {currentStep.label}
            </h2>
            <p className="text-white/60 text-sm mt-2">
              {currentStep.type === 'prayer' && 'Start your learning with prayer'}
              {currentStep.type === 'devotional' && 'Watch today\'s video lesson'}
              {currentStep.type === 'book' && 'Read your recommended book'}
            </p>
          </div>

          {/* Step-specific content preview */}
          <div className="flex-1 flex flex-col justify-center">
            {currentStep.type === 'prayer' && (
              <div className="bg-white/5 rounded-2xl p-4 text-center">
                <p className="text-white/70 text-sm">
                  Select 3 prayer topics and pray together.
                </p>
                <p className="text-[#FFD700] font-bold mt-2">
                  +30 coins
                </p>
              </div>
            )}
            
            {currentStep.type === 'devotional' && selectedLesson && (
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{selectedLesson.title}</h3>
                    <p className="text-white/60 text-sm">{selectedLesson.type}</p>
                    <p className="text-[#FFD700] text-sm mt-1">+20 coins</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep.type === 'book' && recommendedBook && (
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-white/10">
                    <img 
                      src={recommendedBook.coverUrl || recommendedBook.files?.coverImage} 
                      alt={recommendedBook.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{recommendedBook.title}</h3>
                    <p className="text-white/60 text-sm">{recommendedBook.author}</p>
                    <p className="text-white/50 text-xs mt-1">
                      {recommendedBook.category || recommendedBook.categories?.[0]}
                    </p>
                    <p className="text-[#FFD700] text-sm mt-1">+30 coins</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected subjects reminder */}
          {session.subjects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-white/40 text-xs text-center">
                Today's subjects: {getSubjectsDisplay()}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <WoodButton
            onClick={handleStartStep}
            fullWidth
            variant="gold"
            className="py-4"
          >
            <span className="flex items-center justify-center gap-2">
              {currentStep.type === 'prayer' && 'Start Prayer'}
              {currentStep.type === 'devotional' && 'Watch Video'}
              {currentStep.type === 'book' && 'Start Reading'}
              <ChevronRight className="w-5 h-5" />
            </span>
          </WoodButton>
          
          <button
            onClick={handleSkipStep}
            className="w-full py-3 text-white/50 text-sm hover:text-white/70 transition-colors"
          >
            Skip this step
          </button>
        </div>
      </div>

      {/* Safe area bottom */}
      <div style={{ height: 'var(--safe-area-bottom, 0px)' }} />

      {/* Prayer Modal */}
      <PrayerGameModal
        isOpen={showPrayerModal}
        onClose={handlePrayerClose}
      />

      {/* Celebration Modal */}
      <SessionCelebrationModal
        isOpen={showCelebration}
        onClose={handleCelebrationClose}
        session={session}
      />
    </div>
  );
};

export default DailySessionPage;
