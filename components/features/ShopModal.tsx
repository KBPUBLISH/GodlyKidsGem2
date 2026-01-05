
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import WoodButton from '../ui/WoodButton';
import { X, ShoppingBag, Check, Trash2, Crown, Wrench, Play, Pause, ArrowUpToLine, ArrowDownToLine, MoveHorizontal, RotateCcw, RotateCw, ArrowLeftRight, Activity, Save, User, ZoomIn, ZoomOut, Mic } from 'lucide-react';
import { useUser, ShopItem, SavedCharacter } from '../../context/UserContext';
import AvatarCompositor from '../avatar/AvatarCompositor';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';
import { ApiService } from '../../services/apiService';
import { filterVisibleVoices } from '../../services/voiceManagementService';
import CoinHistoryModal from './CoinHistoryModal';
import { useLanguage } from '../../context/LanguageContext';

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: ShopTab;
}

// --- SHOP DATA ---
const SHOP_AVATARS: ShopItem[] = [
    // FUNNY HEADS
    { id: 'av1', name: 'Toast', price: 50, type: 'avatar', value: 'head-toast' },
    { id: 'av2', name: 'Burger', price: 50, type: 'avatar', value: 'head-burger' },
    { id: 'av3', name: 'TV', price: 50, type: 'avatar', value: 'head-tv' },
    { id: 'av4', name: 'Cookie', price: 50, type: 'avatar', value: 'head-cookie' },
    { id: 'av5', name: 'Slime', price: 50, type: 'avatar', value: 'head-slime' },
    { id: 'av6', name: 'Pumpkin', price: 50, type: 'avatar', value: 'head-pumpkin' },
    { id: 'av7', name: 'Earth', price: 50, type: 'avatar', value: 'head-earth', isPremium: true },
    { id: 'av8', name: 'Moon', price: 50, type: 'avatar', value: 'head-moon', isPremium: true },
    { id: 'av9', name: 'Bomb', price: 50, type: 'avatar', value: 'head-bomb', isPremium: true },
    { id: 'av10', name: 'Eye', price: 50, type: 'avatar', value: 'head-eye', isPremium: true },
    // ANIMAL HEADS
    { id: 'av13', name: 'Bear', price: 50, type: 'avatar', value: 'head-bear-brown' },
    { id: 'av14', name: 'Polar Bear', price: 50, type: 'avatar', value: 'head-bear-polar', isPremium: true },
    { id: 'av15', name: 'Aviator', price: 75, type: 'avatar', value: 'head-bear-aviator', isPremium: true },
    { id: 'av16', name: 'Pug', price: 50, type: 'avatar', value: 'head-dog-pug' },
    { id: 'av17', name: 'Dalmatian', price: 50, type: 'avatar', value: 'head-dog-dalmatian', isPremium: true },
    { id: 'av18', name: 'Orange Cat', price: 50, type: 'avatar', value: 'head-cat-orange' },
    { id: 'av19', name: 'Black Cat', price: 50, type: 'avatar', value: 'head-cat-black', isPremium: true },
    { id: 'av20', name: 'Lizard', price: 50, type: 'avatar', value: 'head-lizard', isPremium: true },
];

