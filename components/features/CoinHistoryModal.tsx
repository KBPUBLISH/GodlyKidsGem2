import React, { useState, useEffect } from 'react';
import { X, Coins, Gift, BookOpen, Gamepad2, Calendar, Users, ShoppingBag, TrendingUp, TrendingDown, Share2, Copy, Check, Sparkles, Mic, User, ArrowRight } from 'lucide-react';
import { useUser, CoinTransaction } from '../../context/UserContext';

interface CoinHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShop: () => void;
}

const getSourceIcon = (source: CoinTransaction['source']) => {
  switch (source) {
    case 'quiz':
      return <BookOpen className="w-4 h-4" />;
    case 'lesson':
      return <Calendar className="w-4 h-4" />;
    case 'game':
      return <Gamepad2 className="w-4 h-4" />;
    case 'daily':
      return <Gift className="w-4 h-4" />;
    case 'referral':
      return <Users className="w-4 h-4" />;
    case 'purchase':
      return <ShoppingBag className="w-4 h-4" />;
    default:
      return <Coins className="w-4 h-4" />;
  }
};

const getSourceColor = (source: CoinTransaction['source']) => {
  switch (source) {
    case 'quiz':
      return 'bg-blue-500/20 text-blue-400';
    case 'lesson':
      return 'bg-purple-500/20 text-purple-400';
    case 'game':
      return 'bg-green-500/20 text-green-400';
    case 'daily':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'referral':
      return 'bg-pink-500/20 text-pink-400';
    case 'purchase':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
};

const CoinHistoryModal: React.FC<CoinHistoryModalProps> = ({ isOpen, onClose, onOpenShop }) => {
  const { coins, coinTransactions, referralCode, redeemCode } = useUser();
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'earn' | 'history'>('earn');

  // Hide BottomNavigation when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    
    return () => {
      document.body.removeAttribute('data-modal-open');
    };
  }, [isOpen]);
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = async () => {
    const shareData = {
      title: 'Join Godly Kids! 🌟',
      text: `Hey! Use my special code ${referralCode} when you join Godly Kids and we BOTH get 100 gold coins! 🪙✨`,
      url: 'https://app.godlykids.com',
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        handleCopyCode();
      }
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  const handleRedeemCode = () => {
    if (!codeInput.trim()) {
      setRedeemMessage({ type: 'error', text: 'Please enter a code!' });
      return;
    }
    
    const result = redeemCode(codeInput);
    setRedeemMessage({ 
      type: result.success ? 'success' : 'error', 
      text: result.message 
    });
    
    if (result.success) {
      setCodeInput('');
      setTimeout(() => setRedeemMessage(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md max-h-[90vh] bg-gradient-to-b from-[#2a1810] to-[#1a0f08] rounded-3xl border-2 border-[#8B4513]/50 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[#8B4513]/30">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
          
          {/* Coin Balance */}
          <div className="text-center">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[#FFD700]/20 to-[#B8860B]/20 px-6 py-3 rounded-2xl border border-[#FFD700]/30">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-[#FFE55C] to-[#DAA520] rounded-full border-2 border-[#B8860B] shadow-lg flex items-center justify-center animate-pulse">
                  <span className="text-[#5c2e0b] font-black text-xl">G</span>
                </div>
                <div className="absolute top-1 left-1 w-3 h-3 bg-white/40 rounded-full"></div>
              </div>
              <div className="text-left">
                <p className="text-white/60 text-xs font-medium">Your Gold Coins</p>
                <p className="text-[#FFD700] font-black text-3xl font-display">
                  {coins.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#8B4513]/30">
          <button
            onClick={() => setActiveTab('earn')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'earn'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700] bg-[#FFD700]/10'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Earn More
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === 'history'
                ? 'text-[#FFD700] border-b-2 border-[#FFD700] bg-[#FFD700]/10'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              History
            </span>
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'earn' ? (
            <div className="p-4 space-y-4">
              {/* What Can You Get Section */}
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-4 border border-purple-500/30">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FFD700]" />
                  What Can You Get?
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <Mic className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                    <p className="text-white/80 text-[10px] font-medium">New Voices</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <User className="w-6 h-6 text-green-400 mx-auto mb-1" />
                    <p className="text-white/80 text-[10px] font-medium">Avatar Parts</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-3 text-center">
                    <Gift className="w-6 h-6 text-pink-400 mx-auto mb-1" />
                    <p className="text-white/80 text-[10px] font-medium">& More!</p>
                  </div>
                </div>
              </div>

              {/* Ask Your Parents Section */}
              <div className="bg-gradient-to-br from-[#FFD700]/10 to-orange-500/10 rounded-2xl p-4 border border-[#FFD700]/30">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2 bg-[#FFD700]/20 rounded-xl shrink-0">
                    <Users className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Ask Your Parents! 👨‍👩‍👧</h3>
                    <p className="text-white/70 text-xs mt-1">
                      Share your special code with friends and family. When they join, you BOTH get <span className="text-[#FFD700] font-bold">100 gold coins!</span>
                    </p>
                  </div>
                </div>
                
                {/* Your Special Code */}
                <div className="bg-black/40 rounded-xl p-3 mb-3">
                  <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Your Family's Special Code</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gradient-to-r from-[#FFD700]/20 to-[#B8860B]/20 rounded-lg px-4 py-2 border border-[#FFD700]/30">
                      <p className="text-[#FFD700] font-mono font-bold text-xl tracking-wider text-center">
                        {referralCode}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className={`p-3 rounded-xl transition-all shrink-0 ${
                        copied 
                          ? 'bg-green-500/30 border border-green-500/50' 
                          : 'bg-[#8B4513]/50 border border-[#8B4513] hover:bg-[#8B4513]/70'
                      }`}
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-white/80" />
                      )}
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={handleShare}
                  className="w-full py-3 bg-gradient-to-r from-[#FFD700] to-[#B8860B] hover:from-[#FFE55C] hover:to-[#DAA520] rounded-xl font-bold text-[#5c2e0b] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
                >
                  <Share2 className="w-5 h-5" />
                  Share With Friends!
                </button>
              </div>

              {/* Got A Code? Section */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border border-green-500/30">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-green-400" />
                  Got A Code From A Friend?
                </h3>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value.toUpperCase());
                      setRedeemMessage(null);
                    }}
                    placeholder="Enter code here..."
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-center uppercase tracking-wider placeholder:text-white/30 focus:outline-none focus:border-green-500/50"
                    maxLength={20}
                  />
                  <button
                    onClick={handleRedeemCode}
                    className="px-4 py-3 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-white transition-all active:scale-[0.98] shrink-0"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
                
                {redeemMessage && (
                  <div className={`mt-2 p-2 rounded-lg text-center text-sm font-medium ${
                    redeemMessage.type === 'success' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {redeemMessage.text}
                  </div>
                )}
              </div>

              {/* Other Ways to Earn */}
              <div className="bg-black/20 rounded-2xl p-4 border border-white/10">
                <h3 className="text-white/80 font-bold text-sm mb-3">Other Ways to Earn Coins</h3>
                <div className="space-y-2 text-xs text-white/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span>Complete book quizzes (+10 per correct answer)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span>Finish daily lessons (+10-50 coins)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Play games (+10-50 coins)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span>Daily verse challenge (+10-50 coins)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="p-4">
              {coinTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-black/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coins className="w-10 h-10 text-white/20" />
                  </div>
                  <p className="text-white/50 text-sm font-medium">No transactions yet</p>
                  <p className="text-white/30 text-xs mt-2 max-w-[200px] mx-auto">
                    Start earning coins by completing quizzes, games, and lessons!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {coinTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      {/* Source Icon */}
                      <div className={`p-2 rounded-xl ${getSourceColor(transaction.source)}`}>
                        {getSourceIcon(transaction.source)}
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {transaction.reason}
                        </p>
                        <p className="text-white/40 text-xs">
                          {formatTimeAgo(transaction.timestamp)}
                        </p>
                      </div>
                      
                      {/* Amount */}
                      <div className={`flex items-center gap-1 font-bold text-sm ${
                        transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {transaction.amount > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="px-4 py-4 border-t border-[#8B4513]/30 bg-black/20">
          <button
            onClick={() => {
              onClose();
              onOpenShop();
            }}
            className="w-full py-3 bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#9B5523] hover:to-[#B0623D] rounded-xl font-bold text-[#FFD700] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg border-2 border-[#5c2e0b]"
          >
            <ShoppingBag className="w-5 h-5" />
            Spend Your Coins in the Shop!
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoinHistoryModal;
