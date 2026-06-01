
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import WoodButton from '../ui/WoodButton';
import { X, ShoppingBag, Check, Trash2, Crown, Wrench, Play, Pause, ArrowUpToLine, ArrowDownToLine, MoveHorizontal, RotateCcw, RotateCw, ArrowLeftRight, Save, User, ZoomIn, ZoomOut, Mic, Volume2 } from 'lucide-react';
import { useUser, ShopItem, SavedCharacter } from '../../context/UserContext';
import AvatarCompositor from '../avatar/AvatarCompositor';
import AvatarPartImage from '../avatar/AvatarPartImage';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';
import { getShopThumbUrl, isAvatarPngPath } from '../../utils/avatarImageUrl';
import { ApiService, getMonthlyBookBaseUrl } from '../../services/apiService';
import { authService } from '../../services/authService';
import { filterVisibleVoices } from '../../services/voiceManagementService';
import CoinHistoryModal from './CoinHistoryModal';
import { useLanguage } from '../../context/LanguageContext';

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: ShopTab;
    /** Open directly in avatar builder mode (wrench / part positioning UI). */
    initialBuilderMode?: boolean;
    hideCloseButton?: boolean; // Hide X button during tutorial
}

// --- SHOP DATA ---
// Pricing structure:
// - 3 items FREE (price: 0) per category
// - ~30% non-premium (purchasable with coins by anyone)
// - ~70% premium (subscribers only)

// New file-based avatar heads (23 heads: 7 non-premium [3 free], 16 premium)
const SHOP_AVATARS: ShopItem[] = [
    // FREE heads (3 heads - price: 0)
    { id: 'av1', name: '', price: 0, type: 'avatar', value: '/avatars/heads/head-1.png' },
    { id: 'av2', name: '', price: 0, type: 'avatar', value: '/avatars/heads/head-2.png' },
    { id: 'av3', name: '', price: 0, type: 'avatar', value: '/avatars/heads/head-3.png' },
    // Non-premium heads with coin cost (4 heads)
    { id: 'av4', name: '', price: 100, type: 'avatar', value: '/avatars/heads/head-4.png' },
    { id: 'av5', name: '', price: 150, type: 'avatar', value: '/avatars/heads/head-5.png' },
    { id: 'av6', name: '', price: 100, type: 'avatar', value: '/avatars/heads/head-6.png' },
    { id: 'av7', name: '', price: 200, type: 'avatar', value: '/avatars/heads/head-7.png' },
    // Premium heads - subscribers only (16 heads)
    { id: 'av8', name: '', price: 150, type: 'avatar', value: '/avatars/heads/head-8.png', isPremium: true },
    { id: 'av9', name: '', price: 200, type: 'avatar', value: '/avatars/heads/head-9.png', isPremium: true },
    { id: 'av10', name: '', price: 250, type: 'avatar', value: '/avatars/heads/heads-10.png', isPremium: true },
    { id: 'av11', name: '', price: 100, type: 'avatar', value: '/avatars/heads/head-11.png', isPremium: true },
    { id: 'av12', name: '', price: 300, type: 'avatar', value: '/avatars/heads/head-12.png', isPremium: true },
    { id: 'av13', name: '', price: 200, type: 'avatar', value: '/avatars/heads/head-13.png', isPremium: true },
    { id: 'av14', name: '', price: 150, type: 'avatar', value: '/avatars/heads/head-14.png', isPremium: true },
    { id: 'av15', name: '', price: 250, type: 'avatar', value: '/avatars/heads/head-15.png', isPremium: true },
    { id: 'av16', name: '', price: 300, type: 'avatar', value: '/avatars/heads/head-16.png', isPremium: true },
    { id: 'av17', name: '', price: 100, type: 'avatar', value: '/avatars/heads/head-17.png', isPremium: true },
    { id: 'av18', name: '', price: 200, type: 'avatar', value: '/avatars/heads/head-18.png', isPremium: true },
    { id: 'av19', name: '', price: 250, type: 'avatar', value: '/avatars/heads/head-19.png', isPremium: true },
    { id: 'av20', name: '', price: 150, type: 'avatar', value: '/avatars/heads/head-20.png', isPremium: true },
    { id: 'av21', name: '', price: 300, type: 'avatar', value: '/avatars/heads/head-21.png', isPremium: true },
    { id: 'av22', name: '', price: 200, type: 'avatar', value: '/avatars/heads/head-22.png', isPremium: true },
    { id: 'av23', name: '', price: 250, type: 'avatar', value: '/avatars/heads/head-23.png', isPremium: true },
];

// Helper to generate shop items with 30% non-premium (3 free + some coins), 70% premium
const generateShopItems = (
    count: number, 
    type: 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs',
    pathPrefix: string,
    idPrefix: string,
    fileNumbers?: number[]
): ShopItem[] => {
    const nonPremiumCount = Math.ceil(count * 0.3); // 30% non-premium
    const freeCount = 3; // 3 free items
    const prices = [100, 150, 200, 250, 300];
    
    return Array.from({ length: count }, (_, i) => {
        const fileNum = fileNumbers ? fileNumbers[i] : i + 1;
        const isFree = i < freeCount;
        const isNonPremium = i < nonPremiumCount;
        
        return {
            id: `${idPrefix}${fileNum}`,
            name: '',
            price: isFree ? 0 : prices[i % 5],
            type: type,
            value: `${pathPrefix}${fileNum}.png`,
            isPremium: !isNonPremium,
        };
    });
};

// New file-based hats (30 hats: 9 non-premium [3 free], 21 premium)
const SHOP_HATS: ShopItem[] = generateShopItems(30, 'hat', '/avatars/hats/hat-', 'h');

// New file-based bodies (25 bodies: 8 non-premium [3 free], 17 premium)
const SHOP_BODIES: ShopItem[] = generateShopItems(25, 'body', '/avatars/bodies/body-', 'b');

// New file-based wings/arms
const LEFT_WING_NUMBERS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59];
const RIGHT_WING_NUMBERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60];

// Left wings: 30 items (9 non-premium [3 free], 21 premium)
const SHOP_LEFT_WINGS: ShopItem[] = generateShopItems(30, 'leftArm', '/avatars/wings-left/wing-left-', 'wl', LEFT_WING_NUMBERS);
// Right wings: 30 items (9 non-premium [3 free], 21 premium)
const SHOP_RIGHT_WINGS: ShopItem[] = generateShopItems(30, 'rightArm', '/avatars/wings-right/wing-right-', 'wr', RIGHT_WING_NUMBERS);

const SHOP_ARMS: ShopItem[] = [...SHOP_LEFT_WINGS, ...SHOP_RIGHT_WINGS];

