/**
 * Island to-do list.
 *
 * Reads the save the same way AutoWork does and turns it into a short list of
 * things the characters could usefully do right now ("3 plants are thirsty",
 * "no campfire, but 20 raw fish"). Every item carries a ready-to-run AutoWork
 * task so a kid can tap "Go" and the character gets to work.
 */
import {SEEDS,gameTime,growth} from './core.mjs';
import {woodStorage} from './wood-storage.mjs';
import {energyFor,FOODS,FOOD_RECIPES,completedHomes,canCook,LOW_ENERGY} from './nutrition.mjs';
import {buildingById,completedFires,litFires,firesNeedingLog,woodTotal} from './building.mjs';
import {toolTier,TOOL_TIERS,MINERALS,upgradeStatus} from './mining.mjs';

const MAX_ITEMS=4;
const WOOD_STORES=['wood_store_20','wood_store_50','wood_store_100','wood_store_200'];
const mineralName=id=>MINERALS[id]?.name||id.replace(/_ore$/,'').replace(/_/g,' ');
const goalFor=id=>({stone:'stone',copper_ore:'copper',iron_ore:'iron',diamond:'diamond'})[id]||'any';
/** Smallest wood building that can hold the logs the goal still needs. */
function nextWoodStore(space){
  const stores=WOOD_STORES.map(id=>buildingById(id)).filter(Boolean);
  return stores.find(b=>b.woodCapacity>=Math.max(1,space))||stores[stores.length-1];
}

