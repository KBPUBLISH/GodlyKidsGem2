// Separate, disposable local island for coop UI and relocation QA.
import {readFileSync,writeFileSync} from 'node:fs';
import {initialState} from '../../homeworld/src/core.mjs';
import {freshState} from '../../homeworld/src/living-test-rules.mjs';
import {farmFresh} from '../../homeworld/src/living-farm-rules.mjs';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
const s=initialState(world);Object.assign(s,{livingTasksSeen:true,livingArrivalSeen:true,livingGardenLayout:'existing',livingTentAwarded:true});s.clock.paused=true;
s.livingFarm={...farmFresh(),coins:50,coop:1,nextId:4,animals:Array.from({length:3},(_,i)=>({id:`living-farm-${i+1}`,kind:'chicken',name:'Chicken',ready:3,eggSlots:[0,1,2],nextAt:Date.now()+3600000})),garden:{...farmFresh().garden,planted:4,plantedSpots:[0,3,4,5],rewarded:true,picked:{carrot:1,pumpkin:1,lettuce:1},completed:true}};
const t={...freshState(),stage:1,gathered:['log-1','log-2','log-3'],deposits:{'first-camp':3},approvedBuildings:{'first-camp':true},inviteDismissed:true};
const suffix=':living-test-solo:coop-qa-v1';
const entries={[`godlykids_homeworld_playtest_v1${suffix}`]:s,[`gk_living_island_requests_v2${suffix}`]:t};
writeFileSync(new URL('../../public/coop-qa.html',import.meta.url),`<!doctype html><html><head><title>Chicken coop playtest</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style></head><body><script>for(const[k,v]of Object.entries(${JSON.stringify(entries)}))if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v));</script><iframe title="Chicken coop QA" src="/homeworld/index.html?livingTest=1&profile=coop-qa-v1&player=Explorer&avatar=boy-1"></iframe></body></html>`);