const SHOP_HATS: ShopItem[] = [
    { id: 'h1', name: 'Pirate Hat', price: 150, type: 'hat', value: 'hat-pirate' },
    { id: 'h2', name: 'Viking Helmet', price: 200, type: 'hat', value: 'hat-viking', isPremium: true },
    { id: 'h3', name: 'Propeller', price: 250, type: 'hat', value: 'hat-propeller' },
    { id: 'h4', name: 'King Crown', price: 500, type: 'hat', value: 'hat-crown', isPremium: true },
    { id: 'h5', name: 'Cowboy', price: 200, type: 'hat', value: 'hat-cowboy' },
    { id: 'h6', name: 'Cone', price: 100, type: 'hat', value: 'hat-cone' },
    { id: 'h7', name: 'Sombrero', price: 250, type: 'hat', value: 'hat-sombrero' },
    { id: 'h8', name: 'Brain', price: 400, type: 'hat', value: 'hat-brain', isPremium: true },
    { id: 'h9', name: 'Poo', price: 300, type: 'hat', value: 'hat-poo' },
    { id: 'h10', name: 'Astronaut', price: 350, type: 'hat', value: 'hat-astronaut', isPremium: true },
    { id: 'h11', name: 'Chef', price: 150, type: 'hat', value: 'hat-chef' },
    { id: 'h12', name: 'Party', price: 100, type: 'hat', value: 'hat-party' },
    { id: 'h13', name: 'Top Hat', price: 250, type: 'hat', value: 'hat-tophat' },
    { id: 'h14', name: 'Flowers', price: 150, type: 'hat', value: 'hat-flowers' },
    { id: 'h15', name: 'Ninja', price: 200, type: 'hat', value: 'hat-ninja', isPremium: true },
    { id: 'h16', name: 'Backwards Cap', price: 150, type: 'hat', value: 'hat-cap-backwards' },
    { id: 'h17', name: 'Beanie', price: 120, type: 'hat', value: 'hat-beanie' },
    { id: 'h18', name: 'Jester', price: 300, type: 'hat', value: 'hat-jester', isPremium: true },
    { id: 'h19', name: 'Afro', price: 200, type: 'hat', value: 'hat-afro' },
    { id: 'h20', name: 'Grad', price: 250, type: 'hat', value: 'hat-grad', isPremium: true },
    { id: 'h21', name: 'Headphones', price: 300, type: 'hat', value: 'hat-headphones', isPremium: true },
];

const SHOP_BODIES: ShopItem[] = [
    { id: 'b1', name: 'Robot Chest', price: 150, type: 'body', value: 'body-robot', isPremium: true },
    { id: 'b2', name: 'Super Suit', price: 200, type: 'body', value: 'body-suit', isPremium: true },
    { id: 'b3', name: 'Tuxedo', price: 250, type: 'body', value: 'body-tux' },
    { id: 'b4', name: 'Hotdog', price: 300, type: 'body', value: 'body-hotdog' },
    { id: 'b5', name: 'Skeleton', price: 300, type: 'body', value: 'body-skeleton', isPremium: true },
    { id: 'b6', name: 'Armor', price: 350, type: 'body', value: 'body-armor', isPremium: true },
    { id: 'b7', name: 'Donut', price: 250, type: 'body', value: 'body-donut' },
    { id: 'b8', name: 'Dress', price: 200, type: 'body', value: 'body-dress' },
    { id: 'b9', name: 'Overalls', price: 150, type: 'body', value: 'body-overalls' },
    { id: 'b10', name: 'Muscle', price: 200, type: 'body', value: 'body-muscle' },
    { id: 'b11', name: 'Ghost', price: 300, type: 'body', value: 'body-ghost' },
    { id: 'b12', name: 'Hawaiian', price: 150, type: 'body', value: 'body-hawaiian' },
    { id: 'b13', name: 'Puffer', price: 200, type: 'body', value: 'body-puffer' },
    { id: 'b14', name: 'Hoodie', price: 150, type: 'body', value: 'body-hoodie' },
    { id: 'b15', name: 'Logo Tee', price: 120, type: 'body', value: 'body-tshirt-logo' },
    { id: 'b16', name: 'King Robe', price: 400, type: 'body', value: 'body-king-robe', isPremium: true },
    { id: 'b17', name: 'Jester Suit', price: 300, type: 'body', value: 'body-jester', isPremium: true },
    { id: 'b18', name: 'Karate', price: 200, type: 'body', value: 'body-karate' },
    { id: 'b19', name: 'Space Suit', price: 350, type: 'body', value: 'body-space-suit', isPremium: true },
];

