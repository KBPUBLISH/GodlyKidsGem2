import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { getApiBaseUrl } from '../services/apiService';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifying(false);
        return;
      }
      
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}password-reset/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          setTokenValid(true);
          setEmail(data.email);
        } else {
          setError(data.message || 'Invalid or expired reset link.');
        }
      } catch (err) {
        setError('Unable to verify reset link. Please try again.');
      } finally {
        setVerifying(false);
      }
    };
    
    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}password-reset/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center px-6">
        <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
        <p className="text-white/80">Verifying reset link...</p>
      </div>
    );
  }

  // No token or invalid token
  if (!token || !tokenValid) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center px-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-white font-display font-bold text-xl mb-2">Invalid Reset Link</h1>
          <p className="text-white/70 mb-6">
            {error || 'This password reset link is invalid or has expired.'}
          </p>
          <WoodButton onClick={() => navigate('/sign-in')} fullWidth>
            Back to Sign In
          </WoodButton>
        </div>
      </div>
    );
  }

  // Try to open the app via deep link
  const handleOpenApp = () => {
    // Try to open the app with custom URL scheme
    const appDeepLink = 'godlykids://signin';
    const webFallback = 'https://app.godlykids.com/#/signin';
    
    // Create a hidden iframe to try opening the app
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Set a timeout - if the app doesn't open, redirect to web
    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      // App didn't open, go to web sign-in
      window.location.href = webFallback;
    }, 2500);
    
    // Try to open the app
    iframe.src = appDeepLink;
    
    // If we're still here after a moment, app might have opened
    window.addEventListener('blur', () => {
      clearTimeout(timeout);
      document.body.removeChild(iframe);
    }, { once: true });
  };

  // Success state
  if (success) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center px-6" style={{ paddingTop: 'var(--safe-area-top, 0px)' }}>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-white font-display font-bold text-xl mb-2">Password Reset!</h1>
          <p className="text-white/70 mb-6">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <WoodButton onClick={handleOpenApp} fullWidth>
            Open App & Sign In
          </WoodButton>
          <button
            onClick={() => navigate('/signin')}
            className="w-full text-white/60 text-sm mt-3 hover:text-white transition-colors underline"
          >
            Or sign in on web
          </button>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="flex flex-col h-full w-full items-center justify-center px-6" style={{ paddingTop: 'var(--safe-area-top, 0px)' }}>
      <div className="w-full max-w-md">
        {/* Header Sign */}
        <div className="relative mb-8 animate-in slide-in-from-top-10 duration-700">
          <div className="relative bg-[#CD853F] px-8 py-3 rounded-xl border-b-[6px] border-[#8B4513] shadow-xl mx-auto w-fit">
            <div className="absolute inset-0 opacity-20 rounded-xl pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #3E1F07 10px, #3E1F07 12px)'}}></div>
            <h1 className="relative font-display font-extrabold text-[#5c2e0b] text-xl tracking-widest drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] uppercase">
              Reset Password
            </h1>
            {/* Nails */}
            <div className="absolute top-1/2 -translate-y-1/2 left-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
            <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 bg-[#3e1f07] rounded-full"></div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <p className="text-white/80 text-sm text-center mb-4">
            Create a new password for <span className="text-[#FFD700] font-semibold">{email}</span>
          </p>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-white text-sm px-4 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
                required
                minLength={6}
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
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <WoodButton 
              type="submit"
              fullWidth 
              variant="primary" 
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </WoodButton>
          </form>
          
          <button
            onClick={() => navigate('/sign-in')}
            className="w-full text-white/60 text-sm mt-4 hover:text-white transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

