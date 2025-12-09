import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Lock, Eye, EyeOff, X, Loader2, RefreshCw } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { ApiService, getApiBaseUrl } from '../services/apiService';
import { useSubscription } from '../context/SubscriptionContext';
import { RevenueCatService } from '../services/revenueCatService';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  
  // Restore purchases state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address');
      return;
    }
    
    setForgotLoading(true);
    setForgotError(null);
    
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.toLowerCase().trim() }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setForgotSuccess(true);
      } else {
        setForgotError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Unable to connect. Please check your internet and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSuccess(false);
    setForgotError(null);
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setRestoreResult(null);
    setError(null);
    
    try {
      console.log('🔄 Restore purchases clicked on Sign In page');
      
      // First try native RevenueCat/DeSpia restore
      const result = await RevenueCatService.restorePurchases(true); // true = trigger native Apple restore
      console.log('🔄 Native restore result:', result);
      
      if (result.success && result.isPremium) {
        subscribe();
        setRestoreResult({
          type: 'success',
          message: 'Your subscription has been restored! 🎉'
        });
        setTimeout(() => navigate('/home'), 1500);
        return;
      }
      
      // Check if user is logged in and try migration API
      const userEmail = email || localStorage.getItem('godlykids_user_email');
      if (userEmail) {
        console.log('🔄 Checking migration API for:', userEmail);
        const baseUrl = getApiBaseUrl();
        
        const migrationResponse = await fetch(`${baseUrl}migration/restore-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail }),
        });
        
        const migrationData = await migrationResponse.json();
        console.log('🔄 Migration API result:', migrationData);
        
        if (migrationData.subscriptionRestored) {
          subscribe();
          setRestoreResult({
            type: 'success',
            message: 'Welcome back! Your subscription has been restored! 🎉'
          });
          setTimeout(() => navigate('/home'), 2000);
          return;
        } else if (migrationData.found) {
          setRestoreResult({
            type: 'info',
            message: migrationData.message || 'Account found but subscription has expired.'
          });
          return;
        }
      }
      
      // No subscription found
      setRestoreResult({
        type: 'error',
        message: 'No active subscription found for this device or email. If you recently subscribed, please wait a moment and try again.'
      });
      
    } catch (err: any) {
      console.error('❌ Restore error:', err);
      setRestoreResult({
        type: 'error',
        message: err.message || 'Failed to restore purchases. Please try again.'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLogin = async (provider: 'apple' | 'google' | 'email', emailValue?: string, passwordValue?: string) => {
    setLoading(provider);
    setError(null);
    
    console.log('🔐 SignInPage: handleLogin called', { provider, hasEmail: !!emailValue, hasPassword: !!passwordValue, formEmail: email, formPassword: '***' });
    
    try {
      let result;
      
      if (provider === 'email') {
        // For email login, we need credentials
        const loginEmail = emailValue || email;
        const loginPassword = passwordValue || password;
        
        console.log('📧 SignInPage: Email login attempt', { 
          email: loginEmail, 
          hasPassword: !!loginPassword,
          emailFromParam: !!emailValue,
          emailFromState: !!email,
          passwordFromParam: !!passwordValue,
          passwordFromState: !!password
        });
        
        if (!loginEmail || !loginPassword) {
          console.error('❌ SignInPage: Missing credentials', { loginEmail, hasPassword: !!loginPassword });
          setError('Please enter both email and password.');
          setLoading(null);
          return;
        }
        
        console.log('✅ SignInPage: Calling ApiService.login with credentials');
        result = await ApiService.login('email', { email: loginEmail, password: loginPassword });
      } else {
        // For Apple/Google, use OAuth flow
        console.log('🔐 SignInPage: OAuth login', provider);
        result = await ApiService.login(provider);
      }
      
      console.log('📡 SignInPage: Login result', { success: result.success, hasToken: !!result.token, error: result.error });
      
      if (result.success) {
        console.log('✅ SignInPage: Login successful! Token stored.');
        
        // If email needs confirmation, navigate to onboarding instead of home
        if ((result as any).needsConfirmation) {
          console.log('⚠️ Email confirmation needed, navigating to onboarding');
          navigate('/onboarding');
        } else {
          // Force books to reload by dispatching event and then navigating
          window.dispatchEvent(new Event('authTokenUpdated'));
          // Small delay to ensure token is stored before navigation
          setTimeout(() => {
            navigate('/home');
            // Force a page refresh to ensure books reload
            window.location.hash = '#/home';
          }, 100);
        }
      } else {
        console.error('❌ SignInPage: Login failed', result.error);
        setError(result.error || 'Login failed. Please try again.');
        setLoading(null);
      }
    } catch (err) {
      console.error('❌ SignInPage: Login exception', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(null);
    }
  };

  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 SignInPage: Form submitted', { email, hasPassword: !!password });
    if (!email || !password) {
      console.error('❌ SignInPage: Form validation failed', { email, hasPassword: !!password });
      setError('Please enter both email and password.');
      return;
    }
    handleLogin('email', email, password);
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-y-auto no-scrollbar px-6 py-6">
      
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 z-30 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 active:scale-95 transition-transform"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center pt-12 pb-10 max-w-md mx-auto w-full">
          
          {/* Header Sign */}
          <div className="relative mb-8 animate-in slide-in-from-top-10 duration-700">
             <div className="relative bg-[#CD853F] px-8 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl">
                 <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
                <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] uppercase">
                  Sign In
                </h1>
                {/* Nails */}
                <div className="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
             </div>
          </div>

          {/* Login Form Container */}
          <div className="w-full space-y-4 relative z-10">
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-white text-sm px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}
              
              {/* Sign In Form */}
              <form onSubmit={handleEmailFormSubmit} className="space-y-3">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading !== null}
                      className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
                      required
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading !== null}
                      className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email); // Pre-fill with current email
                        setShowForgotPassword(true);
                      }}
                      className="text-white/70 text-sm hover:text-white transition-colors underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <WoodButton 
                  type="submit"
                  fullWidth 
                  variant="primary" 
                  disabled={loading !== null || !email || !password}
                >
                  {loading === 'email' ? 'Signing in...' : 'Sign In with Email'}
                </WoodButton>
              </form>

              <div className="relative py-2 flex items-center justify-center opacity-70 mt-4">
                <div className="h-px bg-white/40 w-full"></div>
                <span className="px-2 text-white text-xs font-bold uppercase">New here?</span>
                <div className="h-px bg-white/40 w-full"></div>
              </div>

              <button
                onClick={() => navigate('/onboarding')}
                className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-4 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all"
              >
                Get Started
              </button>

              {/* Restore Purchases Section */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <button
                  onClick={handleRestorePurchases}
                  disabled={isRestoring}
                  className="w-full flex items-center justify-center gap-2 text-white/70 hover:text-white text-sm py-2 transition-colors disabled:opacity-50"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Restore Previous Subscription
                    </>
                  )}
                </button>
                
                {restoreResult && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-sm text-center ${
                    restoreResult.type === 'success' 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : restoreResult.type === 'error'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {restoreResult.message.includes('hello@kbpublish.org') 
                      ? restoreResult.message.split('hello@kbpublish.org').map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <a 
                                href="mailto:hello@kbpublish.org?subject=Subscription%20Support%20Request" 
                                className="text-yellow-300 underline font-semibold"
                              >
                                hello@kbpublish.org
                              </a>
                            )}
                          </span>
                        ))
                      : restoreResult.message
                    }
                  </div>
                )}
              </div>

              <p className="text-center text-white/60 text-xs mt-4">
                By continuing you agree to our Terms & Conditions
              </p>
          </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeForgotPasswordModal}
          />
          
          {/* Modal */}
          <div className="relative bg-gradient-to-b from-[#5c3d2e] to-[#3e2a1e] rounded-2xl border-4 border-[#8B4513] shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={closeForgotPasswordModal}
              className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            {/* Title */}
            <h2 className="text-white font-display font-bold text-xl mb-2 text-center">
              Reset Password
            </h2>
            
            {forgotSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="text-green-400" size={32} />
                </div>
                <p className="text-white mb-2">Check your email!</p>
                <p className="text-white/70 text-sm mb-4">
                  If an account exists with <span className="text-[#FFD700]">{forgotEmail}</span>, you'll receive password reset instructions.
                </p>
                <p className="text-white/50 text-xs mb-4">
                  Didn't receive an email? Check your spam folder or contact us at <span className="text-[#FFD700]">support@godlykids.com</span>
                </p>
                <WoodButton onClick={closeForgotPasswordModal} fullWidth>
                  Back to Sign In
                </WoodButton>
              </div>
            ) : (
              <>
                <p className="text-white/70 text-sm text-center mb-4">
                  Enter your email address and we'll send you instructions to reset your password.
                </p>
                
                {forgotError && (
                  <div className="bg-red-500/20 border border-red-500/50 text-white text-sm px-3 py-2 rounded-lg mb-3">
                    {forgotError}
                  </div>
                )}
                
                <div className="relative mb-4">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={forgotLoading}
                    className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
                    autoFocus
                  />
                </div>
                
                <WoodButton 
                  onClick={handleForgotPassword}
                  fullWidth
                  disabled={forgotLoading || !forgotEmail}
                >
                  {forgotLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </WoodButton>
                
                <button
                  onClick={closeForgotPasswordModal}
                  className="w-full text-white/60 text-sm mt-3 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SignInPage;