// Wings are designed as matched left+right pairs (e.g. wing-left-1 + wing-right-2).
// Listing all 30 lefts then all 30 rights put a design's two halves 30 tiles apart,
// so kids thought they could only add one wing. We present ONE tile per design that
// owns/equips BOTH halves together as a coordinated pair.
export interface WingPairItem extends ShopItem {
  pairValue: string; // matching right-wing value (item.value holds the left wing)
  pairId: string;    // matching right-wing id
}

const SHOP_WING_PAIRS: WingPairItem[] = SHOP_LEFT_WINGS.map((left, i) => {
  const right = SHOP_RIGHT_WINGS[i];
  return {
    ...left,
    type: 'leftArm',
    pairValue: right.value,
    pairId: right.id,
  };
});

const isWingPair = (item: ShopItem): item is WingPairItem =>
  (item as WingPairItem).pairValue !== undefined;

// New file-based feet/legs (30 feet: 9 non-premium [3 free], 21 premium)
const SHOP_LEGS: ShopItem[] = generateShopItems(30, 'legs', '/avatars/feet/feet-', 'f');

const SHOP_ANIMATIONS: ShopItem[] = [
    { id: 'anim1', name: 'Breathe', price: 100, type: 'animation', value: 'anim-breathe' },
    { id: 'anim4', name: 'Wiggle', price: 150, type: 'animation', value: 'anim-wiggle' },
    { id: 'anim10', name: 'Jiggle', price: 150, type: 'animation', value: 'anim-jiggle' },
    { id: 'anim2', name: 'Bounce', price: 200, type: 'animation', value: 'anim-bounce' },
    { id: 'anim11', name: 'Sway', price: 250, type: 'animation', value: 'anim-sway' },
    { id: 'anim8', name: 'Wobble', price: 300, type: 'animation', value: 'anim-wobble' },
    { id: 'anim7', name: 'Shake', price: 350, type: 'animation', value: 'anim-shake' },
    { id: 'anim12', name: 'Hop', price: 400, type: 'animation', value: 'anim-hop' },
    { id: 'anim3', name: 'Float', price: 450, type: 'animation', value: 'anim-float' },
    { id: 'anim5', name: 'Pulse', price: 500, type: 'animation', value: 'anim-pulse' },
    { id: 'anim9', name: 'Heartbeat', price: 550, type: 'animation', value: 'anim-heartbeat', isPremium: true },
    { id: 'anim6', name: 'Spin', price: 600, type: 'animation', value: 'anim-spin', isPremium: true },
];

// Per-move preview metadata: a distinct kid-friendly emoji whose tile animates with the
// real motion CSS class (defined in AvatarCompositor) so each move looks unique and previews itself.
const ANIMATION_PREVIEWS: Record<string, { emoji: string; previewClass: string }> = {
    'anim-breathe': { emoji: '😌', previewClass: 'anim-breathe' },
    'anim-wiggle': { emoji: '🪱', previewClass: 'anim-wiggle' },
    'anim-jiggle': { emoji: '🍮', previewClass: 'anim-jiggle' },
    'anim-bounce': { emoji: '🏀', previewClass: 'anim-bounce' },
    'anim-sway': { emoji: '🌴', previewClass: 'anim-sway' },
    'anim-wobble': { emoji: '🐧', previewClass: 'anim-wobble' },
    'anim-shake': { emoji: '📳', previewClass: 'anim-shake' },
    'anim-hop': { emoji: '🐰', previewClass: 'anim-hop' },
    'anim-float': { emoji: '🎈', previewClass: 'anim-float' },
    'anim-pulse': { emoji: '⚡', previewClass: 'anim-pulse' },
    'anim-heartbeat': { emoji: '❤️', previewClass: 'anim-heartbeat' },
    'anim-spin': { emoji: '🌀', previewClass: 'anim-rotate' },
};

// Background themes - purchasable with gold coins
const SHOP_BACKGROUNDS: ShopItem[] = [
    // Default (free - already owned by everyone)
    { id: 'bg1', name: 'Ocean Paradise', price: 0, type: 'background', value: '/assets/images/panorama-background.webp' },
    // Purchasable backgrounds (non-premium - anyone can buy with coins)
    { id: 'bg6', name: 'Tropical Beach', price: 250, type: 'background', value: '/assets/images/bg-beach.jpg' },
    { id: 'bg7', name: 'Golden Sunrise', price: 300, type: 'background', value: '/assets/images/bg-sunrise.jpg' },
    { id: 'bg8', name: 'Under the Sea', price: 350, type: 'background', value: '/assets/images/bg-underwater.jpg' },
    // Premium backgrounds (subscribers only)
    { id: 'bg9', name: 'Enchanted Forest', price: 400, type: 'background', value: '/assets/images/bg-enchanted-forest.jpg', isPremium: true },
    { id: 'bg10', name: 'Outer Space', price: 450, type: 'background', value: '/assets/images/bg-space.jpg', isPremium: true },
    { id: 'bg11', name: 'Volcano Island', price: 500, type: 'background', value: '/assets/images/bg-volcano.jpg', isPremium: true },
];

type ShopTab = 'head' | 'hat' | 'body' | 'arms' | 'legs' | 'moves' | 'voices' | 'backgrounds' | 'saves';

type VoiceShopItem = ShopItem & { characterImage?: string; previewUrl?: string };

const VOICE_PREVIEW_TEXT = 'Hello Godly Kid! Are you ready for an adventure?';

