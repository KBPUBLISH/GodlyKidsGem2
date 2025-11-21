
import React, { createContext, useContext, useState, useEffect } from 'react';
// Removed import of KidProfile due to missing export in ../types

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'avatar' | 'frame' | 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs' | 'animation';
  value: string; // URL for avatar, Color Class/Hex for frame, Asset ID for parts, or Animation Class
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
  
  // Parent Profile
  parentName: string;
  setParentName: (name: string) => void;

  // Kids Profiles
  kids: any[]; // Fixed: Use `any[]` as fallback until KidProfile type is defined/imported
  addKid: (kid: any) => void;
  removeKid: (id: string) => void;

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
  setPartOffset: (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body', axis: 'x' | 'y', val: number) => void;
  
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
  setPartOffset: () => {},
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
  
  // Profile Data

  type KidProfile = {
    id: string;
    name: string;
    age?: number;
    // Add other fields as needed
  };

  const [parentName, setParentName] = useState<string>(saved?.parentName ?? 'Parent');
  const [kids, setKids] = useState<KidProfile[]>(saved?.kids ?? []);

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

  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>(saved?.savedCharacters ?? []);

  const [isSubscribed, setIsSubscribed] = useState(saved?.isSubscribed ?? false);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    const stateToSave = {
      coins,
      ownedItems,
      parentName,
      kids,
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
      savedCharacters,
      isSubscribed
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [
    coins, ownedItems, parentName, kids, 
    equippedAvatar, equippedFrame, equippedHat, equippedBody, 
    equippedLeftArm, equippedRightArm, equippedLegs, equippedAnimation,
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset,
    savedCharacters,
    isSubscribed
  ]);

  const addCoins = (amount: number) => {
    setCoins(prev => prev + amount);
  };

  const addKid = (kid: KidProfile) => {
    setKids(prev => [...prev, kid]);
  };

  const removeKid = (id: string) => {
    setKids(prev => prev.filter(k => k.id !== id));
  };

  const isOwned = (id: string) => {
    return ownedItems.includes(id);
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

  const setPartOffset = (part: 'leftArm' | 'rightArm' | 'legs' | 'head' | 'body', axis: 'x' | 'y', val: number) => {
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
    setSavedCharacters([]);
    setIsSubscribed(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <UserContext.Provider value={{
      coins,
      addCoins,
      ownedItems,
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
      setPartOffset,
      swapArms,
      setEquippedAvatar,
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
