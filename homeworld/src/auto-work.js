import {dist,SEEDS,gameTime,timeLabel,growth,cellFromKey} from './core.mjs';
import {woodRoom} from './wood-storage.mjs';
import {energyFor,FOODS,FOOD_RECIPES,completedHomes,canCook,isStarving} from './nutrition.mjs';
import {activeBuildings,buildingById,completedFires,litFires,firesNeedingLog,fireFuelLeft,FIRE_LOW_MINUTES,woodTotal} from './building.mjs';
import {toolTier,TOOL_TIERS,MINERALS,upgradeStatus} from './mining.mjs';
import {communityClaim} from './community.mjs';

/** Trees to fell for each wood goal. "store" keeps going until the store is full. */
const CHOP_TARGET={store:40,clear:4,few:2};
const LABELS={clear:'Clearing the land',chop:'Chopping wood',mine:'Breaking rocks',fish:'Fishing',water:'Watering the garden',plow:'Digging garden spots',plant:'Planting seeds',harvest:'Picking crops',stoke:'Feeding the campfire',eat:'Having a snack',rest:'Taking a breather',sleep:'Heading home to sleep',cook:'Cooking',build:'Building',craft:'Making tools'};
const GOAL_NOTES={store:'to fill the wood store',clear:'to clear land for a building',few:'for a few logs',one:'just one',all:'every thirsty plant',any:'',stone:'for stone',copper:'for copper',iron:'for iron',diamond:'for diamonds'};
const TOOL_LINES={clear:'is clearing the building spot',chop:'grabbed the axe',mine:'grabbed the pickaxe',fish:'took the fishing rod',water:'picked up the watering can',plow:'picked up the hoe',plant:'took a bag of seeds',harvest:'took a basket',eat:'is having a snack',rest:'is taking a breather',sleep:'is heading home',cook:'is cooking',build:'is picking a spot',craft:'is at the toolbench',stoke:'is taking a log to the campfire'};
const UNITS={clear:'thing',chop:'tree',mine:'rock',fish:'fish',water:'plant',plow:'spot',plant:'seed',harvest:'crop'};
/** Jobs that repeat until a count is reached. Everything else is one and done. */
const REPEATING=new Set(['clear','chop','mine','fish','water','plow','plant','harvest']);

/**
 * Lets a tapped island friend work on their own: the kid picks a task in the
 * chat (or types one), the character takes the right tool and repeats the job
 * until the goal is met. The kid can tap the character at any time to pause or stop.
 */
export class AutoWork {
  constructor(game){this.g=game;this.task=null;this.waitUntil=0;}
  get active(){return !!this.task;}
  get paused(){return !!this.task?.paused;}
  name(){const a=this.g.actor?.userData;return a?.name||this.g.store?.state.characters?.[this.g.store.state.activeCharacter]?.name||'Your friend';}

