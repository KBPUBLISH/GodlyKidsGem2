import React, { useState, useEffect } from 'react';
import { X, Check, ChevronLeft, ChevronRight, Trophy, Coins, Loader2 } from 'lucide-react';
import { ApiService } from '../../services/apiService';
import { useUser } from '../../context/UserContext';

interface QuizOption {
    text: string;
    isCorrect: boolean;
}

interface QuizQuestion {
    question: string;
    options: QuizOption[];
}

interface BookQuizModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookId: string;
    bookTitle: string;
    attemptCount: number;
    maxAttempts: number;
    onQuizComplete: (score: number, coinsEarned: number) => void;
}

const BookQuizModal: React.FC<BookQuizModalProps> = ({
    isOpen,
    onClose,
    bookId,
    bookTitle,
    attemptCount,
    maxAttempts,
    onQuizComplete,
}) => {
    const { addCoins } = useUser();
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Map<number, number>>(new Map());
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get user ID (using localStorage for now)
    const getUserId = () => {
        let userId = localStorage.getItem('godlykids_user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('godlykids_user_id', userId);
        }
        return userId;
    };

    useEffect(() => {
        if (isOpen && bookId) {
            loadQuiz();
        }
    }, [isOpen, bookId]);

    const loadQuiz = async () => {
        setLoading(true);
        setError(null);
        try {
            // First try to get existing quiz
            let quizData = await ApiService.getBookQuiz(bookId, getUserId());
            
            // If no quiz exists, generate one
            if (!quizData || !quizData.quiz) {
                console.log('📝 No quiz found, generating...');
                const generated = await ApiService.generateBookQuiz(bookId);
                if (generated && generated.quiz) {
                    quizData = { quiz: generated.quiz };
                }
            }

            if (quizData && quizData.quiz && quizData.quiz.questions) {
                setQuestions(quizData.quiz.questions);
            } else {
                setError('Could not load quiz questions');
            }
        } catch (err) {
            console.error('Failed to load quiz:', err);
            setError('Failed to load quiz. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAnswer = (optionIndex: number) => {
        if (quizSubmitted) return;
        const newAnswers = new Map(selectedAnswers);
        newAnswers.set(currentQuestionIndex, optionIndex);
        setSelectedAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        if (selectedAnswers.size !== questions.length) {
            return; // All questions must be answered
        }

        setSubmitting(true);
        try {
            const answersArray = Array.from({ length: questions.length }, (_, i) => 
                selectedAnswers.get(i) ?? -1
            );

            const result = await ApiService.submitBookQuiz(bookId, getUserId(), answersArray);
            
            if (result) {
                setResults(result);
                setQuizSubmitted(true);
                
                // Add coins to user
                if (result.coinsEarned > 0) {
                    addCoins(result.coinsEarned);
                }

                // Notify parent
                onQuizComplete(result.score, result.coinsEarned);
            }
        } catch (err) {
            console.error('Failed to submit quiz:', err);
            setError('Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        // Reset state
        setCurrentQuestionIndex(0);
        setSelectedAnswers(new Map());
        setQuizSubmitted(false);
        setResults(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    const currentQuestion = questions[currentQuestionIndex];
    const allAnswered = selectedAnswers.size === questions.length;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
            <div className="relative bg-[#f3e5ab] rounded-2xl shadow-2xl border-4 border-[#8B4513] max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden animate-[scaleUp_0.3s_ease-out]">
                {/* Wood texture header */}
                <div className="bg-gradient-to-r from-[#8B4513] via-[#A0522D] to-[#8B4513] p-4 relative">
                    <div className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 12px)'
                        }}
                    />
                    <div className="flex items-center justify-between relative z-10">
                        <h2 className="text-[#FFD700] text-xl font-black font-display drop-shadow-lg">
                            📚 Story Quiz
                        </h2>
                        <button
                            onClick={handleClose}
                            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-white/80 text-sm mt-1 relative z-10">
                        {bookTitle}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-[#8B4513] animate-spin mb-4" />
                            <p className="text-[#5D4037] font-bold font-display">
                                Preparing your quiz...
                            </p>
                            <p className="text-[#8B4513] text-sm mt-2">
                                Our AI is creating questions just for you!
                            </p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-red-600 font-bold mb-4">{error}</p>
                            <button
                                onClick={loadQuiz}
                                className="bg-[#8B4513] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#A0522D] transition"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : quizSubmitted && results ? (
                        // Results screen
                        <div className="flex flex-col items-center text-center py-6">
                            <div className="text-6xl mb-4">
                                {results.score === 6 ? '🏆' : results.score >= 4 ? '⭐' : '👍'}
                            </div>
                            <h3 className="text-[#3E2723] text-2xl font-black font-display mb-2">
                                {results.score === 6 ? 'Perfect Score!' : results.score >= 4 ? 'Great Job!' : 'Good Try!'}
                            </h3>
                            <p className="text-[#5D4037] text-lg mb-4">
                                You got <span className="font-bold text-[#8B4513]">{results.score}</span> out of <span className="font-bold text-[#8B4513]">6</span> correct!
                            </p>
                            
                            {results.coinsEarned > 0 && (
                                <div className="bg-[#FFF8E1] p-4 rounded-xl border-2 border-[#FFD700] mb-6 flex items-center gap-3">
                                    <Coins className="w-8 h-8 text-[#FFD700]" />
                                    <div>
                                        <p className="text-[#FF8F00] font-black text-xl">
                                            +{results.coinsEarned} Gold Coins!
                                        </p>
                                        <p className="text-[#8B4513] text-xs">
                                            10 coins per correct answer
                                        </p>
                                    </div>
                                </div>
                            )}

                            <p className="text-[#8B4513] text-sm mb-6">
                                {results.attemptsRemaining > 0 
                                    ? `You have ${results.attemptsRemaining} attempt${results.attemptsRemaining > 1 ? 's' : ''} remaining!`
                                    : 'You\'ve completed all your quiz attempts!'}
                            </p>

                            <button
                                onClick={handleClose}
                                className="bg-[#4CAF50] text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg border-b-4 border-[#2E7D32] active:border-b-0 active:translate-y-1 transition-all"
                            >
                                Awesome!
                            </button>
                        </div>
                    ) : currentQuestion ? (
                        // Quiz questions
                        <>
                            {/* Progress */}
                            <div className="mb-6">
                                <div className="flex justify-between text-[#8B4513] text-sm font-bold mb-2">
                                    <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                                    <span>{selectedAnswers.size}/{questions.length} answered</span>
                                </div>
                                <div className="w-full h-3 bg-[#d4c59a] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#8B4513] transition-all duration-300"
                                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Question */}
                            <div className="mb-6">
                                <h3 className="text-[#3E2723] text-xl font-bold mb-6 leading-relaxed">
                                    {currentQuestion.question}
                                </h3>

                                <div className="space-y-3">
                                    {currentQuestion.options.map((option, optIndex) => {
                                        const isSelected = selectedAnswers.get(currentQuestionIndex) === optIndex;
                                        return (
                                            <button
                                                key={optIndex}
                                                onClick={() => handleSelectAnswer(optIndex)}
                                                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                                                    isSelected
                                                        ? 'bg-[#FFD700] border-[#B8860B] text-[#3E2723] shadow-md font-bold'
                                                        : 'bg-white/60 border-[#d4c59a] text-[#5D4037] hover:bg-white hover:border-[#8B4513]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                                                        isSelected
                                                            ? 'bg-[#B8860B] border-[#8B4513] text-white'
                                                            : 'bg-[#d4c59a] border-[#8B4513] text-[#5D4037]'
                                                    }`}>
                                                        {String.fromCharCode(65 + optIndex)}
                                                    </div>
                                                    <span className="text-lg">{option.text}</span>
                                                    {isSelected && <Check className="w-5 h-5 text-[#3E2723] ml-auto" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-between gap-4">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#5D4037] text-white hover:bg-[#4E342E]"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    Back
                                </button>

                                {isLastQuestion ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAnswered || submitting}
                                        className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#4CAF50] text-white hover:bg-[#43A047]"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Trophy className="w-5 h-5" />
                                                Submit Quiz
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        disabled={!selectedAnswers.has(currentQuestionIndex)}
                                        className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#8B4513] text-white hover:bg-[#A0522D]"
                                    >
                                        Next
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-[#5D4037]">No questions available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookQuizModal;

