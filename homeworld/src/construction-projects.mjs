import {buildingById,footprint,completedProjectHomes} from './project-support.mjs';
import {energyFor,setEnergy,workRate} from './nutrition.mjs';
import {CONSTRUCTION_BASIS,projectPlan,projectRequiredWork,projectProgress,projectBuildings,projectWorkerPosition,WORK_SHIFT_SECONDS,REST_SHIFT_SECONDS,ENERGY_SECONDS,ENERGY_PER_TICK,crewStatus} from './project-rules.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),copy=p=>({x:p.x,y:p.y});
function positionFor(state,id,minutes,api){if(id===state.activeCharacter)return copy(state.player);const m=state.community?.members[id];return m?api.memberPosition(m,minutes):copy(state.player);}
export function prepareProject(state,world,building,wall,api,crew,basis=CONSTRUCTION_BASIS){
 const status=crewStatus(state,building.kind,crew);if(!status.ok)return {error:status.reason};
 if(!completedProjectHomes(state).length)return {error:'Builders need somewhere to sleep. Build a Prayer Tent first.'};
 const nav=new api.Navigation(world,state),fp=footprint(world,building),taken=[],workers={};
 const candidates=[];for(let i=0;i<Math.max(fp.w,fp.h)+2;i++){const d=i*.65;for(const side of [-1,1])candidates.push({x:fp.center.x+side*d,y:fp.y-.8},{x:fp.center.x+side*d,y:fp.y+fp.h+.8},{x:fp.x-.8,y:fp.center.y+side*d},{x:fp.x+fp.w+.8,y:fp.center.y+side*d});}
 for(const id of status.crew){
  const from=positionFor(state,id,api.gameTime(state,wall),api);let station,path;
  for(const candidate of candidates.sort((a,b)=>distance(a,from)-distance(b,from))){const p=nav.nearest(candidate,1);if(!p||taken.some(q=>distance(p,q)<.6))continue;const route=nav.path(from,p);if(route&&distance(route.at(-1)||from,p)<.8){station=p;path=route;break;}}
  if(!station)return {error:`${state.characters[id].name} needs a clear way to the building site.`};taken.push(station);
  workers[id]={station,position:from,phase:'waiting',start:wall,end:wall,credited:0,charged:0,energySeconds:0,routes:{},status:'Ready to build'};
 }
 return {project:{version:1,basis,crew:status.crew,required:projectRequiredWork(building.kind,basis),done:0,cursor:wall,paused:false,workers,energy:{},rests:0}};
}
function pathTime(points){return points.slice(1).reduce((n,p,i)=>n+distance(p,points[i]),0)/2.2*1000;}
function travel(worker,path,to,phase,t){worker.path=[copy(worker.position),...path];worker.phase=phase;worker.start=t;worker.end=t+Math.max(1,pathTime(worker.path));worker.credited=0;worker.position=copy(worker.position);worker.destination=copy(to);}
function clearChore(state,id,minutes,api){const m=state.community?.members[id];if(m){m.position=api.memberPosition(m,minutes);m.job=null;m.readyAt=minutes+144;}}
function homeTaken(state,homeId,t,api,except){
 if(Object.values(state.characters||{}).some(c=>c.sleep?.homeId===homeId))return true;
 if(Object.values(state.community?.members||{}).some(m=>m.job?.kind==='rest'&&m.job.homeId===homeId&&m.job.end>api.gameTime(state,t)))return true;
 return projectBuildings(state).some(b=>!b.project.paused&&Object.entries(b.project.workers).some(([id,w])=>id!==except&&['rest_travel','rest'].includes(w.phase)&&w.homeId===homeId));
}
function beginRest(state,world,b,id,t,nav,api){
 const w=b.project.workers[id],homes=completedProjectHomes(state).sort((a,c)=>distance(api.workPoint(world,a),w.position)-distance(api.workPoint(world,c),w.position));
 for(const home of homes){if(homeTaken(state,home.id,t,api,id))continue;const door=api.workPoint(world,home),stamp=`${home.id}:${home.key}:${home.rotation}`,cached=w.routes[stamp],path=cached&&distance(w.position,w.station)<.5?cached.toHome:nav.path(w.position,door);if(!path||distance(path.at(-1)||w.position,door)>1.05)continue;
  if(distance(w.position,w.station)<.5)w.routes[stamp]={toHome:path,toWork:nav.path(door,w.station),door:copy(door)};w.homeStamp=stamp;w.homeId=home.id;travel(w,path,door,'rest_travel',t);w.status='Going home to sleep';return;
 }
 const freeAt=projectBuildings(state).flatMap(v=>Object.values(v.project.workers)).filter(v=>['rest','rest_travel'].includes(v.phase)).map(v=>v.end+(v.phase==='rest_travel'?REST_SHIFT_SECONDS*1000:0)).filter(end=>end>t);
 w.phase='waiting';w.start=t;w.end=freeAt.length?Math.min(...freeAt)+1:t+60000;w.status=homes.length?'Waiting for a free home':'Needs a completed home to sleep';
}
/** A builder who stays on to cover the site while the rest of the crew naps works a shorter shift, then gets relieved. */
const HOLD_SHIFT_SECONDS=240;
function beginWork(state,world,b,id,t,nav,api,maxSeconds=WORK_SHIFT_SECONDS){
 const p=b.project,w=p.workers[id],character=state.characters[id];if(!character){w.status='Builder is unavailable';w.end=t+60000;return;}
 const seconds=Math.min(maxSeconds,Math.floor(Math.max(0,energyFor(state,id)-20)/ENERGY_PER_TICK)*ENERGY_SECONDS-(w.energySeconds||0));
 if(seconds<1){beginRest(state,world,b,id,t,nav,api);return;}
 if(distance(w.position,w.station)>.3){const cached=w.homeStamp&&w.routes[w.homeStamp],path=cached&&distance(w.position,cached.door)<1?cached.toWork:nav.path(w.position,w.station);if(!path||distance(path.at(-1)||w.position,w.station)>.8){w.phase='waiting';w.start=t;w.end=t+30000;w.status='Needs a clear path to work';return;}travel(w,path,w.station,'travel',t);w.status='Walking to the building site';return;}
 w.phase='work';w.start=t;w.end=t+seconds*1000;w.credited=0;w.charged=0;w.status=maxSeconds<WORK_SHIFT_SECONDS?'Building · keeping the site busy':'Building';delete w.homeId;
}
/** Someone should always be hammering at the site: a builder only leaves for a nap while another crew member is still working. */
function othersOnSite(state,p,id,t,activePlayer){
 return p.crew.some(o=>o!==id&&!(activePlayer&&o===state.activeCharacter)&&!state.characters[o]?.sleep&&p.workers[o].phase==='work'&&p.workers[o].end>t+.01);
}
/** Credit a worker's shift up to `to`. `rate` is how hard they work (hunger slows it); energy is spent per second on site regardless. */
function accrue(state,b,id,to,rate=1){
 const p=b.project,w=p.workers[id],elapsed=Math.max(0,Math.min(to,w.end)-w.start)/1000,seconds=Math.min(Math.max(0,elapsed-w.credited),Math.max(0,(p.required-p.done)/rate));if(!seconds)return;
 const spend=Math.floor(((w.energySeconds||0)+seconds)/ENERGY_SECONDS)*ENERGY_PER_TICK;
 state.characters[id].energy=Math.max(0,energyFor(state,id)-spend);
 p.energy[id]=(p.energy[id]||0)+spend;w.energySeconds=((w.energySeconds||0)+seconds)%ENERGY_SECONDS;w.credited=elapsed;p.done=Math.min(p.required,p.done+seconds*rate);if(p.required-p.done<1e-7)p.done=p.required;
}
export function advanceProjects(state,world,wall,api,{activePlayer=false,offline=false}={}){
 const next=structuredClone(state);if(!projectBuildings(next).length)return next;
 let nav;const navigation=()=>nav??=new api.Navigation(world,next);
 for(const b of projectBuildings(next)){
  const p=b.project;if(wall<p.cursor)continue;const start=p.cursor,delta=wall-start;
  if(p.paused||(offline&&next.community?.offline===false)){for(const w of Object.values(p.workers)){w.position=projectWorkerPosition(w,start);w.start+=delta;w.end+=delta;}p.cursor=wall;continue;}
  if(!p.crew.every(id=>next.characters[id])){p.blocked='A builder is missing';p.cursor=wall;continue;}
  delete p.blocked;
  if(b.status==='queued'){b.status='building';b.startedAt=wall;for(const id of p.crew)clearChore(next,id,api.gameTime(next,start),api);}
  // Assigned builders are reserved from routine chores until this project finishes or is paused.
  for(const id of p.crew)clearChore(next,id,api.gameTime(next,start),api);
  if(activePlayer&&p.workers[next.activeCharacter]){const w=p.workers[next.activeCharacter];w.position=copy(next.player);w.phase='waiting';w.start=wall;w.end=wall+1000;w.credited=0;delete w.homeId;w.status='Playing with you';}
  const topology=JSON.stringify([(next.buildings||[]).map(v=>[v.id,v.key,v.rotation,v.status]),next.removedTrees,next.removedRocks,Object.entries(next.cells).filter(([,c])=>{const g=api.growth?.(c,api.gameTime(next,wall));return g?.seed.kind==='tree'&&g.stage==='ready';}).map(([key,c])=>[key,c.plantedAt])]);
  if(p.topology&&p.topology!==topology)for(const w of Object.values(p.workers)){w.routes={};w.station=navigation().nearest(w.station,3)||w.station;if(w.phase==='work')w.position=copy(w.station);if(['travel','rest_travel'].includes(w.phase)){w.position=projectWorkerPosition(w,start);w.phase='waiting';w.start=start;w.end=start;delete w.homeId;}}
  p.topology=topology;
  // Bound catch-up to thirty real days; timers before that window are shifted together.
  let cursor=start;if(wall-cursor>30*86400000){const shift=wall-cursor-30*86400000;cursor+=shift;for(const w of Object.values(p.workers)){w.start+=shift;w.end+=shift;}}
  let steps=0;
  while(cursor<=wall&&steps++<100000&&p.done<p.required){
   let event=Infinity;const rateFor=id=>workRate(next,api.gameTime(next,cursor),id);
   for(const id of p.crew){if((activePlayer&&id===next.activeCharacter)||next.characters[id]?.sleep)continue;const w=p.workers[id];
    if(w.end<=cursor+.01){
     if(w.phase==='work'){accrue(next,b,id,w.end,rateFor(id));w.position=copy(w.station);
      if(!othersOnSite(next,p,id,w.end,activePlayer)){beginWork(next,world,b,id,w.end,navigation(),api,HOLD_SHIFT_SECONDS);if(w.phase==='work'){event=Math.min(event,w.end);continue;}}
      beginRest(next,world,b,id,w.end,navigation(),api);}
     else if(w.phase==='rest_travel'){w.position=copy(w.destination);w.path=null;w.phase='rest';w.start=cursor;w.end=cursor+REST_SHIFT_SECONDS*1000;w.status='Sleeping at home';}
     else if(w.phase==='rest'){
      if(completedProjectHomes(next).some(h=>h.id===w.homeId)){setEnergy(next,100,id);p.rests++;}
      delete w.homeId;w.phase='waiting';w.start=cursor;w.end=cursor;beginWork(next,world,b,id,cursor,navigation(),api);
     }else if(w.phase==='travel'){w.position=copy(w.station);w.path=null;beginWork(next,world,b,id,cursor,navigation(),api);}
     else beginWork(next,world,b,id,cursor,navigation(),api);
    }
    event=Math.min(event,w.end);
   }
   const working=p.crew.filter(id=>!(activePlayer&&id===next.activeCharacter)&&!next.characters[id]?.sleep&&p.workers[id].phase==='work'),rateSum=working.reduce((n,id)=>n+rateFor(id),0);const until=Math.min(wall,event,rateSum?cursor+(p.required-p.done)/rateSum*1000:Infinity);for(const id of working)accrue(next,b,id,until,rateFor(id));
   if(!Number.isFinite(event)||event>wall||p.done>=p.required)break;cursor=Math.max(cursor+.01,event);
  }
  p.cursor=wall;
  if(p.done>=p.required){p.done=p.required;b.status='complete';b.completedAt=wall;if(b.upgradeFrom){next.stats.houseUpgrades=(next.stats.houseUpgrades||0)+1;delete b.upgradeFrom;}else next.stats.built=(next.stats.built||0)+1;for(const w of Object.values(p.workers)){w.position=projectWorkerPosition(w,wall);w.phase='waiting';w.start=wall;w.end=wall;w.path=null;delete w.homeId;}}
  for(const id of p.crew){const w=p.workers[id],position=projectWorkerPosition(w,wall);if(id===next.activeCharacter&&!activePlayer&&!next.characters[id]?.sleep)next.player=position;else if(next.community?.members[id]){next.community.members[id].position=position;next.community.members[id].status=b.status==='complete'?'Project finished':w.status;}}
 }
 return next;
}
export function projectAssignments(state,wall=Date.now()){
 return projectBuildings(state).flatMap(b=>b.project.paused?[]:b.project.crew.map(id=>{const w=b.project.workers[id];return {id,buildingId:b.id,project:true,position:projectWorkerPosition(w,wall),status:w.status,walking:['travel','rest_travel'].includes(w.phase),resting:w.phase==='rest',working:w.phase==='work',job:w.phase==='waiting'?null:{kind:w.phase==='rest'?'rest':'build',target:footprintForTarget(state,b),start:w.start,arrive:w.phase==='work'?w.start:w.end},progress:projectProgress(b)};}));
}
function footprintForTarget(state,b){return b.project.target||{...Object.values(b.project.workers)[0].station};}
