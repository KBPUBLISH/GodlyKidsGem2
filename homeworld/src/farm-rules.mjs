/**
 * Adam's farm brain — the pure rules (no three.js, no network, safe for node tests).
 *
 * Adam runs the farm on his own: he plans a paddock (a fence ring) around the stable, puts a water
 * trough and a feed pile inside it before the last fence piece closes the ring, feeds and waters the
 * herd every morning, checks the fences at midday, counts everyone in at dusk, and gathers what the
 * animals give (eggs, milk, wool) into the island bag. The one thing he cannot do alone is get the
 * animals: those are bought by the kid with the app's gold coins (the parent app owns the balance),
 * so Adam raises a request (`nextRequest`) and the island shows his card. The runtime that acts on
 * these rules is farmer.js; the kid-facing card is farm-ui.jsx.
 *
 * Save slice: `state.farm.ranch` (see `ensureRanch`) — feed/water stocks, routine days, animal names,
 * the open request and the purchase log. Requests are mirrored into `state.village.requests` with a
 * generic shape (`upsertRequest`) so other friends' asks (Abel's fence wishes) can share one queue.
 */

/** Gold-coin price per head when Adam asks for animals. The parent app validates the same table (utils/islandShop.ts FARM_ANIMAL_PRICES). */
export const FARM_PRICES={chicken:60,sheep:150,goat:200,cow:300};
export const FARM_ANIMALS=Object.keys(FARM_PRICES);
/** Animals one stable keeps warm at night. Capacity grows with each extra stable. */
export const STABLE_CAPACITY=4;
/** Most animals Adam asks for in one go. */
export const MAX_REQUEST_QTY=2;
/** Grass inside the paddock per animal, on top of the stable's own footprint. */
export const PADDOCK_CELLS_PER_ANIMAL=3;
/** Smallest paddock interior (cells) so even an empty farm has room to graze. */
export const PADDOCK_MIN=4;
/** One wooden fence piece per ring cell. Kept in step with building.mjs `fence`. */
export const FENCE_KIND='fence';
export const FENCE_KINDS=new Set(['fence','brick_fence','brick']);
export const TROUGH_KIND='trough',FEED_KIND='feed_pile',STABLE_KIND='stable';
/** Feed units Adam puts in the pile per restock; a wheat from the garden tops it up further. */
export const FEED_PER_RESTOCK=4,FEED_PER_WHEAT=3,WATER_PER_FILL=4;
/** Daily use per animal. */
export const FEED_PER_ANIMAL=1,WATER_PER_ANIMAL=1;
/** How long Adam waits after a "Not now" before asking again (island minutes = one island day). */
export const ASK_AGAIN_MINUTES=1440;

/** New buildables for the farm. Spread into BUILDINGS in building.mjs; meshes live in farm-model.js. */
export const FARM_BUILDINGS=[
  {id:'trough',name:'Water Trough',category:'Fences',size:[2,1],height:.6,wood:4,stone:2,seconds:4,solid:true,instant:true,poster:'well',description:'A wooden trough Adam fills with water for the animals. Goes inside the paddock.'},
  {id:'feed_pile',name:'Feed Pile',category:'Fences',size:[1,1],height:.7,wood:2,stone:0,seconds:3,solid:true,instant:true,poster:'fence',description:'A heap of hay and grain for the herd. Adam tops it up every morning; wheat from the garden helps.'},
];

/** What each animal gives, once a day, when it was fed and watered the day before. */
export const PRODUCE={
  chicken:{item:'egg',name:'egg',plural:'eggs',per:1},
  cow:{item:'milk',name:'pail of milk',plural:'pails of milk',per:1},
  goat:{item:'milk',name:'pail of milk',plural:'pails of milk',per:1},
  sheep:{item:'wool',name:'bundle of wool',plural:'bundles of wool',per:1,everyDays:3},
};
/** Produce that counts as food for the island (stage tracker food counter). Wool is a material. */
export const PRODUCE_FOOD=new Set(['egg','milk']);

/** Silly names Adam gives new animals (canon: every chicken on the island has one). */
export const ANIMAL_NAMES={
  chicken:['Pip','Dot','Nugget','Henrietta','Waffles','Peep','Biscuit','Clucky','Pecky','Omelette','Fluff','Sunny'],
  sheep:['Baa-rbara','Woolly','Cloud','Marshmallow','Cotton','Fleece','Lamb Chop','Puff','Snowball','Shaun'],
  goat:['Billy','Nibbles','Gruff','Pebble','Hopper','Butter','Zig','Zag','Mischief','Cinnamon'],
  cow:['Moo-ry','Daisy','Buttercup','Clover','Pudding','Bella','Marigold','Oreo','Patches','Muffin'],
};

