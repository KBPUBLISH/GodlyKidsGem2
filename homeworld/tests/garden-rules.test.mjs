import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, initialState} from '../src/core.mjs';
import {gardenStatus, deriveRequests, planNextPlots, ringTiles, boundsOf, clusters, maskTiles, maskSize, SHAPES, SHAPE_IDS, seedForCell, outsideFence, blockTiles, FENCE_BEFORE_PLOTS, RULES} from '../src/garden-rules.mjs';
import {farmNightfall, lineShielded, THREAT_DAY} from '../src/fencing.mjs';

function flatWorld(columns=30, rows=30){
  const mask=Array(columns*rows).fill(2);
  const heights=Array((columns+1)*(rows+1)).fill(0);
  return {id:'flat', grid:{origin:[0,0], columns, rows, mask, heights}, gardenSlots:[], blockers:[], seeds:[], trees:[], boulders:[], heroStart:[2.5,2.5], fishingSpots:[]};
}
const world=flatWorld();
const DAY_MIN=8*1440+9*60; // day 8, 9 AM: coyotes are about (THREAT_DAY=7)
function ready(){
  const state=initialState(world, 1_000);
  state.inventory.oak_wood=40;state.inventory.stone=6;state.inventory.wheat=4;
  state.player={x:2.5,y:2.5};
  state.clock={...state.clock,minutes:DAY_MIN,paused:true};
  return state;
}
/** Till a w×h rectangle of soil with its south-west corner at col/row, planting wheat in each plot. */
function garden(state, col, row, w, h, seed='wheat_seed'){
  for(let r=0;r<h;r++)for(let c=0;c<w;c++)state.cells[`${col+c}:${row+r}`]={soil:'tilled',seed,plantedAt:DAY_MIN-600,wateredAt:DAY_MIN-600};
  return state;
}
function fence(state, key, kind='fence'){
  return applyAction(state, {type:'place_building', id:`f:${key}`, kind, key, rotation:0, stroke:true, actionId:`place:${key}`}, world, DAY_MIN);
}

test('bounds, clusters and the perimeter ring of a rectangle garden', ()=>{
  const keys=['10:10','11:10','12:10','10:11','11:11','12:11'];
  const b=boundsOf(keys);
  assert.deepEqual([b.c0,b.c1,b.r0,b.r1,b.w,b.h],[10,12,10,11,3,2]);
  assert.equal(clusters(keys).length,1);
  assert.equal(clusters([...keys,'20:20']).length,2);
  const ring=ringTiles(b);
  assert.equal(ring.length,(3+2)*2+4);
  assert.equal(ring.filter(t=>t.corner).length,4);
  assert.deepEqual(ring.find(t=>t.key==='11:12').side,'north');
  assert.deepEqual(ring.find(t=>t.key==='11:9').side,'south');
  assert.deepEqual(ring.find(t=>t.key==='13:10').side,'east');
  assert.deepEqual(ring.find(t=>t.key==='9:11').side,'west');
});

test('gardenStatus: an open garden is exposed; fences close sides and raise fencedPct', ()=>{
  let s=garden(ready(),10,10,4,4);
  let st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.plots,16);
  assert.equal(st.footprint.w,4);
  assert.equal(st.footprint.h,4);
  assert.equal(st.perimeter,20);
  assert.equal(st.scarecrowCoverage.uncovered,16);
  assert.equal(st.fencedPct,0);
  assert.equal(st.gaps.length,20-1); // every ring tile but the planned gate is a gap
  assert.equal(st.gaps.filter(t=>!t.corner).length,16-1);
  assert.deepEqual(st.exposure.coyote.sort(),['east','west']);
  assert.equal(st.threatLevel,'medium');
  assert.ok(st.upgradesAvailable.some(u=>u.id==='scarecrow'));
  // Fence the west side fully
  for(let r=10;r<14;r++)s=fence(s,`9:${r}`);
  st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.gapsBySide.west,0);
  assert.equal(st.gapsBySide.east,4);
  assert.ok(st.fencedPct>0&&st.fencedPct<100);
});

test('requests: open sides first, attacked side on top, then posts, gate, scarecrow; wood shortage asks for chopping', ()=>{
  let s=garden(ready(),10,10,4,4);
  s.village={garden:{attacks:[{day:8,kind:'coyote',sides:['east'],ate:2}]}};
  const st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.recentAttack.kind,'coyote');
  assert.equal(st.threatLevel,'high');
  const req=deriveRequests(st,s,world);
  assert.equal(req[0].kind,'fence');
  assert.equal(req[0].side,'east');
  assert.match(req[0].reason,/Coyotes got in last night/);
  assert.ok(req.every(r=>typeof r.reason==='string'&&r.reason.length>10),'every request carries a kid-readable reason');
  assert.ok(req.some(r=>r.kind==='scarecrow'));
  // Fence requests total 16 pieces = 32 wood, we have 40 — no wood ask. Make us poor:
  s.inventory.oak_wood=4;
  const poor=deriveRequests(gardenStatus(s,world,{minutes:DAY_MIN}),s,world);
  assert.ok(poor.some(r=>r.kind==='wood'),'short of wood → a chop request');
  assert.ok(poor.some(r=>r.kind==='fence'&&r.side==='east'),'the fence request waits while the wood is chopped');
});

