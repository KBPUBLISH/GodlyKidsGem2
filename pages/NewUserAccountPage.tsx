import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { authService } from '../services/authService';
import { facebookPixelService } from '../services/facebookPixelService';
import { activityTrackingService } from '../services/activityTrackingService';
import { markNewOnboardingComplete } from '../services/userTypeService';
import WebViewModal from '../components/features/WebViewModal';

/**
 * Account Creation - AFTER trial/purchase
 * Required to access content after starting subscription
 * This is the Calm-style flow: anonymous purchase first, then require account
 */
const NewUserAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPaywall = (location.state as any)?.fromPaywall === true;
  const fromRestore = (location.state as any)?.fromRestore === true;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalUrl, setTermsModalUrl] = useState('');
  const [termsModalTitle, setTermsModalTitle] = useState('');

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('new_user_account_shown', {
      fromPaywall,
      fromRestore
    });
  }, [fromPaywall, fromRestore]);

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
      // Create account
      const result = await ApiService.signUp(email, password);
      
      if (result.success) {
        // Store auth token
        if (result.token) {
          localStorage.setItem('godlykids_auth_token', result.token);
        }
        
        // Store email
        localStorage.setItem('godlykids_user_email', email);
        
        // Track successful account creation
        facebookPixelService.trackSignUp('email');
        activityTrackingService.trackOnboardingEvent('account_created', { 
          email,
          flow: 'new_user_after_purchase'
        });

        // Link device ID to email in backend
        const deviceId = localStorage.getItem('godlykids_device_id');
        if (deviceId) {
          try {
            await ApiService.linkDeviceToEmail(deviceId, email);
          } catch (linkError) {
            console.warn('Failed to link device to email:', linkError);
          }
        }

        // Mark new onboarding as complete
        markNewOnboardingComplete();

        // Navigate to voice selection, then they'll land in a story
        navigate('/new-user-voice-selection', { replace: true });
      } else {
        if (result.error?.includes('exists') || result.error?.includes('duplicate') || result.error?.includes('already')) {
          setError('An account with this email already exists. Try signing in instead.');
        } else {
          setError(result.error || 'Failed to create account');
        }
      }
    } catch (err: any) {
      console.error('Account creation error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* NO BACK BUTTON - Account is required to access content */}
      
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-10 overflow-y-auto">
        <div className="w-full max-w-md">
          
          {/* Icon and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-300/40">
              <Sparkles className="text-white w-8 h-8" />
            </div>
            <h1 className="font-display font-extrabold text-3xl text-[#1e1b4b] mb-2">
              One Last Step
            </h1>
            <p className="text-[#64748b] text-lg">
              Create your account to save progress
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 mb-6">
            {/* Email Field */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-[#1e1b4b] placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1] transition-colors"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-[#1e1b4b] placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1] transition-colors pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#6366f1] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="text-[#5D4037] text-xs font-semibold mb-1 block">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-[#1e1b4b] placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1] transition-colors pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#6366f1] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                      ? 'bg-[#6366f1] border-[#6366f1]' 
                      : 'bg-white border-gray-300 group-hover:border-[#6366f1]'
                  }`}>
                    {agreedToTerms && <Check size={14} className="text-white" strokeWidth={3} />}
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
                    className="text-[#6366f1] font-semibold underline hover:text-[#4f46e5]"
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
                    className="text-[#6366f1] font-semibold underline hover:text-[#4f46e5]"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {(error || getFormError()) && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              {error || getFormError()}
            </div>
          )}

          {/* Create Account Button */}
          <button
            onClick={handleCreateAccount}
            disabled={isCreating || !isFormValid()}
            className="w-full py-4 bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold text-lg rounded-2xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Account & Continue'
            )}
          </button>

          {/* Small print */}
          <p className="text-center text-[#94a3b8] text-xs mt-4 leading-relaxed">
            Your account saves your progress across all devices
          </p>
        </div>
      </div>

      {/* Terms WebView Modal */}
      <WebViewModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        url={termsModalUrl}
        title={termsModalTitle}
      />

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default NewUserAccountPage;
