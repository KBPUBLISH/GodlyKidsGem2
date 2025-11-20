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

      {/* --- SHIP ILLUSTRATION --- */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-md z-10 pointer-events-none">
         <div className="relative w-full aspect-square">
            <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl">
                {/* Back Flag */}
                <path d="M330,180 L360,170 L330,160 Z" fill="#F44336" />

                {/* Masts */}
                <rect x="195" y="50" width="10" height="200" fill="#D88E56" stroke="#5D4037" strokeWidth="2" />
                <rect x="120" y="100" width="8" height="140" fill="#D88E56" stroke="#5D4037" strokeWidth="2" />
                <rect x="270" y="80" width="8" height="150" fill="#D88E56" stroke="#5D4037" strokeWidth="2" />

                {/* Rear Sails (Right) */}
                <path d="M274,90 Q320,100 320,130 H274 Z" fill="#29B6F6" stroke="#01579B" strokeWidth="2" />
                <path d="M274,135 Q330,150 330,180 H274 Z" fill="#039BE5" stroke="#01579B" strokeWidth="2" />

                {/* Main Sails (Center) */}
                <path d="M200,60 Q270,80 270,120 H200 Z" fill="#4FC3F7" stroke="#0277BD" strokeWidth="2" />
                <path d="M200,125 Q280,150 280,190 H200 Z" fill="#03A9F4" stroke="#0277BD" strokeWidth="2" />

                {/* Front Sails (Left) */}
                <path d="M124,110 Q170,120 170,150 H124 Z" fill="#81D4FA" stroke="#0277BD" strokeWidth="2" />
                <path d="M124,155 Q180,170 180,200 H124 Z" fill="#4FC3F7" stroke="#0277BD" strokeWidth="2" />

                {/* Bowsprit */}
                <path d="M300,220 L380,180 L300,240" stroke="#8D6E63" strokeWidth="6" strokeLinecap="round" />

                {/* Hull */}
                <path d="M80,220 Q200,320 320,220 L300,200 H100 Z" fill="#FFA726" stroke="#E65100" strokeWidth="3" />
                {/* Hull Details (Wood Planks) */}
                <path d="M95,220 Q200,300 310,220" fill="none" stroke="#E65100" strokeWidth="2" opacity="0.5" />
                <path d="M110,235 Q200,290 290,235" fill="none" stroke="#E65100" strokeWidth="2" opacity="0.5" />
                <path d="M130,255 Q200,290 270,255" fill="none" stroke="#E65100" strokeWidth="2" opacity="0.5" />

                {/* Railing */}
                <path d="M90,210 L100,220 M310,210 L300,220" stroke="#5D4037" strokeWidth="3" />
                <rect x="100" y="195" width="200" height="25" rx="5" fill="#8D6E63" stroke="#5D4037" strokeWidth="2" />
                
                {/* Windows */}
                <circle cx="140" cy="230" r="6" fill="#3E2723" />
                <circle cx="180" cy="240" r="6" fill="#3E2723" />
                <circle cx="220" cy="240" r="6" fill="#3E2723" />
                <circle cx="260" cy="230" r="6" fill="#3E2723" />
                
                {/* Flag on Main Mast */}
                <path d="M195,50 L160,65 L195,80 Z" fill="#0288D1" />
                <text x="165" y="72" fontSize="8" fill="white" fontWeight="bold">GODLY</text>
            </svg>
         </div>
      </div>


      {/* --- OCEAN / UI SECTION --- */}
      <div className="absolute bottom-0 left-0 right-0 h-[50%] z-20">
          {/* Wave Graphic Divider */}
          <div className="absolute -top-16 left-0 right-0 h-20 w-full overflow-hidden">
               <svg viewBox="0 0 1440 320" className="w-full h-full" preserveAspectRatio="none">
                  {/* Back Wave (Lighter) */}
                  <path fill="#4FC3F7" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,208C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                  {/* Front Wave (Darker Main Blue) */}
                  <path fill="#039BE5" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,128C960,128,1056,192,1152,208C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" transform="translate(0, 50)"></path>
               </svg>
          </div>

          {/* Underwater Blue Background */}
          <div className="absolute inset-0 top-2 bg-gradient-to-b from-[#039BE5] to-[#023e8a] flex flex-col items-center px-8 pt-4">
              
              {/* Bubble Particles */}
              <div className="absolute bottom-10 left-10 w-4 h-4 rounded-full bg-white/20 animate-[bounce_3s_infinite]"></div>
              <div className="absolute bottom-20 right-20 w-6 h-6 rounded-full bg-white/10 animate-[bounce_5s_infinite]"></div>
              
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
                    onClick={() => navigate('/home')}
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