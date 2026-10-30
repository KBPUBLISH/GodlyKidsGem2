import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FARM_PRICES,STABLE_CAPACITY,MAX_REQUEST_QTY,PADDOCK_CELLS_PER_ANIMAL,PADDOCK_MIN,FARM_BUILDINGS,
  paddockPlan,ringKeys,rectKeys,fenceGaps,nextFenceKey,parseKey,
  herdCount,herdCapacity,roomFor,allowedQty,bundlePrice,nextRequest,farmStatus,ensureRanch,
  pickNames,joinNames,arrivalLine,dailyProduce,requestLine,upsertRequest,closeRequest,openRequests,canAsk,nextMorning,
} from '../src/farm-rules.mjs';

const stable={col:10,row:10,w:3,h:2};
const fence=(k)=>({id:`f:${k}`,kind:'fence',key:k,status:'complete'});
const state=(over={})=>({buildings:[{id:'st',kind:'stable',key:'10:10',rotation:0,status:'complete'}],animals:[],farm:{},inventory:{},stats:{},...over});

test('paddockPlan wraps the stable with a one-cell margin and sizes the pasture to the herd',()=>{
  const plan=paddockPlan([stable],4);
  assert.ok(plan.ok);
  assert.equal(plan.side,'down');
  // interior starts one cell left of the stable, flush with its back wall, and is two wider than it
  assert.deepEqual([plan.interior.col,plan.interior.row,plan.interior.w],[9,10,5]);
  const need=stable.w*stable.h+Math.max(PADDOCK_MIN,4*PADDOCK_CELLS_PER_ANIMAL);
  assert.ok(plan.interior.w*plan.interior.h>=need,'enough cells for the herd');
  // ring never overlaps the interior or the stable
  const inside=new Set(rectKeys(plan.interior));
  for(const k of plan.ring)assert.ok(!inside.has(k),`ring cell ${k} is outside`);
  assert.equal(plan.ring.length,ringKeys(plan.interior).length);
  // gate sits on the ring opposite the stable
  assert.ok(plan.ring.includes(plan.gate));
  assert.equal(parseKey(plan.gate)[1],plan.interior.row+plan.interior.h);
  // inside excludes the stable cells
  assert.ok(!plan.inside.includes('10:10'));
  assert.equal(plan.inside.length,plan.interior.w*plan.interior.h-stable.w*stable.h);
});

test('paddockPlan grows with capacity and picks the side with no blockers, nearest the village',()=>{
  const small=paddockPlan([stable],4),big=paddockPlan([stable],8);
  assert.ok(big.interior.w*big.interior.h>small.interior.w*small.interior.h);
  // everything below row 12 is water: the plan must flip to another side
  const plan=paddockPlan([stable],4,{cellOk:k=>parseKey(k)[1]<13,ringOk:k=>parseKey(k)[1]<13,toward:{col:11.5,row:0}});
  assert.ok(plan.ok);
  assert.equal(plan.side,'up');
  // and with a blocker everywhere the least-blocked option is reported, not hidden
  const blocked=paddockPlan([stable],4,{ringOk:k=>parseKey(k)[0]!==9});
  assert.equal(blocked.ok,false);
  assert.ok(blocked.blocked.length>0);
  assert.ok(blocked.blocked.every(b=>b.where==='ring'&&parseKey(b.key)[0]===9));
});

test('fence build order leaves the gate for last and reports gaps',()=>{
  const plan=paddockPlan([stable],4);
  assert.equal(fenceGaps(plan,[]).length,plan.ring.length);
  const first=nextFenceKey(plan,[]);
  assert.notEqual(first,plan.gate);
  const allButGate=plan.ring.filter(k=>k!==plan.gate).map(fence);
  assert.deepEqual(fenceGaps(plan,allButGate),[plan.gate]);
  assert.equal(nextFenceKey(plan,allButGate),plan.gate);
  assert.equal(nextFenceKey(plan,[...allButGate,fence(plan.gate)]),null);
  // brick fences count as fence too
  assert.deepEqual(fenceGaps(plan,[...allButGate,{id:'b',kind:'brick_fence',key:plan.gate,status:'complete'}]),[]);
});

test('prices and capacity: bundles, stable room, request cap',()=>{
  assert.equal(bundlePrice('chicken',2),FARM_PRICES.chicken*2);
  assert.equal(bundlePrice('unicorn',1),null);
  assert.ok(FARM_PRICES.chicken<FARM_PRICES.sheep&&FARM_PRICES.sheep<FARM_PRICES.goat&&FARM_PRICES.goat<FARM_PRICES.cow);
  const s=state();
  assert.equal(herdCapacity(s),STABLE_CAPACITY);
  assert.equal(roomFor(s),STABLE_CAPACITY);
  assert.equal(allowedQty(s,5),MAX_REQUEST_QTY);
  const three=state({animals:[{id:'a',kind:'chicken'},{id:'b',kind:'sheep'},{id:'c',kind:'goat'},{id:'w',kind:'deer',wild:true}]});
  assert.equal(herdCount(three),3,'wild animals do not take stable room');
  assert.equal(allowedQty(three,2),1);
  const full=state({animals:['a','b','c','d'].map(id=>({id,kind:'chicken'}))});
  assert.equal(allowedQty(full,1),0);
  assert.equal(nextRequest(full),null);
  assert.equal(nextRequest(state({buildings:[]})),null,'no stable, no room');
});

