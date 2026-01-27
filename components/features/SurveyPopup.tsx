import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Star, Send, CheckCircle } from 'lucide-react';

interface SurveyPopupProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    email?: string;
    platform?: string;
    subscriptionStatus?: string;
}

const SURVEY_SHOWN_KEY = 'godlykids_survey_shown';
const SURVEY_FIRST_USE_KEY = 'godlykids_first_use_date';
const DAYS_BEFORE_SURVEY = 7; // Show survey after 7 days of use

// Check if it's time to show the survey
export const shouldShowSurvey = (): boolean => {
    const surveyShown = localStorage.getItem(SURVEY_SHOWN_KEY);
    if (surveyShown) return false; // Already shown

    const firstUseDate = localStorage.getItem(SURVEY_FIRST_USE_KEY);
    if (!firstUseDate) {
        // First time user - set the date and don't show yet
        localStorage.setItem(SURVEY_FIRST_USE_KEY, new Date().toISOString());
        return false;
    }

    const firstUse = new Date(firstUseDate);
    const now = new Date();
    const daysSinceFirstUse = Math.floor((now.getTime() - firstUse.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceFirstUse >= DAYS_BEFORE_SURVEY;
};

// Mark survey as shown
export const markSurveyShown = () => {
    localStorage.setItem(SURVEY_SHOWN_KEY, new Date().toISOString());
};

const SurveyPopup: React.FC<SurveyPopupProps> = ({
    isOpen,
    onClose,
    userId,
    email,
    platform = 'web',
    subscriptionStatus = 'free'
}) => {
    const [step, setStep] = useState<'content' | 'nps' | 'feedback' | 'thanks'>(isOpen ? 'content' : 'content');
    const [contentPreferences, setContentPreferences] = useState({
        games: false,
        books: false,
        audioDramas: false,
        lessons: false,
        songs: false,
    });
    const [npsScore, setNpsScore] = useState<number | null>(null);
    const [customFeedback, setCustomFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep('content');
        }
    }, [isOpen]);

    const togglePreference = (key: keyof typeof contentPreferences) => {
        setContentPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';
            
            // Calculate days since first use
            const firstUseDate = localStorage.getItem(SURVEY_FIRST_USE_KEY);
            const daysUsingApp = firstUseDate 
                ? Math.floor((new Date().getTime() - new Date(firstUseDate).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            const response = await fetch(`${apiUrl}/api/survey/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    email,
                    surveyType: 'weekly_feedback',
                    wantsMoreGames: contentPreferences.games,
                    wantsMoreBooks: contentPreferences.books,
                    wantsMoreAudioDramas: contentPreferences.audioDramas,
                    wantsMoreLessons: contentPreferences.lessons,
                    wantsMoreSongs: contentPreferences.songs,
                    npsScore,
                    customFeedback: customFeedback.trim() || null,
                    metadata: {
                        platform,
                        daysUsingApp,
                        subscriptionStatus
                    }
                })
            });

            if (response.ok) {
                markSurveyShown();
                setStep('thanks');
            }
        } catch (error) {
            console.error('Survey submit error:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        markSurveyShown(); // Mark as shown even if they close without completing
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-b from-amber-50 to-orange-50 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border-4 border-amber-600">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-bold text-white">Quick Feedback</h2>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Step 1: Content Preferences */}
                    {step === 'content' && (
                        <div className="space-y-5">
                            <p className="text-amber-900 text-center font-medium">
                                What would you like to see more of in Godly Kids?
                            </p>
                            <p className="text-amber-700 text-sm text-center">
                                Select all that apply
                            </p>
                            
                            <div className="space-y-3">
                                {[
                                    { key: 'games', label: '🎮 More Games', emoji: '🎮' },
                                    { key: 'books', label: '📚 More Books', emoji: '📚' },
                                    { key: 'audioDramas', label: '🎧 More Audio Dramas', emoji: '🎧' },
                                    { key: 'lessons', label: '📖 More Lessons', emoji: '📖' },
                                    { key: 'songs', label: '🎵 More Songs', emoji: '🎵' },
                                ].map(item => (
                                    <button
                                        key={item.key}
                                        onClick={() => togglePreference(item.key as keyof typeof contentPreferences)}
                                        className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-all ${
                                            contentPreferences[item.key as keyof typeof contentPreferences]
                                                ? 'bg-amber-500 border-amber-600 text-white scale-[1.02]'
                                                : 'bg-white border-amber-200 text-amber-900 hover:border-amber-400'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setStep('nps')}
                                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    {/* Step 2: NPS Score */}
                    {step === 'nps' && (
                        <div className="space-y-5">
                            <p className="text-amber-900 text-center font-medium">
                                How likely are you to recommend Godly Kids to a friend?
                            </p>
                            <p className="text-amber-700 text-sm text-center">
                                1 = Not likely, 10 = Very likely
                            </p>
                            
                            <div className="grid grid-cols-5 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                    <button
                                        key={score}
                                        onClick={() => setNpsScore(score)}
                                        className={`p-3 rounded-xl font-bold text-lg transition-all ${
                                            npsScore === score
                                                ? score >= 9 
                                                    ? 'bg-green-500 text-white scale-110'
                                                    : score >= 7
                                                        ? 'bg-amber-500 text-white scale-110'
                                                        : 'bg-red-400 text-white scale-110'
                                                : 'bg-white border-2 border-amber-200 text-amber-900 hover:border-amber-400'
                                        }`}
                                    >
                                        {score}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between text-xs text-amber-600 px-1">
                                <span>Not likely</span>
                                <span>Very likely</span>
                            </div>

                            <button
                                onClick={() => setStep('feedback')}
                                disabled={npsScore === null}
                                className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg ${
                                    npsScore !== null
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                Next →
                            </button>
                        </div>
                    )}

                    {/* Step 3: Custom Feedback */}
                    {step === 'feedback' && (
                        <div className="space-y-5">
                            <p className="text-amber-900 text-center font-medium">
                                Any other feedback or suggestions?
                            </p>
                            <p className="text-amber-700 text-sm text-center">
                                Optional - We'd love to hear your thoughts!
                            </p>
                            
                            <textarea
                                value={customFeedback}
                                onChange={(e) => setCustomFeedback(e.target.value)}
                                placeholder="Tell us what you think..."
                                className="w-full h-32 p-4 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:outline-none resize-none text-amber-900"
                                maxLength={2000}
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('nps')}
                                    className="flex-1 py-4 bg-white border-2 border-amber-300 text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-all"
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <span>Sending...</span>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Submit
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Thank You */}
                    {step === 'thanks' && (
                        <div className="space-y-5 text-center py-6">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-12 h-12 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-amber-900">
                                Thank You!
                            </h3>
                            <p className="text-amber-700">
                                Your feedback helps us make Godly Kids even better for families like yours.
                            </p>
                            <button
                                onClick={handleClose}
                                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SurveyPopup;
