import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Coins, 
  User, 
  Clock, 
  Music,
  BookOpen,
  CheckCircle,
  ShoppingCart
} from 'lucide-react';
import { tokenService, HubPlaylist } from '../services/tokenService';

const HubPlaylistDetailPage: React.FC = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  
  const [playlist, setPlaylist] = useState<HubPlaylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(false);
  const [balance, setBalance] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [showInsufficientTokens, setShowInsufficientTokens] = useState(false);

  useEffect(() => {
    if (playlistId) {
      fetchData();
    }
  }, [playlistId]);

  const fetchData = async () => {
    try {
      const [playlistData, ownsData, balanceData] = await Promise.all([
        tokenService.getPlaylist(playlistId!),
        tokenService.ownsContent(playlistId!),
        tokenService.getBalance(),
      ]);
      
      setPlaylist(playlistData);
      setOwned(ownsData);
      setBalance(balanceData);
    } catch (error) {
      console.error('Error loading playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!playlist) return;
    
    if (balance < playlist.priceTokens) {
      setShowInsufficientTokens(true);
      return;
    }
    
    setPurchasing(true);
    try {
      const result = await tokenService.purchaseContent(playlist._id);
      
      if (result.success) {
        setOwned(true);
        setBalance(result.newBalance || balance - playlist.priceTokens);
        // Show success message or navigate to player
      } else {
        alert(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePlay = (itemIndex: number) => {
    if (!owned) {
      handlePurchase();
      return;
    }
    
    // Navigate to player with the playlist and item index
    navigate(`/hub/player/${playlistId}?start=${itemIndex}`);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-4">
        <p className="text-gray-500 mb-4">Content not found</p>
        <button
          onClick={() => navigate('/hub')}
          className="text-indigo-600"
        >
          Back to Hub
        </button>
      </div>
    );
  }

  const totalDuration = playlist.items.reduce((sum, item) => sum + (item.duration || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Image */}
      <div className="relative h-64 bg-gradient-to-b from-indigo-600 to-purple-600">
        {playlist.coverImage && (
          <img
            src={playlist.coverImage}
            alt={playlist.title}
            className="w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-black/30 backdrop-blur rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Ownership Badge */}
        {owned && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Owned
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative -mt-20 px-4 pb-32">
        {/* Cover & Info */}
        <div className="flex gap-4 mb-6">
          <div className="w-32 h-32 rounded-xl overflow-hidden shadow-lg flex-shrink-0 bg-gray-200">
            {playlist.coverImage ? (
              <img
                src={playlist.coverImage}
                alt={playlist.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                {playlist.type === 'Audiobook' ? (
                  <BookOpen className="w-12 h-12 text-gray-300" />
                ) : (
                  <Music className="w-12 h-12 text-gray-300" />
                )}
              </div>
            )}
          </div>
          <div className="flex-1 pt-4">
            <h1 className="text-xl font-bold text-white mb-1">{playlist.title}</h1>
            <button
              onClick={() => navigate(`/hub/creator/${playlist.creatorId._id}`)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-2"
            >
              {playlist.creatorId.profileImage ? (
                <img
                  src={playlist.creatorId.profileImage}
                  alt={playlist.creatorId.name}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              <span className="text-sm">{playlist.creatorId.name}</span>
            </button>
            <div className="flex items-center gap-3 text-xs text-white/60">
              <span>{playlist.type}</span>
              <span>•</span>
              <span>{playlist.items.length} episodes</span>
              {totalDuration > 0 && (
                <>
                  <span>•</span>
                  <span>{formatDuration(totalDuration)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {playlist.description && (
          <p className="text-gray-600 text-sm mb-6">{playlist.description}</p>
        )}

        {/* Purchase/Play Button */}
        {!owned ? (
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 mb-6 disabled:opacity-50"
          >
            {purchasing ? (
              'Processing...'
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Purchase for {playlist.priceTokens} Tokens
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => handlePlay(0)}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-medium flex items-center justify-center gap-2 mb-6"
          >
            <Play className="w-5 h-5" />
            Play Now
          </button>
        )}

        {/* Token Balance */}
        <div className="flex items-center justify-between bg-gray-100 rounded-xl p-3 mb-6">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-gray-600">Your Balance</span>
          </div>
          <span className="font-bold text-gray-900">{balance} Tokens</span>
        </div>

        {/* Episodes List */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              {playlist.type === 'Audiobook' ? 'Episodes' : 'Tracks'}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {playlist.items.map((item, index) => (
              <button
                key={item._id}
                onClick={() => handlePlay(index)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {owned ? (
                    <Play className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <span className="text-sm text-gray-400">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  {item.duration && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(item.duration)}
                    </p>
                  )}
                </div>
                {!owned && (
                  <Coins className="w-4 h-4 text-gray-300" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Insufficient Tokens Modal */}
      {showInsufficientTokens && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Not Enough Tokens</h2>
              <p className="text-gray-500 text-sm">
                You need {playlist.priceTokens} tokens but only have {balance}.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowInsufficientTokens(false);
                  navigate('/hub?buyTokens=true');
                }}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
              >
                Buy Tokens
              </button>
              <button
                onClick={() => setShowInsufficientTokens(false)}
                className="w-full text-gray-600 py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubPlaylistDetailPage;
