import {assignedProject,projectHomeReserved} from './project-rules.mjs';
import {energyFor,setEnergy,isLowEnergy,completedHomes} from './nutrition.mjs';
import {workPoint} from './building.mjs';
export const COMMUNITY_IDLE_SECONDS=30,COMMUNITY_FISH_TARGET=20,COMMUNITY_OFFLINE_HOURS=8;
export const MEMBERS=[{id:'eve',name:'Eve',role:'Garden helper',height:1.85},{id:'noah',name:'Noah',role:'Fisher',height:1.85},{id:'adam',name:'Adam',role:'Garden helper',height:1.85}];
const MINUTES_PER_SECOND=2.4, SPEED=2.2, REST_MINUTES=480,COOLDOWN=144;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
export function validCommunity(c){
 if(c===undefined)return true;
 return c?.version===1&&typeof c.enabled==='boolean'&&typeof c.offline==='boolean'&&Number.isFinite(c.cursor)&&Number.isFinite(c.lastInput)&&Number.isInteger(c.sequence)&&c.sequence>=0&&c.totals&&['fish','harvests','watered','rests'].every(k=>Number.isInteger(c.totals[k])&&c.totals[k]>=0)&&c.members&&MEMBERS.every(({id})=>{const m=c.members[id],j=m?.job;if(id==='adam'&&!m)return true;return point(m?.position)&&Number.isFinite(m.readyAt)&&(!j||typeof j.id==='string'&&['fish','water','harvest','rest','roam'].includes(j.kind)&&Number.isFinite(j.start)&&Number.isFinite(j.arrive)&&Number.isFinite(j.end)&&j.start<=j.arrive&&j.arrive<=j.end&&Array.isArray(j.path)&&j.path.length>0&&j.path.length<1000&&j.path.every(point)&&point(j.target)&&(j.kind==='fish'?typeof j.spotId==='string':j.kind==='rest'?typeof j.homeId==='string':j.kind==='roam'?true:typeof j.key==='string'&&typeof j.seed==='string'&&Number.isFinite(j.plantedAt)));});
}
export function memberPosition(member,minutes){
 const j=member?.job;if(!j||minutes<=j.start)return {...member.position};
 const path=j.path,total=path.slice(1).reduce((n,p,i)=>n+distance(path[i],p),0);let left=total*Math.max(0,Math.min(1,(minutes-j.start)/Math.max(.001,j.arrive-j.start)));
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=distance(a,b);if(left<=d){const k=d?left/d:1;return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};}left-=d;}
 return {...path.at(-1)};
}
export function communityClaim(state,key){return Object.values(state.community?.members||{}).find(m=>m.job&&['water','harvest'].includes(m.job.kind)&&m.job.key===key)?.job;}
export function homeReserved(state,id){return projectHomeReserved(state,id)||Object.values(state.community?.members||{}).some(m=>m.job?.kind==='rest'&&m.job.homeId===id);}
export function initializeCommunity(state,world,minutes,Navigation){
 if(state.community){if(state.community.members.adam)return state;const next=structuredClone(state);next.community.members.adam={position:{...(state.activeCharacter==='adam'?state.player:{x:world.heroStart[0],y:world.heroStart[1]})},readyAt:minutes,status:'Exploring the island'};return next;}
 const next=structuredClone(state),nav=new Navigation(world,state,minutes),members={};
 for(const [i,m]of MEMBERS.entries()){
  const desired={x:state.player.x+(i?2:-2),y:state.player.y+1.6},spawn=m.id==='adam'?{...state.player}:nav.nearest(desired,6)||nav.nearest(state.player,8)||{...state.player};
  members[m.id]={position:spawn,readyAt:minutes,status:'Ready to help'};next.characters[m.id]??={name:m.name,energy:100};
 }
 next.community={version:1,enabled:true,offline:true,cursor:minutes,lastInput:minutes,sequence:0,members,totals:{fish:0,harvests:0,watered:0,rests:0}};return next;
}
export function configureCommunity(state,minutes,changes){
 if(!state.community)return state;const next=structuredClone(state),c=next.community;
 if(typeof changes.enabled==='boolean')c.enabled=changes.enabled;if(typeof changes.offline==='boolean')c.offline=changes.offline;
 c.lastInput=minutes;c.cursor=minutes;
 if(!c.enabled)for(const m of Object.values(c.members)){m.position=memberPosition(m,minutes);m.job=null;m.readyAt=minutes;m.status='Taking a break';}
 return next;
}
function jobCandidate(state,world,id,t,api){
 if(id==='noah'){
  const spot=world.fishingSpots?.[0];if(!spot||(state.inventory.fish||0)>=COMMUNITY_FISH_TARGET)return null;
  return {kind:'fish',spotId:spot.id,destination:{x:spot.position[0],y:spot.position[1]},target:{x:spot.water[0],y:spot.water[1]},seconds:6};
 }
 const member=state.community.members[id];
 const cells=Object.entries(state.cells).map(([key,cell])=>({key,cell,g:api.growth(cell,t),p:api.cellFromKey(world,key)})).filter(c=>c.g?.seed.kind==='crop'&&!communityClaim(state,c.key));
 cells.sort((a,b)=>(a.g.stage==='ready'?0:1)-(b.g.stage==='ready'?0:1)||distance(a.p,member.position)-distance(b.p,member.position));
 const c=cells.find(c=>c.g.stage==='ready'||c.g.thirsty);if(!c)return null;
 return {kind:c.g.stage==='ready'?'harvest':'water',key:c.key,seed:c.cell.seed,plantedAt:c.cell.plantedAt,target:{x:c.p.x,y:c.p.y},seconds:4};
}
function wander(state,id,t,nav){
 const c=state.community,m=c.members[id],base=c.sequence+MEMBERS.findIndex(v=>v.id===id)*7;
 for(let i=0;i<12;i++){const a=(base+i)*2.399963,r=2.5+(base+i)%4,destination=nav.nearest({x:m.position.x+Math.cos(a)*r,y:m.position.y+Math.sin(a)*r},2);if(!destination||distance(destination,m.position)<1.5)continue;const path=nav.path(m.position,destination);if(!path||distance(path.at(-1)||m.position,destination)>.8)continue;return {kind:'roam',target:destination,destination,path,seconds:2};}
 m.status='Enjoying the island';return null;
}
function plan(state,world,id,t,nav,api,{chores=true,roam=true}={}){
 const c=state.community,m=c.members[id],candidate=chores?jobCandidate(state,world,id,t,api):null;
 const lowEnergy=isLowEnergy(state,id);
 let a=candidate;if(!a&&!lowEnergy){a=roam?wander(state,id,t,nav):null;if(!a){m.status=id==='noah'?'Pantry has enough fish':'Garden is cared for';return false;}}
 if(lowEnergy){
  const homes=completedHomes(state).filter(h=>!homeReserved(state,h.id)&&!Object.values(state.characters).some(ch=>ch.sleep?.homeId===h.id)).sort((a,b)=>distance(workPoint(world,a),m.position)-distance(workPoint(world,b),m.position));
  a=null;for(const h of homes){const door=workPoint(world,h),path=nav.path(m.position,door);if(path&&distance(path.at(-1)||m.position,door)<=1.05){a={kind:'rest',homeId:h.id,target:door,path,seconds:REST_MINUTES/MINUTES_PER_SECOND};break;}}
  if(!a){m.status='Needs a free home to rest';return false;}
 }
 const path=a.path||(a.destination?nav.path(m.position,a.destination):nav.approach(m.position,a.target,.85));
 if(!path||(a.destination&&distance(path.at(-1)||m.position,a.destination)>1.05)){m.status='Needs a clear path';return false;}
 const full=[{...m.position},...path],length=full.slice(1).reduce((n,p,i)=>n+distance(full[i],p),0),arrive=t+length/SPEED*MINUTES_PER_SECOND;
 const {destination,seconds,...data}=a;m.job={...data,id:`community:${id}:${++c.sequence}`,path:full,start:t,arrive,end:arrive+seconds*MINUTES_PER_SECOND};m.status=a.kind==='rest'?'Going home to rest':a.kind==='roam'?'Exploring the island':a.kind==='fish'?'Going fishing':a.kind==='harvest'?'Picking ripe crops':'Watering the garden';return true;
}
function finish(state,world,id,t,wall,api){
 const m=state.community.members[id],j=m.job;if(!j)return state;
 m.position={...j.path.at(-1)};
 if(j.kind==='rest'){
  if(completedHomes(state).some(h=>h.id===j.homeId)){setEnergy(state,100,id);state.community.totals.rests++;m.status='Rested at home';}else m.status='Home is no longer available';
 }else if(j.kind!=='roam'){
  const cell=state.cells[j.key],sameCrop=j.kind==='fish'||cell?.seed===j.seed&&cell?.plantedAt===j.plantedAt;
  if(sameCrop&&(j.kind!=='fish'||(state.inventory.fish||0)<COMMUNITY_FISH_TARGET)){
   const scoped={...state,activeCharacter:id,player:{...m.position}},action={type:j.kind,key:j.key,spotId:j.spotId,actionId:j.id};
   const result=api.applyAction(scoped,action,world,t,wall);
   if(result!==scoped){const originalPlayer=state.player,originalActive=state.activeCharacter;state={...result,player:originalPlayer,activeCharacter:originalActive};const totals=state.community.totals;totals[j.kind==='fish'?'fish':j.kind==='harvest'?'harvests':'watered']++;state.community.members[id].status=j.kind==='fish'?'Put 1 fish in My bag':j.kind==='harvest'?'Put crops and a seed in My bag':'Watered a plant';}
  }
 }
 const member=state.community.members[id];member.position={...j.path.at(-1)};member.job=null;member.readyAt=t+(j.kind==='roam'?7.2:COOLDOWN);if(j.kind==='roam')member.status='Enjoying the island';return state;
}
// The clock and canonical action rules are injected to keep the save system free of import cycles.
export function advanceCommunity(state,world,minutes,wall,api,{active=false,offline=false,activity=false,reservedMembers=[]}={}){
 let next=initializeCommunity(state,world,minutes,api.Navigation);if(next===state)next=structuredClone(state);let c=next.community;
 if(minutes<c.cursor){for(const m of Object.values(c.members)){m.position=memberPosition(m,c.cursor);m.job=null;m.readyAt=minutes;}c.cursor=minutes;}
 const maxWindow=COMMUNITY_OFFLINE_HOURS*3600*MINUTES_PER_SECOND;
 let start=c.cursor;
 if(offline&&!c.offline){for(const m of Object.values(c.members))if(m.job){const shift=minutes-start;m.job.start+=shift;m.job.arrive+=shift;m.job.end+=shift;m.readyAt+=shift;}start=minutes;c.lastInput=minutes;}
 if(minutes-start>maxWindow){const shift=minutes-start-maxWindow;start+=shift;for(const {id}of MEMBERS){const m=c.members[id];m.readyAt+=shift;if(m.job){m.job.start+=shift;m.job.arrive+=shift;m.job.end+=shift;}}c.lastInput+=shift;}
 if(activity)c.lastInput=minutes;
 const allowed=!active&&c.enabled;
 const controlled=c.members[next.activeCharacter];if(controlled){controlled.position={...next.player};controlled.job=null;controlled.status='Playing with you';}
 let nav;const getNav=()=>nav??=new api.Navigation(world,next,minutes);let steps=0;
 const topology=JSON.stringify([(next.buildings||[]).map(b=>[b.id,b.kind,b.key,b.rotation,b.status]),next.removedTrees,next.removedRocks,Object.entries(next.cells).filter(([,cell])=>api.growth(cell,minutes)?.seed.kind==='tree'&&api.growth(cell,minutes).stage==='ready').map(([key])=>key)]);
 if(c.topology&&c.topology!==topology)for(const m of Object.values(c.members)){m.position=memberPosition(m,start);m.position=getNav().nearest(m.position,5)||m.position;m.job=null;m.readyAt=start;m.status='Finding a new path';}
 c.topology=topology;
 for(let t=start;t<=minutes+.0001&&steps++<2048;){
  let event=Infinity;
  for(const {id}of MEMBERS){
   let m=c.members[id];if(id===next.activeCharacter)continue;
   const choreAt=c.lastInput+COMMUNITY_IDLE_SECONDS*MINUTES_PER_SECOND;
   if(allowed&&t<choreAt)event=Math.min(event,choreAt);
   if(allowed&&t>=choreAt&&(m.job?.kind==='roam'||!m.job&&m.status==='Enjoying the island')&&(jobCandidate(next,world,id,t,api)||isLowEnergy(next,id))){m.position=memberPosition(m,t);m.job=null;m.readyAt=t;}
   if(m.job){if(m.job.end<=t+.0001){next=finish(next,world,id,m.job.end,wall,api);c=next.community;m=c.members[id];}else event=Math.min(event,m.job.end);}
   if(!m.job&&c.enabled&&!assignedProject(next,id)&&!reservedMembers.includes(id)){const ready=offline?Math.max(m.readyAt,c.lastInput+COMMUNITY_IDLE_SECONDS*MINUTES_PER_SECOND):m.readyAt;
    if(ready<=t+.0001){if(plan(next,world,id,t,getNav(),api,{chores:allowed&&t>=c.lastInput+COMMUNITY_IDLE_SECONDS*MINUTES_PER_SECOND,roam:!offline}))event=Math.min(event,m.job.end);else{m.readyAt=t+COOLDOWN;event=Math.min(event,m.readyAt);}}
    else event=Math.min(event,ready);
   }
  }
  if(!Number.isFinite(event)||event>minutes+.0001)break;t=Math.max(t+.0001,event);
 }
 c.cursor=minutes;c.lastWall=wall;
 return next;
}
export function communitySnapshot(state,minutes){
 const c=state.community;if(!c)return null;
 return {enabled:c.enabled,offline:c.offline,idleIn:Math.max(0,Math.ceil((c.lastInput+COMMUNITY_IDLE_SECONDS*MINUTES_PER_SECOND-minutes)/MINUTES_PER_SECOND)),totals:c.totals,
  members:MEMBERS.map(info=>{const m=c.members[info.id],j=m.job,walking=j&&minutes<j.arrive,resting=j?.kind==='rest'&&!walking;return {...info,selected:info.id===state.activeCharacter,position:info.id===state.activeCharacter?{...state.player}:memberPosition(m,minutes),energy:energyFor(state,info.id),status:info.id===state.activeCharacter?'Playing with you':!c.enabled?'Taking a break':j?(walking?m.status:resting?'Sleeping at home':j.kind==='roam'?'Enjoying the island':j.kind==='fish'?'Fishing':j.kind==='harvest'?'Picking ripe crops':'Watering plants'):m.status,walking,resting,job:j};})};
}
