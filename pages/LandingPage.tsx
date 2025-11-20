import React from 'react';
import { useNavigate } from 'react-router-dom';
import WoodButton from '../components/ui/WoodButton';
import { Apple, Mail, LogIn } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Simulate login
    navigate('/home');
  };

  return (
    <div className="flex flex-col h-screen items-center justify-center px-6 relative overflow-hidden">
      {/* Background with sunrise effect handled in App Layout, enhancing here */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#FFD700] via-[#f59e0b] to-transparent opacity-20 bottom-0 h-1/3 pointer-events-none"></div>

      {/* Logo Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        {/* Placeholder for the Ship Logo */}
        <div className="relative w-64 h-64 mb-6">
            {/* Simplified Ship Illustration using CSS/SVG composition */}
             <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                {/* Hull */}
                <path d="M40,120 Q100,180 160,120 L150,100 H50 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2"/>
                <path d="M50,100 H150 V90 H50 Z" fill="#CD853F" />
                {/* Sails */}
                <path d="M100,90 V20 M100,30 Q140,50 140,80 H100" fill="#E0F7FA" stroke="#26C6DA" strokeWidth="1" />
                <path d="M100,90 V20 M100,30 Q60,50 60,80 H100" fill="#B2EBF2" stroke="#26C6DA" strokeWidth="1" />
                {/* Flag */}
                <path d="M100,20 L120,10 L100,10" fill="#FF0000" />
             </svg>
             <div className="absolute bottom-0 inset-x-0 text-center">
                <h1 className="text-5xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-200 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" style={{ WebkitTextStroke: '2px #0c2e4e' }}>
                  GODLY
                </h1>
                <h2 className="text-4xl font-display font-extrabold text-[#FFD700] drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" style={{ WebkitTextStroke: '1px #8B4513' }}>
                  KIDS
                </h2>
             </div>
        </div>

        <p className="text-center text-white font-bold text-lg mb-10 drop-shadow-md px-4">
          Faith Filled Content the whole family will enjoy <span className="text-yellow-300">✦</span>
        </p>

        <div className="w-full space-y-3 z-10">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-xl space-y-3">
                <p className="text-center text-xs text-yellow-100 mb-2 opacity-80">By continuing, you agree to Terms of Use</p>
                
                <WoodButton fullWidth variant="dark" onClick={handleLogin} className="flex items-center justify-center gap-2">
                   <Apple size={20} fill="white" /> Continue with Apple
                </WoodButton>

                <WoodButton fullWidth variant="light" onClick={handleLogin} className="flex items-center justify-center gap-2 text-[#5c2e0b]">
                   <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold">G</div> Continue with Google
                </WoodButton>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/30"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-transparent px-2 text-white font-bold drop-shadow">Or</span>
                    </div>
                </div>

                <WoodButton fullWidth variant="primary" onClick={handleLogin}>
                   Sign in
                </WoodButton>
                
                <WoodButton fullWidth variant="primary" onClick={handleLogin}>
                   Register with Email
                </WoodButton>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;