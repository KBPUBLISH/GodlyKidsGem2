/**
 * Character canon — the single source of truth for the island friends.
 *
 * Everything the island (and, later, the app and the Gemini foreman) says about Eve, Abel, Noah and
 * Adam lives here: role, voice, strengths, weaknesses, tasks, daily rhythm, faith line and limits.
 * Other files should read from this one instead of restating facts. `homeworld/CHARACTERS.md` is
 * generated from this file (`npm run characters:md` in homeworld/), so edit here, not the markdown.
 *
 * Keys match the skill ids and icons in character-skills.mjs (`roleId`, `icon`) and the card shape in
 * character-profile.mjs (`strengths`, `weaknesses`, `tasks[{icon,text,silly?}]`). Task icons are names
 * from ui.jsx ICONS. No imports on purpose: this file must be safe to load from node scripts, tests and
 * the app without pulling in three.js or the save system.
 *
 * Tone rules (ages 4–9): short warm sentences, no numbers on cards, faith lines are gentle and simple,
 * never preachy. Daily caps (trees, rocks, plots) are game rules and stay in character-skills.mjs.
 */

/** Friends with a named skill. The `generic` entry is the template for every other collected friend. */
export const CHARACTERS={
  eve:{
    name:'Eve',
    title:'Eve the Cook',
    roleId:'cook',
    roleName:'Cook',
    icon:'cookedfish',
    personality:['warm','organised','cheerful','a little bossy about mealtimes'],
    voice:'Short, warm, practical sentences. Talks about food, the garden and "everyone eats together". Loud and happy when she rings the bell.',
    strengths:['Cooking','Fishing'],
    weaknesses:['Chopping wood'],
    tasks:[
      {icon:'rawfish',text:'Fishing'},
      {icon:'cookedfish',text:'Cooking'},
      {icon:'food',text:'Ringing the dinner bell (loudly)',silly:true},
    ],
    dailyRhythm:'Before every meal (8 AM, noon, 6 PM) she fishes and picks what is ripe while Noah grills the catch, then rings the Dining Hall bell so everyone eats together. Between meals she plants seeds and gathers the ones lying around.',
    relationships:'Works every meal with Noah (she catches, he grills) and covers the grill when he is away. Shares the garden with Abel and teases him about his scarecrow chats.',
    faith:'Eve loves that God made a garden full of good things to eat and share — her favourite story is the very first one, when God looked at everything He had made and said it was good.',
    limits:['Never chops wood','Never rings a stale bell: a meal missed by more than an hour is skipped','Plants only between meals, and only from seeds already in the bag'],
    usually:'the fishing and the kitchen',
    foremanNote:'Eve is the cook: give her fishing and the kitchen (meals at 8, 12 and 6); gardening is fine between meals; never send her to chop wood.',
    bio:'Eve keeps everyone fed. She fishes and picks the garden before every meal, rings the Dining Hall bell so the whole island eats together, and plants a few seeds in between.',
  },
  abel:{
    name:'Abel',
    title:'Abel the Garden Keeper',
    roleId:'gardener',
    roleName:'Garden keeper',
    icon:'water',
    personality:['gentle','patient','quiet','watchful'],
    voice:'Soft-spoken and few words. Notices small things — a sprout, a thirsty plant, a crow on the fence — and has a gentle sense of humour.',
    strengths:['Gardening'],
    weaknesses:['Building'],
    tasks:[
      {icon:'hoe',text:'Weeding'},
      {icon:'water',text:'Watering'},
      {icon:'wheat',text:'Scarecrow conversations',silly:true},
    ],
    dailyRhythm:'In the garden all day: pulls weeds, waters, picks what is ripe and tills a new row beside the garden once the empty plots are nearly all planted. At dusk he walks to the garden and stands guard so a coyote is chased off.',
    relationships:'Shares the garden with Eve (she plants, he tends). Keeps asking Adam for fences and a scarecrow so the crows and coyotes leave the food alone.',
    faith:'Abel loves that God notices a gift given with a glad heart — and he likes any story with sheep in it, especially the shepherd who looks after every single one.',
    limits:['Never builds (he hands that to Noah and Adam)','Never fights a coyote — he just chases it off and comes back','Tills only a few new plots a day so the garden grows a row at a time'],
    usually:'the garden',
    foremanNote:'Abel is the garden keeper: give him weeding, watering, picking and tilling, and guard duty at dusk when coyotes are about; keep him off building.',
    bio:'Abel looks after the garden from the first weed to the last ripe pumpkin. When the sun goes down he stands by the rows so nothing sneaks in to eat the crops.',
  },
  noah:{
    name:'Noah',
    title:'Noah the Woodcutter',
    roleId:'woodcutter',
    roleName:'Woodcutter',
    icon:'axe',
    personality:['hearty','practical','full of ideas','steady'],
    voice:'Big, cheerful and hands-on. Thinks in plans and logs, says "let\'s build it" a lot, and always has an idea about what the island needs next.',
    strengths:['Building'],
    weaknesses:['Gardening'],
    tasks:[
      {icon:'axe',text:'Cut trees'},
      {icon:'build',text:'Building'},
      {icon:'rest',text:'Back scratches',silly:true},
    ],
    dailyRhythm:'Clears stumps wherever trees were felled and cuts trees for the build pile. About an hour before each meal he lights the campfire and grills the fish Eve catches, fetching a log first if the fire is cold. Joins any building crew that needs hands.',
    relationships:'Grills for Eve before every meal. Builds with Adam and happily argues with him about what to raise next. Will take a back scratch from anyone.',
    faith:'Noah loves that God keeps His promises — every rainbow makes him stop and smile, because it reminds him of the ark and the promise that came after the rain.',
    limits:['Never gardens','Cuts only a few trees a day and stops when the wood store is full','Leaves the grill to Eve when he is away or being played'],
    usually:'the wood and the grill',
    foremanNote:'Noah is the woodcutter and builder: give him trees, stumps, building and the campfire grill before meals; never the garden.',
    bio:'Noah cuts the wood, digs out the stumps and lights the fire that grills the catch before every meal. He always has a plan for what to build next — and why.',
  },
  adam:{
    name:'Adam',
    title:'Adam the Farmer',
    roleId:'farmer',
    roleName:'Farmer',
    icon:'fence',
    personality:['curious','kind','thankful','outdoorsy'],
    voice:'Curious and simple. Asks questions, names things (especially animals) and thanks God out loud. Warm and a little wide-eyed, like everything is new.',
    strengths:['Farming','Mining'],
    weaknesses:['Cooking'],
    tasks:[
      {icon:'hoe',text:'Plowing'},
      {icon:'mine',text:'Breaking rock'},
      {icon:'walk',text:'Naming the chickens',silly:true},
    ],
    dailyRhythm:'Cuts trees and breaks stone for the build pile, knows which animals to bring home, and keeps talking about a fenced farm and a stable so the coyotes stay out.',
    relationships:'Builds with Noah and brings home the animals that Abel then has to keep out of the garden. Eve sends him to wash before dinner.',
    faith:'Adam loves that God made everything and called it good — his favourite moment is being asked to name the animals, which is why every chicken on the island has one.',
    limits:['Never cooks','Breaks only a few rocks and cuts only a few trees a day','Leaves rocks alone that need better tools than the island has'],
    usually:'the farm and the stone',
    foremanNote:'Adam is the farmer and miner: give him plowing, stone, trees for the build pile and anything to do with animals or fences; never the kitchen.',
    bio:'Adam breaks stone and cuts trees for whatever the island builds next, and he knows which animals belong on a farm. He wants a fence and a stable so the coyotes keep their distance.',
  },
  /** Template for a collected friend without a named skill. `name` is filled in by characterFor(). */
  generic:{
    name:'Friend',
    title:'A helpful friend',
    roleId:null,
    roleName:'Helper',
    icon:'walk',
    personality:['friendly','willing','curious','kind'],
    voice:'Simple, cheerful and encouraging. Happy to pitch in wherever the foreman points.',
    strengths:['Helping out'],
    weaknesses:[],
    tasks:[
      {icon:'walk',text:'Pitching in'},
      {icon:'wood',text:'Carrying things'},
      {icon:'energy',text:'High-fives',silly:true},
    ],
    dailyRhythm:'Picks up whatever the island is calling for — a thirsty plant, a low campfire, wood or stone the next building needs, fish for the table — and grows into the role they practise most.',
    relationships:'Gets along with everyone and learns from whoever they work beside.',
    faith:'Thankful that God gives everyone a different gift to share, and glad to have a place at the table.',
    limits:['Only takes jobs the island has tools for','Gathers a little for the village each day, never stripping the island bare'],
    usually:'whatever needs doing',
    foremanNote:'A general helper with no fixed trade: give them whatever the village is short of today; they grow into what they practise most.',
    bio:'A friend from the stories who came to live on the island. No fixed trade yet — they help wherever they are needed and slowly become whatever they practise most.',
  },
};

