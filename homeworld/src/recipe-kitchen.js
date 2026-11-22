// Between meals, a cook or feeder ashore looks at the bag and crafts one snack.
// Notices fire once per recipe per island day: "Eve made seed crackers."
import {gameTime,timeLabel} from './core.mjs';
import {skillFor} from './character-skills.mjs';
import {noteEvent} from './island-feed.mjs';
import {pickRecipe,noticed,recipeDay} from './recipes.mjs';
import {checkIn,speakRefusal} from './foreman-check.mjs';

/** Island hours after breakfast, lunch and dinner when a cook checks the bag. */
export const CRAFT_HOURS=[9,14,16,20];
export const craftSlot=hour=>CRAFT_HOURS.find(h=>hour>=h&&hour<h+1)??null;

/** Eve, and any friend whose role is cook or feeder. */
export function isFeeder(name){
  const skill=skillFor(name);
  if(!skill)return false;
  if(skill.id==='cook')return true;
  return /feeder/i.test(skill.id||'')||/feeder/i.test(skill.name||'');
}

const BUBBLE_MS=5200;

export class RecipeKitchen{
  constructor(game){this.g=game;this.bubble=null;this.seen=null;this.foremanTold={};}
  /** Story friends ashore, Eve first. On the standalone island the built-in Eve counts too. */
  feeders(){
    const g=this.g,out=[];
    for(const [,actor] of g.residents?.models||[]){
      const name=actor?.userData?.name;
      if(name&&isFeeder(name))out.push(actor);
    }
    if(!g.playersOnly){
      const eve=g.community?.actors?.eve;
      if(eve?.actor){
        if(!eve.actor.userData.name)eve.actor.userData.name=eve.name||'Eve';
        if(!eve.actor.userData.id)eve.actor.userData.id=eve.id||'eve';
        if(isFeeder(eve.actor.userData.name)&&!out.includes(eve.actor))out.push(eve.actor);
      }
    }
    out.sort((a,b)=>(a.userData?.name==='Eve'?0:1)-(b.userData?.name==='Eve'?0:1));
    return out;
  }
  card(){
    if(!this.bubble)return null;
    if(performance.now()>this.bubble.until){this.bubble=null;return null;}
    return {name:this.bubble.name,text:this.bubble.text};
  }
  update(){
    const g=this.g,s=g.store?.state;
    if(this.bubble&&performance.now()>this.bubble.until){this.bubble=null;g.notify?.();}
    if(!s||s.night||g.ambient||g.dining?.meal)return;
    const minutes=gameTime(s),{day,hour}=timeLabel(minutes),slot=craftSlot(hour);
    if(slot==null)return;
    const key=`${day}:${slot}`;
    if(this.seen===key)return;
    const feeder=this.feeders().find(actor=>!g.dining?.owns?.(actor)&&!g.dining?.grilling?.(actor));
    if(!feeder)return;
    const recipe=pickRecipe(s.inventory);
    this.seen=key;
    if(!recipe)return;
    const home=feeder.userData||{};
    const id=home.id||home.residentId||'eve',name=home.name||'Eve';
    const gate=checkIn(s,{who:id,brain:'cook',intent:{action:'craft'}});
    if(!gate.ok){speakRefusal(g,this.foremanTold,id,name,gate);return;}
    this.craft(feeder,recipe,key,day);
  }
  craft(actor,recipe,key,day){
    const g=this.g,home=actor.userData||{},s=g.store.state;
    const x=Number.isFinite(home.x)?home.x:actor.position?.x??g.player?.x??0;
    const y=Number.isFinite(home.y)?home.y:(actor.position? -actor.position.z : g.player?.y??0);
    const id=home.id||home.residentId||'eve',name=home.name||'Eve';
    const announce=!noticed(s,recipe.id,day??recipeDay(gameTime(s)));
    const before=s;
    g.store.commitAs(id,name,{x,y},{type:'craft_recipe',recipe:recipe.id,actionId:`craft:${id}:${recipe.id}:${key}`.slice(0,128)});
    if(g.store.state===before)return false;
    if(announce){
      const line=`${name} made ${recipe.name.toLowerCase()}.`;
      this.bubble={name,text:line,until:performance.now()+BUBBLE_MS};
      g.toast?.(line,BUBBLE_MS);
      try{noteEvent('meal',line,{who:name,id:`recipe:${day}:${recipe.id}`});}catch{/* feed is best-effort */}
    }
    g.notify?.();
    return true;
  }
}
