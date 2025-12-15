import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiService } from '../services/apiService';
import { Check, Sparkles, Gift, Shield, Heart, Play } from 'lucide-react';

interface InfluencerData {
    name: string;
    code: string;
    discountPercent: number;
    trialDays: number;
    customSettings?: {
        headline?: string;
        subheadline?: string;
        imageUrl?: string;
        videoUrl?: string;
    };
}

const InfluencerLandingPage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    
    const [influencer, setInfluencer] = useState<InfluencerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Success state
    const [signupSuccess, setSignupSuccess] = useState(false);

    useEffect(() => {
        const loadInfluencer = async () => {
            if (!code) {
                setError('Invalid referral link');
                setLoading(false);
                return;
            }

            try {
                // Track the click
                await ApiService.trackInfluencerClick(code);
                
                // Get influencer info
                const data = await ApiService.getInfluencer(code);
                if (data) {
                    setInfluencer(data);
                    // Store code in localStorage for later attribution
                    localStorage.setItem('godlykids_influencer_code', code.toUpperCase());
                } else {
                    setError('This referral code is not valid or has expired');
                }
            } catch (err) {
                setError('Failed to load referral information');
            } finally {
                setLoading(false);
            }
        };

        loadInfluencer();
    }, [code]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validation
        if (!email || !password) {
            setFormError('Please fill in all fields');
            return;
        }
        if (password.length < 6) {
            setFormError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setFormError('Passwords do not match');
            return;
        }

        setIsSubmitting(true);

        try {
            // Create account
            const result = await ApiService.signUp(email, password);
            
            if (result.success && result.user) {
                // Track signup with influencer
                if (code) {
                    await ApiService.trackInfluencerSignup(code, result.user._id || result.user.id, email);
                }
                
                // Store influencer info for onboarding to use
                localStorage.setItem('godlykids_influencer_code', code?.toUpperCase() || '');
                localStorage.setItem('godlykids_influencer_discount', String(influencer?.discountPercent || 0));
                localStorage.setItem('godlykids_influencer_trial', String(influencer?.trialDays || 7));
                
                setSignupSuccess(true);
                
                // Redirect to onboarding after a brief delay
                // The onboarding page has the full payment flow
                setTimeout(() => {
                    navigate('/onboarding');
                }, 1500);
            } else {
                setFormError(result.error || 'Failed to create account. Please try again.');
            }
        } catch (err) {
            setFormError('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !influencer) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">😕</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Oops!</h1>
                    <p className="text-white/80 mb-6">{error || 'Something went wrong'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-[#FFD700] text-[#1a237e] font-bold rounded-full hover:bg-[#FFC000] transition-all"
                    >
                        Go to Godly Kids
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-64 h-64 bg-[#FFD700]/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-12">
                {/* Logo */}
                <div className="mb-8">
                    <img 
                        src="/assets/images/icon.png" 
                        alt="Godly Kids" 
                        className="w-20 h-20 rounded-2xl shadow-lg"
                    />
                </div>

                {/* Main Card */}
                <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#1a237e] px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                            <Gift className="w-4 h-4" />
                            {influencer.discountPercent}% OFF + {influencer.trialDays}-Day Free Trial
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {influencer.customSettings?.headline || `${influencer.name} Recommends Godly Kids!`}
                        </h1>
                        <p className="text-white/80">
                            {influencer.customSettings?.subheadline || 'Faith-based stories, lessons & games for your little ones'}
                        </p>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <Sparkles className="w-6 h-6 text-[#FFD700] mx-auto mb-1" />
                            <p className="text-white text-xs">Interactive Stories</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <Heart className="w-6 h-6 text-pink-400 mx-auto mb-1" />
                            <p className="text-white text-xs">Daily Devotionals</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <Play className="w-6 h-6 text-green-400 mx-auto mb-1" />
                            <p className="text-white text-xs">Video Lessons</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <Shield className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                            <p className="text-white text-xs">Kid-Safe Content</p>
                        </div>
                    </div>

                    {/* Signup Form */}
                    {!signupSuccess ? (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div>
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                                    required
                                />
                            </div>

                            {formError && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-200 text-sm text-center">
                                    {formError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a237e] font-bold text-lg rounded-xl hover:from-[#FFC000] hover:to-[#FF9500] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-[#1a237e]/30 border-t-[#1a237e] rounded-full animate-spin"></div>
                                        Creating Account...
                                    </span>
                                ) : (
                                    `Start ${influencer.trialDays}-Day Free Trial`
                                )}
                            </button>

                            <p className="text-white/60 text-xs text-center">
                                By signing up, you agree to our Terms of Service and Privacy Policy
                            </p>
                        </form>
                    ) : (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Welcome to Godly Kids!</h3>
                            <p className="text-white/80 mb-2">Your {influencer?.discountPercent}% discount has been applied!</p>
                            <p className="text-white/60 text-sm mb-4">Setting up your account...</p>
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                        </div>
                    )}
                </div>

                {/* Already have account */}
                <p className="mt-6 text-white/60 text-sm">
                    Already have an account?{' '}
                    <button 
                        onClick={() => navigate('/signin')}
                        className="text-[#FFD700] hover:underline"
                    >
                        Sign in
                    </button>
                </p>
            </div>

        </div>
    );
};

export default InfluencerLandingPage;

