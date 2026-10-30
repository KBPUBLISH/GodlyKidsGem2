import { buildSiteStatus, cellAt, cellFromKey, Navigation } from './core.mjs';

// Uses the actual map's placement and navigation rules; never clears scenery to fit a test.
export function livingTestLayout(world, state) {
  const nav = new Navigation(world, state), start = state.player;
  let camp=null;
  let home = null;
  const origin = cellAt(world, start.x, start.y);
  for(let radius=1;radius<=16&&!camp;radius++)for(let dx=-radius;dx<=radius&&!camp;dx++)for(const dy of [-radius,radius]){
    const plan={kind:'campfire',key:`${origin.col+dx}:${origin.row+dy}`,rotation:0},site=buildSiteStatus(world,state,plan);
    if(!site.ok)continue;
    const pad=nav.nearest({x:site.footprint.center.x,y:site.footprint.y-1},2);
    if(pad&&nav.path(start,pad)){camp={plan,baseHeight:site.baseHeight,pad};break;}
  }
  if(!camp)throw new Error('No clear camp site was found on this island.');
  for (let radius = 3; radius <= 32 && !home; radius++) {
    for (let dx = -radius; dx <= radius && !home; dx++) {
      for (const dy of [-radius, radius]) {
        const plan = { kind: 'hut', key: `${origin.col + dx}:${origin.row + dy}`, rotation: 0 };
        const site = buildSiteStatus(world, state, plan);
        if (!site.ok) continue;
        const center = site.footprint.center;
        const pad = nav.nearest({ x: center.x, y: site.footprint.y - 1.1 }, 3);
        if (pad && nav.path(start, pad)) { home = { plan, baseHeight: site.baseHeight, pad }; break; }
      }
    }
  }
  if (!home) throw new Error('No clear home site found on this island. Your existing worlds have not changed.');
  const used = [home.pad,...world.gardenSlots.map(slot=>cellFromKey(world,slot.key))], points = [];
  const find = (desired, distance = 1.25) => {
    for (let ring = 0; ring <= 8; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const p = nav.nearest({ x: desired.x + Math.cos(a) * ring, y: desired.y + Math.sin(a) * ring }, 1);
        if (!p || used.some(q => Math.hypot(q.x-p.x,q.y-p.y) < distance) || !nav.path(start,p)) continue;
        used.push(p); return p;
      }
    }
    throw new Error('A test supply could not be placed on reachable land.');
  };
  for (const [id, type, dx, dy] of [
    ['log-1','wood',-3,-1],['log-2','wood',-4,1],['log-3','wood',-2,2],
    ['log-4','wood',4,4],['log-5','wood',5,4],['log-6','wood',6,4],
    ['carrot-1','carrot',2,2],['carrot-2','carrot',3,2],['carrot-3','carrot',2,3],['carrot-4','carrot',3,3],
  ]) points.push({ id, type, ...find({x:start.x+dx,y:start.y+dy}) });
  const kitchen = find({x:start.x+5,y:start.y+1},2);
  const farmPad=find({x:start.x+2,y:start.y-2},2);
  const farmSpots=Array.from({length:8},(_,i)=>find({x:farmPad.x+(i%4-1.5)*1.5,y:farmPad.y+Math.floor(i/4)*2},1.3));
  return { home, camp, kitchen, points, farmPad, farmSpots };
}
