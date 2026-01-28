import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Lightbulb, ChevronRight, Loader2, Check } from 'lucide-react';
import { ApiService } from '../../services/apiService';

interface DiscussionQuestion {
  question: string;
  parentTip: string;
  emoji: string;
}

interface DiscussionQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  bookTitle: string;
  bookDescription?: string;
  bookContent?: string;
  preGeneratedQuestions?: DiscussionQuestion[]; // Pre-generated questions from parent
}

const DiscussionQuestionsModal: React.FC<DiscussionQuestionsModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  bookTitle,
  bookDescription,
  bookContent,
  preGeneratedQuestions,
}) => {
  const [questions, setQuestions] = useState<DiscussionQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen && bookTitle) {
      // Use pre-generated questions if available, otherwise fetch
      if (preGeneratedQuestions && preGeneratedQuestions.length > 0) {
        console.log('📝 Using pre-generated questions:', preGeneratedQuestions.length);
        setQuestions(preGeneratedQuestions);
        setIsLoading(false);
      } else {
        fetchQuestions();
      }
    }
  }, [isOpen, bookTitle, preGeneratedQuestions]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      console.log('📝 Fetching questions for:', bookTitle, 'Content length:', bookContent?.length || 0);
      const response = await fetch(`${getApiBaseUrl()}ai/discussion-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle,
          bookDescription,
          bookContent,
          childAge: '7-12',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📝 Received questions:', data.questions?.length || 0, 'Source:', data.source || 'unknown');
        if (data.source === 'ai') {
          console.log('📝 AI-generated questions:', data.questions?.map((q: any) => q.question.substring(0, 50)));
        } else {
          console.log('📝 Using fallback questions (AI not available)');
        }
        setQuestions(data.questions || getFallbackQuestions());
      } else {
        console.log('📝 Failed to fetch, status:', response.status);
        setQuestions(getFallbackQuestions());
      }
    } catch (error) {
      console.error('Failed to fetch discussion questions:', error);
      setQuestions(getFallbackQuestions());
    } finally {
      setIsLoading(false);
    }
  };

  const getApiBaseUrl = () => {
    // Check for environment-specific API URL
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api/';
      }
    }
    return 'https://backendgk2-0.onrender.com/api/';
  };

  const getFallbackQuestions = (): DiscussionQuestion[] => [
    {
      question: `What was your favorite part of "${bookTitle}" and why?`,
      parentTip: "Listen actively and ask follow-up questions about their feelings.",
      emoji: "⭐"
    },
    {
      question: "What did this story teach us about being kind or following God?",
      parentTip: "Connect the story's message to everyday situations they might face.",
      emoji: "💡"
    }
  ];

  const handleMarkDiscussed = () => {
    const newCompleted = new Set(completedQuestions);
    newCompleted.add(currentQuestionIndex);
    setCompletedQuestions(newCompleted);
    setShowTip(false);

    // If all questions are discussed, show completion
    if (newCompleted.size >= questions.length) {
      // Small delay to show the checkmark
      setTimeout(() => {
        onComplete();
      }, 500);
    } else {
      // Move to next question
      const nextIndex = currentQuestionIndex + 1;
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex);
      }
    }
  };

  const handleSkip = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setShowTip(false);
    } else {
      // All questions viewed, allow completion
      onComplete();
    }
  };

  if (!isOpen) return null;

  const currentQuestion = questions[currentQuestionIndex];
  const allCompleted = completedQuestions.size >= questions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-[#f5f0e1] to-[#e8dcc8] rounded-2xl w-full max-w-md shadow-2xl border-4 border-[#8B4513]/30 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#6B8E6B] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-white" />
            <h2 className="text-white font-display font-bold text-xl">
              Let's Discuss!
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#6B8E6B] animate-spin mb-4" />
              <p className="text-[#5D4037] font-medium">
                Creating discussion questions...
              </p>
            </div>
          ) : allCompleted ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 bg-[#6B8E6B] rounded-full flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-[#5D4037] font-display font-bold text-xl mb-2">
                Great Discussion!
              </h3>
              <p className="text-[#8B4513]/70 text-center">
                You and your child had a wonderful talk about the story!
              </p>
            </div>
          ) : (
            <>
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mb-6">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full transition-all ${
                      completedQuestions.has(idx)
                        ? 'bg-[#6B8E6B]'
                        : idx === currentQuestionIndex
                        ? 'bg-[#8B4513] scale-110'
                        : 'bg-[#8B4513]/30'
                    }`}
                  />
                ))}
              </div>

              {/* Book reference */}
              <p className="text-[#8B4513]/60 text-sm text-center mb-4">
                Based on: <span className="font-medium">{bookTitle}</span>
              </p>

              {/* Question card */}
              {currentQuestion && (
                <div className="bg-white rounded-xl p-5 shadow-md border-2 border-[#8B4513]/20 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{currentQuestion.emoji}</span>
                    <div className="flex-1">
                      <p className="text-[#5D4037] font-medium text-lg leading-relaxed">
                        {currentQuestion.question}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Parent tip toggle */}
              <button
                onClick={() => setShowTip(!showTip)}
                className="flex items-center gap-2 text-[#6B8E6B] hover:text-[#5A7D5A] transition-colors mb-4 mx-auto"
              >
                <Lightbulb className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {showTip ? 'Hide' : 'Show'} Parent Tip
                </span>
              </button>

              {/* Parent tip */}
              {showTip && currentQuestion && (
                <div className="bg-[#6B8E6B]/10 rounded-lg p-4 mb-4 border border-[#6B8E6B]/30">
                  <p className="text-[#5D4037] text-sm flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-[#6B8E6B] mt-0.5 flex-shrink-0" />
                    <span>{currentQuestion.parentTip}</span>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-[#8B4513]/30 text-[#8B4513] font-medium hover:bg-[#8B4513]/10 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleMarkDiscussed}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#6B8E6B] text-white font-bold hover:bg-[#5A7D5A] transition-colors flex items-center justify-center gap-2"
                >
                  We Discussed It!
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer instruction */}
        {!isLoading && !allCompleted && (
          <div className="px-6 pb-4 flex-shrink-0">
            <p className="text-[#8B4513]/50 text-xs text-center">
              Take your time! These questions help you connect with your child.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscussionQuestionsModal;
