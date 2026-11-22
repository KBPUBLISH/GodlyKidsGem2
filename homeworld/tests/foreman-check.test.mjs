import test from 'node:test';
import assert from 'node:assert/strict';
import {checkIn, campSite} from '../src/foreman-check.mjs';
import {footprint} from '../src/building.mjs';

function friend(name){return {name,energy:100};}
function building(kind,key,status='complete'){return {id:`${kind}:${key}`,kind,key,rotation:0,status};}
function crew(n,extra={}){
  const characters={adam:friend('Adam'),eve:friend('Eve'),noah:friend('Noah'),abel:friend('Abel'),...extra};
  let i=Object.keys(characters).length;
  while(i<n){characters[`friend${i}`]=friend(`Friend ${i}`);i++;}
  return characters;
}
/** Camp buildings standing, ten people, pantry empty — food is the track furthest behind. */
function foodBehind(){
  return {
    activeCharacter:'adam',
    characters:crew(10),
    buildings:[building('tent','4:4'),building('campfire','8:8')],
    animals:[],
    stats:{harvested:0,fishCaught:0,foodPrepared:0,applesPicked:0,farmProduce:0},
    inventory:{},
    clock:{minutes:8*60,wall:1,paused:true},
  };
}

test('a second prayer tent is refused',()=>{
  const state=foodBehind();
  state.buildings=[building('tent','4:4')];
  const out=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'tent',key:'20:20',rotation:0}});
  assert.equal(out.ok,false);
  assert.match(out.instead,/not another tent/);
  const queued=foodBehind();
  queued.buildings=[building('tent','4:4','building')];
  const again=checkIn(queued,{who:'noah',brain:'builder',intent:{action:'build',kind:'tent',key:'20:20',rotation:0}});
  assert.equal(again.ok,false);
  assert.equal(again.reason,'unique');
});

test('a building that overlaps another is refused',()=>{
  const state=foodBehind();
  state.buildings=[building('hut','10:10')];
  const out=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'campfire',key:'11:11',rotation:0}});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'overlap');
});

test('the character the kid is playing is not puppeted',()=>{
  const state=foodBehind();
  state.activeCharacter='eve';
  const out=checkIn(state,{who:'eve',brain:'cook',intent:{action:'meal',maintenance:true}});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'played');
  const byName=checkIn(state,{who:'Eve',brain:'cook',intent:{action:'craft'}});
  assert.equal(byName.ok,false);
  assert.equal(byName.reason,'played');
});

test('the cook may work when food is the lagging track',()=>{
  const state=foodBehind();
  const out=checkIn(state,{who:'eve',brain:'cook',intent:{action:'craft'}});
  assert.equal(out.ok,true,out.instead||out.reason);
  const meal=checkIn(state,{who:'eve',brain:'cook',intent:{action:'meal',maintenance:true}});
  assert.equal(meal.ok,true);
});

test('the builder will not start a tent when a hut is the unmet building',()=>{
  const state=foodBehind();
  const out=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'tent',key:'20:20',rotation:0}});
  assert.equal(out.ok,false);
  assert.match(out.instead,/Small Hut/);
  assert.match(out.instead,/not another tent/);
});

test('maintenance stays allowed when that lane is not behind',()=>{
  const state=foodBehind();
  state.activeCharacter='noah';
  const water=checkIn(state,{who:'abel',brain:'gardener',intent:{action:'water',maintenance:true}});
  assert.equal(water.ok,true);
  const feed=checkIn(state,{who:'adam',brain:'farmer',intent:{action:'feed',maintenance:true}});
  assert.equal(feed.ok,true);
  const expand=checkIn(state,{who:'abel',brain:'gardener',intent:{action:'expand'}});
  assert.equal(expand.ok,false);
  assert.equal(expand.instead,'Food is behind — cook');
});

test('a second stable is refused once a paddock building exists',()=>{
  const state=foodBehind();
  state.activeCharacter='eve';
  state.buildings.push(building('stable','14:14'));
  const out=checkIn(state,{who:'adam',brain:'farmer',intent:{action:'paddock',kind:'stable'}});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'paddock');
  const finishing=checkIn(state,{who:'adam',brain:'farmer',intent:{action:'paddock',kind:'fence',maintenance:true}});
  assert.equal(finishing.ok,true);
});

