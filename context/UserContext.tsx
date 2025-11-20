
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'avatar' | 'frame' | 'hat' | 'body' | 'leftArm' | 'rightArm' | 'legs';
  value: string; // URL for avatar, Color Class/Hex for frame, Asset ID for parts
  previewColor?: string; // For displaying frame colors in shop
}

interface UserContextType {
  coins: number;
  addCoins: (amount: number) => void;
  ownedItems: string[];
  
  // Equipment Slots
  equippedAvatar: string; // "Head"
  equippedFrame: string;
  equippedHat: string | null;
  equippedBody: string | null;
  equippedLeftArm: string | null;
  equippedRightArm: string | null;
  equippedLegs: string | null;

  purchaseItem: (item: ShopItem) => boolean;
  equipItem: (type: ShopItem['type'], value: string) => void;
  unequipItem: (type: ShopItem['type']) => void;
  isOwned: (id: string) => boolean;
  
  isSubscribed: boolean;
  subscribe: () => void;
}

const UserContext = createContext<UserContextType>({
  coins: 350,
  addCoins: () => {},
  ownedItems: [],
  equippedAvatar: '',
  equippedFrame: '',
  equippedHat: null,
  equippedBody: null,
  equippedLeftArm: null,
  equippedRightArm: null,
  equippedLegs: null,
  purchaseItem: () => false,
  equipItem: () => {},
  unequipItem: () => {},
  isOwned: () => false,
  isSubscribed: false,
  subscribe: () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coins, setCoins] = useState(650); // Increased starting coins to test
  const [ownedItems, setOwnedItems] = useState<string[]>(['f1']);
  
  // Default Equipment
  const [equippedAvatar, setEquippedAvatar] = useState('https://api.dicebear.com/7.x/bottts/svg?seed=Felix');
  const [equippedFrame, setEquippedFrame] = useState('border-[#8B4513]');
  const [equippedHat, setEquippedHat] = useState<string | null>(null);
  const [equippedBody, setEquippedBody] = useState<string | null>(null);
  const [equippedLeftArm, setEquippedLeftArm] = useState<string | null>(null);
  const [equippedRightArm, setEquippedRightArm] = useState<string | null>(null);
  const [equippedLegs, setEquippedLegs] = useState<string | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);

  const addCoins = (amount: number) => {
    setCoins(prev => prev + amount);
  };

  const purchaseItem = (item: ShopItem): boolean => {
    if (coins >= item.price && !ownedItems.includes(item.id)) {
      setCoins(prev => prev - item.price);
      setOwnedItems(prev => [...prev, item.id]);
      // Auto-equip
      equipItem(item.type, item.value);
      return true;
    }
    return false;
  };

  const equipItem = (type: ShopItem['type'], value: string) => {
    // RULE: Arms and Legs can only be equipped if a body exists.
    if ((type === 'leftArm' || type === 'rightArm' || type === 'legs') && !equippedBody) {
        // If trying to equip a limb but no body is equipped, ignore the request.
        // The UI should ideally prevent this, but this is a safety check.
        return;
    }

    switch (type) {
      case 'avatar': setEquippedAvatar(value); break;
      case 'frame': setEquippedFrame(value); break;
      case 'hat': setEquippedHat(value); break;
      case 'body': setEquippedBody(value); break;
      case 'leftArm': setEquippedLeftArm(value); break;
      case 'rightArm': setEquippedRightArm(value); break;
      case 'legs': setEquippedLegs(value); break;
    }
  };

  const unequipItem = (type: ShopItem['type']) => {
    switch (type) {
        case 'hat': setEquippedHat(null); break;
        case 'body': 
            // If un-equipping body, we MUST un-equip all limbs attached to it
            setEquippedBody(null); 
            setEquippedLeftArm(null);
            setEquippedRightArm(null);
            setEquippedLegs(null);
            break;
        case 'leftArm': setEquippedLeftArm(null); break;
        case 'rightArm': setEquippedRightArm(null); break;
        case 'legs': setEquippedLegs(null); break;
    }
  }

  const isOwned = (id: string) => ownedItems.includes(id);

  const subscribe = () => {
    setIsSubscribed(true);
  };

  return (
    <UserContext.Provider value={{ 
      coins, 
      addCoins, 
      ownedItems, 
      equippedAvatar, 
      equippedFrame, 
      equippedHat,
      equippedBody,
      equippedLeftArm,
      equippedRightArm,
      equippedLegs,
      purchaseItem, 
      equipItem,
      unequipItem,
      isOwned,
      isSubscribed,
      subscribe
    }}>
      {children}
    </UserContext.Provider>
  );
};