  /** Entry point for chat and postMessage: `{type, goal?, count?, item?}` or the controls stop/pause/resume. */
  start(spec){
    const g=this.g;if(!g.loaded||!spec?.type)return false;
    if(spec.type==='stop'){this.stop();return true;}
    if(g.ambientNudge?.())return false; // nobody on the island to send yet
    if(spec.type==='pause'){this.pause();return true;}
    if(spec.type==='resume'){this.resume();return true;}
    if(!LABELS[spec.type])return false;
    // A church wood goal must not yank someone off an explicit job (apple picking). Go on the to-do sheet does not set background, so the player can still replace it.
    if(spec.background&&(this.task?.explicit||g.pinJob))return false;
    if(g.store.state.characters?.[g.store.state.activeCharacter]?.sleep){if(spec.type==='sleep')return true;g.nutrition?.wakeUp();}
    if(this.task)this.stop(true);
    if(g.action||g.order)g.unequipTool();
    g.releasePose?.();
    if(!spec.background)g.pinJob=null;
    const type=spec.type;
    let goal=spec.goal||(type==='chop'?'few':type==='water'?'all':type==='mine'?'any':'one');
    const count=spec.count>0?Math.max(1,Math.min(20,Math.round(spec.count))):null;
    let target=1;
    if(type==='chop')target=count||CHOP_TARGET[goal]||2;
    else if(type==='water')target=goal==='one'?1:60;
    else if(type==='harvest')target=count||60;
    else if(REPEATING.has(type))target=count||1;
    if(type==='clear'){const ob=g.building?.sitePlan?g.building.obstacles(g.building.sitePlan):null;target=ob?ob.trees.length+ob.rocks.length+ob.seeds.length+ob.stumps.length:0;if(!target){g.building?.resumeSite?.();return false;}}
    // `until` = keep going until the bag holds this much (goal-driven jobs: "chop until we have 30 wood").
    let until=spec.until&&typeof spec.until==='object'?spec.until:null;
    // "Get 16 rocks" means 16 stone in the bag, not 16 boulders smashed.
    if(type==='mine'&&!until&&count>1&&(goal==='any'||goal==='stone')){until={stone:(g.store.state.inventory.stone||0)+count};goal='stone';}
    if(until)target=99;
    this.task={type,goal,item:spec.item||null,target,until,then:spec.then||null,done:0,paused:false,fails:0,startedAt:Date.now(),explicit:!spec.background};
    this.waitUntil=0;g.residents?.closeMenu();
    const note=REPEATING.has(type)?GOAL_NOTES[goal]||'':'';
    g.status=`${this.name()} ${TOOL_LINES[type]}${note?' '+note:''}. Tap them to pause or stop.`;g.toast(g.status);g.notify();
    this.next();return true;
  }

  pause(){
    const t=this.task;if(!t||t.paused)return;t.paused=true;this.interrupt();
    this.g.status=`${this.name()} paused. Tap them to keep going or stop.`;this.g.notify();
  }
  resume(){
    const t=this.task;if(!t||!t.paused)return;t.paused=false;this.waitUntil=0;this.g.residents?.closeMenu();
    this.g.status=`${this.name()} is back to work.`;this.g.notify();this.next();
  }
  stop(quiet=false){
    if(!this.task){if(!quiet&&(this.g.action||this.g.order)){this.g.unequipTool();this.g.toast(`${this.name()} stopped.`);}return;}
    const t=this.task;this.task=null;this.interrupt();this.g.setTool('walk');
    if(!quiet){this.g.status=t.done?`${this.name()} stopped after ${this.progress(t)}.`:`${this.name()} stopped working.`;this.g.toast(this.g.status);}
    this.g.notify();
  }
  /** Finish a task gracefully, with a reason the kid can read. */
  finish(reason){const t=this.task;if(!t)return;this.task=null;this.g.setTool('walk');this.g.status=reason;this.g.toast(reason);this.g.notify();if(t.type==='clear'&&t.done>=t.target)this.g.building?.resumeSite?.();}

  /** Stop whatever is in flight, keeping saved progress (every chop hit counts). */
  interrupt(){
    const g=this.g;
    if(g.action){
      if(['chop','mine'].includes(g.action.type)){if(!g.stopGathering())g.finishAction();}
      else if(g.action.type==='fish'&&g.fishing?.active){g.fishing.quit();}
      else if(['fish','rest','eat'].includes(g.action.type)){g.nutrition?.clear();g.action=null;Object.values(g.tools||{}).forEach(m=>m.visible=false);}
      else if(g.action.type!=='sleep'&&g.action.type!=='build'){g.action=null;Object.values(g.tools||{}).forEach(m=>m.visible=false);}
    }
    if(g.action?.type!=='sleep'&&g.action?.type!=='build'){g.path=[];g.order=null;if(g.marker)g.marker.visible=false;}
    g.persist();
  }

  progress(t=this.task){
    if(!t)return '';
    const unit=UNITS[t.type];
    if(t.until)return t.until.wood?`${woodTotal(this.g.store.state)}/${t.until.wood} wood`:`${this.g.store.state.inventory.stone||0}/${t.until.stone} stone`;
    if(!unit)return LABELS[t.type].toLowerCase();
    return `${t.done} ${unit}${t.done===1||unit==='fish'?'':'s'}`;
  }