test('nextRequest climbs the ladder: chickens first, then a sheep, capped by room',()=>{
  assert.deepEqual(nextRequest(state()),{kind:'chicken',qty:2,price:120});
  const two=state({animals:[{id:'a',kind:'chicken'},{id:'b',kind:'chicken'}]});
  assert.deepEqual(nextRequest(two),{kind:'sheep',qty:1,price:150});
  const nearlyFull=state({animals:[{id:'a',kind:'sheep'},{id:'b',kind:'cow'},{id:'c',kind:'goat'}]});
  assert.deepEqual(nextRequest(nearlyFull),{kind:'chicken',qty:1,price:60},'one spot left → one chicken');
  assert.match(requestLine('chicken',2,{herd:0,fenced:true}),/paddock is ready.*two chickens/);
  assert.match(requestLine('chicken',2,{herd:0,fenced:false}),/stable is up.*two chickens/);
});

test('Adam asks as soon as a stable with room stands, and "Not now" waits for the next island morning',()=>{
  const plan=paddockPlan([stable],4);
  assert.equal(canAsk(farmStatus(state({buildings:[]}),null)),false,'no stable → no ask');
  const st=farmStatus(state(),plan);
  assert.equal(st.fenced,false);
  assert.equal(canAsk(st),true,'stable up, fence still open → ask');
  const full=state({animals:['a','b','c','d'].map(id=>({id,kind:'chicken'}))});
  assert.equal(canAsk(farmStatus(full,plan)),false);
  // 07:00 is minute 420 of each day; declining at 10:00 on day 2 waits for 07:00 on day 3
  assert.equal(nextMorning(1440+600),2*1440+420);
  assert.equal(nextMorning(1440+419),1440+420,'just before dawn → that same dawn');
  assert.ok(nextMorning(1000)>1000);
});

test('farmStatus is ready only with fence, trough, feed pile, stock and room',()=>{
  const plan=paddockPlan([stable],4);
  let s=state();
  let st=farmStatus(s,plan);
  assert.equal(st.ready,false);
  assert.equal(st.waiting.id,'fence');
  s=state({buildings:[...s.buildings,...plan.ring.map(fence),{id:'t',kind:'trough',key:'9:12',rotation:0,status:'complete'},{id:'p',kind:'feed_pile',key:'12:12',rotation:0,status:'complete'}]});
  st=farmStatus(s,plan);
  assert.equal(st.fenced,true);
  assert.equal(st.waiting.id,'stocked');
  s.farm={ranch:{feed:3,water:2}};
  st=farmStatus(s,plan);
  assert.equal(st.ready,true);
  assert.equal(st.room,4);
  const full={...s,animals:['a','b','c','d'].map(id=>({id,kind:'chicken'}))};
  assert.equal(farmStatus(full,plan).ready,false);
  assert.match(farmStatus(full,plan).reason,/full/);
});

test('names are silly, unique and deterministic; arrival line reads well',()=>{
  const a=pickNames('chicken',2,[],7),b=pickNames('chicken',2,[],7);
  assert.deepEqual(a,b);
  assert.equal(new Set(a).size,2);
  const more=pickNames('chicken',3,a,7);
  for(const n of more)assert.ok(!a.includes(n));
  assert.equal(joinNames(['Pip','Dot','Nugget']),'Pip, Dot and Nugget');
  assert.match(arrivalLine('chicken',['Pip','Dot']),/Pip and Dot/);
  assert.match(arrivalLine('cow',['Buttercup']),/Buttercup/);
});

test('dailyProduce only after yesterday feed + water; eggs and milk count as food, wool does not',()=>{
  const herd=[{id:'h1',kind:'chicken'},{id:'h2',kind:'chicken'},{id:'c1',kind:'cow'}];
  const unfed=state({animals:herd,farm:{ranch:{fedDay:3,wateredDay:2}}});
  assert.equal(dailyProduce(unfed,4).food,0);
  const fed=state({animals:herd,farm:{ranch:{fedDay:3,wateredDay:3}}});
  const out=dailyProduce(fed,4);
  assert.equal(out.items.egg,2);
  assert.equal(out.items.milk,1);
  assert.equal(out.food,3);
  assert.ok(out.lines.length>=2);
  // a sheep gives wool now and then, never food
  const sheep=state({animals:Array.from({length:12},(_,i)=>({id:`s${i}`,kind:'sheep'})),farm:{ranch:{fedDay:3,wateredDay:3}}});
  const wool=dailyProduce(sheep,4);
  assert.equal(wool.food,0);
  assert.ok((wool.items.wool||0)>0);
});

test('request board: upsert, close, open list; ranch defaults',()=>{
  let v=upsertRequest({},{id:'r1',kind:'animals',from:'adam',to:'player',text:'Two chickens?'});
  v=upsertRequest(v,{id:'r2',kind:'fence',from:'adam',to:'adam',text:'Fence'});
  assert.equal(openRequests(v).length,2);
  assert.equal(openRequests(v,'adam').length,2);
  v=closeRequest(v,'r1','done');
  assert.equal(openRequests(v).length,1);
  assert.equal(v.requests.find(r=>r.id==='r1').status,'done');
  assert.deepEqual(closeRequest({other:1},'nope'),{other:1});
  const r=ensureRanch(undefined);
  assert.equal(r.feed,0);assert.deepEqual(r.names,{});assert.equal(r.request,null);
  assert.ok(FARM_BUILDINGS.every(b=>b.instant&&b.size.length===2));
});
