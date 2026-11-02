import test from 'node:test';
import assert from 'node:assert/strict';
import {transactFriendsWallet} from '../../shared/friendsWallet.mjs';
import {marketTrade} from '../src/living-market-rules.mjs';
import {farmFresh,farmBuy} from '../src/living-farm-rules.mjs';
const setup=(start=20)=>{let coins=start;return {balance:()=>coins,spend:n=>{coins-=n;return true;},earn:n=>{coins+=n;}};};
test('market seeds spend the shared wallet and selling returns earnings',()=>{
 const w=setup();let inventory={carrot:1},farm={...farmFresh(),coins:w.balance()};
 const buy=marketTrade(farm,inventory,'buy','carrot_seed');
 assert.equal(transactFriendsWallet({delta:buy.farm.coins-w.balance(),commit:()=>inventory=buy.inventory},w).balance,18);
 assert.equal(inventory.carrot_seed,3);
 const sell=marketTrade({...farm,coins:w.balance()},inventory,'sell','carrot');
 assert.equal(transactFriendsWallet({delta:sell.farm.coins-w.balance(),commit:()=>inventory=sell.inventory},w).balance,sell.farm.coins);
 assert.equal(inventory.carrot,0);
});
test('two quick purchases cannot overdraw or grant the second item',()=>{
 const w=setup(3);let saves=0;
 assert.equal(transactFriendsWallet({delta:-2,commit:()=>saves++},w).ok,true);
 assert.equal(transactFriendsWallet({delta:-2,commit:()=>saves++},w).ok,false);
 assert.equal(w.balance(),1);assert.equal(saves,1);
});
test('failed inventory save leaves coins unchanged; reward credits once per commit',()=>{
 const w=setup();assert.equal(transactFriendsWallet({delta:-10,commit:()=>{throw Error('quota');}},w).ok,false);
 assert.equal(w.balance(),20);
 assert.equal(transactFriendsWallet({delta:100,commit:()=>{}},w).balance,120);
});
test('coop uses app funds and validates the same transaction boundary',()=>{
 const w=setup(500),farm={...farmFresh(),coins:w.balance()};const next=farmBuy(farm,'coop','',Date.now());
 assert.equal(next.coop,1);assert.equal(transactFriendsWallet({delta:next.coins-farm.coins,commit:()=>{}},w).balance,480);
});
test('invalid amounts never change inventory or funds',()=>{
 const w=setup();for(const delta of [NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER])assert.equal(transactFriendsWallet({delta,commit:()=>assert.fail()},w).ok,false);
 assert.equal(w.balance(),20);
});
