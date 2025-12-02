
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Removed import of KidProfile due to missing export in ../types

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'avatar' | 'frame' | 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs' | 'animation' | 'voice';
  value: string; // URL for avatar, Color Class/Hex for frame, Asset ID for parts, Animation Class, or Voice ID
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

interface UserContextType {
  coins: number;
  addCoins: (amount: number) => void;
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
  removeKid: (id: string) => void;
  
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
  
  // Rotation (Pose)
  equippedLeftArmRotation: number;
  equippedRightArmRotation: number;
  equippedLegsRotation: number;
  setPartRotation: (part: 'leftArm' | 'rightArm' | 'legs', rotation: number) => void;

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
  
  swapArms: () => void;

  setEquippedAvatar: (url: string) => void; // Exposed for onboarding

  purchaseItem: (item: ShopItem) => boolean;
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

  resetUser: () => void; // New method to wipe data
}

const UserContext = createContext<UserContextType>({
  coins: 2650,
  addCoins: () => {},
  ownedItems: [],
  unlockedVoices: [],
  unlockVoice: () => {},
  isVoiceUnlocked: () => false,
  parentName: 'Parent',
  setParentName: () => {},
  kids: [],
  addKid: () => {},
  removeKid: () => {},
  equippedAvatar: '',
  equippedFrame: '',
  equippedHat: null,
  equippedBody: null,
  equippedLeftArm: null,
  equippedRightArm: null,
  equippedLegs: null,
  equippedAnimation: 'anim-breathe',
  equippedLeftArmRotation: 0,
  equippedRightArmRotation: 0,
  equippedLegsRotation: 0,
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
  swapArms: () => {},
  setEquippedAvatar: () => {},
  purchaseItem: () => false,
  equipItem: () => {},
  unequipItem: () => {},
  isOwned: () => false,
  savedCharacters: [],
  saveCurrentCharacter: () => {},
  deleteSavedCharacter: () => {},
  equipSavedCharacter: () => {},
  isSubscribed: false,
  subscribe: () => {},
  resetUser: () => {},
});

export const useUser = () => useContext(UserContext);

