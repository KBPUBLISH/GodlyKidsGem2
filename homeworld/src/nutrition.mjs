import {TREE_MAX_HEALTH} from './resource-health.mjs';
import {toolTier,MINING_ENERGY_PER_HIT} from './mining.mjs';
import {buildingById} from './building.mjs';
import {hasWell,digPower} from './digging.mjs';
export const MAX_ENERGY=100;
export const LOW_ENERGY=20,SLEEP_SECONDS=12,SLEEP_HOURS=8;
export const FOODS={
  apple:{name:'Apple',icon:'🍎',energy:15,source:'Pick them from an apple tree · they grow back.'},
  carrot:{name:'Carrot',icon:'🥕',energy:20,source:'Harvest carrots from your garden.'},
  pumpkin:{name:'Pumpkin',icon:'🎃',energy:35,source:'Harvest pumpkins from your garden.'},
  cooked_fish:{name:'Grilled fish',icon:'🐟',energy:40,source:'Catch a fish, then grill it on a campfire.'},
  bread:{name:'Bread',icon:'🍞',energy:40,source:'An old loaf from before the oven was built.'},
  manna:{name:'Manna',icon:'🍞',energy:50,source:'Bake wheat and water in a hot clay oven.'},
  garden_salad:{name:'Garden salad',icon:'🥗',energy:72,source:'A cook mixes a carrot and a pumpkin.'},
  seed_crackers:{name:'Seed crackers',icon:'🌾',energy:48,source:'A cook bakes a wheat seed and a sunflower seed.'},
  nut_butter_greens:{name:'Nut butter on greens',icon:'🌻',energy:56,source:'A cook spreads an acorn on sunflower greens.'},
  roasted_seeds:{name:'Roasted seeds',icon:'🎃',energy:44,source:'A cook roasts a pumpkin seed and a pine seed.'},
  veggie_stew:{name:'Veggie stew',icon:'🥕',energy:58,source:'A cook simmers a carrot and some wheat.'},
  pumpkin_coconut:{name:'Pumpkin coconut',icon:'🥥',energy:68,source:'A cook stirs pumpkin with coconut.'},
  apple_nut:{name:'Apple nut bite',icon:'🍎',energy:46,source:'A cook tucks an acorn into an apple.'},
  carrot_bites:{name:'Carrot seed bites',icon:'🥕',energy:52,source:'A cook presses carrot onto sunflower seeds.'},
};
/** Every recipe is made at a station: `campfire` needs a lit fire beside you, `oven` a clay oven that has heated up. `seconds` is how long the character works at it. */
export const FOOD_RECIPES={
  grill_fish:{name:'Grill fish',ingredients:{fish:1},item:'cooked_fish',quantity:1,station:'campfire',seconds:3.4},
  bake_manna:{name:'Bake manna',ingredients:{wheat:1,water:1},item:'manna',quantity:1,station:'oven',seconds:5},
};
/** Things made by the fire that are not food. Clay bricks line the oven. */
export const CRAFT_RECIPES={
  dry_clay:{name:'Dry clay bricks',ingredients:{mud:2,water:1},item:'clay',quantity:1,station:'campfire',seconds:4},
  concrete_brick:{name:'Concrete brick',ingredients:{stone:2,clay:1},item:'concrete_brick',quantity:1,station:'well',seconds:4},
};
export const RECIPES={...FOOD_RECIPES,...CRAFT_RECIPES};
export const MATERIALS={mud:{name:'Mud',source:'Dig at the beach with the Dig tool.'},water:{name:'Water',source:'Fill a bucket at the well.'},clay:{name:'Clay brick',source:'Dry 2 mud + 1 water by the campfire.'},concrete_brick:{name:'Concrete brick',source:'Craft at the well: 2 stone + 1 clay. Used for brick fences.'}};
export const WATER_MAX=6;
export const activeCharacter=state=>state.activeCharacter||'adam';
export const energyFor=(state,id=activeCharacter(state))=>state.characters?.[id]?.energy??MAX_ENERGY;
export function setEnergy(state,value,id=activeCharacter(state)){
  state.characters??={};const {fatigue,awakeSince,...character}=state.characters[id]||{name:id==='adam'?'Adam':id};state.characters[id]={...character,energy:Math.max(0,Math.min(MAX_ENERGY,value))};
}
export function energyCost(state,action){
  const type=typeof action==='string'?action:action.type,power=toolTier(state).power;
  const treeHealth=typeof action==='object'&&action.id?Math.max(0,TREE_MAX_HEALTH-(state.treeDamage?.[action.id]||0)):TREE_MAX_HEALTH;
  return {chop:2*Math.ceil(treeHealth/power),chop_hit:2,plow:3*Math.ceil(2/digPower(state)),clear_weeds:3*Math.ceil(2/digPower(state)),dig_stump:3,dig_mud:2,fetch_water:1,guard_garden:12,plant:2,water:hasWell(state)?0:1,mine:MINING_ENERGY_PER_HIT,mine_hit:MINING_ENERGY_PER_HIT,fish:4,place_building:5,stack_piece:5,upgrade_building:5}[type]||0;
}
export const canAffordEnergy=(state,action)=>energyFor(state)>=energyCost(state,action);

