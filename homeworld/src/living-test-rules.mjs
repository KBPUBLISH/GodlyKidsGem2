// Separate from the real game's storage, economy, and character selection.
export const PLAYER_ID = 'you';
export const REQUESTS = [
  { id: 'first-camp', friend: 'you', name: 'You', item: 'wood', count: 3,
    title: 'Build your prayer tent', ask: 'This is your island! Cut down 3 trees, then bring the wood to the glowing circle.',
    action: 'Cut down 3 trees', delivery: 'Step onto your tent circle', thanks: 'You did it! Your prayer tent is ready.' },
  { id: 'garden-carrots', friend: 'adam', name: 'Adam', item: 'carrot', count: 4,
    title: 'Something good to share', ask: 'I’m glad to be here! Will you pick 4 carrots? We can share a meal by your tent.',
    action: 'Walk near the ripe carrots', delivery: 'Step onto the tent circle', thanks: 'Thank you! It’s good to have a friend beside you.' },
  { id: 'home-wood', friend: 'adam', name: 'Adam', item: 'wood', count: 3,
    title: 'A home for our adventures', ask: 'Could you bring 3 more logs to the home circle? I’ll build a little home for us.',
    action: 'Find a few more fallen logs', delivery: 'Step onto the home circle', thanks: 'Just what we needed. I’ll get started on our home!' },
];
export const RESOURCE_IDS = Object.freeze({
  'tree-1': 'wood', 'tree-2': 'wood', 'tree-3': 'wood',
  'log-1': 'wood', 'log-2': 'wood', 'log-3': 'wood',
  'log-4': 'wood', 'log-5': 'wood', 'log-6': 'wood',
  'carrot-1': 'carrot', 'carrot-2': 'carrot', 'carrot-3': 'carrot', 'carrot-4': 'carrot',
});

export function freshState() {
  return { version: 2, treeBaseline:null, player: { id: PLAYER_ID }, stage: 0, homeWork: 0, approvedBuildings: {}, adamUnlocked:false, adamArrived:false, inviteDismissed:false,welcomeSeen:false,
    inventory: { wood: 0, carrot: 0 }, deposits: { 'first-camp':0,'garden-carrots':0,'home-wood':0 }, gathered: [], helpDone: [], helpJob: null };
}

export function restoreState(value) {
  const clean = freshState();
  if (!value || value.version !== 2) return clean;
  clean.treeBaseline=Number.isInteger(value.treeBaseline)&&value.treeBaseline>=0?value.treeBaseline:null;
  clean.stage = Number.isInteger(value.stage) ? Math.max(0, Math.min(REQUESTS.length, value.stage)) : 0;
  clean.gathered = [...new Set(Array.isArray(value.gathered) ? value.gathered : [])].filter(id => Object.hasOwn(RESOURCE_IDS, id));
  // Reconstruct inventory from validated pickups and completed deliveries.
  for (const id of clean.gathered) clean.inventory[RESOURCE_IDS[id]]++;
  for (const task of REQUESTS.slice(0, clean.stage)) {
    if (clean.inventory[task.item] < task.count) return freshState();
    clean.inventory[task.item] -= task.count;
    clean.deposits[task.id] = task.count;
  }
  const task = REQUESTS[clean.stage];
  if (task) {
    const partial = value.deposits?.[task.id];
    const amount = Number.isInteger(partial) ? Math.max(0, Math.min(task.count - 1, partial)) : 0;
    if (clean.inventory[task.item] < amount) return freshState();
    clean.inventory[task.item] -= amount;
    clean.deposits[task.id] = amount;
  }
  if (clean.stage >= 3 && Number.isFinite(value.homeWork)) clean.homeWork = Math.max(0, Math.min(1, value.homeWork));
  clean.approvedBuildings=Object.fromEntries(['first-camp','home-wood'].filter(id=>value.approvedBuildings?.[id]===true).map(id=>[id,true]));
  for(const key of ['adamArrived','inviteDismissed','welcomeSeen'])clean[key]=value[key]===true;
  const helpIds=['weed','dig','water','trees','rocks'];
  clean.helpDone=[...new Set(Array.isArray(value.helpDone)?value.helpDone:[])].filter(id=>helpIds.includes(id));
  const job=value.helpJob,kinds={weed:'plant',dig:'plow',water:'water',trees:'chop',rocks:'mine'};
  if(job&&helpIds.includes(job.id)&&kinds[job.id]===job.kind){
    const count=Math.max(1,Math.min(20,job.count|0)),done=Math.max(0,Math.min(count,job.done|0));
    if(done<count)clean.helpJob={id:job.id,who:String(job.who||'Adam').slice(0,24),label:String(job.label||'Help').slice(0,80),kind:job.kind,count,done,base:job.base|0};
  }
  return clean;
}

