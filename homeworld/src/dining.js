// Dining Hall scene: ring the bell and every friend (and the character you play) walks to the hall,
// sits at the long table, the meal is served from the bag in one go, and everyone eats together.
// The meal routine lives here too: Eve fishes and picks, Noah grills the catch, Eve rings the bell. Rules are in dining.mjs.
import * as THREE from 'three';
import {dist,gameTime,timeLabel,heightAt,growth} from './core.mjs';
import {FOODS,hungerFor,activeCharacter} from './nutrition.mjs';
import {footprint,workPoint,completedFires,litFires,fireCanTakeLog} from './building.mjs';
import {HALL_SEATS,TABLE_TOP_Y,completedHalls,hallById,hallPoint,hallApproach,seatYaw,planMeal,servedLabel} from './dining.mjs';
import {skillFor,MEAL_FISH,MEAL_TIMES,mealAt,hourLabel} from './character-skills.mjs';
import {servesMeal} from './today-goals.mjs';
import {turnToward,resetAnimatedPose} from './character-motion.js';
import {fishModel} from './nutrition.js';
import {noteEvent} from './island-feed.mjs';
import {ASK_AGAIN_MINUTES,kidFirstName,mealAskLine,playedCookStep} from './meal-ask.mjs';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=t=>t<0?0:t>1?1:t*t*(3-2*t);
const EAT_SECONDS=7,GATHER_TIMEOUT=28,WALK_IN_SPEED=1.05,GRILL_SECONDS=3.4;
const material=c=>new THREE.MeshStandardMaterial({color:c,roughness:.9});
function prop(geometry,mat,group,xyz=[0,0,0]){const o=new THREE.Mesh(geometry,mat);o.position.set(...xyz);o.castShadow=true;group.add(o);return o;}
/** A small plate with the served food on it, in table-local metres. */
export function foodProp(item){
  const g=new THREE.Group();prop(new THREE.CylinderGeometry(.16,.13,.016,16),material('#efe7d6'),g,[0,.008,0]);
  if(item==='cooked_fish'){const f=fishModel(true);f.scale.setScalar(.85);f.position.set(0,.03,0);f.rotation.y=.4;g.add(f);}
  else if(item==='apple'){prop(new THREE.SphereGeometry(.07,12,10),material('#d93a2f'),g,[0,.085,0]);prop(new THREE.CylinderGeometry(.006,.008,.04,6),material('#5a3b1e'),g,[0,.16,0]);}
  else if(item==='carrot'){prop(new THREE.ConeGeometry(.035,.22,8),material('#f28c28'),g,[0,.045,0]).rotation.z=Math.PI/2;prop(new THREE.ConeGeometry(.025,.07,6),material('#4f9d3a'),g,[.13,.045,0]).rotation.z=-Math.PI/2;}
  else if(item==='pumpkin'){const p=prop(new THREE.SphereGeometry(.09,12,10),material('#e8832a'),g,[0,.09,0]);p.scale.y=.75;prop(new THREE.CylinderGeometry(.012,.016,.05,6),material('#5f7a2b'),g,[0,.17,0]);}
  else if(item==='bread'){const loaf=prop(new THREE.IcosahedronGeometry(.13,1),material('#d4a45b'),g,[0,.06,0]);loaf.scale.set(1,.6,.72);}
  else if(item==='manna'){for(const [x,z] of [[-.05,0],[.05,.03],[0,-.05]])prop(new THREE.SphereGeometry(.035,10,8),material('#fff4d6'),g,[x,.045,z]);}
  else prop(new THREE.SphereGeometry(.06,10,8),material('#c9b36a'),g,[0,.07,0]);
  return g;
}
/** Seated pose on a bench: hips drop to the bench, thighs forward under the table, shins down, hands on the table. `eat` 0..1 lifts the right hand to the mouth. */
export function sitPose(rig,bones,eat=0,t=0){
  if(!bones?.mixamorigHips)return;
  bones.mixamorigHips.position.y-=.44;
  for(const side of ['Left','Right']){bones[`mixamorig${side}UpLeg`]?.rotateX(-1.35);bones[`mixamorig${side}Leg`]?.rotateX(1.3);bones[`mixamorig${side}Foot`]?.rotateX(.15);}
  bones.mixamorigSpine?.rotateX(.08+Math.sin(t*1.4)*.015);bones.mixamorigHead?.rotateX(.18*eat);
  rig.actor.updateMatrixWorld(true);
  const lift=ease(eat),right=[-.2+.13*lift,TABLE_TOP_Y+.06+(1.02-TABLE_TOP_Y)*lift,.3-.14*lift],left=[.22,TABLE_TOP_Y+.06,.3];
  rig.ik('Right',rig.localPoint(right));rig.ik('Left',rig.localPoint(left));rig.actor.updateMatrixWorld(true);
}
const walkClip=(g,home,speed,dt)=>{const walk=home.clips?.Walking;if(!walk)return;if(!walk.isRunning()||home.idling||home.flourish){home.mixer.stopAllAction();walk.reset().setLoop(THREE.LoopRepeat,Infinity).play();walk.setEffectiveTimeScale(speed/1.5);home.idling=false;home.flourish=null;}g.stepMixer(home.mixer,dt);};