test('brick upgrade only after an attack, and only when stone is on hand', ()=>{
  let s=garden(ready(),10,10,4,4);
  for(let r=10;r<14;r++)s=fence(s,`9:${r}`);
  s.inventory.concrete_brick=20;
  s.inventory.stone=0;
  s.village={garden:{attacks:[{day:8,kind:'coyote',sides:['east'],ate:1}]}};
  let st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.upgradesAvailable.some(u=>u.id==='brick_fence'),false,'no stone → no brick upgrade');
  s.inventory.stone=4;
  s.village={garden:{}};
  st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.upgradesAvailable.some(u=>u.id==='brick_fence'),false,'no attack → no brick upgrade');
  assert.equal(deriveRequests(st,s,world).find(r=>r.side==='east').kind,'fence');
  s.village={garden:{attacks:[{day:8,kind:'coyote',sides:['east'],ate:1}]}};
  st=gardenStatus(s,world,{minutes:DAY_MIN});
  const up=st.upgradesAvailable.find(u=>u.id==='brick_fence');
  assert.ok(up&&/stone/i.test(up.why)&&/coyote/i.test(up.why));
  const east=deriveRequests(st,s,world).find(r=>r.side==='east');
  assert.equal(east.kind,'brick_fence');
  assert.match(east.reason,/Coyotes got in last night/);
});

test('a full ring (with a gate stone between posts) reaches 100% and shields the coyote line', ()=>{
  let s=garden(ready(),10,10,4,4);
  // Ring around 10..13 × 10..13: tiles with col 9 or 14, row 9 or 14.
  const gateKey='14:11';
  for(let c=9;c<=14;c++)for(let r=9;r<=14;r++){
    const edge=c===9||c===14||r===9||r===14;if(!edge)continue;
    const key=`${c}:${r}`;if(key===gateKey)continue;
    s=fence(s,key);
  }
  let st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.gaps.length,0);
  assert.equal(st.gate?.key,gateKey);
  assert.ok(st.fencedPct>=95);
  // Gate stone
  s=applyAction(s,{type:'place_building',id:'gate',kind:'path',key:gateKey,rotation:0,actionId:'gate'},world,DAY_MIN);
  s.buildings.find(b=>b.id==='gate').status='complete';
  st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(st.fencedPct,100);
  assert.equal(st.gate.built,true);
  assert.deepEqual(st.exposure.coyote,[]);
  assert.equal(st.exposure.openPlots,0);
  assert.equal(lineShielded(world,s,{x:29.5,y:11.5},{x:11.5,y:11.5}),true);
  const req=deriveRequests(st,s,world);
  assert.ok(!req.some(r=>r.kind==='fence'||r.kind==='gate'),'nothing left to fence');
});

test('layout plan: full rows while small, fence required past FENCE_BEFORE_PLOTS, then a block one walkway away', ()=>{
  let s=garden(ready(),10,10,3,3);
  let plan=planNextPlots(s,world,gardenStatus(s,world,{minutes:DAY_MIN}),'rectangle',DAY_MIN);
  assert.equal(plan.blocked,null);
  assert.equal(plan.tiles.length,3,'a whole row or column at a time');
  const rows=new Set(plan.tiles.map(t=>t.key.split(':')[1])),cols=new Set(plan.tiles.map(t=>t.key.split(':')[0]));
  assert.ok(rows.size===1||cols.size===1,'tiles line up');
  s=garden(ready(),10,10,4,4);
  assert.equal(FENCE_BEFORE_PLOTS,16);
  plan=planNextPlots(s,world,gardenStatus(s,world,{minutes:DAY_MIN}),'rectangle',DAY_MIN);
  assert.match(plan.blocked,/fence/i);
  // Fully fenced → a new rectangle block, separated by a walkway tile, no overlap with the ring
  for(let c=9;c<=14;c++)for(let r=9;r<=14;r++){if(c===9||c===14||r===9||r===14)s=fence(s,`${c}:${r}`);}
  const st=gardenStatus(s,world,{minutes:DAY_MIN});
  plan=planNextPlots(s,world,st,'rectangle',DAY_MIN);
  assert.equal(plan.blocked,null);
  assert.ok(plan.block);
  assert.equal(plan.tiles.length,16);
  const ringKeys=new Set(s.buildings.map(b=>b.key));
  assert.ok(plan.tiles.every(t=>!ringKeys.has(t.key)&&!s.cells[t.key]));
  const b=plan.block;
  assert.ok(b.col===15||b.col+b.w-1===8||b.row===15||b.row+b.h-1===8,'the old fence line becomes the walkway between the blocks');
  // Till the block: it joins the garden, the old fence pieces between the blocks are "inner" and must move out.
  for(const t of plan.tiles)s.cells[t.key]={soil:'tilled'};
  const grown=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(grown.clusters.length,1,'one garden, not two');
  assert.equal(grown.plots,32);
  assert.equal(grown.primary.inner.length,4);
  const req=deriveRequests(grown,s,world);
  assert.ok(req.some(r=>r.kind==='unfence'&&r.tiles.length===4));
  assert.ok(req.some(r=>r.kind==='fence'),'the new outside needs fencing');
  assert.equal(req[0].kind,'fence','safety before tidying');
});

