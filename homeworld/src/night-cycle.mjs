import {dayPhase,minutesAt} from './island-clock.mjs';
import {completedHomes} from './nutrition.mjs';
import {workPoint} from './building.mjs';
import {memberPosition} from './community.mjs';
import {projectBuildings,projectWorkerPosition} from './project-rules.mjs';
const copy=p=>({x:p.x,y:p.y});
export function validNight(n){return n===undefined||n?.version===1&&Number.isInteger(n.day)&&Number.isFinite(n.startedAt)&&n.homes&&typeof n.homes==='object'&&!Array.isArray(n.homes)&&Object.values(n.homes).every(v=>v===null||typeof v==='string');}
function beginNight(state,world,phase,wall){
 const next=structuredClone(state),minutes=minutesAt(next.clock,wall),homes=completedHomes(next),used=new Set(),assigned={};
 for(const [id,c]of Object.entries(next.characters)){
  const b=projectBuildings(next).find(b=>b.project.crew.includes(id)&&!b.project.paused),w=b?.project.workers[id],m=next.community?.members[id],p=id===next.activeCharacter?next.player:w?projectWorkerPosition(w,wall):m?memberPosition(m,minutes):next.player;
  const available=homes.filter(h=>!used.has(h.id)),home=(available.length?available:homes).toSorted((a,b)=>Math.hypot(workPoint(world,a).x-p.x,workPoint(world,a).y-p.y)-Math.hypot(workPoint(world,b).x-p.x,workPoint(world,b).y-p.y))[0],door=home?workPoint(world,home):p;
  assigned[id]=home?.id||null;if(home)used.add(home.id);delete c.sleep;
  if(id===next.activeCharacter)next.player=copy(door);if(m){m.position=copy(door);m.job=null;m.readyAt=phase.morningMinutes;m.status=home?'Sleeping at home':'Resting for the night';}
  if(w){w.position=copy(door);w.phase='waiting';w.start=wall;w.end=wall;w.credited=0;w.path=null;delete w.homeId;w.status='Sleeping for the night';}
 }
 next.night={version:1,day:phase.day,startedAt:wall,homes:assigned};return next;
}
function wake(state,wall){
 const next=structuredClone(state),minutes=minutesAt(next.clock,wall);let rested=0;
 for(const [id,c]of Object.entries(next.characters)){if(next.night.homes[id]&&completedHomes(next).some(h=>h.id===next.night.homes[id])){c.energy=100;rested++;}delete c.fatigue;delete c.awakeSince;delete c.sleep;const m=next.community?.members[id];if(m){m.job=null;m.readyAt=minutes;m.status=id===next.activeCharacter?'Playing with you':'Ready for a new day';}}
 for(const b of projectBuildings(next)){for(const w of Object.values(b.project.workers)){w.phase='waiting';w.start=wall;w.end=wall;w.credited=0;w.path=null;delete w.homeId;w.status='Ready to build';}b.project.cursor=wall;}
 next.stats.sleeps=(next.stats.sleeps||0)+rested;if(next.community)next.community.totals.rests+=rested;next.lastNight={day:next.night.day,rested,wokeAt:wall};delete next.night;return next;
}
function freezeNight(state,wall,from){
 const next=structuredClone(state),delta=wall-from;
 for(const b of next.buildings||[]){if(b.project&&['queued','building'].includes(b.status)){const p=b.project,shift=Math.max(0,wall-p.cursor);for(const w of Object.values(p.workers)){w.start+=shift;w.end+=shift;}p.cursor=wall;}else if(!b.project&&b.status==='building')b.startedAt+=delta;}
 if(next.community){next.community.cursor=minutesAt(next.clock,wall);next.community.lastWall=wall;}return next;
}
// Split catch-up at bedtime and morning, so no work is credited during the
// compressed night and a saved sleep can never refill or complete work twice.
export function advanceNightCycle(state,world,wall,advanceWork,options={}){
 if(state.clock.cycle!==1)return advanceWork(state,wall,options);
 let next=state,cursor=Math.min(wall,state.nightCursorWall??state.clock.wall);
 if(next.clock.paused){next=next.night?freezeNight(next,wall,cursor):advanceWork(next,wall,options);return {...next,nightCursorWall:wall};}
 const maxWindow=30*86400000;if(wall-cursor>maxWindow){cursor=wall-maxWindow;next=freezeNight(next,cursor,state.nightCursorWall??state.clock.wall);}
 let steps=0;
 while(cursor<wall-.00001&&steps++<10000){
  const phase=dayPhase(next.clock,cursor);if(phase.night&&!next.night)next=beginNight(next,world,phase,cursor);else if(!phase.night&&next.night)next=wake(next,cursor);
  const end=Math.min(wall,cursor+Math.max(.001,phase.remainingMs));next=phase.night?freezeNight(next,end,cursor):advanceWork(next,end,options);cursor=end;
 }
 const phase=dayPhase(next.clock,wall);if(phase.night&&!next.night)next=beginNight(next,world,phase,wall);else if(!phase.night&&next.night)next=wake(next,wall);
 return {...next,nightCursorWall:wall};
}
