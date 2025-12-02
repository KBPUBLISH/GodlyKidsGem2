
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useUser } from '../context/UserContext';
import ParentGateModal from '../components/features/ParentGateModal';

const PaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useUser();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);

  const handleSubscribeClick = () => {
    // Show parent gate before processing
    setShowParentGate(true);
  };

  const handleGateSuccess = () => {
    // Simulate subscription process
    subscribe();
    // Navigate to home to show the "Gold Crown"
    navigate('/home');
  };

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#e0f7fa] via-[#b2ebf2] to-[#4dd0e1] overflow-y-auto no-scrollbar flex flex-col">
        {/* Close Button */}
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 z-50 p-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full text-[#006064] transition-colors"
        >
            <X size={24} strokeWidth={3} />
        </button>

        <div className="flex-1 flex flex-col items-center px-6 pt-12 pb-20 min-h-[600px]">
            
            {/* Brand Logo */}
            <div className="mb-8 flex flex-col items-center transform scale-110">
                 <h1 className="font-display font-extrabold text-4xl text-[#0277bd] drop-shadow-sm tracking-wide" style={{ WebkitTextStroke: '1.5px white', paintOrder: 'stroke fill' }}>
                    GODLY
                 </h1>
                 <h1 className="font-display font-extrabold text-4xl text-[#fdd835] drop-shadow-sm tracking-wide -mt-3" style={{ WebkitTextStroke: '1.5px white', paintOrder: 'stroke fill' }}>
                    KIDS
                 </h1>
            </div>

            {/* Main Card */}
            <div className="relative bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border-2 border-white flex flex-col items-center text-center animate-in slide-in-from-bottom-10 duration-700">
                
                <h2 className="text-[#004d40] font-display font-extrabold text-3xl leading-none mb-3 mt-2 drop-shadow-sm">
                    Unlock <br/>
                    <span className="text-[#00695c]">Bible Stories</span> <br/>
                    <span className="text-[#00695c]">& Adventures</span>
                </h2>

                <p className="text-[#006064] font-sans font-semibold text-sm mb-6 leading-tight px-4">
                    Safe, ad-free Christian stories kids love.
                </p>

                {/* Pricing Options */}
                <div className="w-full space-y-3 mb-6">
                    
                    {/* Annual Option */}
                    <div 
                        onClick={() => setSelectedPlan('annual')}
                        className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                            selectedPlan === 'annual' 
                            ? 'bg-[#e0f2f1] border-[#009688] shadow-md scale-[1.02] ring-1 ring-[#009688]' 
                            : 'bg-white/60 border-[#b2dfdb] opacity-90 hover:opacity-100'
                        }`}
                    >
                        {selectedPlan === 'annual' && (
                            <div className="bg-[#fdd835] py-1 text-center shadow-sm absolute top-0 left-0 right-0 z-10">
                                <span className="text-[#3e2723] text-[10px] font-extrabold uppercase tracking-widest">BEST VALUE</span>
                            </div>
                        )}
                        <div className={`px-4 ${selectedPlan === 'annual' ? 'pt-8 pb-3' : 'py-4'} flex items-center justify-between`}>
                            <div className="flex flex-col text-left">
                                <span className={`font-display font-bold text-lg ${selectedPlan === 'annual' ? 'text-[#004d40]' : 'text-[#546e7a]'}`}>Annual</span>
                                <span className="text-xs text-[#00796b] font-semibold bg-[#b2dfdb]/50 px-1.5 py-0.5 rounded-md w-fit">$1.54 / week</span>
                            </div>
                            <div className="flex flex-col items-end">
                                 <div className="flex items-center gap-1">
                                    <span className="font-display font-extrabold text-2xl text-[#00695c]">$79.99</span>
                                    <span className="text-xs text-[#004d40] font-bold">/yr</span>
                                 </div>
                            </div>
                        </div>
                        
                        {/* Checkmark circle */}
                        <div className={`absolute ${selectedPlan === 'annual' ? 'top-8' : 'top-1/2 -translate-y-1/2'} right-2 transition-all`}>
                            <div className={`rounded-full p-1 ${selectedPlan === 'annual' ? 'bg-[#009688] text-white' : 'bg-transparent border-2 border-[#b2dfdb]'}`}>
                                {selectedPlan === 'annual' && <Check size={12} strokeWidth={4} />}
                                {selectedPlan !== 'annual' && <div className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Option */}
                    <div 
                        onClick={() => setSelectedPlan('monthly')}
                        className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                            selectedPlan === 'monthly' 
                            ? 'bg-[#e0f2f1] border-[#009688] shadow-md scale-[1.02] ring-1 ring-[#009688]' 
                            : 'bg-white/60 border-[#b2dfdb] opacity-90 hover:opacity-100'
                        }`}
                    >
                        <div className="px-4 py-4 flex items-center justify-between">
                            <div className="flex flex-col text-left">
                                <span className={`font-display font-bold text-lg ${selectedPlan === 'monthly' ? 'text-[#004d40]' : 'text-[#546e7a]'}`}>Monthly</span>
                                <span className="text-xs text-[#00796b] font-semibold bg-[#b2dfdb]/50 px-1.5 py-0.5 rounded-md w-fit">Flexible</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1">
                                     <span className="font-display font-extrabold text-2xl text-[#00695c]">$11.99</span>
                                     <span className="text-xs text-[#004d40] font-bold">/mo</span>
                                </div>
                            </div>
                        </div>

                         {/* Checkmark circle */}
                        <div className="absolute top-1/2 -translate-y-1/2 right-2">
                            <div className={`rounded-full p-1 ${selectedPlan === 'monthly' ? 'bg-[#009688] text-white' : 'bg-transparent border-2 border-[#b2dfdb]'}`}>
                                {selectedPlan === 'monthly' && <Check size={12} strokeWidth={4} />}
                                {selectedPlan !== 'monthly' && <div className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                </div>

                {/* CTA Button */}
                <button 
                    onClick={handleSubscribeClick}
                    className="w-full bg-gradient-to-b from-[#009688] to-[#00796b] hover:from-[#26a69a] hover:to-[#00897b] text-white font-display font-bold text-lg py-4 rounded-2xl shadow-[0_4px_0_#004d40,0_8px_15px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-[0_0_0_#004d40] transition-all mb-8 border-t border-[#4db6ac] relative overflow-hidden group"
                >
                    <span className="relative z-10">
                        {selectedPlan === 'annual' ? 'Start Free Trial' : 'Subscribe Monthly'}
                    </span>
                    {/* Shine effect */}
                    <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] group-hover:animate-[shimmer_1s_infinite]"></div>
                </button>

                {/* Features */}
                <div className="space-y-3 text-left w-full pl-2 mb-2">
                    {[
                        "Bible-based stories",
                        "Interactive read-along lessons",
                        "Faith-building audio adventures",
                        "100% ad-free & safe"
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 text-[#00695c] font-bold text-sm group">
                             <div className="bg-[#b2dfdb] p-0.5 rounded-full text-[#00796b] group-hover:bg-[#fdd835] group-hover:text-[#3e2723] transition-colors">
                                <Check size={16} strokeWidth={4} />
                             </div>
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <p className="text-[#006064]/50 text-[10px] font-medium mt-8 text-center px-6 max-w-xs">
                Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period.
            </p>
        </div>

        <ParentGateModal 
            isOpen={showParentGate} 
            onClose={() => setShowParentGate(false)} 
            onSuccess={handleGateSuccess} 
        />
    </div>
  );
};

export default PaywallPage;