/**
 * Hunger is its own meter: a full tummy (100%) empties over 1½ island days whatever
 * you do, and only food fills it. Hunger slows work (see workRate) but never stops it.
 * Picking crops and fishing stay open, so there is always a way back to a meal.
 */
export const MAX_HUNGER=100,LOW_HUNGER=25,HUNGER_PER_MINUTE=MAX_HUNGER/(1440*1.5);
export const foodFill=item=>Math.round((FOODS[item]?.energy||0)*1.5);
export function hungerFor(state,minutes,id=activeCharacter(state)){
  const c=state.characters?.[id];if(!c||!Number.isFinite(c.hunger))return MAX_HUNGER;
  const since=Number.isFinite(c.hungerAt)?Math.max(0,minutes-c.hungerAt):0;
  return Math.max(0,Math.min(MAX_HUNGER,c.hunger-since*HUNGER_PER_MINUTE));
}
export function setHunger(state,value,minutes,id=activeCharacter(state)){
  state.characters??={};const c=state.characters[id]||{name:id==='adam'?'Adam':id,energy:MAX_ENERGY};
  state.characters[id]={...c,hunger:Math.max(0,Math.min(MAX_HUNGER,value)),hungerAt:minutes};
}
export const isHungry=(state,minutes,id=activeCharacter(state))=>hungerFor(state,minutes,id)<=LOW_HUNGER;
export const isStarving=(state,minutes,id=activeCharacter(state))=>hungerFor(state,minutes,id)<=0;
/**
 * Hunger never stops work, it weakens it: a hungry character (tummy ≤25%) works at 60%,
 * an empty tummy at 35%. Running out of energy is the only hard stop.
 */
