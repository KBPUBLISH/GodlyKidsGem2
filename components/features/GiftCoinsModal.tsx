import React, { useState } from 'react';
import { X, Gift, Coins, User, Minus, Plus, Send } from 'lucide-react';
import { useUser } from '../../context/UserContext';

interface GiftCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedKidId?: string;
}

const GiftCoinsModal: React.FC<GiftCoinsModalProps> = ({ isOpen, onClose, preselectedKidId }) => {
  const { coins, kids, giftCoinsToKid } = useUser();
  const [selectedKidId, setSelectedKidId] = useState<string | null>(preselectedKidId || null);
  const [amount, setAmount] = useState<number>(50);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isGifting, setIsGifting] = useState(false);

  if (!isOpen) return null;

  const selectedKid = kids.find(k => k.id === selectedKidId);
  const quickAmounts = [25, 50, 100, 250];

  const handleGift = async () => {
    if (!selectedKidId) {
      setMessage({ type: 'error', text: 'Please select a kid!' });
      return;
    }
    
    setIsGifting(true);
    const result = giftCoinsToKid(selectedKidId, amount);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    
    if (result.success) {
      setTimeout(() => {
        onClose();
        setMessage(null);
        setAmount(50);
      }, 1500);
    }
    setIsGifting(false);
  };

  const adjustAmount = (delta: number) => {
    setAmount(prev => Math.max(1, Math.min(coins, prev + delta)));
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-purple-100 via-pink-50 to-amber-100 pt-6 pb-4 px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full shadow-lg mb-3">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Gift Coins to Kid</h2>
          <p className="text-sm text-gray-600 mt-1">Share your coins with your children!</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Your balance */}
          <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <Coins className="w-5 h-5 text-amber-500" />
            <span className="text-gray-700">Your balance:</span>
            <span className="font-bold text-amber-600">{coins} coins</span>
          </div>

          {/* Kid Selection */}
          {kids.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No kids added yet!</p>
              <p className="text-sm">Add a kid profile first.</p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Kid</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {kids.map(kid => (
                  <button
                    key={kid.id}
                    onClick={() => setSelectedKidId(kid.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      selectedKidId === kid.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-800 truncate">{kid.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {kid.coins || 0} coins
                    </div>
                  </button>
                ))}
              </div>

              {/* Amount Selection */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              
              {/* Quick amounts */}
              <div className="flex gap-2 mb-3">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmount(Math.min(amt, coins))}
                    disabled={amt > coins}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      amount === amt
                        ? 'bg-amber-400 text-white'
                        : amt > coins
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>

              {/* Custom amount with +/- */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => adjustAmount(-10)}
                  disabled={amount <= 1}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1 px-4 py-2 bg-amber-100 rounded-xl min-w-[100px] justify-center">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span className="text-xl font-bold text-amber-700">{amount}</span>
                </div>
                <button
                  onClick={() => adjustAmount(10)}
                  disabled={amount >= coins}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-3 rounded-xl text-center mb-4 ${
                  message.type === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              {/* Gift button */}
              <button
                onClick={handleGift}
                disabled={!selectedKidId || amount <= 0 || amount > coins || isGifting}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {isGifting ? 'Sending...' : `Gift ${amount} Coins${selectedKid ? ` to ${selectedKid.name}` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiftCoinsModal;

