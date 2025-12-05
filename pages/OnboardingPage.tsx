import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Plus, Trash2, UserCircle, Mic, X, ChevronDown, ChevronUp, BookOpen, Music, Sparkles, Users, Loader2, Lock, Crown, ClipboardList } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { useSubscription } from '../context/SubscriptionContext';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';
import ParentGateModal from '../components/features/ParentGateModal';
// Voice cloning removed - not offering this feature anymore
import { ApiService } from '../services/apiService';
import { filterVisibleVoices } from '../services/voiceManagementService';
import { cleanVoiceDescription, cleanVoiceCategory } from '../utils/voiceUtils';

// Use Funny Heads instead of generic human seeds
const FUNNY_HEADS = [
  'head-toast',
  'head-burger',
  'head-cookie',
  'head-tv',
  'head-slime',
  'head-pumpkin',
  'head-earth',
  'head-moon',
  'head-bomb',
  'head-eye',
  'head-bear-brown',
  'head-bear-polar',
  'head-bear-aviator',
  'head-dog-pug',
  'head-dog-dalmatian',
  'head-cat-orange',
  'head-cat-black',
  'head-lizard'
];

// Benefits carousel data - Education focused for Academy
const BENEFITS = [
  { icon: '📚', title: 'Bible Curriculum', desc: 'Complete Christian education' },
  { icon: '✝️', title: 'Scripture Memory', desc: 'Learn verses through play' },
  { icon: '🎓', title: 'Homeschool Ready', desc: 'Perfect supplement for ages 4-10+' },
  { icon: '🏠', title: 'Family Learning', desc: 'Grow in faith together' },
];

// What's included accordion items - Academy focused
const INCLUDED_ITEMS = [
  { icon: BookOpen, label: 'Bible Story Library', desc: 'Animated lessons & devotionals' },
  { icon: Music, label: 'Audio Learning Center', desc: 'Scripture songs & audiobooks' },
  { icon: Sparkles, label: 'Interactive Quizzes', desc: 'Test comprehension & earn rewards' },
  { icon: Mic, label: 'Read-Along Narration', desc: 'Multiple voices to choose from' },
  { icon: Users, label: 'Family Profiles (Up to 5)', desc: 'Each child gets their own progress' },
  { icon: ClipboardList, label: 'Report Cards', desc: 'Track learning & earning for each kid' },
];

