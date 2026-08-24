import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';

/**
 * New User Onboarding - Simplified flow for new installs
 * Just 2 questions before paywall:
 * 1. Kid's age band
 * 2. When will they open the app (bedtime/car/Sunday)
 */
const NewUserOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAge, setSelectedAge] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const AGE_OPTIONS = [
    { value: '2-4', label: '2-4 years', emoji: '👶' },
    { value: '5-7', label: '5-7 years', emoji: '🧒' },
    { value: '8-10', label: '8-10 years', emoji: '🧑' },
    { value: '11+', label: '11+ years', emoji: '👨' },
  ];

  const TIME_OPTIONS = [
    { value: 'bedtime', label: 'Bedtime', emoji: '🌙', desc: 'Wind down with stories' },
    { value: 'car', label: 'In the car', emoji: '🚗', desc: 'Road trip adventures' },
    { value: 'sunday', label: 'Sunday school time', emoji: '⛪', desc: 'Weekly lessons' },
    { value: 'anytime', label: 'Anytime', emoji: '🌟', desc: 'Flexible learning' },
  ];

  useEffect(() => {
    // Track that new onboarding started
    activityTrackingService.trackOnboardingEvent('new_onboarding_started', { 
      flow: 'paywall_first' 
    });
  }, []);

  const handleAgeSelect = (age: string) => {
    setSelectedAge(age);
    // Auto-advance after selection
    setTimeout(() => {
      setStep(2);
      activityTrackingService.trackOnboardingEvent('new_onboarding_age_selected', { 
        age 
      });
    }, 300);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleContinue = () => {
    if (!selectedTime) return;

    // Save preferences
    localStorage.setItem('godlykids_kid_age_band', selectedAge || '');
    localStorage.setItem('godlykids_usage_time', selectedTime);

    activityTrackingService.trackOnboardingEvent('new_onboarding_questions_complete', {
      age: selectedAge,
      time: selectedTime,
    });

    // Navigate to trial explanation screen
    navigate('/trial-intro', { replace: true });
  };

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-32 left-8 w-32 h-24 bg-[#ddd6fe]/30 rounded-full blur-xl" />
      </div>

      {/* Progress indicator */}
      <div className="relative z-10 px-8 pt-6 pb-4">
        <div className="flex gap-2">
          <div className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? 'bg-[#6366f1]' : 'bg-white/30'}`} />
          <div className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? 'bg-[#6366f1]' : 'bg-white/30'}`} />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-10">
        
        {/* Step 1: Age Selection */}
        {step === 1 && (
          <div className="w-full max-w-md animate-in slide-in-from-right-10 duration-500">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-[#6366f1]" />
                <span className="text-sm font-semibold text-[#6366f1] uppercase tracking-wide">Question 1 of 2</span>
              </div>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] mb-3">
                How old is your child?
              </h1>
              <p className="text-[#64748b] text-lg">
                We'll personalize their experience
              </p>
            </div>

            <div className="space-y-3">
              {AGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAgeSelect(option.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    selectedAge === option.value
                      ? 'bg-[#eef2ff] border-[#6366f1] shadow-md scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-[#6366f1]/50 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-3xl">{option.emoji}</span>
                  <span className="text-lg font-semibold text-[#1e1b4b]">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Usage Time Selection */}
        {step === 2 && (
          <div className="w-full max-w-md animate-in slide-in-from-right-10 duration-500">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-6 h-6 text-[#6366f1]" />
                <span className="text-sm font-semibold text-[#6366f1] uppercase tracking-wide">Question 2 of 2</span>
              </div>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] mb-3">
                When will they use Godly Kids?
              </h1>
              <p className="text-[#64748b] text-lg">
                We'll suggest the best content
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTimeSelect(option.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    selectedTime === option.value
                      ? 'bg-[#eef2ff] border-[#6366f1] shadow-md scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-[#6366f1]/50 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-3xl">{option.emoji}</span>
                  <div className="flex-1 text-left">
                    <div className="text-lg font-semibold text-[#1e1b4b]">{option.label}</div>
                    <div className="text-sm text-[#64748b]">{option.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {selectedTime && (
              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50"
              >
                Continue
                <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default NewUserOnboardingPage;