export class Dining {
  constructor(game){this.g=game;this.meal=null;this.owned=new Map();this.props=[];this.bell=null;this.routine={key:null,meal:null,stage:'idle',grill:'idle',noted:false,woodTried:false,ask:null,released:false};this.grill=null;}
  hall(id){const s=this.g.store?.state;return s?hallById(s,id):null;}
  halls(){const s=this.g.store?.state;return s?completedHalls(s):[];}
  /** True while this scene drives a friend (seated, walking in, or grilling) — Residents.update then leaves them alone. */
  owns(actor){return actor!==this.g.actor&&(!!(this.meal&&this.owned.has(actor))||this.grill?.actor===actor);}
  /** Everyone who would come to the table: the character you play plus every friend ashore. */
  diners(){
    const g=this.g,s=g.store.state,out=[],seen=new Set();
    const me=activeCharacter(s);if(me){out.push({id:me,name:s.characters?.[me]?.name||me,actor:g.actor,player:true});seen.add(me);}
    for(const [id,actor] of g.residents?.models||[]){if(seen.has(id)||actor===g.actor)continue;seen.add(id);out.push({id,name:actor.userData.name||id,actor,player:false});}
    return out;
  }
  /** What ringing the bell would do right now, for the hall card. */
  preview(hallId){
    const g=this.g,s=g.store?.state;if(!s)return null;const hall=this.hall(hallId);if(!hall)return null;
    const minutes=gameTime(s),diners=this.diners(),plan=planMeal(s,diners,minutes);
    const hungry=diners.map(d=>({id:d.id,name:d.name,hunger:Math.round(hungerFor(s,minutes,d.id)),player:d.player})).sort((a,b)=>a.hunger-b.hunger);
    const shelf=Object.keys(FOODS).filter(id=>(s.inventory[id]||0)>0).map(id=>({id,name:FOODS[id].name,count:s.inventory[id]}));
    return {hallId:hall.id,hungry,shelf,served:plan.served,servedLabel:servedLabel(plan.served),servings:plan.servings.length,empty:!shelf.length,everyoneFull:!!shelf.length&&!plan.servings.length,inProgress:!!this.meal,lastMeal:s.lastMeal||null,cook:this.cookActor()?.userData.name||null,griller:(g=>{const a=this.grillActor();return a&&a!==this.cookActor()?a.userData.name:null;})(),mealTimes:MEAL_TIMES,night:!!s.night};
  }
  /** Ring the bell: gather everyone at the hall. Returns false (with a toast) when there is nothing to serve. */
  ring(hallId,{cook=null,quiet=false}={}){
    const g=this.g,s=g.store.state,say=t=>{if(!quiet)g.toast(t);};
    if(this.meal){say('A meal is already on the table.');return false;}
    if(s.night){say('Everyone is asleep. Ring the bell in the morning.');return false;}
    const hall=this.hall(hallId);if(!hall){say('Build a Dining Hall first.');return false;}
    if(g.fishing?.active||g.interior||g.nutrition?.sleep||g.action?.type==='sleep'){say('Finish what you are doing first, then ring the bell.');return false;}
    const minutes=gameTime(s),diners=this.diners(),plan=planMeal(s,diners,minutes);
    if(!plan.servings.length){say(Object.keys(FOODS).some(id=>s.inventory[id]>0)?'Everyone is full right now. Save the food for later.':'The shelf is empty. Cook or gather some food first.');return false;}
    if(g.action)g.finishAction();
    if(cook){const ca=this.cookActor();if(ca)g.residents.reelEvent?.(ca);}
    // Hungriest friends get the benches; late-comers stand at the ends of the table.
    const order=[...diners].sort((a,b)=>hungerFor(s,minutes,a.id)-hungerFor(s,minutes,b.id)),seats=[...HALL_SEATS],seated=new Map();
    for(const d of order){const seat=seats.shift();if(!seat)break;seated.set(d.id,seat);}
    this.meal={hallId:hall.id,hall,phase:'gather',startedAt:performance.now(),cook,diners:order,seats:seated,served:null};
    for(const d of order){
      const seat=seated.get(d.id);if(!seat)continue;const approach=hallApproach(g.world,hall,seat),seatAt=hallPoint(g.world,hall,seat);
      if(d.player){
        g.keys?.clear();g.lastGroundKey=null;if(g.building?.preview)g.building.cancelPreview?.();
        const path=g.nav.path(g.player,approach);
        if(!path&&dist(g.player,approach)>3){seated.delete(d.id);continue;}
        g.path=[...(path||[]),seatAt];g.order={type:'dine',hallId:hall.id,seat,approach,seatAt,target:seatAt};g.marker.visible=false;g.status='Walking to the Dining Hall…';
      }else{
        const home=d.actor.userData;if(home.chore){g.residents.claims?.delete(home.chore.key);home.chore=null;}if(home.workTool)home.workTool.visible=false;home.strollState=null;
        const path=g.nav.path({x:home.x,y:home.y},approach);
        if(!path&&dist(home,approach)>3){seated.delete(d.id);continue;}
        this.owned.set(d.actor,{id:d.id,seat,approach,seatAt,path:path||[],phase:'walk',t:Math.random()*3});
      }
    }
    if(!seated.size){this.meal=null;say('Nobody can reach the hall. Clear a path to it first.');return false;}
    this.swingBell(hall.id);g.music?.sfx?.play?.('bell');
    g.toast(`${cook?`${cook} rings the bell · `:''}Mealtime! Everyone to the Dining Hall.`);
    if(cook)try{noteEvent('meal',`${cook} rang the bell · Mealtime!`,{who:cook});}catch{/* feed is best-effort */}
    g.notify();return true;
  }
  swingBell(hallId){const root=this.g.building?.nodes?.get(hallId)?.root,bell=root?.getObjectByName('bell');if(bell)this.bell={bell,t:0};}
  /** Everyone is seated: feed everyone from the bag in one commit and put the plates on the table. */
  serve(){
    const g=this.g,m=this.meal,before=g.store.state;
    try{g.store.commit({type:'serve_meal',hallId:m.hallId,diners:m.diners.filter(d=>m.seats.has(d.id)).map(d=>({id:d.id,name:d.name})),cook:m.cook||undefined,actionId:`meal:${m.hallId}:${Date.now()}`});}catch(e){g.toast(e.message);}
    const after=g.store.state,meal=after!==before?after.lastMeal:null;
    if(!meal){g.toast('Nothing could be served. Is the shelf empty?');this.release();return;}
    m.served=meal;const root=g.building?.nodes?.get(m.hallId)?.root;
    if(root){
      const perDiner={};for(const s of meal.servings||[])(perDiner[s.id]??=[]).push(s.item);
      for(const [id,items] of Object.entries(perDiner)){const seat=m.seats.get(id);if(!seat)continue;const facing=seat.z<0?-1:1;items.slice(0,2).forEach((item,k)=>{const p=foodProp(item);p.position.set(seat.x+(items.length>1?(k?.19:-.19):0),TABLE_TOP_Y,seat.z===0?facing*.25*Math.sign(seat.x||1):seat.z*.36);root.add(p);this.props.push({root,p});});}
    }
    const fed=meal.diners.length-meal.hungry.length;
    g.toast(`${servedLabel(meal.served)} served · ${fed} fed${meal.hungry.length?` · ${meal.hungry.length} still a little hungry`:''} · leftovers back in the bag.`);
    if(m.cook)try{noteEvent('meal',`${m.cook} served ${servedLabel(meal.served).toLowerCase()} · ${fed} fed.`,{who:m.cook});}catch{/* feed is best-effort */}
    m.phase='eat';m.eatUntil=performance.now()+EAT_SECONDS*1000;g.status='Eating together…';g.notify();
  }
  clearProps(){for(const {root,p} of this.props)root.remove(p);this.props=[];}
  /** Let a friend go: pose reset, a short pause, then they stroll as usual. */
  free(actor){const home=actor.userData;this.owned.delete(actor);resetAnimatedPose(home);home.idling=false;home.flourish=null;home.strollState={wait:1.5+Math.random()*3};home.anchor={x:home.x,y:home.y};}
  release(){
    const g=this.g;if(!this.meal)return;
    for(const actor of [...this.owned.keys()])this.free(actor);this.clearProps();
    if(g.action?.type==='dine'){const a=g.action;g.finishAction();g.path=[a.approach];}
    else if(g.order?.type==='dine'){g.order=null;g.path=[];}
    this.meal=null;g.notify();
  }
  /** Residents.update hands a friend here while the meal (or Eve's grilling) owns them. */
  drive(actor,dt){
    if(this.grill?.actor===actor){this.driveGrill(dt);return;}
    const g=this.g,st=this.owned.get(actor),home=actor.userData,m=this.meal;if(!st||!m)return;
    if(st.phase==='walk'){
      if(st.path.length){g.residents.walkAlong(actor,st.path,1.6,dt);return;}
      const here={x:home.x,y:home.y},to=m.phase==='leave'?st.approach:st.seatAt,d=dist(here,to);
      if(d>.04){const step=Math.min(d,WALK_IN_SPEED*dt);turnToward(actor,Math.atan2(to.x-here.x,-(to.y-here.y)),dt);g.residents.place(actor,here.x+(to.x-here.x)/d*step,here.y+(to.y-here.y)/d*step);walkClip(g,home,WALK_IN_SPEED,dt);return;}
      if(m.phase==='leave'){this.free(actor);return;}
      st.phase='sit';home.mixer?.stopAllAction();home.idling=false;home.flourish=null;return;
    }
    if(st.phase==='sit'){
      if(m.phase==='leave'){st.phase='walk';st.path=[];resetAnimatedPose(home);return;}
      resetAnimatedPose(home);actor.rotation.y=seatYaw(g.world,m.hall,st.seat);st.t+=dt;
      const eating=m.phase==='eat'?Math.max(0,Math.sin(st.t*2.2)):0;
      sitPose(g.residents.helperRig(home,actor),home.bones,eating,st.t);
    }
  }
  /** world.animateWork hands the played character here while seated ('dine' action). */
  animatePlayer(dt){
    const g=this.g,a=g.action,m=this.meal;if(!m||m.hallId!==a.hallId){g.finishAction();return;}
    a.t=(a.t||0)+dt;a.phase='sit';
    g.actor.rotation.y=seatYaw(g.world,m.hall,a.seat);g.actor.updateMatrixWorld(true);
    const eating=m.phase==='eat'?Math.max(0,Math.sin(a.t*2.2)):0;
    sitPose(g,g.bones,eating,a.t);g.status=m.phase==='eat'?'Eating together…':'Waiting for everyone to sit down…';
  }
  seatedCount(){let n=0;for(const st of this.owned.values())if(st.phase==='sit')n++;if(this.g.action?.type==='dine')n++;return n;}
  update(dt){
    const g=this.g;if(!g.loaded||!g.store)return;
    if(this.bell){const b=this.bell;b.t+=dt;b.bell.rotation.x=Math.sin(b.t*9)*.45*Math.max(0,1-b.t/3.2);if(b.t>3.4){b.bell.rotation.x=0;this.bell=null;}}
    const m=this.meal;
    if(m){
      // Swapping to play as a seated friend takes them out of the scene.
      for(const actor of [...this.owned.keys()])if(actor===g.actor){this.free(actor);m.seats.delete(actor.userData.id);}
      const elapsed=(performance.now()-m.startedAt)/1000;
      if(m.phase==='gather'){
        if(this.seatedCount()>=m.seats.size||elapsed>GATHER_TIMEOUT){
          for(const [actor,st] of [...this.owned])if(st.phase!=='sit'){m.seats.delete(st.id);this.free(actor);}
          if(g.order?.type==='dine'){m.seats.delete(activeCharacter(g.store.state));g.order=null;g.path=[];}
          if(m.seats.size)this.serve();else{g.toast('Nobody made it to the table.');this.release();}
        }
      }else if(m.phase==='eat'){
        if(performance.now()>m.eatUntil){m.phase='leave';this.clearProps();if(g.action?.type==='dine'){const a=g.action;g.finishAction();g.path=[a.approach];g.status='Thank you for the meal!';}}
      }else if(m.phase==='leave'){
        if(!this.owned.size||elapsed>GATHER_TIMEOUT+EAT_SECONDS+20)this.release();
      }
    }
    this.routineUpdate();
  }

