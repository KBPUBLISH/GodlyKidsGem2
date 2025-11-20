import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Apple, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { ApiService } from '../services/apiService';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        // Force books to reload by dispatching event and then navigating
        window.dispatchEvent(new Event('authTokenUpdated'));
        // Small delay to ensure token is stored before navigation
        setTimeout(() => {
          navigate('/home');
          // Force a page refresh to ensure books reload
          window.location.hash = '#/home';
        }, 100);
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
              
              <button 
                onClick={() => handleLogin('apple')} 
                disabled={loading !== null}
                className="w-full bg-white hover:bg-gray-50 text-black font-bold py-3 px-4 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <Apple size={20} />
                  <span>{loading === 'apple' ? 'Signing in...' : 'Continue with Apple'}</span>
              </button>

              <button 
                onClick={() => handleLogin('google')} 
                disabled={loading !== null}
                className="w-full bg-white hover:bg-gray-50 text-black font-bold py-3 px-4 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold border border-gray-300">G</div>
                  <span>{loading === 'google' ? 'Signing in...' : 'Continue with Google'}</span>
              </button>

              <div className="relative py-2 flex items-center justify-center opacity-70">
                    <div className="h-px bg-white/40 w-full"></div>
                    <span className="px-2 text-white text-xs font-bold uppercase">Or</span>
                    <div className="h-px bg-white/40 w-full"></div>
              </div>

              {/* Email Login Form */}
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

              <p className="text-center text-white/60 text-xs mt-4">
                By continuing you agree to our Terms & Conditions
              </p>
          </div>
      </div>
    </div>
  );
};

export default SignInPage;

