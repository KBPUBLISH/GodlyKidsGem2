/**
 * Token Service for Godly Hub
 * Manages token balance, purchases, and spending for hub content
 */

const API_BASE_URL = localStorage.getItem('godlykids_api_url') || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://backendgk2-0.onrender.com');

// Token bundle definitions (must match backend)
export const TOKEN_BUNDLES = {
  godlykids_tokens_10: { tokens: 10, price: 9.99, name: 'Starter Pack' },
  godlykids_tokens_25: { tokens: 25, price: 19.99, name: 'Popular Pack' },
  godlykids_tokens_50: { tokens: 50, price: 39.99, name: 'Best Value' },
  godlykids_tokens_100: { tokens: 100, price: 69.99, name: 'Super Saver' },
};

export type BundleId = keyof typeof TOKEN_BUNDLES;

export interface TokenBundle {
  bundleId: BundleId;
  tokens: number;
  price: number;
  name: string;
  effectiveRate: string;
  bonus?: string;
}

export interface HubPlaylist {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  type: 'Audiobook' | 'Song';
  priceTokens: number;
  items: HubAudioItem[];
  creatorId: {
    _id: string;
    name: string;
    profileImage?: string;
    bio?: string;
  };
  purchaseCount: number;
  playCount: number;
  categories: string[];
  minAge?: number;
}

export interface HubAudioItem {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  audioUrl: string;
  duration?: number;
  order: number;
}

export interface TokenTransaction {
  _id: string;
  type: 'purchase' | 'spend' | 'refund' | 'bonus';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

// Get user ID for API calls
const getUserId = (): string => {
  return localStorage.getItem('godlykids_user_email') || 
         localStorage.getItem('godlykids_device_id') || 
         'anonymous';
};

const getUserEmail = (): string | undefined => {
  return localStorage.getItem('godlykids_user_email') || undefined;
};

export const tokenService = {
  /**
   * Get available token bundles
   */
  getBundles: (): TokenBundle[] => {
    return Object.entries(TOKEN_BUNDLES).map(([id, info]) => ({
      bundleId: id as BundleId,
      ...info,
      effectiveRate: `$${(info.price / info.tokens).toFixed(2)}/token`,
      bonus: info.tokens > 10 
        ? `+${Math.round((info.tokens / 10 - info.price / 9.99) / (info.price / 9.99) * 100)}% bonus`
        : undefined,
    }));
  },

  /**
   * Get user's current token balance
   */
  getBalance: async (): Promise<number> => {
    try {
      const userId = getUserId();
      const email = getUserEmail();
      
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      else params.append('userId', userId);
      
      const response = await fetch(`${API_BASE_URL}/api/tokens/balance?${params}`);
      const data = await response.json();
      
      return data.balance || 0;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  },

  /**
   * Record a token purchase (called after successful IAP)
   */
  recordPurchase: async (
    bundleId: BundleId,
    transactionId: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    try {
      const userId = getUserId();
      const userEmail = getUserEmail();
      
      const response = await fetch(`${API_BASE_URL}/api/tokens/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          bundleId,
          transactionId,
          platform,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error };
      }
      
      return { success: true, newBalance: data.newBalance };
    } catch (error: any) {
      console.error('Error recording purchase:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Spend tokens to purchase hub content
   */
  purchaseContent: async (
    playlistId: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    try {
      const userId = getUserId();
      const userEmail = getUserEmail();
      
      const response = await fetch(`${API_BASE_URL}/api/tokens/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          playlistId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error };
      }
      
      return { success: true, newBalance: data.newBalance };
    } catch (error: any) {
      console.error('Error purchasing content:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if user owns a specific playlist
   */
  ownsContent: async (playlistId: string): Promise<boolean> => {
    try {
      const userId = getUserId();
      const email = getUserEmail();
      
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      else params.append('userId', userId);
      
      const response = await fetch(
        `${API_BASE_URL}/api/tokens/owns/${playlistId}?${params}`
      );
      const data = await response.json();
      
      return data.owns || false;
    } catch (error) {
      console.error('Error checking ownership:', error);
      return false;
    }
  },

  /**
   * Get user's purchased hub content
   */
  getPurchasedContent: async (): Promise<HubPlaylist[]> => {
    try {
      const userId = getUserId();
      const email = getUserEmail();
      
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      else params.append('userId', userId);
      
      const response = await fetch(`${API_BASE_URL}/api/tokens/purchases?${params}`);
      const data = await response.json();
      
      return data.purchases?.map((p: any) => p.playlist).filter(Boolean) || [];
    } catch (error) {
      console.error('Error getting purchased content:', error);
      return [];
    }
  },

  /**
   * Get transaction history
   */
  getHistory: async (limit = 50): Promise<TokenTransaction[]> => {
    try {
      const userId = getUserId();
      const email = getUserEmail();
      
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      else params.append('userId', userId);
      params.append('limit', limit.toString());
      
      const response = await fetch(`${API_BASE_URL}/api/tokens/history?${params}`);
      const data = await response.json();
      
      return data.transactions || [];
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  },

  /**
   * Browse hub playlists
   */
  browseHub: async (options?: {
    category?: string;
    type?: 'Audiobook' | 'Song';
    featured?: boolean;
    sort?: 'newest' | 'popular' | 'price_low' | 'price_high';
    limit?: number;
    offset?: number;
  }): Promise<{ playlists: HubPlaylist[]; total: number; hasMore: boolean }> => {
    try {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.type) params.append('type', options.type);
      if (options?.featured) params.append('featured', 'true');
      if (options?.sort) params.append('sort', options.sort);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      const response = await fetch(`${API_BASE_URL}/api/hub/playlists?${params}`);
      const data = await response.json();
      
      return {
        playlists: data.playlists || [],
        total: data.total || 0,
        hasMore: data.hasMore || false,
      };
    } catch (error) {
      console.error('Error browsing hub:', error);
      return { playlists: [], total: 0, hasMore: false };
    }
  },

  /**
   * Get a single hub playlist
   */
  getPlaylist: async (playlistId: string): Promise<HubPlaylist | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hub/playlists/${playlistId}`);
      const data = await response.json();
      
      return data.playlist || null;
    } catch (error) {
      console.error('Error getting playlist:', error);
      return null;
    }
  },

  /**
   * Get featured hub content
   */
  getFeatured: async (): Promise<HubPlaylist[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hub/featured`);
      const data = await response.json();
      
      return data.playlists || [];
    } catch (error) {
      console.error('Error getting featured:', error);
      return [];
    }
  },

  /**
   * Get creator profile and their content
   */
  getCreatorProfile: async (creatorId: string): Promise<{
    creator: any;
    playlists: HubPlaylist[];
  } | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hub/creators/${creatorId}`);
      const data = await response.json();
      
      return {
        creator: data.creator,
        playlists: data.playlists || [],
      };
    } catch (error) {
      console.error('Error getting creator profile:', error);
      return null;
    }
  },
};

export default tokenService;
