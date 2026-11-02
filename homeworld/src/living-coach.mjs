import {CARROT_SPOTS} from './living-garden-rules.mjs';
/** Completed milestones, in order. Never reward actions a second time. */
export function coachMilestones(garden,state){
 const logs=(state.inventory?.wood||0)+(state.deposits?.['first-camp']||0);
 return [garden.planted===4&&'planted',(garden.watered||CARROT_SPOTS.every(i=>garden.wateredAt[i]!==null))&&garden.planted===4&&'watered',garden.completed&&'harvested',garden.completed&&logs>=3&&'wood',state.stage>=1&&'tent'].filter(Boolean);
}
export function coachBeat(id,name,garden,state,friendPhase){
 const logs=(state.inventory?.wood||0)+(state.deposits?.['first-camp']||0),first=String(name||'friend').trim().split(/\s+/)[0];
 if(id==='tent'){
  if(['placed','unlocked'].includes(friendPhase)||state.adamUnlocked)return null;
  if(friendPhase==='aboard')return {id,line:'Adam’s home is ready!',spoken:`Wonderful work, ${first}! Your tent is ready, and Adam is already aboard your ship. Tap Bring Adam, then choose a clear spot here on your island to welcome him.`,label:'Bring Adam',action:'friend'};
  if(friendPhase==='placing')return {id,line:'Welcome Adam to your island!',spoken:`Adam is ready, ${first}! Tap a clear spot on your island to welcome him.`,label:'Choose a spot',action:'friend'};
 }
 const beats={
  planted:{line:'Seeds planted! Now water.',spoken:`Great planting, ${first}! You planted all four seeds. Now tap the blue drops to water them.`,label:'Water seeds',action:'garden'},
  watered:{line:'Great watering! Time to pick.',spoken:`Lovely work, ${first}! Your carrots are growing. Let’s pick one carrot, one pumpkin and one lettuce from the ready-to-pick plants.`,label:'Check garden',action:'garden'},
  harvested:{line:logs>=3?'You grew it! Let’s build.':'You grew it! Cut 3 trees.',spoken:`You did it, ${first}! You picked all three vegetables. ${logs>=3?'Your wood is ready. Bring it to the glowing circle to build your tent.':'Now cut down three trees so we can build a tent for a friend.'}`,label:logs>=3?'Build a tent':'Cut trees',action:'next'},
  wood:{line:'Wood collected! Build a tent.',spoken:`Great chopping, ${first}! Bring your wood to the glowing circle and choose Build. Let’s make a place for your first friend to stay.`,label:'Build a tent',action:'next'},
  tent:{line:'A home for your first friend!',spoken:`Wonderful work, ${first}! Your tent is ready. Now you have somewhere for a friend to stay. Let’s go to the Godly Ship and find your first Bible friend!`,label:'Find a friend',action:'friend'},
 };
 return beats[id]?{id,...beats[id]}:null;
}
export class LivingCoach {
 constructor(test){
  this.test=test;this.g=test.g;this.beat=null;this.sent='';
  const saved=this.g.store.state.livingCoachSeen;
  this.seen=new Set(Array.isArray(saved)?saved:coachMilestones(test.farm.state.garden,test.state));
 }
 update(){
  const t=this.test,done=coachMilestones(t.farm.state.garden,t.state),fresh=done.filter(id=>!this.seen.has(id));
  if(fresh.length){
   // If several steps finish together, show only the most useful next step.
   done.forEach(id=>this.seen.add(id));try{this.g.store.save({...this.g.store.state,livingCoachSeen:[...this.seen]});}catch{/* Keep the current visit playable if persistence is unavailable. */}
   this.beat=coachBeat(fresh.at(-1),t.playerName,t.farm.state.garden,t.state,t.friendPhase);
  }
  // A card may remain open while the journey advances. Refresh it instead
  // of sending a child back through an already completed story.
  if(this.beat?.id==='tent')this.beat=coachBeat('tent',t.playerName,t.farm.state.garden,t.state,t.friendPhase);
  const visible=this.beat&&!t.dialogOpen&&!t.arrival?.active&&!t.watching&&!this.g.interior?{...this.beat,autoSpeak:this.g.music?.on!==false}:null;
  const signature=visible?`${visible.id}:${visible.label}:${visible.autoSpeak}`:'none';
  if(signature!==this.sent){this.sent=signature;this.post(visible);}
 }
 post(beat){if(window.parent!==window)window.parent.postMessage({type:'gk-living-coach',beat},location.origin);}
 respond(id,action){
  if(!this.beat||id!==this.beat.id||!['next','later'].includes(action))return;
  const beat=this.beat;this.beat=null;this.sent='none';this.post(null);
  if(action==='later'){if(beat.id==='tent')this.test.dismissInvite();return;}
  if(action!=='next')return;
  if(beat.action==='friend')this.test.requestFirstFriend();
  else if(beat.action==='garden')this.test.garden.go();else this.test.showNext();
 }
 dispose(){this.post(null);}
}