  // ---- Meals: an hour before each meal Eve fishes and picks what is ripe while Noah grills the catch; Eve rings the bell. ----
  /** A friend the kid sent off the kitchen today (guard, wood, the garden) skips the meal. No override: same as before. */
  servesKitchen(actor){const home=actor?.userData;if(!home?.id)return true;return servesMeal(this.g.store?.state,home.id,home.name);}
  cookActor(){for(const [,actor] of this.g.residents?.models||[])if(skillFor(actor.userData.name)?.id==='cook'&&this.servesKitchen(actor))return actor;return null;}
  /** Who grills before meals: the friend whose skill says `grills` (Noah). Eve covers it when he is away or being played. */
  grillActor(){
    const g=this.g;let cook=null;
    for(const [,actor] of g.residents?.models||[]){const sk=skillFor(actor.userData.name);if(sk?.grills&&actor!==g.actor&&this.servesKitchen(actor))return actor;if(sk?.id==='cook')cook=actor;}
    return cook&&cook!==g.actor&&this.servesKitchen(cook)?cook:null;
  }
  /** The meal Eve is working toward right now (null between windows). Used by residents so her own chores wait. */
  cooking(){const r=this.routine;return r.meal&&r.stage!=='done'&&r.stage!=='idle'?r.meal:null;}
  /** True while a friend is grilling or fetching a log for the fire — their own chores wait. */
  grilling(actor){const r=this.routine;return this.grill?.actor===actor||(r.grill==='wood'&&actor.userData.job?.type==='chop'&&!actor.userData.job.explicit);}
  /**
   * Being played: Play as calls Residents.possess, which sets `game.actor` to that body
   * and saves the same id on `state.activeCharacter`. The live check is the body.
   */
  isPlayed(actor){return !!actor&&actor===this.g.actor;}
  /** Chat card while the kid is playing the cook and a meal is due. Null when she is not asking. */
  askCard(){
    const a=this.routine?.ask;
    if(!a?.open||!a.text)return null;
    const name=a.name||'Eve';
    return {name,text:a.text,goLabel:`Go on, ${name}`};
  }
  /** "Not yet": she stays under the kid. Ask again in about 10 island minutes. */
  declineAsk(){
    const r=this.routine,a=r.ask;if(!a?.open||!this.g.store)return;
    r.ask={...a,open:false,againAt:gameTime(this.g.store.state)+ASK_AGAIN_MINUTES};
    this.g.notify?.();
  }
  /** "Go on": let go of her body so the meal routine can fish, pick, and ring. */
  acceptAsk(){
    const g=this.g,r=this.routine,eve=this.cookActor();
    r.ask=null;r.released=true;
    let handed=false;
    if(eve){
      for(const [,actor] of g.residents?.models||[]){
        if(actor===eve||!actor.userData?.bones)continue;
        if(g.residents.playAs(actor.userData.id)){handed=true;break;}
      }
    }
    if(!handed){
      g.autoWork?.stop?.(true);
      if(g.action)g.finishAction?.();
      g.keys?.clear?.();g.path=[];g.order=null;if(g.marker)g.marker.visible=false;
    }
    g.notify?.();
  }
  routineUpdate(){
    const g=this.g,s=g.store.state;if(!g.playersOnly||s.night||g.ambient)return;
    const minutes=gameTime(s),{day,hour}=timeLabel(minutes),r=this.routine,meal=mealAt(hour);
    const key=meal?`${day}:${meal.id}`:null;
    if(r.key!==key){r.key=key;r.meal=meal;r.stage='idle';r.grill='idle';r.noted=false;r.woodTried=false;r.ask=null;r.released=false;if(this.grill)this.stopGrill();}
    if(!meal)return;
    const eve=this.cookActor();
    if(this.grill&&this.grill.actor===g.actor)this.stopGrill();
    if(hour<meal.hour&&!this.meal)this.grillUpdate(eve,meal);
    if(!eve)return;const home=eve.userData,isMe=this.isPlayed(eve),when=hourLabel(meal.hour),what=meal.name.toLowerCase();
    if(r.stage==='done'){if(r.ask)r.ask=null;return;}
    // Her body is the one the kid is playing: she does not fish, pick, or ring until they say go.
    if(isMe){
      const step=playedCookStep({hour,mealHour:meal.hour,minutes,mealId:meal.id,ask:r.ask,released:r.released});
      if(step.kind==='hold'||step.kind==='showing'||step.kind==='snooze')return;
      if(step.kind==='skip'){r.stage='done';r.ask=null;r.released=false;return;}
      if(step.kind==='ask'){
        const who=home.name||'Eve';
        r.ask={mealId:meal.id,variant:step.variant,open:true,againAt:0,text:mealAskLine(meal.id,kidFirstName(),step.variant),name:who};
        g.notify?.();return;
      }
    }
    if(hour>=meal.hour){
      if(this.meal)return;
      // Opened the island well after mealtime: skip this one instead of ringing a stale bell.
      if(r.stage==='idle'&&hour>=meal.hour+1.5){r.stage='done';return;}
      if(this.grill)this.stopGrill();
      if(home.job&&!home.job.explicit)g.residents.stopJob(eve,false);
      const hall=this.halls()[0];
      if(!hall){if(!r.noted){r.noted=true;g.toast(`${home.name} has ${what} ready, but there is nowhere to serve it. Build a Dining Hall (Community) and she will ring the bell at ${when}.`);}r.stage='done';return;}
      r.stage='done';if(!this.ring(hall.id,{cook:home.name,quiet:true}))g.toast(`${home.name} looked at the shelf at ${when}: ${Object.keys(FOODS).some(id=>s.inventory[id]>0)?`everyone is full, so ${what} can wait.`:'nothing to serve yet. Grill some fish or gather food, then tap the hall to ring the bell.'}`);return;
    }
    if(isMe||this.meal)return;
    if(r.stage==='idle'){
      if(home.job?.explicit){r.stage='ready';return;}
      if(home.job)g.residents.stopJob(eve,false);
      if(!g.world.fishingSpots?.length){r.stage='gather';return;}
      if(g.residents.assignJob(eve,{type:'fish',count:MEAL_FISH,background:true,quick:true,note:`${home.name} is fishing for ${what}.`}))r.stage='fishing';else r.stage='gather';
      return;
    }
    if(r.stage==='fishing'){if(!home.job||home.job.type!=='fish')r.stage='gather';return;}
    if(r.stage==='gather'){
      // If Eve is the one grilling (Noah away), the garden waits until the fish are done.
      if(this.grilling(eve))return;
      // Whatever is ripe in the garden goes on the table too.
      const ripe=Object.values(s.cells||{}).some(c=>{const gr=growth(c,minutes);return gr&&gr.seed.kind==='crop'&&gr.stage==='ready';});
      if(ripe&&g.residents.assignJob(eve,{type:'harvest',count:8,background:true,note:`${home.name} is picking garden food for ${what}.`}))r.stage='picking';else r.stage='ready';
      return;
    }
    if(r.stage==='picking'){if(!home.job||home.job.type!=='harvest')r.stage='ready';return;}
  }
  /** Noah's side of the meal: while Eve fishes he fetches a log if the fire is cold, then grills whatever she caught. */
  grillUpdate(eve,meal){
    const g=this.g,s=g.store.state,minutes=gameTime(s),r=this.routine;
    if(this.grill&&!this.servesKitchen(this.grill.actor))this.stopGrill();
    if(r.grill==='done')return;
    const who=this.grillActor();if(!who)return;const home=who.userData,what=meal.name.toLowerCase();
    if(r.grill==='grilling'){if(!this.grill)r.grill='done';return;}
    if(r.grill==='wood'){if(home.job?.type==='chop')return;r.grill='idle';}
    if(home.job?.explicit||this.owns(who))return;
    const waiting=eve&&eve!==g.actor&&who!==eve&&(r.stage==='idle'||r.stage==='fishing');
    if(waiting||(s.inventory.fish||0)<=0){
      // Eve is still at the water: get the fire ready — a cold campfire with no log in the bag means chopping one now.
      if(waiting&&!r.woodTried&&!litFires(s,minutes).length&&completedFires(s).some(b=>fireCanTakeLog(b,minutes))&&!this.hasLog(s)){
        if(home.job)g.residents.stopJob(who,false);
        if(g.residents.assignJob(who,{type:'chop',goal:'few',count:1,background:true,note:`${home.name} is fetching a log to light the campfire for ${what}.`})){r.woodTried=true;r.grill='wood';}
      }
      if(!waiting)r.grill='done';
      return;
    }
    if(home.job)g.residents.stopJob(who,false);
    if(this.beginGrill(who))r.grill='grilling';
  }
  hasLog(s){return Object.entries(s.inventory).some(([id,n])=>id.endsWith('_wood')&&n>0);}
  beginGrill(actor){
    const g=this.g,s=g.store.state,minutes=gameTime(s),home=actor.userData,r=this.routine;
    let fire=litFires(s,minutes).sort((a,b)=>dist(footprint(g.world,a).center,home)-dist(footprint(g.world,b).center,home))[0];
    if(!fire){
      const cold=completedFires(s).find(b=>fireCanTakeLog(b,minutes));
      if(!cold){if(!r.noted){r.noted=true;g.toast(`${home.name} has fish to grill but there is no campfire. Build one and it will be lit before meals.`);}r.grill='done';return false;}
      if(!this.hasLog(s)){
        // No log in the bag: chop one first (once per meal), then come back and light the fire.
        if(!r.woodTried&&g.residents.assignJob(actor,{type:'chop',goal:'few',count:1,background:true,note:`${home.name} needs a log to light the campfire. Off to chop one.`})){r.woodTried=true;r.grill='wood';return false;}
        if(!r.noted){r.noted=true;g.toast(`${home.name} has fish to grill, but the campfire is cold and there are no logs in the bag.`);}r.grill='done';return false;
      }
      fire=cold;
    }
    if(home.chore){g.residents.claims?.delete(home.chore.key);home.chore=null;}home.strollState=null;if(home.workTool)home.workTool.visible=false;
    const spot=workPoint(g.world,fire),path=g.nav.path({x:home.x,y:home.y},spot)||[];
    const stick=new THREE.Group(),rod=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.95,6),new THREE.MeshStandardMaterial({color:'#8a5a2b',roughness:1}));rod.rotation.z=Math.PI/2;rod.position.x=.42;stick.add(rod);const fish=fishModel(false);fish.position.set(.86,.02,0);fish.rotation.z=-.15;stick.add(fish);stick.visible=false;g.scene.add(stick);
    this.grill={actor,fireId:fire.id,spot,path,t:0,stick,stoked:false,grilled:0};
    g.toast(`${home.name} is grilling the catch for ${r.meal?.name.toLowerCase()||'the meal'}.`);
    g.residents.reelEvent?.(actor);
    return true;
  }
  stopGrill(){const gr=this.grill;if(!gr)return;this.g.scene.remove(gr.stick);const home=gr.actor.userData;resetAnimatedPose(home);home.idling=false;home.flourish=null;home.strollState={wait:2};this.grill=null;if(this.routine.grill==='grilling')this.routine.grill='done';}
  driveGrill(dt){
    const g=this.g,gr=this.grill,actor=gr.actor,home=actor.userData,s=g.store.state,minutes=gameTime(s);
    if(gr.path.length){g.residents.walkAlong(actor,gr.path,1.6,dt);return;}
    const fire=completedFires(s).find(b=>b.id===gr.fireId);if(!fire){this.stopGrill();return;}
    if(dist(home,gr.spot)>1.3){const p=g.nav.path({x:home.x,y:home.y},gr.spot);if(p?.length){gr.path=p;return;}g.residents.place(actor,gr.spot.x,gr.spot.y);}
    if(!litFires(s,minutes).some(b=>b.id===fire.id)){
      if(gr.stoked){this.stopGrill();return;}
      gr.stoked=true;const before=s;g.store.commitAs(home.id,home.name,{x:home.x,y:home.y},{type:'stoke',fireId:fire.id,actionId:`helper:${home.id}:stoke:${Date.now()}`});
      if(g.store.state!==before){g.burst?.(gr.spot,'wood',.2);g.toast(`${home.name} lit the campfire to grill.`);}return;
    }
    const fc=footprint(g.world,fire).center;turnToward(actor,Math.atan2(fc.x-home.x,-(fc.y-home.y)),dt);
    resetAnimatedPose(home);home.idling=false;home.flourish=null;actor.updateMatrixWorld(true);
    const rig=g.residents.helperRig(home,actor);gr.t+=dt;const bob=Math.sin(gr.t*2.6)*.03;
    rig.ik('Right',rig.localPoint([-.12,1.02+bob,.38]));rig.ik('Left',rig.localPoint([.14,1.0+bob,.34]));actor.updateMatrixWorld(true);
    const grip=home.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),aim=V(fc.x,heightAt(g.world,fc.x,fc.y)+.62+Math.sin(gr.t*2.1)*.04,-fc.y);
    gr.stick.visible=true;gr.stick.position.copy(grip);gr.stick.quaternion.setFromUnitVectors(V(1,0,0),aim.sub(grip).normalize());
    if(gr.t>=GRILL_SECONDS){
      gr.t=0;const before=g.store.state;
      g.store.commitAs(home.id,home.name,{x:home.x,y:home.y},{type:'cook',recipe:'grill_fish',fireId:fire.id,actionId:`helper:${home.id}:grill:${Date.now()}`});
      if(g.store.state!==before){gr.grilled++;g.burst?.(fc,'ember',.6);if((g.store.state.inventory.fish||0)<=0){const line=`${home.name} grilled ${gr.grilled} fish for ${this.routine.meal?.name.toLowerCase()||'the meal'}.`;g.toast(line);try{noteEvent('fire',line,{who:home.name});}catch{/* feed is best-effort */}this.stopGrill();}}
      else this.stopGrill();
    }
  }
  snapshot(){
    const g=this.g,s=g.store?.state;if(!s)return null;
    return {halls:this.halls().map(h=>h.id),meal:this.meal?{hallId:this.meal.hallId,phase:this.meal.phase}:null,lastMeal:s.lastMeal||null,cook:this.cookActor()?.userData.name||null,griller:this.grillActor()?.userData.name||null,routine:this.routine.stage,grillStage:this.routine.grill};
  }
}
