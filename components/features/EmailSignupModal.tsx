import React, { useState } from 'react';
import { X, Mail, Bell, Sparkles, CheckCircle } from 'lucide-react';
import { getApiBaseUrl } from '../../services/apiService';

interface EmailSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmailSignupModal: React.FC<EmailSignupModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const deviceId = localStorage.getItem('device_id') || `web_${Date.now()}`;
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}referrals/email-signup`;
      
      console.log('📧 Email signup request:', { url, deviceId, email });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          email,
          source: 'web_popup'
        })
      });

      console.log('📧 Email signup response status:', response.status);
      
      // Handle non-JSON responses (like 404 HTML pages)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('📧 Non-JSON response:', await response.text());
        setError('Server error. The feature may still be deploying - try again in a minute.');
        return;
      }

      let data;
      const responseText = await response.text();
      console.log('📧 Email signup raw response:', responseText);
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('📧 Failed to parse JSON:', parseError);
        setError('Server returned invalid response. Please try again.');
        return;
      }
      
      console.log('📧 Email signup parsed response:', data);

      if (data.success) {
        setIsSuccess(true);
        // Mark as submitted so we don't show again
        localStorage.setItem('gk_email_signup_submitted', 'true');
        
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('📧 Email signup error:', err);
      setError('Could not connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Mark as dismissed so we don't show again this session
    sessionStorage.setItem('gk_email_signup_dismissed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-3xl shadow-2xl border border-[#FFD700]/30 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Golden glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#FFD700]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#4A90D9]/20 rounded-full blur-3xl" />
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X size={18} className="text-white/70" />
        </button>

        <div className="relative p-6 sm:p-8">
          {isSuccess ? (
            // Success state
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-2">
                You're In! 🎉
              </h3>
              <p className="text-white/70">
                We'll notify you when exciting updates are ready!
              </p>
            </div>
          ) : (
            // Form state
            <>
              {/* Icon */}
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/30 rotate-3">
                <Bell size={32} className="text-[#1a1a2e]" />
              </div>

              {/* Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
                  Stay in the Loop! ✨
                </h3>
                <p className="text-white/70 text-sm sm:text-base">
                  Get notified about new stories, features, and special offers for your little ones.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700]/50 focus:ring-2 focus:ring-[#FFD700]/20 transition-all"
                    disabled={isSubmitting}
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a1a2e] font-display font-bold text-lg rounded-2xl shadow-lg shadow-yellow-500/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[#1a1a2e]/30 border-t-[#1a1a2e] rounded-full animate-spin" />
                      Signing up...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Notify Me
                    </>
                  )}
                </button>
              </form>

              {/* Privacy note */}
              <p className="text-center text-white/40 text-xs mt-4">
                We respect your privacy. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailSignupModal;