  /** Called from finishAction: count what just got done, then queue the next job. */
  onFinish(a){
    const t=this.task;if(!t||!a)return;
    // Jobs that run the whole way themselves end with the action.
    if((t.type==='sleep'&&a.type==='sleep')||(t.type==='fish'&&a.type==='fish')||(t.type==='eat'&&a.type==='eat')||(t.type==='rest'&&a.type==='rest')||(t.type==='build'&&a.type==='build')){this.task=null;this.g.setTool('walk');this.g.notify();return;}
    if(t.paused||a.cancelled)return;
    if(t.type==='clear'&&(((a.type==='chop'||a.type==='mine')&&a.broken)||(a.type==='dig_stump'&&!a.failed)))t.done++;
    if(t.type==='chop'&&a.type==='chop'&&a.broken)t.done++;
    if(t.type==='mine'&&a.type==='mine'&&a.broken)t.done++;
    if(t.type==='water'&&a.type==='water')t.done++;
    if(t.type==='plow'&&a.type==='plow')t.done++;
    if(t.type==='plant'&&a.type==='plant')t.done++;
    if(t.type==='harvest'&&a.type==='harvest')t.done++;
    if(a.failed)t.fails++;
    this.waitUntil=performance.now()+(a.type==='chop'||a.type==='mine'?650:350);
    this.g.notify();
  }

  /** Runs every frame: when the character is free, pick up loose wood or begin the next job. */
  update(now=performance.now()){
    const t=this.task;if(!t||t.paused)return;const g=this.g;
    if(g.pinJob&&g.pinJob!==t.type)return;
    if(g.action||g.order||g.path.length||now<this.waitUntil)return;
    if(t.type==='build'&&g.building?.preview)return; // the kid is choosing the spot
    if(g.store.state.night||g.store.state.characters?.[g.store.state.activeCharacter]?.sleep){if(t.type!=='sleep')this.finish(`${this.name()} stopped for the night.`);return;}
    this.waitUntil=now+400;this.next();
  }

  next(){
    const t=this.task;if(!t||t.paused)return;const g=this.g;
    if(t.until){const s0=g.store.state,have=t.until.wood?woodTotal(s0):(s0.inventory.stone||0),want=t.until.wood||t.until.stone;if(have>=want){if(t.then){const nxt=t.then;this.task=null;g.setTool('walk');g.toast(`${this.name()} has ${have} ${t.until.wood?'wood':'stone'} now. Back to the ${nxt.type==='build'?(buildingById(nxt.item)?.name||'building'):nxt.type==='stoke'?'campfire':'toolbench'}!`);this.start(nxt);return;}this.finish(`${this.name()} got there: ${have} ${t.until.wood?'wood':'stone'} in the bag!`);return;}}
    if(t.type==='clear'){const plan=g.building?.sitePlan;const ob=plan?g.building.obstacles(plan):null;if(!ob||!(ob.trees.length+ob.rocks.length+ob.seeds.length+ob.stumps.length)){t.done=t.target;this.finish(`${this.name()} cleared the spot. Ready to build!`);return;}}
    if(REPEATING.has(t.type)&&t.done>=t.target){const note=t.goal==='one'||t.goal==='any'||t.goal==='all'?'':GOAL_NOTES[t.goal]||'';this.finish(`${this.name()} finished: ${this.progress()}${note?' '+note:''}.`);return;}
    if(t.fails>=3){this.finish(`${this.name()} could not keep going. ${g.status||''}`.trim());return;}
    // Hunger only slows the work down. An empty tummy earns a snack break when the bag has food;
    // otherwise the job carries on slowly. Running out of energy is the one thing that stops it.
    const starving=!['sleep','eat','rest','cook','fish','harvest'].includes(t.type)&&isStarving(g.store.state,gameTime(g.store.state));
    const tired=!['sleep','eat','rest','cook'].includes(t.type)&&energyFor(g.store.state)<=5;
    if(starving||tired){
      const s=g.store.state,food=Object.keys(FOODS).sort((a,b)=>FOODS[b].energy-FOODS[a].energy).find(id=>s.inventory[id]>0);
      if(food&&(t.snacks||0)<8){g.nutrition.eat(food);if(g.action){t.snacks=(t.snacks||0)+1;g.status=`${this.name()} is ${starving?'hungry':'tired'}. Quick snack, then back to work.`;g.toast(g.status);g.notify();return;}}
      if(tired){this.finish(`${this.name()} is too tired to keep working.${s.inventory.fish?' Grill the fish so there is something to eat.':' Time to eat or sleep.'}`);return;}
      if(!t.slowNoted){t.slowNoted=true;g.toast(`${this.name()} is starving and working very slowly.${s.inventory.fish?' Grill the fish for a proper meal.':' Pick ripe crops or catch a fish.'}`);}
    }
    const toastBefore=g.toasts?.[0]?.id;
    const ok=this.step(t);
    if(!this.task)return; // step finished the task itself
    const started=!!(g.order||g.path.length||g.action);
    if(ok===false||(!started&&!ok)){t.fails++;this.waitUntil=performance.now()+900;const why=g.toasts?.[0]?.id!==toastBefore?g.toasts[0].text:'nothing left to do here.';if(t.fails>=3||ok===false)this.finish(`${this.name()} stopped: ${why}`);}
    else t.fails=0;
  }

