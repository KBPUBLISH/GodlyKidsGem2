import test from 'node:test';
import assert from 'node:assert/strict';
import {FOODS} from '../src/nutrition.mjs';
import {RECIPES,combine,partEnergy,canMake,pickRecipe,missingLine} from '../src/recipes.mjs';

test('every recipe is two real ingredients and restores more energy than both bites together',()=>{
  assert.ok(RECIPES.length>=8);
  const ids=new Set();
  for(const recipe of RECIPES){
    assert.equal(ids.has(recipe.id),false,recipe.id);
    ids.add(recipe.id);
    const parts=Object.entries(recipe.needs);
    assert.equal(parts.length,2,recipe.id);
    const bite=parts.reduce((n,[id,count])=>n+partEnergy(id)*count,0);
    const fromFoods=parts.reduce((n,[id,count])=>n+(FOODS[id]?.energy||0)*count,0);
    assert.ok(bite>0,`${recipe.id} ingredients should be worth something`);
    assert.ok(recipe.energy>bite,`${recipe.id} energy ${recipe.energy} should beat ${bite}`);
    assert.ok(recipe.energy>fromFoods,`${recipe.id} should beat the energy eating the parts gives today`);
    for(const [id] of parts)assert.ok(recipe.energy>partEnergy(id),`${recipe.id} should beat eating ${id} alone`);
    const made=Object.keys(recipe.makes);
    assert.equal(made.length,1);
    assert.equal(FOODS[made[0]]?.energy,recipe.energy,`${made[0]} should restore the recipe energy from the bag`);
  }
});

test('combine spends the two ingredients, adds the snack, and does not mutate the bag',()=>{
  const stocks={wheat_seed:2,sunflower_seed:1,carrot:3,pumpkin_seed:1};
  const before=structuredClone(stocks);
  const next=combine(stocks,'seed_crackers');
  assert.deepEqual(stocks,before);
  assert.notEqual(next,stocks);
  assert.equal(next.seed_crackers,1);
  assert.equal(next.wheat_seed,1);
  assert.equal(next.sunflower_seed,undefined);
  assert.equal(next.carrot,3);
  assert.equal(canMake(next,RECIPES.find(r=>r.id==='seed_crackers')),false);
  const held=combine(next,'seed_crackers');
  assert.equal(held.seed_crackers,1);
  assert.equal(held.wheat_seed,1);
  const unknown=combine(stocks,'not_a_recipe');
  assert.deepEqual(unknown,stocks);
  assert.notEqual(unknown,stocks);
});

test('combine makes a garden salad from carrot and lettuce',()=>{
  const next=combine({carrot:1,lettuce:2,wheat_seed:4},'garden_salad');
  assert.equal(next.garden_salad,1);
  assert.equal(next.carrot,undefined);
  assert.equal(next.lettuce,1);
  assert.equal(next.wheat_seed,4);
});

test('a fresh seed bag becomes seed crackers, the strongest snack those seeds can make',()=>{
  const stocks={wheat_seed:6,sunflower_seed:6,pumpkin_seed:6,pine_seed:3,oak_acorn:3,coconut:3};
  assert.equal(pickRecipe(stocks)?.id,'seed_crackers');
});

test('recognizable recipes use real bag items and report only missing ingredients',()=>{
  const expected=['Sunflower bread','Pumpkin soup','Pumpkin pie','Apple pie','Carrot cake'];
  for(const name of expected)assert.ok(RECIPES.some(recipe=>recipe.name===name),name);
  assert.equal(RECIPES.some(recipe=>recipe.id==='carrot_bites'),false);
  assert.equal(missingLine({apple:1},RECIPES.find(recipe=>recipe.id==='apple_pie')),'1 wheat');
  assert.equal(missingLine({apple:1,wheat:1},RECIPES.find(recipe=>recipe.id==='apple_pie')),'');
});

test('combine makes apple pie immediately from an apple and wheat',()=>{
  const next=combine({apple:2,wheat:1,pumpkin:3},'apple_pie');
  assert.equal(next.apple_pie,1);
  assert.equal(next.apple,1);
  assert.equal(next.wheat,undefined);
  assert.equal(next.pumpkin,3);
});
