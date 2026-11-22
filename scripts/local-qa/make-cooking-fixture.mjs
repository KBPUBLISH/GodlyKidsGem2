// Isolated cooking QA profile; never overwrites the child's local goals island.
import {readFileSync,writeFileSync} from 'node:fs';
import {initialState} from '../../homeworld/src/core.mjs';
import {workPoint} from '../../homeworld/src/building.mjs';
import {freshState} from '../../homeworld/src/living-test-rules.mjs';
import {chooseGoal,goalFacts} from '../../homeworld/src/adventure-goals.mjs';
const profile=process.argv.includes('--eat')?'cooking-eat-qa-v2':'cooking-qa-v2';
const world=JSON.parse(readFileSync(new URL('../../public/homeworld/assets/world.json',import.meta.url)));
const s=initialState(world), fire={id:'qa-fire',kind:'campfire',key:'67:73',rotation:0,status:'complete',baseHeight:0,startedAt:0,paidMaterials:{pine_wood:5,stone:3},fuelUntil:10000};
s.buildings=[fire];s.player=workPoint(world,fire);s.clock.paused=true;s.livingTasksSeen=true;s.livingArrivalSeen=true;s.livingGardenLayout='existing';s.livingTentAwarded=true;
s.inventory={...s.inventory,fish:1,pine_wood:5};s.characters.you={name:'Explorer',energy:40,hunger:30,hungerAt:480};s.activeCharacter='you';
s.adventureGoals=chooseGoal(null,'fish',goalFacts(s));
const t={...freshState(),stage:1,gathered:['log-1','log-2','log-3'],deposits:{'first-camp':3},approvedBuildings:{'first-camp':true},inviteDismissed:true,welcomeSeen:true,adamArrived:true};
const suffix=`:living-test-solo:${profile}`;
const entries={[`godlykids_homeworld_playtest_v1${suffix}`]:s,[`gk_living_island_requests_v2${suffix}`]:t,[`gk_living_first_friend_v1${suffix}`]:{version:2,phase:'placed',islandId:'qa',storyId:'qa',character:'adam',position:{x:s.player.x+2,y:s.player.y}}};
writeFileSync(new URL(process.argv.includes('--eat')?'../../public/goal-cooking-eat-qa.html':'../../public/goal-cooking-qa.html',import.meta.url),`<!doctype html><html><head><title>Isolated cooking QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style></head><body><script>for(const[k,v]of Object.entries(${JSON.stringify(entries)}))if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v));</script><iframe title="Cooking QA" src="/homeworld/index.html?livingTest=1&profile=${profile}&player=Explorer&avatar=boy-1"></iframe></body></html>`);
