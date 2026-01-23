import React, { useState } from 'react';
import { X, Eye, EyeOff, Check, Loader2, Sparkles } from 'lucide-react';
import WoodButton from '../ui/WoodButton';
import WebViewModal from '../features/WebViewModal';
import { ApiService } from '../../services/apiService';
import { useUser } from '../../context/UserContext';
import { facebookPixelService } from '../../services/facebookPixelService';
import { activityTrackingService } from '../../services/activityTrackingService';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: () => void;
  onSignIn?: () => void;
}

const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
  onSignIn,
}) => {
  const { setUserId, setEmail: setUserEmail } = useUser();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalUrl, setTermsModalUrl] = useState('');
  const [termsModalTitle, setTermsModalTitle] = useState('');

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const isFormValid = () => {
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

  const handleCreateAccount = async () => {
    if (!isFormValid()) {
      setError(getFormError() || 'Please fill in all fields correctly');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Track registration start
      activityTrackingService.trackOnboardingEvent('account_creation_started', { source: 'post_tutorial_modal' });
      
      const result = await ApiService.registerUser(email, password);
      
      if (result.success && result.userId) {
        // Update user context
        setUserId(result.userId);
        setUserEmail(email);
        
        // Track successful registration
        facebookPixelService.trackCompleteRegistration('email');
        activityTrackingService.trackOnboardingEvent('account_created', { 
          source: 'post_tutorial_modal',
          userId: result.userId 
        });
        
        // Notify parent component
        onAccountCreated();
      } else {
        setError(result.error || 'Failed to create account');
      }
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-gradient-to-b from-[#2a1810] to-[#1a0f08] rounded-3xl w-full max-w-md border-2 border-[#8B4513] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[#3E1F07] to-transparent">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={18} className="text-white/70" />
            </button>
            
            {/* Icon and Title */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg border-4 border-[#8B4513]">
                <Sparkles className="text-[#3E1F07]" size={28} />
              </div>
              <h2 className="font-display font-extrabold text-2xl text-[#f3e5ab] mb-1">
                Create Free Account
              </h2>
              <p className="text-[#eecaa0]/80 text-sm">
                Save your progress and personalize the experience
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 pb-6 space-y-4">
            {/* Email Field */}
            <div>
              <label className="text-[#eecaa0] text-xs font-semibold mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="your@email.com"
                className="w-full bg-[#f3e5ab] text-[#3E1F07] placeholder:text-[#8B4513]/50 px-4 py-3 rounded-xl font-medium border-2 border-[#8B4513]/30 focus:border-[#FFD700] focus:outline-none transition-colors"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[#eecaa0] text-xs font-semibold mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#f3e5ab] text-[#3E1F07] placeholder:text-[#8B4513]/50 px-4 py-3 rounded-xl font-medium border-2 border-[#8B4513]/30 focus:border-[#FFD700] focus:outline-none transition-colors pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B4513]/60 hover:text-[#8B4513] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="text-[#eecaa0] text-xs font-semibold mb-1 block">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  placeholder="Re-enter password"
                  className="w-full bg-[#f3e5ab] text-[#3E1F07] placeholder:text-[#8B4513]/50 px-4 py-3 rounded-xl font-medium border-2 border-[#8B4513]/30 focus:border-[#FFD700] focus:outline-none transition-colors pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B4513]/60 hover:text-[#8B4513] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Terms Agreement */}
            <div>
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
                      : 'bg-[#f3e5ab] border-[#8B4513]/30 group-hover:border-[#FFD700]'
                  }`}>
                    {agreedToTerms && <Check size={14} className="text-[#3E1F07]" strokeWidth={3} />}
                  </div>
                </div>
                <span className="text-[#eecaa0]/80 text-xs leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalUrl('https://www.godlykids.com/end-user-license-agreement');
                      setTermsModalTitle('Terms of Agreement');
                      setShowTermsModal(true);
                    }}
                    className="text-[#FFD700] font-semibold underline hover:text-[#FFA500]"
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
                    className="text-[#FFD700] font-semibold underline hover:text-[#FFA500]"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            {/* Error Message */}
            {(error || getFormError()) && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm px-4 py-2 rounded-lg">
                {error || getFormError()}
              </div>
            )}

            {/* Create Account Button */}
            <WoodButton
              fullWidth
              variant="gold"
              onClick={handleCreateAccount}
              disabled={isCreating || !isFormValid()}
              className="py-4 text-lg"
            >
              {isCreating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </span>
              ) : (
                'CREATE FREE ACCOUNT'
              )}
            </WoodButton>

            {/* Sign In Link */}
            <p className="text-center text-[#eecaa0]/60 text-sm">
              Already have an account?{' '}
              <button
                onClick={onSignIn}
                className="text-[#FFD700] font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Terms WebView Modal */}
      <WebViewModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        url={termsModalUrl}
        title={termsModalTitle}
      />
    </>
  );
};

export default CreateAccountModal;
