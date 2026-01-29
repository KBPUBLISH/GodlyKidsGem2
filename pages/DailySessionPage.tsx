import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Check, ChevronRight, Play, BookOpen, MessageCircle } from 'lucide-react';
import PrayerGameModal from '../components/features/PrayerGameModal';
import SessionCelebrationModal from '../components/modals/SessionCelebrationModal';
import DiscussionQuestionsModal from '../components/modals/DiscussionQuestionsModal';
import DailyVerseModal from '../components/modals/DailyVerseModal';
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
import { getSavedPreferences } from './InterestSelectionPage';
import AvatarCompositor from '../components/avatar/AvatarCompositor';

// Learning goals options with character block images
const LEARNING_GOALS = [
  { id: 'courage', label: 'Build Courage', emoji: '🦁', color: 'from-orange-500 to-red-600', image: '/daily-session/blocks/courage.png' },
  { id: 'faith', label: 'Strengthen Faith', emoji: '🙏', color: 'from-purple-500 to-indigo-600', image: '/daily-session/blocks/faith.png' },
  { id: 'gratitude', label: 'Practice Gratitude', emoji: '💝', color: 'from-pink-500 to-rose-600', image: '/daily-session/blocks/gratitude.png' },
  { id: 'love', label: 'Learn About Love', emoji: '❤️', color: 'from-red-500 to-pink-600', image: '/daily-session/blocks/love.png' },
  { id: 'obedience', label: 'Understand Obedience', emoji: '👂', color: 'from-blue-500 to-cyan-600', image: '/daily-session/blocks/obedience.png' },
  { id: 'self-control', label: 'Develop Self-Control', emoji: '🎯', color: 'from-green-500 to-emerald-600', image: '/daily-session/blocks/selfcontrol.png' },
  { id: 'theology', label: 'Explore Theology', emoji: '✝️', color: 'from-amber-500 to-orange-600', image: '/daily-session/blocks/theology.png' },
  { id: 'wisdom', label: 'Gain Wisdom', emoji: '🦉', color: 'from-indigo-500 to-purple-600', image: '/daily-session/blocks/wisdom.png' },
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
  const [showScriptureModal, setShowScriptureModal] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [showDiscussionModal, setShowDiscussionModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recommendedBook, setRecommendedBook] = useState<any>(null);
  const [bookContent, setBookContent] = useState<string>(''); // Story text for discussion questions
  const [discussionQuestions, setDiscussionQuestions] = useState<any[]>([]); // Pre-generated questions
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  
  // Ready countdown state
  const [showReadyScreen, setShowReadyScreen] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Book ready countdown state
  const [showBookReadyScreen, setShowBookReadyScreen] = useState(false);
  const [bookCountdown, setBookCountdown] = useState<number | null>(null);
  const [pendingBookNavigation, setPendingBookNavigation] = useState<{id: string, title: string, coverUrl?: string, pageCount?: number} | null>(null);
  
  // Prayer ready countdown state
  const [showPrayerReadyScreen, setShowPrayerReadyScreen] = useState(false);
  const [prayerCountdown, setPrayerCountdown] = useState<number | null>(null);
  
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
      // Only if book step doesn't already have content assigned (avoid re-selecting on back navigation)
      // Book step is now at index 1 (index 0 is scripture)
      const bookStep = currentSession.steps[1];
      if (bookStep?.status !== 'completed' && !bookStep?.contentId) {
        findRecommendedBook();
      } else if (bookStep?.contentId) {
        // Book already assigned - restore it from context or fetch it
        console.log('📚 Restoring previously assigned book:', bookStep.contentId, bookStep.contentTitle);
        // Try to find the book in context first
        const existingBook = books.find(b => (b.id || b._id) === bookStep.contentId);
        if (existingBook) {
          setRecommendedBook(existingBook);
        }
      }
    };
    
    loadSession();
  }, [books]);

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
        const content = state.bookContent || '';
        const title = state.bookTitle || session.steps[1]?.contentTitle || recommendedBook?.title || 'the story';
        
        if (content) {
          setBookContent(content);
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
        
        // Pre-generate discussion questions using AI before showing modal
        const generateQuestions = async () => {
          try {
            const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:3001/api/'
              : 'https://backendgk2-0.onrender.com/api/';
            
            console.log('📝 Generating discussion questions for:', title);
            console.log('📝 Book content length:', content.length);
            
            const response = await fetch(`${apiBaseUrl}ai/discussion-questions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookTitle: title,
                bookContent: content,
                childAge: '7-12',
                goal: selectedGoal,
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('📝 Generated questions:', data.questions?.length || 0);
              if (data.questions && data.questions.length > 0) {
                setDiscussionQuestions(data.questions);
              }
            } else {
              console.log('📝 Failed to generate questions, status:', response.status);
            }
          } catch (error) {
            console.error('📝 Error generating discussion questions:', error);
          }
          
          // Show discussion modal after attempting to generate questions
          setShowDiscussionModal(true);
        };
        
        // Small delay then generate questions
        setTimeout(() => {
          generateQuestions();
        }, 300);
      }
    }
  }, [location.state, session, addCoins, navigate, location.pathname, recommendedBook, selectedGoal]);

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
    const goal = selectedGoal || 'faith';
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
      
      const response = await fetch(`${apiBaseUrl}ai/recommend-book`, {
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

  // Handle exit button - preserve session progress so user can return
  const handleExit = () => {
    if (session && !session.completed) {
      // Track early exit but DON'T delete the session - keep progress saved
      activityTrackingService.trackOnboardingEvent('godly_kids_time_paused', {
        step: session.currentStepIndex,
        stepType: session.steps[session.currentStepIndex]?.type,
        progress: `${session.currentStepIndex}/${session.steps.length}`,
      });
      // Session is already saved in localStorage - user can return to continue
    }
    navigate('/home');
  };

  // Handle subject toggle in selection screen
  // Handle goal selection confirmation
  const handleGoalConfirm = async () => {
    if (!selectedGoal) return;
    
    // Reset previous session states for fresh start
    setBookContent('');
    setDiscussionQuestions([]);
    
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
    // Always get fresh session from localStorage to avoid stale state issues
    const currentSession = getCurrentSession();
    console.log('📚 handleStartStep called, session:', !!currentSession);
    
    if (!currentSession) {
      console.log('📚 No session, returning');
      return;
    }
    
    // Update React state if it's out of sync
    if (!session || session.currentStepIndex !== currentSession.currentStepIndex) {
      setSession(currentSession);
    }
    
    const step = currentSession.steps[currentSession.currentStepIndex];
    console.log('📚 Current step:', step?.type, 'index:', currentSession.currentStepIndex, 'recommendedBook:', !!recommendedBook, 'books count:', books?.length);
    startCurrentStep();
    
    switch (step.type) {
      case 'scripture':
        // Show Scripture of the Day modal
        setShowScriptureModal(true);
        return;
        
      case 'book':
        // Helper function to show book ready screen
        const showBookReady = (bookId: string, bookTitle: string, coverUrl?: string, pageCount?: number) => {
          setStepContent(currentSession.currentStepIndex, bookId, bookTitle);
          setPendingBookNavigation({ id: bookId, title: bookTitle, coverUrl, pageCount });
          setShowBookReadyScreen(true);
        };
        
        // Try to use recommended book first
        const recBookId = recommendedBook?.id || recommendedBook?._id;
        if (recommendedBook && recBookId) {
          console.log('📚 Using recommended book:', recommendedBook.title, 'ID:', recBookId);
          showBookReady(recBookId, recommendedBook.title, recommendedBook.coverUrl, recommendedBook.pages?.length || recommendedBook.pageCount);
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
            showBookReady(fbId, fallbackBook.title, fallbackBook.coverUrl, fallbackBook.pages?.length || fallbackBook.pageCount);
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
              setIsLoadingBook(false);
              showBookReady(rbId, randomBook.title, randomBook.coverUrl, randomBook.pages?.length || randomBook.pageCount);
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
        setShowPrayerReadyScreen(true);
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
    
    // Check if session is now complete
    if (updatedSession?.completed) {
      setShowCelebration(true);
    } else {
      // Auto-start next step (prayer) after a brief delay
      setTimeout(() => {
        handleStartStep();
      }, 500);
    }
  };

  // Handle discussion modal close (without completing)
  const handleDiscussionClose = () => {
    setShowDiscussionModal(false);
  };

  // Handle scripture modal completion
  const handleScriptureComplete = () => {
    setShowScriptureModal(false);
    
    const coinsEarned = 10;
    
    // Track step completion
    activityTrackingService.trackOnboardingEvent('godly_kids_time_scripture_completed', {
      coinsEarned,
    });
    
    // Add coins
    addCoins(coinsEarned);
    
    // Complete step and update session
    const updatedSession = completeCurrentStep(coinsEarned);
    setSession(updatedSession);
    
    // Auto-start next step after a brief delay
    if (updatedSession && !updatedSession.completed) {
      setTimeout(() => {
        handleStartStep();
      }, 500);
    }
  };

  // Handle scripture modal close (without completing)
  const handleScriptureClose = () => {
    setShowScriptureModal(false);
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
    } else {
      // Auto-start next step after a brief delay
      setTimeout(() => {
        handleStartStep();
      }, 300);
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

        {/* Goals Grid - Clicking a block auto-advances */}
        <div className="flex-1 px-4 pb-4 flex items-center justify-center">
          <div className="w-full max-w-md md:max-w-2xl px-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {LEARNING_GOALS.map((goal) => {
                return (
                  <button
                    key={goal.id}
                    onClick={() => {
                      setSelectedGoal(goal.id);
                      // Auto-advance after brief visual feedback
                      setTimeout(() => {
                        // Call handleGoalConfirm with the selected goal
                        sessionStorage.setItem('godlykids_session_goal', goal.id);
                        sessionStorage.setItem('godlykids_session_goal_date', new Date().toDateString());
                        activityTrackingService.trackOnboardingEvent('learning_goal_selected', {
                          goal: goal.id,
                          duration: sessionDuration,
                        });
                        setShowGoalsSelection(false);
                        setIsLoadingBook(true);
                        const subjects = getSavedPreferences();
                        const newSession = createDailySession(subjects);
                        setSession(newSession);
                        activityTrackingService.trackOnboardingEvent('godly_kids_time_started', {
                          subjects: newSession.subjects,
                          goal: goal.id,
                          duration: sessionDuration,
                        });
                        findRecommendedBook();
                        setTimeout(() => setIsLoadingBook(false), 3000);
                      }, 200);
                    }}
                    className="relative overflow-hidden transition-all transform hover:scale-[1.05] active:scale-[0.98] rounded-xl"
                    style={{ boxShadow: '0 0 15px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3)' }}
                  >
                    {/* Character block image */}
                    <img 
                      src={goal.image} 
                      alt={goal.label}
                      className="w-full h-auto"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Instruction */}
        <div className="px-6 pb-6">
          <p className="text-[#f3e5ab]/60 text-sm text-center font-display">
            Tap a card to begin
          </p>
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

  // ============== READY COUNTDOWN SCREEN ==============
  // Show this before the first step starts (when all steps are still pending)
  const allStepsPending = session.steps.every(s => s.status === 'pending');
  
  if (showReadyScreen && allStepsPending) {
    const handleReadyClick = () => {
      // Start countdown
      setCountdown(3);
      
      // Countdown timer
      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(countdownInterval);
          setCountdown(null);
          setShowReadyScreen(false);
          // Start the first step - call handleStartStep to show the modal
          handleStartStep();
        }
      }, 800);
    };
    
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={woodBackground}>
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

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {countdown !== null ? (
            // Countdown display
            <div className="text-center animate-pulse">
              <div className="text-[180px] font-display font-bold text-[#FFD700] drop-shadow-2xl leading-none"
                style={{ textShadow: '0 0 40px rgba(255, 215, 0, 0.5), 0 4px 8px rgba(0,0,0,0.5)' }}
              >
                {countdown}
              </div>
            </div>
          ) : (
            // Ready button
            <button
              onClick={handleReadyClick}
              className="group transition-all transform hover:scale-105 active:scale-95"
            >
              <div className="bg-[#FFD700] hover:bg-[#FFE44D] px-16 py-8 rounded-3xl shadow-2xl border-4 border-[#FFA000] transition-all"
                style={{ boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4), inset 0 -4px 8px rgba(0,0,0,0.1)' }}
              >
                <span className="text-[#5D4037] font-display font-bold text-4xl">
                  Ready?
                </span>
              </div>
              <p className="text-[#f3e5ab]/60 text-sm text-center mt-6 font-display">
                Tap to start your adventure
              </p>
            </button>
          )}
        </div>

        {/* Avatar - Bottom Right */}
        <div className="absolute bottom-20 right-4" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
          <style>{wingAnimationStyles}</style>
          
          {/* Speech bubble when no body equipped - positioned to LEFT of avatar */}
          {!equippedBody && (
            <button
              onClick={() => navigate('/home', { state: { openShop: true } })}
              className="absolute -top-8 right-20 bg-white rounded-2xl px-3 py-2 shadow-lg border-2 border-[#FFD700] whitespace-nowrap animate-bounce z-10"
              style={{ animationDuration: '2s' }}
            >
              <p className="text-[#5D4037] text-xs font-medium text-center leading-tight">
                "I sure wish I had a body!" 🥺
              </p>
              <p className="text-[#8B5A2B] text-[10px] text-center mt-1 opacity-70">Tap me!</p>
              {/* Speech bubble tail - pointing right toward avatar */}
              <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white"></div>
              <div className="absolute top-1/2 -right-[11px] -translate-y-1/2 w-0 h-0 border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent border-l-[9px] border-l-[#FFD700]"></div>
            </button>
          )}
          
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

  // ============== BOOK READY COUNTDOWN SCREEN ==============
  if (showBookReadyScreen && pendingBookNavigation) {
    const handleBookReadyClick = () => {
      // Start countdown
      setBookCountdown(3);
      
      // Countdown timer
      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setBookCountdown(count);
        } else {
          clearInterval(countdownInterval);
          setBookCountdown(null);
          setShowBookReadyScreen(false);
          // Navigate to the book
          navigate(`/read/${pendingBookNavigation.id}`, { 
            state: { fromDailySession: true } 
          });
          setPendingBookNavigation(null);
        }
      }, 800);
    };
    
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={woodBackground}>
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

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {bookCountdown !== null ? (
            // Countdown display
            <div className="text-center animate-pulse">
              <div className="text-[180px] font-display font-bold text-[#FFD700] drop-shadow-2xl leading-none"
                style={{ textShadow: '0 0 40px rgba(255, 215, 0, 0.5), 0 4px 8px rgba(0,0,0,0.5)' }}
              >
                {bookCountdown}
              </div>
            </div>
          ) : (
            // Ready button with book info
            <div className="text-center">
              {/* Book cover and info */}
              <div className="mb-6">
                <p className="text-[#f3e5ab] font-display text-lg mb-4">Story Time</p>
                
                {/* Book Cover */}
                {pendingBookNavigation.coverUrl ? (
                  <div className="relative mx-auto mb-4 w-32 h-44 rounded-lg overflow-hidden shadow-2xl border-4 border-[#8B5A2B]"
                    style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                  >
                    <img 
                      src={pendingBookNavigation.coverUrl} 
                      alt={pendingBookNavigation.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="text-7xl mb-4">📚</div>
                )}
                
                {/* Book Title */}
                <p className="text-[#FFD700] font-bold text-xl max-w-xs mx-auto mb-2">
                  {pendingBookNavigation.title}
                </p>
                
                {/* Reading Time Estimate */}
                {pendingBookNavigation.pageCount && pendingBookNavigation.pageCount > 0 && (
                  <p className="text-[#f3e5ab]/70 text-sm">
                    ~{Math.max(1, Math.ceil(pendingBookNavigation.pageCount * 0.5))} min read • {pendingBookNavigation.pageCount} pages
                  </p>
                )}
              </div>
              
              <button
                onClick={handleBookReadyClick}
                className="group transition-all transform hover:scale-105 active:scale-95"
              >
                <div className="bg-[#FFD700] hover:bg-[#FFE44D] px-16 py-8 rounded-3xl shadow-2xl border-4 border-[#FFA000] transition-all"
                  style={{ boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4), inset 0 -4px 8px rgba(0,0,0,0.1)' }}
                >
                  <span className="text-[#5D4037] font-display font-bold text-4xl">
                    Ready?
                  </span>
                </div>
                <p className="text-[#f3e5ab]/60 text-sm text-center mt-6 font-display">
                  Tap to start reading
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Avatar - Bottom Right */}
        <div className="absolute bottom-20 right-4" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
          <style>{wingAnimationStyles}</style>
          
          {/* Speech bubble when no body equipped - positioned to LEFT of avatar */}
          {!equippedBody && (
            <button
              onClick={() => navigate('/home', { state: { openShop: true } })}
              className="absolute -top-8 right-20 bg-white rounded-2xl px-3 py-2 shadow-lg border-2 border-[#FFD700] whitespace-nowrap animate-bounce z-10"
              style={{ animationDuration: '2s' }}
            >
              <p className="text-[#5D4037] text-xs font-medium text-center leading-tight">
                "I sure wish I had a body!" 🥺
              </p>
              <p className="text-[#8B5A2B] text-[10px] text-center mt-1 opacity-70">Tap me!</p>
              {/* Speech bubble tail - pointing right toward avatar */}
              <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white"></div>
              <div className="absolute top-1/2 -right-[11px] -translate-y-1/2 w-0 h-0 border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent border-l-[9px] border-l-[#FFD700]"></div>
            </button>
          )}
          
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

  // ============== PRAYER READY COUNTDOWN SCREEN ==============
  if (showPrayerReadyScreen) {
    const handlePrayerReadyClick = () => {
      // Start countdown
      setPrayerCountdown(3);
      
      // Countdown timer
      let count = 3;
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setPrayerCountdown(count);
        } else {
          clearInterval(countdownInterval);
          setPrayerCountdown(null);
          setShowPrayerReadyScreen(false);
          // Show the prayer modal
          setShowPrayerModal(true);
        }
      }, 800);
    };
    
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={woodBackground}>
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

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {prayerCountdown !== null ? (
            // Countdown display
            <div className="text-center animate-pulse">
              <div className="text-[180px] font-display font-bold text-[#FFD700] drop-shadow-2xl leading-none"
                style={{ textShadow: '0 0 40px rgba(255, 215, 0, 0.5), 0 4px 8px rgba(0,0,0,0.5)' }}
              >
                {prayerCountdown}
              </div>
            </div>
          ) : (
            // Ready button with prayer info
            <div className="text-center">
              {/* Prayer emoji and label */}
              <div className="mb-6">
                <div className="text-7xl mb-4">🙏</div>
                <p className="text-[#f3e5ab] font-display text-lg mb-2">Prayer Time</p>
                <p className="text-[#FFD700]/80 text-base max-w-xs mx-auto">
                  Let's talk to God together
                </p>
              </div>
              
              <button
                onClick={handlePrayerReadyClick}
                className="group transition-all transform hover:scale-105 active:scale-95"
              >
                <div className="bg-[#FFD700] hover:bg-[#FFE44D] px-16 py-8 rounded-3xl shadow-2xl border-4 border-[#FFA000] transition-all"
                  style={{ boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4), inset 0 -4px 8px rgba(0,0,0,0.1)' }}
                >
                  <span className="text-[#5D4037] font-display font-bold text-4xl">
                    Ready?
                  </span>
                </div>
                <p className="text-[#f3e5ab]/60 text-sm text-center mt-6 font-display">
                  Tap to start praying
                </p>
              </button>
            </div>
          )}
        </div>

        {/* Avatar - Bottom Right */}
        <div className="absolute bottom-20 right-4" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
          <style>{wingAnimationStyles}</style>
          
          {/* Speech bubble when no body equipped - positioned to LEFT of avatar */}
          {!equippedBody && (
            <button
              onClick={() => navigate('/home', { state: { openShop: true } })}
              className="absolute -top-8 right-20 bg-white rounded-2xl px-3 py-2 shadow-lg border-2 border-[#FFD700] whitespace-nowrap animate-bounce z-10"
              style={{ animationDuration: '2s' }}
            >
              <p className="text-[#5D4037] text-xs font-medium text-center leading-tight">
                "I sure wish I had a body!" 🥺
              </p>
              <p className="text-[#8B5A2B] text-[10px] text-center mt-1 opacity-70">Tap me!</p>
              {/* Speech bubble tail - pointing right toward avatar */}
              <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white"></div>
              <div className="absolute top-1/2 -right-[11px] -translate-y-1/2 w-0 h-0 border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent border-l-[9px] border-l-[#FFD700]"></div>
            </button>
          )}
          
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
      <div className="px-4 py-3">
        <div className="bg-[#3D2914] rounded-2xl p-4 border-4 border-[#5D4037]"
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center justify-around max-w-sm mx-auto">
            {session.steps.map((step, index) => {
              const isActive = session.currentStepIndex === index;
              const isCompleted = step.status === 'completed';
              
              // Get short label (first word only)
              const shortLabel = step.type === 'scripture' ? 'Scripture' 
                : step.type === 'book' ? 'Story'
                : step.type === 'discussion' ? 'Discuss'
                : 'Prayer';
              
              return (
                <div key={step.type} className="flex flex-col items-center">
                  {/* Step icon - circular with border */}
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center transition-all
                    ${isCompleted 
                      ? 'bg-[#8BC34A] border-4 border-[#689F38]' 
                      : isActive
                        ? 'bg-[#D4A574] border-4 border-[#FFD700] shadow-lg'
                        : 'bg-[#6D4C41] border-4 border-[#5D4037]'
                    }
                  `}>
                    <span className={`text-2xl ${isCompleted ? '' : isActive ? '' : 'opacity-60'}`}>
                      {isCompleted ? <Check className="w-7 h-7 text-white" /> : step.icon}
                    </span>
                  </div>
                  
                  {/* Single word label */}
                  <span className={`
                    text-xs mt-2 font-display font-bold
                    ${isActive 
                      ? 'text-[#FFD700]' 
                      : isCompleted
                        ? 'text-[#8BC34A]'
                        : 'text-[#f3e5ab]/50'
                    }
                  `}>
                    {shortLabel}
                  </span>
                </div>
              );
            })}
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
          {/* Step-specific content preview */}
          <div className="flex-1 flex flex-col justify-center">
            {currentStep.type === 'scripture' && (
              <div className="text-center">
                <div className="text-6xl mb-4">🧩</div>
                <h3 className="text-[#FFD700] font-bold font-display text-xl mb-2">Scripture Puzzle</h3>
                <p className="text-[#f3e5ab]/70 text-sm font-display mb-4">
                  Tap the words in the correct order to build today's Bible verse!
                </p>
                <p className="text-[#FFD700] font-bold font-display text-lg">
                  🪙 +10 coins
                </p>
              </div>
            )}

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

          {/* Action Buttons - Inside the card */}
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
      </div>

      {/* Avatar - Bottom Right */}
      <div className="absolute bottom-24 right-4 avatar-float" style={{ marginBottom: 'var(--safe-area-bottom, 0px)' }}>
        <style>{wingAnimationStyles}</style>
        
        {/* Speech bubble when no body equipped */}
        {!equippedBody && (
          <button
            onClick={() => navigate('/home', { state: { openShop: true } })}
            className="absolute -top-12 -left-28 bg-white rounded-2xl px-3 py-2 shadow-lg border-2 border-[#FFD700] whitespace-nowrap animate-bounce z-10"
          >
            <p className="text-xs font-bold text-[#5D4037]">"Geeze I feel weird without a body" 😅</p>
            <p className="text-[10px] text-[#8B4513]/70 text-center">Tap me!</p>
            {/* Speech bubble tail - pointing to the right */}
            <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
            <div className="absolute -bottom-[11px] right-[15px] w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[9px] border-t-[#FFD700]"></div>
          </button>
        )}
        
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

      {/* Scripture of the Day Modal */}
      <DailyVerseModal
        isOpen={showScriptureModal}
        onClose={handleScriptureClose}
        onComplete={handleScriptureComplete}
      />

      {/* Discussion Questions Modal */}
      <DiscussionQuestionsModal
        isOpen={showDiscussionModal}
        onClose={handleDiscussionClose}
        onComplete={handleDiscussionComplete}
        bookTitle={session?.steps[1]?.contentTitle || recommendedBook?.title || 'the story'}
        bookDescription={recommendedBook?.description}
        bookContent={bookContent}
        preGeneratedQuestions={discussionQuestions}
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
