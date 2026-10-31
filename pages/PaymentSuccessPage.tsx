import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import {LIVING_TEST_BUILD} from '../utils/livingTestMode';
import {completeWelcome} from '../utils/welcomeProgress';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscribe } = useUser();
  const subscribeRef=useRef(subscribe);subscribeRef.current=subscribe;
  const [welcomeReturn]=useState(()=>LIVING_TEST_BUILD&&searchParams.get('onboarding')==='1');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const isCreditPack = searchParams.get('credits') === '1';
  const continueAfterSubscription=()=>{if(welcomeReturn){completeWelcome('trial');navigate('/onboarding',{replace:true});}else navigate('/home',{replace:true});};

  useEffect(() => {
    const verifyPayment = async () => {
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

          if (data.success && data.kind === 'token_pack') {
            setStatus('success');
            setTimeout(() => {
              navigate('/listen', { replace: true, state: { libraryMode: 'creators' } });
            }, 2000);
            return;
          }

          if (data.success && data.isPremium) {
            console.log('✅ Payment verified! Granting premium...');
            localStorage.setItem('godlykids_premium', 'true');
            subscribeRef.current();
            setStatus('success');
            
            // Redirect to home after 2 seconds
            setTimeout(() => {
              continueAfterSubscription();
            }, 2000);
            return;
          }
        }

        if (isCreditPack) {
          setStatus('success');
          setTimeout(() => {
            navigate('/listen', { replace: true, state: { libraryMode: 'creators' } });
          }, 2000);
          return;
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
            subscribeRef.current();
            setStatus('success');
            
            setTimeout(() => {
              continueAfterSubscription();
            }, 2000);
            return;
          }
        }

        // If we get here, payment might still be processing
        // Give user option to retry or go home
        if(welcomeReturn){setErrorMessage('Your trial is not confirmed yet. You can try again or continue setup without it.');setStatus('error');return;}
        console.log('⚠️ Payment not yet confirmed');
        setStatus('success'); // Still show success - webhook might be delayed
        localStorage.setItem('godlykids_premium', 'true');
        subscribeRef.current();
        
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 2000);

      } catch (error: any) {
        console.error('❌ Payment verification error:', error);
        setErrorMessage(error.message || 'Failed to verify payment');
        setStatus('error');
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center px-6">
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
            <h1 className="text-3xl font-bold text-white mb-2">
              {isCreditPack ? 'Credits added!' : 'Welcome to Premium! 🎉'}
            </h1>
            <p className="text-white/60 mb-4">
              {isCreditPack ? 'Your credit pack is ready to spend on creator stories.' : 'Your subscription is now active.'}
            </p>
            <p className="text-[#FFD700] font-semibold">Redirecting to app...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={64} className="text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-white/60 mb-4">{errorMessage}</p>
            <p className="text-white/40 text-sm mb-6">
              If you completed the payment, your subscription should be active shortly. 
              Please try the "Restore Purchases" option.
            </p>
            <button
              onClick={() => {if(welcomeReturn)completeWelcome('tour');navigate(welcomeReturn?'/onboarding':'/home', { replace: true });}}
              className="bg-[#FFD700] text-[#1a1a2e] px-6 py-3 rounded-xl font-bold"
            >
              {welcomeReturn?'Continue setup':'Go to App'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccessPage;

