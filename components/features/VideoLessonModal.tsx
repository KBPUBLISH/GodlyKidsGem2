import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, ChevronRight, Check, Star, Trophy } from 'lucide-react';

// Types
interface Caption {
    timestamp: number;
    text: string;
}

interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: number;
    aiGenerated?: boolean;
}

interface ReflectionPrompt {
    prompt: string;
    type: 'scale' | 'text';
    aiGenerated?: boolean;
}

interface DailyLesson {
    _id: string;
    title: string;
    description?: string;
    thumbnailUrl: string;
    videoUrl: string;
    videoDuration: number;
    captions?: Caption[];
    devotionalText: string;
    activityType: 'quiz' | 'reflection';
    activityData: {
        questions?: QuizQuestion[];
        prompts?: ReflectionPrompt[];
    };
    scheduledDate: string;
    coinReward: number;
}

interface VideoLessonModalProps {
    isOpen: boolean;
    onClose: () => void;
    lesson: DailyLesson | null;
    onComplete?: (coinsEarned: number) => void;
}

type ScreenType = 'video' | 'devotional' | 'activity' | 'complete';

const VideoLessonModal: React.FC<VideoLessonModalProps> = ({ isOpen, onClose, lesson, onComplete }) => {
    const [currentScreen, setCurrentScreen] = useState<ScreenType>('video');
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [currentCaption, setCurrentCaption] = useState<string>('');
    const [activityAnswers, setActivityAnswers] = useState<any[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [quizScore, setQuizScore] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const startTimeRef = useRef<Date>(new Date());

    // Reset state when lesson changes
    useEffect(() => {
        if (lesson && isOpen) {
            setCurrentScreen('video');
            setVideoProgress(0);
            setActivityAnswers([]);
            setCurrentQuestionIndex(0);
            setQuizScore(0);
            setShowFeedback(false);
            startTimeRef.current = new Date();
        }
    }, [lesson, isOpen]);

    // Video time update handler
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const progress = (video.currentTime / video.duration) * 100;
            setVideoProgress(progress);

            // Update captions
            if (lesson?.captions) {
                const currentTime = video.currentTime;
                const caption = lesson.captions.find(
                    (c, idx) => {
                        const nextCaption = lesson.captions![idx + 1];
                        return currentTime >= c.timestamp && (!nextCaption || currentTime < nextCaption.timestamp);
                    }
                );
                setCurrentCaption(caption?.text || '');
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            // Auto-advance to devotional after 1 second
            setTimeout(() => {
                setCurrentScreen('devotional');
            }, 1000);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
        };
    }, [lesson]);

    const togglePlayPause = () => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
        if (showFeedback) return; // Prevent multiple answers

        const question = lesson?.activityData.questions?.[questionIndex];
        if (!question) return;

        const correct = answerIndex === question.correctAnswer;
        setIsCorrect(correct);
        setShowFeedback(true);

        if (correct) {
            setQuizScore(prev => prev + 1);
        }

        // Store answer
        const newAnswers = [...activityAnswers];
        newAnswers[questionIndex] = {
            questionIndex,
            answerIndex,
            correct
        };
        setActivityAnswers(newAnswers);
    };

    const handleNextQuestion = () => {
        const totalQuestions = lesson?.activityData.questions?.length || 0;

        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowFeedback(false);
        } else {
            // Quiz complete
            setCurrentScreen('complete');
        }
    };

    const handleReflectionAnswer = (promptIndex: number, value: any) => {
        const newAnswers = [...activityAnswers];
        newAnswers[promptIndex] = value;
        setActivityAnswers(newAnswers);
    };

    const handleCompleteActivity = () => {
        setCurrentScreen('complete');
    };

    const handleFinish = () => {
        if (onComplete && lesson) {
            onComplete(lesson.coinReward);
        }
        onClose();
    };

    if (!isOpen || !lesson) return null;

    const getProgressSteps = () => {
        const steps = ['Video', 'Devotional', 'Activity'];
        const currentIndex = steps.indexOf(
            currentScreen === 'complete' ? 'Activity' : currentScreen.charAt(0).toUpperCase() + currentScreen.slice(1)
        );
        return { steps, currentIndex };
    };

    const { steps, currentIndex } = getProgressSteps();

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 right-0 z-10">
                <div className="flex gap-1 p-2">
                    {steps.map((step, idx) => (
                        <div
                            key={step}
                            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                        >
                            <div
                                className={`h-full bg-white transition-all duration-300 ${idx < currentIndex ? 'w-full' :
                                        idx === currentIndex ? `w-[${currentScreen === 'video' ? videoProgress : 100}%]` :
                                            'w-0'
                                    }`}
                                style={{
                                    width: idx < currentIndex ? '100%' :
                                        idx === currentIndex && currentScreen === 'video' ? `${videoProgress}%` :
                                            idx === currentIndex ? '100%' : '0%'
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
                <X size={24} />
            </button>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
                {/* Video Screen */}
                {currentScreen === 'video' && (
                    <div className="relative w-full h-full bg-black">
                        <video
                            ref={videoRef}
                            src={lesson.videoUrl}
                            className="w-full h-full object-contain"
                            playsInline
                        />

                        {/* Play/Pause Overlay */}
                        <div
                            className="absolute inset-0 flex items-center justify-center cursor-pointer"
                            onClick={togglePlayPause}
                        >
                            {!isPlaying && (
                                <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl">
                                    <Play className="text-[#8B4513] ml-1" size={40} />
                                </div>
                            )}
                        </div>

                        {/* Captions */}
                        {currentCaption && (
                            <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4">
                                <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-lg max-w-2xl">
                                    <p className="text-white text-center text-lg font-medium">
                                        {currentCaption}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Devotional Screen */}
                {currentScreen === 'devotional' && (
                    <div className="w-full h-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] overflow-y-auto">
                        <div className="max-w-2xl mx-auto px-6 py-20">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    <Star className="text-[#8B4513]" size={32} />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-2">
                                    Today's Devotional
                                </h2>
                                <p className="text-[#94a3b8] text-sm">
                                    Take a moment to reflect
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
                                <div className="prose prose-invert prose-lg max-w-none">
                                    <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                                        {lesson.devotionalText}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setCurrentScreen('activity')}
                                className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#ffed4e] hover:to-[#FFD700] text-[#8B4513] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                            >
                                Continue to Activity
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Activity Screen - Quiz */}
                {currentScreen === 'activity' && lesson.activityType === 'quiz' && (
                    <div className="w-full h-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] overflow-y-auto">
                        <div className="max-w-2xl mx-auto px-6 py-20">
                            {lesson.activityData.questions && (
                                <>
                                    <div className="text-center mb-8">
                                        <p className="text-[#94a3b8] text-sm mb-2">
                                            Question {currentQuestionIndex + 1} of {lesson.activityData.questions.length}
                                        </p>
                                        <h2 className="text-2xl font-bold text-white">
                                            {lesson.activityData.questions[currentQuestionIndex].question}
                                        </h2>
                                    </div>

                                    <div className="space-y-3 mb-8">
                                        {lesson.activityData.questions[currentQuestionIndex].options.map((option, idx) => {
                                            const isSelected = activityAnswers[currentQuestionIndex]?.answerIndex === idx;
                                            const isCorrectAnswer = idx === lesson.activityData.questions![currentQuestionIndex].correctAnswer;
                                            const showCorrect = showFeedback && isCorrectAnswer;
                                            const showIncorrect = showFeedback && isSelected && !isCorrectAnswer;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleQuizAnswer(currentQuestionIndex, idx)}
                                                    disabled={showFeedback}
                                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${showCorrect
                                                            ? 'bg-green-500/20 border-green-500 text-white'
                                                            : showIncorrect
                                                                ? 'bg-red-500/20 border-red-500 text-white'
                                                                : isSelected
                                                                    ? 'bg-[#FFD700]/20 border-[#FFD700] text-white'
                                                                    : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${showCorrect
                                                                ? 'border-green-500 bg-green-500'
                                                                : showIncorrect
                                                                    ? 'border-red-500 bg-red-500'
                                                                    : isSelected
                                                                        ? 'border-[#FFD700] bg-[#FFD700]'
                                                                        : 'border-white/40'
                                                            }`}>
                                                            {(showCorrect || (showFeedback && isSelected)) && (
                                                                <Check size={16} className="text-white" />
                                                            )}
                                                        </div>
                                                        <span className="flex-1 font-medium">{option}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {showFeedback && (
                                        <div className={`p-4 rounded-xl mb-6 ${isCorrect ? 'bg-green-500/20 border-2 border-green-500' : 'bg-orange-500/20 border-2 border-orange-500'
                                            }`}>
                                            <p className={`text-center font-bold ${isCorrect ? 'text-green-300' : 'text-orange-300'}`}>
                                                {isCorrect ? '✓ Correct!' : '✓ Good try! The correct answer is highlighted above.'}
                                            </p>
                                        </div>
                                    )}

                                    {showFeedback && (
                                        <button
                                            onClick={handleNextQuestion}
                                            className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#ffed4e] hover:to-[#FFD700] text-[#8B4513] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                                        >
                                            {currentQuestionIndex < lesson.activityData.questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
                                            <ChevronRight size={20} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Activity Screen - Reflection */}
                {currentScreen === 'activity' && lesson.activityType === 'reflection' && (
                    <div className="w-full h-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] overflow-y-auto">
                        <div className="max-w-2xl mx-auto px-6 py-20">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    Self-Reflection
                                </h2>
                                <p className="text-[#94a3b8]">
                                    Take a moment to think about what you learned
                                </p>
                            </div>

                            <div className="space-y-6 mb-8">
                                {lesson.activityData.prompts?.map((prompt, idx) => (
                                    <div key={idx} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                                        <p className="text-white font-medium mb-4">{prompt.prompt}</p>

                                        {prompt.type === 'scale' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm text-[#94a3b8] mb-2">
                                                    <span>Not at all</span>
                                                    <span>Very much</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="5"
                                                    value={activityAnswers[idx] || 3}
                                                    onChange={(e) => handleReflectionAnswer(idx, parseInt(e.target.value))}
                                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FFD700]"
                                                />
                                                <div className="flex justify-between text-xs text-white/60">
                                                    {[1, 2, 3, 4, 5].map(num => (
                                                        <span key={num}>{num}</span>
                                                    ))}
                                                </div>
                                                <p className="text-center text-[#FFD700] font-bold text-lg mt-2">
                                                    {activityAnswers[idx] || 3}
                                                </p>
                                            </div>
                                        )}

                                        {prompt.type === 'text' && (
                                            <textarea
                                                value={activityAnswers[idx] || ''}
                                                onChange={(e) => handleReflectionAnswer(idx, e.target.value)}
                                                placeholder="Share your thoughts..."
                                                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700] resize-none"
                                                rows={4}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleCompleteActivity}
                                className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#ffed4e] hover:to-[#FFD700] text-[#8B4513] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                            >
                                Complete Reflection
                                <Check size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Completion Screen */}
                {currentScreen === 'complete' && (
                    <div className="w-full h-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center justify-center">
                        <div className="max-w-md mx-auto px-6 text-center">
                            {/* Trophy Animation */}
                            <div className="mb-8 animate-bounce">
                                <div className="w-32 h-32 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center mx-auto shadow-2xl">
                                    <Trophy className="text-[#8B4513]" size={64} />
                                </div>
                            </div>

                            <h2 className="text-4xl font-bold text-white mb-4">
                                Lesson Complete!
                            </h2>

                            {lesson.activityType === 'quiz' && (
                                <p className="text-[#94a3b8] text-lg mb-6">
                                    You got {quizScore} out of {lesson.activityData.questions?.length} correct!
                                </p>
                            )}

                            {/* Coin Reward */}
                            <div className="bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border-2 border-[#FFD700] rounded-2xl p-8 mb-8">
                                <p className="text-white/80 text-sm mb-2">You earned</p>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-12 h-12 bg-[#FFD700] rounded-full flex items-center justify-center shadow-lg">
                                        <span className="text-2xl">🪙</span>
                                    </div>
                                    <span className="text-5xl font-bold text-[#FFD700]">
                                        +{lesson.coinReward}
                                    </span>
                                </div>
                                <p className="text-white/80 text-sm mt-2">Gold Coins</p>
                            </div>

                            <button
                                onClick={handleFinish}
                                className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#ffed4e] hover:to-[#FFD700] text-[#8B4513] font-bold py-4 rounded-xl transition-all shadow-lg text-lg"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoLessonModal;
