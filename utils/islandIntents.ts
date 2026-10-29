/**
 * Turns what a kid types or taps into something an island character can do.
 *
 * Pure and deterministic so the game never waits on the AI to start a job:
 * "chop 3 trees", "go catch us some fish", "can you water the garden please",
 * "break rocks", "plant carrots", "build a campfire", "are you tired?".
 */

import { scopedKey } from './profileScope';

export type IslandTaskType =
  | 'chop' | 'mine' | 'fish' | 'water' | 'plow' | 'plant' | 'harvest'
  | 'eat' | 'rest' | 'sleep' | 'cook' | 'stoke' | 'build' | 'craft' | 'stop' | 'pause' | 'resume';

export type IslandTask = {
  type: IslandTaskType;
  /** chop: store|clear|few · mine: stone|copper|iron|diamond|any · water: all|one · fish: one|few */
  goal?: string;
  count?: number;
  /** plant: seed id · eat: food id · cook: recipe id · build: building id */
  item?: string;
};

export type IslandIntent =
  | { kind: 'task'; task: IslandTask; needsGoal: boolean }
  | { kind: 'ask'; topic: 'energy' | 'wood' | 'food' | 'time' | 'buildings' | 'inventory' | 'doing' | 'fire' }
  | { kind: 'chat' };

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  couple: 2, few: 3, several: 4, dozen: 12,
};

export const SEED_WORDS: Record<string, string> = {
  carrot: 'carrot_seed', carrots: 'carrot_seed',
  wheat: 'wheat_seed', grain: 'wheat_seed',
  sunflower: 'sunflower_seed', sunflowers: 'sunflower_seed',
  pumpkin: 'pumpkin_seed', pumpkins: 'pumpkin_seed',
  pine: 'pine_seed', oak: 'oak_acorn', acorn: 'oak_acorn', acorns: 'oak_acorn',
  maple: 'maple_samara', apple: 'apple_seed', apples: 'apple_seed',
  coconut: 'coconut', palm: 'coconut',
};

const FOOD_WORDS: Record<string, string> = {
  carrot: 'carrot', carrots: 'carrot', pumpkin: 'pumpkin', pumpkins: 'pumpkin',
  fish: 'cooked_fish', 'grilled fish': 'cooked_fish', bread: 'bread', loaf: 'bread',
};

export const BUILDING_WORDS: Record<string, string> = {
  hut: 'hut', house: 'hut', home: 'hut', cottage: 'cottage', townhouse: 'townhouse',
  church: 'church', tent: 'tent', chest: 'chest', 'storage chest': 'chest',
  'wood bin': 'wood_store_20', bin: 'wood_store_20', 'log rack': 'wood_store_50', rack: 'wood_store_50',
  'wood shed': 'wood_store_100', shed: 'wood_store_100', barn: 'wood_store_200', 'timber barn': 'wood_store_200',
  'wood store': 'wood_store_20', 'garden bed': 'garden', garden: 'garden',
  path: 'path', 'stone path': 'path', fence: 'fence', campfire: 'campfire', fire: 'campfire', bonfire: 'campfire',
};

const MINERAL_WORDS: Record<string, string> = {
  stone: 'stone', stones: 'stone', copper: 'copper', iron: 'iron', diamond: 'diamond', diamonds: 'diamond', gem: 'diamond', gems: 'diamond', treasure: 'diamond',
};

const clean = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const has = (t: string, re: RegExp) => re.test(t);

function countIn(t: string): number | undefined {
  const digit = t.match(/\b(\d{1,2})\b/);
  if (digit) return Math.max(1, Math.min(20, parseInt(digit[1], 10)));
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (w === 'a' || w === 'an') continue;
    if (new RegExp(`\\b${w}\\b`).test(t)) return n;
  }
  return undefined;
}

function firstMatch(t: string, words: Record<string, string>): string | undefined {
  // longest phrase wins ("wood shed" before "shed")
  const keys = Object.keys(words).sort((a, b) => b.length - a.length);
  for (const k of keys) if (new RegExp(`\\b${k}\\b`).test(t)) return words[k];
  return undefined;
}

