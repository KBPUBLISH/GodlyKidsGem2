import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Coins, Users, Target, X, Gift, ArrowRight, Camera, MapPin, ThumbsUp } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import Header from '../components/layout/Header';
import { useTutorial } from '../context/TutorialContext';

// API Base URL
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') 
    || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');

interface Campaign {
    _id: string;
    title: string;
    description: string;
    image?: string;
    goalCoins: number;
    currentCoins: number;
    totalGoalsReached: number;
    progressPercent: number;
    category: string;
    partnerName?: string;
}

interface UserDonationStats {
    totalCoins: number;
    donationCount: number;
    goalsCompleted: number;
}

interface RecentDonor {
    kidName: string;
    amount: number;
    createdAt: string;
}

interface CampaignUpdate {
    _id: string;
    type: 'photo' | 'video' | 'milestone' | 'thankyou';
    caption: string;
    images: { url: string; caption?: string }[];
    videoUrl?: string;
    location?: string;
    itemsDonated: number;
    likes: number;
    likedBy: string[];
    isPinned: boolean;
    createdAt: string;
}

// Get or create anonymous device ID for donations
const getAnonymousDeviceId = () => {
    let anonId = localStorage.getItem('godlykids_anon_device_id');
    if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('godlykids_anon_device_id', anonId);
    }
    return anonId;
};

// CSS Keyframes for animations
const modalAnimationStyles = `
@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0.5;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes slideDown {
    from {
        transform: translateY(0);
        opacity: 1;
    }
    to {
        transform: translateY(100%);
        opacity: 0;
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
`;