const SHOP_ARMS: ShopItem[] = [
    { id: 'al1', name: 'L Robot', price: 100, type: 'leftArm', value: 'arm-l-robot', isPremium: true },
    { id: 'ar1', name: 'R Robot', price: 100, type: 'rightArm', value: 'arm-r-robot', isPremium: true },
    { id: 'al2', name: 'L Muscle', price: 120, type: 'leftArm', value: 'arm-l-muscle' },
    { id: 'ar2', name: 'R Muscle', price: 120, type: 'rightArm', value: 'arm-r-muscle' },
    { id: 'al3', name: 'L Tentacle', price: 150, type: 'leftArm', value: 'arm-l-tentacle', isPremium: true },
    { id: 'ar3', name: 'R Tentacle', price: 150, type: 'rightArm', value: 'arm-r-tentacle', isPremium: true },
    { id: 'al4', name: 'L Hook', price: 150, type: 'leftArm', value: 'arm-l-hook' },
    { id: 'ar4', name: 'R Hook', price: 150, type: 'rightArm', value: 'arm-r-hook' },
    { id: 'al5', name: 'L Crab', price: 200, type: 'leftArm', value: 'arm-l-crab', isPremium: true },
    { id: 'ar5', name: 'R Crab', price: 200, type: 'rightArm', value: 'arm-r-crab', isPremium: true },
    { id: 'al6', name: 'L Zombie', price: 200, type: 'leftArm', value: 'arm-l-zombie' },
    { id: 'ar6', name: 'R Zombie', price: 200, type: 'rightArm', value: 'arm-r-zombie' },
    { id: 'al7', name: 'L Wing', price: 250, type: 'leftArm', value: 'arm-l-wing' },
    { id: 'ar7', name: 'R Wing', price: 250, type: 'rightArm', value: 'arm-r-wing' },
    { id: 'al8', name: 'L Dragon', price: 300, type: 'leftArm', value: 'arm-l-wing-dragon', isPremium: true },
    { id: 'ar8', name: 'R Dragon', price: 300, type: 'rightArm', value: 'arm-r-wing-dragon', isPremium: true },
    { id: 'al9', name: 'L Cactus', price: 150, type: 'leftArm', value: 'arm-l-cactus' },
    { id: 'ar9', name: 'R Cactus', price: 150, type: 'rightArm', value: 'arm-r-cactus' },
    { id: 'al10', name: 'L Box', price: 100, type: 'leftArm', value: 'arm-l-box' },
    { id: 'ar10', name: 'R Box', price: 100, type: 'rightArm', value: 'arm-r-box' },
    { id: 'al11', name: 'L Slime', price: 250, type: 'leftArm', value: 'arm-l-slime' },
    { id: 'ar11', name: 'R Slime', price: 250, type: 'rightArm', value: 'arm-r-slime' },
    { id: 'al12', name: 'L Bone', price: 200, type: 'leftArm', value: 'arm-l-skeleton-fancy', isPremium: true },
    { id: 'ar12', name: 'R Bone', price: 200, type: 'rightArm', value: 'arm-r-skeleton-fancy', isPremium: true },
    { id: 'al13', name: 'L Drill', price: 300, type: 'leftArm', value: 'arm-l-drill', isPremium: true },
    { id: 'ar13', name: 'R Drill', price: 300, type: 'rightArm', value: 'arm-r-drill', isPremium: true },
    { id: 'al14', name: 'L Baguette', price: 150, type: 'leftArm', value: 'arm-l-baguette' },
    { id: 'ar14', name: 'R Baguette', price: 150, type: 'rightArm', value: 'arm-r-baguette' },
    { id: 'al15', name: 'L Angel', price: 250, type: 'leftArm', value: 'arm-l-wing-angel', isPremium: true },
    { id: 'ar15', name: 'R Angel', price: 250, type: 'rightArm', value: 'arm-r-wing-angel', isPremium: true },
    { id: 'al16', name: 'L Boxing', price: 150, type: 'leftArm', value: 'arm-l-glove-boxing' },
    { id: 'ar16', name: 'R Boxing', price: 150, type: 'rightArm', value: 'arm-r-glove-boxing' },
    { id: 'al17', name: 'L Claw', price: 200, type: 'leftArm', value: 'arm-l-claw-monster' },
    { id: 'ar17', name: 'R Claw', price: 200, type: 'rightArm', value: 'arm-r-claw-monster' },
    { id: 'al18', name: 'L Leaf', price: 120, type: 'leftArm', value: 'arm-l-leaf' },
    { id: 'ar18', name: 'R Leaf', price: 120, type: 'rightArm', value: 'arm-r-leaf' },
    { id: 'al19', name: 'L Wand', price: 300, type: 'leftArm', value: 'arm-l-wand', isPremium: true },
    { id: 'ar19', name: 'R Wand', price: 300, type: 'rightArm', value: 'arm-r-wand', isPremium: true },
    { id: 'al20', name: 'L Shield', price: 250, type: 'leftArm', value: 'arm-l-shield', isPremium: true },
    { id: 'ar20', name: 'R Shield', price: 250, type: 'rightArm', value: 'arm-r-shield', isPremium: true },
];