/** Classify a message. Never throws; unknown text is just chat. */
export function parseIslandIntent(input: string): IslandIntent {
  const t = clean(input);
  if (!t) return { kind: 'chat' };

  // ---- controls ----
  if (has(t, /\b(stop|quit|enough|that'?s enough|never ?mind|cancel|halt)\b/) && !has(t, /\bdon'?t stop\b/)) return { kind: 'task', task: { type: 'stop' }, needsGoal: false };
  if (has(t, /\b(pause|hold on|wait|take five|time ?out)\b/)) return { kind: 'task', task: { type: 'pause' }, needsGoal: false };
  if (has(t, /\b(resume|keep going|continue|carry on|go on|back to work|unpause)\b/)) return { kind: 'task', task: { type: 'resume' }, needsGoal: false };

  // ---- questions about the world (answered from game state, no AI needed) ----
  const asking = has(t, /\b(how|what|are you|do you|is there|is it|is the|have you|got any|any)\b/) || /\?\s*$/.test(input);
  if (asking) {
    if (has(t, /\b(tired|energy|sleepy|rested|strong|feel)\b/)) return { kind: 'ask', topic: 'energy' };
    if (has(t, /\b(doing|up to|working on|busy)\b/)) return { kind: 'ask', topic: 'doing' };
    if (has(t, /\b(wood|logs?|lumber|timber)\b/) && !has(t, /\b(chop|cut|get|fetch|bring|gather|collect)\b/)) return { kind: 'ask', topic: 'wood' };
    if (has(t, /\b(food|hungry|snacks?|eat|fish|carrots?|pumpkins?|bread)\b/) && !has(t, /\b(catch|go|get|pick|harvest|cook|grill|bake|make)\b/)) return { kind: 'ask', topic: 'food' };
    if (has(t, /\b(time|day|night|clock|late|morning|bedtime)\b/)) return { kind: 'ask', topic: 'time' };
    if (has(t, /\b(fire|campfire|flames?)\b/) && has(t, /\b(lit|burning|going|out|low|still|alive|need)\b/) && !has(t, /\b(build|make|put up|add|put|throw)\b/)) return { kind: 'ask', topic: 'fire' };
    if (has(t, /\b(built|buildings?|houses?|homes?|hut|tent|campfire)\b/) && !has(t, /\b(build|make|put up)\b/)) return { kind: 'ask', topic: 'buildings' };
    if (has(t, /\b(bag|inventory|carrying|items?|stuff|seeds?|stone|have)\b/) && !has(t, /\b(plant|mine|dig|get)\b/)) return { kind: 'ask', topic: 'inventory' };
  }

  const count = countIn(t);

  // ---- sleep / rest / eat (character needs) ----
  if (has(t, /\b(sleep|nap|bed|bedtime|go home|lie down|rest up for the night|good ?night)\b/) && !has(t, /\b(build|make)\b/)) return { kind: 'task', task: { type: 'sleep' }, needsGoal: false };
  if (has(t, /\b(rest|breather|take a break|sit down|relax|chill)\b/)) return { kind: 'task', task: { type: 'rest' }, needsGoal: false };
  if (has(t, /\b(eat|snack|have some|munch|lunch|dinner|breakfast|supper)\b/) && !has(t, /\b(catch|cook|grill|bake|make)\b/)) {
    return { kind: 'task', task: { type: 'eat', item: firstMatch(t, FOOD_WORDS) }, needsGoal: false };
  }

  // ---- campfire ----
  if (!has(t, /\b(chop|cut|fell|build|make)\b/) && ((has(t, /\b(fire|campfire|flames?|bonfire)\b/) && has(t, /\b(logs?|wood|stoke|feed|fuel|relight|re-light|light|keep|going|burning|add|put|throw|top)\b/)) || has(t, /\bstoke\b/))) return { kind: 'task', task: { type: 'stoke' }, needsGoal: false };
  // ---- cooking ----
  if (has(t, /\b(grill|cook|fry|roast)\b/) && has(t, /\bfish\b/)) return { kind: 'task', task: { type: 'cook', item: 'grill_fish' }, needsGoal: false };
  if (has(t, /\b(bake|make|cook)\b/) && has(t, /\b(bread|loaf)\b/)) return { kind: 'task', task: { type: 'cook', item: 'bake_bread' }, needsGoal: false };
  if (has(t, /\b(cook|grill|bake)\b/)) return { kind: 'task', task: { type: 'cook' }, needsGoal: true };

  // ---- tools ----
  if (has(t, /\b(better|stronger|new|upgrade|craft|make|forge)\b/) && has(t, /\b(tools?|axe|pickaxe|hoe)\b/)) return { kind: 'task', task: { type: 'craft' }, needsGoal: false };

  // ---- building ----
  if (has(t, /\b(build|construct|put up|set up|make)\b/) && !has(t, /\b(plot|spot|patch)\b/)) {
    const item = firstMatch(t, BUILDING_WORDS);
    if (item || has(t, /\b(building|something|anything)\b/)) return { kind: 'task', task: { type: 'build', item }, needsGoal: !item };
  }

  // ---- garden ----
  if (has(t, /\bwater(ing)?\b/) && !has(t, /\b(fish|swim|drink)\b/)) {
    return { kind: 'task', task: { type: 'water', goal: count === 1 || has(t, /\b(one|a plant|that plant|this plant)\b/) ? 'one' : 'all', count }, needsGoal: false };
  }
  if (has(t, /\b(harvest|pick|gather|collect)\b/) && has(t, /\b(crops?|carrots?|pumpkins?|wheat|sunflowers?|garden|veg|vegetables?|food|harvest)\b/)) return { kind: 'task', task: { type: 'harvest', count }, needsGoal: false };
  if (has(t, /\b(plant|sow|seed|grow)\b/) && !has(t, /\b(water)\b/)) {
    const item = firstMatch(t, SEED_WORDS);
    return { kind: 'task', task: { type: 'plant', item, count }, needsGoal: !item };
  }
  if (has(t, /\b(dig|plow|plough|till|hoe)\b/) || has(t, /\b(make|start|prepare)\b.*\b(garden|plot|spot|bed)\b/)) return { kind: 'task', task: { type: 'plow', count }, needsGoal: false };

  // ---- fishing ----
  if (has(t, /\b(fish|fishing|dock|rod)\b/) && !has(t, /\b(eat|cook|grill)\b/)) {
    return { kind: 'task', task: { type: 'fish', goal: count && count > 1 ? 'few' : 'one', count: count || 1 }, needsGoal: false };
  }

  // ---- mining ----
  if (has(t, /\b(rocks?|boulders?|mine|mining|pickaxe|smash|ore|veins?)\b/) || firstMatch(t, MINERAL_WORDS)) {
    const goal = firstMatch(t, MINERAL_WORDS) || 'any';
    return { kind: 'task', task: { type: 'mine', goal, count: count || 1 }, needsGoal: false };
  }

  // ---- wood ----
  if (has(t, /\b(chop|cut|fell|axe|wood|logs?|lumber|timber|trees?|firewood)\b/)) {
    let goal: string | undefined;
    if (has(t, /\b(store|storage|fill|stock)\b/)) goal = 'store';
    else if (has(t, /\b(clear|land|space|room|build)\b/)) goal = 'clear';
    else if (count || has(t, /\b(few|some|a bit|little)\b/)) goal = 'few';
    return { kind: 'task', task: { type: 'chop', goal, count }, needsGoal: !goal };
  }

  return { kind: 'chat' };
}

/** What the character says as they pick up the tool. */
export function taskGoLine(task: IslandTask, name = 'I'): string {
  const n = task.count && task.count > 1 ? task.count : null;
  switch (task.type) {
    case 'chop': return task.goal === 'store' ? "I'll fill the wood store. Axe time!" : task.goal === 'clear' ? "I'll clear that land. Grabbing my axe!" : n ? `${n} trees coming up. Axe time!` : 'On it! Grabbing my axe.';
    case 'mine': return task.goal && task.goal !== 'any' ? `Looking for ${task.goal}. Pickaxe ready!` : n ? `${n} rocks? Pickaxe ready!` : 'Smash time! Grabbing my pickaxe.';
    case 'fish': return n ? `${n} fish, coming right up. Off to the dock!` : "Rod's ready. Off to the dock!";
    case 'water': return task.goal === 'one' ? 'One thirsty plant, got it.' : "I'll water every thirsty plant.";
    case 'plow': return n ? `I'll dig ${n} garden spots.` : "I'll dig a garden spot. Where's my hoe?";
    case 'plant': return `Planting ${task.item ? task.item.replace(/_.*$/, '').replace('coconut', 'coconut palm') : 'seeds'} right away!`;
    case 'harvest': return "Let's pick what's ready!";
    case 'eat': return task.item ? "Yum, I'll have one now." : "I'll grab a snack.";
    case 'rest': return 'A little breather. Back soon!';
    case 'sleep': return "Good idea. I'm heading home to rest.";
    case 'cook': return task.item === 'bake_bread' ? "I'll bake a loaf." : "I'll grill that fish on the campfire.";
    case 'stoke': return "On it! I'll put a log on the campfire.";
    case 'build': return task.item ? `Let's build it! Tap the grass where it should go.` : 'What should we build?';
    case 'craft': return "Let me make stronger tools.";
    case 'stop': return 'Okay, stopping.';
    case 'pause': return 'Pausing. Say the word when you want me back.';
    case 'resume': return 'Back to work!';
  }
  return 'On it!';
}

/** Follow-up question when the job needs one more detail. */
export function taskGoalPrompt(task: IslandTask): { ask: string; options: { label: string; task: IslandTask }[] } | null {
  switch (task.type) {
    case 'chop': return { ask: "What's the wood for?", options: [
      { label: 'Fill the wood store', task: { ...task, goal: 'store' } },
      { label: 'Clear land for a building', task: { ...task, goal: 'clear' } },
      { label: 'Just a few logs', task: { ...task, goal: 'few' } },
    ] };
    case 'plant': return { ask: 'Which seed?', options: [
      { label: 'Carrots', task: { ...task, item: 'carrot_seed' } },
      { label: 'Wheat', task: { ...task, item: 'wheat_seed' } },
      { label: 'Pumpkins', task: { ...task, item: 'pumpkin_seed' } },
      { label: 'A tree', task: { ...task, item: 'oak_acorn' } },
    ] };
    case 'build': return { ask: 'What should we build?', options: [
      { label: 'Small Hut', task: { ...task, item: 'hut' } },
      { label: 'Campfire', task: { ...task, item: 'campfire' } },
      { label: 'Garden Bed', task: { ...task, item: 'garden' } },
      { label: 'Wood Bin', task: { ...task, item: 'wood_store_20' } },
    ] };
    case 'cook': return { ask: 'Grill fish or bake bread?', options: [
      { label: 'Grill fish', task: { ...task, item: 'grill_fish' } },
      { label: 'Bake bread', task: { ...task, item: 'bake_bread' } },
    ] };
  }
  return null;
}

/** Snapshot of the island the character "knows" while talking. Sent by the game. */
export type WorldBrief = {
  name: string;
  energy: number;
  wood: number;
  fish: number;
  food: Record<string, number>;
  seeds: Record<string, number>;
  minerals: Record<string, number>;
  buildings: string[];
  time: string | { day?: number; text?: string; hour?: number };
  day: number;
  night: boolean;
  working: string | null;
  canSleep: boolean;
  hasFire: boolean;
  /** A campfire is burning right now (each log lasts 2 island hours). */
  fireLit?: boolean;
  /** Island minutes of fuel left on the best-fed campfire. */
  fireMinutes?: number;
  tools: string;
  garden?: { ready: number; thirsty: number };
};

/** Answers a world question in one friendly line, from the brief alone. */
/** `time` arrives as either a label ("7:37 PM") or the island's `{text, hour}` object. */
export function worldTimeText(w?: WorldBrief | null): string {
  const t = w?.time;
  if (!t) return 'daytime';
  return typeof t === 'string' ? t : t.text || 'daytime';
}
export function worldHour(w?: WorldBrief | null): number {
  const t = w?.time;
  if (t && typeof t === 'object' && typeof t.hour === 'number') return t.hour;
  const text = worldTimeText(w);
  const h = parseInt(text.split(':')[0] || '12', 10);
  if (Number.isNaN(h)) return 12;
  return h + (/PM/i.test(text) && h !== 12 ? 12 : 0) - (/AM/i.test(text) && h === 12 ? 12 : 0);
}

export function answerWorldQuestion(topic: Exclude<IslandIntent, { kind: 'task' } | { kind: 'chat' }>['topic'], w: WorldBrief | null): string {
  if (!w) return "I'm not sure yet, let me look around.";
  const list = (o: Record<string, number>, names: Record<string, string> = {}) => Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${names[k] || k.replace(/_/g, ' ')}`).join(', ');
  switch (topic) {
    case 'energy': return w.energy >= 70 ? `I feel great, ${w.energy} energy!` : w.energy >= 30 ? `I'm okay, ${w.energy} energy left.` : `I'm pretty tired, only ${w.energy} energy. A snack or a sleep would help.`;
    case 'wood': return w.wood ? `We have ${w.wood} wood put away.` : "No wood yet. Want me to chop some?";
    case 'food': { const f = list(w.food, { cooked_fish: 'grilled fish' }); return f ? `In the bag: ${f}${w.fish ? `, plus ${w.fish} raw fish` : ''}.` : w.fish ? `${w.fish} raw fish, ready to grill.` : 'No food yet. I could fish or pick crops.'; }
    case 'time': return `It's ${worldTimeText(w)} on day ${w.day}${w.night ? ', night time' : ''}.`;
    case 'fire': return !w.hasFire ? "We don't have a campfire yet. Want me to build one?" : w.fireLit ? `Yes, the fire's burning${w.fireMinutes ? ` · about ${Math.max(1, Math.round(w.fireMinutes / 60 * 10) / 10)} hours of wood left` : ''}. Each log keeps it going for 2 hours.` : "The campfire is out. Say the word and I'll put a log on it.";
    case 'buildings': return w.buildings.length ? `We've built: ${w.buildings.join(', ')}.` : "Nothing built yet. Want to build a hut or a campfire?";
    case 'inventory': { const s = list(w.seeds), m = list(w.minerals); return [w.wood ? `${w.wood} wood` : '', s ? `seeds: ${s}` : '', m, w.fish ? `${w.fish} fish` : ''].filter(Boolean).join(' · ') || 'My bag is empty.'; }
    case 'doing': return w.working ? `Right now I'm ${w.working.toLowerCase()}.` : "Just enjoying the island. Got a job for me?";
  }
  return '';
}

