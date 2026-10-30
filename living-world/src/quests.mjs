// Separate from the real game's storage, economy, and character selection.
export const SAVE_KEY = 'godlykids_living_world_playtest_v1';
export const PLAYER_ID = 'you';
export const REQUESTS = [
  { id: 'home-wood', friend: 'noah', name: 'Noah', item: 'wood', count: 3,
    title: 'A little help for Noah', ask: 'Could you bring me 3 logs? I’m making a cozy home for us.',
    action: 'Walk near the fallen logs', delivery: 'Step onto the home circle', thanks: 'Just what I needed! I’ll get started on our home.' },
  { id: 'garden-carrots', friend: 'eve', name: 'Eve', item: 'carrot', count: 4,
    title: 'Something good to share', ask: 'Will you pick 4 carrots? Let’s make a meal for everyone.',
    action: 'Walk near the ripe carrots', delivery: 'Step onto the kitchen circle', thanks: 'Thank you! A meal tastes even better with friends. Someone new is here!' },
  { id: 'welcome-flowers', friend: 'ruth', name: 'Ruth', item: 'flower', count: 3,
    title: 'Make yourself at home', ask: 'Let’s add a porch and flowers. Bring 3 flowers to the home circle, and I’ll make it cozy.',
    action: 'Walk near the yellow flowers', delivery: 'Step onto the home circle', thanks: 'Now it feels like home. I’m so glad we live here together.' },
];
export const DELIVERY_SITES = Object.freeze({
  noah: { x: -1.3, z: -1.6, label: 'Home' },
  eve: { x: 2.6, z: 1.6, label: 'Kitchen' },
  ruth: { x: -1.3, z: -1.6, label: 'Home' },
});
export const RESOURCE_IDS = Object.freeze({
  'log-1': 'wood', 'log-2': 'wood', 'log-3': 'wood',
  'carrot-1': 'carrot', 'carrot-2': 'carrot', 'carrot-3': 'carrot', 'carrot-4': 'carrot',
  'flower-1': 'flower', 'flower-2': 'flower', 'flower-3': 'flower',
});

export function freshState() {
  return { version: 1, player: { id: PLAYER_ID, x: 0, z: 2.8 }, stage: 0, homeWork: 0,
    inventory: { wood: 0, carrot: 0, flower: 0 }, deposits: { wood: 0, carrot: 0, flower: 0 }, gathered: [] };
}

export function restoreState(value) {
  const clean = freshState();
  if (!value || value.version !== 1) return clean;
  clean.stage = Number.isInteger(value.stage) ? Math.max(0, Math.min(REQUESTS.length, value.stage)) : 0;
  clean.gathered = [...new Set(Array.isArray(value.gathered) ? value.gathered : [])].filter(id => Object.hasOwn(RESOURCE_IDS, id));
  // Reconstruct inventory from validated pickups and completed deliveries.
  for (const id of clean.gathered) clean.inventory[RESOURCE_IDS[id]]++;
  for (const task of REQUESTS.slice(0, clean.stage)) {
    if (clean.inventory[task.item] < task.count) return freshState();
    clean.inventory[task.item] -= task.count;
    clean.deposits[task.item] = task.count;
  }
  const task = REQUESTS[clean.stage];
  if (task) {
    const partial = value.deposits?.[task.item];
    const amount = Number.isInteger(partial) ? Math.max(0, Math.min(task.count - 1, partial)) : 0;
    if (clean.inventory[task.item] < amount) return freshState();
    clean.inventory[task.item] -= amount;
    clean.deposits[task.item] = amount;
  }
  if (clean.stage >= 1 && Number.isFinite(value.homeWork)) clean.homeWork = Math.max(0, Math.min(1, value.homeWork));
  if (Number.isFinite(value.player?.x) && Number.isFinite(value.player?.z)) {
    clean.player.x = Math.max(-5.3, Math.min(5.3, value.player.x));
    clean.player.z = Math.max(-4.8, Math.min(5.3, value.player.z));
  }
  return clean;
}

export function currentRequest(state) { return REQUESTS[state.stage] || null; }
export function progress(state) {
  const task = currentRequest(state);
  return task ? Math.min(task.count, state.inventory[task.item] + state.deposits[task.item]) : 0;
}
export function readyToDeliver(state) {
  const task = currentRequest(state);
  return !!task && state.inventory[task.item] > 0;
}
export function collect(state, resourceId, actor = PLAYER_ID) {
  const item = Object.hasOwn(RESOURCE_IDS, resourceId) ? RESOURCE_IDS[resourceId] : null;
  const task = currentRequest(state);
  if (actor !== PLAYER_ID || !item || !task || task.item !== item || state.gathered.includes(resourceId)) return state;
  return { ...state, gathered: [...state.gathered, resourceId], inventory: { ...state.inventory, [item]: state.inventory[item] + 1 } };
}
export function deliver(state, friendId, actor = PLAYER_ID) {
  const task = currentRequest(state);
  if (actor !== PLAYER_ID || !task || task.friend !== friendId || !readyToDeliver(state)) return state;
  const delivered = state.deposits[task.item] + 1;
  return { ...state, stage: state.stage + (delivered === task.count ? 1 : 0),
    deposits: { ...state.deposits, [task.item]: delivered }, inventory: { ...state.inventory, [task.item]: state.inventory[task.item] - 1 } };
}
