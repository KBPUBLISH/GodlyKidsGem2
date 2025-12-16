import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Plus, Trash2, UserCircle, Mic, X, ChevronDown, ChevronUp, BookOpen, Music, Sparkles, Users, Loader2, Lock, Crown, ClipboardList, RefreshCw, Volume2, Eye, EyeOff } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { useSubscription } from '../context/SubscriptionContext';
import { AVATAR_ASSETS } from '../components/avatar/AvatarAssets';
import ParentGateModal from '../components/features/ParentGateModal';
import WebViewModal from '../components/features/WebViewModal';
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

// PaywallStep Component - Account creation is SEPARATE from subscription (Apple requirement)
const PaywallStep: React.FC<{
  selectedPlan: 'annual' | 'monthly';
  setSelectedPlan: (plan: 'annual' | 'monthly') => void;
  onSubscribe: (email: string, password: string) => void;
  onSkip: () => void;
  onRestore: (email: string, password: string) => void;
  onCreateAccount: (email: string, password: string) => Promise<boolean>;
  isPurchasing?: boolean;
  isRestoring?: boolean;
  error?: string | null;
  kidsCount?: number; // Number of kids added during onboarding
}> = ({ selectedPlan, setSelectedPlan, onSubscribe, onSkip, onRestore, onCreateAccount, isPurchasing = false, isRestoring = false, error = null, kidsCount = 0 }) => {
  const [showIncluded, setShowIncluded] = useState(true); // Open by default so users see features
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentBenefit, setCurrentBenefit] = useState(0);
  
  // Account creation state - SEPARATE from subscription
  const [showAccountForm, setShowAccountForm] = useState(true); // Show by default
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Terms agreement state
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalUrl, setTermsModalUrl] = useState('');
  const [termsModalTitle, setTermsModalTitle] = useState('');

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Account form validation
  const isAccountFormValid = () => {
    if (!agreedToTerms) return false;
    if (!email.trim() || !isValidEmail(email)) return false;
    if (!password || password.length < 6) return false;
    if (password !== confirmPassword) return false;
    return true;
  };

  const getFormError = () => {
    if (!email.trim()) return null;
    if (!isValidEmail(email)) return 'Please enter a valid email address';
    if (password && password.length < 6) return 'Password must be at least 6 characters';
    if (confirmPassword && password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  // Handle account creation (independent of subscription)
  const handleCreateAccount = async () => {
    if (!isAccountFormValid()) {
      setFormError(getFormError() || 'Please fill in all fields correctly');
      return;
    }
    
    setIsCreatingAccount(true);
    setFormError(null);
    
    try {
      const success = await onCreateAccount(email, password);
      if (success) {
        setAccountCreated(true);
        setShowAccountForm(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create account');
    } finally {
      setIsCreatingAccount(false);
    }
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
      
      {/* ==================== STEP 1: CREATE ACCOUNT (REQUIRED FIRST) ==================== */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-[#8B4513] mb-5 overflow-hidden">
        
        {/* Account Header - Always visible */}
        <button
          onClick={() => !accountCreated && setShowAccountForm(!showAccountForm)}
          className={`w-full px-5 py-4 flex items-center justify-between text-left ${accountCreated ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-3">
            {accountCreated ? (
              <div className="w-10 h-10 rounded-full bg-[#4CAF50] flex items-center justify-center">
                <Check className="w-6 h-6 text-white" strokeWidth={3} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
                <span className="text-[#3E1F07] font-bold text-lg">1</span>
              </div>
            )}
            <div>
              <h3 className="text-[#3E1F07] font-display font-bold text-lg">
                {accountCreated ? 'Account Created!' : 'Create Your Account'}
              </h3>
              {accountCreated ? (
                <p className="text-[#4CAF50] text-sm font-medium">{email}</p>
              ) : (
                <p className="text-[#8B4513] text-xs">Required to save your progress</p>
              )}
            </div>
          </div>
          {!accountCreated && (
            showAccountForm ? (
              <ChevronUp className="w-6 h-6 text-[#8B4513]" />
            ) : (
              <ChevronDown className="w-6 h-6 text-[#8B4513]" />
            )
          )}
        </button>
        
        {/* Account Form - Accordion */}
        <div className={`overflow-hidden transition-all duration-300 ${showAccountForm && !accountCreated ? 'max-h-[500px]' : 'max-h-0'}`}>
          <div className="px-5 pb-5 space-y-3 border-t border-gray-200 pt-4">
            {/* Email */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { 
                  console.log('📝 Email input changed to:', e.target.value);
                  setEmail(e.target.value); 
                  setFormError(null); 
                }}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
                autoComplete="off"
                name="new-email-field"
              />
            </div>
            
            {/* Password */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#8B4513] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            {/* Confirm Password */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFormError(null); }}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm text-[#3E1F07] bg-white placeholder:text-gray-400 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#8B4513] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    agreedToTerms 
                      ? 'bg-[#FFD700] border-[#B8860B]' 
                      : 'bg-white border-gray-300 group-hover:border-[#FFD700]'
                  }`}>
                    {agreedToTerms && <Check size={14} className="text-[#3E1F07]" strokeWidth={3} />}
                  </div>
                </div>
                <span className="text-[#5D4037] text-xs leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalUrl('https://www.godlykids.com/end-user-license-agreement');
                      setTermsModalTitle('Terms of Agreement');
                      setShowTermsModal(true);
                    }}
                    className="text-[#1976D2] font-semibold underline hover:text-[#1565C0]"
                  >
                    Terms of Agreement
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalUrl('https://www.godlykids.com/privacy');
                      setTermsModalTitle('Privacy Policy');
                      setShowTermsModal(true);
                    }}
                    className="text-[#1976D2] font-semibold underline hover:text-[#1565C0]"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>
            
            {/* Form Error */}
            {(getFormError() || formError) && (
              <p className="text-red-500 text-xs">{formError || getFormError()}</p>
            )}
            
            {/* Create Account Button */}
            <button
              onClick={handleCreateAccount}
              disabled={isCreatingAccount || !isAccountFormValid()}
              className="w-full py-3 bg-gradient-to-b from-[#8B4513] to-[#5c2e0b] text-white font-display font-bold text-lg rounded-xl shadow-lg border-2 border-[#3E1F07] disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
            
            {/* Sign In Link */}
            <div className="text-center pt-2">
              <p className="text-[#8B4513] text-xs">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    // Navigate to sign-in page using hash routing
                    window.location.hash = '/signin';
                  }}
                  className="text-[#1976D2] font-semibold underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== STEP 2: OPTIONAL SUBSCRIPTION ==================== */}
      <div className={`transition-all duration-300 ${accountCreated ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        
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

        {/* What's Included */}
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

        {/* Subscription Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 border-[#FFD700] mb-5">
          
          {/* Step 2 Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
              <span className="text-[#3E1F07] font-bold text-lg">2</span>
            </div>
            <div>
              <h2 className="text-[#3E1F07] font-display font-extrabold text-xl">
                Unlock Everything
              </h2>
              <p className="text-[#8B4513] text-xs">
                100% ad-free • Cancel anytime
              </p>
            </div>
          </div>

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

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {error.includes('hello@kbpublish.org') 
                ? error.split('hello@kbpublish.org').map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <a 
                          href="mailto:hello@kbpublish.org?subject=Subscription%20Support%20Request" 
                          className="text-blue-600 underline font-semibold"
                        >
                          hello@kbpublish.org
                        </a>
                      )}
                    </span>
                  ))
                : error
              }
            </div>
          )}

          {/* Subscribe Button */}
          <WoodButton 
            fullWidth 
            variant="gold"
            onClick={() => onSubscribe(email, password)}
            disabled={isPurchasing || !accountCreated}
            className="py-4 text-lg shadow-xl mb-2 border-b-4 border-[#B8860B] disabled:opacity-50"
          >
            {isPurchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Complete payment in Apple...
              </span>
            ) : (
              '🎁 START FREE TRIAL'
            )}
          </WoodButton>
          
          <p className="text-[#5c2e0b] text-[10px] text-center opacity-70">
            No charge until trial ends
          </p>
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
      </div>

      {/* Skip Link - Always visible (Apple Kids App Guideline: Must allow access without account) */}
      <div className="text-center">
        <button 
          onClick={onSkip}
          className="text-xs underline decoration-dotted transition-colors text-white/60 hover:text-white/90"
        >
          Continue with limited access →
        </button>
        
        {/* Restore Purchases Link */}
        <div className="mt-3">
          <button
            onClick={() => onRestore(email, password)}
            disabled={isRestoring || !accountCreated}
            className={`text-xs transition-colors ${accountCreated ? 'text-[#FFD700]/70 hover:text-[#FFD700]' : 'text-white/20 cursor-not-allowed'}`}
          >
            {isRestoring ? 'Restoring...' : '🔄 Restore Previous Subscription'}
          </button>
        </div>
        
        <p className="text-white/30 text-[10px] mt-3">
          Loved by 10,000+ Christian families 🙏
        </p>
      </div>

      {/* Terms/Privacy WebView Modal */}
      <WebViewModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        url={termsModalUrl}
        title={termsModalTitle}
        hideExternalLink={true}
      />
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

  // Store password temporarily for account creation after parent gate
  const [userPassword, setUserPassword] = useState<string>('');
  
  // Handle account creation ONLY (no subscription) - Apple requirement
  const handleCreateAccount = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('📧 Creating user account (no subscription):', email);
      
      const signUpResult = await ApiService.signUp(email, password);
      
      if (signUpResult.success) {
        console.log('✅ Account created successfully!');
        localStorage.setItem('godlykids_user_email', email);
        setUserEmail(email);
        setUserPassword(password);
        window.dispatchEvent(new Event('authTokenUpdated'));
        return true;
      } else {
        // If account already exists, try logging in instead
        if (signUpResult.error?.includes('exists') || signUpResult.error?.includes('duplicate')) {
          console.log('📧 Account exists, attempting login...');
          const loginResult = await ApiService.login('email', { email, password });
          if (loginResult.success) {
            console.log('✅ Logged in successfully!');
            localStorage.setItem('godlykids_user_email', email);
            setUserEmail(email);
            setUserPassword(password);
            window.dispatchEvent(new Event('authTokenUpdated'));
            return true;
          } else {
            throw new Error('Account exists but password is incorrect. Please try a different password.');
          }
        } else {
          throw new Error(signUpResult.error || 'Failed to create account. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('❌ Account creation error:', error);
      throw error;
    }
  };
  
  const handleSubscribeClick = (email: string, password: string) => {
    setUserEmail(email);
    setUserPassword(password);
    setShowParentGate(true);
  };

  const handleRestorePurchases = async (restoreEmail: string, _restorePassword: string) => {
    console.log('🔄 handleRestorePurchases called');
    console.log('🔄 restoreEmail received:', restoreEmail);
    
    setIsRestoring(true);
    setPurchaseError(null);
    
    try {
      // Account should already be created at this point
      const emailToUse = restoreEmail || localStorage.getItem('godlykids_user_email');
      
      if (!emailToUse) {
        setPurchaseError('Please create your account first before restoring.');
        setIsRestoring(false);
        return;
      }
      
      // Step 1: First try native RevenueCat/DeSpia restore (checks Apple/Google directly)
      console.log('🔄 Attempting native restore first...');
      const revenueCatModule = await import('../services/revenueCatService');
      const revenueCatService = revenueCatModule.default;
      const nativeResult = await revenueCatService.restorePurchases(true); // true = trigger native Apple restore
      console.log('🔄 Native restore result:', nativeResult);
      
      if (nativeResult.success && nativeResult.isPremium) {
        playSuccess();
        localStorage.setItem('godlykids_premium', 'true');
        setSubscribedDuringOnboarding(true);
        navigate('/home');
        return;
      }
      
      // Step 2: Check old backend migration API
      console.log('🔍 Checking old backend for subscription:', emailToUse);
      
      const migrationResponse = await fetch(`${import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com'}/api/migration/restore-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse }),
      });
      
      const migrationResult = await migrationResponse.json();
      console.log('📦 Migration result:', migrationResult);
      
      if (migrationResult.success && migrationResult.subscriptionRestored) {
        playSuccess();
        localStorage.setItem('godlykids_premium', 'true');
        setSubscribedDuringOnboarding(true);
        navigate('/home');
        return;
      }
      
      // No subscription found anywhere
      if (migrationResult.found) {
        // Account exists in old backend but no active subscription
        setPurchaseError(migrationResult.message || 'Account found but subscription has expired. Please subscribe below.');
      } else {
        setPurchaseError('No active subscription found for this email or device. If you recently subscribed, please wait a moment and try again.');
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
    
    try {
      // First, create the user account if we have email and password
      if (userEmail && userPassword) {
        console.log('📧 Creating user account:', userEmail);
        
        const signUpResult = await ApiService.signUp(userEmail, userPassword);
        
        if (signUpResult.success) {
          console.log('✅ Account created successfully!');
          localStorage.setItem('godlykids_user_email', userEmail);
          // Dispatch event so other parts of app know user is authenticated
          window.dispatchEvent(new Event('authTokenUpdated'));
        } else {
          // If account already exists, try logging in instead
          if (signUpResult.error?.includes('exists') || signUpResult.error?.includes('duplicate')) {
            console.log('📧 Account exists, attempting login...');
            const loginResult = await ApiService.login('email', { email: userEmail, password: userPassword });
            if (loginResult.success) {
              console.log('✅ Logged in successfully!');
              localStorage.setItem('godlykids_user_email', userEmail);
              window.dispatchEvent(new Event('authTokenUpdated'));
            } else {
              setPurchaseError('Account exists but password is incorrect. Please use Sign In instead.');
              setIsPurchasing(false);
              return;
            }
          } else {
            console.error('❌ Account creation failed:', signUpResult.error);
            setPurchaseError(signUpResult.error || 'Failed to create account. Please try again.');
            setIsPurchasing(false);
            return;
          }
        }
      }
      
      // Now proceed with the purchase
      console.log('🛒 Starting purchase for plan:', selectedPlan);
      console.log('🛒 This will open the Apple subscription sheet...');
      
      // Use quick mode - this triggers the Apple sheet and returns quickly
      // User can complete the purchase while already in the app
      const result = await purchase(selectedPlan, true);
      
      console.log('🛒 Purchase result:', result);
      
      if (result.success) {
        // Payment was CONFIRMED by webhook/backend - user is now premium!
        console.log('✅ Payment confirmed! User is now premium.');
        playSuccess();
        
        // Update state - premium was already set by the purchase() function
        // when it received webhook confirmation
        subscribe();
        setSubscribedDuringOnboarding(true);
        setIsPurchasing(false);
        
        // NOW navigate to home - payment is confirmed
        navigate('/home');
      } else {
        // Purchase was cancelled or failed
        console.log('❌ Purchase failed or cancelled:', result.error);
        
        // Check if this is a "still processing" message vs actual cancellation
        const isProcessing = result.error?.includes('processing') || result.error?.includes('Restore');
        
        if (isProcessing) {
          // Payment might still be processing - check one more time
          const isPremium = localStorage.getItem('godlykids_premium') === 'true';
          if (isPremium) {
            console.log('✅ Premium found after timeout - proceeding!');
            playSuccess();
            subscribe();
            setSubscribedDuringOnboarding(true);
            setIsPurchasing(false);
            navigate('/home');
            return;
          }
        }
        
        setPurchaseError(result.error || 'Purchase was cancelled. Please try again.');
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
    <div className="w-full max-w-md px-6 mb-6">
       {/* Wood plank container for progress */}
       <div className="bg-[#CD853F] rounded-2xl p-4 border-2 border-[#8B4513] shadow-lg relative overflow-hidden">
         {/* Wood grain */}
         <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 25px, #3E1F07 25px, #3E1F07 27px)'}}></div>
         
         <div className="relative">
           <div className="flex justify-between mb-3 text-[#5c2e0b] font-display font-bold text-xs uppercase tracking-wide">
              <span className={step >= 1 ? "text-[#3E1F07]" : "opacity-40"}>Parent</span>
              <span className={step >= 2 ? "text-[#3E1F07]" : "opacity-40"}>Family</span>
              <span className={step >= 3 ? "text-[#3E1F07]" : "opacity-40"}>Voice</span>
              <span className={step >= 4 ? "text-[#3E1F07]" : "opacity-40"}>Unlock</span>
           </div>
           <div className="h-4 bg-[#5c2e0b] rounded-full overflow-hidden border-2 border-[#3E1F07] shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#FFD700] to-[#ffb300] transition-all duration-500 ease-out rounded-full"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              ></div>
           </div>
         </div>
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
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar">
      
      {/* Wood Header Bar */}
      <div className="relative z-20 pt-8 pb-4 px-6 bg-[#CD853F] shadow-md border-b-4 border-[#8B4513]">
        {/* Wood Texture */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 30px, #3E1F07 30px, #3E1F07 32px)'}}></div>
        
        <div className="relative flex items-center justify-between z-10">
           {step > 1 && (
             <button 
               onClick={() => setStep(prev => (prev - 1) as any)} 
               className="w-12 h-12 bg-[#8B4513] hover:bg-[#A0522D] rounded-full flex items-center justify-center text-[#f3e5ab] border-2 border-[#eecaa0] active:scale-95 transition-transform shadow-md"
             >
                <ChevronLeft size={28} strokeWidth={3} />
             </button>
           )}
           {step === 1 && <div className="w-12"></div>} {/* Spacer */}
           
           <div className="flex flex-col items-center">
               <h1 className="font-display font-extrabold text-2xl text-[#5c2e0b] tracking-wide drop-shadow-sm uppercase">
                   Setup
               </h1>
           </div>
           
           <div className="w-12"></div> {/* Spacer */}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center pt-6 pb-10 w-full relative z-10">
        
        {renderProgress()}

        {/* --- STEP 1: PARENT PROFILE --- */}
        {step === 1 && (
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500">
             
             {/* Clarification Banner - Wood Themed */}
             <div className="bg-[#CD853F] rounded-2xl p-4 mb-6 flex items-center gap-3 border-2 border-[#8B4513] shadow-lg relative overflow-hidden">
                 {/* Wood grain texture */}
                 <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #3E1F07 20px, #3E1F07 22px)'}}></div>
                 <div className="relative flex items-center gap-3">
                   <div className="bg-[#FFD700] rounded-full p-2 text-[#5c2e0b] border-2 border-[#B8860B] shadow-md">
                       <UserCircle size={24} />
                   </div>
                   <p className="text-[#5c2e0b] text-sm font-display font-bold">
                       Step 1: Create the <span className="text-[#3E1F07]">Parent Profile</span>
                   </p>
                 </div>
             </div>

             {/* Avatar Picker - Wood Container */}
             <div className="bg-[#CD853F] rounded-2xl p-5 mb-6 border-2 border-[#8B4513] shadow-lg relative overflow-hidden">
                {/* Wood grain */}
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #3E1F07 20px, #3E1F07 22px)'}}></div>
                
                <div className="relative flex flex-col items-center">
                  <div className="w-28 h-28 rounded-full border-4 border-[#8B4513] shadow-lg bg-[#f3e5ab] mb-4 relative overflow-hidden flex items-center justify-center">
                       <div className="w-[90%] h-[90%] flex items-center justify-center">
                           {renderAvatarAsset(pAvatar)}
                       </div>
                  </div>
                  
                  <p className="text-[#5c2e0b] text-xs font-bold mb-3">Tap to change avatar</p>
                  
                  <div className="w-full overflow-x-auto no-scrollbar pb-2">
                    <div className="flex gap-2 justify-center min-w-min px-2">
                      {FUNNY_HEADS.map((head) => (
                        <button
                          key={head}
                          onClick={() => setPAvatar(head)}
                          className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 p-1 bg-[#f3e5ab] flex items-center justify-center ${pAvatar === head ? 'border-[#FFD700] scale-110 ring-2 ring-[#FFD700]/50' : 'border-[#8B4513]/50 opacity-70 hover:opacity-100'}`}
                        >
                            {renderAvatarAsset(head)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
             </div>

             {/* Name Input - Wood Container */}
             <div className="bg-[#CD853F] p-5 rounded-2xl border-2 border-[#8B4513] shadow-lg relative overflow-hidden">
                 {/* Wood grain */}
                 <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #3E1F07 20px, #3E1F07 22px)'}}></div>
                 
                 <div className="relative">
                   <label className="block text-[#5c2e0b] font-display font-bold text-sm tracking-wide mb-2 uppercase">
                     Parent Name
                   </label>
                   <input 
                      type="text" 
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      placeholder="e.g. Mom, Dad"
                      className="w-full bg-[#fff8e1] border-2 border-[#8B4513] rounded-xl px-4 py-3 text-[#3E1F07] font-display text-lg placeholder:text-[#8B4513]/40 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 transition-colors text-center"
                      autoFocus
                   />
                 </div>
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
              
              {/* Header - Wood Container */}
              <div className="bg-[#CD853F] rounded-2xl p-4 mb-6 border-2 border-[#8B4513] shadow-lg relative overflow-hidden text-center">
                 <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #3E1F07 20px, #3E1F07 22px)'}}></div>
                 <div className="relative">
                   <h2 className="text-[#3E1F07] font-display font-bold text-xl">Who is adventuring?</h2>
                   <p className="text-[#5c2e0b] text-sm">Create profiles for your children.</p>
                   {subscribedDuringOnboarding && (
                     <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-[#FFD700] rounded-full text-[#5c2e0b] text-xs font-bold border border-[#B8860B]">
                       <Crown size={12} /> Premium - Unlimited Kids
                     </div>
                   )}
                 </div>
              </div>

              {/* Added Kids List */}
              <div className="space-y-3 mb-6">
                  {kids.map((kid, index) => (
                      <div key={kid.id} className="bg-[#CD853F] rounded-xl p-3 flex items-center justify-between border-2 border-[#8B4513] shadow-md animate-in zoom-in relative overflow-hidden">
                          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 15px, #3E1F07 15px, #3E1F07 17px)'}}></div>
                          <div className="relative flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-[#f3e5ab] overflow-hidden border-2 border-[#8B4513] flex items-center justify-center p-1">
                                   {renderAvatarAsset(kid.avatarSeed)}
                              </div>
                              <div>
                                  <h3 className="text-[#3E1F07] font-bold font-display text-lg">{kid.name}</h3>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#5c2e0b] text-xs font-bold">{kid.age} years old</span>
                                    {/* Show FREE or PREMIUM badge */}
                                    {index === 0 ? (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#4CAF50] text-white">FREE</span>
                                    ) : (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b]">PREMIUM</span>
                                    )}
                                  </div>
                              </div>
                          </div>
                          <button onClick={() => removeKid(kid.id)} className="relative w-8 h-8 bg-red-500/80 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors border border-red-700">
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>

              {/* Add Kid Form - Wood Container */}
              {canAddMoreKids ? (
                <div className="bg-[#CD853F] p-5 rounded-2xl border-2 border-[#8B4513] shadow-lg mb-6 relative overflow-hidden">
                   {/* Wood grain */}
                   <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, #3E1F07 20px, #3E1F07 22px)'}}></div>
                   
                   {/* Badge shows FREE for first kid, PREMIUM REQUIRED for additional */}
                   <div className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 ${
                     kids.length === 0 
                       ? 'bg-[#4CAF50] text-white' 
                       : 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b]'
                   }`}>
                     {kids.length === 0 ? '✓ FREE PROFILE' : '👑 PREMIUM'}
                   </div>
                   
                   <div className="relative flex gap-4 mb-4">
                      <div className="w-20 shrink-0 flex flex-col gap-2">
                          <div 
                             className="w-20 h-20 rounded-xl bg-[#f3e5ab] border-2 border-[#8B4513] overflow-hidden relative cursor-pointer hover:opacity-90 flex items-center justify-center p-2"
                             onClick={() => setKidAvatar(FUNNY_HEADS[Math.floor(Math.random() * FUNNY_HEADS.length)])}
                          >
                               {renderAvatarAsset(kidAvatar)}
                               <div className="absolute bottom-0 left-0 right-0 bg-[#5c2e0b]/80 text-[#f3e5ab] text-[8px] text-center py-0.5 font-bold">TAP</div>
                          </div>
                      </div>
                      <div className="flex-1 space-y-3">
                          <input 
                              type="text" 
                              placeholder="Child's Name"
                              value={kidName}
                              onChange={(e) => setKidName(e.target.value)}
                              className="w-full bg-[#fff8e1] border-2 border-[#8B4513] rounded-lg px-3 py-2.5 text-[#3E1F07] font-display placeholder:text-[#8B4513]/40 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
                          />
                          <input 
                              type="number" 
                              placeholder="Age"
                              value={kidAge}
                              onChange={(e) => setKidAge(e.target.value)}
                              className="w-20 bg-[#fff8e1] border-2 border-[#8B4513] rounded-lg px-3 py-2.5 text-[#3E1F07] font-display placeholder:text-[#8B4513]/40 focus:outline-none focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30"
                          />
                      </div>
                   </div>
                   
                   <button 
                      onClick={handleAddKid}
                      disabled={!kidName.trim()}
                      className={`relative w-full bg-[#5c2e0b] hover:bg-[#70380d] text-[#f3e5ab] font-display font-bold py-3 rounded-xl border-2 border-[#3E1F07] flex items-center justify-center gap-2 transition-colors shadow-md ${!kidName.trim() ? 'opacity-50' : ''}`}
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
          <div className="w-full max-w-md px-6 animate-in slide-in-from-right-10 duration-500 flex flex-col h-full">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-2xl border-4 border-[#8B4513]">
                <Mic className="text-[#8B4513]" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                Choose Your First Voice!
              </h2>
              <p className="text-[#eecaa0] text-sm">
                Tap a voice to hear a preview
              </p>
            </div>

            {loadingVoices ? (
              <div className="text-center text-[#eecaa0] py-8">Loading voices...</div>
            ) : availableVoices.length === 0 ? (
              <div className="text-center text-[#eecaa0] py-8">No voices available</div>
            ) : (
              <div className="space-y-3 mb-4 max-h-[280px] overflow-y-auto flex-shrink-0">
                {availableVoices.map((voice) => (
                  <button
                    key={voice.voice_id}
                    onClick={() => handleVoiceClick(voice.voice_id)}
                    disabled={previewingVoiceId === voice.voice_id}
                    className={`w-full p-3 rounded-xl border-2 transition-all ${
                      selectedVoiceId === voice.voice_id
                        ? 'bg-[#FFD700]/20 border-[#FFD700] shadow-lg'
                        : 'bg-[#3E1F07]/50 border-[#5c2e0b] hover:border-[#FFD700]/50'
                    } ${previewingVoiceId === voice.voice_id ? 'opacity-75 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {voice.characterImage ? (
                        <img 
                          src={voice.characterImage} 
                          alt={voice.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[#5c2e0b] flex items-center justify-center border-2 border-white/20">
                          <Mic className="text-[#eecaa0]" size={20} />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="text-white font-bold">{voice.name}</div>
                        {cleanVoiceDescription(voice.description) && (
                          <div className="text-[#eecaa0] text-xs mt-0.5 line-clamp-1">{cleanVoiceDescription(voice.description)}</div>
                        )}
                      </div>
                      {previewingVoiceId === voice.voice_id ? (
                        <div className="w-6 h-6 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
                      ) : selectedVoiceId === voice.voice_id ? (
                        <Check className="text-[#FFD700]" size={24} />
                      ) : (
                        <Volume2 className="text-white/40" size={20} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Sticky Continue Button Area */}
            <div className="mt-auto pt-4 pb-2 bg-gradient-to-t from-[#1a237e] via-[#1a237e] to-transparent -mx-6 px-6">
              {!selectedVoiceId && (
                <p className="text-center text-[#FFD700] text-sm mb-3 animate-pulse">
                  👆 Select a voice above to continue
                </p>
              )}
              <WoodButton
                fullWidth
                onClick={handleStep3Continue}
                disabled={!selectedVoiceId}
                className={`py-4 text-xl ${!selectedVoiceId ? 'opacity-40 grayscale' : 'animate-pulse'}`}
              >
                {selectedVoiceId ? '✨ CONTINUE' : 'SELECT A VOICE'}
              </WoodButton>
              <p className="text-[#eecaa0]/60 text-[10px] text-center mt-2">
                More voices available in the shop later!
              </p>
            </div>
          </div>
        )}

        {/* --- STEP 4: PAYWALL / VALUE PROPOSITION --- */}
        {step === 4 && (
            <PaywallStep 
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              onCreateAccount={handleCreateAccount}
              onSubscribe={handleSubscribeClick}
              onSkip={() => {
                // User skipped without subscribing - limit to 1 kid account
                if (kids.length > 1) {
                  // Remove all kids except the first one
                  const kidsToRemove = kids.slice(1); // Get all kids after the first
                  kidsToRemove.forEach(kid => {
                    removeKid(kid.id);
                  });
                  
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

        {/* Full-screen Purchase Processing Overlay */}
        {isPurchasing && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-gradient-to-b from-[#2a1810] to-[#1a0f08] rounded-3xl p-8 mx-6 max-w-sm w-full border-2 border-[#8B4513] shadow-2xl">
              {/* Animated Loader */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-[#FFD700]/30 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-t-[#FFD700] rounded-full animate-spin"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">
                    💳
                  </div>
                </div>
              </div>
              
              {/* Text */}
              <h3 className="text-[#FFD700] font-display font-bold text-xl text-center mb-2">
                Processing Payment
              </h3>
              <p className="text-white/70 text-center text-sm mb-4">
                Please complete your purchase in the Apple payment sheet...
              </p>
              
              {/* Progress indicator */}
              <div className="flex justify-center gap-1 mb-4">
                <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#FFD700] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              
              <p className="text-white/50 text-center text-xs">
                Do not close this screen
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OnboardingPage;