export const HUNGRY_WORK_RATE=.6,STARVING_WORK_RATE=.35;
export function workRate(state,minutes,id=activeCharacter(state)){const h=hungerFor(state,minutes,id);return h<=0?STARVING_WORK_RATE:h<=LOW_HUNGER?HUNGRY_WORK_RATE:1;}
export const workRateNote=rate=>rate>=1?'':rate>=HUNGRY_WORK_RATE?'hungry · slower':'starving · very slow';
/** Work a hungry character does more slowly. Fishing, picking crops and eating are unaffected. */
export const needsFood=action=>['chop','chop_hit','mine','mine_hit','plow','clear_weeds','dig_stump','plant','water','place_building','upgrade_building'].includes(typeof action==='string'?action:action?.type);
/** What a meal would do right now: energy and tummy filled, capped at full. */
export function mealGain(state,item,minutes,id=activeCharacter(state)){
  const food=FOODS[item];if(!food)return {energy:0,hunger:0,total:0};
  const energy=Math.max(0,Math.min(food.energy,MAX_ENERGY-energyFor(state,id))),hunger=Math.max(0,Math.min(foodFill(item),MAX_HUNGER-hungerFor(state,minutes,id)));
  return {energy,hunger,total:Math.max(energy,hunger)};
}
export const canCook=(state,recipe)=>!!RECIPES[recipe]&&Object.entries(RECIPES[recipe].ingredients).every(([id,n])=>(state.inventory[id]||0)>=n);
export const restGain=state=>Math.max(0,Math.min(20,25-energyFor(state)));
/** Prayer: a quiet moment that lifts the spirit. +PRAY_GAIN energy (up to 100), once every PRAY_COOLDOWN_MINUTES of island time. */
export const PRAY_GAIN=15,PRAY_COOLDOWN_MINUTES=90;
export const prayerWait=(state,minutes)=>Math.max(0,Math.ceil((state.lastPrayer??-Infinity)+PRAY_COOLDOWN_MINUTES-minutes));
export const prayGain=(state,minutes)=>prayerWait(state,minutes)>0?0:Math.max(0,Math.min(PRAY_GAIN,100-energyFor(state)));
export const PRAYERS=[
 {text:'Dear God, thank You for this island, for the trees and the sea, and for my friends. Help me to be kind today. Amen.',verse:'Give thanks to the Lord, for He is good. — Psalm 107:1',tts:'[warmly] Dear God, thank You for this island, for the trees and the sea, and for my friends. [gently] Help me to be kind today. [softly] Amen.'},
 {text:'Lord, thank You for strong hands to work and a happy heart to share. Please help me finish what I start. Amen.',verse:'Whatever you do, work at it with all your heart. — Colossians 3:23',tts:'[happily] Lord, thank You for strong hands to work and a happy heart to share. [gently] Please help me finish what I start. [softly] Amen.'},
 {text:'Dear Jesus, when I feel tired, remind me that You are near. Give me rest and fill me up again. Amen.',verse:'Come to me, all who are weary, and I will give you rest. — Matthew 11:28',tts:'[softly] Dear Jesus, when I feel tired, remind me that You are near. [sighs] [gently] Give me rest and fill me up again. Amen.'},
 {text:'Thank You, God, for food to eat, water to drink, and a home to sleep in. Help me share with others. Amen.',verse:'Give us this day our daily bread. — Matthew 6:11',tts:'[happily] Thank You, God, for food to eat, water to drink, and a home to sleep in. [warmly] Help me share with others. [softly] Amen.'},
 {text:'Dear God, thank You for making every bird, fish, and flower. Help me take good care of Your world. Amen.',verse:'The earth is the Lord’s, and everything in it. — Psalm 24:1',tts:'[excitedly] Dear God, thank You for making every bird, fish, and flower. [gently] Help me take good care of Your world. [softly] Amen.'},
 {text:'Lord, when something is hard, help me not to give up. Make me brave and patient. Amen.',verse:'I can do all things through Christ who strengthens me. — Philippians 4:13',tts:'[nervously] Lord, when something is hard, help me not to give up. [warmly] Make me brave and patient. [softly] Amen.'},
 {text:'Dear Jesus, help me to love my friends the way You love me, with a gentle voice and a helping hand. Amen.',verse:'Love one another as I have loved you. — John 15:12',tts:'[warmly] Dear Jesus, help me to love my friends the way You love me, [gently] with a gentle voice and a helping hand. [softly] Amen.'},
 {text:'Thank You, God, for the sunrise and the stars at night. You never stop watching over me. Amen.',verse:'He who watches over you will not slumber. — Psalm 121:3',tts:'[happily] Thank You, God, for the sunrise and the stars at night. [warmly] You never stop watching over me. [softly] Amen.'},
 {text:'Dear God, I am sorry for the times I was grumpy or unkind. Please forgive me and give me a fresh start. Amen.',verse:'Create in me a clean heart, O God. — Psalm 51:10',tts:'[softly] Dear God, I am sorry for the times I was grumpy or unkind. [sighs] [gently] Please forgive me and give me a fresh start. Amen.'},
 {text:'Lord, You are my shepherd. Lead me to good places today and keep me close to You. Amen.',verse:'The Lord is my shepherd; I shall not want. — Psalm 23:1',tts:'[warmly] Lord, You are my shepherd. [gently] Lead me to good places today and keep me close to You. [softly] Amen.'},
 {text:'Dear Jesus, thank You that I never have to be afraid, because You are always with me. Amen.',verse:'Do not fear, for I am with you. — Isaiah 41:10',tts:'[happily] Dear Jesus, thank You that I never have to be afraid, [warmly] because You are always with me. [softly] Amen.'},
 {text:'Thank You, God, for every good gift. Help me to be thankful instead of grumbling. Amen.',verse:'Every good and perfect gift is from above. — James 1:17',tts:'[happily] Thank You, God, for every good gift. [chuckles] [gently] Help me to be thankful instead of grumbling. [softly] Amen.'},
];
/** Prayers rotate so every visit teaches a new one; `tts` carries the ElevenLabs voice direction (never shown on screen). */
export const prayerFor=state=>PRAYERS[(state.stats?.prayers||0)%PRAYERS.length];
export const isLowEnergy=(state,id=activeCharacter(state))=>energyFor(state,id)<=LOW_ENERGY;
export const completedHomes=state=>(state.buildings||[]).filter(b=>b.status==='complete'&&['hut','tent','cottage','townhouse'].includes(b.kind));
export const sleepHome=(state,id)=>completedHomes(state).find(b=>b.id===id);
export const homeName=home=>buildingById(home?.kind)?.name||'Home';
export const canSleep=state=>!state.characters?.[activeCharacter(state)]?.sleep&&energyFor(state)<MAX_ENERGY;
export function sleepProgress(sleep,wall=Date.now()){
  const elapsed=Math.max(0,wall-sleep.startedAt)/1000;
  return {progress:Math.min(1,elapsed/SLEEP_SECONDS),remaining:Math.max(0,Math.ceil(SLEEP_SECONDS-elapsed))};
}