const SHOP_LEGS: ShopItem[] = [
    { id: 'l1', name: 'Wheels', price: 200, type: 'legs', value: 'legs-wheels' },
    { id: 'l2', name: 'Chicken', price: 150, type: 'legs', value: 'legs-chicken' },
    { id: 'l3', name: 'Rocket', price: 300, type: 'legs', value: 'legs-rocket', isPremium: true },
    { id: 'l4', name: 'Mermaid', price: 350, type: 'legs', value: 'legs-mermaid', isPremium: true },
    { id: 'l5', name: 'Spider', price: 300, type: 'legs', value: 'legs-spider', isPremium: true },
    { id: 'l6', name: 'Peg', price: 200, type: 'legs', value: 'legs-peg' },
    { id: 'l7', name: 'UFO', price: 400, type: 'legs', value: 'legs-ufo', isPremium: true },
    { id: 'l8', name: 'Skates', price: 250, type: 'legs', value: 'legs-skates' },
    { id: 'l9', name: 'Ghost', price: 200, type: 'legs', value: 'legs-ghost' },
    { id: 'l10', name: 'Ballerina', price: 200, type: 'legs', value: 'legs-ballerina' },
    { id: 'l11', name: 'Jeans', price: 150, type: 'legs', value: 'legs-jeans' },
    { id: 'l12', name: 'Shorts', price: 150, type: 'legs', value: 'legs-shorts' },
    { id: 'l13', name: 'Springs', price: 250, type: 'legs', value: 'legs-springs' },
    { id: 'l14', name: 'Rain Boots', price: 150, type: 'legs', value: 'legs-boots-rain' },
    { id: 'l15', name: 'Pink Tail', price: 350, type: 'legs', value: 'legs-tail-mermaid-pink', isPremium: true },
    { id: 'l16', name: 'Hoverboard', price: 400, type: 'legs', value: 'legs-hoverboard', isPremium: true },
    { id: 'l17', name: 'Cloud', price: 300, type: 'legs', value: 'legs-cloud', isPremium: true },
    { id: 'l18', name: 'Elf', price: 200, type: 'legs', value: 'legs-elf' },
    { id: 'l19', name: 'Karate', price: 150, type: 'legs', value: 'legs-karate' },
];

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

type ShopTab = 'head' | 'hat' | 'body' | 'arms' | 'legs' | 'moves' | 'voices' | 'saves';

