import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteSell, takeForSale, sellCard, SELL_ITEMS} from '../src/sell-prices.mjs';
import {fishStillNeeded, RAW_FISH_BUFFER} from '../src/character-skills.mjs';
import {creditShipCoins, readShipCoins} from '../src/today-goals.mjs';

test('Eve does not fish once the bag already covers the next meal', () => {
  assert.equal(RAW_FISH_BUFFER, 8);
  assert.equal(fishStillNeeded(200), 0);
  assert.equal(fishStillNeeded(8), 0);
  assert.equal(fishStillNeeded(6), 2);
  assert.equal(fishStillNeeded(0), 8);
});

test('selling one fish, one vegetable, and one gem takes them from the bag and prices them', () => {
  const prices = Object.fromEntries(SELL_ITEMS.map(i => [i.id, i.price]));
  assert.equal(prices.fish, 1);
  assert.equal(prices.cooked_fish, 1);
  assert.ok(prices.carrot >= 2 && prices.carrot <= 4);
  assert.ok(prices.diamond >= 15 && prices.diamond <= 25);

  let bag = {fish:200, cooked_fish:3, carrot:4, wheat:2, diamond:0, carrot_seed:9, stone:40, copper_ore:2};
  const fish = takeForSale(bag, 'fish', 1);
  assert.equal(fish.coins, 1);
  assert.equal(fish.inventory.fish, 199);
  bag = fish.inventory;

  const veg = takeForSale(bag, 'carrot', 1);
  assert.equal(veg.coins, prices.carrot);
  assert.equal(veg.inventory.carrot, 3);
  assert.equal(veg.inventory.carrot_seed, 9);
  bag = veg.inventory;

  assert.equal(takeForSale(bag, 'diamond', 1), null);
  const emptyGem = sellCard(bag).find(g => g.id === 'gems').items.find(i => i.id === 'diamond');
  assert.equal(emptyGem.have, 0);

  bag = {...bag, diamond:2};
  const gem = takeForSale(bag, 'diamond', 1);
  assert.equal(gem.coins, prices.diamond);
  assert.equal(gem.inventory.diamond, 1);

  assert.equal(quoteSell('carrot_seed', 1), null);
  assert.equal(takeForSale(bag, 'stone', 1), null);
  assert.equal(takeForSale(bag, 'copper_ore', 1), null);
  assert.equal(quoteSell('fish', 0), null);
  assert.equal(quoteSell('not_a_thing', 1), null);
});

test('stall coins use a separate Friends World purse and leave account coins untouched', () => {
  const prev = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  store.set('godly_kids_data_v6', JSON.stringify({coins:80, currentProfileId:'kid1', kids:[{id:'kid1', coins:100}]}));
  assert.equal(readShipCoins(), 500);
  assert.equal(creditShipCoins(10), 510);
  const saved = JSON.parse(store.get('godly_kids_data_v6'));
  assert.equal(saved.coins, 80);
  assert.equal(saved.kids[0].coins, 100);
  assert.equal(store.get('gk_friends_world_coins_v1:local'), '510');
  globalThis.localStorage = prev;
});