const GivingPage: React.FC = () => {
    const navigate = useNavigate();
    const { coins, spendCoins, deviceId, currentProfileId, kids } = useUser();
    const { t } = useLanguage();
    const { isTutorialActive, isStepActive, nextStep } = useTutorial();
    
    // Use actual deviceId or fallback to anonymous ID
    const effectiveDeviceId = deviceId || getAnonymousDeviceId();
    
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [userStats, setUserStats] = useState<UserDonationStats | null>(null);
    
    // Campaign detail view
    const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
    const [recentDonors, setRecentDonors] = useState<RecentDonor[]>([]);
    const [loadingDonors, setLoadingDonors] = useState(false);
    
    // Campaign updates (social feed)
    const [campaignUpdates, setCampaignUpdates] = useState<CampaignUpdate[]>([]);
    const [loadingUpdates, setLoadingUpdates] = useState(false);
    
    // Donation modal state
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [donationAmount, setDonationAmount] = useState(10);
    const [isDonating, setIsDonating] = useState(false);
    
    // Thank you animation
    const [showThankYou, setShowThankYou] = useState(false);
    const [thankYouMessage, setThankYouMessage] = useState('');
    
    // Header visibility
    const [headerVisible, setHeaderVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    
    // Swipe to close modal
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = React.useRef(0);
    const modalScrollTop = React.useRef(0);
    
    // Handle scroll for header visibility
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            setHeaderVisible(false);
        } else {
            setHeaderVisible(true);
        }
        setLastScrollY(currentScrollY);
    };

    // Get current kid name
    const currentKid = kids.find(k => k.id === currentProfileId);
    const kidName = currentKid?.name || 'Friend';

    useEffect(() => {
        fetchCampaigns();
        fetchUserStats();
    }, []);
    
    // Hide navigation wheel when modal is open
    useEffect(() => {
        if (viewingCampaign || selectedCampaign) {
            document.body.setAttribute('data-modal-open', 'true');
        } else {
            document.body.removeAttribute('data-modal-open');
        }
        return () => {
            document.body.removeAttribute('data-modal-open');
        };
    }, [viewingCampaign, selectedCampaign]);

    const fetchCampaigns = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/campaigns`);
            const data = await response.json();
            setCampaigns(data);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserStats = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/donations/user/${effectiveDeviceId}`);
            const data = await response.json();
            setUserStats(data.totals);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    const fetchRecentDonors = async (campaignId: string) => {
        setLoadingDonors(true);
        try {
            const response = await fetch(`${API_BASE}/api/donations/campaign/${campaignId}/recent?limit=10`);
            const data = await response.json();
            setRecentDonors(data);
        } catch (error) {
            console.error('Error fetching recent donors:', error);
            setRecentDonors([]);
        } finally {
            setLoadingDonors(false);
        }
    };

    const fetchCampaignUpdates = async (campaignId: string) => {
        setLoadingUpdates(true);
        try {
            const response = await fetch(`${API_BASE}/api/campaign-updates/campaign/${campaignId}?limit=10`);
            const data = await response.json();
            setCampaignUpdates(data.updates || []);
        } catch (error) {
            console.error('Error fetching campaign updates:', error);
            setCampaignUpdates([]);
        } finally {
            setLoadingUpdates(false);
        }
    };

    const handleLikeUpdate = async (updateId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/campaign-updates/${updateId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: effectiveDeviceId })
            });
            const data = await response.json();
            
            // Update local state
            setCampaignUpdates(prev => prev.map(update => 
                update._id === updateId 
                    ? { 
                        ...update, 
                        likes: data.likes,
                        likedBy: data.liked 
                            ? [...update.likedBy, effectiveDeviceId]
                            : update.likedBy.filter(id => id !== effectiveDeviceId)
                    }
                    : update
            ));
        } catch (error) {
            console.error('Error liking update:', error);
        }
    };

    const handleDonate = async () => {
        if (!selectedCampaign || donationAmount < 1) return;
        
        // Check if user has enough coins
        if (coins < donationAmount) {
            alert("You don't have enough coins!");
            return;
        }

        setIsDonating(true);
        
        try {
            // Send donation to backend first
            const response = await fetch(`${API_BASE}/api/donations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId: selectedCampaign._id,
                    userId: effectiveDeviceId,
                    kidProfileId: currentProfileId || 'guest',
                    kidName: kidName,
                    amount: donationAmount,
                }),
            });

            const result = await response.json();
            
            if (result.success) {
                // Spend coins locally after backend confirms
                spendCoins(donationAmount, `Donated to ${selectedCampaign.title}`);
                
                // Update the campaign in local state immediately
                setCampaigns(prev => prev.map(c => 
                    c._id === selectedCampaign._id 
                        ? { 
                            ...c, 
                            currentCoins: result.campaign.currentCoins,
                            progressPercent: result.campaign.progressPercent,
                            totalGoalsReached: result.campaign.totalGoalsReached
                        }
                        : c
                ));
                
                // Also update viewing campaign if open
                if (viewingCampaign && viewingCampaign._id === selectedCampaign._id) {
                    setViewingCampaign(prev => prev ? {
                        ...prev,
                        currentCoins: result.campaign.currentCoins,
                        progressPercent: result.campaign.progressPercent,
                        totalGoalsReached: result.campaign.totalGoalsReached
                    } : null);
                }
                
                // Refresh user stats
                fetchUserStats();
                
                // Refresh recent donors if viewing a campaign
                if (viewingCampaign) {
                    fetchRecentDonors(viewingCampaign._id);
                }
                
                // Close donation modal
                setSelectedCampaign(null);
                setDonationAmount(10);
                
                // Show thank you with prayer hands
                if (result.goalReached) {
                    setThankYouMessage(`You helped complete goal #${result.campaign.totalGoalsReached}!`);
                } else {
                    setThankYouMessage(`${donationAmount} coins donated!`);
                }
                setShowThankYou(true);
                
                // Advance tutorial AFTER actual donation
                if (isTutorialActive && isStepActive('give_button_highlight')) {
                    nextStep(); // Go to donation_complete
                }
                
                // Auto-close thank you after 2.5 seconds
                setTimeout(() => {
                    setShowThankYou(false);
                }, 2500);
            } else {
                alert(result.error || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Error processing donation:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setIsDonating(false);
        }
    };

    const openCampaignDetail = (campaign: Campaign) => {
        setDragY(0);
        setIsDragging(false);
        setViewingCampaign(campaign);
        fetchRecentDonors(campaign._id);
        fetchCampaignUpdates(campaign._id);
    };

    const openDonationModal = (campaign: Campaign, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedCampaign(campaign);
        setDonationAmount(10);
    };

    // Swipe down handlers for modal
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        const scrollableEl = e.currentTarget.querySelector('[data-scrollable]') as HTMLElement;
        modalScrollTop.current = scrollableEl?.scrollTop || 0;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;
        
        // Only allow drag down when scrolled to top
        if (modalScrollTop.current <= 0 && diff > 0) {
            setIsDragging(true);
            setDragY(diff);
        }
    };

    const handleTouchEnd = () => {
        if (isDragging) {
            // If dragged more than 100px, close the modal
            if (dragY > 100) {
                setViewingCampaign(null);
            }
            setDragY(0);
            setIsDragging(false);
        }
    };

    const quickAmounts = [10, 25, 50, 100];

    if (loading) {
        return (
            <div className="flex flex-col h-full overflow-y-auto no-scrollbar relative">
                <Header isVisible={true} />
                <div className="h-20"></div>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
            onScroll={handleScroll}
        >
            {/* Animation Styles */}
            <style>{modalAnimationStyles}</style>
            
            {/* Standard Header */}
            <Header isVisible={headerVisible} />
            
            {/* Main Content with top padding to clear header */}
            <div className="px-4 pt-24 pb-32 space-y-4">
                
                {/* Page Title */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                        Give Coins to Help People in Need 💛
                    </h1>
                </div>

                {/* User Stats Banner */}
                {userStats && userStats.donationCount > 0 && (
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-md border-2 border-pink-200">
                        <div className="flex items-center justify-around">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-pink-600">{userStats.totalCoins}</div>
                                <div className="text-xs text-gray-500">Coins Given</div>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{userStats.donationCount}</div>
                                <div className="text-xs text-gray-500">Donations</div>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{userStats.goalsCompleted}</div>
                                <div className="text-xs text-gray-500">Goals Helped</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Campaigns Grid - Responsive */}
                <div className="max-w-4xl mx-auto">
                {campaigns.length === 0 ? (
                    <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-2xl">
                        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No campaigns available right now</p>
                        <p className="text-gray-400 text-sm">Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {campaigns.map((campaign, index) => (
                            <div 
                                key={campaign._id}
                                id={index === 0 ? 'campaign-card-0' : undefined}
                                data-tutorial={index === 0 ? 'campaign-card-0' : undefined}
                                onClick={() => {
                                    // Advance tutorial when clicking the highlighted campaign
                                    if (index === 0 && isTutorialActive && isStepActive('campaign_highlight')) {
                                        nextStep();
                                    }
                                    openCampaignDetail(campaign);
                                }}
                                className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border-2 border-pink-200/50 transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            >
                                {/* Campaign Image - Responsive aspect ratio */}
                                <div className="relative aspect-[4/3] sm:aspect-square lg:aspect-[4/3] bg-gradient-to-br from-pink-50 to-purple-50">
                                    {campaign.image ? (
                                        <img 
                                            src={campaign.image} 
                                            alt={campaign.title}
                                            className="w-full h-full object-contain p-2"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Gift className="w-10 h-10 text-pink-400" />
                                        </div>
                                    )}
                                    {campaign.totalGoalsReached > 0 && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                            {campaign.totalGoalsReached}x
                                        </div>
                                    )}
                                </div>
                                
                                <div className="p-3">
                                    <h3 className="font-bold text-gray-800 text-sm mb-1 truncate">{campaign.title}</h3>
                                    
                                    {/* Progress Bar */}
                                    <div className="mb-2">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                                                style={{ width: `${campaign.progressPercent}%` }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 text-center">
                                            {campaign.currentCoins}/{campaign.goalCoins}
                                        </div>
                                    </div>

                                    {/* Give Button - First one gets tutorial ID */}
                                    <button
                                        id={index === 0 ? 'give-button-0' : undefined}
                                        data-tutorial={index === 0 ? 'give-button-0' : undefined}
                                        onClick={(e) => {
                                            openDonationModal(campaign, e);
                                            // Don't advance tutorial here - wait for actual donation
                                        }}
                                        className="w-full py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1 active:scale-95"
                                    >
                                        <Heart className="w-4 h-4" />
                                        Give
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </div>

            {/* Campaign Detail Modal - Below Header, Rounded, Scrollable */}
            {viewingCampaign && (
                <div 
                    className="fixed inset-0 z-[100] flex items-end justify-center pt-16"
                    style={{ animation: 'fadeIn 0.2s ease-out' }}
                >
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        style={{ opacity: isDragging ? Math.max(0.2, 1 - dragY / 300) : 1 }}
                        onClick={() => setViewingCampaign(null)}
                    />
                    
                    {/* Modal Content */}
                    <div 
                        className="relative bg-white rounded-t-3xl w-full h-[calc(100%-4rem)] flex flex-col overflow-hidden shadow-2xl"
                        style={{ 
                            animation: isDragging ? 'none' : 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                            transform: isDragging ? `translateY(${dragY}px)` : 'translateY(0)',
                            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-gray-300 rounded-full" />
                        </div>
                        
                        {/* Close Button */}
                        <button 
                            onClick={() => setViewingCampaign(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto no-scrollbar" data-scrollable>
                            {/* Campaign Image - Scrolls with content */}
                            <div className="relative w-full aspect-square bg-gradient-to-br from-pink-50 to-purple-50">
                                {viewingCampaign.image ? (
                                    <img 
                                        src={viewingCampaign.image} 
                                        alt={viewingCampaign.title}
                                        className="w-full h-full object-contain p-6"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Gift className="w-24 h-24 text-pink-400" />
                                    </div>
                                )}
                                {viewingCampaign.totalGoalsReached > 0 && (
                                    <div className="absolute bottom-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                        <Target className="w-4 h-4" />
                                        {viewingCampaign.totalGoalsReached} donated!
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-5 pb-28 space-y-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 mb-1">{viewingCampaign.title}</h2>
                                    <p className="text-gray-600">{viewingCampaign.description}</p>
                                </div>

                                {/* Progress Section */}
                                <div className="bg-gray-50 rounded-2xl p-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-500">Progress</span>
                                        <span className="font-bold text-pink-600">
                                            {viewingCampaign.currentCoins} / {viewingCampaign.goalCoins} coins
                                        </span>
                                    </div>
                                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                                            style={{ width: `${viewingCampaign.progressPercent}%` }}
                                        />
                                    </div>
                                    <div className="text-center text-sm text-gray-500 mt-2">
                                        {Math.max(0, viewingCampaign.goalCoins - viewingCampaign.currentCoins)} coins to go!
                                    </div>
                                </div>

                                {/* How It Works */}
                                <div className="bg-pink-50 rounded-2xl p-4">
                                    <h3 className="font-bold text-pink-700 mb-2">How It Works</h3>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <div className="flex items-start gap-2">
                                            <span className="text-pink-500">1.</span>
                                            <span>Give your gold coins to this campaign</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-pink-500">2.</span>
                                            <span>When the goal is reached, Godly Kids donates the real item!</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-pink-500">3.</span>
                                            <span>The campaign resets so we can help even more people 💛</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Thank You - Recent Donors */}
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                                    <h3 className="font-bold text-purple-700 mb-3 flex items-center gap-2">
                                        <span className="text-xl">🙏</span>
                                        Thank You!
                                    </h3>
                                    {loadingDonors ? (
                                        <div className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                                        </div>
                                    ) : recentDonors.length > 0 ? (
                                        <div className="space-y-2">
                                            {recentDonors.map((donor, index) => (
                                                <div 
                                                    key={index}
                                                    className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-sm">
                                                            {donor.kidName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-gray-700">{donor.kidName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Coins className="w-4 h-4 text-yellow-500" />
                                                        <span className="font-bold text-gray-600">{donor.amount}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-500">
                                            <p className="text-sm">Be the first to donate! 💛</p>
                                        </div>
                                    )}
                                </div>

                                {/* Updates Section - Ministry photos/social feed */}
                                {campaignUpdates.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                            <Camera className="w-5 h-5 text-blue-500" />
                                            Updates from the Field
                                        </h3>
                                        
                                        {loadingUpdates ? (
                                            <div className="flex justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {campaignUpdates.map((update) => (
                                                    <div 
                                                        key={update._id}
                                                        className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
                                                    >
                                                        {/* Update Images */}
                                                        {update.images && update.images.length > 0 && (
                                                            <div className={`${update.images.length > 1 ? 'grid grid-cols-2 gap-0.5' : ''}`}>
                                                                {update.images.slice(0, 4).map((img, idx) => (
                                                                    <div 
                                                                        key={idx} 
                                                                        className={`relative ${update.images.length === 1 ? 'aspect-video' : 'aspect-square'}`}
                                                                    >
                                                                        <img 
                                                                            src={img.url} 
                                                                            alt={img.caption || `Update photo ${idx + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        {update.images.length > 4 && idx === 3 && (
                                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                                <span className="text-white font-bold text-xl">+{update.images.length - 4}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Update Content */}
                                                        <div className="p-4">
                                                            {/* Caption */}
                                                            <p className="text-gray-700 mb-3">{update.caption}</p>
                                                            
                                                            {/* Meta info */}
                                                            <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                                                                {update.location && (
                                                                    <span className="flex items-center gap-1">
                                                                        <MapPin className="w-4 h-4" />
                                                                        {update.location}
                                                                    </span>
                                                                )}
                                                                {update.itemsDonated > 0 && (
                                                                    <span className="flex items-center gap-1 text-green-600 font-medium">
                                                                        <Gift className="w-4 h-4" />
                                                                        {update.itemsDonated} donated
                                                                    </span>
                                                                )}
                                                                <span className="text-gray-400">
                                                                    {new Date(update.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Like button */}
                                                            <button
                                                                onClick={() => handleLikeUpdate(update._id)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                                                                    update.likedBy.includes(effectiveDeviceId)
                                                                        ? 'bg-pink-100 text-pink-600'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                <ThumbsUp className={`w-4 h-4 ${update.likedBy.includes(effectiveDeviceId) ? 'fill-current' : ''}`} />
                                                                <span className="font-medium">{update.likes}</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fixed Bottom Button */}
                        <div className="p-4 bg-white border-t border-gray-100">
                            <button
                                id="modal-give-button"
                                data-tutorial="modal-give-button"
                                onClick={() => {
                                    const campaign = viewingCampaign;
                                    // Don't advance tutorial here - wait for actual donation
                                    setViewingCampaign(null);
                                    setTimeout(() => openDonationModal(campaign), 100);
                                }}
                                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
                            >
                                <Heart className="w-6 h-6" />
                                Give Coins
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Donation Modal */}
            {selectedCampaign && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white/95 backdrop-blur-md rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white p-4 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Give to {selectedCampaign.title}</h3>
                            <button 
                                onClick={() => setSelectedCampaign(null)}
                                className="p-1 hover:bg-white/20 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Your Coins */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                <span className="text-gray-500">Your coins:</span>
                                <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full">
                                    <Coins className="w-5 h-5 text-yellow-600" />
                                    <span className="font-bold text-yellow-700">{coins}</span>
                                </div>
                            </div>

                            {/* Quick Amount Buttons */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {quickAmounts.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setDonationAmount(amount)}
                                        disabled={coins < amount}
                                        className={`py-2 rounded-xl font-bold transition-all ${
                                            donationAmount === amount
                                                ? 'bg-pink-500 text-white scale-105'
                                                : coins < amount
                                                    ? 'bg-gray-100 text-gray-400'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-pink-100'
                                        }`}
                                    >
                                        {amount}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Amount */}
                            <div className="mb-6">
                                <label className="text-sm text-gray-500 block mb-1">Or enter amount:</label>
                                <input
                                    type="number"
                                    value={donationAmount}
                                    onChange={(e) => setDonationAmount(Math.max(1, Math.min(coins, parseInt(e.target.value) || 0)))}
                                    min={1}
                                    max={coins}
                                    className="w-full px-4 py-3 text-center text-2xl font-bold border-2 border-pink-200 rounded-xl focus:border-pink-500 focus:outline-none"
                                />
                            </div>

                            {/* Donate Button */}
                            <button
                                onClick={handleDonate}
                                disabled={isDonating || donationAmount < 1 || donationAmount > coins}
                                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity active:scale-95"
                            >
                                {isDonating ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <Heart className="w-6 h-6" />
                                        Give {donationAmount} Coins
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thank You Animation with Prayer Hands */}
            {showThankYou && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 text-center animate-in zoom-in-50 duration-300 shadow-2xl">
                        <div className="text-7xl mb-4 animate-bounce">
                            🙏
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
                        <p className="text-gray-600">{thankYouMessage}</p>
                        <p className="text-pink-600 font-medium mt-2">God bless you! 💛</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GivingPage;