  /**
   * When a build/craft is short on wood or stone, go collect the missing part
   * first (chop or mine until the bag holds enough), then come back and finish
   * the original job. Returns true when a gathering trip was started.
   */
  gatherFor(need,then,label){
    const g=this.g,s=g.store.state,wood=woodTotal(s),stone=s.inventory.stone||0;
    const shortStone=Math.max(0,(need.stone||0)-stone),shortWood=Math.max(0,(need.wood||0)-wood);
    if(!shortStone&&!shortWood)return false;
    // Stone first (rocks are the usual blocker), then wood; the second shortfall chains after the first.
    const steps=[];
    if(shortStone)steps.push({type:'mine',goal:'any',until:{stone:need.stone}});
    if(shortWood)steps.push({type:'chop',goal:'few',until:{wood:need.wood}});
    if(shortWood&&!woodRoom(s)){this.finish(`${label} needs ${shortWood} more wood, but the wood store is full. Build a bigger store or use some wood first.`);return true;}
    let chain=then;for(let i=steps.length-1;i>=0;i--){steps[i].then=chain;chain=steps[i];}
    const parts=[];if(shortStone)parts.push(`${shortStone} more stone`);if(shortWood)parts.push(`${shortWood} more wood`);
    this.task=null;g.setTool('walk');
    g.toast(`${label} needs ${parts.join(' and ')}. ${this.name()} is off to ${shortStone?'break some rocks':'chop some wood'} first.`);
    return this.start(chain);
  }

