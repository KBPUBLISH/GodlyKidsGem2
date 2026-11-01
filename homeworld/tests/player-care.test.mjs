import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,applyAction} from '../src/core.mjs';
import {farmFresh} from '../src/living-farm-rules.mjs';
import {hungerFor} from '../src/nutrition.mjs';

const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
function hungry(){
  const s=initialState(world);s.clock.paused=true;s.activeCharacter='you';
  s.characters.you={name:'Mikey',energy:5,hunger:10,hungerAt:0};
  s.livingFarm=farmFresh();s.livingFarm.bag.egg=2;s.livingFarm.bag.milk=2;s.inventory.carrot=2;s.inventory.lettuce=1;
  return s;
}
test('a farm snack restores the child and consumes exactly one item atomically',()=>{
  const s=hungry(),action={type:'eat',item:'milk',source:'farm',actionId:'farm-snack'};
  const next=applyAction(s,action,world,0);
  assert.equal(next.characters.you.energy,30);assert.equal(hungerFor(next,0),48);
  assert.equal(next.livingFarm.bag.milk,1);assert.equal(s.livingFarm.bag.milk,2);
  assert.deepEqual(next.characters.adam,s.characters.adam);assert.deepEqual(next.inventory,s.inventory);
  assert.equal(applyAction(next,action,world,0),next);
});
test('harvested vegetables and a free breather work at zero energy',()=>{
  const s=hungry();s.characters.you.energy=0;
  for(const item of ['carrot','lettuce']){
    const next=applyAction(s,{type:'eat',item,actionId:item},world,0);
    assert.equal(next.inventory[item],s.inventory[item]-1);assert.ok(next.characters.you.energy>0);assert.ok(hungerFor(next,0)>10);
  }
  const rested=applyAction(s,{type:'rest',actionId:'breather'},world,0);
  assert.equal(rested.characters.you.energy,20);assert.equal(hungerFor(rested,0),10);
});
test('full, unavailable and invalid-source meals do not consume food',()=>{
  const s=hungry();s.characters.you.energy=100;s.characters.you.hunger=100;
  assert.equal(applyAction(s,{type:'eat',item:'milk',source:'farm',actionId:'full'},world,0),s);
  s.characters.you.energy=5;s.livingFarm.bag.milk=0;
  for(const [item,source] of [['milk','farm'],['carrot','farm'],['egg','invalid']])assert.equal(applyAction(s,{type:'eat',item,source,actionId:item+source},world,0),s);
});