const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, initialTab, initialBuilderMode = false, hideCloseButton = false }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ShopTab>(initialTab || 'head');
    const [availableVoices, setAvailableVoices] = useState<VoiceShopItem[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
    const [isMenuMinimized, setIsMenuMinimized] = useState(false);
    const [isBuilderMode, setIsBuilderMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewAnimation, setPreviewAnimation] = useState<string | null>(null);
    const [selectedPart, setSelectedPart] = useState<'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat' | null>(null);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(false);
    const [showCoinHistory, setShowCoinHistory] = useState(false);
    const [showHatHint, setShowHatHint] = useState(false);
    const hatHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const drawerHandleRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number>(0);
    const touchStartTime = useRef<number>(0);
    const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
    const voicePreviewCacheRef = useRef<Record<string, string>>({});
    const voicePreviewRevokeRef = useRef<string | null>(null);

    const handleDrawerTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
    };

    const handleDrawerTouchEnd = (e: React.TouchEvent) => {
        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchStartY.current - touchEndY;
        const timeDelta = Date.now() - touchStartTime.current;

        if (timeDelta < 300 && Math.abs(deltaY) > 50) {
            if (deltaY > 0) {
                setIsMenuMinimized(false);
            } else {
                setIsMenuMinimized(true);
                if (selectedPart) setSelectedPart(null);
            }
        }
    };

    const toggleDrawerMinimized = () => {
        setIsMenuMinimized((prev) => {
            const next = !prev;
            if (next && selectedPart) setSelectedPart(null);
            return next;
        });
    };
    
    // Wrapper for onClose that dispatches event for referral prompt
    const handleClose = () => {
        // Dispatch custom event to trigger referral prompt after shop closes
        window.dispatchEvent(new CustomEvent('godlykids_shop_closed'));
        onClose();
    };

    useEffect(() => {
        return () => {
            if (hatHintTimerRef.current) clearTimeout(hatHintTimerRef.current);
        };
    }, []);

    // Update tab when initialTab changes
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Parrot Island / deep links: land in builder mode when the shop opens
    useEffect(() => {
        if (isOpen && initialBuilderMode) {
            setIsBuilderMode(true);
            setSelectedPart('head');
            setIsMenuMinimized(false);
        }
    }, [isOpen, initialBuilderMode]);

    useEffect(() => {
        if (!isOpen) {
            setIsBuilderMode(false);
            setSelectedPart(null);
            setPreviewAnimation(null);
            stopVoicePreview();
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeTab !== 'voices') {
            stopVoicePreview();
        }
        if (activeTab !== 'moves') {
            setPreviewAnimation(null);
        }
    }, [activeTab]);

    const stopVoicePreview = () => {
        if (voiceAudioRef.current) {
            voiceAudioRef.current.pause();
            voiceAudioRef.current.src = '';
            voiceAudioRef.current = null;
        }
        if (voicePreviewRevokeRef.current) {
            URL.revokeObjectURL(voicePreviewRevokeRef.current);
            voicePreviewRevokeRef.current = null;
        }
        setPreviewingVoiceId(null);
    };

    useEffect(() => () => stopVoicePreview(), []);

    // Fetch voices when voices tab is active
    useEffect(() => {
        if (!isOpen || activeTab !== 'voices') {
            return;
        }

        setLoadingVoices(true);
        let isMounted = true;

        ApiService.getVoices()
            .then(voices => {
                if (!isMounted) return;

                // Safety check for filterVisibleVoices
                if (typeof filterVisibleVoices !== 'function') {
                    console.error('filterVisibleVoices is not a function');
                    setAvailableVoices([]);
                    return;
                }

                // Filter voices that should be shown in the shop (backend flag)
                const shopVoices = voices.filter((v: any) => v.showInApp !== false);
                
                // Then apply user's local hidden preferences
                const visibleVoices = filterVisibleVoices(shopVoices);
                
                // Calculate 30% threshold for coin-purchasable voices (free tier)
                const totalVoices = visibleVoices.length;
                const freeTierCount = Math.ceil(totalVoices * 0.3); // 30% available to free users

                // Convert to ShopItem format
                // All voices cost coins - premium just unlocks ACCESS to buy the other 70%
                const voiceItems: VoiceShopItem[] = visibleVoices.map((voice, index) => {
                    // First 30% are available to all users, rest require premium subscription to purchase
                    const isFreeTier = index < freeTierCount;

                    return {
                        id: `voice-${voice.voice_id}`,
                        name: voice.name,
                        price: 200, // All voices cost 200 coins (even for premium users)
                        type: 'voice',
                        value: voice.voice_id,
                        isPremium: !isFreeTier, // Premium-only if not in first 30% (requires subscription to BUY)
                        characterImage: voice.characterImage,
                        previewUrl: voice.preview_url,
                    };
                });
                setAvailableVoices(voiceItems);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error('Error loading voices:', error);
                setAvailableVoices([]);
            })
            .finally(() => {
                if (isMounted) {
                    setLoadingVoices(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, activeTab]);

    // Check if tabs are scrollable and show hint on first visit
    useEffect(() => {
        if (!isOpen) return;

        const hasSeenHint = localStorage.getItem('godlykids_shop_scroll_hint_seen') === 'true';
        if (hasSeenHint) return;

        // Wait for DOM to render
        const checkScrollable = setTimeout(() => {
            const container = tabsContainerRef.current;
            if (container) {
                const isScrollable = container.scrollWidth > container.clientWidth;
                if (isScrollable) {
                    setShowScrollHint(true);
                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        setShowScrollHint(false);
                        localStorage.setItem('godlykids_shop_scroll_hint_seen', 'true');
                    }, 5000);
                }
            }
        }, 500);

        return () => clearTimeout(checkScrollable);
    }, [isOpen]);

    // Hide hint when user scrolls tabs
    useEffect(() => {
        if (!showScrollHint) return;

        const container = tabsContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            setShowScrollHint(false);
            localStorage.setItem('godlykids_shop_scroll_hint_seen', 'true');
        };

        container.addEventListener('scroll', handleScroll, { once: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [showScrollHint]);

    // Warm-cache WebP thumbs for the active tab (first screenful) on iPhone
    useEffect(() => {
        if (!isOpen || activeTab === 'saves') return;

        const items =
            activeTab === 'head' ? SHOP_AVATARS
            : activeTab === 'hat' ? SHOP_HATS
            : activeTab === 'body' ? SHOP_BODIES
            : activeTab === 'arms' ? SHOP_WING_PAIRS
            : activeTab === 'legs' ? SHOP_LEGS
            : activeTab === 'moves' ? SHOP_ANIMATIONS
            : activeTab === 'voices' ? availableVoices
            : activeTab === 'backgrounds' ? SHOP_BACKGROUNDS
            : [];

        items.slice(0, 12).forEach((item) => {
            if (isAvatarPngPath(item.value)) {
                const img = new Image();
                img.decoding = 'async';
                img.src = getShopThumbUrl(item.value);
            }
        });
    }, [isOpen, activeTab, availableVoices]);

    const {
        coins,
        purchaseItem,
        equipItem,
        unequipItem,
        isOwned,
        isSubscribed,
        isVoiceUnlocked,
        unlockVoice,
        equippedFrame,
        equippedAvatar,
        equippedHat,
        equippedBody,
        equippedLeftArm,
        equippedRightArm,
        equippedLegs,
        equippedAnimation,
        equippedBackground,
        equippedLeftArmRotation,
        equippedRightArmRotation,
        equippedLegsRotation,
        equippedHatRotation,
        setPartRotation,
        leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
        setPartOffset,
        leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale,
        setPartScale,
        legsSpread,
        setLegsSpread,
        swapArms,
        savedCharacters,
        saveCurrentCharacter,
        deleteSavedCharacter,
        equipSavedCharacter
    } = useUser();

    if (!isOpen) return null;

    const handleBuy = async (item: ShopItem) => {
        if (item.type === 'voice') {
            if (coins >= item.price) {
                purchaseItem(item);
                unlockVoice(item.value);
                // Persist to backend so unlock survives refresh and syncs across devices
                const userId = authService.getUserIdForBackend();
                if (userId) {
                    try {
                        const base = getMonthlyBookBaseUrl();
                        const res = await fetch(`${base}/voices/unlock`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, voiceId: item.value }),
                        });
                        const data = await res.json();
                        if (!data.success && !data.alreadyUnlocked) {
                            console.warn('Shop: voice unlock API failed', data);
                        }
                    } catch (err) {
                        console.warn('Shop: voice unlock API error', err);
                    }
                }
            }
        } else {
            const success = purchaseItem(item);
            if (success) {
                handleEquip(item);
            }
        }
    };

    const handleEquip = (item: ShopItem) => {
        if (isWingPair(item)) {
            // Equip both halves so the wings always come as a matching pair.
            equipItem('leftArm', item.value);
            equipItem('rightArm', item.pairValue);
            return;
        }
        equipItem(item.type, item.value);
        if (item.type === 'animation') {
            setPreviewAnimation(null);
            setIsPlaying(true);
        }
        if (item.type === 'hat') {
            if (hatHintTimerRef.current) clearTimeout(hatHintTimerRef.current);
            setShowHatHint(true);
            hatHintTimerRef.current = setTimeout(() => setShowHatHint(false), 4000);
        }
    };

    const handleUnequip = (type: ShopItem['type']) => {
        unequipItem(type);
    };

    // Unequip helper that removes both halves when the item is a wing pair.
    const handleUnequipItem = (item: ShopItem) => {
        if (isWingPair(item)) {
            unequipItem('leftArm');
            unequipItem('rightArm');
            return;
        }
        unequipItem(item.type);
    };

    const handleQuickSave = () => {
        saveCurrentCharacter();
        setIsPlaying(false); // Stop animation on save to prevent weirdness
        setSelectedPart(null); // Dismiss builder controls so drawer handle stays reachable
        setIsSavedFeedback(true);
        setTimeout(() => setIsSavedFeedback(false), 1500);
    };

    const isBodyEquipped = !!equippedBody;

    const handleVoicePreview = async (item: VoiceShopItem) => {
        const voiceId = item.value;
        if (previewingVoiceId === voiceId) {
            stopVoicePreview();
            return;
        }
        stopVoicePreview();
        setPreviewingVoiceId(voiceId);

        try {
            let audioUrl = item.previewUrl || voicePreviewCacheRef.current[voiceId];
            if (!audioUrl) {
                const base = getMonthlyBookBaseUrl();
                const res = await fetch(`${base}/devotional-stories/preview-voice`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voiceId, text: VOICE_PREVIEW_TEXT }),
                });
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    audioUrl = data.audioUrl ?? (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : undefined);
                    if (audioUrl) voicePreviewCacheRef.current[voiceId] = audioUrl;
                }
            }
            if (!audioUrl) {
                const result = await ApiService.generateTTS(VOICE_PREVIEW_TEXT, voiceId);
                audioUrl = result?.audioUrl;
                if (audioUrl) voicePreviewCacheRef.current[voiceId] = audioUrl;
            }
            if (!audioUrl) throw new Error('No preview audio');

            let playUrl = audioUrl;
            if (audioUrl.startsWith('data:audio/mpeg;base64,')) {
                try {
                    const base64 = audioUrl.slice(audioUrl.indexOf(',') + 1);
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    const blob = new Blob([bytes], { type: 'audio/mpeg' });
                    voicePreviewRevokeRef.current = playUrl = URL.createObjectURL(blob);
                } catch {
                    // fallback to data URL
                }
            }

            const audio = new Audio(playUrl);
            voiceAudioRef.current = audio;
            audio.onended = () => stopVoicePreview();
            audio.onerror = () => stopVoicePreview();
            await audio.play();
        } catch (err) {
            console.warn('Shop voice preview failed:', err);
            stopVoicePreview();
        }
    };

    const handleVoiceBuy = (item: VoiceShopItem) => {
        if (isVoiceUnlocked(item.value)) return;

        if (item.isPremium && !isSubscribed) {
            handleClose();
            navigate('/paywall');
            return;
        }

        const voicePrice = item.price > 0 ? item.price : 200;
        if (coins >= voicePrice) {
            handleBuy({ ...item, price: voicePrice });
        } else {
            setShowCoinHistory(true);
        }
    };

    const handleCardClick = (item: ShopItem) => {
        if (item.type === 'voice') {
            handleVoicePreview(item as VoiceShopItem);
            return;
        }

        // Tapping a move previews it live on the avatar (even before buying); WEAR/buy button equips it
        if (item.type === 'animation') {
            setPreviewAnimation(item.value);
            setIsPlaying(true);
            return;
        }
        
        // Non-voice items (animations handled above via the preview branch)
        if (isOwned(item.id)) {
            if (isEquipped(item)) {
                handleUnequipItem(item);
            } else {
                const isLimb = ['leftArm', 'rightArm', 'legs'].includes(item.type);
                if (isLimb && !isBodyEquipped) return;
                handleEquip(item);
            }
        } else if (item.isPremium && !isSubscribed) {
            handleClose();
            navigate('/paywall');
        } else if (coins < item.price && item.price > 0) {
            setShowCoinHistory(true);
        } else {
            handleBuy(item);
        }
    };

    const getActiveItems = () => {
        switch (activeTab) {
            case 'head': return SHOP_AVATARS;
            case 'hat': return SHOP_HATS;
            case 'body': return SHOP_BODIES;
            case 'arms': return SHOP_WING_PAIRS;
            case 'legs': return SHOP_LEGS;
            case 'moves': return SHOP_ANIMATIONS;
            case 'voices': return availableVoices;
            case 'backgrounds': return SHOP_BACKGROUNDS;
            case 'saves': return []; // Handled separately
            default: return [];
        }
    };

    const isEquipped = (item: ShopItem) => {
        if (isWingPair(item)) {
            return equippedLeftArm === item.value && equippedRightArm === item.pairValue;
        }
        switch (item.type) {
            case 'avatar': return equippedAvatar === item.value;
            case 'hat': return equippedHat === item.value;
            case 'body': return equippedBody === item.value;
            case 'leftArm': return equippedLeftArm === item.value;
            case 'rightArm': return equippedRightArm === item.value;
            case 'legs': return equippedLegs === item.value;
            case 'animation': return equippedAnimation === item.value;
            case 'voice': return false; // Voices don't have an "equipped" state
            case 'background': return equippedBackground === item.value;
            default: return false;
        }
    };

    // --- BUILDER CONTROLS LOGIC ---
    const handlePartClick = (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat') => {
        if (!isBuilderMode) {
            setIsBuilderMode(true);
        }
        setSelectedPart(part);
        if (part === 'hat' && showHatHint) {
            setShowHatHint(false);
            if (hatHintTimerRef.current) clearTimeout(hatHintTimerRef.current);
        }
    };

    const updateOffset = (axis: 'x' | 'y', delta: number) => {
        if (!selectedPart) return;

        let currentVal = 0;
        if (selectedPart === 'leftArm') currentVal = leftArmOffset[axis];
        else if (selectedPart === 'rightArm') currentVal = rightArmOffset[axis];
        else if (selectedPart === 'legs') currentVal = legsOffset[axis];
        else if (selectedPart === 'head') currentVal = headOffset[axis];
        else if (selectedPart === 'body') currentVal = bodyOffset[axis];
        else if (selectedPart === 'hat') currentVal = hatOffset[axis];

        // No limits on movement
        const next = currentVal + delta;
        setPartOffset(selectedPart, axis, next);
    };

    const updateRotation = (delta: number) => {
        if (!selectedPart) return;
        let current = 0;
        if (selectedPart === 'leftArm') current = equippedLeftArmRotation;
        if (selectedPart === 'rightArm') current = equippedRightArmRotation;
        if (selectedPart === 'legs') current = equippedLegsRotation;
        if (selectedPart === 'hat') current = equippedHatRotation;

        let next = current + delta;
        if (next > 180) next = 180;
        if (next < -180) next = -180;
        setPartRotation(selectedPart as 'leftArm' | 'rightArm' | 'legs' | 'hat', next);
    };

    const updateScale = (delta: number) => {
        if (!selectedPart) return;

        let currentScale = 1;
        if (selectedPart === 'leftArm') currentScale = leftArmScale;
        else if (selectedPart === 'rightArm') currentScale = rightArmScale;
        else if (selectedPart === 'legs') currentScale = legsScale;
        else if (selectedPart === 'head') currentScale = headScale;
        else if (selectedPart === 'body') currentScale = bodyScale;
        else if (selectedPart === 'hat') currentScale = hatScale;

        const step = 0.05; // 5% increments for finer control
        const next = currentScale + (delta * step);
        setPartScale(selectedPart, next);
    };

    const renderItem = (item: ShopItem) => {
        const owned = isOwned(item.id);
        const equipped = isEquipped(item);
        const isLimb = ['leftArm', 'rightArm', 'legs'].includes(item.type);
        const isDisabled = isLimb && !isBodyEquipped;
        
        // For voices, check if unlocked; for other items, check premium status
        const isVoice = item.type === 'voice';
        const voiceItem = isVoice ? (item as VoiceShopItem) : null;
        const voiceUnlocked = isVoice ? isVoiceUnlocked(item.value) : false;
        const isPreviewingVoice = isVoice && previewingVoiceId === item.value;
        // For voices: locked = premium-only voice AND user is not subscribed (can't even buy it)
        // Premium users can BUY all voices, but don't get them automatically
        // Non-premium users can only BUY the 30% that aren't marked isPremium
        const isLocked = isVoice 
            ? (item.isPremium && !isSubscribed) // Voice is locked if it's premium-only AND user isn't subscribed
            : (item.isPremium && !isSubscribed); // Other items use same premium check

        return (
            <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={`bg-[#3E1F07] rounded-xl p-3 border-2 border-[#5c2e0b] shadow-lg flex flex-col items-center group ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#d4a373]'} relative transition-colors`}
            >
                {/* Item Preview Box */}
                <div className={`w-20 h-20 rounded-xl bg-[#f3e5ab] mb-3 overflow-hidden shadow-inner relative flex items-center justify-center ${item.type === 'frame' ? item.value + ' border-[6px] rounded-full' : 'border-2 border-[#eecaa0]/30'} ${isLocked ? 'grayscale opacity-70' : ''}`}>
                    {item.type === 'avatar' && (
                        AVATAR_ASSETS[item.value] ? (
                            <div className="w-[90%] h-[90%]">
                                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                    {AVATAR_ASSETS[item.value]}
                                </svg>
                            </div>
                        ) : (
                            <AvatarPartImage
                                src={item.value}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                thumb
                                loading="lazy"
                            />
                        )
                    )}
                    {item.type === 'animation' && (
                        <>
                            <span
                                className={`text-4xl leading-none select-none ${ANIMATION_PREVIEWS[item.value]?.previewClass ?? 'anim-breathe'}`}
                                style={{ display: 'inline-block' }}
                            >
                                {ANIMATION_PREVIEWS[item.value]?.emoji ?? '✨'}
                            </span>
                            {!isLocked && (
                                <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                                    <Play size={12} className="text-white" fill="currentColor" />
                                </div>
                            )}
                        </>
                    )}
                    {item.type === 'voice' && (
                        <>
                            {voiceItem?.characterImage ? (
                                <img
                                    src={voiceItem.characterImage}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-[#8B4513]">
                                    <Mic size={32} className="text-[#8B4513]" />
                                </div>
                            )}
                            {isPreviewingVoice && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                                    <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            {!isPreviewingVoice && !isLocked && (
                                <div className="absolute bottom-1 right-1 bg-black/50 rounded-full p-1">
                                    <Volume2 size={12} className="text-white" />
                                </div>
                            )}
                        </>
                    )}
                    {isWingPair(item) && (
                        <div className="flex items-center justify-center w-full h-full gap-0.5">
                            <AvatarPartImage
                                src={item.value}
                                alt="left wing"
                                className="h-full w-1/2 object-contain p-0.5"
                                thumb
                                loading="lazy"
                            />
                            <AvatarPartImage
                                src={item.pairValue}
                                alt="right wing"
                                className="h-full w-1/2 object-contain p-0.5"
                                thumb
                                loading="lazy"
                            />
                        </div>
                    )}
                    {(['hat', 'body', 'leftArm', 'rightArm', 'legs'].includes(item.type)) && !isWingPair(item) && (
                        item.value.startsWith('/') ? (
                            <AvatarPartImage
                                src={item.value}
                                alt={item.name || item.type}
                                className="w-full h-full object-contain p-1"
                                thumb
                                loading="lazy"
                            />
                        ) : AVATAR_ASSETS[item.value] ? (
                            <svg viewBox="0 0 100 100" className="w-full h-full p-2 overflow-visible">
                                {AVATAR_ASSETS[item.value]}
                            </svg>
                        ) : null
                    )}
                    {item.type === 'background' && (
                        <img 
                            src={item.value} 
                            alt={item.name} 
                            className="w-full h-full object-cover rounded-lg"
                        />
                    )}
                    {isDisabled && !isLocked && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                            <span className="text-white font-bold text-[8px] uppercase text-center px-1">{t('needBody')}</span>
                        </div>
                    )}
                    {isLocked && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[1px]">
                            <Crown size={36} className="text-[#FFD700] drop-shadow-md mb-1" fill="#B8860B" />
                            <span className="text-[#FFD700] text-[8px] font-extrabold uppercase tracking-wide bg-black/60 px-1.5 py-0.5 rounded-full">{t('locked')}</span>
                        </div>
                    )}
                </div>

                {item.name && (
                    <h3 className="text-white font-display font-bold text-xs mb-2 text-center leading-tight h-8 flex items-center justify-center">{item.name}</h3>
                )}

                {/* Action Buttons */}
                {isLocked ? (
                    <WoodButton
                        variant="gold"
                        fullWidth
                        className="text-[10px] py-1.5 flex items-center justify-center gap-1 border border-[#B8860B] shadow-[0_2px_0_#8B4513]"
                        onClick={(e) => { e.stopPropagation(); handleClose(); navigate('/paywall'); }}
                    >
                        <Crown size={10} fill="currentColor" /> {t('premium').toUpperCase()}
                    </WoodButton>
                ) : (owned || (isVoice && voiceUnlocked)) ? (
                    <div className="flex w-full gap-1">
                        {isVoice ? (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleVoicePreview(voiceItem!); }}
                                    className="flex-1 bg-[#f3e5ab] hover:bg-[#fff5cc] text-[#5c2e0b] font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 border border-[#d4a373] shadow-[0_2px_0_#d4a373] active:translate-y-[2px]"
                                >
                                    <Volume2 size={12} />
                                    <span>{isPreviewingVoice ? 'PLAYING' : 'PREVIEW'}</span>
                                </button>
                                <button
                                    disabled
                                    className="flex-1 bg-[#2e7d32] text-white font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 border border-white/20 shadow-inner"
                                >
                                    <Check size={12} />
                                    <span>{t('unlocked').toUpperCase()}</span>
                                </button>
                            </>
                        ) : equipped ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.type !== 'animation') handleUnequipItem(item);
                                }}
                                disabled={item.type === 'animation'} // Can't unequip animation, must swap
                                className={`flex-1 bg-[#2e7d32] text-white font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 border border-white/20 shadow-inner ${item.type !== 'animation' ? 'hover:bg-[#d32f2f] group-hover:content-["UNEQUIP"]' : ''}`}
                            >
                                <Check size={12} />
                                {item.type === 'animation' ? <span>{t('active').toUpperCase()}</span> : (
                                    <>
                                        <span className="group-hover:hidden">{t('on').toUpperCase()}</span>
                                        <span className="hidden group-hover:block"><Trash2 size={10} /></span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleEquip(item); }}
                                disabled={isDisabled}
                                className={`flex-1 font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-[0_2px_0_rgba(0,0,0,0.2)] active:translate-y-[2px] active:shadow-none transition-all ${isDisabled ? 'bg-gray-400 text-gray-800 cursor-not-allowed' : 'bg-[#f3e5ab] hover:bg-[#fff5cc] text-[#5c2e0b] shadow-[0_2px_0_#d4a373]'}`}
                            >
                                {isDisabled ? t('needBody').toUpperCase() : t('wear').toUpperCase()}
                            </button>
                        )}
                    </div>
                ) : (
                    <WoodButton
                        variant="primary"
                        fullWidth
                        className={`text-[10px] py-1.5 ${isDisabled ? 'opacity-50 grayscale cursor-not-allowed' : coins < item.price ? 'bg-gradient-to-r from-[#FFD700]/80 to-[#B8860B]/80 animate-pulse' : ''}`}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (isVoice) {
                                handleVoiceBuy(voiceItem!);
                                return;
                            }
                            // If not enough coins, redirect to Gold Coins page to earn more
                            if (coins < item.price && !isDisabled) {
                                setShowCoinHistory(true);
                                return;
                            }
                            handleBuy(item); 
                        }}
                        disabled={isDisabled}
                    >
                        {isVoice
                            ? (coins < item.price ? 'GET COINS' : `${item.price} ${t('gold')}`)
                            : isDisabled ? t('needBody').toUpperCase() : item.price === 0 ? t('free').toUpperCase() : coins < item.price ? `GET COINS` : `${item.price} ${t('gold')}`}
                    </WoodButton>
                )}
            </div>
        );
    };

    const renderSavedCharacter = (character: SavedCharacter) => (
        <div key={character.id} className="bg-[#3E1F07] rounded-xl p-2 border-2 border-[#5c2e0b] shadow-lg relative group">
            {/* Unstyled wrapper, Compositor handles frame */}
            <div className="w-full aspect-square relative overflow-hidden mb-2">
                <div className="w-full h-full transform scale-75 translate-y-2">
                    <AvatarCompositor
                        headUrl={character.avatar}
                        hat={character.hat}
                        body={character.body}
                        leftArm={character.leftArm}
                        rightArm={character.rightArm}
                        legs={character.legs}
                        animationStyle={character.animation}
                        leftArmRotation={character.leftArmRotation}
                        rightArmRotation={character.rightArmRotation}
                        legsRotation={character.legsRotation}
                        leftArmOffset={character.leftArmOffset}
                        rightArmOffset={character.rightArmOffset}
                        legsOffset={character.legsOffset}
                        frameClass="border-[#8B4513]" // Default frame for saved view
                    />
                </div>
            </div>
            <h3 className="text-white text-xs font-bold text-center mb-2 truncate px-1">{character.name}</h3>

            <div className="flex gap-1">
                <button
                    onClick={() => equipSavedCharacter(character)}
                    className="flex-1 bg-[#2e7d32] hover:bg-[#388e3c] text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform"
                >
                    <Check size={10} /> WEAR
                </button>
                <button
                    onClick={() => deleteSavedCharacter(character.id)}
                    className="w-8 bg-[#d32f2f] hover:bg-[#e53935] text-white rounded flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );

    const renderTab = (id: ShopTab, label: string) => (
        <button
            id={`shop-tab-${id}`}
            onClick={() => {
                setActiveTab(id);
                document.getElementById(`shop-tab-${id}`)?.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest'
                });
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-display font-bold text-sm transition-all whitespace-nowrap z-10 relative ${activeTab === id ? 'bg-[#8B4513] text-[#FFD700] shadow-md border border-[#FFD700]/20' : 'text-[#8B4513] hover:bg-[#3E1F07]/10'}`}
        >
            {label}
        </button>
    );

    const content = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={handleClose}
            ></div>

            {/* Main Shop Card */}
            <div className="relative w-full max-w-md h-[90vh] bg-[#f3e5ab] rounded-3xl border-4 border-[#8B4513] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-[#5c2e0b] px-3 py-2 flex justify-between items-center border-b-2 border-[#3E1F07] relative z-10 shadow-md shrink-0">
                    <h2 className="font-display font-bold text-white text-sm tracking-wide">Builder Shop</h2>

                    <button 
                        onClick={() => setShowCoinHistory(true)}
                        className="flex items-center gap-1.5 bg-black/40 hover:bg-black/50 px-2.5 py-1 rounded-full border border-[#FFD700]/30 shadow-inner transition-colors cursor-pointer active:scale-95"
                        title="View coin history & earn more"
                    >
                        <div className="w-4 h-4 rounded-full bg-[#FFD700] border border-[#B8860B] flex items-center justify-center text-[#B8860B] font-bold text-[8px]">$</div>
                        <span className="text-[#FFD700] font-bold font-display text-sm">{coins}</span>
                    </button>

                    {!hideCloseButton && (
                        <button onClick={handleClose} className="text-[#eecaa0] hover:text-white active:scale-95 transition-transform">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Preview Area (Live updates) */}
                <div
                    className={`w-full relative shrink-0 shadow-inner overflow-hidden flex flex-col items-center transition-all duration-500 ease-in-out bg-cover bg-center ${(isMenuMinimized || (isBuilderMode && selectedPart)) ? 'flex-1' : 'h-[16rem] shrink-0'}`}
                    style={{ backgroundImage: `url('/assets/images/dressing-room.jpg')` }}
                    onClick={toggleDrawerMinimized}
                >

                    {/* Toolbar: Builder Mode & Play */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between z-30 pointer-events-none">
                        <div className="flex gap-2 pointer-events-auto">
                            <button
                                onClick={() => {
                                    setIsBuilderMode(!isBuilderMode);
                                    if (!isBuilderMode) setSelectedPart(null);
                                }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 ${isBuilderMode ? 'bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]' : 'bg-black/30 border-white/20 text-white/70 hover:bg-black/50'}`}
                            >
                                <Wrench size={18} fill={isBuilderMode ? "currentColor" : "none"} />
                            </button>

                            {/* Swap Wings Button in Toolbar when Builder Mode is Active */}
                            {isBuilderMode && (
                                <button
                                    onClick={swapArms}
                                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]"
                                    title="Swap Wings"
                                >
                                    <ArrowLeftRight size={18} />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 pointer-events-auto">
                            {/* Quick Save Button - Updated Style */}
                            <button
                                onClick={handleQuickSave}
                                className={`w-auto px-4 h-10 rounded-full flex items-center justify-center gap-2 shadow-lg border-2 transition-all active:scale-95 ${isSavedFeedback ? 'bg-green-500 border-green-600 text-white' : 'bg-[#FFD700] border-[#B8860B] text-[#5c2e0b] hover:bg-[#ffe066]'}`}
                                title="Save Character"
                            >
                                {isSavedFeedback ? <Check size={18} /> : <Save size={18} />}
                                <span className="font-display font-bold text-xs">{isSavedFeedback ? 'SAVED' : 'SAVE'}</span>
                            </button>

                            {/* Play Animation */}
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 ${isPlaying ? 'bg-green-500 border-green-700 text-white' : 'bg-black/30 border-white/20 text-white/70 hover:bg-black/50'}`}
                            >
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                            </button>
                        </div>
                    </div>

                    {/* The Compositor */}
                    <div
                        className="w-40 h-40 relative z-20"
                        style={{
                            transition: 'all 0.5s ease-in-out',
                            transform: isBuilderMode && selectedPart
                                ? 'scale(0.8)'
                                : isMenuMinimized
                                    ? 'scale(1.25)'
                                    : 'scale(0.5)',
                            marginTop: isBuilderMode && selectedPart
                                ? '4rem'
                                : isMenuMinimized
                                    ? 'auto'
                                    : '2rem',
                            marginBottom: isBuilderMode && selectedPart
                                ? 'auto'
                                : isMenuMinimized
                                    ? 'auto'
                                    : '0',
                        }}
                    >
                        <div className="w-full h-full relative">
                            <AvatarCompositor
                                headUrl={equippedAvatar}
                                hat={equippedHat}
                                body={equippedBody}
                                leftArm={equippedLeftArm}
                                rightArm={equippedRightArm}
                                legs={equippedLegs}
                                animationStyle={previewAnimation ?? equippedAnimation}
                                leftArmRotation={equippedLeftArmRotation}
                                rightArmRotation={equippedRightArmRotation}
                                legsRotation={equippedLegsRotation}
                                hatRotation={equippedHatRotation}
                                leftArmOffset={leftArmOffset}
                                rightArmOffset={rightArmOffset}
                                legsOffset={legsOffset}
                                headOffset={headOffset}
                                bodyOffset={bodyOffset}
                                hatOffset={hatOffset}
                                leftArmScale={leftArmScale}
                                rightArmScale={rightArmScale}
                                legsScale={legsScale}
                                legsSpread={legsSpread}
                                headScale={headScale}
                                bodyScale={bodyScale}
                                hatScale={hatScale}
                                onPartClick={handlePartClick}
                                isAnimating={isPlaying}
                                frameClass={equippedFrame}
                            />
                            {showHatHint && equippedHat && (
                                <div
                                    className="absolute z-30 pointer-events-none"
                                    style={{ top: '8%', left: '50%', transform: 'translateX(-50%)' }}
                                >
                                    <div className="flex flex-col items-center animate-bounce">
                                        <span className="text-3xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
                                            👆
                                        </span>
                                        <span className="text-[10px] font-bold text-white bg-black/60 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap">
                                            Tap hat to move
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Drawer handle — z-60 so it stays above builder controls overlay */}
                <div
                    ref={drawerHandleRef}
                    className="relative z-[60] -mt-6 shrink-0 bg-[#f3e5ab] border-t-4 border-[#8B4513] rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
                    onTouchStart={handleDrawerTouchStart}
                    onTouchEnd={handleDrawerTouchEnd}
                >
                    <div
                        className="w-full h-9 flex flex-col items-center justify-center cursor-pointer shrink-0 hover:bg-black/5 transition-colors rounded-t-3xl touch-none"
                        onClick={toggleDrawerMinimized}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-[#8B4513]/30 transition-all duration-300" />
                        <span className="text-[8px] text-[#8B4513]/40 font-bold mt-1">
                            {isMenuMinimized ? '↑ SWIPE UP' : '↓ SWIPE DOWN'}
                        </span>
                    </div>
                </div>

                {/* Menu Container - tabs + items */}
                <div 
                    ref={menuContainerRef}
                    className={`flex flex-col bg-[#f3e5ab] relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ease-in-out ${(isMenuMinimized || (isBuilderMode && selectedPart)) ? 'h-auto shrink-0' : 'flex-1 min-h-0'}`}
                >

                    {/* Tabs Scroller - Updated visual cues */}
                    <div className="relative w-full border-b border-[#8B4513]/20 bg-[#eecaa0]/30 shrink-0">
                        <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#eecaa0] to-transparent z-20 pointer-events-none"></div>
                        <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#eecaa0] to-transparent z-20 pointer-events-none"></div>

                        <div
                            ref={tabsContainerRef}
                            className="flex overflow-x-auto p-2 gap-1 no-scrollbar relative z-10 px-4"
                        >
                            {renderTab('head', 'HEADS')}
                            {renderTab('hat', 'HATS')}
                            {renderTab('body', 'BODIES')}
                            {renderTab('arms', 'WINGS')}
                            {renderTab('legs', 'LEGS')}
                            {renderTab('moves', 'MOVES')}
                            {renderTab('voices', 'VOICES')}
                            {renderTab('backgrounds', '🌅 SCENES')}
                            {renderTab('saves', 'MY SAVES')}
                        </div>

                        {/* Scroll Hint Animation */}
                        {showScrollHint && (
                            <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-30 flex items-center justify-center">
                                <div className="animate-scroll-hint">
                                    <div className="relative flex items-center gap-2">
                                        {/* Pointing finger emoji with arrow */}
                                        <div className="text-4xl drop-shadow-2xl">👉</div>
                                        <div className="text-2xl text-[#FFD700] animate-pulse">→</div>
                                    </div>
                                </div>
                                <style>{`
                             @keyframes scroll-hint {
                                 0%, 100% { 
                                     transform: translateX(-30px) scale(1);
                                     opacity: 0.6;
                                 }
                                 25% { 
                                     transform: translateX(30px) scale(1.2);
                                     opacity: 1;
                                 }
                                 50% { 
                                     transform: translateX(90px) scale(1);
                                     opacity: 0.6;
                                 }
                                 75% { 
                                     transform: translateX(30px) scale(1.2);
                                     opacity: 1;
                                 }
                             }
                             .animate-scroll-hint {
                                 animation: scroll-hint 2.5s ease-in-out infinite;
                             }
                         `}</style>
                            </div>
                        )}
                    </div>

                    {/* Scrollable Items Content - Touch-friendly scrolling */}
                    <div 
                        className={`overflow-y-auto overscroll-contain p-4 bg-[#f3e5ab] relative transition-all duration-500 ${(isMenuMinimized || (isBuilderMode && selectedPart)) ? 'h-0 p-0 opacity-0 pointer-events-none' : 'flex-1 opacity-100'}`}
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        {activeTab === 'saves' ? (
                            <div className="flex flex-col gap-4 pb-20">
                                {/* Save Current Button */}
                                <WoodButton
                                    fullWidth
                                    variant="primary"
                                    onClick={handleQuickSave}
                                    className="py-3 flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Save size={20} /> {isSavedFeedback ? 'SAVED!' : 'SAVE CURRENT LOOK'}
                                </WoodButton>

                                <h3 className="font-display font-bold text-[#8B4513] text-sm uppercase tracking-wider border-b border-[#8B4513]/20 pb-1">
                                    Saved Characters
                                </h3>

                                {savedCharacters.length === 0 ? (
                                    <div className="text-center p-8 text-[#8B4513]/60 italic">
                                        No saved characters yet. <br /> Build something cool and save it!
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {savedCharacters.map(renderSavedCharacter)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 pb-20">
                                {getActiveItems().map(renderItem)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Builder Controls Overlay */}
                {isBuilderMode && selectedPart && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#2b1d13] border-t-4 border-[#8B4513] p-4 rounded-t-3xl z-50 animate-in slide-in-from-bottom-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">

                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <div className="bg-[#FFD700] w-2 h-5 rounded-full"></div>
                                <span className="text-white font-display font-bold text-sm uppercase tracking-wider">
                                    Adjust {selectedPart === 'legs' ? 'Legs' : selectedPart === 'leftArm' ? 'Left Wing' : selectedPart === 'rightArm' ? 'Right Wing' : selectedPart === 'head' ? 'Head' : selectedPart === 'hat' ? 'Hat' : 'Body'}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedPart(null)}
                                className="bg-white/10 p-1.5 rounded-full text-white/70 hover:bg-red-500 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex justify-between items-start gap-1.5 px-0">
                            <div className="flex flex-col gap-0.5 items-center flex-shrink-0">
                                <span className="text-[9px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Move</span>
                                <div className="grid grid-cols-2 gap-0.5">
                                    <button onClick={() => updateOffset('x', -2)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><MoveHorizontal size={14} className="rotate-180" /></button>
                                    <button onClick={() => updateOffset('x', 2)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><MoveHorizontal size={14} /></button>
                                    <button onClick={() => updateOffset('y', -2)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><ArrowUpToLine size={14} /></button>
                                    <button onClick={() => updateOffset('y', 2)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><ArrowDownToLine size={14} /></button>
                                </div>
                            </div>

                            {selectedPart !== 'head' && selectedPart !== 'body' && (
                                <>
                                    <div className="w-px h-16 bg-white/10 flex-shrink-0"></div>

                                    <div className="flex flex-col gap-0.5 items-center flex-shrink-0">
                                        <span className="text-[9px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Rotate</span>
                                        <div className="flex gap-0.5 items-center">
                                            <button onClick={() => updateRotation(-5)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><RotateCcw size={14} /></button>
                                            <button onClick={() => updateRotation(5)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center"><RotateCw size={14} /></button>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="w-px h-16 bg-white/10 flex-shrink-0"></div>

                            <div className="flex flex-col gap-0.5 items-center flex-shrink-0">
                                <span className="text-[9px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Scale</span>
                                <div className="flex gap-0.5 items-center">
                                    <button onClick={() => updateScale(-1)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center" title="Make Smaller"><ZoomOut size={14} /></button>
                                    <button onClick={() => updateScale(1)} className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center" title="Make Bigger"><ZoomIn size={14} /></button>
                                </div>
                                <span className="text-[9px] text-[#eecaa0] font-bold">
                                    {(() => {
                                        let currentScale = 1;
                                        if (selectedPart === 'leftArm') currentScale = leftArmScale;
                                        else if (selectedPart === 'rightArm') currentScale = rightArmScale;
                                        else if (selectedPart === 'legs') currentScale = legsScale;
                                        else if (selectedPart === 'head') currentScale = headScale;
                                        else if (selectedPart === 'body') currentScale = bodyScale;
                                        else if (selectedPart === 'hat') currentScale = hatScale;
                                        return `${Math.round(currentScale * 100)}%`;
                                    })()}
                                </span>
                            </div>

                            {selectedPart === 'legs' && (
                                <>
                                    <div className="w-px h-16 bg-white/10 flex-shrink-0"></div>

                                    <div className="flex flex-col gap-0.5 items-center flex-shrink-0">
                                        <span className="text-[9px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Spread</span>
                                        <div className="flex gap-0.5 items-center">
                                            <button 
                                                onClick={() => setLegsSpread(Math.max(0.7, legsSpread - 0.05))} 
                                                className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center" 
                                                title="Closer Together"
                                            >
                                                <ArrowLeftRight size={14} className="scale-x-75" />
                                            </button>
                                            <button 
                                                onClick={() => setLegsSpread(Math.min(1.5, legsSpread + 0.05))} 
                                                className="w-8 h-8 bg-[#3E1F07] rounded-lg text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-2 border-[#2a1505] flex items-center justify-center" 
                                                title="Further Apart"
                                            >
                                                <ArrowLeftRight size={14} className="scale-x-125" />
                                            </button>
                                        </div>
                                        <span className="text-[9px] text-[#eecaa0] font-bold">
                                            {Math.round(legsSpread * 100)}%
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );

    return (
        <>
            {createPortal(content, document.body)}
            <CoinHistoryModal 
                isOpen={showCoinHistory} 
                onClose={() => setShowCoinHistory(false)}
                onOpenShop={() => {
                    setShowCoinHistory(false);
                    // Already in shop, no need to do anything
                }}
            />
        </>
    );
};

export default ShopModal;
