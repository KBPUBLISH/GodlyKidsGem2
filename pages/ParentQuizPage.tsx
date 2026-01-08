import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronRight, ChevronDown, Loader2, Sparkles } from 'lucide-react';

// Quiz screen types - 26 screens in 5 sections
type Screen = 
  // Section 1: Entry & Safety
  | 'hero' | 'expectation' | 'child-age'
  // Section 2: Quiz Experience  
  | 'q-purpose' | 'q-grace' | 'q-rules' | 'q-faith' | 'q-identity'
  | 'midpoint' 
  | 'q-growth' | 'q-character' | 'q-deeper' | 'q-authority' | 'q-change' | 'q-god' | 'q-hope' | 'q-heart'
  // Section 3: Results
  | 'processing' | 'result' | 'ai-response'
  // Section 4: Email & Offer
  | 'email' | 'value-preview' | 'offer-intro' | 'paywall' | 'confirmation'
  // Section 5: App Handoff
  | 'deeplink';

interface QuizAnswers {
  childAge: string;
  purpose: string;
  grace: string;
  rules: string;
  faith: string;
  identity: string;
  growth: string;
  character: string;
  deeper: string;
  authority: string;
  change: string;
  god: string;
  hope: string;
  heart: string;
}

const ParentQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<Screen>('hero');
  const [answers, setAnswers] = useState<QuizAnswers>({
    childAge: '',
    purpose: '',
    grace: '',
    rules: '',
    faith: '',
    identity: '',
    growth: '',
    character: '',
    deeper: '',
    authority: '',
    change: '',
    god: '',
    hope: '',
    heart: ''
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [processingText, setProcessingText] = useState(0);
  const [emailInput, setEmailInput] = useState('');
  const [parentProfile, setParentProfile] = useState({ 
    title: '', 
    description: '', 
    styleName: '',
    feature: '', 
    featureDescription: '',
    featureEmoji: ''
  });
  const [aiResponse, setAiResponse] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const processingTexts = [
    'Reflecting on your responses...',
    'Identifying your parenting strengths...',
    'Preparing encouragement for your journey...'
  ];

  // Calculate parent profile based on answers
  const calculateProfile = () => {
    const heartCenteredCount = [
      answers.purpose === 'honored',
      answers.grace === 'understand',
      answers.rules === 'guiding',
      answers.faith === 'loves',
      answers.identity === 'becoming',
      answers.growth === 'gradual',
      answers.character === 'heart',
      answers.deeper === 'deeper',
      answers.authority === 'gentle',
      answers.change === 'relationship',
      answers.god === 'pray',
      answers.hope === 'very-hopeful',
      answers.heart === 'peace'
    ].filter(Boolean).length;

    if (heartCenteredCount >= 10) {
      return {
        title: "You're a Faithful, Heart-Aware Parent",
        styleName: "Faithful, Heart-Aware Parent",
        description: "Your answers show a deep desire to guide your child with love, patience, and faith — even when it feels hard. You care about more than behavior. You care about the heart.",
        feature: "Read-Along Bible Stories with Character Voices",
        featureDescription: "Stories that speak directly to the heart — with gentle narration and characters your child will love. Perfect for the parent who values deep, meaningful connection.",
        featureEmoji: "📖"
      };
    } else if (heartCenteredCount >= 7) {
      return {
        title: "You're a Growing, Intentional Parent",
        styleName: "Growing, Intentional Parent",
        description: "Your responses reveal someone who genuinely wants to connect heart-to-heart with their child. You're building something beautiful — trust, grace, and faith woven into everyday moments.",
        feature: "Daily Faith Lessons & Devotionals",
        featureDescription: "Short, structured lessons that fit naturally into your routine. Designed for parents building faith intentionally, one small moment at a time.",
        featureEmoji: "✨"
      };
    } else if (heartCenteredCount >= 4) {
      return {
        title: "You're a Caring, Committed Parent",
        styleName: "Caring, Committed Parent",
        description: "Parenting is hard, and your answers show you're in the thick of it. You care deeply, even when it feels overwhelming. That care is the foundation for something wonderful.",
        feature: "Peaceful Audiobooks & Worship Music",
        featureDescription: "Calm, soothing content for those chaotic moments. Let your child listen to Scripture-based stories while you catch your breath — without guilt.",
        featureEmoji: "🎧"
      };
    } else {
      return {
        title: "You're a Seeking, Honest Parent",
        styleName: "Seeking, Honest Parent",
        description: "Your willingness to reflect honestly is already a sign of strength. Every parent faces struggles — what matters is that you're here, seeking to grow alongside your child.",
        feature: "Gentle, Encouraging Story Collection",
        featureDescription: "Stories about grace, second chances, and God's unconditional love. Content that meets your family exactly where you are — no pressure, just hope.",
        featureEmoji: "💛"
      };
    }
  };

  // Generate AI response based on answers
  const generateAiResponse = () => {
    const profile = calculateProfile();
    setParentProfile(profile);
    
    // Generate personalized paragraphs based on answers
    let response = '';
    
    // Affirmation
    response += `The fact that you took time to reflect on your parenting shows something beautiful about your heart. In a world that rushes past quiet moments, you chose to pause and consider what really matters.\n\n`;
    
    // Reflection based on grace answer
    if (answers.grace === 'understand' || answers.grace === 'correct') {
      response += `Your instinct toward understanding when your child makes mistakes reflects God's own patience with us. Children learn best in an atmosphere of grace — where failure is a teacher, not a verdict.\n\n`;
    } else {
      response += `It's natural to feel frustrated when things go wrong. What matters is that you keep showing up, keep trying, keep loving. Your child sees that persistence, even if they can't name it yet.\n\n`;
    }
    
    // Gentle reframe based on hope answer
    if (answers.hope === 'very-hopeful' || answers.hope === 'mostly-hopeful') {
      response += `Your hopefulness is a gift to your child. Hope isn't naive — it's the confident expectation that God is working even when we can't see it. Hold onto that.\n\n`;
    } else {
      response += `If hope feels hard right now, that's okay. Seasons of uncertainty don't define your parenting — they refine it. The fact that you want more for your child proves something good is already growing.\n\n`;
    }
    
    // Hope paragraph
    response += `Remember: you're not just raising a child. You're shaping a soul that will impact generations. The small moments — the bedtime prayers, the patient corrections, the quiet cuddles — they all matter more than you know.\n\n`;
    
    // Soft transition
    response += `Many parents find that shared stories and gentle faith moments help these values grow naturally in their children's hearts.`;
    
    setAiResponse(response);
  };

  // Processing screen animation and submit quiz
  useEffect(() => {
    if (currentScreen === 'processing') {
      const interval = setInterval(() => {
        setProcessingText(prev => (prev + 1) % processingTexts.length);
      }, 1500);
      
      // Calculate profile
      setTimeout(() => {
        generateAiResponse();
      }, 2000);
      
      // Auto-advance after 4.5 seconds
      const timeout = setTimeout(() => {
        goToScreen('result');
      }, 4500);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [currentScreen]);

  // Submit email
  useEffect(() => {
    if (currentScreen === 'value-preview' && emailInput) {
      const submitQuiz = async () => {
        try {
          await fetch('https://backendgk2-0.onrender.com/api/parent-quiz/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailInput,
              quizData: {
                ...answers,
                email: emailInput,
                profile: parentProfile.title
              }
            })
          });
          console.log('📧 Quiz submitted');
        } catch (error) {
          console.error('Failed to submit quiz:', error);
        }
      };
      submitQuiz();
    }
  }, [currentScreen]);

  const goToScreen = (screen: Screen) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentScreen(screen);
      setIsAnimating(false);
      window.scrollTo(0, 0);
    }, 300);
  };

  const screenOrder: Screen[] = [
    'hero', 'expectation', 'child-age',
    'q-purpose', 'q-grace', 'q-rules', 'q-faith', 'q-identity',
    'midpoint',
    'q-growth', 'q-character', 'q-deeper', 'q-authority', 'q-change', 'q-god', 'q-hope', 'q-heart',
    'processing', 'result', 'ai-response',
    'email', 'value-preview', 'offer-intro', 'paywall', 'confirmation', 'deeplink'
  ];

  const currentIndex = screenOrder.indexOf(currentScreen);
  const progress = ((currentIndex) / (screenOrder.length - 1)) * 100;

  // Common button component
  const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = 
    ({ onClick, children, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  }> = ({ selected, onClick, children }) => (
    <button
      onClick={onClick}
      className={`w-full py-4 px-5 rounded-2xl border-2 transition-all duration-200 text-left ${
        selected 
          ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm' 
          : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/50'
      }`}
    >
      {children}
    </button>
  );

  // Screen wrapper with animation
  const ScreenWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
      {children}
    </div>
  );

  // Quiz question component
  const QuizQuestion: React.FC<{
    question: string;
    options: { value: string; label: string }[];
    answerKey: keyof QuizAnswers;
    nextScreen: Screen;
  }> = ({ question, options, answerKey, nextScreen }) => (
    <ScreenWrapper>
      <div className="px-6 py-8">
        <h2 className="text-xl font-semibold text-stone-800 mb-6 leading-relaxed">
          {question}
        </h2>
        <div className="space-y-3">
          {options.map(opt => (
            <OptionButton
              key={opt.value}
              selected={answers[answerKey] === opt.value}
              onClick={() => {
                setAnswers(prev => ({ ...prev, [answerKey]: opt.value }));
                setTimeout(() => goToScreen(nextScreen), 400);
              }}
            >
              {opt.label}
            </OptionButton>
          ))}
        </div>
      </div>
    </ScreenWrapper>
  );

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      // ==========================================
      // SECTION 1: ENTRY & SAFETY
      // ==========================================
      
      case 'hero':
        return (
          <ScreenWrapper>
            <div className="text-center px-6 py-12">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Heart className="w-10 h-10 text-amber-600" fill="#d97706" />
              </div>
              <h1 className="text-2xl font-bold text-stone-800 mb-4 leading-tight">
                How Does Your Parenting Style Compare to Heart-Centered Parenting?
              </h1>
              <p className="text-stone-600 text-lg mb-10 leading-relaxed">
                A short reflection to help you guide your child's heart — not just behavior.
              </p>
              <PrimaryButton onClick={() => goToScreen('expectation')}>
                Start the 2-Minute Parent Quiz
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'expectation':
        return (
          <ScreenWrapper>
            <div className="px-6 py-12 text-center">
              <div className="bg-amber-50 rounded-3xl p-8 mb-8 border border-amber-100">
                <p className="text-stone-700 text-lg leading-relaxed mb-4">
                  <span className="font-semibold">This isn't a test.</span><br />
                  There are no right or wrong answers.
                </p>
                <p className="text-stone-600 leading-relaxed">
                  Parenting is a journey, and this reflection is meant to <span className="text-amber-700 font-medium">encourage</span> — not judge.
                </p>
              </div>
              <PrimaryButton onClick={() => goToScreen('child-age')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'child-age':
        return (
          <QuizQuestion
            question="How old is your child?"
            options={[
              { value: '3-4', label: '3–4 years old' },
              { value: '5-6', label: '5–6 years old' },
              { value: '7-9', label: '7–9 years old' },
              { value: '10-12', label: '10–12 years old' }
            ]}
            answerKey="childAge"
            nextScreen="q-purpose"
          />
        );

      // ==========================================
      // SECTION 2: QUIZ EXPERIENCE
      // ==========================================

      case 'q-purpose':
        return (
          <QuizQuestion
            question="When you think about parenting, what feels most true right now?"
            options={[
              { value: 'honored', label: 'I feel honored by the responsibility' },
              { value: 'overwhelmed', label: "I feel overwhelmed but committed" },
              { value: 'unsure', label: "I feel unsure if I'm doing it right" },
              { value: 'surviving', label: "I'm mostly just getting through each day" }
            ]}
            answerKey="purpose"
            nextScreen="q-grace"
          />
        );

      case 'q-grace':
        return (
          <QuizQuestion
            question="When your child messes up, what's your first instinct?"
            options={[
              { value: 'understand', label: 'Help them understand and try again' },
              { value: 'correct', label: 'Correct them and move on' },
              { value: 'frustrated', label: 'Feel frustrated before calming down' },
              { value: 'worry', label: 'Worry about what this says about me' }
            ]}
            answerKey="grace"
            nextScreen="q-rules"
          />
        );

      case 'q-rules':
        return (
          <QuizQuestion
            question="Rules in our home are mostly about…"
            options={[
              { value: 'guiding', label: 'Guiding and protecting' },
              { value: 'order', label: 'Keeping order' },
              { value: 'chaos', label: 'Avoiding chaos' },
              { value: 'behavior', label: 'Making sure my child behaves well' }
            ]}
            answerKey="rules"
            nextScreen="q-faith"
          />
        );

      case 'q-faith':
        return (
          <QuizQuestion
            question="What do you most want your child to understand about God?"
            options={[
              { value: 'loves', label: 'That He loves them deeply' },
              { value: 'forgives', label: 'That He forgives and restores' },
              { value: 'daily', label: 'That faith is lived daily' },
              { value: 'right', label: 'That they should do the right thing' }
            ]}
            answerKey="faith"
            nextScreen="q-identity"
          />
        );

      case 'q-identity':
        return (
          <QuizQuestion
            question="When your child succeeds, you're most focused on…"
            options={[
              { value: 'becoming', label: 'Who they are becoming' },
              { value: 'effort', label: 'Their effort' },
              { value: 'results', label: 'Their results' },
              { value: 'others', label: 'What others will think' }
            ]}
            answerKey="identity"
            nextScreen="midpoint"
          />
        );

      case 'midpoint':
        return (
          <ScreenWrapper>
            <div className="px-6 py-12 text-center">
              <div className="text-5xl mb-6">💛</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                You're doing great.
              </h2>
              <p className="text-stone-600 mb-3 leading-relaxed">
                Many thoughtful parents pause to reflect like this.
              </p>
              <p className="text-amber-700 font-medium mb-8">
                Keep going — your responses help shape a meaningful result.
              </p>
              <PrimaryButton onClick={() => goToScreen('q-growth')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'q-growth':
        return (
          <QuizQuestion
            question="How do you feel about your child's spiritual growth?"
            options={[
              { value: 'gradual', label: "I trust it's a gradual journey" },
              { value: 'enough', label: "I hope we're doing enough" },
              { value: 'pressure', label: 'I feel pressure to see results' },
              { value: 'behind', label: "I worry we're falling behind" }
            ]}
            answerKey="growth"
            nextScreen="q-character"
          />
        );

      case 'q-character':
        return (
          <QuizQuestion
            question="Which matters more in daily life?"
            options={[
              { value: 'heart', label: 'Shaping the heart' },
              { value: 'responsibility', label: 'Teaching responsibility' },
              { value: 'behavior', label: 'Correct behavior' },
              { value: 'conflict', label: 'Avoiding conflict' }
            ]}
            answerKey="character"
            nextScreen="q-deeper"
          />
        );

      case 'q-deeper':
        return (
          <QuizQuestion
            question="When your child resists guidance, you tend to think…"
            options={[
              { value: 'deeper', label: "There's something deeper going on" },
              { value: 'testing', label: "They're testing boundaries" },
              { value: 'firmer', label: 'They need firmer rules' },
              { value: 'failing', label: "I'm failing as a parent" }
            ]}
            answerKey="deeper"
            nextScreen="q-authority"
          />
        );

      case 'q-authority':
        return (
          <QuizQuestion
            question="Your parenting style feels closest to…"
            options={[
              { value: 'gentle', label: 'Gentle and guiding' },
              { value: 'structured', label: 'Clear and structured' },
              { value: 'reactive', label: 'Reactive but caring' },
              { value: 'inconsistent', label: 'Inconsistent but loving' }
            ]}
            answerKey="authority"
            nextScreen="q-change"
          />
        );

      case 'q-change':
        return (
          <QuizQuestion
            question="Real change in my child usually comes from…"
            options={[
              { value: 'relationship', label: 'Relationship and trust' },
              { value: 'routines', label: 'Consistent routines' },
              { value: 'consequences', label: 'Consequences' },
              { value: 'time', label: 'Time and maturity' }
            ]}
            answerKey="change"
            nextScreen="q-god"
          />
        );

      case 'q-god':
        return (
          <QuizQuestion
            question="When parenting feels hard, you mostly…"
            options={[
              { value: 'pray', label: 'Pray and seek perspective' },
              { value: 'handle', label: 'Try to handle it myself' },
              { value: 'advice', label: 'Look for advice online' },
              { value: 'stuck', label: 'Feel stuck' }
            ]}
            answerKey="god"
            nextScreen="q-hope"
          />
        );

      case 'q-hope':
        return (
          <QuizQuestion
            question="Right now, how hopeful do you feel about your child's growth?"
            options={[
              { value: 'very-hopeful', label: 'Very hopeful' },
              { value: 'mostly-hopeful', label: 'Mostly hopeful' },
              { value: 'uncertain', label: 'Uncertain' },
              { value: 'discouraged', label: 'Discouraged' }
            ]}
            answerKey="hope"
            nextScreen="q-heart"
          />
        );

      case 'q-heart':
        return (
          <QuizQuestion
            question="Parenting often reveals that I value…"
            options={[
              { value: 'peace', label: 'Peace and connection' },
              { value: 'control', label: 'Control and order' },
              { value: 'approval', label: 'Approval from others' },
              { value: 'avoiding', label: 'Avoiding mistakes' }
            ]}
            answerKey="heart"
            nextScreen="processing"
          />
        );

      // ==========================================
      // SECTION 3: RESULTS & EMOTIONAL PAYOFF
      // ==========================================

      case 'processing':
        return (
          <ScreenWrapper>
            <div className="px-6 py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                {processingTexts[processingText]}
              </h2>
              <div className="flex justify-center gap-2 mt-8">
                {[0, 1, 2].map(i => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === processingText ? 'bg-amber-500 scale-125' : 'bg-stone-300'
                    }`} 
                  />
                ))}
              </div>
            </div>
          </ScreenWrapper>
        );

      case 'result':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <p className="text-amber-600 text-sm font-semibold uppercase tracking-wide mb-3">
                Your Result
              </p>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                {parentProfile.title || "You're a Faithful, Heart-Aware Parent"}
              </h2>
              <p className="text-stone-600 leading-relaxed mb-6">
                {parentProfile.description || "Your answers show a deep desire to guide your child with love, patience, and faith — even when it feels hard."}
              </p>
              
              {/* Feature Recommendation - The Key Tie-in */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 mb-8 border border-amber-200 text-left">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{parentProfile.featureEmoji || '📖'}</span>
                  <div>
                    <p className="text-stone-500 text-sm mb-1">Perfect for you:</p>
                    <p className="text-amber-800 font-bold text-lg">{parentProfile.feature || 'Read-Along Bible Stories'}</p>
                  </div>
                </div>
                <p className="text-stone-700 text-sm leading-relaxed mb-4">
                  Because you are a <span className="font-semibold text-amber-700">{parentProfile.styleName || 'Heart-Aware Parent'}</span>, your child would especially love the <span className="font-semibold">{parentProfile.feature || 'Read-Along Bible Stories'}</span> in Godly Kids.
                </p>
                <p className="text-stone-600 text-sm italic">
                  It matches exactly how you already lead your family.
                </p>
              </div>
              
              <PrimaryButton onClick={() => goToScreen('ai-response')}>
                See Your Full Reflection
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'ai-response':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100 mb-8">
                <h3 className="text-lg font-semibold text-stone-800 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-amber-600" fill="#d97706" />
                  A Word for Your Journey
                </h3>
                <div className="text-stone-700 leading-relaxed whitespace-pre-line text-[15px]">
                  {aiResponse}
                </div>
              </div>
              <PrimaryButton onClick={() => goToScreen('email')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // ==========================================
      // SECTION 4: EMAIL & OFFER
      // ==========================================

      case 'email':
        return (
          <div className="px-6 py-8">
            <h2 className="text-xl font-semibold text-stone-800 mb-3 text-center">
              Would you like resources that support heart-centered parenting?
            </h2>
            <p className="text-stone-600 text-center mb-6">
              Enter your email to receive your personalized plan.
            </p>
            <input
              type="email"
              placeholder="Email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailInput.includes('@')) {
                  goToScreen('value-preview');
                }
              }}
              className="w-full px-5 py-4 rounded-2xl border-2 border-stone-200 focus:border-amber-500 focus:ring-0 outline-none text-lg mb-3 transition-colors bg-white text-stone-800"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <p className="text-stone-400 text-xs text-center mb-6">
              No spam. Unsubscribe anytime.
            </p>
            <button
              onClick={() => goToScreen('value-preview')}
              disabled={!emailInput || !emailInput.includes('@')}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => goToScreen('value-preview')}
              className="w-full mt-4 text-stone-500 text-sm underline"
            >
              Skip for now
            </button>
          </div>
        );

      case 'value-preview':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              <h2 className="text-xl font-semibold text-stone-800 mb-6 text-center">
                How Godly Kids Helps
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
              <PrimaryButton onClick={() => goToScreen('offer-intro')}>
                Continue
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'offer-intro':
        return (
          <ScreenWrapper>
            <div className="px-6 py-12 text-center">
              <div className="text-5xl mb-6">🎁</div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                A Special Invitation for Your Family
              </h2>
              <p className="text-amber-700 font-semibold text-lg mb-8">
                Founding Families Receive a Limited-Time Discount
              </p>
              <PrimaryButton onClick={() => goToScreen('paywall')}>
                See My Offer
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      case 'paywall':
        const handleSubscribeClick = () => {
          // Store quiz data for tracking/personalization
          localStorage.setItem('godlykids_quiz_completed', 'true');
          localStorage.setItem('godlykids_quiz_profile', parentProfile.styleName || '');
          localStorage.setItem('godlykids_quiz_feature', parentProfile.feature || '');
          if (emailInput) {
            localStorage.setItem('godlykids_quiz_email', emailInput);
          }
          // Navigate to the actual Stripe paywall
          navigate('/paywall');
        };

        return (
          <ScreenWrapper>
            <div className="px-6 py-8">
              {/* Personalized Header */}
              <div className="text-center mb-6">
                <p className="text-stone-500 text-sm mb-2">Based on your parenting style:</p>
                <h2 className="text-xl font-bold text-stone-800">
                  Unlock <span className="text-amber-600">{parentProfile.feature || 'All Features'}</span>
                </h2>
                <p className="text-stone-600 text-sm mt-2">
                  Perfect for {parentProfile.styleName ? `a ${parentProfile.styleName}` : 'your family'}
                </p>
              </div>

              {/* Offer Card */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border-2 border-amber-200 mb-6 text-center">
                <p className="text-amber-700 text-sm font-semibold uppercase tracking-wide mb-2">
                  ✨ Founding Family Plan ✨
                </p>
                <div className="bg-white/80 rounded-xl p-4 my-4">
                  <p className="text-sm text-stone-500 mb-1">7-day free trial, then</p>
                  <div className="flex items-center justify-center gap-3">
                    <div>
                      <p className="text-2xl font-bold text-amber-600">$69/yr</p>
                      <p className="text-xs text-stone-400">~$5.75/month</p>
                    </div>
                    <span className="text-stone-300">or</span>
                    <div>
                      <p className="text-2xl font-bold text-stone-700">$9.99/mo</p>
                      <p className="text-xs text-stone-400">cancel anytime</p>
                    </div>
                  </div>
                </div>
                <p className="text-stone-500 text-sm">Cancel anytime • No commitment</p>
              </div>

              <button
                onClick={handleSubscribeClick}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-lg rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
              >
                🎓 Start 7-Day Free Trial
                <ChevronRight className="w-5 h-5" />
              </button>

              <p className="text-center text-stone-400 text-xs mb-6">
                You won't be charged during your free trial
              </p>

              {/* FAQ Accordion */}
              <div className="space-y-2">
                {[
                  { q: 'Is this biblically grounded?', a: 'Yes. All content is rooted in Scripture and Christian values, created by believers who love Jesus.' },
                  { q: 'Is it safe for my child?', a: 'Absolutely. No ads, no external links, no inappropriate content. Just faith-filled stories and activities.' },
                  { q: 'Can I cancel anytime?', a: 'Yes — no contracts, no commitments. Cancel with one tap whenever you want.' },
                  { q: 'What ages is this for?', a: 'Designed for kids ages 3-12, with content tailored for different developmental stages.' }
                ].map((faq, i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                    >
                      <span className="text-stone-700 font-medium text-sm">{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-3">
                        <p className="text-stone-600 text-sm">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Skip option */}
              <button
                onClick={() => navigate('/home')}
                className="w-full mt-6 text-stone-400 text-sm underline"
              >
                Maybe later — explore free content
              </button>
            </div>
          </ScreenWrapper>
        );

      case 'confirmation':
        return (
          <ScreenWrapper>
            <div className="px-6 py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                <Heart className="w-10 h-10 text-white" fill="white" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                You're investing in something that truly matters.
              </h2>
              <p className="text-stone-600 mb-8 leading-relaxed">
                Thank you for choosing to guide your child's heart with intention and love.
              </p>
              <PrimaryButton onClick={() => goToScreen('deeplink')}>
                Open Godly Kids App
              </PrimaryButton>
            </div>
          </ScreenWrapper>
        );

      // ==========================================
      // SECTION 5: APP HANDOFF
      // ==========================================

      case 'deeplink':
        return (
          <ScreenWrapper>
            <div className="px-6 py-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-4">
                Your Child's Faith Journey Begins Now
              </h2>
              <p className="text-stone-600 mb-8">
                Download the app to get started!
              </p>
              
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
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50/30">
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
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center py-8">
        {renderScreen()}
      </div>

      {/* Branding */}
      <div className="fixed bottom-4 left-0 right-0 text-center pointer-events-none">
        <p className="text-stone-400 text-xs">
          Godly Kids • Faith for Little Hearts
        </p>
      </div>
    </div>
  );
};

export default ParentQuizPage;
