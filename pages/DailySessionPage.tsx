import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Check, ChevronRight, Play, BookOpen } from 'lucide-react';
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
  startCurrentStep,
  completeCurrentStep,
  skipCurrentStep,
  exitSession,
  setStepContent,
  getRecommendedBookFilter,
} from '../services/dailySessionService';
import { getSavedPreferences, SUBJECT_OPTIONS } from './InterestSelectionPage';
import AvatarCompositor from '../components/avatar/AvatarCompositor';

// Subject card images mapping
const SUBJECT_IMAGES: { [key: string]: string } = {
  'bible-stories': '/daily-session/biblestory.png',
  'history': '/daily-session/History.png',
  'fantasy': '/daily-session/adventure.png',
  'character': '/daily-session/character.png',
};

// Wing animation CSS
const wingAnimationStyles = `
  @keyframes wingFlapLeft {
    0%, 100% { transform: rotate(0deg) scaleX(-1); }
    50% { transform: rotate(-25deg) scaleX(-1); }
  }
  @keyframes wingFlapRight {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(25deg); }
  }
  @keyframes floatAvatar {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  .wing-flap-left {
    animation: wingFlapLeft 0.4s ease-in-out infinite;
  }
  .wing-flap-right {
    animation: wingFlapRight 0.4s ease-in-out infinite;
  }
  .avatar-float {
    animation: floatAvatar 2s ease-in-out infinite;
  }
`;

const DailySessionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    addCoins, 
    equippedAvatar, 
    equippedBody, 
    equippedHat, 
    equippedLeftArm, 
    equippedRightArm, 
    equippedLegs,
    headOffset,
    bodyOffset,
    hatOffset,
    leftArmOffset,
    rightArmOffset,
    legsOffset,
    headScale,
    bodyScale,
    hatScale,
    leftArmScale,
    rightArmScale,
    legsScale,
    equippedLeftArmRotation,
    equippedRightArmRotation,
    equippedLegsRotation,
    equippedHatRotation,
  } = useUser();
  const { books } = useBooks();
  
  const [session, setSession] = useState<DailySession | null>(null);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recommendedBook, setRecommendedBook] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Subject selection state for users who haven't picked subjects yet
  const [showSubjectSelection, setShowSubjectSelection] = useState(false);
  const [tempSelectedSubjects, setTempSelectedSubjects] = useState<string[]>([]);

  // Initialize or load session
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      
      // Check if user has selected subjects
      const savedSubjects = getSavedPreferences();
      if (savedSubjects.length === 0) {
        // No subjects selected - show subject selection first
        setShowSubjectSelection(true);
        setIsLoading(false);
        return;
      }
      
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

  // Handle returning from a completed step (devotional or book)
  useEffect(() => {
    const stepCompleted = (location.state as any)?.stepCompleted;
    if (stepCompleted && session) {
      const currentStep = session.steps[session.currentStepIndex];
      
      // Check if the completed step matches the current in-progress step
      if (currentStep && currentStep.type === stepCompleted && currentStep.status === 'in-progress') {
        const coinsEarned = stepCompleted === 'devotional' ? 20 : 30;
        
        // Track step completion
        activityTrackingService.trackOnboardingEvent(
          stepCompleted === 'devotional' 
            ? 'godly_kids_time_devotional_completed' 
            : 'godly_kids_time_book_completed', 
          { coinsEarned }
        );
        
        // Add coins for completing the step
        addCoins(coinsEarned);
        
        // Complete the step
        const updatedSession = completeCurrentStep(coinsEarned);
        setSession(updatedSession);
        
        // Clear the navigation state to prevent re-processing
        navigate(location.pathname, { replace: true, state: {} });
        
        // Check if session is now complete
        if (updatedSession?.completed) {
          setShowCelebration(true);
        }
      }
    }
  }, [location.state, session, addCoins, navigate, location.pathname]);

  // Find a book matching user's selected subjects
  const findRecommendedBook = () => {
    // Don't proceed if books aren't loaded yet
    if (!books || books.length === 0) {
      console.log('📚 Books not loaded yet, will retry when available');
      return;
    }
    
    const filterTags = getRecommendedBookFilter();
    
    if (filterTags.length === 0) {
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
  
  // Re-run book recommendation when books load
  useEffect(() => {
    if (books.length > 0 && !recommendedBook && session) {
      findRecommendedBook();
    }
  }, [books, recommendedBook, session]);

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

  // Handle subject toggle in selection screen
  const handleSubjectToggle = (subjectId: string) => {
    setTempSelectedSubjects(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      }
      // Max 3 subjects
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, subjectId];
    });
  };

  // Handle subject selection confirmation
  const handleSubjectConfirm = async () => {
    // Save subjects to localStorage
    localStorage.setItem('godlykids_content_preferences', JSON.stringify(tempSelectedSubjects));
    
    // Track subject selection
    activityTrackingService.trackOnboardingEvent('subjects_selected', {
      subjects: tempSelectedSubjects,
    });
    
    // Hide selection screen and create session
    setShowSubjectSelection(false);
    setIsLoading(true);
    
    // Create a new session with the selected subjects
    const newSession = createDailySession(tempSelectedSubjects);
    setSession(newSession);
    
    // Track session start
    activityTrackingService.trackOnboardingEvent('godly_kids_time_started', {
      subjects: newSession.subjects,
    });
    
    // Load lessons for devotional step
    try {
      const lessonsData = await ApiService.getLessons();
      const devotionalLessons = lessonsData.filter(
        (l: any) => l.type === 'Daily Verse' || l.type === 'Bible Study'
      );
      setLessons(devotionalLessons);
      
      if (devotionalLessons.length > 0) {
        const randomIndex = Math.floor(Math.random() * devotionalLessons.length);
        setSelectedLesson(devotionalLessons[randomIndex]);
      }
    } catch (e) {
      console.error('Error loading lessons:', e);
    }
    
    // Find recommended book
    findRecommendedBook();
    
    setIsLoading(false);
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
        if (recommendedBook && recommendedBook._id) {
          // Set the book content
          setStepContent(session.currentStepIndex, recommendedBook._id, recommendedBook.title);
          // Navigate to book reader
          navigate(`/read/${recommendedBook._id}`, { 
            state: { fromDailySession: true } 
          });
        } else if (books.length > 0) {
          // Fallback: pick a random book if recommended book not set
          const fallbackBook = books[Math.floor(Math.random() * books.length)];
          if (fallbackBook && fallbackBook._id) {
            setRecommendedBook(fallbackBook);
            setStepContent(session.currentStepIndex, fallbackBook._id, fallbackBook.title);
            navigate(`/read/${fallbackBook._id}`, { 
              state: { fromDailySession: true } 
            });
          } else {
            console.error('No valid book available');
            alert('No books available. Please try again later.');
          }
        } else {
          console.error('Books not loaded');
          alert('Books are still loading. Please wait a moment and try again.');
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

  // Wood plank background style
  const woodBackground = {
    backgroundImage: 'url(/daily-session/Background-dailysession.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={woodBackground}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#f3e5ab] font-display text-lg">Preparing your session...</p>
        </div>
      </div>
    );
  }

  // ============== SUBJECT SELECTION SCREEN ==============
  if (showSubjectSelection) {
    return (
      <div className="fixed inset-0 flex flex-col z-50 overflow-auto" style={woodBackground}>
        {/* Safe area top */}
        <div className="flex-shrink-0" style={{ height: 'var(--safe-area-top, 0px)' }} />
        
        {/* Close button */}
        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center z-10"
          style={{ marginTop: 'var(--safe-area-top, 0px)' }}
        >
          <X className="w-6 h-6 text-white/80" />
        </button>

        {/* Header Banner */}
        <div className="flex justify-center pt-4 pb-2">
          <img 
            src="/daily-session/dailysessiontitle.png" 
            alt="Daily Session" 
            className="h-16 object-contain"
          />
        </div>
        
        {/* Subtitle */}
        <p className="text-center text-[#f3e5ab]/80 text-sm font-display mb-4">
          Daily Learning Session
        </p>

        {/* Subject Cards Grid */}
        <div className="flex-1 px-4 pb-4">
          <div className="grid grid-cols-2 gap-4">
            {SUBJECT_OPTIONS.map((subject) => {
              const isSelected = tempSelectedSubjects.includes(subject.id);
              const isDisabled = !isSelected && tempSelectedSubjects.length >= 3;
              const imageUrl = SUBJECT_IMAGES[subject.id] || '/daily-session/biblestory.png';
              
              return (
                <button
                  key={subject.id}
                  onClick={() => handleSubjectToggle(subject.id)}
                  disabled={isDisabled}
                  className={`
                    relative rounded-lg overflow-hidden transition-all transform
                    ${isSelected 
                      ? 'ring-4 ring-[#FFD700] scale-105 shadow-lg shadow-[#FFD700]/30' 
                      : isDisabled
                        ? 'opacity-40'
                        : 'hover:scale-102 active:scale-95'
                    }
                  `}
                  style={{
                    boxShadow: isSelected 
                      ? '0 0 20px rgba(255, 215, 0, 0.5), inset 0 0 0 3px #8B4513' 
                      : 'inset 0 0 0 3px #8B4513',
                  }}
                >
                  {/* Wooden frame effect */}
                  <div className="absolute inset-0 border-4 border-[#8B4513] rounded-lg pointer-events-none z-10"
                    style={{
                      boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(255,255,255,0.1)',
                    }}
                  />
                  
                  {/* Card image */}
                  <div className="aspect-square">
                    <img 
                      src={imageUrl}
                      alt={subject.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Label */}
                  <div className="bg-gradient-to-t from-[#5D4037] to-[#8B4513] py-2 px-1">
                    <p className="text-[#f3e5ab] text-xs font-display font-bold text-center leading-tight">
                      {subject.label}
                    </p>
                  </div>
                  
                  {/* Selection checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[#FFD700] rounded-full flex items-center justify-center shadow-lg z-20">
                      <Check className="w-4 h-4 text-[#5D4037]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection Count */}
        <p className="text-center text-[#f3e5ab]/60 text-sm font-display italic mb-4">
          {tempSelectedSubjects.length} of 3 subjects selected
        </p>

        {/* Start Button */}
        <div className="px-6 pb-4">
          <button
            onClick={handleSubjectConfirm}
            disabled={tempSelectedSubjects.length === 0}
            className={`
              w-full relative transition-all transform active:scale-95
              ${tempSelectedSubjects.length === 0 ? 'opacity-50' : 'hover:scale-102'}
            `}
          >
            <img 
              src="/daily-session/Startsession.png" 
              alt="Start Today's Session"
              className="w-full h-auto"
            />
          </button>
          
          {/* Skip link */}
          <button
            onClick={() => navigate('/home')}
            className="w-full py-3 text-[#f3e5ab]/50 text-sm font-display hover:text-[#f3e5ab]/70 transition-colors italic"
          >
            Skip for now
          </button>
        </div>

        {/* Avatar - Bottom Right */}
        <div className="absolute bottom-20 right-4 avatar-float" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
          <style>{wingAnimationStyles}</style>
          <div className="w-20 h-28">
            <AvatarCompositor
              headUrl={equippedAvatar || '/avatars/heads/head-1.png'}
              body={equippedBody}
              hat={equippedHat}
              leftArm={equippedLeftArm}
              rightArm={equippedRightArm}
              legs={equippedLegs}
              headOffset={headOffset}
              bodyOffset={bodyOffset}
              hatOffset={hatOffset}
              leftArmOffset={leftArmOffset}
              rightArmOffset={rightArmOffset}
              legsOffset={legsOffset}
              headScale={headScale}
              bodyScale={bodyScale}
              hatScale={hatScale}
              leftArmScale={leftArmScale}
              rightArmScale={rightArmScale}
              legsScale={legsScale}
              leftArmRotation={equippedLeftArmRotation}
              rightArmRotation={equippedRightArmRotation}
              legsRotation={equippedLegsRotation}
              hatRotation={equippedHatRotation}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Safe area bottom */}
        <div className="flex-shrink-0" style={{ height: 'var(--safe-area-bottom, 0px)' }} />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const currentStep = session.steps[session.currentStepIndex];

  // ============== MAIN SESSION SCREEN ==============
  return (
    <div className="fixed inset-0 flex flex-col z-50 overflow-auto" style={woodBackground}>
      {/* Safe area top */}
      <div className="flex-shrink-0" style={{ height: 'var(--safe-area-top, 0px)' }} />
      
      {/* Close button */}
      <button
        onClick={handleExit}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center z-10"
        style={{ marginTop: 'var(--safe-area-top, 0px)' }}
      >
        <X className="w-6 h-6 text-white/80" />
      </button>

      {/* Header Banner */}
      <div className="flex justify-center pt-4 pb-2">
        <img 
          src="/daily-session/dailysessiontitle.png" 
          alt="Daily Session" 
          className="h-16 object-contain"
        />
      </div>
      
      {/* Subtitle */}
      <p className="text-center text-[#f3e5ab]/80 text-sm font-display mb-4">
        Daily Learning Session
      </p>

      {/* Progress Steps */}
      <div className="px-6 py-4">
        <div className="bg-[#5D4037]/80 rounded-2xl p-4 border-4 border-[#8B4513]"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            {session.steps.map((step, index) => (
              <React.Fragment key={step.type}>
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center transition-all border-4
                    ${step.status === 'completed' 
                      ? 'bg-[#8BC34A] border-[#689F38]' 
                      : session.currentStepIndex === index
                        ? 'bg-[#FFD700] border-[#FFA000] ring-4 ring-[#FFD700]/40'
                        : 'bg-[#8B4513]/50 border-[#5D4037]'
                    }
                  `}>
                    {getStepStatusIcon(step, index)}
                  </div>
                  <span className={`
                    text-xs mt-2 font-display font-bold
                    ${session.currentStepIndex === index 
                      ? 'text-[#FFD700]' 
                      : step.status === 'completed'
                        ? 'text-[#8BC34A]'
                        : 'text-[#f3e5ab]/50'
                    }
                  `}>
                    {step.label}
                  </span>
                </div>
                
                {/* Connector line */}
                {index < session.steps.length - 1 && (
                  <div className={`
                    flex-1 h-2 mx-2 rounded-full transition-all
                    ${step.status === 'completed' 
                      ? 'bg-[#8BC34A]' 
                      : 'bg-[#8B4513]/50'
                    }
                  `}
                    style={{
                      boxShadow: step.status === 'completed' 
                        ? 'inset 0 -2px 4px rgba(0,0,0,0.2)' 
                        : 'inset 0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Current Step Content */}
      <div className="flex-1 px-6 py-4 flex flex-col">
        {/* Step Card */}
        <div className="bg-[#5D4037]/80 rounded-2xl p-6 flex-1 flex flex-col border-4 border-[#8B4513]"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(255,255,255,0.1)',
          }}
        >
          {/* Step icon and title */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] mx-auto flex items-center justify-center mb-4 border-4 border-[#8B4513]"
              style={{
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
              }}
            >
              <span className="text-5xl">{currentStep.icon}</span>
            </div>
            <h2 className="text-[#FFD700] font-display font-bold text-2xl drop-shadow-lg">
              {currentStep.label}
            </h2>
            <p className="text-[#f3e5ab]/70 text-sm mt-2 font-display">
              {currentStep.type === 'prayer' && 'Start your learning with prayer'}
              {currentStep.type === 'devotional' && 'Watch today\'s video lesson'}
              {currentStep.type === 'book' && 'Read your recommended book'}
            </p>
          </div>

          {/* Step-specific content preview */}
          <div className="flex-1 flex flex-col justify-center">
            {currentStep.type === 'prayer' && (
              <div className="bg-[#8B4513]/50 rounded-xl p-4 text-center border-2 border-[#A0522D]">
                <p className="text-[#f3e5ab]/80 text-sm font-display">
                  Select 3 prayer topics and pray together.
                </p>
                <p className="text-[#FFD700] font-bold mt-2 font-display text-lg">
                  🪙 +30 coins
                </p>
              </div>
            )}
            
            {currentStep.type === 'devotional' && selectedLesson && (
              <div className="bg-[#8B4513]/50 rounded-xl p-4 border-2 border-[#A0522D]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center border-2 border-[#5D4037]">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#f3e5ab] font-bold font-display">{selectedLesson.title}</h3>
                    <p className="text-[#f3e5ab]/60 text-sm font-display">{selectedLesson.type}</p>
                    <p className="text-[#FFD700] text-sm mt-1 font-display font-bold">🪙 +20 coins</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep.type === 'book' && recommendedBook && (
              <div className="bg-[#8B4513]/50 rounded-xl p-4 border-2 border-[#A0522D]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-[#5D4037]/50 border-2 border-[#8B4513]">
                    <img 
                      src={recommendedBook.coverUrl || recommendedBook.files?.coverImage} 
                      alt={recommendedBook.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#f3e5ab] font-bold font-display">{recommendedBook.title}</h3>
                    <p className="text-[#f3e5ab]/60 text-sm font-display">{recommendedBook.author}</p>
                    <p className="text-[#f3e5ab]/40 text-xs mt-1 font-display">
                      {recommendedBook.category || recommendedBook.categories?.[0]}
                    </p>
                    <p className="text-[#FFD700] text-sm mt-1 font-display font-bold">🪙 +30 coins</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected subjects reminder */}
          {session.subjects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#8B4513]/50">
              <p className="text-[#f3e5ab]/40 text-xs text-center font-display italic">
                Today's subjects: {getSubjectsDisplay()}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6">
          <button
            onClick={handleStartStep}
            className="w-full relative transition-all transform active:scale-95 hover:scale-102"
          >
            <img 
              src="/daily-session/Startsession.png" 
              alt="Start"
              className="w-full h-auto"
            />
          </button>
          
          <button
            onClick={handleSkipStep}
            className="w-full py-3 text-[#f3e5ab]/50 text-sm font-display hover:text-[#f3e5ab]/70 transition-colors italic"
          >
            Skip this step
          </button>
        </div>
      </div>

      {/* Avatar - Bottom Right */}
      <div className="absolute bottom-24 right-4 avatar-float" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
        <style>{wingAnimationStyles}</style>
        <div className="w-16 h-24">
          <AvatarCompositor
            headUrl={equippedAvatar || '/avatars/heads/head-1.png'}
            body={equippedBody}
            hat={equippedHat}
            leftArm={equippedLeftArm}
            rightArm={equippedRightArm}
            legs={equippedLegs}
            headOffset={headOffset}
            bodyOffset={bodyOffset}
            hatOffset={hatOffset}
            leftArmOffset={leftArmOffset}
            rightArmOffset={rightArmOffset}
            legsOffset={legsOffset}
            headScale={headScale}
            bodyScale={bodyScale}
            hatScale={hatScale}
            leftArmScale={leftArmScale}
            rightArmScale={rightArmScale}
            legsScale={legsScale}
            leftArmRotation={equippedLeftArmRotation}
            rightArmRotation={equippedRightArmRotation}
            legsRotation={equippedLegsRotation}
            hatRotation={equippedHatRotation}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Safe area bottom */}
      <div className="flex-shrink-0" style={{ height: 'var(--safe-area-bottom, 0px)' }} />

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