// PaywallStep Component
const PaywallStep: React.FC<{
  selectedPlan: 'annual' | 'monthly';
  setSelectedPlan: (plan: 'annual' | 'monthly') => void;
  onSubscribe: (email: string) => void;
  onSkip: () => void;
  onRestore: (email?: string) => void;
  isPurchasing?: boolean;
  isRestoring?: boolean;
  error?: string | null;
  kidsCount?: number; // Number of kids added during onboarding
}> = ({ selectedPlan, setSelectedPlan, onSubscribe, onSkip, onRestore, isPurchasing = false, isRestoring = false, error = null, kidsCount = 0 }) => {
  const [showIncluded, setShowIncluded] = useState(true); // Open by default so users see features
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentBenefit, setCurrentBenefit] = useState(0);
  
  // Account creation state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showRestoreInput, setShowRestoreInput] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    if (!email.trim() || !isValidEmail(email)) return false;
    if (!password || password.length < 6) return false;
    if (password !== confirmPassword) return false;
    return true;
  };

  const getFormError = () => {
    if (!email.trim()) return null; // Don't show error if empty
    if (!isValidEmail(email)) return 'Please enter a valid email address';
    if (password && password.length < 6) return 'Password must be at least 6 characters';
    if (confirmPassword && password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  // Auto-scroll benefits carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBenefit(prev => (prev + 1) % BENEFITS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-md px-4 animate-in slide-in-from-right-10 duration-500 pb-10">
      
      {/* Hero Badge */}
      <div className="text-center mb-4">
        <div className="inline-block bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-5 py-2 rounded-full animate-pulse shadow-lg">
          <span className="text-[#3E1F07] font-extrabold text-base">🎁 3-DAY FREE TRIAL</span>
        </div>
      </div>

      {/* Personalized Kids Message - Show if they added multiple kids */}
      {kidsCount > 1 && (
        <div className="bg-gradient-to-br from-[#3E1F07] to-[#5c2e0b] rounded-2xl p-4 mb-4 border-2 border-[#FFD700]/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#FF6B6B] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
            ACTION REQUIRED
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-12 h-12 bg-[#FFD700]/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-[#FFD700]" />
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-1">
                You added <span className="text-[#FFD700]">{kidsCount} kids</span>! 🎉
              </p>
              <p className="text-[#eecaa0] text-xs">
                Free accounts get <span className="font-bold">1 profile</span>. Subscribe to unlock all {kidsCount} profiles with individual progress tracking & rewards.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Payment Card - UP FRONT */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-[#FFD700] mb-5">
        
        {/* Quick Tagline */}
        <h2 className="text-[#3E1F07] font-display font-extrabold text-xl text-center mb-1">
          Unlock Everything
        </h2>
        <p className="text-[#8B4513] text-xs text-center mb-4">
          100% ad-free • Cancel anytime
        </p>

        {/* Pricing Options */}
        <div className="space-y-2 mb-4">
          {/* Annual Option */}
          <div 
            onClick={() => setSelectedPlan('annual')}
            className={`relative w-full rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
              selectedPlan === 'annual' 
                ? 'bg-[#fff8e1] border-[#FFD700] shadow-md scale-[1.02]' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="absolute top-0 right-0 bg-[#4CAF50] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg">
              BEST VALUE
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'annual' ? 'bg-[#FFD700] border-[#FFD700]' : 'border-gray-300'}`}>
                  {selectedPlan === 'annual' && <Check size={12} className="text-[#3E1F07]" strokeWidth={4} />}
                </div>
                <div className="text-left">
                  <span className="font-display font-bold text-sm text-[#3E1F07]">Annual</span>
                  <span className="text-[10px] text-[#4CAF50] font-semibold block">Save 42% • $1.33/week</span>
                </div>
              </div>
              <span className="font-display font-extrabold text-xl text-[#3E1F07]">$69<span className="text-xs font-normal">/yr</span></span>
            </div>
          </div>

          {/* Monthly Option */}
          <div 
            onClick={() => setSelectedPlan('monthly')}
            className={`relative w-full rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
              selectedPlan === 'monthly' 
                ? 'bg-[#fff8e1] border-[#FFD700] shadow-md scale-[1.02]' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === 'monthly' ? 'bg-[#FFD700] border-[#FFD700]' : 'border-gray-300'}`}>
                  {selectedPlan === 'monthly' && <Check size={12} className="text-[#3E1F07]" strokeWidth={4} />}
                </div>
                <div className="text-left">
                  <span className="font-display font-bold text-sm text-[#3E1F07]">Monthly</span>
                  <span className="text-[10px] text-[#8B4513] block">Flexible billing</span>
                </div>
              </div>
              <span className="font-display font-extrabold text-xl text-[#3E1F07]">$9.99<span className="text-xs font-normal">/mo</span></span>
            </div>
          </div>
        </div>

        {/* Account Creation Section */}
        <div className="mb-4 space-y-3">
          <h3 className="text-[#3E1F07] text-sm font-bold">Create Your Account</h3>
          
          {/* Email */}
          <div>
            <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
              placeholder="your@email.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
            />
          </div>
          
          {/* Password */}
          <div>
            <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
            />
          </div>
          
          {/* Confirm Password */}
          <div>
            <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFormError(null); }}
              placeholder="Re-enter password"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
            />
          </div>
          
          {/* Form Error */}
          {getFormError() && (
            <p className="text-red-500 text-xs">{getFormError()}</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
            {error}
          </div>
        )}

        {/* CTA Button */}
        <WoodButton 
          fullWidth 
          variant="gold"
          onClick={() => {
            if (!isFormValid()) {
              setFormError(getFormError() || 'Please fill in all fields correctly');
              return;
            }
            onSubscribe(email);
          }}
          disabled={isPurchasing || !isFormValid()}
          className="py-4 text-lg shadow-xl mb-2 border-b-4 border-[#B8860B] disabled:opacity-50"
        >
          {isPurchasing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : (
            '🎁 START FREE TRIAL'
          )}
        </WoodButton>
        
        <p className="text-[#5c2e0b] text-[10px] text-center opacity-70">
          No charge until trial ends
        </p>

        {/* Restore Purchases */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          {!showRestoreInput ? (
            <button
              onClick={() => setShowRestoreInput(true)}
              className="w-full text-[#8B4513] text-sm font-medium py-2 hover:underline"
            >
              Already subscribed? Restore Purchases
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[#5D4037] text-xs font-medium text-center">Enter your subscription email:</p>
              <input
                type="email"
                value={restoreEmail}
                onChange={(e) => setRestoreEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRestoreInput(false); setRestoreEmail(''); }}
                  className="flex-1 px-3 py-2 text-[#8B4513] text-sm font-medium border border-[#8B4513] rounded-lg hover:bg-[#8B4513]/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (isValidEmail(restoreEmail)) {
                      onRestore(restoreEmail);
                    } else {
                      setFormError('Please enter a valid email');
                    }
                  }}
                  disabled={isRestoring || !restoreEmail.trim()}
                  className="flex-1 px-3 py-2 bg-[#8B4513] text-white text-sm font-semibold rounded-lg hover:bg-[#A0522D] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Restore'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {formError && (
          <p className="text-red-500 text-xs text-center mt-2">{formError}</p>
        )}
      </div>

      {/* What's Included Accordion */}
      <div className="bg-gradient-to-br from-[#3E1F07] to-[#5c2e0b] rounded-2xl border border-[#8B4513] overflow-hidden mb-5">
        <button
          onClick={() => setShowIncluded(!showIncluded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[#FFD700] text-lg">✨</span>
            <span className="text-white font-bold text-sm">What's Included</span>
          </div>
          {showIncluded ? (
            <ChevronUp className="w-5 h-5 text-[#FFD700]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#FFD700]" />
          )}
        </button>
        
        {/* Accordion Content */}
        <div className={`overflow-hidden transition-all duration-300 ${showIncluded ? 'max-h-[400px]' : 'max-h-0'}`}>
          <div className="px-4 pb-4 space-y-2">
            {INCLUDED_ITEMS.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-[#FFD700]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">{item.label}</p>
                  <p className="text-[#eecaa0] text-[10px]">{item.desc}</p>
                </div>
                <Check className="w-4 h-4 text-[#4CAF50] flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Carousel */}
      <div className="mb-5">
        <div className="overflow-hidden">
          <div 
            ref={carouselRef}
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentBenefit * 100}%)` }}
          >
            {BENEFITS.map((benefit, idx) => (
              <div key={idx} className="w-full flex-shrink-0 px-2">
                <div className="bg-gradient-to-br from-[#FFD700]/20 to-[#FFA500]/10 rounded-xl p-4 border border-[#FFD700]/30 text-center">
                  <div className="text-4xl mb-2">{benefit.icon}</div>
                  <h3 className="text-white font-bold text-base mb-1">{benefit.title}</h3>
                  <p className="text-[#eecaa0] text-xs">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Carousel Dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {BENEFITS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentBenefit(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                currentBenefit === idx 
                  ? 'bg-[#FFD700] w-4' 
                  : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scripture Quote */}
      <div className="text-center mb-5 px-4">
        <p className="text-white/80 text-xs italic">
          "Train up a child in the way he should go"
        </p>
        <p className="text-[#FFD700] text-[10px] font-semibold mt-1">— Proverbs 22:6</p>
      </div>

      {/* Skip Link */}
      <div className="text-center">
        <button 
          onClick={onSkip}
          className="text-white/50 text-xs underline decoration-dotted hover:text-white/80"
        >
          Continue with limited access
        </button>
        <p className="text-white/30 text-[10px] mt-3">
          Loved by 10,000+ Christian families 🙏
        </p>
      </div>
    </div>
  );
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setParentName, setEquippedAvatar, addKid, kids, removeKid, subscribe, resetUser, unlockVoice } = useUser();
  const { playClick, playSuccess } = useAudio();
  const { purchase, isLoading: isSubscriptionLoading, isPremium } = useSubscription();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // Steps: 1=Parent, 2=Family, 3=Voice Selection, 4=Unlock
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  
  // Track if user subscribed during family step (to skip final paywall)
  const [subscribedDuringOnboarding, setSubscribedDuringOnboarding] = useState(false);
  // For inline family step purchase
  const [showFamilyParentGate, setShowFamilyParentGate] = useState(false);
  const [familyPurchaseError, setFamilyPurchaseError] = useState<string | null>(null);
  const [isFamilyPurchasing, setIsFamilyPurchasing] = useState(false);

  // Step 1 State (Parent)
  const [pName, setPName] = useState('');
  const [pAvatar, setPAvatar] = useState(FUNNY_HEADS[0]);

  // Step 2 State (Kid Entry)
  const [kidName, setKidName] = useState('');
  const [kidAge, setKidAge] = useState('');
  const [kidAvatar, setKidAvatar] = useState(FUNNY_HEADS[1]);
  
  // Step 3 State (Voice Selection)
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  
  // Step 4 State (Paywall)
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  

  // Reset user data when entering onboarding to ensure a fresh start
  useEffect(() => {
    if (resetUser && typeof resetUser === 'function') {
      resetUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS ---

  const handleStep1Submit = () => {
    if (!pName.trim()) return;
    playClick();
    setParentName(pName);
    setEquippedAvatar(pAvatar);
    setStep(2);
  };

  const handleAddKid = () => {
    if (!kidName.trim()) return;
    playSuccess();
    // Create kid with their own fully initialized data - completely separate from parent
    addKid({
      id: Date.now().toString(),
      name: kidName,
      age: kidAge ? parseInt(kidAge, 10) : undefined,
      avatarSeed: kidAvatar,
      // Initialize kid's own economy data
      coins: 500, // Kids start with 500 coins
      coinTransactions: [],
      ownedItems: ['f1', 'anim1'], // Default owned items
      unlockedVoices: [],
      // Initialize kid's avatar to their selected head - separate from parent
      avatar: kidAvatar,
      frame: 'border-[#8B4513]',
      hat: null,
      body: null,
      leftArm: null,
      rightArm: null,
      legs: null,
      animation: 'anim-breathe',
    });
    // Reset inputs for next kid
    setKidName('');
    setKidAge('');
    setKidAvatar(FUNNY_HEADS[Math.floor(Math.random() * FUNNY_HEADS.length)]);
  };

  const handleStep2Continue = () => {
    playClick();
    // Go to voice selection step
    setStep(3);
  };
  
  // Free tier allows only 1 kid account, but let users add all kids during onboarding
  // They'll see the paywall at the end showing how many kids they added
  const FREE_KID_LIMIT = 1;
  const MAX_KIDS = 5;
  const canAddMoreKids = kids.length < MAX_KIDS; // Always allow up to 5 kids
  
  // Handle inline subscribe from family step
  const handleFamilyUnlockClick = () => {
    setShowFamilyParentGate(true);
  };
  
  const handleFamilyGateSuccess = async () => {
    setShowFamilyParentGate(false);
    setIsFamilyPurchasing(true);
    setFamilyPurchaseError(null);
    
    try {
      // Default to annual plan for family unlock
      const result = await purchase('annual');
      
      if (result.success) {
        playSuccess();
        subscribe();
        setSubscribedDuringOnboarding(true);
        // Stay on Step 2 - user can now add more kids
      } else {
        setFamilyPurchaseError(result.error || 'Purchase was cancelled');
      }
    } catch (error: any) {
      console.error('Family purchase error:', error);
      setFamilyPurchaseError(error.message || 'An error occurred during purchase');
    } finally {
      setIsFamilyPurchasing(false);
    }
  };
  
  // Load available voices for step 3
  useEffect(() => {
    if (step === 3) {
      setLoadingVoices(true);
      ApiService.getVoices()
        .then(voices => {
          const visibleVoices = filterVisibleVoices(voices);
          setAvailableVoices(visibleVoices);
          // Auto-select first voice if available
          if (visibleVoices.length > 0 && !selectedVoiceId) {
            setSelectedVoiceId(visibleVoices[0].voice_id);
          }
        })
        .catch(error => {
          console.error('Error loading voices:', error);
        })
        .finally(() => {
          setLoadingVoices(false);
        });
    }
  }, [step]);
  
  const handleStep3Continue = () => {
    if (!selectedVoiceId) return;
    playClick();
    // Stop any playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      setPreviewAudio(null);
    }
    // Save selected voice preference and unlock it
    localStorage.setItem('godlykids_default_voice', selectedVoiceId);
    unlockVoice(selectedVoiceId); // Unlock the selected voice for free
    console.log(`🎤 Onboarding: Unlocked voice ${selectedVoiceId}`);
    
    // ONLY skip paywall if subscribed during THIS onboarding session
    if (subscribedDuringOnboarding) {
      playSuccess();
      navigate('/home');
    } else {
      setStep(4); // Go to unlock/paywall step
    }
  };
  
  const handleVoiceClick = async (voiceId: string) => {
    playClick();
    setSelectedVoiceId(voiceId);
    
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      setPreviewAudio(null);
    }
    
    // Generate and play preview
    setPreviewingVoiceId(voiceId);
    try {
      const previewText = "Hello Godly Kid! Are you ready for an adventure?[chuckle]";
      const result = await ApiService.generateTTS(previewText, voiceId);
      
      if (result && result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        
        audio.onended = () => {
          setPreviewingVoiceId(null);
          setPreviewAudio(null);
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e, 'URL:', result.audioUrl);
          setPreviewingVoiceId(null);
          setPreviewAudio(null);
        };
        
        // Wait for audio to be ready before playing
        audio.oncanplaythrough = async () => {
          try {
            await audio.play();
          } catch (playError: any) {
            console.error('Error playing audio:', playError);
            setPreviewingVoiceId(null);
            setPreviewAudio(null);
          }
        };
        
        audio.onloadstart = () => {
          // Audio is loading
        };
        
        setPreviewAudio(audio);
      } else {
        console.error('No audio URL returned from TTS generation');
        setPreviewingVoiceId(null);
      }
    } catch (error) {
      console.error('Error playing voice preview:', error);
      setPreviewingVoiceId(null);
    }
  };
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const handleSubscribeClick = (email: string) => {
    setUserEmail(email);
    setShowParentGate(true);
  };

  const handleRestorePurchases = async (restoreEmail?: string) => {
    setIsRestoring(true);
    setPurchaseError(null);
    
    try {
      // First, check old backend for subscription by email
      if (restoreEmail) {
        console.log('🔍 Checking old backend for subscription:', restoreEmail);
        
        const migrationResponse = await fetch(`${import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com'}/api/migration/restore-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: restoreEmail }),
        });
        
        const migrationResult = await migrationResponse.json();
        console.log('📦 Migration result:', migrationResult);
        
        if (migrationResult.success && migrationResult.subscriptionRestored) {
          playSuccess();
          localStorage.setItem('godlykids_premium', 'true');
          localStorage.setItem('godlykids_user_email', restoreEmail);
          setSubscribedDuringOnboarding(true);
          navigate('/home');
          return;
        }
      }
      
      // Then try RevenueCat restore
      const { restorePurchases } = await import('../services/revenueCatService').then(m => ({ restorePurchases: m.default.restorePurchases }));
      const result = await restorePurchases();
      
      if (result.success && result.isPremium) {
        playSuccess();
        if (restoreEmail) {
          localStorage.setItem('godlykids_user_email', restoreEmail);
        }
        setSubscribedDuringOnboarding(true);
        navigate('/home');
      } else {
        setPurchaseError('No active subscription found with that email. Start a new subscription below.');
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      setPurchaseError('Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };


  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setPurchaseError(null);
    
    // Store user email immediately (non-blocking)
    if (userEmail) {
      localStorage.setItem('godlykids_user_email', userEmail);
      console.log('📧 Stored user email:', userEmail);
    }
    
    try {
      // Trigger actual RevenueCat/Apple in-app purchase
      console.log('🛒 Starting purchase for plan:', selectedPlan);
      const result = await purchase(selectedPlan);
      console.log('🛒 Purchase result:', result);
      
      if (result.success) {
        // Navigate IMMEDIATELY - don't wait for any processing
        playSuccess();
        
        // Update state synchronously  
        subscribe();
        setSubscribedDuringOnboarding(true);
        localStorage.setItem('godlykids_premium', 'true');
        
        // Navigate right away!
        navigate('/home');
        
        // Any additional setup can happen in background after navigation
        // The home page will pick up the premium status from localStorage
      } else {
        // Purchase was cancelled or failed
        setPurchaseError(result.error || 'Purchase was cancelled');
        setIsPurchasing(false);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      setPurchaseError(error.message || 'An error occurred during purchase');
      setIsPurchasing(false);
    }
  };


  // --- RENDERERS ---

  const renderProgress = () => {
    const totalSteps = 4; // Parent, Family, Voice Selection, Unlock
    return (
    <div className="w-full max-w-md px-8 mb-8">
       <div className="flex justify-between mb-2 text-[#eecaa0] font-display font-bold text-xs uppercase tracking-widest">
          <span className={step >= 1 ? "text-[#FFD700]" : "opacity-50"}>Parent</span>
          <span className={step >= 2 ? "text-[#FFD700]" : "opacity-50"}>Family</span>
          <span className={step >= 3 ? "text-[#FFD700]" : "opacity-50"}>Voice</span>
          <span className={step >= 4 ? "text-[#FFD700]" : "opacity-50"}>Unlock</span>
       </div>
       <div className="h-3 bg-[#3E1F07] rounded-full overflow-hidden border border-[#5c2e0b] shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-[#FFD700] to-[#ffb300] transition-all duration-500 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
       </div>
    </div>
    );
  };

  // Helper for rendering internal avatar asset
  const renderAvatarAsset = (headKey: string) => {
    const isInternalHead = headKey.startsWith('head-');
    if (isInternalHead && AVATAR_ASSETS[headKey]) {
      return (
        <div className="w-[90%] h-[90%]">
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
            {AVATAR_ASSETS[headKey]}
          </svg>
        </div>
      );
    }
    return (
      <img src={headKey} alt="avatar" className="w-full h-full object-cover" />
    );
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar bg-[#0f172a]">
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
          <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-[#0ea5e9]/20 to-transparent"></div>
      </div>

      {/* HEADER */}
      <div className="relative z-20 pt-6 px-6 flex items-center justify-between">
         {step > 1 && (
           <button onClick={() => setStep(prev => (prev - 1) as any)} className="text-[#eecaa0] hover:text-white transition-colors">
              <ChevronLeft size={32} />
           </button>
         )}
         {step === 1 && <div className="w-8"></div>} {/* Spacer */}
         
         <div className="flex flex-col items-center">
             <h1 className="font-display font-extrabold text-2xl text-white tracking-wide drop-shadow-md">
                 SETUP
             </h1>
         </div>
         
         <div className="w-8"></div> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col items-center pt-6 pb-10 w-full relative z-10">
        
        {renderProgress()}

        {/* --- STEP 1: PARENT PROFILE --- */}
        {step === 1 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
             
             {/* Clarification Banner */}
             <div className="bg-[#eecaa0]/20 rounded-lg p-3 mb-6 flex items-center gap-3 border border-[#eecaa0]/30">
                 <div className="bg-[#FFD700] rounded-full p-1.5 text-[#5c2e0b]">
                     <UserCircle size={20} />
                 </div>
                 <p className="text-[#eecaa0] text-sm font-bold">
                     Step 1: Create the <span className="text-white">Parent Profile</span>
                 </p>
             </div>

             {/* Avatar Picker */}
             <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 rounded-full border-[6px] border-white shadow-[0_0_30px_rgba(255,255,255,0.2)] bg-[#f3e5ab] mb-6 relative overflow-hidden flex items-center justify-center">
                     <div className="w-[90%] h-[90%] flex items-center justify-center">
                         {renderAvatarAsset(pAvatar)}
                     </div>
                </div>
                
                <div className="w-full overflow-x-auto no-scrollbar pb-2">
                  <div className="flex gap-3 justify-center min-w-min px-2">
                    {FUNNY_HEADS.map((head) => (
                      <button
                        key={head}
                        onClick={() => setPAvatar(head)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 p-1 bg-[#f3e5ab] flex items-center justify-center ${pAvatar === head ? 'border-[#FFD700] scale-110 ring-2 ring-[#FFD700]/50' : 'border-white/20 opacity-60 hover:opacity-100'}`}
                      >
                          {renderAvatarAsset(head)}
                      </button>
                    ))}
                  </div>
                </div>
             </div>

             {/* Name Input */}
             <div className="bg-[#3E1F07] p-6 rounded-2xl border-2 border-[#5c2e0b] shadow-xl">
                 <label className="block text-[#eecaa0] font-display font-bold text-sm tracking-wide mb-2 uppercase">
                   Parent Name
                 </label>
                 <input 
                    type="text" 
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="e.g. Mom, Dad"
                    className="w-full bg-black/30 border-2 border-[#8B4513] rounded-xl px-4 py-3 text-white font-display text-lg placeholder:text-white/30 focus:outline-none focus:border-[#FFD700] transition-colors text-center"
                    autoFocus
                 />
             </div>

             <div className="mt-8">
                <WoodButton 
                  fullWidth 
                  onClick={handleStep1Submit} 
                  disabled={!pName.trim()}
                  className={`py-4 text-xl ${!pName.trim() ? 'opacity-50 grayscale' : ''}`}
                >
                   NEXT: FAMILY
                </WoodButton>
             </div>
          </div>
        )}

        {/* --- STEP 2: ADD KIDS --- */}
        {step === 2 && (
           <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500 flex flex-col h-full">
              
              <div className="text-center mb-6">
                 <h2 className="text-white font-display font-bold text-xl">Who is adventuring?</h2>
                 <p className="text-[#eecaa0] text-sm">Create profiles for your children.</p>
                 {subscribedDuringOnboarding && (
                   <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-[#FFD700]/20 rounded-full text-[#FFD700] text-xs font-bold">
                     <Crown size={12} /> Premium - Unlimited Kids
                   </div>
                 )}
              </div>

              {/* Added Kids List */}
              <div className="space-y-3 mb-6">
                  {kids.map((kid, index) => (
                      <div key={kid.id} className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center justify-between border border-white/10 animate-in zoom-in">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-[#f3e5ab] overflow-hidden border-2 border-white/50 flex items-center justify-center p-1">
                                   {renderAvatarAsset(kid.avatarSeed)}
                              </div>
                              <div>
                                  <h3 className="text-white font-bold font-display text-lg">{kid.name}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#eecaa0] text-xs font-bold">{kid.age} years old</span>
                                    {/* Show FREE or PREMIUM badge */}
                                    {index === 0 ? (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#4CAF50] text-white">FREE</span>
                                    ) : (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b]">PREMIUM</span>
                                    )}
                                  </div>
                              </div>
                          </div>
                          <button onClick={() => removeKid(kid.id)} className="w-8 h-8 bg-red-500/20 text-red-300 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>

              {/* Add Kid Form - Always show if under max kids */}
              {canAddMoreKids ? (
                <div className="bg-[#3E1F07] p-5 rounded-2xl border-2 border-[#5c2e0b] shadow-xl mb-6 relative overflow-hidden">
                   {/* Badge shows FREE for first kid, PREMIUM REQUIRED for additional */}
                   <div className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg ${
                     kids.length === 0 
                       ? 'bg-[#4CAF50] text-white' 
                       : 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b]'
                   }`}>
                     {kids.length === 0 ? '✓ FREE PROFILE' : '👑 PREMIUM'}
                   </div>
                   
                   <div className="flex gap-4 mb-4">
                      <div className="w-20 shrink-0 flex flex-col gap-2">
                          <div 
                             className="w-20 h-20 rounded-xl bg-[#f3e5ab] border-2 border-[#8B4513] overflow-hidden relative cursor-pointer hover:opacity-90 flex items-center justify-center p-2"
                             onClick={() => setKidAvatar(FUNNY_HEADS[Math.floor(Math.random() * FUNNY_HEADS.length)])}
                          >
                               {renderAvatarAsset(kidAvatar)}
                               <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-0.5">TAP</div>
                          </div>
                      </div>
                      <div className="flex-1 space-y-3">
                          <input 
                              type="text" 
                              placeholder="Child's Name"
                              value={kidName}
                              onChange={(e) => setKidName(e.target.value)}
                              className="w-full bg-black/30 border border-[#8B4513] rounded-lg px-3 py-2 text-white font-display placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]"
                          />
                          <input 
                              type="number" 
                              placeholder="Age"
                              value={kidAge}
                              onChange={(e) => setKidAge(e.target.value)}
                              className="w-20 bg-black/30 border border-[#8B4513] rounded-lg px-3 py-2 text-white font-display placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]"
                          />
                      </div>
                   </div>
                   
                   <button 
                      onClick={handleAddKid}
                      disabled={!kidName.trim()}
                      className={`w-full bg-[#5c2e0b] hover:bg-[#70380d] text-[#eecaa0] font-display font-bold py-3 rounded-xl border border-[#8B4513] flex items-center justify-center gap-2 transition-colors ${!kidName.trim() ? 'opacity-50' : ''}`}
                   >
                      <Plus size={18} />
                      ADD CHILD
                   </button>
                </div>
              ) : (
                /* Max Kids Reached */
                <div className="bg-[#3E1F07]/50 p-4 rounded-xl border border-[#8B4513] text-center">
                  <p className="text-[#eecaa0] text-sm">
                    Maximum of {MAX_KIDS} profiles allowed
                  </p>
                </div>
              )}

              <div className="mt-auto">
                 <WoodButton 
                    fullWidth 
                    onClick={handleStep2Continue}
                    className="py-4 text-xl"
                 >
                    {kids.length > 0 ? "CONTINUE" : "SKIP FOR NOW"}
                 </WoodButton>
              </div>
           </div>
        )}

        {/* --- STEP 3: VOICE SELECTION --- */}
        {step === 3 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-2xl border-4 border-[#8B4513]">
                <Mic className="text-[#8B4513]" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Choose Your First Voice!
              </h2>
              <p className="text-[#eecaa0] text-sm mb-1">
                Select a voice to read stories and devotionals
              </p>
              <p className="text-[#eecaa0]/70 text-xs">
                Don't worry, more voices can be unlocked in the shop!
              </p>
            </div>

            {loadingVoices ? (
              <div className="text-center text-[#eecaa0] py-8">Loading voices...</div>
            ) : availableVoices.length === 0 ? (
              <div className="text-center text-[#eecaa0] py-8">No voices available</div>
            ) : (
              <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
                {availableVoices.map((voice) => (
                  <button
                    key={voice.voice_id}
                    onClick={() => handleVoiceClick(voice.voice_id)}
                    disabled={previewingVoiceId === voice.voice_id}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      selectedVoiceId === voice.voice_id
                        ? 'bg-[#FFD700]/20 border-[#FFD700] shadow-lg'
                        : 'bg-[#3E1F07]/50 border-[#5c2e0b] hover:border-[#FFD700]/50'
                    } ${previewingVoiceId === voice.voice_id ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {voice.characterImage ? (
                        <img 
                          src={voice.characterImage} 
                          alt={voice.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#5c2e0b] flex items-center justify-center border-2 border-white/20">
                          <Mic className="text-[#eecaa0]" size={24} />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="text-white font-bold text-lg">{voice.name}</div>
                        {cleanVoiceDescription(voice.description) && (
                          <div className="text-[#eecaa0] text-sm mt-1">{cleanVoiceDescription(voice.description)}</div>
                        )}
                        {cleanVoiceCategory(voice.category) && (
                          <div className="text-[#eecaa0]/70 text-xs mt-1 capitalize">{cleanVoiceCategory(voice.category)}</div>
                        )}
                      </div>
                      {previewingVoiceId === voice.voice_id ? (
                        <div className="w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
                      ) : selectedVoiceId === voice.voice_id ? (
                        <Check className="text-[#FFD700]" size={24} />
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <WoodButton
              fullWidth
              onClick={handleStep3Continue}
              disabled={!selectedVoiceId}
              className={`py-4 text-xl ${!selectedVoiceId ? 'opacity-50 grayscale' : ''}`}
            >
              CONTINUE
            </WoodButton>
          </div>
        )}

        {/* --- STEP 4: PAYWALL / VALUE PROPOSITION --- */}
        {step === 4 && (
            <PaywallStep 
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              onSubscribe={handleSubscribeClick}
              onSkip={() => {
                // User skipped without subscribing - limit to 1 kid account
                if (kids.length > 1) {
                  // Keep only the first kid, remove premium-only ones
                  const firstKid = kids[0];
                  setKids([firstKid]);
                  
                  // Also update localStorage to only have one kid
                  const savedProfiles = localStorage.getItem('godlykids_kid_profiles');
                  if (savedProfiles) {
                    try {
                      const profiles = JSON.parse(savedProfiles);
                      if (Array.isArray(profiles) && profiles.length > 0) {
                        localStorage.setItem('godlykids_kid_profiles', JSON.stringify([profiles[0]]));
                      }
                    } catch (e) {
                      console.error('Error trimming kid profiles:', e);
                    }
                  }
                  
                  console.log('🆓 Free account: Limited to 1 kid profile');
                }
                
                // Mark as free user (not premium)
                localStorage.setItem('godlykids_premium', 'false');
                navigate('/home');
              }}
              onRestore={handleRestorePurchases}
              isPurchasing={isPurchasing}
              isRestoring={isRestoring}
              error={purchaseError}
              kidsCount={kids.length}
            />
        )}

        {/* Parent Gate Modal for Step 4 Paywall */}
        <ParentGateModal 
            isOpen={showParentGate} 
            onClose={() => setShowParentGate(false)} 
            onSuccess={handleGateSuccess} 
        />
        
        {/* Parent Gate Modal for Family Step Unlock */}
        <ParentGateModal 
            isOpen={showFamilyParentGate} 
            onClose={() => setShowFamilyParentGate(false)} 
            onSuccess={handleFamilyGateSuccess} 
        />


      </div>
    </div>
  );
};

export default OnboardingPage;