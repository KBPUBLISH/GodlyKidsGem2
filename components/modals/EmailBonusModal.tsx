import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Gift, Sparkles, X, Check, Bell } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import WoodButton from '../ui/WoodButton';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://godlykids-backend.onrender.com';

interface EmailBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, optIn: boolean) => void;
  onSkip: () => void;
  parentName?: string;
  kidsCount?: number;
}

const EmailBonusModal: React.FC<EmailBonusModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSkip,
  parentName,
  kidsCount
}) => {
  const [email, setEmail] = useState('');
  const [optInUpdates, setOptInUpdates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Detect platform (including DeSpia native app)
  const getPlatform = (): 'ios' | 'android' | 'web' => {
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform() as 'ios' | 'android';
    }
    // Check user agent for DeSpia native app or mobile web
    const ua = navigator.userAgent.toLowerCase();
    const isDespia = ua.includes('despia');
    
    if (isDespia) {
      // DeSpia app - detect iOS or Android from user agent
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/android/.test(ua)) return 'android';
      return 'ios'; // Default DeSpia to iOS if can't detect
    }
    
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'web';
  };

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/email-subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          source: 'onboarding_bonus',
          platform: getPlatform(),
          parentName,
          kidsCount,
          optInUpdates,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccess(true);
        // Wait for animation then call onSubmit
        setTimeout(() => {
          onSubmit(email, optInUpdates);
        }, 1500);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Error subscribing:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setError(null);
      setShowSuccess(false);
      setOptInUpdates(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onSkip()}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-gradient-to-b from-[#1a237e] via-[#0d1442] to-[#0a0f2d] rounded-3xl overflow-hidden shadow-2xl border-2 border-[#FFD700]/30"
        >
          {/* Close Button */}
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          {/* Success State */}
          {showSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center"
              >
                <Check className="w-12 h-12 text-[#1a237e]" />
              </motion.div>
              
              <h3 className="text-2xl font-bold text-[#FFD700] mb-2">
                🎉 Bonus Unlocked!
              </h3>
              <p className="text-white/80 mb-4">
                <span className="text-[#FFD700] font-bold text-xl">+200 Gold Coins</span>
                <br />
                added to your account!
              </p>
              
              {/* Coin Animation */}
              <motion.div
                className="flex justify-center gap-2"
                initial="hidden"
                animate="visible"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: -30, opacity: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.8, repeat: Infinity }}
                    className="text-2xl"
                  >
                    🪙
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <>
              {/* Header with Gift Icon */}
              <div className="relative pt-8 pb-4 px-6 text-center">
                {/* Sparkles Background */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-[#FFD700]/30"
                      style={{
                        left: `${10 + i * 12}%`,
                        top: `${20 + (i % 3) * 20}%`,
                      }}
                      animate={{
                        opacity: [0.3, 0.8, 0.3],
                        scale: [0.8, 1.2, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.2,
                        repeat: Infinity,
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                  ))}
                </div>

                {/* Gift Icon */}
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative inline-block mb-4"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg shadow-[#FFD700]/30">
                    <Gift className="w-10 h-10 text-[#1a237e]" />
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white"
                  >
                    +200
                  </motion.div>
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  🎁 Get 200 Free Gold Coins!
                </h2>
                <p className="text-white/70 text-sm">
                  Unlock games, voices & avatar parts!
                </p>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {/* Email Input */}
                <div className="mb-4">
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Enter your email to claim:
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFD700]/60" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="your@email.com"
                      className="w-full pl-12 pr-4 py-4 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm mt-2"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                {/* Opt-in Checkbox */}
                <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                  <div
                    onClick={() => setOptInUpdates(!optInUpdates)}
                    className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      optInUpdates
                        ? 'bg-[#FFD700] border-[#FFD700]'
                        : 'bg-white/10 border-white/30 group-hover:border-white/50'
                    }`}
                  >
                    {optInUpdates && <Check className="w-4 h-4 text-[#1a237e]" />}
                  </div>
                  <span className="text-white/70 text-sm leading-tight">
                    <Bell className="inline w-4 h-4 mr-1 text-[#FFD700]" />
                    Send me updates about new exciting stories, features & special offers!
                  </span>
                </label>

                {/* Claim Button */}
                <WoodButton
                  fullWidth
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="py-4 text-lg mb-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Claiming...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      🪙 Claim 200 Gold Coins
                    </span>
                  )}
                </WoodButton>

                {/* Skip Link */}
                <button
                  onClick={onSkip}
                  className="w-full text-center text-white/50 text-sm hover:text-white/70 transition-colors py-2"
                >
                  No thanks, continue without bonus →
                </button>

                {/* Privacy Note */}
                <p className="text-center text-white/30 text-xs mt-4">
                  🔒 Your email is safe with us. We'll never spam you.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailBonusModal;