export function currentRequest(state) { return state.stage>=1&&!state.adamUnlocked?null:REQUESTS[state.stage] || null; }
export function progress(state) {
  const task = currentRequest(state);
  return task ? Math.min(task.count, state.inventory[task.item] + state.deposits[task.id]) : 0;
}
export function readyToDeliver(state) {
  const task = currentRequest(state);
  return !!task && state.inventory[task.item] > 0;
}
export function activeResourceIds(state){
  if(!currentRequest(state))return [];
  return state.stage===0?[]:state.stage===1?['carrot-1','carrot-2','carrot-3','carrot-4']:['log-4','log-5','log-6'];
}
/** One durable starter wood receipt per fully felled tree, never per axe hit. */
export function starterTrees(state){
 return Math.min(3,state.gathered.filter(id=>/^(tree|log)-[123]$/.test(id)).length);
}
export function recordStarterTrees(state,totalTrees){
 if(state.stage!==0||!Number.isInteger(totalTrees)||totalTrees<0)return state;
 if(state.treeBaseline===null)return {...state,treeBaseline:totalTrees};
 const earned=Math.min(3,Math.max(0,totalTrees-state.treeBaseline));
 let next=state;
 for(let i=1;i<=earned&&starterTrees(next)<3;i++){
  const id=`tree-${i}`;if(next.gathered.includes(id))continue;
  next={...next,gathered:[...next.gathered,id],inventory:{...next.inventory,wood:next.inventory.wood+1}};
 }
 return next;
}
export function collect(state, resourceId, actor = PLAYER_ID) {
  const item = Object.hasOwn(RESOURCE_IDS, resourceId) ? RESOURCE_IDS[resourceId] : null;
  const task = currentRequest(state);
  const allowed=activeResourceIds(state);
  if (actor !== PLAYER_ID || !item || !task || task.item !== item || !allowed.includes(resourceId) || state.gathered.includes(resourceId)) return state;
  return { ...state, gathered: [...state.gathered, resourceId], inventory: { ...state.inventory, [item]: state.inventory[item] + 1 } };
}
export function deliver(state, friendId, actor = PLAYER_ID) {
  const task = currentRequest(state);
  if (actor !== PLAYER_ID || !task || task.friend !== friendId || !readyToDeliver(state)) return state;
  const delivered = state.deposits[task.id] + 1;
  return { ...state, stage: state.stage + (delivered === task.count ? 1 : 0),
    deposits: { ...state.deposits, [task.id]: delivered }, inventory: { ...state.inventory, [task.item]: state.inventory[task.item] - 1 } };
}

/** One instruction at a time; carried pickups count before they are delivered. */
export function guidance(state){
  const task=currentRequest(state);if(!task)return null;
  const found=state.deposits[task.id]+state.inventory[task.item],delivery=found>=task.count;
  if(state.stage===0&&!delivery)return {found:starterTrees(state),delivery:false,noun:'trees',label:'Cut down 3 trees',instruction:'Tap a tree to cut it down with your axe.',progress:`${starterTrees(state)} / 3 trees cut`};
  const noun=task.item==='wood'?'logs':'carrots',place=state.stage<2?'tent':'home';
  return {found,delivery,noun,label:delivery?`Take ${noun} to ${place}`:task.item==='wood'?'Find a log':'Find a carrot',
    instruction:delivery?'Tap the glowing circle. Your supplies go in by themselves.':task.item==='wood'?'Tap a log. Walk close to pick it up.':'Tap a carrot. Walk close to pick it up.',
    progress:delivery?`${state.deposits[task.id]} / ${task.count} delivered`:`${found} / ${task.count} ${noun} found`};
}
