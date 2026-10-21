import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import WoodButton from '../components/ui/WoodButton';
import ShippingAddressModal, { ShippingAddress } from '../components/modals/ShippingAddressModal';
import { Gift, Book, CheckCircle } from 'lucide-react';

/**
 * Free Book Claim Page
 * 
 * Shown after user completes 7-day reading challenge.
 * Allows them to claim their free physical book by providing shipping address.
 */
const FreeBookClaimPage: React.FC = () => {
  const navigate = useNavigate();
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClaimBook = () => {
    setShowAddressModal(true);
  };

  const handleAddressSubmit = async (address: ShippingAddress) => {
    setIsSubmitting(true);
    
    try {
      // TODO: Replace this with your actual API endpoint
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.godlykids.com';
      
      const response = await fetch(`${API_BASE_URL}/api/free-book-claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...address,
          userId: localStorage.getItem('godlykids_device_id'),
          claimedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit claim');
      }

      // Success
      setShowAddressModal(false);
      setSubmitted(true);
      
      // Mark as claimed in localStorage
      localStorage.setItem('gk_free_book_claimed', 'true');
    } catch (error) {
      console.error('Error submitting free book claim:', error);
      alert('Failed to submit your claim. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#0c2e4e] to-[#0a1f3a]">
        <Header title="Free Book Claimed" />
        
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <CheckCircle size={80} className="text-white" />
          </div>
          
          <h1 className="font-display font-bold text-3xl text-white mb-4">
            Book Claimed! 🎉
          </h1>
          
          <p className="text-white/80 text-lg mb-6 max-w-md leading-relaxed">
            Your free book will be mailed to you soon! Keep an eye on your mailbox in 2-3 weeks.
          </p>
          
          <p className="text-white/60 text-sm mb-8 max-w-md">
            Thank you for completing the 7-day reading challenge. Keep exploring God's Word!
          </p>
          
          <WoodButton
            onClick={() => navigate('/home')}
            variant="primary"
            className="px-8 py-4 text-lg"
          >
            Back to Home
          </WoodButton>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#0c2e4e] to-[#0a1f3a]">
      <Header title="Claim Your Free Book" />
      
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-auto">
        {/* Book Icon */}
        <div className="relative w-40 h-40 mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl animate-pulse opacity-30 blur-xl"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl flex items-center justify-center border-4 border-white/20 shadow-2xl">
            <Book size={80} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-red-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
            <Gift size={24} className="text-white" />
          </div>
        </div>

        {/* Congratulations Message */}
        <h1 className="font-display font-extrabold text-4xl text-white mb-4 tracking-tight">
          You Did It!
        </h1>
        
        <p className="text-white/90 text-xl font-bold mb-3">
          7-Day Challenge Complete 🎉
        </p>
        
        <p className="text-white/70 text-base mb-8 max-w-md leading-relaxed">
          You've earned a <span className="text-[#FFD700] font-bold">free physical Bible storybook</span>! 
          We'll mail it to you after you provide your shipping address.
        </p>

        {/* Stats */}
        <div className="flex gap-4 mb-10">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
            <div className="text-3xl font-bold text-[#FFD700]">7</div>
            <div className="text-white/60 text-xs uppercase tracking-wide">Days</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
            <div className="text-3xl font-bold text-[#FFD700]">✓</div>
            <div className="text-white/60 text-xs uppercase tracking-wide">Complete</div>
          </div>
        </div>

        {/* Claim Button */}
        <WoodButton
          onClick={handleClaimBook}
          variant="gold"
          className="px-12 py-5 text-xl shadow-[0_0_20px_rgba(255,215,0,0.5)] mb-6"
        >
          <Gift size={24} className="mr-2" />
          Get My Free Book
        </WoodButton>

        <p className="text-white/40 text-xs max-w-xs">
          * Free for U.S. residents. International shipping may apply.
        </p>
      </div>

      {/* Shipping Address Modal */}
      <ShippingAddressModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSubmit={handleAddressSubmit}
      />
    </div>
  );
};

export default FreeBookClaimPage;
