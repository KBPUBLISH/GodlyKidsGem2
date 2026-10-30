// Separate from the real game's storage, economy, and character selection.
export const PLAYER_ID = 'you';
export const REQUESTS = [
  { id: 'first-camp', friend: 'you', name: 'You', item: 'wood', count: 3,
    title: 'Make your first little camp', ask: 'This is your island! Walk near 3 logs to pick them up, then bring them to the glowing circle.',
    action: 'Walk near the fallen logs', delivery: 'Step onto your camp circle', thanks: 'You did it! Your first little camp is ready.' },
  { id: 'garden-carrots', friend: 'adam', name: 'Adam', item: 'carrot', count: 4,
    title: 'Something good to share', ask: 'I’m glad to be here! Will you pick 4 carrots? We can share a meal at your camp.',
    action: 'Walk near the ripe carrots', delivery: 'Step onto the camp circle', thanks: 'Thank you! It’s good to have a friend beside you.' },
  { id: 'home-wood', friend: 'adam', name: 'Adam', item: 'wood', count: 3,
    title: 'A home for our adventures', ask: 'Could you bring 3 more logs to the home circle? I’ll build a little home for us.',
    action: 'Find a few more fallen logs', delivery: 'Step onto the home circle', thanks: 'Just what we needed. I’ll get started on our home!' },
];
export const RESOURCE_IDS = Object.freeze({
  'log-1': 'wood', 'log-2': 'wood', 'log-3': 'wood',
  'log-4': 'wood', 'log-5': 'wood', 'log-6': 'wood',
  'carrot-1': 'carrot', 'carrot-2': 'carrot', 'carrot-3': 'carrot', 'carrot-4': 'carrot',
});

export function freshState() {
  return { version: 2, player: { id: PLAYER_ID }, stage: 0, homeWork: 0, adamUnlocked:false, adamArrived:false, inviteDismissed:false,welcomeSeen:false,
    inventory: { wood: 0, carrot: 0 }, deposits: { 'first-camp':0,'garden-carrots':0,'home-wood':0 }, gathered: [] };
}

export function restoreState(value) {
  const clean = freshState();
  if (!value || value.version !== 2) return clean;
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
  for(const key of ['adamArrived','inviteDismissed','welcomeSeen'])clean[key]=value[key]===true;
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
  return state.stage===0?['log-1','log-2','log-3']:state.stage===1?['carrot-1','carrot-2','carrot-3','carrot-4']:['log-4','log-5','log-6'];
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
  const noun=task.item==='wood'?'logs':'carrots',place=state.stage<2?'camp':'home';
  return {found,delivery,noun,label:delivery?`Take ${noun} to ${place}`:task.item==='wood'?'Find a log':'Find a carrot',
    instruction:delivery?'Tap the glowing circle. Your supplies go in by themselves.':task.item==='wood'?'Tap a log. Walk close to pick it up.':'Tap a carrot. Walk close to pick it up.',
    progress:delivery?`${state.deposits[task.id]} / ${task.count} delivered`:`${found} / ${task.count} ${noun} found`};
}