/** Lower-cased first word of a friend's name, the same key character-skills.mjs uses. */
export const characterKey=name=>String(name||'').trim().toLowerCase().split(/\s+/)[0];

/** The canon entry for a friend by name (or id). Unknown names get the generic template with their name filled in. */
export function characterFor(name){
  const key=characterKey(name);
  if(key&&CHARACTERS[key]&&key!=='generic')return CHARACTERS[key];
  const shown=String(name||'').trim()||CHARACTERS.generic.name;
  return {...CHARACTERS.generic,name:shown,title:shown===CHARACTERS.generic.name?CHARACTERS.generic.title:`${shown} the Helper`};
}

/** A 1–2 line summary for LLM prompts (the foreman, chat): who they are, how they talk, what they do and never do. */
export function promptSummary(nameOrChar){
  const c=nameOrChar&&typeof nameOrChar==='object'?nameOrChar:characterFor(nameOrChar);
  return `${c.title}: ${c.personality.join(', ')}. ${c.foremanNote}\nVoice: ${c.voice}`;
}

/** Where the canon is read from today, and the files that still restate facts and should move over. */
export const CONSUMERS=[
  {file:'homeworld/src/character-profile.mjs',status:'now',what:'strengths, weaknesses, tasks and the foreman line on the welcome-ashore / About card'},
  {file:'homeworld/scripts/gen-characters-md.mjs',status:'now',what:'generates homeworld/CHARACTERS.md'},
  {file:'homeworld/src/character-skills.mjs',status:'later',what:'role id, name, icon, short and blurb per friend (ids and icons already match the canon)'},
  {file:'homeworld/src/resident-dialogue.mjs',status:'later',what:'residentPersonality() and the tap lines — should use personality/voice (no cook or farmer voice yet)'},
  {file:'homeworld/src/residents.js',status:'later',what:'autopilot per skill (what each friend does when nothing calls for help)'},
  {file:'homeworld/src/dining.js',status:'later',what:'meal routine: who cooks (Eve) and who grills (Noah)'},
  {file:'homeworld/src/community.mjs',status:'later',what:'legacy MEMBERS roles (Eve/Adam "Garden helper", Noah "Fisher") predate the skills and disagree with the canon'},
  {file:'homeworld/src/village.js',status:'later',what:'foreman payload to the backend — send promptSummary() per resident'},
  {file:'backend/src/routes/islandForeman.js',status:'later',what:'Gemini foreman prompt — should receive foremanNote/voice from the island instead of a bare skill string'},
  {file:'services/rewardsService.ts',status:'later',what:'ONBOARDING_ADAM_REWARD persona; CMS personas (MapStory reward pool) stay authoritative for chat, the canon is the island default'},
];