  /**
   * One job. Returns true when a walk/action was queued or the job completed
   * instantly, false when it cannot start (a toast explains why).
   */
  step(t){
    const g=this.g,s=g.store.state;
    switch(t.type){
      case 'clear':{
        const ob=g.building.obstacles(g.building.sitePlan);
        if(ob.trees.length){const tr=ob.trees.sort((a,b)=>dist(g.player,{x:a.position[0],y:a.position[1]})-dist(g.player,{x:b.position[0],y:b.position[1]}))[0];return g.chop(tr.id)!==false&&!!(g.order||g.path.length);}
        if(ob.rocks.length)return g.mining.mine(ob.rocks[0].id)!==false&&!!(g.order||g.path.length);
        if(ob.stumps.length)return g.digStump(ob.stumps[0].id)!==false&&!!(g.order||g.path.length);
        if(ob.seeds.length){g.tool='walk';g.walk({x:ob.seeds[0].position[0],y:ob.seeds[0].position[1]});return !!g.path.length;}
        return true;
      }
      case 'chop':{
        if(!woodRoom(s)){this.finish(`${this.name()} filled the wood store.${t.done?` ${this.progress()} chopped.`:''}`);return true;}
        const drops=(s.woodDrops||[]).filter(d=>dist(g.player,d)<6).sort((a,b)=>dist(g.player,a)-dist(g.player,b));
        if(drops.length){g.walk(drops[0]);if(g.path.length)return true;}
        const res=g.nearestTree();return res!==false&&!!(g.order||g.path.length);
      }
      case 'mine':{
        const res=g.mining.nearest(t.goal==='any'?null:t.goal);return res!==false&&!!(g.order||g.path.length);
      }
      case 'fish':{g.nutrition.goFish();return !!(g.order||g.path.length);}
      case 'water':{
        const res=g.gardenAction('water',null);if(res===false)return false;
        if(!g.order&&!g.path.length){this.finish(t.done?`${this.name()} watered ${this.progress()}. The garden is happy.`:`${this.name()} found no thirsty plants.`);return true;}
        return true;
      }
      case 'plow':{const res=g.gardenAction('plow',null);if(res===false)return false;if(!g.order&&!g.path.length){this.finish(t.done?`${this.name()} dug ${this.progress()}.`:`${this.name()} found no clear grass for a garden spot.`);return true;}return true;}
      case 'plant':{
        const seed=SEEDS.find(x=>x.id===t.item)||SEEDS.find(x=>(s.inventory[x.id]||0)>0&&x.kind==='crop')||SEEDS.find(x=>(s.inventory[x.id]||0)>0);
        if(!seed||!(s.inventory[seed.id]>0)){this.finish(`${this.name()} has no ${seed?seed.name.toLowerCase()+' seeds':'seeds'} to plant. Seeds are scattered around the island.`);return true;}
        g.seed=seed.id;
        const res=g.gardenAction('plant',null);if(res===false)return false;
        if(!g.order&&!g.path.length){
          // Weedy soil is skipped above. Clear it before digging a brand-new spot.
          const cleared=g.gardenAction('clear_weeds',null);if(cleared===false)return false;
          if(g.order||g.path.length)return true;
          const dug=g.gardenAction('plow',null);if(dug===false||(!g.order&&!g.path.length)){this.finish(t.done?`${this.name()} planted ${this.progress()}.`:`${this.name()} has nowhere to plant. Dig a garden spot first.`);return true;}
        }
        return true;
      }
      case 'harvest':{const res=g.gardenAction('harvest',null);if(res===false)return false;if(!g.order&&!g.path.length){this.finish(t.done?`${this.name()} picked ${this.progress()}.`:`${this.name()} found no crops ready to pick.`);return true;}return true;}
      case 'eat':{
        const item=t.item&&FOODS[t.item]&&s.inventory[t.item]>0?t.item:Object.keys(FOODS).find(id=>s.inventory[id]>0);
        if(!item){this.finish(`${this.name()} has no food in the bag.${s.inventory.fish?' There is raw fish to grill first.':' Pick crops or catch a fish.'}`);return true;}
        g.nutrition.eat(item);return !!g.action;
      }
      case 'rest':{g.nutrition.rest();return !!g.action;}
      case 'sleep':{const ok=g.nutrition.goSleep();if(!ok){this.task=null;g.setTool('walk');g.notify();}return ok!==false;}
      case 'cook':{
        const recipe=t.item&&FOOD_RECIPES[t.item]?t.item:Object.keys(FOOD_RECIPES).find(id=>canCook(s,id))||'grill_fish';
        g.nutrition.cook(recipe);
        if(!g.order&&!g.path.length){this.task=null;g.setTool('walk');g.notify();return true;}
        t.type='cook';return true;
      }
      case 'stoke':{
        const min=gameTime(s),fire=completedFires(s).find(b=>b.id===t.fireId)||firesNeedingLog(s,min)[0];
        if(!fire||fireFuelLeft(fire,min)>=FIRE_LOW_MINUTES){this.finish(`${this.name()} has the campfire burning again.`);return true;}
        if(!woodTotal(s)){if(this.gatherFor({wood:1},{type:'stoke',fireId:fire.id},'The campfire'))return true;this.finish(`${this.name()} has no logs for the fire and nowhere to put wood.`);return true;}
        g.nutrition.stokeFire(fire.id);
        if(!g.order&&!g.path.length){if(fireFuelLeft(fire,gameTime(g.store.state))>=FIRE_LOW_MINUTES)this.finish(`${this.name()} put a log on the campfire.`);else{this.task=null;g.setTool('walk');g.notify();}return true;}
        return true;
      }
      case 'build':{
        const kind=t.item&&buildingById(t.item)?t.item:null;
        if(!kind){this.finish(`${this.name()} is not sure what to build. Open Actions → Build to choose.`);return true;}
        const b=buildingById(kind);
        const gather=this.gatherFor({wood:b.wood,stone:b.stone},{type:'build',item:kind},b.name);if(gather)return true;
        const ok=g.building.startPreview(kind);
        if(ok){this.task=null;g.notify();return true;}
        return false;
      }
      case 'craft':{
        const tier=toolTier(s);const next=TOOL_TIERS[tier.tier+1];
        if(!next){this.finish(`${this.name()} already has the best tools!`);return true;}
        const st=upgradeStatus(s,next.tier);
        if(st.needsForge){this.finish(st.forgeBuilding?`${next.name} tools wait for the forge to finish building.`:`${next.name} tools need a forge. Open Better tools to build one.`);return true;}
        if(st.forging){this.finish(`${next.name} tools are in the forge.`);return true;}
        if(st.busy){this.finish('The forge is busy. It can make one set of tools at a time.');return true;}
        if(!st.canCraft){
          const onlyStone=st.missing.length&&st.missing.every(m=>m.id==='stone');
          if(onlyStone){const gather=this.gatherFor({stone:next.recipe.stone},{type:'craft'},`${next.name} tools`);if(gather)return true;}
          const list=st.missing.map(m=>`${m.quantity} ${MINERALS?.[m.id]?.name||m.id.replace(/_/g,' ')}`).join(', ');
          this.finish(list?`${next.name} tools still need ${list}.${next.find?` Look for ${next.find} rocks.`:''}`:`${next.name} tools need more: ${st.reason}`);return true;}
        g.mining.upgrade(next.tier);this.task=null;g.notify();return true;
      }
    }
    return false;
  }