const STORAGE_KEY = 'godly_kids_data_v6'; // Version bump for saves

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // --- INITIALIZATION FROM LOCAL STORAGE ---
  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load user data", e);
      return null;
    }
  };

  const saved = loadState();

  const [coins, setCoins] = useState(saved?.coins ?? 2650); // Start with 2650 for testing
  const [ownedItems, setOwnedItems] = useState<string[]>(saved?.ownedItems ?? ['f1', 'anim1']); // anim1 is default breathe
  const [unlockedVoices, setUnlockedVoices] = useState<string[]>(saved?.unlockedVoices ?? []); // Voices unlocked by user
  
  // Profile Data

  type KidProfile = {
    id: string;
    name: string;
    age?: number;
    avatarSeed?: string; // Initial head selection
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
  };

  const [parentName, setParentName] = useState<string>(saved?.parentName ?? 'Parent');
  const [kids, setKids] = useState<KidProfile[]>(saved?.kids ?? []);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(saved?.currentProfileId ?? null);

  // Default Equipment - Start with TOAST!
  const [equippedAvatar, setEquippedAvatar] = useState<string>(saved?.equippedAvatar ?? 'head-toast');
  const [equippedFrame, setEquippedFrame] = useState<string>(saved?.equippedFrame ?? 'border-[#8B4513]');
  const [equippedHat, setEquippedHat] = useState<string | null>(saved?.equippedHat ?? null);
  const [equippedBody, setEquippedBody] = useState<string | null>(saved?.equippedBody ?? null);
  const [equippedLeftArm, setEquippedLeftArm] = useState<string | null>(saved?.equippedLeftArm ?? null);
  const [equippedRightArm, setEquippedRightArm] = useState<string | null>(saved?.equippedRightArm ?? null);
  const [equippedLegs, setEquippedLegs] = useState<string | null>(saved?.equippedLegs ?? null);
  const [equippedAnimation, setEquippedAnimation] = useState<string>(saved?.equippedAnimation ?? 'anim-breathe');
  
  // Rotation State (Defaults to 0)
  const [equippedLeftArmRotation, setEquippedLeftArmRotation] = useState<number>(saved?.equippedLeftArmRotation ?? 0);
  const [equippedRightArmRotation, setEquippedRightArmRotation] = useState<number>(saved?.equippedRightArmRotation ?? 0);
  const [equippedLegsRotation, setEquippedLegsRotation] = useState<number>(saved?.equippedLegsRotation ?? 0);

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

  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>(saved?.savedCharacters ?? []);

  const [isSubscribed, setIsSubscribed] = useState(saved?.isSubscribed ?? false);

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

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    const stateToSave = {
      coins,
      ownedItems,
      unlockedVoices,
      parentName,
      kids,
      currentProfileId,
      equippedAvatar,
      equippedFrame,
      equippedHat,
      equippedBody,
      equippedLeftArm,
      equippedRightArm,
      equippedLegs,
      equippedAnimation,
      equippedLeftArmRotation,
      equippedRightArmRotation,
      equippedLegsRotation,
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
      parentAvatarData
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [
    coins, ownedItems, unlockedVoices, parentName, kids, currentProfileId,
      equippedAvatar, equippedFrame, equippedHat, equippedBody,
    equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
    leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale,
    savedCharacters,
    isSubscribed,
    parentAvatarData
  ]);

  const addCoins = (amount: number) => {
    setCoins(prev => prev + amount);
  };

  const addKid = (kid: KidProfile) => {
    setKids(prev => [...prev, kid]);
  };

  const removeKid = (id: string) => {
    setKids(prev => prev.filter(k => k.id !== id));
    // If we're removing the currently active profile, switch back to parent
    if (currentProfileId === id) {
      setCurrentProfileId(null);
    }
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

  // Helper to save current avatar state to active profile
  const saveCurrentProfileAvatar = useCallback(() => {
    // Don't save if we're not on any profile yet (initial load)
    if (currentProfileId === null && parentAvatarData === null) {
      return;
    }
    
    const currentState = getCurrentAvatarState();
    
    if (currentProfileId === null) {
      // Currently on parent - save parent's state
      setParentAvatarData(currentState);
    } else {
      // Currently on a kid - save kid's state to their profile
      setKids(prev => prev.map(kid => 
        kid.id === currentProfileId 
          ? { ...kid, ...currentState }
          : kid
      ));
    }
  }, [currentProfileId, parentAvatarData, equippedAvatar, equippedFrame, equippedHat, equippedBody, 
      equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
      equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation,
      leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
      leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale]);

  // Auto-save avatar changes to current profile (with debounce to avoid excessive saves)
  useEffect(() => {
    // Don't save on initial mount or if no profile is active
    if (currentProfileId === null && parentAvatarData === null) {
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
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
    leftArmScale, rightArmScale, legsScale, headScale, bodyScale, hatScale,
    currentProfileId,
    saveCurrentProfileAvatar
  ]);

  const switchProfile = (profileId: string | null) => {
    // Save current profile's avatar data before switching
    saveCurrentProfileAvatar();

    setCurrentProfileId(profileId);

    if (profileId === null) {
      // Switching to parent - restore parent's avatar data
      if (parentAvatarData) {
        applyAvatarState(parentAvatarData);
      }
    } else {
      // Switching to a kid profile - restore kid's saved avatar or use defaults
      const kid = kids.find(k => k.id === profileId);
      if (kid) {
        // If kid has saved avatar data, use it; otherwise use defaults with their avatarSeed
        if (kid.avatar !== undefined) {
          // Kid has saved avatar configuration
          applyAvatarState({
            avatar: kid.avatar || kid.avatarSeed || 'head-toast',
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
            avatar: kid.avatarSeed || 'head-toast',
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
    // Premium users have all voices unlocked
    if (isSubscribed) return true;
    // Otherwise check if voice is in unlocked list
    return unlockedVoices.includes(voiceId);
  };

  const purchaseItem = (item: ShopItem): boolean => {
    if (ownedItems.includes(item.id)) return true;
    if (coins >= item.price) {
      setCoins(prev => prev - item.price);
      setOwnedItems(prev => [...prev, item.id]);
      return true;
    }
    return false;
  };

  const equipItem = (type: ShopItem['type'], value: string) => {
    switch (type) {
      case 'avatar': setEquippedAvatar(value); break;
      case 'frame': setEquippedFrame(value); break;
      case 'hat': setEquippedHat(value); break;
      case 'body': setEquippedBody(value); break;
      case 'leftArm': setEquippedLeftArm(value); break;
      case 'rightArm': setEquippedRightArm(value); break;
      case 'legs': setEquippedLegs(value); break;
      case 'animation': setEquippedAnimation(value); break;
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

  const setPartRotation = (part: 'leftArm' | 'rightArm' | 'legs', rotation: number) => {
    if (part === 'leftArm') setEquippedLeftArmRotation(rotation);
    else if (part === 'rightArm') setEquippedRightArmRotation(rotation);
    else if (part === 'legs') setEquippedLegsRotation(rotation);
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
    // Clamp scale between 0.5 (50%) and 2.0 (200%)
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
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
    setIsSubscribed(true);
  };

  const resetUser = () => {
    setCoins(2650);
    setOwnedItems(['f1', 'anim1']);
    setParentName('');
    setKids([]);
    setEquippedAvatar('head-toast');
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
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{
      coins,
      addCoins,
      ownedItems,
      unlockedVoices,
      unlockVoice,
      isVoiceUnlocked,
      parentName,
      setParentName,
      kids,
      addKid,
      removeKid,
      equippedAvatar,
      equippedFrame,
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
      swapArms,
      setEquippedAvatar,
      currentProfileId,
      switchProfile,
      purchaseItem,
      equipItem,
      unequipItem,
      isOwned,
      savedCharacters,
      saveCurrentCharacter,
      deleteSavedCharacter,
      equipSavedCharacter,
      isSubscribed,
      subscribe,
      resetUser
    }}>
      {children}
    </UserContext.Provider>
  );
};
