import {memberPosition} from './community.mjs';
import {assignedProject,projectWorkerPosition} from './project-rules.mjs';
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
// The currently controlled person uses state.player; everyone else has an
// independent member position. Switching transfers control, never identity.
export function selectCharacter(state,id,position,minutes,wall){
 const old=state.activeCharacter||'adam';if(id===old||!state.characters[id]||!state.community?.members[id]||!point(position)||state.characters[old]?.sleep||state.characters[id]?.sleep)return state;
 const next=structuredClone(state),members=next.community.members;
 members[old]??={position:{...position},readyAt:minutes};members[old].position={...position};members[old].job=null;members[old].readyAt=minutes;members[old].status='Exploring the island';
 const project=assignedProject(next,id),worker=project?.project.workers[id],target=worker?projectWorkerPosition(worker,wall):memberPosition(members[id],minutes);
 members[id].position={...target};members[id].job=null;members[id].readyAt=minutes;members[id].status='Playing with you';
 if(worker){worker.position={...target};worker.phase='waiting';worker.start=wall;worker.end=wall;worker.credited=0;worker.path=null;delete worker.homeId;worker.status='Playing with you';}
 const oldProject=assignedProject(next,old),oldWorker=oldProject?.project.workers[old];if(oldWorker){oldWorker.position={...position};oldWorker.phase='waiting';oldWorker.start=wall;oldWorker.end=wall;oldWorker.credited=0;oldWorker.path=null;delete oldWorker.homeId;}
 next.activeCharacter=id;next.player={...target};return next;
}
