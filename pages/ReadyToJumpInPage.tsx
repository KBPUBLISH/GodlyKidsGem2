import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Star, Shield, Sparkles, CheckCircle } from 'lucide-react';
import WoodButton from '../components/ui/WoodButton';
import { useTutorial } from '../context/TutorialContext';

// Animated background particles
const ParticleBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${5 + Math.random() * 10}s`,
          }}
        >
          <Sparkles 
            size={12 + Math.random() * 16} 
            className="text-[#FFD700]/30"
          />
        </div>
      ))}
    </div>
  );
};

// Social proof badges
const TRUST_BADGES = [
  { icon: Shield, text: 'Safe & Ad-Free' },
  { icon: Star, text: 'Parent Approved' },
  { icon: CheckCircle, text: 'Faith-Based Content' },
];

const ReadyToJumpInPage: React.FC = () => {
  const navigate = useNavigate();
  const { startTutorial } = useTutorial();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setIsAnimating(true);
    // Start the tutorial and navigate to welcome page (book selection)
    startTutorial();
    setTimeout(() => {
      navigate('/welcome');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f05] via-[#2d1a0a] to-[#3E1F07] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Animated Background */}
      <ParticleBackground />

      {/* Radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content */}
      <div 
        className={`relative z-10 max-w-md w-full flex flex-col items-center transition-all duration-700 ease-out ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${isAnimating ? 'scale-95 opacity-0' : ''}`}
      >
        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] mb-4 animate-pulse">
            Ready to Jump In?
          </h1>
          <p className="text-white/70 text-lg">
            Your adventure awaits!
          </p>
        </div>

        {/* Social Proof - Main Stat */}
        <div 
          className={`bg-gradient-to-r from-[#5c2e0b]/80 to-[#3E1F07]/80 backdrop-blur-sm rounded-2xl border-2 border-[#FFD700]/40 p-6 mb-8 w-full text-center transition-all duration-500 delay-200 ${
            showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Users className="text-[#FFD700]" size={28} />
            <span className="text-3xl font-display font-black text-[#FFD700]">
              12,244
            </span>
          </div>
          <p className="text-white font-semibold text-lg">
            Trusted by Christian Parents
          </p>
          <p className="text-white/60 text-sm mt-1">
            Join families growing in faith together
          </p>
        </div>

        {/* Trust Badges */}
        <div 
          className={`flex flex-wrap justify-center gap-3 mb-10 transition-all duration-500 delay-400 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {TRUST_BADGES.map((badge, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-full px-4 py-2"
            >
              <badge.icon size={16} className="text-[#FFD700]" />
              <span className="text-white/80 text-sm font-medium">
                {badge.text}
              </span>
            </div>
          ))}
        </div>

        {/* Features Preview */}
        <div 
          className={`w-full space-y-3 mb-10 transition-all duration-500 delay-500 ${
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-white/60 text-center text-sm mb-4">
            What you'll discover:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: '📚', label: 'Bible Stories' },
              { emoji: '🎧', label: 'Audio Dramas' },
              { emoji: '🏆', label: 'Earn Rewards' },
              { emoji: '❤️', label: 'Practice Giving' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-white/90 font-medium text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div 
          className={`w-full transition-all duration-500 delay-600 ${
            showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <WoodButton
            variant="gold"
            onClick={handleStart}
            className="w-full py-5 text-xl shadow-2xl"
          >
            <span className="flex items-center justify-center gap-2">
              Let's Go!
              <Sparkles size={22} className="animate-pulse" />
            </span>
          </WoodButton>

        </div>
      </div>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) rotate(10deg);
            opacity: 0.6;
          }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ReadyToJumpInPage;
