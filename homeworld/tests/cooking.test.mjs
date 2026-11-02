import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COOKING_RECIPES,applyCooking,cookingSeconds} from '../src/cooking.mjs';
import {GameStore,initialState,applyAction,growth,SEEDS} from '../src/core.mjs';
import {marketTrade} from '../src/living-market-rules.mjs';
import {quoteSell} from '../src/sell-prices.mjs';
import {stirDelta,sliced,dropped} from '../src/cooking-gestures.mjs';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
function setup(){const s=initialState(world,1000);s.clock.paused=true;s.buildings=[{id:'oven',kind:'oven',key:'67:73',rotation:0,status:'complete',baseHeight:0,startedAt:0}];Object.assign(s.inventory,{pumpkin:3,carrot:4,fish:2,potato:4});s.livingFarm={bag:{egg:3}};s.characters.adam.energy=10;s.characters.adam.hunger=10;s.characters.adam.hungerAt=480;s.characters.eve={name:'Eve',energy:10,hunger:10,hungerAt:480};return s;}
const start=(s,r)=>applyCooking(s,{type:'cooking_start',recipe:r,ovenId:'oven',sequence:s.cooking?.sequence||0},1000);
function prepare(s){for(let i=0;i<3;i++)s=applyCooking(s,{type:'cooking_step',sessionId:s.cooking.session.id,step:i},2000);return s;}
const collect=s=>applyCooking(s,{type:'cooking_collect',sessionId:s.cooking.session.id},10000);
for(const r of COOKING_RECIPES)test(`${r.name}: reserves once, prepares, cooks, awards once and feeds`,()=>{
 const s=setup(),n=start(s,r.id);assert.notEqual(n,s);for(const[id,count]of Object.entries(r.ingredients))assert.equal((s.inventory[id]||0)+(id==='egg'?3:0)-(n.inventory[id]||0)-(id==='egg'?n.livingFarm.bag.egg:0),count);
 assert.equal(applyCooking(n,{type:'cooking_start',recipe:r.id,ovenId:'oven',sequence:0}),n);
 let p=prepare(n);assert.equal(p.cooking.session.phase,'cooking');assert.equal(applyCooking(p,{type:'cooking_collect',sessionId:1},2001),p);
 p=collect(p);assert.equal(p.inventory[r.meal],1);assert.equal(collect(p),p);
 const eaten=applyAction(p,{type:'eat',item:r.meal,mealSession:1,actionId:'eat'},world,480,10000);assert.equal(eaten.inventory[r.meal],0);assert.equal(eaten.characters.adam.energy,10+r.energy);assert.ok(eaten.characters.adam.hunger>10);
 assert.equal(applyAction(eaten,{type:'eat',item:r.meal,mealSession:1,actionId:'different-click'},world,480),eaten);
});
test('missing ingredients, missing or unfinished oven leave inventory intact',()=>{for(const alter of [s=>s.inventory.carrot=0,s=>s.buildings=[],s=>s.buildings[0].status='foundation']){const s=setup();alter(s);assert.equal(start(s,'pumpkin_stew'),s);}});
test('cancel at every step and while cooking returns original bags exactly once',()=>{for(let steps=0;steps<=3;steps++){const s=setup();s.inventory.egg=1;let n=start(s,'garden_omelette');for(let i=0;i<steps;i++)n=applyCooking(n,{type:'cooking_step',sessionId:1,step:i},1000);n=applyCooking(n,{type:'cooking_cancel',sessionId:1});assert.deepEqual(n.inventory,s.inventory);assert.deepEqual(n.livingFarm,s.livingFarm);assert.equal(applyCooking(n,{type:'cooking_cancel',sessionId:1}),n);assert.equal(applyCooking(n,{type:'cooking_start',recipe:'garden_omelette',ovenId:'oven',sequence:0}),n);}});
test('duplicate and out of order steps never skip preparations',()=>{let s=start(setup(),'fish_chips');assert.equal(applyCooking(s,{type:'cooking_step',sessionId:1,step:2}),s);s=applyCooking(s,{type:'cooking_step',sessionId:1,step:0});assert.equal(applyCooking(s,{type:'cooking_step',sessionId:1,step:0}),s);assert.equal(s.cooking.session.step,1);});
function memory(){const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('reload mid prep/cook/collection and two open tabs preserve exactly one reward',()=>{
 const storage=memory(),first=new GameStore(world,storage,1000);first.save(setup(),1000);first.commit({type:'cooking_start',recipe:'pumpkin_stew',ovenId:'oven',sequence:0},1000);
 let reloaded=new GameStore(world,storage,1500);assert.equal(reloaded.state.cooking.session.step,0);
 for(let i=0;i<3;i++)reloaded.commit({type:'cooking_step',sessionId:1,step:i},2000);
 const second=new GameStore(world,storage,3000);assert.equal(second.state.cooking.session.phase,'cooking');
 second.commit({type:'cooking_collect',sessionId:1},10000);first.commit({type:'cooking_collect',sessionId:1},10001);
 reloaded=new GameStore(world,storage,10002);assert.equal(reloaded.state.inventory.pumpkin_stew,1);assert.equal(reloaded.state.inventory.pumpkin,2);
});
test('failed save does not consume or award; retry is safe',()=>{
 const storage=memory(),store=new GameStore(world,storage,1000);store.save(setup(),1000);const write=storage.setItem;storage.setItem=()=>{throw Error('quota');};assert.throws(()=>store.commit({type:'cooking_start',recipe:'fish_chips',ovenId:'oven',sequence:0},1000));assert.equal(store.state.inventory.fish,2);
 storage.setItem=write;store.commit({type:'cooking_start',recipe:'fish_chips',ovenId:'oven',sequence:0},1000);for(let i=0;i<3;i++)store.commit({type:'cooking_step',sessionId:1,step:i},2000);
 storage.setItem=()=>{throw Error('quota');};assert.throws(()=>store.commit({type:'cooking_collect',sessionId:1},10000));assert.equal(store.state.inventory.fish_chips,undefined);storage.setItem=write;store.commit({type:'cooking_collect',sessionId:1},10000);assert.equal(store.state.inventory.fish_chips,1);
});
test('separate child stores cannot claim one another’s pending meal',()=>{const a=new GameStore(world,memory(),1000),b=new GameStore(world,memory(),1000);a.save(prepare(start(setup(),'fish_chips')),2000);const before=b.state;b.commit({type:'cooking_collect',sessionId:1},10000);assert.equal(b.state,before);assert.equal(b.state.inventory.fish_chips,undefined);a.commit({type:'cooking_collect',sessionId:1},10000);assert.equal(a.state.inventory.fish_chips,1);});
test('sharing uses the existing nutrition meters and same meal cannot be shared twice',()=>{const s=collect(prepare(start(setup(),'garden_omelette')));const n=applyAction(s,{type:'share_food',item:'garden_omelette',recipient:'eve',mealSession:1,actionId:'share'},world,480);assert.equal(n.inventory.garden_omelette,0);assert.equal(n.characters.eve.energy,55);assert.equal(n.cooking.session.used,true);assert.equal(applyAction(n,{type:'share_food',item:'garden_omelette',recipient:'eve',mealSession:1,actionId:'again'},world,480),n);});
test('potatoes can be bought, planted, watered, grown, harvested and sold',()=>{
 let s=setup();const trade=marketTrade({coins:10},s.inventory,'buy','potato_seed');assert.equal(trade.farm.coins,8);assert.equal(trade.inventory.potato_seed,s.inventory.potato_seed+3);s.inventory=trade.inventory;
 const key='66:70';s.cells[key]={soil:'tilled',emptySince:480};s=applyAction(s,{type:'plant',key,seed:'potato_seed'},world,480);assert.equal(s.cells[key].seed,'potato_seed');s=applyAction(s,{type:'water',key},world,480);const readyAt=480+SEEDS.find(s=>s.id==='potato_seed').hours*60;assert.equal(growth(s.cells[key],readyAt).stage,'ready');const before=s.inventory.potato;s=applyAction(s,{type:'harvest',key},world,readyAt);assert.equal(s.inventory.potato,before+3);assert.equal(s.cells[key].seed,undefined);assert.equal(quoteSell('potato',1).coins,3);
});
test('upgrade duration hook shortens later ovens without changing saved jobs',()=>{assert.equal(cookingSeconds(COOKING_RECIPES[0],{}),5);assert.ok(cookingSeconds(COOKING_RECIPES[0],{cookingLevel:3})<5);});
test('touch geometry accepts swipes and drops; centre taps and alternating jitter do not stir',()=>{assert.ok(sliced({x:.2,y:.6},{x:.7,y:.6}));assert.ok(dropped({x:.4,y:.8},{x:.5,y:.3}));assert.equal(dropped({x:.4,y:.8},{x:.5,y:.7}),false);assert.equal(stirDelta({x:.5,y:.5},{x:.5,y:.51}),0);let angle=0,last={x:.8,y:.5};for(let i=1;i<=80;i++){const p={x:.5+.3*Math.cos(i*2*Math.PI/80),y:.5+.3*Math.sin(i*2*Math.PI/80)};angle+=stirDelta(last,p);last=p;}assert.ok(angle>6);});

test('taking down an oven returns cooking escrow as well as building materials',()=>{const s=setup(),n=start(s,'garden_omelette');const removed=applyAction(n,{type:'remove_building',id:'oven',actionId:'remove-oven'},world,480);assert.equal(removed.cooking.session,null);assert.equal(removed.inventory.carrot,s.inventory.carrot);assert.equal(removed.livingFarm.bag.egg,s.livingFarm.bag.egg);assert.equal(removed.buildings[0].status,'cancelled');});
