
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/authService';
import { profileService, CloudProfile } from '../services/profileService';
// Removed import of KidProfile due to missing export in ../types

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'avatar' | 'frame' | 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs' | 'animation' | 'voice' | 'background';
  value: string; // URL for avatar, Color Class/Hex for frame, Asset ID for parts, Animation Class, Voice ID, or Background URL
  previewColor?: string; // For displaying frame colors in shop
  isPremium?: boolean; // Locked for non-subscribers
}

export interface SavedCharacter {
  id: string;
  name: string;
  avatar: string;
  hat: string | null;
  body: string | null;
  leftArm: string | null;
  rightArm: string | null;
  legs: string | null;
  animation: string;
  leftArmRotation: number;
  rightArmRotation: number;
  legsRotation: number;
  leftArmOffset: { x: number, y: number };
  rightArmOffset: { x: number, y: number };
  legsOffset: { x: number, y: number };
}

export interface CoinTransaction {
  id: string;
  amount: number;
  reason: string;
  source: 'quiz' | 'lesson' | 'game' | 'daily' | 'referral' | 'purchase' | 'other';
  timestamp: number;
}

// Generate a fun, easy-to-remember referral code
const generateReferralCode = (): string => {
  const adjectives = ['HAPPY', 'BRAVE', 'KIND', 'WISE', 'JOYFUL', 'BLESSED', 'FAITHFUL', 'LOVING'];
  const nouns = ['STAR', 'HEART', 'LION', 'ANGEL', 'LIGHT', 'HOPE', 'GRACE', 'PEACE'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
};

interface UserContextType {
  coins: number;
  addCoins: (amount: number, reason?: string, source?: CoinTransaction['source']) => void;
  spendCoins: (amount: number, reason?: string) => boolean;
  coinTransactions: CoinTransaction[];
  
  // Referral System
  referralCode: string;
  redeemedCodes: string[];
  redeemCode: (code: string) => { success: boolean; message: string };
  
  ownedItems: string[];
  
  // Unlocked Voices
  unlockedVoices: string[]; // Array of voice_id strings
  unlockVoice: (voiceId: string) => void;
  isVoiceUnlocked: (voiceId: string) => boolean;
  
  // Parent Profile
  parentName: string;
  setParentName: (name: string) => void;

  // Kids Profiles
  kids: any[]; // Fixed: Use `any[]` as fallback until KidProfile type is defined/imported
  addKid: (kid: any) => void;
  updateKid: (id: string, updates: Partial<any>) => void;
  removeKid: (id: string) => void;
  giftCoinsToKid: (kidId: string, amount: number) => { success: boolean; message: string };
  
  // Active Profile
  currentProfileId: string | null; // null = parent, otherwise kid id
  switchProfile: (profileId: string | null) => void; // null = parent, string = kid id

  // Equipment Slots (Main User)
  equippedAvatar: string; // "Head"
  equippedFrame: string;
  equippedHat: string | null;
  equippedBody: string | null;
  equippedLeftArm: string | null;
  equippedRightArm: string | null;
  equippedLegs: string | null;
  equippedAnimation: string; // New: Animation Style
  
  // Background customization
  equippedBackground: string;
  setEquippedBackground: (url: string) => void;
  
  // Rotation (Pose)
  equippedLeftArmRotation: number;
  equippedRightArmRotation: number;
  equippedLegsRotation: number;
  equippedHatRotation: number;
  setPartRotation: (part: 'leftArm' | 'rightArm' | 'legs' | 'hat', rotation: number) => void;

  // Individual Part Positioning (Offsets)
  leftArmOffset: { x: number, y: number };
  rightArmOffset: { x: number, y: number };
  legsOffset: { x: number, y: number };
  headOffset: { x: number, y: number };
  bodyOffset: { x: number, y: number };
  hatOffset: { x: number, y: number };
  setPartOffset: (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat', axis: 'x' | 'y', val: number) => void;
  
  // Individual Part Scaling
  leftArmScale: number;
  rightArmScale: number;
  legsScale: number;
  headScale: number;
  bodyScale: number;
  hatScale: number;
  setPartScale: (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat', scale: number) => void;
  
  // Legs Spread (horizontal spacing)
  legsSpread: number;
  setLegsSpread: (spread: number) => void;
  
  swapArms: () => void;

  setEquippedAvatar: (url: string) => void; // Exposed for onboarding

  purchaseItem: (item: ShopItem) => boolean;
  purchaseVoice: (item: ShopItem) => boolean;
  equipItem: (type: ShopItem['type'], value: string) => void;
  unequipItem: (type: ShopItem['type']) => void;
  isOwned: (id: string) => boolean;
  
  // Saved Characters
  savedCharacters: SavedCharacter[];
  saveCurrentCharacter: () => void;
  deleteSavedCharacter: (id: string) => void;
  equipSavedCharacter: (character: SavedCharacter) => void;
  
  isSubscribed: boolean;
  subscribe: () => void;
  setIsSubscribed: (value: boolean) => void; // Direct setter for subscription status

  resetUser: () => void; // New method to wipe data
  
  // Get parent's avatar (for profile selection page display)
  getParentAvatar: () => string;
}

const UserContext = createContext<UserContextType>({
  coins: 500,
  addCoins: () => {},
  spendCoins: () => false,
  coinTransactions: [],
  referralCode: '',
  redeemedCodes: [],
  redeemCode: () => ({ success: false, message: '' }),
  ownedItems: [],
  unlockedVoices: [],
  unlockVoice: () => {},
  isVoiceUnlocked: () => false,
  parentName: 'Parent',
  setParentName: () => {},
  kids: [],
  addKid: () => {},
  updateKid: () => {},
  removeKid: () => {},
  giftCoinsToKid: () => ({ success: false, message: '' }),
  equippedAvatar: '',
  equippedFrame: '',
  equippedHat: null,
  equippedBody: null,
  equippedLeftArm: null,
  equippedRightArm: null,
  equippedLegs: null,
  equippedAnimation: 'anim-breathe',
  equippedBackground: '/assets/images/panorama-background.webp',
  setEquippedBackground: () => {},
  equippedLeftArmRotation: 0,
  equippedRightArmRotation: 0,
  equippedLegsRotation: 0,
  equippedHatRotation: 0,
  setPartRotation: () => {},
  leftArmOffset: { x: 0, y: 0 },
  rightArmOffset: { x: 0, y: 0 },
  legsOffset: { x: 0, y: 0 },
  headOffset: { x: 0, y: 0 },
  bodyOffset: { x: 0, y: 0 },
  hatOffset: { x: 0, y: 0 },
  setPartOffset: () => {},
  leftArmScale: 1,
  rightArmScale: 1,
  legsScale: 1,
  headScale: 1,
  bodyScale: 1,
  hatScale: 1,
  setPartScale: () => {},
  legsSpread: 1,
  setLegsSpread: () => {},
  swapArms: () => {},
  setEquippedAvatar: () => {},
  purchaseItem: () => false,
  purchaseVoice: () => false,
  equipItem: () => {},
  unequipItem: () => {},
  isOwned: () => false,
  savedCharacters: [],
  saveCurrentCharacter: () => {},
  deleteSavedCharacter: () => {},
  equipSavedCharacter: () => {},
  isSubscribed: false,
  subscribe: () => {},
  setIsSubscribed: () => {},
  resetUser: () => {},
  getParentAvatar: () => '/avatars/heads/head-1.png',
});

export const useUser = () => useContext(UserContext);

const STORAGE_KEY = 'godly_kids_data_v6'; // Version bump for saves
const FREE_KID_LIMIT = 1; // Free users can only have 1 kid profile
const DEFAULT_OWNED_ITEMS = ['f1', 'anim1', 'bg1'];

/** Merge sparse cloud kid rows into local profiles without wiping shop/avatar progress. */
const mergeCloudKids = (
  localKids: Array<{ id: string; name: string; [key: string]: unknown }>,
  cloudKids: CloudProfile['kids']
) => {
  if (!cloudKids?.length) return localKids;
  if (!localKids.length) return cloudKids as typeof localKids;

  const merged = localKids.map((localKid) => {
    const cloudKid = cloudKids.find(
      (ck) => ck.id === localKid.id || (ck.name && ck.name === localKid.name)
    );
    if (!cloudKid) return localKid;
    return { ...cloudKid, ...localKid, name: cloudKid.name ?? localKid.name, age: cloudKid.age ?? localKid.age };
  });

  for (const cloudKid of cloudKids) {
    const exists = merged.some(
      (lk) => lk.id === cloudKid.id || (cloudKid.name && lk.name === cloudKid.name)
    );
    if (!exists) merged.push(cloudKid as (typeof localKids)[number]);
  }

  return merged;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // --- INITIALIZATION FROM LOCAL STORAGE ---
  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log('📦 UserContext loading saved state:', saved ? 'Found data' : 'No data');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📦 Loaded user data:', {
          parentName: parsed.parentName,
          kidsCount: parsed.kids?.length || 0,
          kidNames: parsed.kids?.map((k: any) => k.name) || [],
          coins: parsed.coins
        });
        return parsed;
      }
      return null;
    } catch (e) {
      console.error("Failed to load user data", e);
      return null;
    }
  };

  const saved = loadState();

  const [coins, setCoins] = useState(saved?.coins ?? 500); // Default 500 coins for new users
  const [coinTransactions, setCoinTransactions] = useState<CoinTransaction[]>(saved?.coinTransactions ?? []);
  const [referralCode] = useState<string>(saved?.referralCode ?? generateReferralCode());
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>(saved?.redeemedCodes ?? []);
  const [ownedItems, setOwnedItems] = useState<string[]>(saved?.ownedItems ?? ['f1', 'anim1', 'bg1']); // anim1 is default breathe, bg1 is default background
  const [unlockedVoices, setUnlockedVoices] = useState<string[]>(saved?.unlockedVoices ?? []); // Voices unlocked by user
  
  // Profile Data

  type KidProfile = {
    id: string;
    name: string;
    age?: number;
    avatarSeed?: string; // Initial head selection
    
    // Per-profile economy data
    coins?: number;
    coinTransactions?: CoinTransaction[];
    ownedItems?: string[];
    unlockedVoices?: string[];
    redeemedCodes?: string[];
    
    // Full avatar configuration
    avatar?: string;
    frame?: string;
    hat?: string | null;
    body?: string | null;
    leftArm?: string | null;
    rightArm?: string | null;
    legs?: string | null;
    animation?: string;
    leftArmRotation?: number;
    rightArmRotation?: number;
    legsRotation?: number;
    leftArmOffset?: { x: number, y: number };
    rightArmOffset?: { x: number, y: number };
    legsOffset?: { x: number, y: number };
    headOffset?: { x: number, y: number };
    bodyOffset?: { x: number, y: number };
    hatOffset?: { x: number, y: number };
    leftArmScale?: number;
    rightArmScale?: number;
    legsScale?: number;
    headScale?: number;
    bodyScale?: number;
    hatScale?: number;
    
    // Character avatar for personalized stories
    characterAvatar?: string;    // URL to AI-generated character image
    characterStyle?: string;     // Style used (minecraft, lego, cartoon, etc.)
    originalSelfie?: string;     // Base64 of original selfie for regeneration
    
    // Narrator preferences for story reading
    preferredNarratorId?: string;    // ElevenLabs voice ID
    preferredNarratorName?: string;  // Display name of the narrator
    
    // Character poses for illustrated stories (10 pre-generated poses per style)
    // Grouped by styleId so we can save poses for multiple styles
    characterPoses?: {
      [styleId: string]: {
        [poseId: string]: {
          url: string;
          name: string;
          description: string;
        };
      };
    };
    posesStyleId?: string;           // Current active style for poses
    posesGeneratedAt?: number;       // Timestamp when poses were generated
    
    // Character creation limits (for trial vs subscribed users)
    characterPreviewCount?: number;  // Number of style previews used
    characterCommitCount?: number;   // Number of times committed to a style
  };

  const [parentName, setParentName] = useState<string>(saved?.parentName ?? 'Parent');
  const [kids, setKids] = useState<KidProfile[]>(saved?.kids ?? []);
  // Default to first child profile if kids exist and no profile was previously selected
  // This ensures the app defaults to child account after onboarding
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(() => {
    if (saved?.currentProfileId !== undefined) {
      return saved.currentProfileId; // Respect saved preference
    }
    // If kids exist but no profile was selected, default to first kid
    if (saved?.kids && saved.kids.length > 0) {
      console.log('👶 Defaulting to first child profile:', saved.kids[0].name);
      return saved.kids[0].id;
    }
    return null; // No kids, default to parent
  });

  // Default Equipment - Start with new PNG head
  // Migration: If user has old default 'head-toast', update to new PNG head
  const getInitialAvatar = () => {
    const savedAvatar = saved?.equippedAvatar;
    if (!savedAvatar || savedAvatar === 'head-toast') {
      return '/avatars/heads/head-1.png';
    }
    return savedAvatar;
  };
  const [equippedAvatar, setEquippedAvatar] = useState<string>(getInitialAvatar());
  const [equippedFrame, setEquippedFrame] = useState<string>(saved?.equippedFrame ?? 'border-[#8B4513]');
  const [equippedHat, setEquippedHat] = useState<string | null>(saved?.equippedHat ?? null);
  const [equippedBody, setEquippedBody] = useState<string | null>(saved?.equippedBody ?? null);
  const [equippedLeftArm, setEquippedLeftArm] = useState<string | null>(saved?.equippedLeftArm ?? null);
  const [equippedRightArm, setEquippedRightArm] = useState<string | null>(saved?.equippedRightArm ?? null);
  const [equippedLegs, setEquippedLegs] = useState<string | null>(saved?.equippedLegs ?? null);
  const [equippedAnimation, setEquippedAnimation] = useState<string>(saved?.equippedAnimation ?? 'anim-breathe');
  
  // Ship, Wheel, Pet equipment (for cloud sync)
  const [equippedShip, setEquippedShip] = useState<string | null>(saved?.equippedShip ?? null);
  const [equippedWheel, setEquippedWheel] = useState<string | null>(saved?.equippedWheel ?? null);
  const [equippedPet, setEquippedPet] = useState<string | null>(saved?.equippedPet ?? null);
  
  const defaultBg = '/assets/images/panorama-background.webp';
  const rawBg = saved?.equippedBackground ?? defaultBg;
  const [equippedBackground, setEquippedBackground] = useState<string>(
    rawBg === '/assets/images/panorama-background.jpg' || rawBg === '/assets/images/panorama-background.png' ? defaultBg : rawBg
  );
  
  // Rotation State (Defaults to 0)
  const [equippedLeftArmRotation, setEquippedLeftArmRotation] = useState<number>(saved?.equippedLeftArmRotation ?? 0);
  const [equippedRightArmRotation, setEquippedRightArmRotation] = useState<number>(saved?.equippedRightArmRotation ?? 0);
  const [equippedLegsRotation, setEquippedLegsRotation] = useState<number>(saved?.equippedLegsRotation ?? 0);
  const [equippedHatRotation, setEquippedHatRotation] = useState<number>(saved?.equippedHatRotation ?? 0);

  // Individual Offsets
  const [leftArmOffset, setLeftArmOffset] = useState<{x: number, y: number}>(saved?.leftArmOffset ?? { x: 0, y: 0 });
  const [rightArmOffset, setRightArmOffset] = useState<{x: number, y: number}>(saved?.rightArmOffset ?? { x: 0, y: 0 });
  const [legsOffset, setLegsOffset] = useState<{x: number, y: number}>(saved?.legsOffset ?? { x: 0, y: 0 });
  const [headOffset, setHeadOffset] = useState<{x: number, y: number}>(saved?.headOffset ?? { x: 0, y: 0 });
  const [bodyOffset, setBodyOffset] = useState<{x: number, y: number}>(saved?.bodyOffset ?? { x: 0, y: 0 });
  const [hatOffset, setHatOffset] = useState<{x: number, y: number}>(saved?.hatOffset ?? { x: 0, y: 0 });

  // Individual Part Scaling (default to 1.0 = 100%)
  const [leftArmScale, setLeftArmScale] = useState<number>(saved?.leftArmScale ?? 1);
  const [rightArmScale, setRightArmScale] = useState<number>(saved?.rightArmScale ?? 1);
  const [legsScale, setLegsScale] = useState<number>(saved?.legsScale ?? 1);
  const [headScale, setHeadScale] = useState<number>(saved?.headScale ?? 1);
  const [bodyScale, setBodyScale] = useState<number>(saved?.bodyScale ?? 1);
  const [hatScale, setHatScale] = useState<number>(saved?.hatScale ?? 1);
  
  // Legs Spread (horizontal spacing, 1.0 = normal, >1 = wider, <1 = narrower)
  const [legsSpread, setLegsSpread] = useState<number>(saved?.legsSpread ?? 1);

  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>(saved?.savedCharacters ?? []);

  // IMPORTANT: Read subscription status from godlykids_premium which is set by RevenueCat
  // This is the SOURCE OF TRUTH for subscription status
  const [isSubscribed, setIsSubscribed] = useState(() => {
    const premiumFlag = localStorage.getItem('godlykids_premium');
    return premiumFlag === 'true';
  });

  // Store parent's avatar data persistently
  const [parentAvatarData, setParentAvatarData] = useState<{
    avatar: string;
    frame: string;
    hat: string | null;
    body: string | null;
    leftArm: string | null;
    rightArm: string | null;
    legs: string | null;
    animation: string;
    leftArmRotation: number;
    rightArmRotation: number;
    legsRotation: number;
    leftArmOffset: { x: number, y: number };
    rightArmOffset: { x: number, y: number };
    legsOffset: { x: number, y: number };
    headOffset: { x: number, y: number };
    bodyOffset: { x: number, y: number };
    hatOffset: { x: number, y: number };
    leftArmScale: number;
    rightArmScale: number;
    legsScale: number;
    headScale: number;
    bodyScale: number;
    hatScale: number;
  } | null>(saved?.parentAvatarData ?? null);

  // Store parent's economy data persistently
  const [parentEconomyData, setParentEconomyData] = useState<{
    coins: number;
    coinTransactions: CoinTransaction[];
    ownedItems: string[];
    unlockedVoices: string[];
    redeemedCodes: string[];
  } | null>(saved?.parentEconomyData ?? null);

  // --- SYNC FULL PROFILE FROM CLOUD ON APP LOAD AND SIGN IN ---
  // This loads profile data from backend when signing in on a new device
  // CRITICAL: When user signs in, ALWAYS load their cloud profile to prevent data loss
  const [hasLoadedFromCloud, setHasLoadedFromCloud] = useState(false);
  
  // Core function to load profile from cloud - can be called on mount OR on sign in
  const loadProfileFromCloud = useCallback(async (forceLoad: boolean = false) => {
    try {
      const user = authService.getUser();
      const userEmail = user?.email || localStorage.getItem('godlykids_user_email');
      
      // Only load from cloud if user is signed in with email
      if (!userEmail) {
        console.log('☁️ No email - anonymous user, skipping cloud sync');
        setHasLoadedFromCloud(true);
        return;
      }
      
      console.log('☁️ Loading profile from cloud for:', userEmail, forceLoad ? '(forced after sign in)' : '');
      
      // Load full profile from cloud using EMAIL (not deviceId)
      const cloudProfile = await profileService.loadFromCloud(userEmail);
      
      if (cloudProfile) {
        console.log('☁️ Cloud profile found:', {
          parentName: cloudProfile.parentName,
          kidsCount: cloudProfile.kids?.length || 0,
          coins: cloudProfile.coins,
          unlockedVoices: cloudProfile.unlockedVoices?.length || 0
        });
        
        const cloudHasData = cloudProfile.parentName || 
                            (cloudProfile.kids && cloudProfile.kids.length > 0) ||
                            cloudProfile.coins > 500;
        
        // If this is a sign-in event (forceLoad=true) or cloud has meaningful data,
        // ALWAYS prioritize cloud data over local anonymous data
        if (forceLoad || cloudHasData) {
          console.log('☁️ Loading profile from cloud (priority over local)');
          
          // Load parent name if set in cloud
          if (cloudProfile.parentName && cloudProfile.parentName !== 'Parent') {
            setParentName(cloudProfile.parentName);
          }
          
          // Merge kid profiles — cloud payloads are sparse; never wipe local shop/avatar data
          if (cloudProfile.kids && cloudProfile.kids.length > 0) {
            console.log(`☁️ Merging ${cloudProfile.kids.length} kid profile(s) from cloud`);
            setKids((prev) => mergeCloudKids(prev, cloudProfile.kids));
          }

          // Merge purchased avatar/shop items from cloud
          if (cloudProfile.unlockedAvatarItems && cloudProfile.unlockedAvatarItems.length > 0) {
            setOwnedItems((prev) => [...new Set([...prev, ...cloudProfile.unlockedAvatarItems])]);
          }
          
          // Load equipped items
          if (cloudProfile.equippedAvatar) {
            setEquippedAvatar(cloudProfile.equippedAvatar);
          }
          if (cloudProfile.equippedShip) {
            setEquippedShip(cloudProfile.equippedShip);
          }
          if (cloudProfile.equippedWheel) {
            setEquippedWheel(cloudProfile.equippedWheel);
          }
          if (cloudProfile.equippedPet) {
            setEquippedPet(cloudProfile.equippedPet);
          }
          
          // Merge unlocked voices — never replace local purchases with a stale cloud list
          if (cloudProfile.unlockedVoices && cloudProfile.unlockedVoices.length > 0) {
            console.log(`☁️ Merging ${cloudProfile.unlockedVoices.length} unlocked voice(s) from cloud`);
            setUnlockedVoices((prev) => [...new Set([...prev, ...cloudProfile.unlockedVoices])]);
          }
          
          // Load default voice if set
          if (cloudProfile.defaultVoiceId) {
            localStorage.setItem('godlykids_default_voice', cloudProfile.defaultVoiceId);
          }
          
          console.log('☁️ Profile loaded from cloud successfully!');
        }
        
        // Only overwrite local coins on forced sign-in sync (new device).
        // Passive loads must not restore a stale cloud balance after local purchases.
        if (forceLoad && cloudProfile.coins !== undefined) {
          console.log(`☁️ Applying cloud coin balance after sign-in: ${cloudProfile.coins}`);
          setCoins(cloudProfile.coins);
        }
      } else {
        console.log('☁️ No cloud profile found for this email');
        
        // If user just signed in but has no cloud profile, save their current local data
        // This handles: new user signs up, or existing user who never synced
        if (forceLoad) {
          console.log('☁️ First sign-in detected, saving current local data to cloud');
          // The regular save effect will handle this
        }
      }
      
      setHasLoadedFromCloud(true);
    } catch (error) {
      console.warn('☁️ Failed to sync profile from cloud:', error);
      setHasLoadedFromCloud(true);
    }
  }, [setParentName, setKids, setEquippedAvatar, setEquippedShip, setEquippedWheel, setEquippedPet, setUnlockedVoices, setOwnedItems, setCoins]);
  
  // Load from cloud on initial mount if already signed in
  useEffect(() => {
    const user = authService.getUser();
    if (user?.email) {
      loadProfileFromCloud(false);
    } else {
      setHasLoadedFromCloud(true);
    }
  }, []); // Run once on mount
  
  // CRITICAL: Listen for sign-in events and reload profile from cloud
  // This ensures user's cloud data is loaded even if they sign in AFTER the app loads
  useEffect(() => {
    const handleAuthChange = () => {
      const user = authService.getUser();
      if (user?.email) {
        console.log('🔐 Auth token updated - user signed in, loading cloud profile...');
        // Disable cloud saves until we've pulled the account's profile down. This
        // prevents a fresh device from pushing its empty/default local state to the
        // cloud (which would erase kids set up on another device) before sync runs.
        setHasLoadedFromCloud(false);
        // Force load from cloud to get user's saved data
        loadProfileFromCloud(true);
      }
    };
    
    window.addEventListener('authTokenUpdated', handleAuthChange);
    
    return () => {
      window.removeEventListener('authTokenUpdated', handleAuthChange);
    };
  }, [loadProfileFromCloud]);

  // --- SYNC PROFILE TO BACKEND (including kids) ---
  const syncProfileToBackend = useCallback(async (kidsToSync?: any[]) => {
    try {
      const user = authService.getUser();
      const userId = user?.email || user?._id || user?.id || localStorage.getItem('godlykids_user_email') || localStorage.getItem('device_id');
      
      if (!userId || !referralCode) {
        return; // Not ready to sync yet
      }
      
      const apiBase = window.location.hostname === 'localhost' 
        ? 'http://localhost:5001' 
        : 'https://backendgk2-0.onrender.com';
      
      // Detect platform
      const ua = navigator.userAgent.toLowerCase();
      let platform = 'web';
      if (/despia/i.test(ua)) {
        platform = ua.includes('iphone') || ua.includes('ipad') ? 'ios' : 'android';
      }
      
      const kidsData = kidsToSync || kids;
      
      await fetch(`${apiBase}/api/referrals/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          referralCode,
          kidProfiles: kidsData.map(kid => ({
            name: kid.name,
            age: kid.age,
            avatarSeed: kid.avatarSeed || kid.avatar,
          })),
          parentName,
          coins,
          platform
        })
      });
      
      console.log(`👶 Synced ${kidsData.length} kid profile(s) to backend`);
    } catch (error) {
      console.warn('Failed to sync profile to backend:', error);
    }
  }, [referralCode, kids, parentName, coins]);

  // Sync profile when kids change
  useEffect(() => {
    if (kids.length > 0 && referralCode) {
      // Debounce to avoid too many calls
      const timer = setTimeout(() => {
        syncProfileToBackend(kids);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [kids, referralCode, syncProfileToBackend]);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    // Skip persistence if we're in the middle of a reset/signout
    if (isResetting.current) {
      console.log('💾 Skipping save - isResetting is true');
      return;
    }
    
    // Skip persistence if signing out flag is set (survives page navigation)
    if (sessionStorage.getItem('godlykids_signing_out') === 'true') {
      console.log('💾 Skipping save - signing_out flag is set');
      return;
    }
    
    // Skip persistence if user data is empty/reset (parentName is '' after signout)
    // This prevents default values from being written back to localStorage
    if (parentName === '' && kids.length === 0) {
      console.log('💾 Skipping save - empty state (parentName empty AND no kids)');
      return;
    }
    
    console.log('💾 Saving user data:', { parentName, kidsCount: kids.length, kidNames: kids.map(k => k.name) });

    // Inline active profile economy + avatar into the kid row so reload never loses shop progress
    const kidsForSave =
      currentProfileId === null
        ? kids
        : kids.map((kid) =>
            kid.id === currentProfileId
              ? {
                  ...kid,
                  coins,
                  coinTransactions,
                  ownedItems,
                  unlockedVoices,
                  redeemedCodes,
                  avatar: equippedAvatar,
                  frame: equippedFrame,
                  hat: equippedHat,
                  body: equippedBody,
                  leftArm: equippedLeftArm,
                  rightArm: equippedRightArm,
                  legs: equippedLegs,
                  animation: equippedAnimation,
                  leftArmRotation: equippedLeftArmRotation,
                  rightArmRotation: equippedRightArmRotation,
                  legsRotation: equippedLegsRotation,
                  leftArmOffset,
                  rightArmOffset,
                  legsOffset,
                  headOffset,
                  bodyOffset,
                  hatOffset,
                  leftArmScale,
                  rightArmScale,
                  legsScale,
                  headScale,
                  bodyScale,
                  hatScale,
                }
              : kid
          );
    
    const stateToSave = {
      coins,
      coinTransactions,
      referralCode,
      redeemedCodes,
      ownedItems,
      unlockedVoices,
      parentName,
      kids: kidsForSave,
      currentProfileId,
      equippedAvatar,
      equippedFrame,
      equippedHat,
      equippedBody,
      equippedLeftArm,
      equippedRightArm,
      equippedLegs,
      equippedAnimation,
      equippedShip,
      equippedWheel,
      equippedPet,
      equippedBackground,
      equippedLeftArmRotation,
      equippedRightArmRotation,
      equippedLegsRotation,
      equippedHatRotation,
      leftArmOffset,
      rightArmOffset,
      legsOffset,
      headOffset,
      bodyOffset,
      hatOffset,
      leftArmScale,
      rightArmScale,
      legsScale,
      headScale,
      bodyScale,
      hatScale,
      savedCharacters,
      isSubscribed,
      parentAvatarData,
      parentEconomyData
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    
    // Also save to cloud (debounced by profileService)
    const user = authService.getUser();
    const userId = user?.email || localStorage.getItem('godlykids_user_email');
    if (userId && hasLoadedFromCloud) {
      // Save important profile data to cloud for cross-device sync
      const defaultVoice = localStorage.getItem('godlykids_default_voice');
      // SAFETY: only send kids when we actually have some. Sending an empty array
      // could wipe kids that exist in the cloud / on another device. The backend
      // also guards against this, but we avoid even attempting the overwrite.
      const cloudPayload: Parameters<typeof profileService.saveToCloud>[1] = {
        parentName,
        coins,
        equippedAvatar,
        equippedShip,
        equippedWheel,
        equippedPet,
        unlockedAvatarItems: ownedItems,
        unlockedVoices,
        defaultVoiceId: defaultVoice || null,
      };
      if (kids.length > 0) {
        cloudPayload.kids = kids.map(k => ({
          id: k.id,
          name: k.name,
          age: k.age || 0,
          avatar: k.avatar,
          avatarSeed: k.avatarSeed,
        }));
      }
      profileService.saveToCloud(userId, cloudPayload);
    }
  }, [
    coins, coinTransactions, referralCode, redeemedCodes, ownedItems, unlockedVoices, parentName, kids, currentProfileId, parentEconomyData,
      equippedAvatar, equippedFrame, equippedHat, equippedBody,
    equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation, equippedHatRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
    leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale,
    legsSpread,
    savedCharacters,
    isSubscribed,
    parentAvatarData,
    hasLoadedFromCloud,
    equippedShip,
    equippedWheel,
    equippedPet,
    equippedBackground
  ]);

  // Sync subscription status from godlykids_premium (RevenueCat source of truth)
  useEffect(() => {
    const syncSubscription = () => {
      const premiumFlag = localStorage.getItem('godlykids_premium');
      const isPremium = premiumFlag === 'true';
      if (isPremium !== isSubscribed) {
        setIsSubscribed(isPremium);
        console.log('🔄 Synced subscription status:', isPremium);
      }
    };

    // Sync on mount
    syncSubscription();

    // Listen for storage changes (from other tabs or RevenueCat updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'godlykids_premium') {
        syncSubscription();
      }
    };

    // Listen for custom events from RevenueCat service
    const handlePremiumChange = (event?: CustomEvent) => {
      console.log('🔔 Premium change event received:', event?.detail);
      // Immediately update from event if provided
      if (event?.detail?.isPremium !== undefined) {
        setIsSubscribed(event.detail.isPremium);
      } else {
        syncSubscription();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authTokenUpdated', handlePremiumChange);
    window.addEventListener('revenuecat:premiumChanged', handlePremiumChange as EventListener);
    window.addEventListener('despia:subscriptionChanged', handlePremiumChange as EventListener);
    
    // Check periodically in case localStorage changes without events
    const interval = setInterval(syncSubscription, 3000); // Check every 3 seconds

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authTokenUpdated', handlePremiumChange);
      window.removeEventListener('revenuecat:premiumChanged', handlePremiumChange as EventListener);
      window.removeEventListener('despia:subscriptionChanged', handlePremiumChange as EventListener);
      clearInterval(interval);
    };
  }, [isSubscribed]);

  const addCoins = (amount: number, reason: string = 'Coins earned', source: CoinTransaction['source'] = 'other') => {
    setCoins(prev => prev + amount);
    
    // Record transaction
    const transaction: CoinTransaction = {
      id: Date.now().toString(),
      amount,
      reason,
      source,
      timestamp: Date.now(),
    };
    setCoinTransactions(prev => [transaction, ...prev].slice(0, 100)); // Keep last 100 transactions
  };

  const spendCoins = (amount: number, reason: string = 'Purchase'): boolean => {
    if (coins < amount) return false;
    
    setCoins(prev => prev - amount);
    
    // Record transaction (negative amount)
    const transaction: CoinTransaction = {
      id: Date.now().toString(),
      amount: -amount,
      reason,
      source: 'purchase',
      timestamp: Date.now(),
    };
    setCoinTransactions(prev => [transaction, ...prev].slice(0, 100));
    return true;
  };

  const redeemCode = (code: string): { success: boolean; message: string } => {
    const normalizedCode = code.trim().toUpperCase();
    
    // Check if it's their own code
    if (normalizedCode === referralCode) {
      return { success: false, message: "You can't use your own code, silly! 😄" };
    }
    
    // Check if already redeemed
    if (redeemedCodes.includes(normalizedCode)) {
      return { success: false, message: "You've already used this code!" };
    }
    
    // For now, accept any code that matches our format (WORD+WORD+NUMBER)
    // In production, this would validate against a backend
    const codePattern = /^[A-Z]+[A-Z]+\d+$/;
    if (!codePattern.test(normalizedCode)) {
      return { success: false, message: "Hmm, that doesn't look like a valid code. Try again!" };
    }
    
    // Redeem successful!
    setRedeemedCodes(prev => [...prev, normalizedCode]);
    addCoins(250, `Referral from friend`, 'referral');
    
    return { success: true, message: "🎉 Awesome! You earned 250 gold coins!" };
  };

  const addKid = (kid: KidProfile) => {
    // Check subscription limit - free users can only have 1 kid
    if (!isSubscribed && kids.length >= FREE_KID_LIMIT) {
      console.warn('🚫 Free users limited to', FREE_KID_LIMIT, 'kid profile(s). Upgrade to premium for unlimited profiles.');
      return; // Don't add the kid
    }
    
    // Kids inherit parent's unlocked voices when created
    const kidWithInheritedVoices = {
      ...kid,
      // If kid doesn't have voices specified, inherit from parent
      unlockedVoices: kid.unlockedVoices && kid.unlockedVoices.length > 0 
        ? kid.unlockedVoices 
        : [...unlockedVoices]
    };
    setKids(prev => [...prev, kidWithInheritedVoices]);
  };

  const removeKid = (id: string) => {
    setKids(prev => prev.filter(k => k.id !== id));
    // If we're removing the currently active profile, switch back to parent
    if (currentProfileId === id) {
      setCurrentProfileId(null);
    }
  };

  const updateKid = (id: string, updates: Partial<KidProfile>) => {
    setKids(prev => prev.map(kid => 
      kid.id === id ? { ...kid, ...updates } : kid
    ));
  };

  // Gift coins from parent wallet to a kid's wallet
  const giftCoinsToKid = (kidId: string, amount: number): { success: boolean; message: string } => {
    // Validate amount
    if (amount <= 0) {
      return { success: false, message: 'Please enter a valid amount' };
    }
    
    // Check if parent has enough coins
    if (coins < amount) {
      return { success: false, message: `You don't have enough coins! You have ${coins} coins.` };
    }
    
    // Find the kid
    const kid = kids.find(k => k.id === kidId);
    if (!kid) {
      return { success: false, message: 'Kid not found' };
    }
    
    // Deduct from parent
    setCoins(prev => prev - amount);
    setCoinTransactions(prev => [{
      id: Date.now().toString(),
      amount: -amount,
      reason: `Gift to ${kid.name}`,
      source: 'other',
      timestamp: Date.now()
    }, ...prev]);
    
    // Add to kid
    setKids(prev => prev.map(k => 
      k.id === kidId 
        ? { ...k, coins: (k.coins || 0) + amount } 
        : k
    ));
    
    return { success: true, message: `🎁 Gave ${amount} coins to ${kid.name}!` };
  };

  // Helper to get current avatar state
  const getCurrentAvatarState = () => ({
    avatar: equippedAvatar,
    frame: equippedFrame,
    hat: equippedHat,
    body: equippedBody,
    leftArm: equippedLeftArm,
    rightArm: equippedRightArm,
    legs: equippedLegs,
    animation: equippedAnimation,
    leftArmRotation: equippedLeftArmRotation,
    rightArmRotation: equippedRightArmRotation,
    legsRotation: equippedLegsRotation,
    leftArmOffset: { ...leftArmOffset },
    rightArmOffset: { ...rightArmOffset },
    legsOffset: { ...legsOffset },
    headOffset: { ...headOffset },
    bodyOffset: { ...bodyOffset },
    hatOffset: { ...hatOffset },
    leftArmScale,
    rightArmScale,
    legsScale,
    headScale,
    bodyScale,
    hatScale
  });

  // Helper to apply avatar state
  const applyAvatarState = (state: {
    avatar: string;
    frame: string;
    hat: string | null;
    body: string | null;
    leftArm: string | null;
    rightArm: string | null;
    legs: string | null;
    animation: string;
    leftArmRotation: number;
    rightArmRotation: number;
    legsRotation: number;
    leftArmOffset: { x: number, y: number };
    rightArmOffset: { x: number, y: number };
    legsOffset: { x: number, y: number };
    headOffset: { x: number, y: number };
    bodyOffset: { x: number, y: number };
    hatOffset: { x: number, y: number };
    leftArmScale: number;
    rightArmScale: number;
    legsScale: number;
    headScale: number;
    bodyScale: number;
    hatScale: number;
  }) => {
    setEquippedAvatar(state.avatar);
    setEquippedFrame(state.frame);
    setEquippedHat(state.hat);
    setEquippedBody(state.body);
    setEquippedLeftArm(state.leftArm);
    setEquippedRightArm(state.rightArm);
    setEquippedLegs(state.legs);
    setEquippedAnimation(state.animation);
    setEquippedLeftArmRotation(state.leftArmRotation);
    setEquippedRightArmRotation(state.rightArmRotation);
    setEquippedLegsRotation(state.legsRotation);
    setLeftArmOffset(state.leftArmOffset);
    setRightArmOffset(state.rightArmOffset);
    setLegsOffset(state.legsOffset);
    setHeadOffset(state.headOffset);
    setBodyOffset(state.bodyOffset);
    setHatOffset(state.hatOffset);
    setLeftArmScale(state.leftArmScale);
    setRightArmScale(state.rightArmScale);
    setLegsScale(state.legsScale);
    setHeadScale(state.headScale);
    setBodyScale(state.bodyScale);
    setHatScale(state.hatScale);
  };

  // Helper to get current economy state
  const getCurrentEconomyState = () => ({
    coins,
    coinTransactions: [...coinTransactions],
    ownedItems: [...ownedItems],
    unlockedVoices: [...unlockedVoices],
    redeemedCodes: [...redeemedCodes],
  });

  // Helper to apply economy state
  const applyEconomyState = (state: {
    coins: number;
    coinTransactions: CoinTransaction[];
    ownedItems: string[];
    unlockedVoices: string[];
    redeemedCodes: string[];
  }) => {
    setCoins(state.coins);
    setCoinTransactions(state.coinTransactions);
    setOwnedItems(state.ownedItems);
    setUnlockedVoices(state.unlockedVoices);
    setRedeemedCodes(state.redeemedCodes);
  };

  // Helper to save current profile's economy data
  const saveCurrentProfileEconomy = useCallback(() => {
    const currentState = getCurrentEconomyState();
    
    if (currentProfileId === null) {
      // Currently on parent - save parent's economy
      setParentEconomyData(currentState);
    } else {
      // Currently on a kid - save kid's economy to their profile
      setKids(prev => prev.map(kid => 
        kid.id === currentProfileId 
          ? { ...kid, ...currentState }
          : kid
      ));
    }
  }, [currentProfileId, coins, coinTransactions, ownedItems, unlockedVoices, redeemedCodes]);

  // Helper to save current avatar state to active profile
  const saveCurrentProfileAvatar = useCallback(() => {
    const currentState = getCurrentAvatarState();
    
    if (currentProfileId === null) {
      // Currently on parent - always save parent's state
      setParentAvatarData(currentState);
    } else {
      // Currently on a kid - save kid's state to their profile
      setKids(prev => prev.map(kid => 
        kid.id === currentProfileId 
          ? { ...kid, ...currentState }
          : kid
      ));
    }
  }, [currentProfileId, equippedAvatar, equippedFrame, equippedHat, equippedBody, 
      equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
      equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation, equippedHatRotation,
      leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
      leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale, legsSpread]);

  // Track if this is the initial mount to avoid unnecessary saves
  const isInitialMount = useRef(true);
  const isInitialEconomyMount = useRef(true);
  const hasHydratedActiveProfile = useRef(false);
  
  // Flag to prevent persistence effect from writing after signout/reset
  const isResetting = useRef(false);

  // On first load, hydrate wallet + avatar from the active kid profile (not stale root defaults)
  useEffect(() => {
    if (hasHydratedActiveProfile.current) return;
    hasHydratedActiveProfile.current = true;

    if (currentProfileId === null) {
      if (parentEconomyData) applyEconomyState(parentEconomyData);
      if (parentAvatarData) applyAvatarState(parentAvatarData);
      return;
    }

    const kid = kids.find((k) => k.id === currentProfileId);
    if (!kid) return;

    applyEconomyState({
      coins: Math.min(kid.coins ?? coins, coins),
      coinTransactions: kid.coinTransactions?.length ? kid.coinTransactions : coinTransactions,
      ownedItems: [...new Set([...(kid.ownedItems ?? DEFAULT_OWNED_ITEMS), ...ownedItems])],
      unlockedVoices: [...new Set([...(kid.unlockedVoices ?? []), ...unlockedVoices])],
      redeemedCodes: [...new Set([...(kid.redeemedCodes ?? []), ...redeemedCodes])],
    });

    if (kid.avatar !== undefined) {
      applyAvatarState({
        avatar: kid.avatar || kid.avatarSeed || equippedAvatar || '/avatars/heads/head-1.png',
        frame: kid.frame || equippedFrame || 'border-[#8B4513]',
        hat: kid.hat ?? equippedHat ?? null,
        body: kid.body ?? equippedBody ?? null,
        leftArm: kid.leftArm ?? equippedLeftArm ?? null,
        rightArm: kid.rightArm ?? equippedRightArm ?? null,
        legs: kid.legs ?? equippedLegs ?? null,
        animation: kid.animation || equippedAnimation || 'anim-breathe',
        leftArmRotation: kid.leftArmRotation ?? equippedLeftArmRotation ?? 0,
        rightArmRotation: kid.rightArmRotation ?? equippedRightArmRotation ?? 0,
        legsRotation: kid.legsRotation ?? equippedLegsRotation ?? 0,
        leftArmOffset: kid.leftArmOffset ?? leftArmOffset ?? { x: 0, y: 0 },
        rightArmOffset: kid.rightArmOffset ?? rightArmOffset ?? { x: 0, y: 0 },
        legsOffset: kid.legsOffset ?? legsOffset ?? { x: 0, y: 0 },
        headOffset: kid.headOffset ?? headOffset ?? { x: 0, y: 0 },
        bodyOffset: kid.bodyOffset ?? bodyOffset ?? { x: 0, y: 0 },
        hatOffset: kid.hatOffset ?? hatOffset ?? { x: 0, y: 0 },
        leftArmScale: kid.leftArmScale ?? leftArmScale ?? 1,
        rightArmScale: kid.rightArmScale ?? rightArmScale ?? 1,
        legsScale: kid.legsScale ?? legsScale ?? 1,
        headScale: kid.headScale ?? headScale ?? 1,
        bodyScale: kid.bodyScale ?? bodyScale ?? 1,
        hatScale: kid.hatScale ?? hatScale ?? 1,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save avatar changes to current profile (with debounce to avoid excessive saves)
  useEffect(() => {
    // Skip the very first render to avoid saving default values
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Debounce the save to avoid excessive updates during rapid changes
    const timeoutId = setTimeout(() => {
      saveCurrentProfileAvatar();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [
    equippedAvatar, equippedFrame, equippedHat, equippedBody,
    equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation, equippedHatRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
    leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale, legsSpread,
    currentProfileId,
    saveCurrentProfileAvatar
  ]);

  // Auto-save economy (coins, purchases, voices) to the active profile
  useEffect(() => {
    if (isInitialEconomyMount.current) {
      isInitialEconomyMount.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      saveCurrentProfileEconomy();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    coins,
    coinTransactions,
    ownedItems,
    unlockedVoices,
    redeemedCodes,
    currentProfileId,
    saveCurrentProfileEconomy,
  ]);

  const switchProfile = (profileId: string | null) => {
    // Save current profile's data before switching
    saveCurrentProfileAvatar();
    saveCurrentProfileEconomy();

    setCurrentProfileId(profileId);

    if (profileId === null) {
      // Switching to parent - restore parent's data
      if (parentAvatarData) {
        applyAvatarState(parentAvatarData);
      }
      if (parentEconomyData) {
        applyEconomyState(parentEconomyData);
      }
    } else {
      // Switching to a kid profile - restore kid's saved data or use defaults
      const kid = kids.find(k => k.id === profileId);
      if (kid) {
        // Restore kid's economy data (or defaults for new profiles)
        applyEconomyState({
          coins: kid.coins ?? 500, // New kids start with 500 coins
          coinTransactions: kid.coinTransactions ?? [],
          ownedItems: kid.ownedItems ?? ['f1', 'anim1', 'bg1'],
          unlockedVoices: kid.unlockedVoices ?? [],
          redeemedCodes: kid.redeemedCodes ?? [],
        });

        // If kid has saved avatar data, use it; otherwise use defaults with their avatarSeed
        if (kid.avatar !== undefined) {
          // Kid has saved avatar configuration
          applyAvatarState({
            avatar: kid.avatar || kid.avatarSeed || '/avatars/heads/head-1.png',
            frame: kid.frame || 'border-[#8B4513]',
            hat: kid.hat ?? null,
            body: kid.body ?? null,
            leftArm: kid.leftArm ?? null,
            rightArm: kid.rightArm ?? null,
            legs: kid.legs ?? null,
            animation: kid.animation || 'anim-breathe',
            leftArmRotation: kid.leftArmRotation ?? 0,
            rightArmRotation: kid.rightArmRotation ?? 0,
            legsRotation: kid.legsRotation ?? 0,
            leftArmOffset: kid.leftArmOffset ?? { x: 0, y: 0 },
            rightArmOffset: kid.rightArmOffset ?? { x: 0, y: 0 },
            legsOffset: kid.legsOffset ?? { x: 0, y: 0 },
            headOffset: kid.headOffset ?? { x: 0, y: 0 },
            bodyOffset: kid.bodyOffset ?? { x: 0, y: 0 },
            hatOffset: kid.hatOffset ?? { x: 0, y: 0 },
            leftArmScale: kid.leftArmScale ?? 1,
            rightArmScale: kid.rightArmScale ?? 1,
            legsScale: kid.legsScale ?? 1,
            headScale: kid.headScale ?? 1,
            bodyScale: kid.bodyScale ?? 1,
            hatScale: kid.hatScale ?? 1
          });
        } else {
          // First time switching to this kid - use defaults with their avatarSeed
          const defaultState = {
            avatar: kid.avatarSeed || '/avatars/heads/head-1.png',
            frame: 'border-[#8B4513]',
            hat: null,
            body: null,
            leftArm: null,
            rightArm: null,
            legs: null,
            animation: 'anim-breathe',
            leftArmRotation: 0,
            rightArmRotation: 0,
            legsRotation: 0,
            leftArmOffset: { x: 0, y: 0 },
            rightArmOffset: { x: 0, y: 0 },
            legsOffset: { x: 0, y: 0 },
            headOffset: { x: 0, y: 0 },
            bodyOffset: { x: 0, y: 0 },
            hatOffset: { x: 0, y: 0 },
            leftArmScale: 1,
            rightArmScale: 1,
            legsScale: 1,
            headScale: 1,
            bodyScale: 1,
            hatScale: 1
          };
          applyAvatarState(defaultState);
          // Save this default state to the kid's profile
          setKids(prev => prev.map(k => 
            k.id === profileId 
              ? { ...k, ...defaultState }
              : k
          ));
        }
      }
    }
    
    // Dispatch event so services can update their storage keys
    window.dispatchEvent(new CustomEvent('profileSwitched', { detail: { profileId } }));
  };

  const isOwned = (id: string) => {
    return ownedItems.includes(id);
  };

  // Voice unlock functions
  const unlockVoice = (voiceId: string) => {
    if (!unlockedVoices.includes(voiceId)) {
      setUnlockedVoices(prev => [...prev, voiceId]);
      console.log(`🎤 Voice unlocked: ${voiceId}`);
    }
  };

  const isVoiceUnlocked = (voiceId: string): boolean => {
    // Check if voice is in the user's purchased/unlocked list
    // Premium users do NOT automatically get all voices - they still need to purchase them
    // Premium just allows them to purchase the 70% of voices that are "premium only"
    
    // Also check if this is the user's saved default voice (selected during onboarding)
    const savedDefaultVoice = localStorage.getItem('godlykids_default_voice');
    if (savedDefaultVoice === voiceId) {
      return true;
    }

    if (ownedItems.includes(`voice-${voiceId}`)) {
      return true;
    }
    
    return unlockedVoices.includes(voiceId);
  };

  const purchaseItem = (item: ShopItem): boolean => {
    if (ownedItems.includes(item.id)) return true;
    if (coins >= item.price) {
      setCoins(prev => prev - item.price);
      setOwnedItems(prev => [...prev, item.id]);
      setCoinTransactions(prev => [{
        id: Date.now().toString(),
        amount: -item.price,
        reason: `Purchased ${item.name}`,
        source: 'purchase',
        timestamp: Date.now(),
      }, ...prev].slice(0, 100));
      return true;
    }
    return false;
  };

  /** Spend coins, mark owned, and unlock a narrator voice in one update. */
  const purchaseVoice = (item: ShopItem): boolean => {
    if (item.type !== 'voice') return false;
    if (isVoiceUnlocked(item.value)) return true;
    if (coins < item.price) return false;

    setCoins(prev => prev - item.price);
    setOwnedItems(prev => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setUnlockedVoices(prev => (prev.includes(item.value) ? prev : [...prev, item.value]));
    setCoinTransactions(prev => [{
      id: Date.now().toString(),
      amount: -item.price,
      reason: `Purchased voice: ${item.name}`,
      source: 'purchase',
      timestamp: Date.now(),
    }, ...prev].slice(0, 100));
    console.log(`🎤 Voice purchased: ${item.name} (${item.value})`);
    return true;
  };

  const equipItem = (type: ShopItem['type'], value: string) => {
    switch (type) {
      case 'avatar': setEquippedAvatar(value); break;
      case 'frame': setEquippedFrame(value); break;
      case 'hat': setEquippedHat(value); break;
      case 'body': setEquippedBody(value); break;
      case 'leftArm': setEquippedLeftArm(value); setLeftArmScale(2); break;
      case 'rightArm': setEquippedRightArm(value); setRightArmScale(2); break;
      case 'legs': setEquippedLegs(value); break;
      case 'animation': setEquippedAnimation(value); break;
      case 'background': setEquippedBackground(value); break;
    }
  };

  const unequipItem = (type: ShopItem['type']) => {
    switch (type) {
      case 'hat': setEquippedHat(null); break;
      case 'body': setEquippedBody(null); break;
      case 'leftArm': setEquippedLeftArm(null); break;
      case 'rightArm': setEquippedRightArm(null); break;
      case 'legs': setEquippedLegs(null); break;
      // Animation cannot be unequipped, only swapped
    }
  };

  const setPartRotation = (part: 'leftArm' | 'rightArm' | 'legs' | 'hat', rotation: number) => {
    if (part === 'leftArm') setEquippedLeftArmRotation(rotation);
    else if (part === 'rightArm') setEquippedRightArmRotation(rotation);
    else if (part === 'legs') setEquippedLegsRotation(rotation);
    else if (part === 'hat') setEquippedHatRotation(rotation);
  };

  const setPartOffset = (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat', axis: 'x' | 'y', val: number) => {
    if (part === 'leftArm') {
       setLeftArmOffset(prev => ({ ...prev, [axis]: val }));
    } else if (part === 'rightArm') {
       setRightArmOffset(prev => ({ ...prev, [axis]: val }));
    } else if (part === 'legs') {
       setLegsOffset(prev => ({ ...prev, [axis]: val }));
    } else if (part === 'head') {
       setHeadOffset(prev => ({ ...prev, [axis]: val }));
    } else if (part === 'body') {
       setBodyOffset(prev => ({ ...prev, [axis]: val }));
    } else if (part === 'hat') {
       setHatOffset(prev => ({ ...prev, [axis]: val }));
    }
  };

  const setPartScale = (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body' | 'hat', scale: number) => {
    // Only enforce minimum scale (0.1 = 10%), no upper limit
    const clampedScale = Math.max(0.1, scale);
    if (part === 'leftArm') {
       setLeftArmScale(clampedScale);
    } else if (part === 'rightArm') {
       setRightArmScale(clampedScale);
    } else if (part === 'legs') {
       setLegsScale(clampedScale);
    } else if (part === 'head') {
       setHeadScale(clampedScale);
    } else if (part === 'body') {
       setBodyScale(clampedScale);
    } else if (part === 'hat') {
       setHatScale(clampedScale);
    }
  };

  const swapArms = () => {
    // Swap assets
    const tempLeft = equippedLeftArm;
    setEquippedLeftArm(equippedRightArm);
    setEquippedRightArm(tempLeft);
    
    // Swap rotations
    const tempRot = equippedLeftArmRotation;
    setEquippedLeftArmRotation(equippedRightArmRotation);
    setEquippedRightArmRotation(tempRot);

    // Swap offsets
    const tempOffset = leftArmOffset;
    setLeftArmOffset(rightArmOffset);
    setRightArmOffset(tempOffset);
  };

  // --- SAVED CHARACTERS ---
  const saveCurrentCharacter = () => {
    const newCharacter: SavedCharacter = {
      id: Date.now().toString(),
      name: `Outfit ${savedCharacters.length + 1}`,
      avatar: equippedAvatar,
      hat: equippedHat,
      body: equippedBody,
      leftArm: equippedLeftArm,
      rightArm: equippedRightArm,
      legs: equippedLegs,
      animation: equippedAnimation,
      leftArmRotation: equippedLeftArmRotation,
      rightArmRotation: equippedRightArmRotation,
      legsRotation: equippedLegsRotation,
      leftArmOffset: { ...leftArmOffset },
      rightArmOffset: { ...rightArmOffset },
      legsOffset: { ...legsOffset }
    };
    setSavedCharacters(prev => [...prev, newCharacter]);
  };

  const deleteSavedCharacter = (id: string) => {
    setSavedCharacters(prev => prev.filter(c => c.id !== id));
  };

  const equipSavedCharacter = (character: SavedCharacter) => {
    setEquippedAvatar(character.avatar);
    setEquippedHat(character.hat);
    setEquippedBody(character.body);
    setEquippedLeftArm(character.leftArm);
    setEquippedRightArm(character.rightArm);
    setEquippedLegs(character.legs);
    setEquippedAnimation(character.animation);
    setEquippedLeftArmRotation(character.leftArmRotation);
    setEquippedRightArmRotation(character.rightArmRotation);
    setEquippedLegsRotation(character.legsRotation);
    setLeftArmOffset(character.leftArmOffset);
    setRightArmOffset(character.rightArmOffset);
    setLegsOffset(character.legsOffset);
  };

  const subscribe = () => {
    // Update both localStorage (source of truth) and React state
    localStorage.setItem('godlykids_premium', 'true');
    setIsSubscribed(true);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('revenuecat:premiumChanged', { detail: { isPremium: true } }));
    console.log('✅ Subscribe: Set premium to true in localStorage and state');
  };

  // Get parent's avatar regardless of which profile is active
  const getParentAvatar = useCallback(() => {
    if (currentProfileId === null) {
      // Currently on parent, use current equipped avatar
      return equippedAvatar;
    } else {
      // Currently on a kid, use saved parent avatar data
      return parentAvatarData?.avatar || '/avatars/heads/head-1.png';
    }
  }, [currentProfileId, equippedAvatar, parentAvatarData]);

  const resetUser = () => {
    // Set flag to prevent persistence effect from writing during reset
    isResetting.current = true;
    
    // Also set a session flag that survives until tab/app is closed
    // This prevents re-initialization from writing default data back
    sessionStorage.setItem('godlykids_signing_out', 'true');
    
    // CRITICAL: Clear storage FIRST before any state changes
    // This prevents any race conditions with persistence effects
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('godlykids_lesson_completions');
    localStorage.removeItem('godlykids_lesson_streak');
    localStorage.removeItem('godlykids_last_week_start');
    localStorage.removeItem('godlykids_read_counts');
    localStorage.removeItem('godlykids_completed_books');
    localStorage.removeItem('godlykids_reading_progress');
    localStorage.removeItem('godlykids_favorites');
    localStorage.removeItem('godlykids_library');
    localStorage.removeItem('godlykids_play_counts');
    localStorage.removeItem('godlykids_default_voice');
    localStorage.removeItem('godlykids_welcome_seen');
    // Clear Despia route restoration (prevents redirect to home on fresh start)
    localStorage.removeItem('gk_last_route');
    localStorage.removeItem('gk_last_hidden_ts');
    
    // Reset all in-memory state to defaults
    setCoins(500); // New users start with 500 gold coins
    setCoinTransactions([]);
    setRedeemedCodes([]);
    setOwnedItems(['f1', 'anim1', 'bg1']);
    setUnlockedVoices([]);
    setParentName(''); // Empty string signals no user data
    setKids([]);
    setCurrentProfileId(null); // Reset to parent profile
    setParentAvatarData(null); // Clear parent avatar cache
    setParentEconomyData(null); // Clear parent economy cache
    setEquippedAvatar('/avatars/heads/head-1.png');
    setEquippedFrame('border-[#8B4513]');
    setEquippedHat(null);
    setEquippedBody(null);
    setEquippedLeftArm(null);
    setEquippedRightArm(null);
    setEquippedLegs(null);
    setEquippedAnimation('anim-breathe');
    setEquippedLeftArmRotation(0);
    setEquippedRightArmRotation(0);
    setEquippedLegsRotation(0);
    setLeftArmOffset({ x: 0, y: 0 });
    setRightArmOffset({ x: 0, y: 0 });
    setLegsOffset({ x: 0, y: 0 });
    setHeadOffset({ x: 0, y: 0 });
    setBodyOffset({ x: 0, y: 0 });
    setHatOffset({ x: 0, y: 0 });
    setLeftArmScale(1);
    setRightArmScale(1);
    setLegsScale(1);
    setHeadScale(1);
    setBodyScale(1);
    setHatScale(1);
    setSavedCharacters([]);
    setIsSubscribed(false);
    
    // Additional cleanup (game engagement and cooldowns)
    // Note: Main storage and progress data already cleared at start of function
    localStorage.removeItem('memory_game_engaged');
    localStorage.removeItem('daily_key_engaged');
    localStorage.removeItem('strength_game_engaged');
    localStorage.removeItem('prayer_game_engaged');
    localStorage.removeItem('daily_verse_last_completion');
    localStorage.removeItem('challenge_game_last_completion');
    localStorage.removeItem('strength_game_last_completion');
    localStorage.removeItem('prayer_game_last_completion');
    
    console.log('🚪 User data reset complete');
  };

  return (
    <UserContext.Provider value={{
      coins,
      addCoins,
      spendCoins,
      coinTransactions,
      referralCode,
      redeemedCodes,
      redeemCode,
      ownedItems,
      unlockedVoices,
      unlockVoice,
      isVoiceUnlocked,
      parentName,
      setParentName,
      kids,
      addKid,
      updateKid,
      removeKid,
      giftCoinsToKid,
      equippedAvatar,
      equippedFrame,
      equippedHat,
      equippedBody,
      equippedLeftArm,
      equippedRightArm,
      equippedLegs,
      equippedAnimation,
      equippedBackground,
      setEquippedBackground,
      equippedLeftArmRotation,
      equippedRightArmRotation,
      equippedLegsRotation,
      equippedHatRotation,
      setPartRotation,
      leftArmOffset,
      rightArmOffset,
      legsOffset,
      headOffset,
      bodyOffset,
      hatOffset,
      setPartOffset,
      leftArmScale,
      rightArmScale,
      legsScale,
      headScale,
      bodyScale,
      hatScale,
      setPartScale,
      legsSpread,
      setLegsSpread,
      swapArms,
      setEquippedAvatar,
      currentProfileId,
      switchProfile,
      purchaseItem,
      purchaseVoice,
      equipItem,
      unequipItem,
      isOwned,
      savedCharacters,
      saveCurrentCharacter,
      deleteSavedCharacter,
      equipSavedCharacter,
      isSubscribed,
      subscribe,
      setIsSubscribed,
      resetUser,
      getParentAvatar
    }}>
      {children}
    </UserContext.Provider>
  );
};