/* ---------------- grid helpers (keys are `${col}:${row}`, like building.mjs) ---------------- */
export const key=(c,r)=>`${c}:${r}`;
export const parseKey=k=>k.split(':').map(Number);
/** Cells of a rectangle {col,row,w,h}. */
export function rectKeys(rect){const out=[];for(let r=0;r<rect.h;r++)for(let c=0;c<rect.w;c++)out.push(key(rect.col+c,rect.row+r));return out;}
/** The one-cell ring just outside a rectangle. */
export function ringKeys(rect){
  const out=[],c0=rect.col-1,r0=rect.row-1,c1=rect.col+rect.w,r1=rect.row+rect.h;
  for(let c=c0;c<=c1;c++){out.push(key(c,r0));out.push(key(c,r1));}
  for(let r=r0+1;r<r1;r++){out.push(key(c0,r));out.push(key(c1,r));}
  return out;
}

/**
 * Plan the paddock around the stables: the interior rectangle, its fence ring and the gate cell.
 * `stables` are footprints {col,row,w,h} (building.mjs footprint). `capacity` is how many animals it
 * must graze. `cellOk(key)` says whether an interior cell may be grass under the paddock (grass, not
 * garden, no other building); `ringOk(key)` whether a fence may stand there (or already does).
 * Four orientations are tried (pasture below, above, right, left of the stables); the first with no
 * blocked ring cell wins, closest gate to `toward` first; otherwise the one with the fewest blocked cells
 * is returned with `blocked` listing them so Adam can clear trees or say what is in the way.
 */
export function paddockPlan(stables,capacity,{cellOk=()=>true,ringOk=()=>true,toward=null}={}){
  if(!stables?.length)return null;
  const minCol=Math.min(...stables.map(s=>s.col)),minRow=Math.min(...stables.map(s=>s.row));
  const maxCol=Math.max(...stables.map(s=>s.col+s.w)),maxRow=Math.max(...stables.map(s=>s.row+s.h));
  const bw=maxCol-minCol,bh=maxRow-minRow,stableCells=stables.reduce((n,s)=>n+s.w*s.h,0);
  const need=stableCells+Math.max(PADDOCK_MIN,capacity*PADDOCK_CELLS_PER_ANIMAL);
  const stableKeys=new Set(stables.flatMap(rectKeys));
  const options=[];
  for(const side of ['down','up','right','left']){
    const along=side==='down'||side==='up';
    const w=along?bw+2:Math.max(bw+1,Math.ceil(need/(bh+2)));
    const h=along?Math.max(bh+1,Math.ceil(need/w)):bh+2;
    const col=side==='right'?minCol:side==='left'?maxCol-w:minCol-1;
    const row=side==='down'?minRow:side==='up'?maxRow-h:minRow-1;
    const interior={col,row,w,h};
    const ring=ringKeys(interior);
    const gate=side==='down'?key(col+Math.floor(w/2),row+h):side==='up'?key(col+Math.floor(w/2),row-1):side==='right'?key(col+w,row+Math.floor(h/2)):key(col-1,row+Math.floor(h/2));
    const inside=rectKeys(interior).filter(k=>!stableKeys.has(k));
    const blocked=[...inside.filter(k=>!cellOk(k)).map(k=>({key:k,where:'inside'})),...ring.filter(k=>!ringOk(k)).map(k=>({key:k,where:'ring'}))];
    const [gc,gr]=parseKey(gate);
    const d=toward?Math.hypot(gc+.5-toward.col,gr+.5-toward.row):0;
    options.push({side,interior,ring,gate,inside,blocked,d});
  }
  options.sort((a,b)=>a.blocked.length-b.blocked.length||a.d-b.d);
  const best=options[0];
  return {...best,ok:best.blocked.length===0,cells:best.interior.w*best.interior.h,capacity};
}

/** Ring cells with no finished fence on them. `buildings` are save records (status, kind, key). */
export function fenceGaps(plan,buildings){
  if(!plan)return [];
  const fenced=new Set((buildings||[]).filter(b=>b&&b.status==='complete'&&FENCE_KINDS.has(b.kind)).map(b=>b.key));
  return plan.ring.filter(k=>!fenced.has(k));
}
/** Build order: the gate last so Adam can still walk in to put the trough and feed pile down. */
export function nextFenceKey(plan,buildings){
  const gaps=fenceGaps(plan,buildings);
  if(!gaps.length)return null;
  const rest=gaps.filter(k=>k!==plan.gate);
  return rest[0]||gaps[0];
}