/** Per kid profile (see utils/profileScope.ts). */
const GREETING_KEY = 'gk_island_greetings_v1';

type GreetingMemory = { last?: string; at?: number; count?: number };

function readGreetingMemory(characterId: string): GreetingMemory {
  try {
    const all = JSON.parse(localStorage.getItem(scopedKey(GREETING_KEY)) || '{}');
    return all[characterId] || {};
  } catch {
    return {};
  }
}

function writeGreetingMemory(characterId: string, memory: GreetingMemory) {
  try {
    const all = JSON.parse(localStorage.getItem(scopedKey(GREETING_KEY)) || '{}');
    all[characterId] = memory;
    localStorage.setItem(scopedKey(GREETING_KEY), JSON.stringify(all));
  } catch {
    /* storage can be unavailable; greetings just won't remember */
  }
}

/**
 * A greeting that sounds like someone who lives here: it reacts to what the
 * character is doing, how they feel, the time of day, the garden, and what the
 * kid asked last time. Never the same line twice in a row for one character.
 */
export function islandGreeting(opts: {
  characterId: string;
  userName?: string;
  world: WorldBrief | null;
  lastUserLine?: string | null;
}): string {
  const { characterId, world: w, lastUserLine } = opts;
  const name = opts.userName ? `, ${opts.userName}` : '';
  const mem = readGreetingMemory(characterId);
  const sinceMin = mem.at ? (Date.now() - mem.at) / 60000 : Infinity;
  const hour = worldHour(w);
  const pool: string[] = [];

  // Came right back
  if (sinceMin < 2) pool.push(`Back already${name}? What else can I do?`, `That was quick${name}! Need something?`, `Still here${name}. What's next?`);
  else if (sinceMin < 20) pool.push(`Oh, hi again${name}! Job for me, or a chat?`, `You're back${name}! What now?`);

  if (w) {
    // Mid-job
    if (w.working) {
      const job = w.working.replace(/\s*\(paused\)/, '').toLowerCase();
      pool.push(w.working.includes('paused') ? `I'm paused on ${job}${name}. Keep going, or something new?` : `Busy ${job}${name}! Want me to keep at it?`, `Phew, ${job} is hard work${name}. Need me for something else?`);
    }
    // Energy
    if (w.energy <= 20) pool.push(`I'm worn out${name}, only ${w.energy} energy. Could we find a snack or a bed?`, `*yawn* Pretty tired${name}. A bite to eat would help.`);
    else if (w.energy >= 90 && !w.working) pool.push(`Full of energy today${name}! Give me a job!`, `I feel strong${name}. Trees, rocks, fish, you name it.`);
    // Time of day
    if (w.night) pool.push(`Shh, it's night${name}. We can chat quietly.`);
    else if (hour < 10) pool.push(`Good morning${name}! What shall we do today?`, `Morning${name}! The island's waking up. Any plans?`);
    else if (hour >= 20) pool.push(`Getting late${name}. One more job before bed?`, `Evening${name}! Stars soon. Anything quick?`);
    else if (hour >= 12 && hour < 14) pool.push(`Midday${name}! Perfect time for fishing, don't you think?`);
    // Garden
    if (w.garden?.ready) pool.push(`${w.garden.ready === 1 ? 'A crop is' : `${w.garden.ready} crops are`} ready to pick${name}! Shall I?`);
    if (w.garden?.thirsty) pool.push(`The garden looks thirsty${name}. Want me to water it?`);
    // Supplies
    if (w.fish && !w.hasFire) pool.push(`We've got ${w.fish} fish but no campfire${name}. Build one so I can grill?`);
    else if (w.fish && w.hasFire) pool.push(`Fish on hand and the fire's lit${name}. Grill time?`);
    if (w.wood >= 30 && !w.buildings.length) pool.push(`${w.wood} wood put away${name}! Enough for a little hut, I think.`);
    if (w.wood === 0) pool.push(`No wood yet${name}. Should I grab my axe?`);
    if (!w.canSleep && w.energy < 50) pool.push(`No bed on the island yet${name}. A tent would be lovely.`);
  }
  // Last thing you talked about
  if (lastUserLine && lastUserLine.length < 40) pool.push(`Last time you asked about "${lastUserLine.replace(/[?.!]+$/, '')}"${name}. More of that, or a job?`);

  // Always-fine defaults, so there's variety even with no context
  pool.push(
    `Hey${name}! Got a task for me, or just want to chat?`,
    `Hi${name}! Shall we work, or talk a while?`,
    `There you are${name}! What's the plan?`,
    `Hello${name}! I was just enjoying the island. Need me?`,
    `${opts.userName || 'Friend'}! Good to see you. Work or chat?`,
  );

  const choices = pool.filter((line) => line !== mem.last);
  // Context lines sit first; pick from the first few so the greeting stays relevant but not identical.
  const window = Math.min(choices.length, Math.max(3, Math.ceil(choices.length / 2)));
  const line = choices[Math.floor(Math.random() * window)] || pool[0];
  writeGreetingMemory(characterId, { last: line, at: Date.now(), count: (mem.count || 0) + 1 });
  return line;
}

/** Allowed task shapes coming back from the AI; anything else is dropped. */
export function sanitizeAiTask(raw: unknown): IslandTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = String(r.type || '') as IslandTaskType;
  const ok: IslandTaskType[] = ['chop', 'mine', 'fish', 'water', 'plow', 'plant', 'harvest', 'eat', 'rest', 'sleep', 'cook', 'stoke', 'build', 'craft'];
  if (!ok.includes(type)) return null;
  const task: IslandTask = { type };
  if (typeof r.goal === 'string' && r.goal.length < 20) task.goal = r.goal;
  if (typeof r.item === 'string' && r.item.length < 30) task.item = r.item;
  if (typeof r.count === 'number' && r.count > 0) task.count = Math.min(20, Math.round(r.count));
  return task;
}
