import {buildingById} from './building.mjs';
import {projectProgress} from './project-rules.mjs';
export function reportBaseline(state,wall){return {wall,totals:{...(state.community?.totals||{})},projects:Object.fromEntries((state.buildings||[]).filter(b=>b.project).map(b=>[b.id,{progress:projectProgress(b),energy:Object.values(b.project.energy||{}).reduce((a,n)=>a+n,0),rests:b.project.rests||0,status:b.status}]))};}
export function returnedReport(before,after,wall){
 const baseline=before.away||reportBaseline(before,before.lastOnlineWall||before.clock.wall);if(wall-baseline.wall<60000)return after;
 const projects=(after.buildings||[]).filter(b=>b.project).map(b=>{const old=baseline.projects[b.id]||{progress:0,energy:0,rests:0},p=b.project,energy=Object.values(p.energy||{}).reduce((a,n)=>a+n,0);return {id:b.id,name:buildingById(b.kind).name,from:old.progress,to:projectProgress(b),completed:b.status==='complete'&&old.status!=='complete',crew:p.crew.map(id=>after.characters[id]?.name||id),energy:Math.max(0,energy-old.energy),rests:Math.max(0,(p.rests||0)-old.rests),paused:p.paused,status:p.blocked||Object.values(p.workers).map(w=>w.status).find(s=>/Waiting|Needs|missing/.test(s||''))||(Object.values(p.workers).every(w=>['rest','rest_travel'].includes(w.phase))?'Builders are resting at home.':'Work is moving along')};}).filter(p=>p.to>p.from||p.completed||p.paused||p.to<1);
 const totals=after.community?.totals||{},gathered=Object.fromEntries(['fish','harvests','watered','rests'].map(k=>[k,Math.max(0,(totals[k]||0)-(baseline.totals[k]||0))]));
 if(!projects.length&&!Object.values(gathered).some(Boolean))return after;
 const report={id:`return:${baseline.wall}:${wall}`,from:baseline.wall,to:wall,projects,gathered,read:false};
 return {...after,reports:[...(after.reports||[]).filter(r=>r.id!==report.id),report].slice(-10)};
}
