import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Check, ChevronRight, Play, BookOpen, MessageCircle } from 'lucide-react';
import PrayerGameModal from '../components/features/PrayerGameModal';
import SessionCelebrationModal from '../components/modals/SessionCelebrationModal';
import DiscussionQuestionsModal from '../components/modals/DiscussionQuestionsModal';
import { useUser } from '../context/UserContext';
import { useBooks } from '../context/BooksContext';
import { activityTrackingService } from '../services/activityTrackingService';
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

// Learning goals options
const LEARNING_GOALS = [
  { id: 'self-esteem', label: 'Improve Self Esteem', emoji: '💪', color: 'from-pink-500 to-rose-600' },
  { id: 'connected-to-god', label: 'Feel More Connected to God', emoji: '🙏', color: 'from-purple-500 to-indigo-600' },
  { id: 'learn-bible', label: 'Learn More About the Bible', emoji: '📖', color: 'from-blue-500 to-cyan-600' },
  { id: 'better-sleep', label: 'Get Better Sleep', emoji: '😴', color: 'from-indigo-500 to-purple-600' },
  { id: 'theology', label: 'Become Stronger in Theology', emoji: '✝️', color: 'from-amber-500 to-orange-600' },
  { id: 'life-skills', label: 'Improve Daily Life Skills', emoji: '⭐', color: 'from-green-500 to-emerald-600' },
];

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
  const { books, loading: booksLoading, refreshBooks } = useBooks();
  
  const [session, setSession] = useState<DailySession | null>(null);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recommendedBook, setRecommendedBook] = useState<any>(null);
  const [bookContent, setBookContent] = useState<string>(''); // Story text for discussion questions
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  
  // Subject selection state for users who haven't picked subjects yet
  const [showSubjectSelection, setShowSubjectSelection] = useState(false);
  const [tempSelectedSubjects, setTempSelectedSubjects] = useState<string[]>([]);
  
  // Goals selection state
  const [showGoalsSelection, setShowGoalsSelection] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(10); // Minutes from widget

  // Track screen size for responsive background
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load session duration from localStorage (set by DailyLessonWidget)
  useEffect(() => {
    const savedDuration = localStorage.getItem('godlykids_session_duration');
    if (savedDuration) {
      setSessionDuration(parseInt(savedDuration, 10) || 10);
    }
  }, []);

  // Ensure books are loaded when entering Daily Session page
  useEffect(() => {
    if (books.length === 0 && !booksLoading) {
      console.log('📚 DailySession: Books not loaded, refreshing...');
      refreshBooks();
    }
  }, [books.length, booksLoading, refreshBooks]);

  // Initialize or load session
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      
      // Check if coming from widget with freshStart flag
      const state = location.state as any;
      const isFreshStart = state?.freshStart === true;
      
      // Clear the navigation state so refresh doesn't keep triggering fresh start
      if (isFreshStart) {
        navigate(location.pathname, { replace: true, state: {} });
      }
      
      // Check if user has selected subjects
      const savedSubjects = getSavedPreferences();
      if (savedSubjects.length === 0) {
        // No subjects selected - show subject selection first
        setShowSubjectSelection(true);
        setIsLoading(false);
        return;
      }
      
      // Check for existing session
      let currentSession = getCurrentSession();
      
      // Check if session has made real progress (at least one step started or completed)
      const hasProgress = currentSession?.steps.some(
        (step: any) => step.status === 'in-progress' || step.status === 'completed'
      );
      
      // Show goal selection if:
      // - Fresh start from widget (always show goal selection), OR
      // - No session exists, OR
      // - Session is completed, OR  
      // - Session has no real progress (all steps still pending)
      if (isFreshStart || !currentSession || currentSession.completed || !hasProgress) {
        // Clear any previous session data to start fresh
        sessionStorage.removeItem('godlykids_session_goal');
        sessionStorage.removeItem('godlykids_session_goal_date');
        localStorage.removeItem('godlykids_daily_session');
        
        // Show goal selection for new session
        setShowGoalsSelection(true);
        setIsLoading(false);
        return;
      }
      
      // Load the saved goal for the current in-progress session
      const savedGoal = sessionStorage.getItem('godlykids_session_goal');
      if (savedGoal) {
        setSelectedGoal(savedGoal);
      }
      
      
      // If no session exists, create one
      if (!currentSession) {
        currentSession = createDailySession();
        
        // Track session start
        activityTrackingService.trackOnboardingEvent('godly_kids_time_started', {
          subjects: currentSession.subjects,
        });
      }
      
      setSession(currentSession);
      setIsLoading(false);
      
      // Find recommended book based on subjects (shows its own loading state)
      // Only if book step is not yet completed
      if (currentSession.steps[0]?.status !== 'completed') {
        findRecommendedBook();
      }
    };
    
    loadSession();
  }, []);

  // Handle returning from completed book reading
  useEffect(() => {
    const state = location.state as any;
    const stepCompleted = state?.stepCompleted;
    
    if (stepCompleted === 'book' && session) {
      const currentStep = session.steps[session.currentStepIndex];
      
      // Check if the completed step matches the current in-progress step
      if (currentStep && currentStep.type === 'book' && currentStep.status === 'in-progress') {
        const coinsEarned = 30;
        
        // Capture the book content for discussion questions
        if (state.bookContent) {
          setBookContent(state.bookContent);
        }
        // Update book title if provided
        if (state.bookTitle && !recommendedBook?.title) {
          setRecommendedBook((prev: any) => prev ? { ...prev, title: state.bookTitle } : { title: state.bookTitle });
        }
        
        // Track step completion
        activityTrackingService.trackOnboardingEvent('godly_kids_time_book_completed', { coinsEarned });
        
        // Add coins for completing the step
        addCoins(coinsEarned);
        
        // Complete the book step
        const updatedSession = completeCurrentStep(coinsEarned);
        setSession(updatedSession);
        
        // Clear the navigation state to prevent re-processing
        navigate(location.pathname, { replace: true, state: {} });
        
        // After book completion, automatically show discussion modal
        // (Next step in flow is discussion)
        setTimeout(() => {
          setShowDiscussionModal(true);
        }, 500);
      }
    }
  }, [location.state, session, addCoins, navigate, location.pathname, recommendedBook]);

  // Get max pages based on session duration
  const getMaxPages = (duration: number): number => {
    if (duration <= 5) return 15;
    if (duration <= 10) return 25;
    return 40; // 15 minutes
  };

  // Find a book using AI recommendation based on goal and filters
  const findRecommendedBook = async () => {
    // Don't proceed if books aren't loaded yet
    if (!books || books.length === 0) {
      console.log('📚 Books not loaded yet, will retry when available');
      // Don't leave loading state stuck - turn it off so user can see session
      // The useEffect will retry when books load
      setIsLoadingBook(false);
      return;
    }
    
    setIsLoadingBook(true);
    
    // Filter to only books (not music/playlists) with valid IDs
    const maxPages = getMaxPages(sessionDuration);
    const validBooks = books.filter((book: any) => {
      // Check for id OR _id (context transforms _id to id)
      const bookId = book?.id || book?._id;
      if (!book || !bookId) return false;
      // Exclude music/playlists - check type field or infer from category
      const type = book.type?.toLowerCase() || '';
      const category = (book.category || '').toLowerCase();
      if (type.includes('music') || type.includes('playlist') || type.includes('song')) return false;
      if (category.includes('music') || category.includes('worship songs')) return false;
      // Filter by page count if available
      const pageCount = book.pageCount || book.pages?.length || 0;
      if (pageCount > 0 && pageCount > maxPages) return false;
      return true;
    });
    
    if (validBooks.length === 0) {
      console.log('📚 No valid books found after filtering');
      // Fallback to any book with id or _id
      const anyBook = books.find((b: any) => b && (b.id || b._id));
      if (anyBook) setRecommendedBook(anyBook);
      setIsLoadingBook(false);
      return;
    }
    
    console.log('📚 Finding book for goal:', selectedGoal, 'duration:', sessionDuration, 'from', validBooks.length, 'valid books');
    
    // Try AI recommendation
    const goal = selectedGoal || 'learn-bible';
    const goalLabel = LEARNING_GOALS.find(g => g.id === goal)?.label || goal;
    
    try {
      const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001/api/'
        : 'https://backendgk2-0.onrender.com/api/';
      
      // Prepare book summaries for AI
      const bookSummaries = validBooks.slice(0, 30).map((book: any) => ({
        id: book.id || book._id,
        title: book.title,
        description: book.description || '',
        category: book.category || book.categories?.[0] || '',
        tags: book.tags?.join(', ') || '',
        pageCount: book.pageCount || book.pages?.length || 0,
      }));
      
      const response = await fetch(`${apiBaseUrl}ai-generate/recommend-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalLabel,
          books: bookSummaries,
          maxDuration: sessionDuration,
          subjects: getSavedPreferences(),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.recommendedBookId) {
          const aiBook = validBooks.find((b: any) => (b.id || b._id) === data.recommendedBookId);
          if (aiBook) {
            console.log('📚 AI recommended book:', aiBook.title, 'Reason:', data.reason);
            setRecommendedBook(aiBook);
            setIsLoadingBook(false);
            return;
          }
        }
      }
    } catch (error) {
      console.log('📚 AI recommendation failed, using fallback:', error);
    }
    
    // Fallback: Simple tag/category matching
    const filterTags = getRecommendedBookFilter();
    const matchingBooks = validBooks.filter((book: any) => {
      const bookCategories = book.categories || [book.category];
      return bookCategories.some((cat: string) =>
        filterTags.some(tag => 
          cat?.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(cat?.toLowerCase() || '')
        )
      );
    });
    
    if (matchingBooks.length > 0) {
      const randomBook = matchingBooks[Math.floor(Math.random() * matchingBooks.length)];
      console.log('📚 Fallback selected matching book:', randomBook?.title);
      setRecommendedBook(randomBook);
    } else {
      const randomBook = validBooks[Math.floor(Math.random() * validBooks.length)];
      console.log('📚 Fallback selected random book:', randomBook?.title);
      setRecommendedBook(randomBook);
    }
    setIsLoadingBook(false);
  };
  
  // Re-run book recommendation when books load
  useEffect(() => {
    if (books.length > 0 && !recommendedBook && session && !session.completed) {
      console.log('📚 Books loaded, finding recommended book...');
      findRecommendedBook();
    }
  }, [books.length, recommendedBook, session]);

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
    
    // Hide subject selection and show goals selection
    setShowSubjectSelection(false);
    setShowGoalsSelection(true);
  };

  // Handle goal selection confirmation
  const handleGoalConfirm = async () => {
    if (!selectedGoal) return;
    
    // Save goal to session storage with today's date
    sessionStorage.setItem('godlykids_session_goal', selectedGoal);
    sessionStorage.setItem('godlykids_session_goal_date', new Date().toDateString());
    
    // Track goal selection
    activityTrackingService.trackOnboardingEvent('learning_goal_selected', {
      goal: selectedGoal,
      duration: sessionDuration,
    });
    
    // Hide goals screen and show loading
    setShowGoalsSelection(false);
    setIsLoadingBook(true); // Show "Creating Perfect Lesson" loading screen
    
    // Create a new session with the selected subjects
    const subjects = getSavedPreferences();
    const newSession = createDailySession(subjects);
    setSession(newSession);
    
    // Track session start
    activityTrackingService.trackOnboardingEvent('godly_kids_time_started', {
      subjects: newSession.subjects,
      goal: selectedGoal,
      duration: sessionDuration,
    });
    
    // Start finding the book in the background (don't await yet)
    const bookPromise = findRecommendedBook();
    
    // Always show loading screen for exactly 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Make sure book loading is done
    await bookPromise;
    
    // Now hide the loading screen
    setIsLoadingBook(false);
  };

  // Handle starting current step
  const handleStartStep = async () => {
    console.log('📚 handleStartStep called, session:', !!session);
    
    if (!session) {
      console.log('📚 No session, returning');
      return;
    }
    
    const step = session.steps[session.currentStepIndex];
    console.log('📚 Current step:', step?.type, 'recommendedBook:', !!recommendedBook, 'books count:', books?.length);
    startCurrentStep();
    
    switch (step.type) {
      case 'book':
        // Try to use recommended book first
        const recBookId = recommendedBook?.id || recommendedBook?._id;
        if (recommendedBook && recBookId) {
          console.log('📚 Using recommended book:', recommendedBook.title, 'ID:', recBookId);
          setStepContent(session.currentStepIndex, recBookId, recommendedBook.title);
          navigate(`/read/${recBookId}`, { 
            state: { fromDailySession: true } 
          });
          return;
        }
        
        // Try to find a book from context first
        if (books && books.length > 0) {
          console.log('📚 Using book from context');
          const validBooks = books.filter((b: any) => b && (b.id || b._id));
          if (validBooks.length > 0) {
            const fallbackBook = validBooks[Math.floor(Math.random() * validBooks.length)];
            const fbId = fallbackBook.id || fallbackBook._id;
            console.log('📚 Selected fallback book:', fallbackBook.title, 'ID:', fbId);
            setRecommendedBook(fallbackBook);
            setStepContent(session.currentStepIndex, fbId, fallbackBook.title);
            navigate(`/read/${fbId}`, { 
              state: { fromDailySession: true } 
            });
            return;
          }
        }
        
        // If no books available, fetch directly from API
        setIsLoadingBook(true);
        console.log('📚 No books in context, fetching from API...');
        try {
          const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3001/api/'
            : 'https://backendgk2-0.onrender.com/api/';
          
          console.log('📚 Fetching from:', `${apiBaseUrl}books`);
          const response = await fetch(`${apiBaseUrl}books`);
          console.log('📚 Response status:', response.status);
          
          if (response.ok) {
            const responseData = await response.json();
            // API returns { data: [...], pagination: {...} }
            const fetchedBooks = responseData.data || responseData;
            console.log('📚 Fetched', fetchedBooks.length, 'books from API');
            
            const validBooks = fetchedBooks.filter((b: any) => b && b._id);
            console.log('📚 Valid books:', validBooks.length);
            
            if (validBooks.length > 0) {
              const randomBook = validBooks[Math.floor(Math.random() * validBooks.length)];
              const rbId = randomBook.id || randomBook._id;
              console.log('📚 Selected random book:', randomBook.title, 'ID:', rbId);
              setRecommendedBook(randomBook);
              setStepContent(session.currentStepIndex, rbId, randomBook.title);
              setIsLoadingBook(false);
              navigate(`/read/${rbId}`, { 
                state: { fromDailySession: true } 
              });
              return;
            }
          } else {
            console.error('📚 API response not ok:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('📚 Failed to fetch books:', error);
        }
        
        setIsLoadingBook(false);
        // No books available - show error
        console.error('📚 No books available. Books loaded:', books?.length, 'booksLoading:', booksLoading);
        alert('Unable to load books. Please check your connection and try again.');
        break;
      case 'discussion':
        setShowDiscussionModal(true);
        break;
      case 'prayer':
        setShowPrayerModal(true);
        break;
    }
  };

  // Handle discussion modal completion
  const handleDiscussionComplete = () => {
    setShowDiscussionModal(false);
    
    const coinsEarned = 20;
    
    // Track step completion
    activityTrackingService.trackOnboardingEvent('godly_kids_time_discussion_completed', {
      coinsEarned,
      bookTitle: recommendedBook?.title,
    });
    
    // Add coins for completing the step
    addCoins(coinsEarned);
    
    // Complete the discussion step
    const updatedSession = completeCurrentStep(coinsEarned);
    setSession(updatedSession);
    
    // Check if session is now complete (shouldn't be, prayer is next)
    if (updatedSession?.completed) {
      setShowCelebration(true);
    }
  };

  // Handle discussion modal close (without completing)
  const handleDiscussionClose = () => {
    setShowDiscussionModal(false);
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

  // Wood plank background style - mobile vs desktop
  const woodBackground = {
    backgroundImage: isMobile 
      ? 'url(/daily-session/Background-dailysession-mobile.png)' 
      : 'url(/daily-session/Background-dailysession.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  if (isLoading || isLoadingBook) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={woodBackground}>
        <div className="text-center px-8">
          {/* Animated book icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl animate-bounce">📚</span>
            </div>
            <div className="absolute inset-0 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
          </div>
          
          <h2 className="text-[#FFD700] font-display font-bold text-2xl mb-2 drop-shadow-lg">
            Creating Perfect Lesson
          </h2>
          <p className="text-[#f3e5ab]/80 font-display text-sm">
            Finding the best story for your child...
          </p>
          
          {/* Goal reminder */}
          {selectedGoal && (
            <div className="mt-4 bg-[#5D4037]/50 rounded-xl px-4 py-2 inline-block">
              <p className="text-[#f3e5ab]/60 text-xs font-display">
                Goal: {LEARNING_GOALS.find(g => g.id === selectedGoal)?.label}
              </p>
            </div>
          )}
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
        <div className="flex justify-center pt-4 pb-4">
          <img 
            src="/daily-session/dailysessiontitle.png" 
            alt="Daily Session" 
            className="h-24 md:h-28 object-contain"
          />
        </div>

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
          <div className="w-24 h-32">
            <AvatarCompositor
              headUrl={equippedAvatar || '/avatars/heads/head-1.png'}
              body={equippedBody}
              hat={equippedHat}
              leftArm={equippedLeftArm}
              rightArm={equippedRightArm}
              legs={equippedLegs}
              headOffset={{ x: headOffset?.x || 0, y: (headOffset?.y || 0) + 20 }}
              bodyOffset={bodyOffset}
              hatOffset={{ x: hatOffset?.x || 0, y: (hatOffset?.y || 0) + 20 }}
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
              isAnimating={true}
              animationStyle="anim-float"
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Safe area bottom */}
        <div className="flex-shrink-0" style={{ height: 'var(--safe-area-bottom, 0px)' }} />
      </div>
    );
  }

  // ============== GOALS SELECTION SCREEN ==============
  if (showGoalsSelection) {
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
        <div className="flex justify-center pt-4 pb-4">
          <img 
            src="/daily-session/dailysessiontitle.png" 
            alt="Daily Session" 
            className="h-24 md:h-28 object-contain"
          />
        </div>
        
        {/* Question */}
        <div className="text-center px-6 mb-4">
          <h2 className="text-[#FFD700] font-display font-bold text-xl drop-shadow-lg">
            What would you like to help your child with today?
          </h2>
          <p className="text-[#f3e5ab]/70 text-sm mt-2 font-display">
            Select a learning focus for this session
          </p>
        </div>

        {/* Goals Grid */}
        <div className="flex-1 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {LEARNING_GOALS.map((goal) => {
              const isSelected = selectedGoal === goal.id;
              return (
                <button
                  key={goal.id}
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`
                    relative rounded-xl p-4 transition-all transform
                    ${isSelected 
                      ? 'scale-[1.02] ring-4 ring-[#FFD700] shadow-xl' 
                      : 'hover:scale-[1.01] shadow-md'
                    }
                  `}
                >
                  {/* Background gradient */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${goal.color} opacity-90`} />
                  
                  {/* Selection checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[#FFD700] rounded-full flex items-center justify-center z-10">
                      <Check className="w-4 h-4 text-[#5D4037]" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10 text-center">
                    <span className="text-3xl mb-2 block">{goal.emoji}</span>
                    <span className="text-white font-display font-bold text-sm leading-tight block">
                      {goal.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration Info */}
        <div className="px-6 mb-2">
          <div className="bg-[#5D4037]/50 rounded-xl p-3 border-2 border-[#8B4513]/50">
            <p className="text-[#f3e5ab]/80 text-xs text-center font-display">
              📖 Your {sessionDuration} minute session will include a story tailored to this goal
            </p>
          </div>
        </div>

        {/* Confirm Button */}
        <div className="px-6 pb-4">
          <button
            onClick={handleGoalConfirm}
            disabled={!selectedGoal}
            className={`
              w-full py-4 rounded-xl font-display font-bold text-lg shadow-lg transition-all
              ${selectedGoal
                ? 'bg-[#FFD700] text-[#5D4037] active:scale-[0.98]'
                : 'bg-[#5D4037]/50 text-[#f3e5ab]/50 cursor-not-allowed'
              }
            `}
          >
            Continue →
          </button>
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
      <div className="flex justify-center pt-4 pb-4">
        <img 
          src="/daily-session/dailysessiontitle.png" 
          alt="Daily Session" 
          className="h-24 md:h-28 object-contain"
        />
      </div>

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
              {currentStep.type === 'book' && 'Read your recommended story'}
              {currentStep.type === 'discussion' && 'Talk about the story together'}
              {currentStep.type === 'prayer' && 'End your lesson with prayer'}
            </p>
          </div>

          {/* Step-specific content preview */}
          <div className="flex-1 flex flex-col justify-center">
            {currentStep.type === 'book' && recommendedBook && (
              <button 
                onClick={handleStartStep}
                className="w-full bg-[#8B4513]/50 rounded-xl p-4 border-2 border-[#A0522D] hover:bg-[#8B4513]/70 transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-20 h-28 rounded-xl overflow-hidden bg-[#5D4037]/50 border-2 border-[#8B4513] shadow-lg">
                    <img 
                      src={recommendedBook.coverUrl || recommendedBook.files?.coverImage} 
                      alt={recommendedBook.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-[#f3e5ab] font-bold font-display">{recommendedBook.title}</h3>
                    <p className="text-[#f3e5ab]/60 text-sm font-display">{recommendedBook.author}</p>
                    <p className="text-[#f3e5ab]/40 text-xs mt-1 font-display">
                      {recommendedBook.category || recommendedBook.categories?.[0]}
                    </p>
                    <p className="text-[#FFD700] text-sm mt-1 font-display font-bold">🪙 +30 coins</p>
                  </div>
                </div>
              </button>
            )}

            {currentStep.type === 'discussion' && (
              <div className="bg-[#8B4513]/50 rounded-xl p-4 border-2 border-[#A0522D]">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center border-2 border-[#5D4037]">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#f3e5ab] font-bold font-display">Discussion Time</h3>
                    <p className="text-[#f3e5ab]/60 text-sm font-display">
                      {recommendedBook ? `About "${recommendedBook.title}"` : 'About the story'}
                    </p>
                    <p className="text-[#f3e5ab]/40 text-xs mt-1 font-display">
                      Answer 2 questions together
                    </p>
                    <p className="text-[#FFD700] text-sm mt-1 font-display font-bold">🪙 +20 coins</p>
                  </div>
                </div>
              </div>
            )}

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
            onClick={() => {
              console.log('🔥 BUTTON CLICKED!');
              // Immediately navigate to the first book from the API
              const apiBaseUrl = 'https://backendgk2-0.onrender.com/api/';
              fetch(`${apiBaseUrl}books?limit=10`)
                .then(res => res.json())
                .then(data => {
                  console.log('🔥 Got books:', data);
                  const books = data.data || data;
                  if (books && books.length > 0) {
                    const book = books[Math.floor(Math.random() * books.length)];
                    const bookId = book.id || book._id;
                    console.log('🔥 Navigating to book:', book.title, bookId);
                    if (session) {
                      startCurrentStep();
                      setStepContent(session.currentStepIndex, bookId, book.title);
                    }
                    navigate(`/read/${bookId}`, { state: { fromDailySession: true } });
                  } else {
                    alert('No books found!');
                  }
                })
                .catch(err => {
                  console.error('🔥 Error:', err);
                  alert('Error loading books: ' + err.message);
                });
            }}
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
        <div className="w-20 h-28">
          <AvatarCompositor
            headUrl={equippedAvatar || '/avatars/heads/head-1.png'}
            body={equippedBody}
            hat={equippedHat}
            leftArm={equippedLeftArm}
            rightArm={equippedRightArm}
            legs={equippedLegs}
            headOffset={{ x: headOffset?.x || 0, y: (headOffset?.y || 0) + 20 }}
            bodyOffset={bodyOffset}
            hatOffset={{ x: hatOffset?.x || 0, y: (hatOffset?.y || 0) + 20 }}
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
            isAnimating={true}
            animationStyle="anim-float"
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Safe area bottom */}
      <div className="flex-shrink-0" style={{ height: 'var(--safe-area-bottom, 0px)' }} />

      {/* Discussion Questions Modal */}
      <DiscussionQuestionsModal
        isOpen={showDiscussionModal}
        onClose={handleDiscussionClose}
        onComplete={handleDiscussionComplete}
        bookTitle={session?.steps[0]?.contentTitle || recommendedBook?.title || 'the story'}
        bookDescription={recommendedBook?.description}
        bookContent={bookContent}
      />

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