/* ---------------- herd, capacity and readiness ---------------- */
export const completeOf=(state,kind)=>(state?.buildings||[]).filter(b=>b&&b.status==='complete'&&b.kind===kind);
export const farmAnimals=state=>(state?.animals||[]).filter(a=>a&&!a.wild&&FARM_PRICES[a.kind]!==undefined);
export const herdCount=state=>farmAnimals(state).length;
export const herdCapacity=state=>completeOf(state,STABLE_KIND).length*STABLE_CAPACITY;
export const roomFor=state=>Math.max(0,herdCapacity(state)-herdCount(state));
/** How many of `kind` Adam may add right now (stable room, and the per-request cap). */
export function allowedQty(state,qty){return Math.max(0,Math.min(MAX_REQUEST_QTY,qty|0,roomFor(state)));}
/** Price of a bundle; null when the kind is not for sale. */
export function bundlePrice(kind,qty){const unit=FARM_PRICES[kind];return unit===undefined?null:unit*Math.max(0,qty|0);}

/** The ranch slice with defaults filled in (pure). */
export function ensureRanch(farm){
  const r=farm?.ranch||{};
  return {feed:0,water:0,fedDay:-1,wateredDay:-1,checkedDay:-1,herdedDay:-1,producedDay:-1,askAgainAt:0,names:{},request:null,purchases:[],gathered:{},...r};
}

/**
 * Everything Adam (and the card) needs to know about the farm right now. `plan` is the paddock plan
 * for the current stables (or null). Readiness for animals = ring closed, trough and feed pile in
 * place, something in the pile and in the trough, and room in the stable.
 */
export function farmStatus(state,plan){
  const ranch=ensureRanch(state?.farm);
  const stables=completeOf(state,STABLE_KIND).length;
  const gaps=plan?fenceGaps(plan,state?.buildings):[];
  const trough=completeOf(state,TROUGH_KIND).length>0,feedPile=completeOf(state,FEED_KIND).length>0;
  const herd=herdCount(state),capacity=herdCapacity(state),room=Math.max(0,capacity-herd);
  const fenced=!!plan&&plan.ok&&gaps.length===0;
  const steps=[
    {id:'stable',label:'A stable',done:stables>0},
    {id:'fence',label:'A fence all the way round',done:fenced,detail:plan?`${plan.ring.length-gaps.length} of ${plan.ring.length} fence pieces`:''},
    {id:'trough',label:'A water trough',done:trough},
    {id:'feed',label:'A feed pile',done:feedPile},
    {id:'stocked',label:'Food and water in them',done:ranch.feed>0&&ranch.water>0},
  ];
  const waiting=steps.find(s=>!s.done)||null;
  const ready=!waiting&&room>0;
  return {stables,fenced,gaps:gaps.length,ring:plan?plan.ring.length:0,trough,feedPile,feed:ranch.feed,water:ranch.water,herd,capacity,room,steps,waiting,ready,
    reason:ready?null:waiting?waiting.label:'The stable is full — Adam wants another one.'};
}

/**
 * The next animals Adam would ask the kid for, given the herd he already has: a couple of chickens
 * first (cheap, and he loves naming them), then a sheep, more chickens, a goat, then a cow; after that
 * he alternates. Quantity is capped by stable room. Null when there is no room.
 */
export function nextRequest(state){
  const room=roomFor(state);if(room<=0)return null;
  const have=Object.fromEntries(FARM_ANIMALS.map(k=>[k,0]));
  for(const a of farmAnimals(state))have[a.kind]++;
  const ladder=[['chicken',2],['sheep',1],['chicken',2],['goat',1],['cow',1],['sheep',1],['chicken',2],['goat',1],['cow',1]];
  const want=Object.fromEntries(FARM_ANIMALS.map(k=>[k,0]));
  let pick=null;
  for(const [kind,qty] of ladder){want[kind]+=qty;if(have[kind]<want[kind]){pick=[kind,Math.min(qty,want[kind]-have[kind])];break;}}
  if(!pick)pick=[FARM_ANIMALS[herdCount(state)%FARM_ANIMALS.length],1];
  const [kind,qty]=pick,n=allowedQty(state,qty);
  if(!n)return null;
  return {kind,qty:n,price:bundlePrice(kind,n)};
}

