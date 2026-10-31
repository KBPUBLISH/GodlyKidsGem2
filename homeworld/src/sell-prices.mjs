// What the market stall buys. Item ids are the ones the island actually puts in the bag
// (core.mjs): fishing adds `fish`, grilling adds `cooked_fish`, a crop harvest adds the
// plant id (carrot, wheat, sunflower, pumpkin — not the seed), apple trees add `apple`,
// and breaking a diamond vein (or a lucky stone) adds `diamond`.
// Keep prices in sync with ISLAND_SELL_PRICES in utils/islandShop.ts. The parent app
// credits useUser().coins only when coins === price × qty.

export const SELL_MAX_QTY = 500;

export const SELL_GROUPS = [
  {id:'fish', name:'Fish', icon:'🐟'},
  {id:'produce', name:'Garden', icon:'🥕'},
  {id:'gems', name:'Gems', icon:'💎'},
];

export const SELL_ITEMS = [
  {id:'fish', name:'Raw fish', price:1, group:'fish'},
  {id:'cooked_fish', name:'Grilled fish', price:1, group:'fish'},
  {id:'carrot', name:'Carrot', price:3, group:'produce'},
  {id:'lettuce', name:'Lettuce', price:3, group:'produce'},
  {id:'wheat', name:'Wheat', price:2, group:'produce'},
  {id:'sunflower', name:'Sunflower', price:3, group:'produce'},
  {id:'pumpkin', name:'Pumpkin', price:4, group:'produce'},
  {id:'apple', name:'Apple', price:2, group:'produce'},
  {id:'diamond', name:'Diamond', price:20, group:'gems'},
];

export const sellItem = id => SELL_ITEMS.find(i => i.id === id) || null;

/** A priced quote, or null when the stall does not buy that item or the quantity is not a real stack. */
export function quoteSell(item, qty){
  const row = sellItem(item);
  const n = Number(qty);
  if(!row || !Number.isInteger(n) || n < 1 || n > SELL_MAX_QTY) return null;
  return {id:row.id, name:row.name, group:row.group, price:row.price, qty:n, coins:row.price * n};
}

/**
 * Take `qty` of a sellable item out of a bag. Returns the quote plus the new bag,
 * or null when the item is not sold or the bag does not have enough.
 */
export function takeForSale(inventory, item, qty){
  const quote = quoteSell(item, qty);
  if(!quote) return null;
  const have = Math.floor(Number(inventory?.[item]) || 0);
  if(have < quote.qty) return null;
  const next = {...(inventory || {})};
  const left = have - quote.qty;
  if(left > 0) next[item] = left;
  else delete next[item];
  return {...quote, inventory:next};
}

/** Groups for the Sell card. Every catalog row is listed, even when the bag has zero. */
export function sellCard(inventory){
  const bag = inventory || {};
  return SELL_GROUPS.map(group => ({
    ...group,
    items:SELL_ITEMS.filter(i => i.group === group.id).map(i => ({id:i.id, name:i.name, price:i.price, have:Math.max(0, Math.floor(Number(bag[i.id]) || 0))})),
  }));
}
