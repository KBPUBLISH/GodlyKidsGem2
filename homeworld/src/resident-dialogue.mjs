/** Short, authored island conversations. These are game dialogue, not Bible quotations.
 * Memories live inside the island save, so reset/restore follows the same world.
 * Only successful gameplay creates events; visiting never invents offline chores.
 */
import {characterFor} from './characters.mjs';
export const CONVERSATION_VERSION = 1;
const EVENT_LIMIT = 40, RESIDENT_LIMIT = 64, HOLD_MS = 8000;
const hash = value => [...String(value)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
const list = value => Array.isArray(value) ? value : [];
const names = {carrot_seed:'carrot',wheat_seed:'wheat',pumpkin_seed:'pumpkin',sunflower_seed:'sunflower',pine_seed:'pine',oak_acorn:'oak',maple_samara:'maple',apple_seed:'apple',coconut:'coconut'};
const crop = seed => names[seed] || 'garden';

function read(state) {
  const saved = state.islandConversations;
  if (saved?.version !== CONVERSATION_VERSION) return {version:CONVERSATION_VERSION,events:[],residents:{}};
  return {version:CONVERSATION_VERSION,
    events:list(saved.events).filter(e => e && typeof e.id === 'string' && typeof e.kind === 'string').slice(-EVENT_LIMIT),
    residents:saved.residents && typeof saved.residents === 'object' && !Array.isArray(saved.residents) ? saved.residents : {}};
}

function addEvent(state, event) {
  const memory = read(state);
  if (memory.events.some(e => e.id === event.id)) return state;
  return {...state,islandConversations:{...memory,events:[...memory.events,event].slice(-EVENT_LIMIT)}};
}

/** Called after an accepted action, with the actual actor and control mode. */
export function rememberResidentAction(before, after, action, {actorId,helper=false,wall=Date.now()} = {}) {
  if (before === after || !actorId) return after;
  const kinds = {plant:'plant',water:'water',harvest:'harvest',fish:'fish',cook:'cook',pray:'pray',eat:'eat',chop:'chop',chop_hit:'chop',mine:'mine',mine_hit:'mine'};
  const kind = kinds[action.type];
  if (!kind) return after;
  // A single swing is not a completed tree or rock.
  if (kind === 'chop' && (after.stats?.trees || 0) <= (before.stats?.trees || 0)) return after;
  if (kind === 'mine' && (after.stats?.rocks || 0) <= (before.stats?.rocks || 0)) return after;
  const cell = kind === 'plant' ? after.cells?.[action.key] : before.cells?.[action.key];
  return addEvent(after, {id:`action:${action.actionId || `${wall}:${after.revision}:${actorId}:${kind}`}`,
    kind,actorId,helper,at:wall,seed:cell?.seed || null,key:action.key || null,plantedAt:cell?.plantedAt ?? null});
}

/** Includes real construction completed by the existing offline simulation. */
export function rememberCompletedBuildings(before, after, wall=Date.now()) {
  let next = after;
  for (const building of after.buildings || []) {
    if (building.status !== 'complete') continue;
    const old = (before.buildings || []).find(b => b.id === building.id);
    if (old?.status === 'complete' && old.kind === building.kind) continue;
    next = addEvent(next, {id:`building:${building.id}:${building.kind}`,kind:'built',subject:building.kind,buildingId:building.id,at:wall});
  }
  return next;
}

const PERSONALITIES = {
  gardener:[
    'I like leaving a little room for flowers wherever we build.',
    'A tiny seed has such a big job ahead of it.',
    'My favorite kind of treasure grows in the garden.',
    'I would love to help you make this island greener.',
    'A garden feels like a little promise to tomorrow.'
  ],
  builder:[
    'I like imagining who will feel at home in the things we build.',
    'You choose our next project, and I will bring my helping hands.',
    'Every cozy corner starts with one little idea.',
    'I think a good home always has room for kindness.',
    'My favorite part of building is seeing everyone enjoy it.'
  ],
  encourager:[
    'Your ideas help make this island feel like home.',
    'We can take our time and make something lovely together.',
    'I am thankful God gives us different gifts to share.',
    'There is room for your ideas and everyone else’s here.',
    'You can ask for help whenever you need it.'
  ],
  playful:[
    'Do you think the clouds are trying to copy our island?',
    'If we build a sandcastle, I vote for a very tiny front door.',
    'I think every good plan should leave room for a snack.',
    'I wonder if fish tell stories about the people on the shore.',
    'Our island would make a very funny hat for a giant.'
  ]
};
const COMMUNITY = [
  'Let’s make a place where everyone feels welcome.',
  'I am glad we get to make this island beautiful together.',
  'You bring the ideas, and we can work on them together.',
  'A little kindness makes this home even brighter.',
  'We all have something good to bring to our community.',
  'It feels good to have a place at the table together.',
  'I am thankful to God for a home we can care for together.',
  'There is time to enjoy our island as well as work on it.'
];

export function residentPersonality(resident) {
  // The character canon names the line bank for every known friend (Noah builder, Adam/Eve/Abel gardener, Peter playful…).
  const bank = characterFor(resident.name).dialogue;
  if (bank && PERSONALITIES[bank]) return bank;
  return Object.keys(PERSONALITIES)[hash(resident.id) % 4];
}

function eventLine(event, resident, people) {
  const own = event.actorId === resident.id;
  const neighbor = people.find(p => p.id === event.actorId);
  if (event.helper && !own && !neighbor) return null;
  const who = own ? 'I' : neighbor?.name || 'A friend';
  const helper = {
    water:own ? `I watered the ${crop(event.seed)} plants to help our garden along.` : `${who} watered the ${crop(event.seed)} plants to help our garden along.`,
    harvest:own ? 'I picked some garden food for our shared bag.' : `${who} picked some garden food for our shared bag.`,
    fish:own ? 'I caught a fish for our shared bag.' : `${who} caught a fish for our shared bag.`,
    chop:own ? 'I gathered some wood for the things we will build together.' : `${who} gathered some wood for our next projects.`,
    mine:own ? 'I gathered some stone for our next projects.' : `${who} gathered some stone for our next projects.`,
    eat:own ? 'That snack gave me a little energy for our next adventure.' : `${who} had a snack before getting back to island life.`
  };
  const shared = {
    plant:`I noticed the ${crop(event.seed)} seeds you planted for our island.`,
    water:`Thank you for giving the ${crop(event.seed)} plants a drink.`,
    harvest:'The food you picked went into our shared bag.',
    fish:'That fish you caught is part of our island’s story now.',
    chop:'The wood you gathered will help us build our home together.',
    mine:'The stone you gathered will help with our next projects.',
    cook:'The food you prepared makes our shared bag a little more welcoming.',
    pray:'I am glad you made a little time for prayer on our island.',
    eat:'Taking a snack break is part of looking after ourselves too.'
  };
  return event.helper ? helper[event.kind] || null : shared[event.kind] || null;
}

/** Pure selection: the caller saves once on a tap, never on a render frame.
 * context.plants contains actual growth stages from the game; buildings contain catalogue names.
 */
export function nextResidentLine(state, resident, context={}, wall=Date.now()) {
  const memory = read(state), id = resident.id;
  const raw = Object.hasOwn(memory.residents,id) ? memory.residents[id] : null;
  const previous = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (typeof previous.lastText === 'string' && wall >= previous.lastAt && wall - previous.lastAt < HOLD_MS) {
    return {state,line:{id:previous.lastKey,text:previous.lastText,residentId:id}};
  }
  const people = list(context.residents).filter(p => p?.id && p.id !== id);
  const recent = list(previous.recent), recentTexts = list(previous.recentTexts), seen = list(previous.seen), candidates = [];
  const push = (key,text,priority,extra={}) => candidates.push({key,text,priority,...extra});
  const watched = previous.plant;
  const grown = watched && list(context.plants).find(p => p.key === watched.key && p.plantedAt === watched.plantedAt && p.seed === watched.seed && p.ready);
  if (grown && !watched.celebrated) push(`grown:${watched.key}:${watched.plantedAt}`,`Remember those ${crop(watched.seed)} seeds you planted — they are all grown now.`,110,{grown:true});
  for (const event of [...memory.events].reverse()) {
    if (seen.includes(event.id)) continue;
    if (event.kind === 'built') {
      const building = list(context.buildings).find(b => b.id === event.buildingId && b.kind === event.subject && b.status === 'complete');
      if (building) push(event.id,`Our ${building.name.toLowerCase()} is finished — look what our community can make together.`,95,{event});
    } else {
      const text = eventLine(event,resident,people);
      if (text) push(event.id,text,event.helper && event.actorId === id ? 90 : 75,{event});
    }
  }
  if (!previous.lastText) push('welcome','I am glad to be here with you — let’s make a lovely home together.',100);
  if (previous.lastText) {
    const newcomer = people.find(p => !list(previous.neighbors).includes(p.id));
    if (newcomer) push(`neighbor:${newcomer.id}`,`${newcomer.name} is part of our island now — let’s help everyone feel at home.`,85);
  }
  const building = list(context.buildings).find(b => ['building','queued'].includes(b.status));
  if (building) push(`project:${building.id}`,`Our ${building.name.toLowerCase()} is taking shape, one little bit at a time.`,45);
  const ready = list(context.plants).find(p => p.ready);
  if (ready) push('garden-ready','There is something ready in our garden whenever you want to pick it.',40);
  if (list(state.animals).some(a => a.kind === 'chicken')) push('chicken-joke','If our chickens planned the island, every meeting would be about snacks.',42);
  if (people.length) {
    const neighbor = people[hash(id) % people.length];
    push(`together:${neighbor.id}`,`You, ${neighbor.name}, and I each bring something special to this home.`,35);
  }
  if (previous.shared?.kind === 'plant') push('remember-plant',`I still remember you planting those ${crop(previous.shared.seed)} seeds for our island.`,30);
  if (previous.shared?.kind === 'fish') push('remember-fish','I still remember that fish you caught for our shared bag.',30);
  // A Bible friend's own voice (characters.mjs `lines`) comes just ahead of the shared personality bank.
  const own = characterFor(resident.name).lines || [];
  for (let i=0;i<own.length;i++) push(`own:${(i + hash(id)) % own.length}`,own[(i + hash(id)) % own.length],22);
  const personality = residentPersonality(resident), offset = hash(id) % PERSONALITIES[personality].length;
  for (let i=0;i<PERSONALITIES[personality].length;i++) {
    const n = (i + offset) % PERSONALITIES[personality].length;
    push(`personality:${n}`,PERSONALITIES[personality][n],20);
  }
  for (let i=0;i<COMMUNITY.length;i++) {
    const n = (i + hash(id)) % COMMUNITY.length;
    push(`community:${n}`,COMMUNITY[n],10);
  }
  const fresh = candidates.filter(c => !recent.includes(c.key) && !recentTexts.includes(c.text) && c.text !== previous.lastText);
  const chosen = (fresh.length ? fresh : candidates.filter(c => c.text !== previous.lastText)).sort((a,b) => b.priority - a.priority)[0];
  const event = chosen.event;
  const next = {...previous,lastKey:chosen.key,lastText:chosen.text,lastAt:wall,
    recent:[...recent,chosen.key].slice(-8),recentTexts:[...recentTexts,chosen.text].slice(-8),seen:event ? [...seen,event.id].slice(-EVENT_LIMIT) : seen,
    neighbors:people.map(p => p.id).slice(0,RESIDENT_LIMIT)};
  if (event && !event.helper && event.kind !== 'built') next.shared = event;
  if (event?.kind === 'plant' && !event.helper) next.plant = {key:event.key,seed:event.seed,plantedAt:event.plantedAt,celebrated:false};
  if (chosen.grown) next.plant = {...watched,celebrated:true};
  const residents = Object.fromEntries(Object.entries({...memory.residents,[id]:next})
    .sort((a,b) => (b[1]?.lastAt || 0) - (a[1]?.lastAt || 0)).slice(0,RESIDENT_LIMIT));
  return {state:{...state,islandConversations:{...memory,residents}},line:{id:chosen.key,text:chosen.text,residentId:id}};
}
