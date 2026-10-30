/**
 * Island animal prices. The parent app is the source of truth for the deduction:
 * a gk-buy is accepted only when `cost` matches this table.
 * Keep in sync with ANIMAL_PRICE in homeworld/src/animals.mjs.
 */
export const ISLAND_ANIMAL_PRICES: Record<string, number> = {
  chicken: 300,
  sheep: 1500,
  cow: 3000,
  horse: 5000,
  dog_hound: 800,
  dog_shepherd: 2000,
  dog_terrier: 500,
  donkey: 600,
  goat: 700,
};

/**
 * Prices when Adam (the island's farmer) asks the kid for animals once his paddock is ready.
 * Cheaper than the shop because the farm has done the work. A gk-buy-animal is accepted only
 * when `price` equals FARM_ANIMAL_PRICES[kind] × qty (qty 1..FARM_MAX_QTY).
 * Keep in sync with FARM_PRICES in homeworld/src/farm-rules.mjs.
 */
export const FARM_ANIMAL_PRICES: Record<string, number> = {
  chicken: 60,
  sheep: 150,
  goat: 200,
  cow: 300,
};
export const FARM_MAX_QTY = 2;

/**
 * Market stall prices. A gk-sell is accepted only when `coins` equals
 * ISLAND_SELL_PRICES[item] × qty (qty 1..ISLAND_SELL_MAX_QTY).
 * Keep in sync with SELL_ITEMS in homeworld/src/sell-prices.mjs.
 * These credit useUser().coins — the same purse Adam's animals spend.
 */
export const ISLAND_SELL_PRICES: Record<string, number> = {
  fish: 1,
  cooked_fish: 1,
  carrot: 3,
  wheat: 2,
  sunflower: 3,
  pumpkin: 4,
  apple: 2,
  diamond: 20,
};
export const ISLAND_SELL_MAX_QTY = 500;
