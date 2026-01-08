import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shield, BookOpen, Music, Sparkles, Check, ChevronRight, Loader2 } from 'lucide-react';

// Quiz screen types
type Screen = 
  | 'hero' | 'age' | 'trust' | 'pain' | 'affirmation' 
  | 'values' | 'values-reinforcement' | 'screentime' | 'empathy'
  | 'learning' | 'personalization' | 'faith-approach' | 'mission'
  | 'product-intro' | 'social-proof' | 'transformation' | 'email'
  | 'processing' | 'offer-intro' | 'pricing' | 'faq' | 'confirmation' | 'deeplink';

interface QuizData {
  childAge: string;
  painLevel: string;
  values: string[];
  screenTimeFeeling: string;
  learningStyle: string;
  faithApproach: string;
  email: string;
}

const ParentQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<Screen>('hero');
  const [quizData, setQuizData] = useState<QuizData>({
    childAge: '',
    painLevel: '',
    values: [],
    screenTimeFeeling: '',
    learningStyle: '',
    faithApproach: '',
    email: ''
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [processingText, setProcessingText] = useState(0);
  const [emailInput, setEmailInput] = useState(''); // Separate state to prevent focus loss
  const emailInputRef = useRef<HTMLInputElement>(null);

  const processingTexts = [
    'Selecting age-appropriate stories...',
    'Aligning faith themes...',
    'Preparing a safe, joyful experience...'
  ];

  // Processing screen animation and submit quiz
  useEffect(() => {
    if (currentScreen === 'processing') {
      const interval = setInterval(() => {
        setProcessingText(prev => (prev + 1) % processingTexts.length);
      }, 1500);
      
      // Submit quiz data to backend
      const submitQuiz = async () => {
        try {
          const response = await fetch('https://backendgk2-0.onrender.com/api/parent-quiz/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailInput,
              quizData: {
                ...quizData,
                email: emailInput
              }
            })
          });
          const data = await response.json();
          console.log('📧 Quiz submitted:', data);
        } catch (error) {
          console.error('Failed to submit quiz:', error);
        }
      };
      submitQuiz();
      
      // Auto-advance after 4.5 seconds
      const timeout = setTimeout(() => {
        goToScreen('offer-intro');
      }, 4500);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [currentScreen, emailInput, quizData]);

  const goToScreen = (screen: Screen) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentScreen(screen);
      setIsAnimating(false);
    }, 300);
  };

  const screenOrder: Screen[] = [
    'hero', 'age', 'trust', 'pain', 'affirmation', 
    'values', 'values-reinforcement', 'screentime', 'empathy',
    'learning', 'personalization', 'faith-approach', 'mission',
    'product-intro', 'social-proof', 'transformation', 'email',
    'processing', 'offer-intro', 'pricing', 'faq', 'confirmation', 'deeplink'
  ];

  const currentIndex = screenOrder.indexOf(currentScreen);
  const progress = ((currentIndex) / (screenOrder.length - 1)) * 100;

  const handleValueToggle = (value: string) => {
    setQuizData(prev => ({
      ...prev,
      values: prev.values.includes(value) 
        ? prev.values.filter(v => v !== value)
        : [...prev.values, value]
    }));
  };

  // Common button component
  const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = 
    ({ onClick, children, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {children}
      <ChevronRight className="w-5 h-5" />
    </button>
  );

  // Option button component
  const OptionButton: React.FC<{ 
    selected: boolean; 
    onClick: () => void; 
    children: React.ReactNode;
    multiSelect?: boolean;
  }> = ({ selected, onClick, children, multiSelect }) => (
    <button
      onClick={onClick}
      className={`w-full py-4 px-6 rounded-2xl border-2 transition-all duration-200 text-left font-medium ${
        selected 
          ? 'border-amber-500 bg-amber-50 text-amber-900' 
          : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'border-amber-500 bg-amber-500' : 'border-stone-300'
        }`}>
          {selected && <Check className="w-4 h-4 text-white" />}
        </div>
        <span>{children}</span>
      </div>
    </button>
  );

  // Screen wrapper with animation
  const ScreenWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
      {children}
    </div>
  );

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      // SCREEN 1 — HERO
      case 'hero':
        return (
          <ScreenWrapper>
            <div className="text-center px-6 py-12">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Heart className="w-10 h-10 text-amber-600" fill="#d97706" />
              </div>
              <h1 className="text-3xl font-bold text-stone-800 mb-4 leading-tight">
                Help Your Child Grow in Faith, Kindness, and Confidence
              </h1>
              <p className="text-stone-600 text-lg mb-10">
                Discover how Christian parents are turning screen time into faith-forming moments.
              </p>
              <PrimaryButton onClick={() => goToScreen('age')}>
                Start the 2-Minute Parent Quiz
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 2 — AGE
      case 'age':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                How old is your child?
              </h2>
              <div className="space-y-3 mb-8">
                {['3–4', '5–6', '7–9', '10–12'].map(age => (
                  <OptionButton
                    key={age}
                    selected={quizData.childAge === age}
                    onClick={() => {
                      setQuizData(prev => ({ ...prev, childAge: age }));
                      setTimeout(() => goToScreen('trust'), 300);
                    }}
                  >
                    {age} years old
                  </OptionButton>
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 3 — TRUST
      case 'trust':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4 text-center">
                Trusted by Christian Families
              </h2>
              <p className="text-stone-600 text-center mb-6">
                Godly Kids is created by Christian storytellers and educators who care deeply about children's hearts.
              </p>
              <div className="bg-stone-50 rounded-2xl p-5 mb-8 space-y-3">
                {[
                  '✝️ Faith-centered content',
                  '🚫 No ads or junk media',
                  '👨‍👩‍👧 Designed for families who love Jesus'
                ].map((item, i) => (
                  <p key={i} className="text-stone-700 text-sm">{item}</p>
                ))}
              </div>
              <PrimaryButton onClick={() => goToScreen('pain')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 4 — PAIN
      case 'pain':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                Do you ever worry about what content is shaping your child's heart?
              </h2>
              <div className="space-y-3 mb-8">
                {['Yes, often', 'Sometimes', 'Not really'].map(option => (
                  <OptionButton
                    key={option}
                    selected={quizData.painLevel === option}
                    onClick={() => {
                      setQuizData(prev => ({ ...prev, painLevel: option }));
                      setTimeout(() => goToScreen('affirmation'), 300);
                    }}
                  >
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 5 — AFFIRMATION
      case 'affirmation':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="text-5xl mb-6">❤️</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                You're Not Alone
              </h2>
              <p className="text-stone-600 mb-3">
                Many parents want their children to grow strong in faith — not just entertained.
              </p>
              <p className="text-amber-700 font-medium mb-8">
                Your desire to guide your child's heart truly matters.
              </p>
              <PrimaryButton onClick={() => goToScreen('values')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 6 — VALUES
      case 'values':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-2 text-center">
                What matters most to you for your child?
              </h2>
              <p className="text-stone-500 text-center mb-6 text-sm">Select all that apply</p>
              <div className="space-y-3 mb-8">
                {[
                  'Growing closer to God',
                  'Learning kindness and empathy',
                  'Building confidence',
                  'Developing good character',
                  'Understanding right from wrong'
                ].map(value => (
                  <OptionButton
                    key={value}
                    selected={quizData.values.includes(value)}
                    onClick={() => handleValueToggle(value)}
                    multiSelect
                  >
                    {value}
                  </OptionButton>
                ))}
              </div>
              <PrimaryButton 
                onClick={() => goToScreen('values-reinforcement')}
                disabled={quizData.values.length === 0}
              >
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 7 — VALUES REINFORCEMENT
      case 'values-reinforcement':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="text-5xl mb-6">✨</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Beautiful Goals
              </h2>
              <p className="text-stone-600 mb-8">
                These are the seeds that shape a child's future — spiritually, emotionally, and socially.
              </p>
              <PrimaryButton onClick={() => goToScreen('screentime')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 8 — SCREEN TIME
      case 'screentime':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                How do you feel about your child's current screen time?
              </h2>
              <div className="space-y-3 mb-8">
                {[
                  "I'm concerned",
                  "I try to limit it, but it's hard",
                  "I wish there were better options",
                  "I feel okay about it"
                ].map(option => (
                  <OptionButton
                    key={option}
                    selected={quizData.screenTimeFeeling === option}
                    onClick={() => {
                      setQuizData(prev => ({ ...prev, screenTimeFeeling: option }));
                      setTimeout(() => goToScreen('empathy'), 300);
                    }}
                  >
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 9 — EMPATHY
      case 'empathy':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                That Makes Sense
              </h2>
              <p className="text-stone-600 mb-3">
                Modern parents are doing their best in a noisy digital world.
              </p>
              <p className="text-amber-700 font-medium mb-8">
                The challenge isn't screens — it's finding ones you can trust.
              </p>
              <PrimaryButton onClick={() => goToScreen('learning')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 10 — LEARNING STYLE
      case 'learning':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                How does your child learn best?
              </h2>
              <div className="space-y-3 mb-8">
                {[
                  'Through stories',
                  'Through listening',
                  'Through pictures and visuals',
                  'A mix of everything'
                ].map(option => (
                  <OptionButton
                    key={option}
                    selected={quizData.learningStyle === option}
                    onClick={() => {
                      setQuizData(prev => ({ ...prev, learningStyle: option }));
                      setTimeout(() => goToScreen('personalization'), 300);
                    }}
                  >
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 11 — PERSONALIZATION
      case 'personalization':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Great — This Helps Us Personalize Things
              </h2>
              <p className="text-stone-600 mb-3">
                Every child is different.
              </p>
              <p className="text-stone-600 mb-8">
                The best lessons meet them where they are.
              </p>
              <PrimaryButton onClick={() => goToScreen('faith-approach')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 12 — FAITH APPROACH
      case 'faith-approach':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                How do you want faith to feel for your child?
              </h2>
              <div className="space-y-3 mb-8">
                {[
                  'Joyful and loving',
                  'Gentle and encouraging',
                  'Meaningful and real',
                  'All of the above'
                ].map(option => (
                  <OptionButton
                    key={option}
                    selected={quizData.faithApproach === option}
                    onClick={() => {
                      setQuizData(prev => ({ ...prev, faithApproach: option }));
                      setTimeout(() => goToScreen('mission'), 300);
                    }}
                  >
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 13 — MISSION
      case 'mission':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="text-5xl mb-6">🙏</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                We Believe the Same
              </h2>
              <p className="text-stone-600 mb-8">
                Faith grows best when children experience God's love — not pressure or fear.
              </p>
              <PrimaryButton onClick={() => goToScreen('product-intro')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 14 — PRODUCT INTRO
      case 'product-intro':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                Here's How Godly Kids Helps
              </h2>
              <div className="space-y-4 mb-8">
                {[
                  { icon: '📖', text: 'Faith-filled animated stories' },
                  { icon: '💛', text: 'Gentle Christian lessons' },
                  { icon: '🎧', text: 'Audiobooks for quiet moments' },
                  { icon: '✅', text: 'Screen time you can trust' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-stone-100">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-stone-700 font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={() => goToScreen('social-proof')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 15 — SOCIAL PROOF
      case 'social-proof':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="text-5xl mb-6">👨‍👩‍👧‍👦</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Families Are Loving This
              </h2>
              <p className="text-stone-600 mb-8">
                Thousands of Christian parents are choosing Godly Kids to support their children's faith journey.
              </p>
              <div className="flex justify-center gap-1 mb-8">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>
              <PrimaryButton onClick={() => goToScreen('transformation')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 16 — TRANSFORMATION
      case 'transformation':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                Imagine This…
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-stone-100 rounded-2xl p-4">
                  <p className="text-stone-500 text-xs uppercase tracking-wide mb-3">Before</p>
                  <div className="space-y-2 text-sm text-stone-600">
                    <p>😟 Random shows</p>
                    <p>👀 Constant supervision</p>
                    <p>❓ Mixed messages</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-4 border-2 border-amber-200">
                  <p className="text-amber-700 text-xs uppercase tracking-wide mb-3">After</p>
                  <div className="space-y-2 text-sm text-amber-900">
                    <p>📚 Purposeful stories</p>
                    <p>✝️ Faith-based values</p>
                    <p>😌 Peace of mind</p>
                  </div>
                </div>
              </div>
              <PrimaryButton onClick={() => goToScreen('email')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 17 — EMAIL
      case 'email':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-2 text-center">
                Your Child's Faith Journey Is Ready
              </h2>
              <p className="text-stone-600 text-center mb-6">
                Enter your email to receive your personalized plan and access Godly Kids.
              </p>
              <input
                ref={emailInputRef}
                type="email"
                placeholder="Email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onBlur={() => setQuizData(prev => ({ ...prev, email: emailInput }))}
                className="w-full px-5 py-4 rounded-2xl border-2 border-stone-200 focus:border-amber-500 focus:ring-0 outline-none text-lg mb-4 transition-colors bg-white text-stone-800"
                autoComplete="email"
                id="parent-quiz-email"
                name="email"
              />
              <p className="text-stone-400 text-xs text-center mb-6">
                We respect your inbox. No spam. Unsubscribe anytime.
              </p>
              <PrimaryButton 
                onClick={() => {
                  setQuizData(prev => ({ ...prev, email: emailInput }));
                  goToScreen('processing');
                }}
                disabled={!emailInput || !emailInput.includes('@')}
              >
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 18 — PROCESSING
      case 'processing':
        return (
          <ScreenWrapper>
            <div className="px-6 py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Creating Your Child's Experience…
              </h2>
              <p className="text-stone-600 animate-pulse">
                {processingTexts[processingText]}
              </p>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 19 — OFFER INTRO
      case 'offer-intro':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="text-5xl mb-6">🎁</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                A Special Invitation for Your Family
              </h2>
              <p className="text-amber-700 font-semibold text-lg mb-8">
                Founding Families Receive a Limited-Time Discount
              </p>
              <PrimaryButton onClick={() => goToScreen('pricing')}>
                See My Offer
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 20 — PRICING
      case 'pricing':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl p-6 border-2 border-amber-300 mb-6">
                <p className="text-amber-700 text-sm font-semibold uppercase tracking-wide mb-2">
                  ✨ Founding Family Plan ✨
                </p>
                <p className="text-4xl font-bold text-stone-800 mb-1">
                  60% Off
                </p>
                <p className="text-stone-600 mb-4">
                  Limited time offer
                </p>
                <div className="bg-white/80 rounded-xl p-4 mb-4">
                  <p className="text-3xl font-bold text-amber-600">
                    $4.99<span className="text-lg text-stone-500 font-normal">/month</span>
                  </p>
                  <p className="text-stone-400 text-sm line-through">$12.99/month</p>
                </div>
                <p className="text-stone-500 text-sm">Cancel anytime</p>
              </div>
              <PrimaryButton onClick={() => goToScreen('faq')}>
                Start My Child's Faith Journey
              </PrimaryButton>
              <button 
                onClick={() => goToScreen('faq')}
                className="mt-4 text-stone-500 text-sm underline"
              >
                Have questions? See FAQ
              </button>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 21 — FAQ
      case 'faq':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4 mb-8">
                {[
                  { q: 'Is this biblically sound?', a: 'Yes. Content is rooted in Christian values and Scripture.' },
                  { q: 'Can I cancel anytime?', a: 'Yes — no contracts.' },
                  { q: 'Is this safe for my child?', a: 'No ads, no external links, no junk content.' },
                  { q: 'What ages is this for?', a: 'Designed for kids ages 3–12.' }
                ].map((faq, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
                    <p className="font-semibold text-stone-800 mb-2">{faq.q}</p>
                    <p className="text-stone-600 text-sm">{faq.a}</p>
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={() => goToScreen('confirmation')}>
                Start My Free Trial
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 22 — CONFIRMATION
      case 'confirmation':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                <Heart className="w-10 h-10 text-green-600" fill="#16a34a" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                You're Doing Something Beautiful
              </h2>
              <p className="text-stone-600 mb-8">
                Thank you for investing in your child's heart and faith.
              </p>
              <PrimaryButton onClick={() => goToScreen('deeplink')}>
                Continue to App
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // SCREEN 23 — DEEP LINK
      case 'deeplink':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Opening Godly Kids…
              </h2>
              <p className="text-stone-600 mb-8">
                Your child's faith journey begins now!
              </p>
              
              {/* App Store Links */}
              <div className="space-y-3 mb-6">
                <a
                  href="https://apps.apple.com/us/app/godly-kids-kid-bible-stories/id6737245412"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-black text-white font-bold rounded-2xl"
                >
                  📱 Download on iOS
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.godlykids.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-green-600 text-white font-bold rounded-2xl"
                >
                  🤖 Download on Android
                </a>
              </div>
              
              <button
                onClick={() => navigate('/home')}
                className="text-amber-600 font-medium underline"
              >
                Or continue on web →
              </button>
            </div>
          </ScreenWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      {/* Progress Bar */}
      {currentScreen !== 'hero' && currentScreen !== 'deeplink' && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-stone-200 z-50">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center">
        {renderScreen()}
      </div>

      {/* Godly Kids Branding */}
      <div className="fixed bottom-4 left-0 right-0 text-center">
        <p className="text-stone-400 text-xs">
          Godly Kids • Faith for Little Hearts
        </p>
      </div>
    </div>
  );
};

export default ParentQuizPage;

