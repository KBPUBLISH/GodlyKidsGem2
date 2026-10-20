import { goldCoinCost } from './arcadeGoldPrice';
import type { UnlockedRewardGame } from '../services/rewardsService';

export type CmsArcadeGame = {
  _id?: string;
  gameId: string;
  name: string;
  url?: string;
  logo?: string;
  coverImage?: string;
  isPurchasable?: boolean;
  goldCoinPrice?: number | string | null;
};

export type ArcadeTile = {
  key: string;
  name: string;
  url?: string;
  art?: string;
  source: 'cms' | 'reward';
  gameId?: string;
  _id?: string;
  goldCoinPrice?: number;
  isPurchasable?: boolean;
  isNew?: boolean;
  rewardId?: string;
};

const normUrl = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

/**
 * CMS arcade titles plus story-pack unlocks on one cabinet.
 * A reward game with the same URL as a paid CMS title unlocks that tile
 * (no gold spend) so the kid isn't charged for a game they already earned.
 */
export function mergeArcadeCatalog(
  cmsGames: CmsArcadeGame[],
  rewardGames: UnlockedRewardGame[],
): ArcadeTile[] {
  const tiles: ArcadeTile[] = [];
  const cmsByUrl = new Map<string, number>();

  for (const game of cmsGames) {
    const url = normUrl(game.url);
    const tile: ArcadeTile = {
      key: `cms:${game.gameId || game._id || game.name}`,
      name: game.name,
      url: game.url,
      art: game.coverImage || game.logo,
      source: 'cms',
      gameId: game.gameId,
      _id: game._id,
      goldCoinPrice: goldCoinCost(game),
      isPurchasable: Boolean(game.isPurchasable) || goldCoinCost(game) > 0,
    };
    cmsByUrl.set(url, tiles.length);
    tiles.push(tile);
  }

  const usedRewardUrls = new Set<string>();
  for (const reward of rewardGames) {
    const url = normUrl(reward.url);
    const catalogId = (reward.catalogGameId || '').trim();
    const cmsIdxById = catalogId
      ? tiles.findIndex((tile) => tile.source === 'cms' && tile.gameId === catalogId)
      : -1;
    const cmsIdx = cmsIdxById >= 0 ? cmsIdxById : url ? cmsByUrl.get(url) : undefined;
    if (cmsIdx != null && cmsIdx >= 0) {
      const existing = tiles[cmsIdx];
      tiles[cmsIdx] = {
        ...existing,
        goldCoinPrice: 0,
        isPurchasable: false,
        isNew: existing.isNew || reward.isNew,
        rewardId: reward.id,
        art: existing.art || reward.imageUrl,
      };
      if (url) usedRewardUrls.add(url);
      continue;
    }
    if (!url || usedRewardUrls.has(url)) continue;
    usedRewardUrls.add(url);
    tiles.push({
      key: `reward:${reward.id}`,
      name: reward.name,
      url: reward.url,
      art: reward.imageUrl,
      source: 'reward',
      gameId: catalogId || undefined,
      goldCoinPrice: 0,
      isNew: reward.isNew,
      rewardId: reward.id,
    });
  }

  return tiles;
}
