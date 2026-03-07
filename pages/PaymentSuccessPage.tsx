import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscribe } = useSubscription();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  const verifyPayment = useCallback(async () => {
      const sessionId = searchParams.get('session_id');
      
      console.log('🔍 Verifying Stripe payment...');
      console.log('   Session ID:', sessionId);

      // If no session_id, this might be a direct navigation after Stripe checkout
      // Stripe doesn't always append session_id if using mode: 'subscription'
      // In that case, we can check with the backend using the user's ID
      
      try {
        let API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
        API_BASE = API_BASE.replace(/\/+$/, '').replace(/\/api$/, '');

        if (sessionId) {
          // Verify the specific session
          const response = await fetch(`${API_BASE}/api/stripe/verify-session/${sessionId}`);
          const data = await response.json();
          
          console.log('🔍 Verification response:', data);

          if (data.success && data.isPremium) {
            console.log('✅ Payment verified! Granting premium...');
            localStorage.setItem('godlykids_premium', 'true');
            subscribe();
            setStatus('success');
            
            // Redirect to home after 2 seconds
            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 2000);
            return;
          }
        }

        // Fallback: Check user's purchase status via webhook endpoint
        const userId = localStorage.getItem('godlykids_user_email') || 
                       localStorage.getItem('godlykids_device_id');
        
        if (userId) {
          const statusResponse = await fetch(`${API_BASE}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
          const statusData = await statusResponse.json();
          
          console.log('🔍 User status response:', statusData);

          if (statusData.isPremium) {
            console.log('✅ User is premium! Granting access...');
            localStorage.setItem('godlykids_premium', 'true');
            subscribe();
            setStatus('success');
            
            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 2000);
            return;
          }
        }

        // Payment not yet confirmed - do NOT grant premium
        // Only grant when we have explicit verification (session or purchase-status)
        console.log('⚠️ Payment not yet confirmed - not granting premium');
        setStatus('error');
        setErrorMessage('Payment verification pending. If you just subscribed, wait a moment and tap Retry. Otherwise, go back and try again.');

      } catch (error: any) {
        console.error('❌ Payment verification error:', error);
        setErrorMessage(error.message || 'Failed to verify payment');
        setStatus('error');
      }
  }, [searchParams, navigate, subscribe]);

  useEffect(() => {
    verifyPayment();
  }, [verifyPayment]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center px-6" style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
      <div className="text-center">
        {status === 'verifying' && (
          <>
            <Loader2 size={64} className="text-[#FFD700] animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Payment...</h1>
            <p className="text-white/60">Please wait while we confirm your subscription.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="relative mb-6">
              <CheckCircle size={80} className="text-green-500 mx-auto" />
              <div className="absolute inset-0 animate-ping">
                <CheckCircle size={80} className="text-green-500/30 mx-auto" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Premium! 🎉</h1>
            <p className="text-white/60 mb-4">Your subscription is now active.</p>
            <p className="text-[#FFD700] font-semibold">Redirecting to app...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={64} className="text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-white/60 mb-4">{errorMessage}</p>
            <p className="text-white/40 text-sm mb-6">
              If you completed the payment, tap Retry. Otherwise, use "Restore Purchases" in the app.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setStatus('verifying');
                  setErrorMessage('');
                  void verifyPayment();
                }}
                className="bg-[#4CAF50] text-white px-6 py-3 rounded-xl font-bold"
              >
                Retry
              </button>
              <button
                onClick={() => navigate('/home', { replace: true })}
                className="bg-[#FFD700] text-[#1a1a2e] px-6 py-3 rounded-xl font-bold"
              >
                Go to App
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccessPage;

