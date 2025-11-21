import React from 'react';
import { useNavigate } from 'react-router-dom';
import WoodButton from '../components/ui/WoodButton';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 
        NOTE: Background (Sky, Stars, Sunrise) is now handled globally in App.tsx > PanoramaBackground
        to support the swipe navigation effect.
      */}

      {/* --- FULL SCREEN SHIP BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <img 
           src="/assets/images/ship.jpg" 
           alt="Godly Kids Ship" 
           className="w-full h-full object-cover"
         />
      </div>

      {/* --- OCEAN / UI SECTION --- */}
      <div className="absolute bottom-0 left-0 right-0 h-[50%] z-20">
          {/* Bubble Particles - Keep visible */}
          <div className="absolute bottom-10 left-10 w-4 h-4 rounded-full bg-white/20 animate-[bounce_3s_infinite] z-30"></div>
          <div className="absolute bottom-20 right-20 w-6 h-6 rounded-full bg-white/10 animate-[bounce_5s_infinite] z-30"></div>

          {/* Content Container - Completely transparent background */}
          <div className="absolute inset-0 top-2 flex flex-col items-center px-8 pt-4">
              
              {/* App Title (Styled to look integrated) */}
              <div className="relative mb-8 text-center z-10">
                 <h1 className="font-display font-extrabold text-4xl text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.2)] tracking-wider">
                    GODLY KIDS
                 </h1>
                 <p className="text-blue-100 font-sans font-bold text-sm mt-1 opacity-90">
                    Adventure Awaits!
                 </p>
              </div>

              {/* Sign In and Guest Buttons */}
              <div className="w-full max-w-sm space-y-3 relative z-10">
                  <WoodButton 
                    onClick={() => navigate('/signin')}
                    fullWidth 
                    variant="primary"
                    className="py-4 text-lg"
                  >
                    Sign In
                  </WoodButton>

                  <button
                    onClick={() => navigate('/onboarding')}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold py-3 px-4 rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Continue as Guest
                  </button>

                  <p className="text-center text-white/60 text-xs mt-4">
                    By continuing you agree to our Terms & Conditions
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LandingPage;