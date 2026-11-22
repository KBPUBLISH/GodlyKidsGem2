/** Gold-coin price from a CMS game row. */
export function goldCoinCost(game: {
  goldCoinPrice?: number | string | null;
  isPurchasable?: boolean;
}): number {
  const price = Number(game?.goldCoinPrice);
  if (Number.isFinite(price) && price > 0) return Math.floor(price);
  return 0;
}

const normName = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normUrl = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase();

/**
 * Arcade copies are sometimes created separately from a Daily Tasks game.
 * If the arcade row is free, use the paid price from a same-name or same-URL sibling.
 */
export function applySiblingGoldPrice<T extends {
  _id?: string;
  gameId?: string;
  name?: string;
  url?: string;
  isPurchasable?: boolean;
  goldCoinPrice?: number | string | null;
}>(arcadeGames: T[], catalog: T[]): T[] {
  if (!Array.isArray(arcadeGames) || arcadeGames.length === 0) return arcadeGames;
  const paid = (Array.isArray(catalog) ? catalog : []).filter(
    (other) => goldCoinCost(other) > 0,
  );

  return arcadeGames.map((game) => {
    if (goldCoinCost(game) > 0) return game;
    const name = normName(game.name);
    const url = normUrl(game.url);
    const sibling = paid.find((other) => {
      if (!other) return false;
      if (other.gameId && game.gameId && other.gameId === game.gameId) return false;
      if (other._id && game._id && String(other._id) === String(game._id)) return false;
      const sameName = !!name && normName(other.name) === name;
      const sameUrl = !!url && normUrl(other.url) === url;
      return sameName || sameUrl;
    });
    if (!sibling) return game;
    return {
      ...game,
      isPurchasable: true,
      goldCoinPrice: goldCoinCost(sibling),
    };
  });
}