test('shape masks are symmetric pictures with crops that read from above', ()=>{
  assert.deepEqual(SHAPE_IDS,['rectangle','heart','smiley']);
  for(const id of ['heart','smiley']){
    const s=SHAPES[id],size=maskSize(id);
    assert.ok(s.mask.every(row=>row.length===size.w),'rectangular mask');
    for(const row of s.mask)assert.equal(row,[...row].reverse().join(''),`${id} row "${row}" mirrors left-right`);
    const tiles=maskTiles(id);
    assert.ok(tiles.length>=SHAPES[id].mask.length*2);
    assert.ok(tiles.every(t=>t.dc>=0&&t.dc<size.w&&t.dr>=0&&t.dr<size.h));
  }
  assert.equal(SHAPES.heart.fill,'pumpkin_seed');
  assert.ok(maskTiles('smiley').some(t=>t.role==='feature'),'the smiley has eyes and a mouth');
  // Heart: top row has two bumps (a gap in the middle), bottom row a single point
  assert.equal(SHAPES.heart.mask[0],'.##.##.');
  assert.equal(SHAPES.heart.mask.at(-1),'...#...');
  // Block tiles carry the seed Eve should plant
  const tiles=blockTiles({col:20,row:20,shape:'smiley'});
  assert.ok(tiles.some(t=>t.seed==='pumpkin_seed')&&tiles.some(t=>t.seed==='wheat_seed'));
  const s={village:{garden:{block:{col:20,row:20,shape:'smiley'}}}};
  const eye=tiles.find(t=>t.role==='feature');
  assert.equal(seedForCell(s,eye.key,['wheat_seed','pumpkin_seed']),'pumpkin_seed');
  assert.equal(seedForCell(s,eye.key,['wheat_seed','carrot_seed']),'carrot_seed','same colour family when pumpkins are out');
});

test('Eve stays inside a closed ring: outsideFence', ()=>{
  let s=garden(ready(),10,10,4,4);
  for(let c=9;c<=14;c++)for(let r=9;r<=14;r++){if(c===9||c===14||r===9||r===14)s=fence(s,`${c}:${r}`);}
  const st=gardenStatus(s,world,{minutes:DAY_MIN});
  assert.equal(outsideFence(st,'11:11'),false);
  assert.equal(outsideFence(st,'20:20'),true);
  const open=gardenStatus(garden(ready(),10,10,4,4),world,{minutes:DAY_MIN});
  assert.equal(outsideFence(open,'20:20'),false,'no ring yet → anywhere is fine');
});

test('nightfall records the attack for the keeper; a fence takes the hit instead of the crops', ()=>{
  const day=THREAT_DAY+1;
  let open=garden(ready(),10,10,4,4);
  open.farm={...(open.farm||{}),guard:null};
  const raided=farmNightfall(open,world,day);
  assert.equal(raided.farm.lastAttack?.kind,'coyote');
  assert.ok(raided.farm.lastAttack.ate>0);
  assert.ok(raided.farm.lastAttack.sides.length>0);
  let fenced=garden(ready(),10,10,4,4);
  for(let c=9;c<=14;c++)for(let r=9;r<=14;r++){if(c===9||c===14||r===9||r===14)fenced=fence(fenced,`${c}:${r}`);}
  const held=farmNightfall(fenced,world,day);
  assert.equal(held.farm.lastAttack?.ate||0,0);
  assert.equal(held.farm.lastAttack?.fenceHit,true);
  assert.ok(Object.values(held.cells).every(c=>c.seed),'no crops eaten behind the fence');
});

test('remove_fence takes a piece down and refunds the wood when a builder stands beside it', ()=>{
  let s=ready();
  s=fence(s,'5:5');
  const wood=s.inventory.oak_wood;
  s.player={x:6.5,y:5.5};
  const gone=applyAction(s,{type:'remove_fence',id:'f:5:5',actionId:'rm1'},world,DAY_MIN);
  assert.equal(gone.buildings.find(b=>b.id==='f:5:5').status,'cancelled');
  assert.equal(gone.inventory.oak_wood,wood+2);
  s.player={x:12,y:12};
  assert.equal(applyAction(s,{type:'remove_fence',id:'f:5:5',actionId:'rm2'},world,DAY_MIN),s,'too far away → no change');
});

test('every rule has a readable line', ()=>{
  assert.ok(RULES.length>=5);
  for(const r of RULES)assert.ok(r.id&&r.text.length>20);
});
