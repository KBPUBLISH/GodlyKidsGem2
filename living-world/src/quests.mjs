// Separate from the real game's storage, economy, and character selection.
export const SAVE_KEY = 'godlykids_living_world_playtest_v1';
export const PLAYER_ID = 'you';
export const REQUESTS = [
  { id: 'home-wood', friend: 'noah', name: 'Noah', item: 'wood', count: 3,
    title: 'A little help for Noah', ask: 'Could you bring me 3 logs? I’m making a cozy home for us.',
    action: 'Tap the fallen logs', delivery: 'Bring your logs to Noah', thanks: 'Just what I needed! I’ll get started on our home.' },
  { id: 'garden-carrots', friend: 'eve', name: 'Eve', item: 'carrot', count: 4,
    title: 'Something good to share', ask: 'Will you pick 4 carrots? Let’s make a meal for everyone.',
    action: 'Tap the carrots in the garden', delivery: 'Bring your carrots to Eve', thanks: 'Thank you! A meal tastes even better with friends. Someone new is here!' },
  { id: 'welcome-flowers', friend: 'ruth', name: 'Ruth', item: 'flower', count: 3,
    title: 'Make yourself at home', ask: 'It’s lovely here! Could we put 3 flowers beside our new home?',
    action: 'Tap the little yellow flowers', delivery: 'Bring your flowers to Ruth', thanks: 'Now it feels like home. I’m so glad we live here together.' },
];
export const RESOURCE_IDS = Object.freeze({
  'log-1': 'wood', 'log-2': 'wood', 'log-3': 'wood',
  'carrot-1': 'carrot', 'carrot-2': 'carrot', 'carrot-3': 'carrot', 'carrot-4': 'carrot',
  'flower-1': 'flower', 'flower-2': 'flower', 'flower-3': 'flower',
});

export function freshState() {
  return { version: 1, player: { id: PLAYER_ID, x: 0, z: 2.8 }, stage: 0, homeWork: 0,
    inventory: { wood: 0, carrot: 0, flower: 0 }, gathered: [] };
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
  return task ? Math.min(task.count, state.inventory[task.item]) : 0;
}
export function readyToDeliver(state) {
  const task = currentRequest(state);
  return !!task && progress(state) === task.count;
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
  return { ...state, stage: state.stage + 1, inventory: { ...state.inventory, [task.item]: state.inventory[task.item] - task.count } };
}
