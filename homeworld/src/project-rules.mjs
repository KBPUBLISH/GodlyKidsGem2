export const PROJECT_PLANS={oven:{crew:1,days:1},hut:{crew:1,days:1},cottage:{crew:3,days:3},townhouse:{crew:5,days:5},church:{crew:8,days:7}};
export const CONSTRUCTION_BASIS='island';
export const WORK_SHIFT_SECONDS=450,REST_SHIFT_SECONDS=200,ENERGY_SECONDS=25,ENERGY_PER_TICK=2;
export const ACTIVE_FRACTION=WORK_SHIFT_SECONDS/(WORK_SHIFT_SECONDS+REST_SHIFT_SECONDS);
export const projectPlan=kind=>PROJECT_PLANS[kind];
export const projectRequiredWork=(kind,basis=CONSTRUCTION_BASIS)=>PROJECT_PLANS[kind].days*(basis==='real'?86400:600)*ACTIVE_FRACTION*PROJECT_PLANS[kind].crew;
export const projectProgress=b=>b.project?Math.min(1,b.project.done/b.project.required):null;
export const projectBuildings=state=>(state.buildings||[]).filter(b=>b.project&&['queued','building'].includes(b.status));
// Reconcile old work at its saved rate before calling this. Preserve the fraction
// earned, plus worker phase credits and energy, so changing units grants no work.
export function convertProjectTiming(state,basis=CONSTRUCTION_BASIS){
 const changes=projectBuildings(state).filter(b=>b.project.basis!==basis);if(!changes.length)return state;
 const next=structuredClone(state);
 for(const old of changes){const p=next.buildings.find(b=>b.id===old.id).project,fraction=old.project.done/old.project.required;p.required=projectRequiredWork(old.kind,basis);p.done=fraction*p.required;p.timingFrom=p.basis;p.basis=basis;p.timingConvertedAt=p.cursor;}
 return next;
}
export function assignedProject(state,id){return projectBuildings(state).find(b=>!b.project.paused&&b.project.crew.includes(id));}
export function projectHomeReserved(state,id){return projectBuildings(state).some(b=>!b.project.paused&&Object.values(b.project.workers).some(w=>['rest_travel','rest'].includes(w.phase)&&w.homeId===id));}
export function defaultCrew(state,kind){return Object.keys(state.characters||{}).filter(id=>!state.characters[id].sleep&&!assignedProject(state,id)).sort((a,b)=>{const low=id=>(state.characters[id].energy<=20?1:0);return low(a)-low(b)||(a===state.activeCharacter?1:0)-(b===state.activeCharacter?1:0)||a.localeCompare(b);}).slice(0,PROJECT_PLANS[kind]?.crew||1);}
export function crewStatus(state,kind,crew=defaultCrew(state,kind)){
 const plan=PROJECT_PLANS[kind];if(!plan)return {ok:true,crew:[],required:1};
 const total=Object.keys(state.characters||{}).length;
 if(total<plan.crew)return {ok:false,required:plan.crew,crew,reason:`Needs ${plan.crew} characters. Your community has ${total}.`};
 if(!Array.isArray(crew)||crew.length!==plan.crew||new Set(crew).size!==crew.length||crew.some(id=>!state.characters?.[id]))return {ok:false,required:plan.crew,crew:[],reason:`Choose ${plan.crew} different builders.`};
 if(crew.some(id=>state.characters[id].sleep||assignedProject(state,id)))return {ok:false,required:plan.crew,crew,reason:'A selected builder is asleep or working on another project.'};
 return {ok:true,required:plan.crew,crew,reason:'Your crew is ready!'};
}
export function projectWorkerPosition(worker,wall){
 if(!worker.path?.length||!['travel','rest_travel'].includes(worker.phase))return {...worker.position};
 const points=worker.path,total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);let left=total*Math.max(0,Math.min(1,(wall-worker.start)/Math.max(1,worker.end-worker.start)));
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(a.x-b.x,a.y-b.y);if(left<=d){const k=d?left/d:1;return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};}left-=d;}
 return {...points.at(-1)};
}
export function validProject(p,kind){
 if(p===undefined)return true;const plan=PROJECT_PLANS[kind],point=v=>Number.isFinite(v?.x)&&Number.isFinite(v?.y);
 return !!plan&&p?.version===1&&['real','island'].includes(p.basis)&&Number.isFinite(p.required)&&Math.abs(p.required-projectRequiredWork(kind,p.basis))<.001&&Number.isFinite(p.done)&&p.done>=0&&p.done<=p.required+.001&&Number.isFinite(p.cursor)&&typeof p.paused==='boolean'&&Array.isArray(p.crew)&&p.crew.length===plan.crew&&new Set(p.crew).size===p.crew.length&&p.crew.every(id=>typeof id==='string'&&id.length<100)&&p.workers&&p.crew.every(id=>{const w=p.workers[id];return w&&point(w.position)&&point(w.station)&&['waiting','travel','work','rest_travel','rest'].includes(w.phase)&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start<=w.end&&Number.isFinite(w.credited)&&w.credited>=0&&Number.isInteger(w.charged)&&w.charged>=0&&(!w.path||Array.isArray(w.path)&&w.path.length<1000&&w.path.every(point));});
}
export function projectDuration(kind,basis=CONSTRUCTION_BASIS){const p=PROJECT_PLANS[kind];return p?`${p.days} ${basis==='real'?'real':'island'} ${p.days===1?'day':'days'}`:null;}
export function projectMinutes(kind){return PROJECT_PLANS[kind]?PROJECT_PLANS[kind].days*10:null;}
export function projectTimeLeft(b){if(!b.project)return null;const p=projectProgress(b),days=PROJECT_PLANS[b.kind].days*(1-p);if(b.project.basis==='island')return `About ${Math.max(1,Math.ceil(days*10))} min left`;return days>=1?`About ${Math.ceil(days)} real ${Math.ceil(days)===1?'day':'days'} left`:`About ${Math.max(1,Math.ceil(days*24))} real hours left`;}
