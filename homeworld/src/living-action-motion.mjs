// Timed poses shared by the starter garden and ordinary garden actions.
// Coordinates are in the player's local space: +Z faces the work.
export const FARM_ACTION_SECONDS={plant:2.15,water:2.8,harvest:1.9};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const sample=(frames,t)=>{
 let i=1;while(i<frames.length-1&&t>frames[i][0])i++;
 const a=frames[i-1],b=frames[i],f=smooth((t-a[0])/(b[0]-a[0]));return mix(a[1],b[1],f);
};
// Each keyframe: dip, forward lean, right-hand XYZ, left-hand XYZ.
const POSES={
 plant:[
  [0,[0,0,-.29,.62,.04,.29,.65,.08]],
  [.5,[.18,.48,-.10,.72,.30,.27,.73,.28]],
  [.85,[.21,.58,-.14,.42,.58,.26,.70,.30]],
  [1.25,[.21,.58,.06,.40,.63,.26,.70,.30]],
  [1.55,[.18,.48,-.10,.34,.62,.26,.70,.30]],
  [2.15,[0,0,-.29,.62,.04,.29,.65,.08]],
 ],
 water:[
  [0,[0,0,-.29,.62,.04,.29,.65,.08]],
  [.6,[.06,.18,-.17,.94,.36,.14,.88,.44]],
  [1.1,[.08,.23,-.16,.87,.43,.15,.81,.50]],
  [1.9,[.08,.23,-.09,.87,.45,.20,.81,.49]],
  [2.3,[.04,.12,-.17,.98,.32,.14,.92,.40]],
  [2.8,[0,0,-.29,.62,.04,.29,.65,.08]],
 ],
 harvest:[
  [0,[0,0,-.29,.62,.04,.29,.65,.08]],
  [.55,[.22,.58,-.14,.34,.60,.14,.34,.60]],
  [.8,[.22,.58,-.14,.34,.60,.14,.34,.60]],
  [1.15,[.05,.14,-.12,.96,.36,.12,.96,.36]],
  [1.5,[.015,.04,-.12,1.02,.32,.12,1.02,.32]],
  [1.9,[0,0,-.29,.62,.04,.29,.65,.08]],
 ],
};
export function farmActionSample(kind,seconds){
 const duration=FARM_ACTION_SECONDS[kind];if(!duration)return null;
 const t=Number.isFinite(seconds)?Math.max(0,Math.min(duration,seconds)):0;
 const p=sample(POSES[kind],t),pour=kind==='water'?smooth((t-.6)/.25)*(1-smooth((t-2.05)/.25)):0;
 return {kind,duration,time:t,done:seconds>=duration,dip:p[0],bend:p[1],right:p.slice(2,5),left:p.slice(5,8),
  tilt:pour*.75,pour,seeds:kind==='plant'&&t>=.72&&t<1.4,crop:kind==='harvest'&&t>=.83&&t<1.65,
  headNod:p[1]*.3,pat:kind==='plant'?Math.sin(Math.max(0,t-1.3)*18)*.018*smooth((t-1.3)/.1)*(1-smooth((t-1.65)/.12)):0};
}
