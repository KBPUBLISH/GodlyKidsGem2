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
