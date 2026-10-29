// Unique skills for story friends who live on the island. Friends arrive from the CMS with their own ids,
// so skills are keyed by the friend's name (lower-cased). A skill only applies while a friend with that
// name is actually ashore. Design memory: "godlykids-island-character-skills.md".

/** Shared meals in the Dining Hall. Eve starts preparing at `prep` and rings the bell at `hour`. */
export const MEALS=[
  {id:'breakfast',name:'Breakfast',hour:8,prep:7},
  {id:'lunch',name:'Lunch',hour:12,prep:11},
  {id:'dinner',name:'Dinner',hour:18,prep:17},
];
export const MEAL_FISH=5;
/** The meal whose preparation window covers this island hour (prep → the next meal's prep), or null. */
export function mealAt(hour){
  for(let i=0;i<MEALS.length;i++){const m=MEALS[i],end=MEALS[i+1]?.prep??22;if(hour>=m.prep&&hour<end)return m;}
  return null;
}
export const nextMeal=hour=>MEALS.find(m=>m.hour>hour)||null;
export const hourLabel=h=>h===12?'noon':h>12?`${h-12} PM`:`${h} AM`;
export const MEAL_TIMES=MEALS.map(m=>hourLabel(m.hour)).join(', ');
// Kept for older call sites: the first meal of the day.
export const BREAKFAST_PREP_HOUR=MEALS[0].prep,BREAKFAST_HOUR=MEALS[0].hour,BREAKFAST_FISH=MEAL_FISH;

export const CHARACTER_SKILLS={
  eve:{id:'cook',name:'Cook',icon:'cookedfish',short:`meals at ${MEAL_TIMES} · plants & seeds`,
    blurb:`Before every meal she fishes and picks what is ripe in the garden while Noah grills the catch, then rings the Dining Hall bell at ${MEAL_TIMES} so everyone eats together. Between meals she plants seeds and gathers the ones lying around.`},
  abel:{id:'gardener',name:'Garden keeper',icon:'water',short:'weeds · tilling · guards at dusk',
    blurb:'The garden is his daily mission: he pulls weeds, waters and picks, tills new rows so it keeps growing, and at dusk he stands guard so a coyote is chased off. Wants fences and a scarecrow so crows and coyotes leave our food alone.'},
  // `grills`: the friend who lights the campfire and grills Eve's catch before each meal (Eve covers it if he is away).
  noah:{id:'woodcutter',name:'Woodcutter',icon:'axe',short:'stumps · trees · grills the fish',grills:true,
    blurb:'Clears stumps wherever trees were felled and cuts up to 10 trees a day. Before every meal he lights the campfire and grills the fish Eve catches, and he has ideas about what to build next and why.'},
  adam:{id:'farmer',name:'Farmer',icon:'fence',short:'trees · stone · animals',
    blurb:'Cuts trees and breaks stone for the build pile, knows which animals to bring home, and wants a fenced farm and a stable so the coyotes stay out.'},
};
/** Daily limits for the work each friend does on their own. */
export const SKILL_LIMITS={trees:10,rocks:6,plots:4};
export const skillKey=name=>String(name||'').trim().toLowerCase().split(/\s+/)[0];
export const skillFor=name=>CHARACTER_SKILLS[skillKey(name)]||null;
export const hasSkill=(name,id)=>skillFor(name)?.id===id;
