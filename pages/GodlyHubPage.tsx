import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, 
  Plus, 
  Music, 
  BookOpen, 
  User, 
  ChevronRight,
  Star,
  ShoppingBag
} from 'lucide-react';
import { tokenService, HubPlaylist, TokenBundle } from '../services/tokenService';

const GodlyHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [featured, setFeatured] = useState<HubPlaylist[]>([]);
  const [audiobooks, setAudiobooks] = useState<HubPlaylist[]>([]);
  const [music, setMusic] = useState<HubPlaylist[]>([]);
  const [myContent, setMyContent] = useState<HubPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuyTokens, setShowBuyTokens] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, featuredRes, audiobooksRes, musicRes, purchasedRes] = await Promise.all([
        tokenService.getBalance(),
        tokenService.getFeatured(),
        tokenService.browseHub({ type: 'Audiobook', limit: 6 }),
        tokenService.browseHub({ type: 'Song', limit: 6 }),
        tokenService.getPurchasedContent(),
      ]);
      
      setBalance(balanceRes);
      setFeatured(featuredRes);
      setAudiobooks(audiobooksRes.playlists);
      setMusic(musicRes.playlists);
      setMyContent(purchasedRes);
    } catch (error) {
      console.error('Error loading hub data:', error);
    } finally {
      setLoading(false);
    }
  };

  const ContentCard: React.FC<{ playlist: HubPlaylist; owned?: boolean }> = ({ playlist, owned }) => (
    <div
      onClick={() => navigate(`/hub/playlist/${playlist._id}`)}
      className="flex-shrink-0 w-40 cursor-pointer"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
        {playlist.coverImage ? (
          <img
            src={playlist.coverImage}
            alt={playlist.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {playlist.type === 'Audiobook' ? (
              <BookOpen className="w-12 h-12 text-gray-300" />
            ) : (
              <Music className="w-12 h-12 text-gray-300" />
            )}
          </div>
        )}
        {owned && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
            Owned
          </div>
        )}
        {!owned && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {playlist.priceTokens}
          </div>
        )}
      </div>
      <h3 className="font-medium text-gray-900 text-sm truncate">{playlist.title}</h3>
      <p className="text-xs text-gray-500 truncate">{playlist.creatorId?.name}</p>
    </div>
  );

  const Section: React.FC<{ 
    title: string; 
    icon: React.ReactNode;
    playlists: HubPlaylist[]; 
    onSeeAll?: () => void;
    owned?: boolean;
  }> = ({ title, icon, playlists, onSeeAll, owned }) => {
    if (playlists.length === 0) return null;
    
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-sm text-indigo-600 flex items-center gap-1"
            >
              See All <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {playlists.map((playlist) => (
            <ContentCard key={playlist._id} playlist={playlist} owned={owned} />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold mb-1">Godly Hub</h1>
        <p className="text-indigo-100 text-sm">Discover content from Christian creators</p>
        
        {/* Token Balance */}
        <div className="flex items-center justify-between mt-4 bg-white/20 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <Coins className="w-5 h-5 text-yellow-800" />
            </div>
            <div>
              <p className="text-xs text-indigo-100">Your Balance</p>
              <p className="text-xl font-bold">{balance} Tokens</p>
            </div>
          </div>
          <button
            onClick={() => setShowBuyTokens(true)}
            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Buy
          </button>
        </div>
      </div>

      {/* My Content */}
      {myContent.length > 0 && (
        <Section
          title="My Purchases"
          icon={<ShoppingBag className="w-5 h-5 text-green-600" />}
          playlists={myContent}
          owned
        />
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <Section
          title="Featured"
          icon={<Star className="w-5 h-5 text-yellow-500" />}
          playlists={featured}
        />
      )}

      {/* Audiobooks */}
      <Section
        title="Audiobooks"
        icon={<BookOpen className="w-5 h-5 text-indigo-600" />}
        playlists={audiobooks}
        onSeeAll={() => navigate('/hub/browse?type=Audiobook')}
      />

      {/* Music */}
      <Section
        title="Music Albums"
        icon={<Music className="w-5 h-5 text-purple-600" />}
        playlists={music}
        onSeeAll={() => navigate('/hub/browse?type=Song')}
      />

      {/* Empty State */}
      {featured.length === 0 && audiobooks.length === 0 && music.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Coming Soon!</h2>
          <p className="text-gray-500 max-w-xs">
            Christian creators are uploading their content. Check back soon for audiobooks, music, and more!
          </p>
        </div>
      )}

      {/* Buy Tokens Modal */}
      {showBuyTokens && (
        <BuyTokensModal
          currentBalance={balance}
          onClose={() => setShowBuyTokens(false)}
          onPurchase={async (bundleId) => {
            // TODO: Integrate with IAP
            alert('Token purchase coming soon!');
            setShowBuyTokens(false);
          }}
        />
      )}
    </div>
  );
};

// Buy Tokens Modal Component
const BuyTokensModal: React.FC<{
  currentBalance: number;
  onClose: () => void;
  onPurchase: (bundleId: string) => void;
}> = ({ currentBalance, onClose, onPurchase }) => {
  const bundles = tokenService.getBundles();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Buy Tokens</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-4 mb-6">
          <Coins className="w-8 h-8 text-yellow-500" />
          <div>
            <p className="text-sm text-gray-600">Current Balance</p>
            <p className="text-2xl font-bold text-gray-900">{currentBalance} Tokens</p>
          </div>
        </div>

        <div className="space-y-3">
          {bundles.map((bundle) => (
            <button
              key={bundle.bundleId}
              onClick={() => onPurchase(bundle.bundleId)}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl font-bold text-yellow-600">{bundle.tokens}</span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{bundle.name}</p>
                  <p className="text-xs text-gray-500">{bundle.effectiveRate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-600">${bundle.price.toFixed(2)}</p>
                {bundle.bonus && (
                  <p className="text-xs text-green-600">{bundle.bonus}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Tokens can be used to purchase audiobooks and music from creators
        </p>
      </div>
    </div>
  );
};

export default GodlyHubPage;