function gapOf(kindA,keyA,kindB,keyB){
  const world={grid:{origin:[0,0]}};
  const a=footprint(world,{kind:kindA,key:keyA,rotation:0});
  const b=footprint(world,{kind:kindB,key:keyB,rotation:0});
  const gapC=a.col>=b.col+b.w?a.col-(b.col+b.w):b.col>=a.col+a.w?b.col-(a.col+a.w):-1;
  const gapR=a.row>=b.row+b.h?a.row-(b.row+b.h):b.row>=a.row+a.h?b.row-(a.row+a.h):-1;
  if(gapC<0&&gapR<0)return -1;
  if(gapC<0)return gapR;
  if(gapR<0)return gapC;
  return Math.max(gapC,gapR);
}

/** South beach, grass inland, a fishing spot on the shore. */
function shoreWorld(){
  const columns=64,rows=64;
  const mask=Array(columns*rows).fill(2);
  for(let r=0;r<3;r++)for(let c=0;c<columns;c++)mask[r*columns+c]=1;
  const heights=Array((columns+1)*(rows+1)).fill(0);
  return {grid:{origin:[0,0],columns,rows,mask,heights},fishingSpots:[{position:[28,1,0]}],trees:[],rocks:[],seeds:[],blockers:[],gardenSlots:[],heroStart:[2,8]};
}

/** Homestead, hut still missing, so the builder's lane is the one behind. */
function hutDue(world){
  const state={
    activeCharacter:'eve',
    characters:crew(20),
    buildings:[],
    animals:[],
    stats:{harvested:0,fishCaught:0,foodPrepared:1200,applesPicked:0,farmProduce:0},
    inventory:{},
    cells:{},
    pickedSeeds:[],
    player:{x:2,y:2},
    clock:{minutes:8*60,wall:1,paused:true},
  };
  const tent=campSite(state,world,'tent');
  state.buildings.push(building('tent',tent.key));
  const fire=campSite(state,world,'campfire');
  state.buildings.push(building('campfire',fire.key));
  return {state,tent,fire};
}

test('automatic homes line up with a gap, and the campfire keeps its distance',()=>{
  const world=shoreWorld();
  const {state,tent,fire}=hutDue(world);
  assert.equal(tent.ok,true);
  assert.equal(fire.ok,true);
  assert.equal(tent.rotation,0);
  assert.equal(fire.rotation,0);
  assert.equal(tent.key.split(':')[1],fire.key.split(':')[1]);
  assert.ok(gapOf('tent',tent.key,'campfire',fire.key)>=2);
  const hut=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'hut'},world});
  assert.equal(hut.ok,true,hut.reason||hut.instead);
  assert.equal(hut.site.rotation,0);
  assert.equal(hut.site.key.split(':')[1],tent.key.split(':')[1]);
  assert.ok(gapOf('tent',tent.key,'hut',hut.site.key)>=2);
  assert.ok(gapOf('campfire',fire.key,'hut',hut.site.key)>=2);
  state.buildings.push(building('hut',hut.site.key));
  const next=campSite(state,world,'hut');
  assert.equal(next.ok,true,next.reason);
  assert.equal(next.rotation,0);
  const [c1,r1]=hut.site.key.split(':').map(Number);
  const [c2,r2]=next.key.split(':').map(Number);
  assert.equal(r1,r2);
  assert.ok(c2>=c1+3+2,`second home at ${next.key} should sit two tiles past ${hut.site.key}`);
});

test('a building crammed against the tent is refused',()=>{
  const world=shoreWorld();
  const {state,tent}=hutDue(world);
  const [c,r]=tent.key.split(':').map(Number);
  const cram=`${c+4}:${r}`;
  const out=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'hut',key:cram,rotation:0},world});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'No room in the row yet');
});

test('the crew waits when the only grass would touch the water',()=>{
  const columns=30,rows=30;
  const mask=Array(columns*rows).fill(0);
  for(let r=2;r<6;r++)for(let c=2;c<8;c++)mask[r*columns+c]=2;
  const world={grid:{origin:[0,0],columns,rows,mask},fishingSpots:[],trees:[],rocks:[],seeds:[],blockers:[],gardenSlots:[]};
  const state={
    activeCharacter:'eve',
    characters:crew(20),
    buildings:[building('tent','4:3'),building('campfire','4:4')],
    animals:[],
    stats:{harvested:0,fishCaught:0,foodPrepared:1200,applesPicked:0,farmProduce:0},
    inventory:{},
    cells:{},
    pickedSeeds:[],
    player:{x:1,y:1},
    clock:{minutes:8*60,wall:1,paused:true},
  };
  const out=checkIn(state,{who:'noah',brain:'builder',intent:{action:'build',kind:'hut'},world});
  assert.equal(out.ok,false);
  assert.equal(out.reason,'No room in the row yet');
});
