/**
 * Token Service for Godly Hub
 * Manages token balance, purchases, and spending for hub content
 */

import { getApiBaseUrl } from './apiService';
import { authService } from './authService';

const apiRoot = () => getApiBaseUrl().replace(/\/+$/, '');

// Three credit packs (must match backend TOKEN_SALE_BUNDLES)
export const TOKEN_BUNDLES = {
  godlykids_tokens_10: { tokens: 10, price: 10, name: 'Starter Pack' },
  godlykids_tokens_25: { tokens: 25, price: 20, name: 'Family Pack' },
  godlykids_tokens_50: { tokens: 50, price: 40, name: 'Voyage Pack' },
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

export interface CreditPackCatalog {
  bundles: TokenBundle[];
  paymentsConfigured: boolean;
}

const ensureDeviceId = (): string => {
  let deviceId = localStorage.getItem('godlykids_device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('godlykids_device_id', deviceId);
  }
  return deviceId;
};

// Single identity helpers for balance, spend, and credit-pack checkout.
const getUserId = (): string => {
  return authService.getUserIdForBackend() || ensureDeviceId();
};

const getUserEmail = (): string | undefined => {
  return authService.getUser()?.email || localStorage.getItem('godlykids_user_email') || undefined;
};

const authHeaders = (): HeadersInit => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = authService.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const identityPayload = () => ({
  userId: getUserId(),
  userEmail: getUserEmail(),
});

const identityQuery = (): string => {
  const params = new URLSearchParams();
  const email = getUserEmail();
  if (email) params.set('email', email);
  else params.set('userId', getUserId());
  const query = params.toString();
  return query ? `?${query}` : '';
};

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

export const tokenService = {
  /**
   * Local catalog of the three sale packs (used if the API is unreachable).
   */
  getBundles: (): TokenBundle[] => {
    return Object.entries(TOKEN_BUNDLES).map(([id, info]) => ({
      bundleId: id as BundleId,
      ...info,
      effectiveRate: `$${(info.price / info.tokens).toFixed(2)}/credit`,
      bonus:
        info.tokens === 25
          ? 'Save $5 vs Starter'
          : info.tokens === 50
            ? 'Save $10 vs Starter'
            : undefined,
    }));
  },

  fetchCatalog: async (): Promise<CreditPackCatalog> => {
    try {
      const response = await fetch(`${apiRoot()}/tokens/bundles`);
      const data = await response.json();
      const bundles: TokenBundle[] = (data.bundles || []).map((bundle: {
        bundleId: BundleId;
        tokens: number;
        priceCents?: number;
        name: string;
      }) => ({
        bundleId: bundle.bundleId,
        tokens: bundle.tokens,
        price: (bundle.priceCents ?? 0) / 100,
        name: bundle.name,
        effectiveRate: `$${(((bundle.priceCents ?? 0) / 100) / bundle.tokens).toFixed(2)}/credit`,
        bonus:
          bundle.tokens === 25
            ? 'Save $5 vs Starter'
            : bundle.tokens === 50
              ? 'Save $10 vs Starter'
              : undefined,
      }));
      return {
        bundles: bundles.length ? bundles : tokenService.getBundles(),
        paymentsConfigured: Boolean(data.paymentsConfigured),
      };
    } catch (error) {
      console.error('Error loading credit packs:', error);
      return { bundles: tokenService.getBundles(), paymentsConfigured: false };
    }
  },

  /**
   * Start Stripe Checkout for a pack. Does not add credits itself.
   */
  startCheckout: async (
    bundleId: BundleId,
  ): Promise<{ url?: string; error?: string; paymentsConfigured?: boolean }> => {
    try {
      const origin = window.location.origin;
      const path = window.location.pathname || '/';
      const successUrl = `${origin}${path}#/payment-success?session_id={CHECKOUT_SESSION_ID}&credits=1`;
      const cancelUrl = `${origin}${path}#${window.location.hash.replace(/^#/, '') || '/creators'}`;

      const response = await fetch(`${apiRoot()}/tokens/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...identityPayload(),
          bundleId,
          successUrl,
          cancelUrl,
        }),
      });
      const data = await response.json();
      if (response.status === 503 || data.error === 'payments_not_configured') {
        return {
          error: data.message || 'Card payments are not set up yet. Credits were not added.',
          paymentsConfigured: false,
        };
      }
      if (!response.ok || !data.url) {
        return { error: data.error || data.message || 'Could not start checkout' };
      }
      return { url: data.url, paymentsConfigured: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not start checkout';
      return { error: message };
    }
  },

  /**
   * Get user's current token balance
   */
  getBalance: async (): Promise<number> => {
    try {
      const response = await fetch(`${apiRoot()}/tokens/balance${identityQuery()}`, {
        headers: authHeaders(),
      });
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
      
      const response = await fetch(`${apiRoot()}/tokens/purchase`, {
        method: 'POST',
        headers: authHeaders(),
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
      
      const response = await fetch(`${apiRoot()}/tokens/spend`, {
        method: 'POST',
        headers: authHeaders(),
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
        `${apiRoot()}/tokens/owns/${playlistId}?${params}`
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
      
      const response = await fetch(`${apiRoot()}/tokens/purchases?${params}`);
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
      
      const response = await fetch(`${apiRoot()}/tokens/history?${params}`);
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
      
      const response = await fetch(`${apiRoot()}/hub/playlists?${params}`);
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
      const response = await fetch(`${apiRoot()}/hub/playlists/${playlistId}`);
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
      const response = await fetch(`${apiRoot()}/hub/featured`);
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
      const response = await fetch(`${apiRoot()}/hub/creators/${creatorId}`);
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