  snapshot(){
    const t=this.task;if(!t)return null;
    const countable=REPEATING.has(t.type)&&t.target<50;
    return {type:t.type,goal:t.goal,label:LABELS[t.type],note:GOAL_NOTES[t.goal]||'',done:t.done,target:countable?t.target:null,progress:this.progress(),paused:t.paused};
  }

  /** What the character knows about the island right now; sent to the chat so they talk like they live here. */
  brief(){
    const g=this.g,s=g.store?.state;if(!s)return null;
    const inv=s.inventory||{},minutes=gameTime(s);
    const pick=ids=>Object.fromEntries(ids.filter(id=>inv[id]>0).map(id=>[id,inv[id]]));
    const working=this.task?`${LABELS[this.task.type]}${this.task.paused?' (paused)':''}`:g.action?LABELS[g.action.type]||g.action.type:g.order?`walking to ${g.order.type}`:null;
    const ready=Object.entries(s.cells||{}).filter(([,c])=>growth(c,minutes)?.stage==='ready').length;
    const thirsty=Object.values(s.cells||{}).filter(c=>c?.seed&&growth(c,gameTime(s))?.thirsty).length;
    return {
      name:this.name(),energy:energyFor(s),wood:woodTotal(s),fish:inv.fish||0,
      food:pick(Object.keys(FOODS)),seeds:pick(SEEDS.map(x=>x.id)),minerals:pick(Object.keys(MINERALS)),
      buildings:activeBuildings(s).filter(b=>b.status==='complete').map(b=>buildingById(b.kind)?.name||b.kind),
      time:timeLabel(minutes),day:Math.floor(minutes/1440)+1,night:!!s.night,working,
      canSleep:completedHomes(s).length>0,hasFire:completedFires(s).length>0,fireLit:litFires(s,gameTime(s)).length>0,fireMinutes:Math.max(0,...completedFires(s).map(b=>fireFuelLeft(b,gameTime(s)))),tools:toolTier(s).name,
      garden:{ready,thirsty},
    };
  }
}
