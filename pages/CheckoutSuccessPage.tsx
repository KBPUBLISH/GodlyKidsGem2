import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Download, Sparkles } from 'lucide-react';
import { ApiService, getApiBaseUrl } from '../services/apiService';

const CheckoutSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState<any>(null);
    const [showAppLinks, setShowAppLinks] = useState(false);

    useEffect(() => {
        const fetchSession = async () => {
            if (sessionId) {
                try {
                    const baseUrl = getApiBaseUrl();
                    const response = await fetch(`${baseUrl}stripe/session/${sessionId}`);
                    if (response.ok) {
                        const data = await response.json();
                        setSessionData(data);
                        
                        // Store email for app login
                        if (data.email) {
                            localStorage.setItem('godlykids_checkout_email', data.email);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch session:', err);
                }
            }
            setLoading(false);
            
            // Show app download links after a delay
            setTimeout(() => setShowAppLinks(true), 1500);
        };
        
        fetchSession();
    }, [sessionId]);

    const handleOpenApp = () => {
        // Try to open the app via custom URL scheme
        window.location.href = 'godlykids://signin';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Success Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 text-center">
                    {/* Success Icon */}
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                        <Check className="w-10 h-10 text-white" strokeWidth={3} />
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome to Godly Kids! 🎉
                    </h1>
                    
                    <p className="text-white/80 mb-6">
                        Your subscription is now active. Your kids are going to love this!
                    </p>

                    {sessionData?.email && (
                        <div className="bg-white/10 rounded-xl p-4 mb-6">
                            <p className="text-white/60 text-sm mb-1">Account Email</p>
                            <p className="text-white font-semibold">{sessionData.email}</p>
                        </div>
                    )}

                    {/* Confetti Animation */}
                    <div className="flex justify-center gap-2 mb-6">
                        <Sparkles className="w-6 h-6 text-[#FFD700] animate-pulse" />
                        <Sparkles className="w-6 h-6 text-pink-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <Sparkles className="w-6 h-6 text-green-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>

                    {/* App Download Section */}
                    {showAppLinks && (
                        <div className={`transition-all duration-500 ${showAppLinks ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <p className="text-white font-semibold mb-4">
                                Download the app to get started:
                            </p>
                            
                            <div className="flex flex-col gap-3">
                                {/* App Store */}
                                <a
                                    href="https://apps.apple.com/app/godly-kids/id6743126081"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-3 bg-black text-white py-4 px-6 rounded-xl hover:bg-gray-900 transition-colors"
                                >
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                    </svg>
                                    <div className="text-left">
                                        <div className="text-xs opacity-80">Download on the</div>
                                        <div className="text-lg font-semibold">App Store</div>
                                    </div>
                                </a>

                                {/* Google Play */}
                                <a
                                    href="https://play.google.com/store/apps/details?id=com.godlykids.app"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-3 bg-black text-white py-4 px-6 rounded-xl hover:bg-gray-900 transition-colors"
                                >
                                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                                    </svg>
                                    <div className="text-left">
                                        <div className="text-xs opacity-80">Get it on</div>
                                        <div className="text-lg font-semibold">Google Play</div>
                                    </div>
                                </a>
                            </div>

                            <p className="text-white/50 text-xs mt-4">
                                Sign in with <strong>{sessionData?.email || 'your email'}</strong> to access your subscription
                            </p>
                        </div>
                    )}

                    {/* Already have app */}
                    <button
                        onClick={handleOpenApp}
                        className="mt-6 text-[#FFD700] hover:text-[#FFC000] text-sm font-medium underline"
                    >
                        I already have the app - Open it
                    </button>
                </div>

                {/* What's next */}
                <div className="mt-6 text-center">
                    <p className="text-white/60 text-sm">
                        Questions? Contact us at{' '}
                        <a href="mailto:hello@kbpublish.org" className="text-[#FFD700] hover:underline">
                            hello@kbpublish.org
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CheckoutSuccessPage;