/** "two chickens", "a sheep", "a cow". */
export function describeBundle(kind,qty){
  const names={chicken:['chicken','chickens'],sheep:['sheep','sheep'],goat:['goat','goats'],cow:['cow','cows']}[kind]||[kind,`${kind}s`];
  const words=['zero','one','two','three','four','five','six'];
  return qty===1?`${/^[aeiou]/.test(names[0])?'an':'a'} ${names[0]}`:`${words[qty]||qty} ${names[1]}`;
}
/** Adam's own words for the card (canon voice: curious, names things, thanks God). */
export function requestLine(kind,qty,status){
  const what=describeBundle(kind,qty);
  if(status?.herd===0)return `The paddock is ready! Could we get ${what}? I already have names picked out.`;
  if(kind==='chicken')return `There is room for ${what} more. I keep thinking of names for them!`;
  if(kind==='cow')return `Could we bring home ${what}? Milk for everyone — God is so good to us.`;
  return `Could we bring home ${what}? The paddock has room, and I would love to name ${qty===1?'it':'them'}.`;
}

/** Names for `qty` new animals of `kind`, skipping names already given. Deterministic per `seed` so a reload picks the same. */
export function pickNames(kind,qty,taken=[],seed=0){
  const pool=ANIMAL_NAMES[kind]||ANIMAL_NAMES.chicken,used=new Set(taken),out=[];
  let i=Math.abs(seed|0)%pool.length;
  for(let tries=0;out.length<qty&&tries<pool.length*2;tries++,i=(i+1)%pool.length){
    const name=pool[i];
    if(used.has(name)||out.includes(name))continue;
    out.push(name);
  }
  let n=2;
  while(out.length<qty){out.push(`${pool[out.length%pool.length]} ${n++}`);}
  return out;
}
/** "Pip and Dot", "Pip, Dot and Nugget". */
export function joinNames(names){
  if(!names.length)return '';if(names.length===1)return names[0];
  return `${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;
}
/** Feed-notice line for new arrivals. */
export function arrivalLine(kind,names){
  const n=names.length;
  const what=describeBundle(kind,n);
  const cap=what.charAt(0).toUpperCase()+what.slice(1);
  return `${cap} joined the farm — Adam named ${n===1?'it':'them'} ${joinNames(names)}.`;
}

/**
 * What the herd gives today. Only animals fed and watered yesterday produce (`fedDay`/`wateredDay`
 * equal `day-1`). Sheep give wool every few days (by animal id so the flock staggers). Returns
 * {items:{egg:n,...}, food:n, lines:[...]}.
 */
export function dailyProduce(state,day){
  const ranch=ensureRanch(state?.farm);
  const out={items:{},food:0,lines:[]};
  if(ranch.fedDay!==day-1||ranch.wateredDay!==day-1)return out;
  for(const a of farmAnimals(state)){
    const p=PRODUCE[a.kind];if(!p)continue;
    if(p.everyDays){let h=0;for(const ch of String(a.id))h=(h*31+ch.charCodeAt(0))>>>0;if((day+h)%p.everyDays!==0)continue;}
    out.items[p.item]=(out.items[p.item]||0)+p.per;
    if(PRODUCE_FOOD.has(p.item))out.food+=p.per;
  }
  for(const [item,n] of Object.entries(out.items)){
    const p=Object.values(PRODUCE).find(x=>x.item===item);
    out.lines.push(n===1?`${/^[aeiou]/.test(p.name)?'an':'a'} ${p.name}`:`${n} ${p.plural}`);
  }
  return out;
}

/* ---------------- shared request queue (state.village.requests) ---------------- */
/**
 * One queue for every friend's ask: {id, kind, from, to, text, status:'open'|'done'|'declined', createdAt, data}.
 * Abel's fence wishes and Adam's paddock work use the same shape; `upsertRequest` replaces by id.
 */
export function upsertRequest(village,req){
  const list=Array.isArray(village?.requests)?village.requests:[];
  const next=list.filter(r=>r&&r.id!==req.id);
  next.push({status:'open',createdAt:Date.now(),...req});
  return {...(village||{}),requests:next.slice(-24)};
}
export function closeRequest(village,id,status='done'){
  const list=Array.isArray(village?.requests)?village.requests:[];
  if(!list.some(r=>r&&r.id===id))return village||{};
  return {...(village||{}),requests:list.map(r=>r&&r.id===id?{...r,status,resolvedAt:Date.now()}:r)};
}
export const openRequests=(village,from=null)=>(Array.isArray(village?.requests)?village.requests:[]).filter(r=>r&&r.status==='open'&&(!from||r.from===from));