const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, initialTab }) => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ShopTab>(initialTab || 'head');
    const [availableVoices, setAvailableVoices] = useState<any[]>([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [isMenuMinimized, setIsMenuMinimized] = useState(false);
    const [isBuilderMode, setIsBuilderMode] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedPart, setSelectedPart] = useState<'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat' | null>(null);
    const [isSavedFeedback, setIsSavedFeedback] = useState(false);
    const [showScrollHint, setShowScrollHint] = useState(false);
    const [showCoinHistory, setShowCoinHistory] = useState(false);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number>(0);
    const touchStartTime = useRef<number>(0);
    
    // Wrapper for onClose that dispatches event for referral prompt
    const handleClose = () => {
        // Dispatch custom event to trigger referral prompt after shop closes
        window.dispatchEvent(new CustomEvent('godlykids_shop_closed'));
        onClose();
    };

    // Update tab when initialTab changes
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

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
                const voiceItems: ShopItem[] = visibleVoices.map((voice, index) => {
                    // First 30% are available to all users, rest require premium subscription to purchase
                    const isFreeTier = index < freeTierCount;

                    return {
                        id: `voice-${voice.voice_id}`,
                        name: voice.name,
                        price: 200, // All voices cost 200 coins (even for premium users)
                        type: 'voice',
                        value: voice.voice_id,
                        isPremium: !isFreeTier, // Premium-only if not in first 30% (requires subscription to BUY)
                        characterImage: voice.characterImage, // Add character image
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
        equippedLeftArmRotation,
        equippedRightArmRotation,
        equippedLegsRotation,
        setPartRotation,
        leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
        setPartOffset,
        leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale,
        setPartScale,
        swapArms,
        savedCharacters,
        saveCurrentCharacter,
        deleteSavedCharacter,
        equipSavedCharacter
    } = useUser();

    if (!isOpen) return null;

    const handleBuy = (item: ShopItem) => {
        // For voices, use the unlock system
        if (item.type === 'voice') {
            if (coins >= item.price) {
                // Deduct coins and unlock voice
                purchaseItem(item); // This handles coin deduction
                unlockVoice(item.value); // Unlock the voice
                console.log(`🎤 Voice unlocked via shop: ${item.name}`);
            }
        } else {
            purchaseItem(item);
        }
    };

    const handleEquip = (item: ShopItem) => {
        equipItem(item.type, item.value);
        if (item.type === 'animation') {
            setIsPlaying(true); // Auto play preview
        }
    };

    const handleUnequip = (type: ShopItem['type']) => {
        unequipItem(type);
    };

    const handleQuickSave = () => {
        saveCurrentCharacter();
        setIsPlaying(false); // Stop animation on save to prevent weirdness
        setIsSavedFeedback(true);
        setTimeout(() => setIsSavedFeedback(false), 1500);
    };

    const isBodyEquipped = !!equippedBody;

    const handleCardClick = (item: ShopItem) => {
        // For voices, check if already unlocked
        if (item.type === 'voice') {
            const voiceUnlocked = isVoiceUnlocked(item.value);
            if (voiceUnlocked) {
                // Already unlocked, do nothing
                return;
            }
            
            // Check if user can purchase this voice
            if (item.isPremium && !isSubscribed) {
                // Premium-only voice and user isn't subscribed - go to paywall
                handleClose();
                navigate('/paywall');
                return;
            }
            
            // User can purchase - check if they have enough coins
            // All voices cost coins (even for premium users)
            const voicePrice = item.price > 0 ? item.price : 200; // Default price for premium voices
            if (coins >= voicePrice) {
                handleBuy({ ...item, price: voicePrice });
            } else {
                // Not enough coins - redirect to Gold Coins page to earn more
                setShowCoinHistory(true);
            }
            return;
        }
        
        // Non-voice items
        if (isOwned(item.id)) {
            if (isEquipped(item)) {
                // Animations cannot be unequipped to null, only swapped
                if (item.type !== 'animation') {
                    handleUnequip(item.type);
                }
            } else {
                const isLimb = ['leftArm', 'rightArm', 'legs'].includes(item.type);
                if (isLimb && !isBodyEquipped) return;
                handleEquip(item);
            }
        } else if (item.isPremium && !isSubscribed) {
            // Premium item requires subscription
            handleClose();
            navigate('/paywall');
        } else if (coins < item.price && item.price > 0) {
            // Not enough coins - redirect to Gold Coins page to earn more via referrals
            setShowCoinHistory(true);
        }
    };

    const getActiveItems = () => {
        switch (activeTab) {
            case 'head': return SHOP_AVATARS;
            case 'hat': return SHOP_HATS;
            case 'body': return SHOP_BODIES;
            case 'arms': return SHOP_ARMS;
            case 'legs': return SHOP_LEGS;
            case 'moves': return SHOP_ANIMATIONS;
            case 'voices': return availableVoices;
            case 'saves': return []; // Handled separately
            default: return [];
        }
    };

    const isEquipped = (item: ShopItem) => {
        switch (item.type) {
            case 'avatar': return equippedAvatar === item.value;
            case 'hat': return equippedHat === item.value;
            case 'body': return equippedBody === item.value;
            case 'leftArm': return equippedLeftArm === item.value;
            case 'rightArm': return equippedRightArm === item.value;
            case 'legs': return equippedLegs === item.value;
            case 'animation': return equippedAnimation === item.value;
            case 'voice': return false; // Voices don't have an "equipped" state
            default: return false;
        }
    };

    // --- BUILDER CONTROLS LOGIC ---
    const handlePartClick = (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat') => {
        if (isBuilderMode) {
            setSelectedPart(part);
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

        const minVal = -50;
        const maxVal = axis === 'y' ? 120 : 100;
        const next = Math.max(minVal, Math.min(maxVal, currentVal + delta));
        setPartOffset(selectedPart, axis, next);
    };

    const updateRotation = (delta: number) => {
        if (!selectedPart) return;
        let current = 0;
        if (selectedPart === 'leftArm') current = equippedLeftArmRotation;
        if (selectedPart === 'rightArm') current = equippedRightArmRotation;
        if (selectedPart === 'legs') current = equippedLegsRotation;

        let next = current + delta;
        if (next > 180) next = 180;
        if (next < -180) next = -180;
        setPartRotation(selectedPart, next);
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

        const step = 0.1; // 10% increments
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
        const voiceUnlocked = isVoice ? isVoiceUnlocked(item.value) : false;
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
                            <img src={item.value} alt={item.name} className="w-full h-full object-cover" />
                        )
                    )}
                    {item.type === 'animation' && (
                        <div className="flex flex-col items-center justify-center text-[#8B4513]">
                            <Activity size={32} className="animate-pulse" />
                        </div>
                    )}
                    {item.type === 'voice' && (
                        <>
                            {(item as any).characterImage ? (
                                <img
                                    src={(item as any).characterImage}
                                    alt={item.name}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-[#8B4513]">
                                    <Mic size={32} className="text-[#8B4513]" />
                                </div>
                            )}
                        </>
                    )}
                    {(['hat', 'body', 'leftArm', 'rightArm', 'legs'].includes(item.type)) && AVATAR_ASSETS[item.value] && (
                        <svg viewBox="0 0 100 100" className="w-full h-full p-2 overflow-visible">
                            {AVATAR_ASSETS[item.value]}
                        </svg>
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

                <h3 className="text-white font-display font-bold text-xs mb-2 text-center leading-tight h-8 flex items-center justify-center">{item.name}</h3>

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
                            // Voices show "Unlocked" status
                            <button
                                disabled
                                className="flex-1 bg-[#2e7d32] text-white font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 border border-white/20 shadow-inner"
                            >
                                <Check size={12} />
                                <span>{t('unlocked').toUpperCase()}</span>
                            </button>
                        ) : equipped ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.type !== 'animation') handleUnequip(item.type);
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
                            // If not enough coins, redirect to Gold Coins page to earn more
                            if (coins < item.price && !isDisabled) {
                                setShowCoinHistory(true);
                                return;
                            }
                            handleBuy(item); 
                        }}
                        disabled={isDisabled}
                    >
                        {isDisabled ? t('needBody').toUpperCase() : item.price === 0 ? t('free').toUpperCase() : coins < item.price ? `GET COINS` : `${item.price} ${t('gold')}`}
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
                <div className="bg-[#5c2e0b] p-4 flex justify-between items-center border-b-4 border-[#3E1F07] relative z-10 shadow-md shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#8B4513] rounded-full flex items-center justify-center border-2 border-[#CD853F] shadow-md">
                            <ShoppingBag size={20} className="text-[#FFD700]" />
                        </div>
                        <div className="leading-tight">
                            <h2 className="font-display font-bold text-white text-lg tracking-wide">Builder Shop</h2>
                            <span className="text-[#eecaa0] text-[10px] font-bold uppercase tracking-wider">Create your monster!</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowCoinHistory(true)}
                        className="flex items-center gap-2 bg-black/40 hover:bg-black/50 px-3 py-1.5 rounded-full border border-[#FFD700]/30 shadow-inner transition-colors cursor-pointer active:scale-95"
                        title="View coin history & earn more"
                    >
                        <div className="w-5 h-5 rounded-full bg-[#FFD700] border border-[#B8860B] flex items-center justify-center text-[#B8860B] font-bold text-[10px]">$</div>
                        <span className="text-[#FFD700] font-bold font-display text-lg">{coins}</span>
                    </button>

                    <button onClick={handleClose} className="ml-2 text-[#eecaa0] hover:text-white active:scale-95 transition-transform">
                        <X size={24} />
                    </button>
                </div>

                {/* Preview Area (Live updates) */}
                <div
                    className={`w-full bg-[#8B4513] relative shrink-0 shadow-inner overflow-hidden flex flex-col items-center transition-all duration-500 ease-in-out ${isMenuMinimized ? 'flex-1' : 'h-[20rem] shrink-0'}`}
                >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
                    </div>

                    {/* Spotlight */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none blur-md"></div>

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

                            {/* Swap Arms Button in Toolbar when Builder Mode is Active */}
                            {isBuilderMode && (
                                <button
                                    onClick={swapArms}
                                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 bg-[#FFD700] border-[#B8860B] text-[#5c2e0b]"
                                    title="Swap Arms"
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
                        className={`w-40 h-40 relative z-20 transition-all duration-500 ease-in-out mt-10 ${isMenuMinimized ? 'scale-125 mt-20' : ''}`}
                        onClick={() => setIsMenuMinimized(true)}
                    >
                        {/* Wrapper now only sizes; Compositor handles frame */}
                        <div className="w-full h-full relative">
                            <AvatarCompositor
                                headUrl={equippedAvatar}
                                hat={equippedHat}
                                body={equippedBody}
                                leftArm={equippedLeftArm}
                                rightArm={equippedRightArm}
                                legs={equippedLegs}
                                animationStyle={equippedAnimation} // Pass equipped animation
                                leftArmRotation={equippedLeftArmRotation}
                                rightArmRotation={equippedRightArmRotation}
                                legsRotation={equippedLegsRotation}
                                leftArmOffset={leftArmOffset}
                                rightArmOffset={rightArmOffset}
                                legsOffset={legsOffset}
                                headOffset={headOffset}
                                bodyOffset={bodyOffset}
                                hatOffset={hatOffset}
                                leftArmScale={leftArmScale}
                                rightArmScale={rightArmScale}
                                legsScale={legsScale}
                                headScale={headScale}
                                bodyScale={bodyScale}
                                hatScale={hatScale}
                                onPartClick={isBuilderMode ? handlePartClick : undefined}
                                isAnimating={isPlaying}
                                frameClass={equippedFrame} // Pass frame
                            />
                        </div>
                        {/* Tip */}
                        {isBuilderMode && !selectedPart && (
                            <div className="absolute -bottom-12 left-0 right-0 text-center animate-bounce">
                                <span className="text-[#FFD700] text-[10px] font-bold bg-black/60 px-2 py-1 rounded-full">
                                    Tap parts to edit!
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Menu Container - Swipeable */}
                <div 
                    ref={menuContainerRef}
                    className={`flex flex-col bg-[#f3e5ab] border-t-4 border-[#8B4513] rounded-t-3xl -mt-6 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ease-in-out ${isMenuMinimized ? 'h-auto shrink-0' : 'flex-1 min-h-0'}`}
                    onTouchStart={(e) => {
                        touchStartY.current = e.touches[0].clientY;
                        touchStartTime.current = Date.now();
                    }}
                    onTouchEnd={(e) => {
                        const touchEndY = e.changedTouches[0].clientY;
                        const deltaY = touchStartY.current - touchEndY;
                        const timeDelta = Date.now() - touchStartTime.current;
                        
                        // Only trigger if it's a quick swipe (under 300ms) and significant distance (over 50px)
                        if (timeDelta < 300 && Math.abs(deltaY) > 50) {
                            if (deltaY > 0) {
                                // Swiped UP - expand the menu (show items)
                                setIsMenuMinimized(false);
                            } else {
                                // Swiped DOWN - minimize the menu (hide items)
                                setIsMenuMinimized(true);
                            }
                        }
                    }}
                >

                    {/* Handle Bar - Visual indicator for swiping */}
                    <div
                        className="w-full h-9 flex flex-col items-center justify-center cursor-pointer shrink-0 hover:bg-black/5 transition-colors rounded-t-3xl"
                        onClick={() => setIsMenuMinimized(!isMenuMinimized)}
                    >
                        <div className={`w-12 h-1.5 rounded-full bg-[#8B4513]/30 transition-all duration-300`}></div>
                        <span className="text-[8px] text-[#8B4513]/40 font-bold mt-1">
                            {isMenuMinimized ? '↑ SWIPE UP' : '↓ SWIPE DOWN'}
                        </span>
                    </div>

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
                            {renderTab('arms', 'ARMS')}
                            {renderTab('legs', 'LEGS')}
                            {renderTab('moves', 'MOVES')}
                            {renderTab('voices', 'VOICES')}
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
                        className={`overflow-y-auto overscroll-contain p-4 bg-[#f3e5ab] relative transition-all duration-500 ${isMenuMinimized ? 'h-0 p-0 opacity-0 pointer-events-none' : 'flex-1 opacity-100'}`}
                        style={{ WebkitOverflowScrolling: 'touch' }}
                        onTouchStart={(e) => e.stopPropagation()} // Prevent menu swipe when scrolling items
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
                    <div className="absolute bottom-0 left-0 right-0 bg-[#2b1d13] border-t-4 border-[#8B4513] p-6 rounded-t-3xl z-50 animate-in slide-in-from-bottom-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">

                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className="bg-[#FFD700] w-2 h-6 rounded-full"></div>
                                <span className="text-white font-display font-bold text-lg uppercase tracking-wider">
                                    Adjust {selectedPart === 'legs' ? 'Legs' : selectedPart === 'leftArm' ? 'Left Arm' : selectedPart === 'rightArm' ? 'Right Arm' : selectedPart === 'head' ? 'Head' : selectedPart === 'hat' ? 'Hat' : 'Body'}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedPart(null)}
                                className="bg-white/10 p-2 rounded-full text-white/70 hover:bg-red-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex justify-around items-center">
                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[10px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Move</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => updateOffset('x', -5)} className="w-12 h-12 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><MoveHorizontal size={20} className="rotate-180" /></button>
                                    <button onClick={() => updateOffset('x', 5)} className="w-12 h-12 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><MoveHorizontal size={20} /></button>
                                    <button onClick={() => updateOffset('y', -5)} className="w-12 h-12 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><ArrowUpToLine size={20} /></button>
                                    <button onClick={() => updateOffset('y', 5)} className="w-12 h-12 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><ArrowDownToLine size={20} /></button>
                                </div>
                            </div>

                            {/* Rotation Controls (Not for Head/Body/Hat) */}
                            {selectedPart !== 'head' && selectedPart !== 'body' && selectedPart !== 'hat' && (
                                <>
                                    <div className="w-px h-24 bg-white/10"></div>

                                    <div className="flex flex-col gap-2 items-center">
                                        <span className="text-[10px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Rotate</span>
                                        <div className="flex gap-2 h-full items-center">
                                            <button onClick={() => updateRotation(-15)} className="w-14 h-14 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><RotateCcw size={24} /></button>
                                            <button onClick={() => updateRotation(15)} className="w-14 h-14 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center"><RotateCw size={24} /></button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Scale Controls (All Parts) */}
                            <div className="w-px h-24 bg-white/10"></div>

                            <div className="flex flex-col gap-2 items-center">
                                <span className="text-[10px] text-[#eecaa0]/60 font-bold uppercase tracking-wider">Scale</span>
                                <div className="flex gap-2 h-full items-center">
                                    <button onClick={() => updateScale(-1)} className="w-14 h-14 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center" title="Make Smaller"><ZoomOut size={24} /></button>
                                    <button onClick={() => updateScale(1)} className="w-14 h-14 bg-[#3E1F07] rounded-xl text-[#eecaa0] hover:bg-[#5c2e0b] active:scale-95 border-b-4 border-[#2a1505] active:border-b-0 active:translate-y-1 flex items-center justify-center" title="Make Bigger"><ZoomIn size={24} /></button>
                                </div>
                                {/* Display current scale percentage */}
                                <span className="text-[10px] text-[#eecaa0] font-bold mt-1">
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
