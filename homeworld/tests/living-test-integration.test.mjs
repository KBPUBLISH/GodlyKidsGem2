import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,Navigation,buildSiteStatus,GameStore} from '../src/core.mjs';
import {livingTestLayout} from '../src/living-test-layout.mjs';

test('the play test uses reachable places and a valid home site on the original island',()=>{
  const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
  const state=initialState(world),layout=livingTestLayout(world,state),nav=new Navigation(world,state);
  assert.equal(buildSiteStatus(world,state,layout.home.plan).ok,true);
  assert.equal(buildSiteStatus(world,state,layout.camp.plan).ok,true);
  assert.equal(layout.points.length,10);
  for(const point of [layout.home.pad,layout.camp.pad,layout.kitchen,layout.farmPad,...layout.farmSpots,...layout.points])assert.ok(nav.path(state.player,point));
  assert.equal(state.buildings.length,0);
  assert.equal(layout.points.filter(p=>p.type==='carrot').length,4);
});

test('the opt-in island cannot migrate or adopt original profile saves',async()=>{
  const old=globalThis.location;
  try{
    globalThis.location={search:'?livingTest=1&profile=family:kid',replace:()=>{throw Error('Unexpected profile redirect');}};
    const scope=await import('../src/storage-scope.mjs?living-test-isolation');
    assert.equal(scope.LIVING_TEST,true);
    assert.equal(scope.PROFILE_SCOPE,'living-test-solo:family:kid');
    const entries=new Map([['godlykids_homeworld_playtest_v1','original-world'],['godlykids_profile_scope_migrated_v1','family:kid']]);
    const before=new Map(entries),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
    assert.deepEqual(scope.migrateLegacyKeys(undefined,storage),[]);
    assert.equal(scope.adoptNewerLegacy('godlykids_homeworld_playtest_v1',()=>true,storage),false);
    assert.deepEqual(entries,before);
    assert.equal(scope.ensureFrameScope('family:kid'),false);
  }finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});

test('normal island profile names and migration behavior remain unchanged',async()=>{
  const old=globalThis.location;
  try{
    globalThis.location={search:'?players=1&profile=ordinary-kid'};
    const scope=await import('../src/storage-scope.mjs?ordinary-island');
    assert.equal(scope.LIVING_TEST,false);assert.equal(scope.PROFILE_SCOPE,'ordinary-kid');
    const entries=new Map([['godlykids_homeworld_playtest_v1','original-world']]);
    const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
    assert.deepEqual(scope.migrateLegacyKeys(['godlykids_homeworld_playtest_v1'],storage),['godlykids_homeworld_playtest_v1:ordinary-kid']);
    assert.equal(entries.get('godlykids_homeworld_playtest_v1:ordinary-kid'),'original-world');
  }finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});

test('community reservations keep an approached or unavailable friend from wandering away',()=>{
  const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const wall=1800000000000,store=new GameStore(world,storage,wall);
  store.communityStep({active:false,reservedMembers:['eve','noah']},wall);
  const before=structuredClone(store.state.community.members);
  store.communityStep({active:false,reservedMembers:['eve','noah']},wall+60000);
  for(const id of ['eve','noah']){assert.equal(Boolean(store.state.community.members[id].job),false);assert.deepEqual(store.state.community.members[id].position,before[id].position);}
});