/** @returns {Array<{id:string,icon:string,title:string,why:string,task:object|null}>} */
export function planFor(game){
  const s=game?.store?.state;if(!s||!game.loaded)return [];
  const name=game.autoWork?.name?.()||'Your friend';
  const inv=s.inventory||{},minutes=gameTime(s),hour=(minutes%1440)/60;
  const energy=energyFor(s),wood=woodTotal(s),storage=woodStorage(s);
  const fires=litFires(s,minutes).length,homes=completedHomes(s).length,outFires=firesNeedingLog(s,minutes);
  const items=[];
  const add=(id,icon,title,why,task)=>{if(!items.some(i=>i.id===id))items.push({id,icon,title,why,task});};
  if(outFires.length&&wood>0)add('stoke','wood',outFires.some(f=>!(f.fuelUntil>minutes))?'Add a log to the campfire':'The campfire is burning low','Each log keeps it burning for 2 hours.',{type:'stoke',fireId:outFires[0].id});
  const cells=Object.values(s.cells||{});
  const thirsty=cells.filter(c=>c?.seed&&growth(c,minutes)?.thirsty).length;
  const ready=cells.filter(c=>c?.seed&&growth(c,minutes)?.stage==='ready').length;
  const emptyPlots=cells.filter(c=>c?.soil==='tilled'&&!c.seed&&!c.buildingId).length;
  const foods=Object.keys(FOODS).filter(id=>inv[id]>0);
  const cropSeed=SEEDS.find(x=>x.kind==='crop'&&inv[x.id]>0)||SEEDS.find(x=>inv[x.id]>0);
  const fish=inv.fish||0,stone=inv.stone||0;

  // 0. The goal the kid set (e.g. "build a Cottage"): quantified steps, in order.
  const goal=game.goal;
  if(goal){
    const def=buildingById(goal.kind);
    const needWood=Math.max(0,def.wood-wood),needStone=Math.max(0,def.stone-stone);
    if(needWood>0&&storage.free<=0){
      const next=nextWoodStore(needWood);
      add('goal_store','build',`Build a ${next.name}`,`The wood store is full (${wood}/${storage.capacity}). ${def.name} still needs ${needWood} more wood. A ${next.name} adds room for ${next.woodCapacity}.`,{type:'build',item:next.id});
    }else if(needWood>0){
      const tight=storage.free<needWood?` The store only has room for ${storage.free} more.`:'';
      add('goal_wood','axe',`Chop ${needWood} more wood`,`${def.name} needs ${def.wood} wood · we have ${wood}/${def.wood}.${tight}`,{type:'chop',goal:'build',until:{wood:def.wood}});
    }
    if(needStone>0)add('goal_stone','mine',`Break rocks for ${needStone} more stone`,`${def.name} needs ${def.stone} stone · we have ${stone}/${def.stone}.`,{type:'mine',goal:'stone',until:{stone:def.stone}});
    if(!needWood&&!needStone)add('goal_build','build',`Build the ${def.name}!`,'Everything is in the bag. Pick the spot, clear it if needed, and press Place.',{type:'build',item:goal.kind});
  }
  // 1. Tired characters come first: nothing else gets done on an empty tank.
  if(energy<=LOW_ENERGY){
    if(foods.length)add('eat','food',`${name} should eat`,`Energy is ${energy}. There is ${FOODS[foods[0]].name.toLowerCase()} in the bag.`,{type:'eat',item:foods[0]});
    else if(fish>0&&fires>0&&canCook(s,'grill_fish'))add('cook','cookedfish','Grill a fish',`Energy is ${energy}. ${fish} raw fish are waiting by the campfire.`,{type:'cook',item:'grill_fish'});
    else if(homes>0&&hour>=19)add('sleep','moon','Head home to sleep',`Energy is ${energy} and it is getting late.`,{type:'sleep'});
    else add('rest','rest','Take a breather',`Energy is ${energy}. A short rest brings it back up to 25.`,{type:'rest'});
  }
  // 2. Bedtime is close.
  if(hour>=21&&homes>0&&energy<100)add('sleep','moon','Head home to sleep','Bedtime is at 10 PM. Sleeping at home refills energy for tomorrow.',{type:'sleep'});
  // 3. Garden chores.
  if(thirsty>0)add('water','water_drop',`Water ${thirsty} thirsty plant${thirsty===1?'':'s'}`,'Plants stop growing until they get a drink · one watering lasts about 2 days.',{type:'water',goal:'all'});
  if(ready>0)add('harvest','harvest',`Pick ${ready} ripe crop${ready===1?'':'s'}`,'Fresh food means more energy for everyone.',{type:'harvest'});
  // 4. A fire turns raw fish into meals.
  if(!fires&&fish>0){
    const fire=buildingById('campfire');
    if(fire&&wood>=fire.wood&&stone>=fire.stone)add('build_fire','build','Build a campfire',`${fish} raw fish can’t be eaten until they’re grilled. We have the wood and stone.`,{type:'build',item:'campfire'});
    else if(fire&&stone<fire.stone)add('mine_stone','mine',`Break rocks for ${fire.stone-stone} more stone`,`A campfire needs ${fire.stone} stone to grill those ${fish} fish.`,{type:'mine',goal:'stone',count:fire.stone-stone});
    else if(fire)add('chop_fire','axe',`Chop ${fire.wood-wood} more wood`,`A campfire needs ${fire.wood} wood to grill those ${fish} fish.`,{type:'chop',goal:'build',count:Math.max(1,fire.wood-wood)});
  }
  // 5. Somewhere to sleep.
  if(!homes){
    const tent=buildingById('tent');
    if(tent&&wood>=tent.wood)add('build_home','build',`Put up a ${tent.name}`,'Nobody has a bed yet. A home gives a full energy refill at night.',{type:'build',item:'tent'});
    else if(tent)add('chop_home','axe',`Chop ${tent.wood-wood} more wood for a ${tent.name}`,'Nobody has a bed yet. Homes need wood first.',{type:'chop',goal:'build',count:Math.max(1,tent.wood-wood)});
  }
  // 6. Keep the wood pile healthy.
  if(storage.free>0&&wood<Math.max(10,storage.capacity*.4))add('chop','axe','Stock up on wood',`Only ${wood} wood on hand and room for ${storage.free} more.`,{type:'chop',goal:'store'});
  // 7. Better tools.
  const next=TOOL_TIERS[toolTier(s).tier+1];
  if(next){
    const st=upgradeStatus(s,next.tier);
    if(st.needsForge&&!st.forgeBuilding){const forge=buildingById('forge');if(forge)add('build_forge','build','Build a forge',`${next.name} tools are made at a forge and take a little while.`,{type:'build',item:'forge'});}
    else if(st.canCraft)add('craft','mine',`Make ${next.name} tools`,'Everything needed is in the bag. The forge takes a little while.',{type:'craft'});
    else if(st.missing.length===1&&MINERALS[st.missing[0].id]&&st.missing[0].id!=='stone'){const m=st.missing[0];add('mine_'+m.id,'mine',`Dig up ${m.quantity} ${mineralName(m.id)}`,`That is all ${next.name} tools still need.`,{type:'mine',goal:goalFor(m.id),count:m.quantity});}
  }
  // 8. Empty garden spots with seeds in the bag.
  if(emptyPlots>0&&cropSeed)add('plant','plant',`Plant ${cropSeed.name.toLowerCase()} seeds`,`${emptyPlots} dug spot${emptyPlots===1?' is':'s are'} sitting empty.`,{type:'plant',item:cropSeed.id,count:Math.min(emptyPlots,5)});
  // 9. Fresh fish for the pantry.
  if(fish<3&&fires>0)add('fish','fish','Catch a few fish','The campfire is ready but the pantry is low.',{type:'fish',count:3});
  // 10. Nothing urgent.
  if(!items.length)add('explore','walk','All caught up!','Go for a walk, say hi to the animals, or start a new build.',null);
  return items.slice(0,MAX_ITEMS);
}

/**
 * Hand one to-do to every chosen friend. Each id is used once.
 * Friends who can work in the background get a resident job; the friend you
 * are playing keeps auto-work (only one body can do that). The same task
 * object is passed through, so a shared `until` (120 wood, 53 stone) stays
 * one bag target instead of being multiplied by headcount.
 */
export function assignCrew(game,task,who){
  const ids=[...new Set((Array.isArray(who)?who:[who]).filter(Boolean))];
  if(!game?.assign||!task?.type||!ids.length)return false;
  const active=game.actor?.userData?.residentId;
  const helper=id=>{const actor=game.residents?.models?.get(id);return !!(actor&&actor!==game.actor&&game.residents.canHelp(task));};
  const helpers=ids.filter(helper),bodies=ids.filter(id=>!helper(id));
  let ok=false;
  for(const id of helpers)ok=game.assign(task,id)||ok;
  const body=bodies.includes(active)?active:bodies[0];
  if(body)ok=game.assign(task,body)||ok;
  return ok;
}
