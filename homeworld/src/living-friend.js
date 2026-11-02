import * as THREE from 'three';
import {activeTrees,applyAction,canPlow,cellAt,cellFromKey,gameTime,heightAt} from './core.mjs';
import {clearTargets} from './clear-area.mjs';
import {rockProfile,toolTier} from './mining.mjs';
import {canAffordEnergy} from './nutrition.mjs';
import {woodRoom} from './wood-storage.mjs';
import {assignedProject} from './project-rules.mjs';
import {advancePath,resetAnimatedPose,turnToward,updateLocomotion} from './character-motion.js';
import {gardenCrop,gardenHarvest,gardenWork,GARDEN_CROPS} from './living-garden-rules.mjs';
import {nearbyGreeting,friendRole,validFriendTask} from '../../shared/friendConversation.mjs';

/** A companion owns only Adam's body. The player is never possessed or reassigned. */
export class LivingFriend {
 constructor(test){this.t=test;this.g=test.g;this.chatOpen=false;this.job=null;this.nextRoutine=20;this.near=false;this.greetingIndex=0;this.nextHello=0;this.greeting='';this.session=0;}
 get helper(){return this.g.community.actors.adam;}
 get ownsActor(){return this.chatOpen||!!this.job||!!this.g.store.state.livingClearArea||this.near;}
 get available(){return this.t.state.adamUnlocked&&this.t.state.welcomeSeen&&this.helper?.actor.visible&&!this.g.store.state.night&&!this.t.placingAdam;}
 position(){const p=this.helper.actor.position;return {x:p.x,y:-p.z};}
 freeze(){
  const g=this.g,s=g.store.state,m=s.community.members.adam;
  g.store.save({...s,community:{...s.community,members:{...s.community.members,adam:{...m,position:this.position(),job:null,readyAt:gameTime(s)+8}}}});
 }
 brief(){
  const w=this.g.autoWork.brief(),garden=this.t.farm.state.garden;
  return {...w,name:'Adam',role:friendRole('Adam'),energy:this.g.store.state.characters.adam.energy,working:this.g.store.state.livingClearArea?(this.clearNotice||'Clearing your marked area'):this.job?({water:'Watering plants',harvest:'Picking vegetables',chop:'Collecting wood',plow:'Digging a garden spot'}[this.job.type]):this.t.builder?'Building our home':'Caring for the farm',
   garden:{ready:[0,1,2,3,4,5].filter(i=>gardenCrop(garden,i)?.phase==='ready').length,thirsty:[0,1,2,3,4,5].filter(i=>gardenCrop(garden,i)?.phase==='thirsty').length},animals:this.t.farm.state.animals.map(a=>({name:a.name,kind:a.kind})),starterComplete:garden.completed};
 }
 post(data){if(window.parent!==window)window.parent.postMessage(data,location.origin);}
 open(mode='chat',arrival=false){
  if(!this.available||this.chatOpen||this.t.builder||assignedProject(this.g.store.state,'adam'))return;
  this.t.activity();this.t.garden.cancel();this.g.path=[];this.g.keys.clear();this.t.greetTarget=null;this.freeze();this.chatOpen=true;this.session++;
  this.helper.can.visible=false;this.helper.hammer.visible=false;this.helper.bench.visible=false;if(this.tool)this.tool.visible=false;
  this.savedCamera={zoom:this.g.zoom,yaw:this.g.viewYaw,pitch:this.g.viewPitch,overview:this.g.overview};this.g.overview=false;
  document.body.classList.add('living-chat-open');this.savedPlayerYaw=this.g.actor.rotation.y;this.chooseCamera();
  this.post({type:'gk-living-friend-open',session:this.session,mode,arrival,intro:!this.t.state.fenceAsked,character:{id:'adam',name:'Adam'},world:this.brief()});this.g.notify();
 }
 answerFence(answer){
  if(this.t.state.fenceAsked)return;
  this.t.state.fenceAsked=true;this.t.save();
  if(answer==='yes'){
   this.close();
   const asked=this.g.buildAsk?.requestFence?.({name:'Adam'});
   if(asked)this.g.buildAsk.accept();
   else this.g.toast?.('We need a clear moment before choosing the fence.');
   this.post({type:'gk-living-friend-ended',session:this.session});
   return;
  }
  this.post({type:'gk-living-friend-task-result',session:this.session,ok:true,line:'Ok, just let me know what tasks to help with.',world:this.brief()});
 }
 close(){if(!this.chatOpen)return;this.chatOpen=false;if(this.g.arrivals?.scene?.phase==='chat')this.g.arrivals.dismiss();document.body.classList.remove('living-chat-open');this.hiddenTrees=null;this.g.actor.rotation.y=this.savedPlayerYaw;this.g.refreshDynamic();this.t.activity();this.nextHello=this.t.elapsed+45;if(this.savedCamera){Object.assign(this.g,{zoom:this.savedCamera.zoom,viewYaw:this.savedCamera.yaw,viewPitch:this.savedCamera.pitch,overview:this.savedCamera.overview});this.g.updateProjection();}this.freeze();this.post({type:'gk-living-friend-ended',session:this.session});this.g.notify();}
 chooseCamera(){
  const g=this.g,actors=[this.helper.actor,g.actor],center=actors[0].position.clone().lerp(actors[1].position,.5).add(new THREE.Vector3(0,-.6,0));
  const ray=new THREE.Raycaster(),meshes=g.treeBatches.map(b=>b.mesh);g.scene.updateMatrixWorld(true);
  const hits=(eye)=>actors.flatMap(a=>[.5,1.4].flatMap(y=>{const point=a.position.clone().add(new THREE.Vector3(0,y,0));ray.set(eye,point.clone().sub(eye).normalize());ray.far=eye.distanceTo(point);return ray.intersectObjects(meshes,false);}));
  const delta=actors[1].position.clone().sub(actors[0].position);delta.y=0;delta.normalize();let best=null;
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,offset=new THREE.Vector3(Math.sin(angle)*10,5,Math.cos(angle)*10),blocked=hits(center.clone().add(offset)),score=blocked.length+Math.abs(offset.x*delta.x+offset.z*delta.z);if(!best||score<best.score)best={offset,blocked,score};}
  this.cameraOffset=best.offset;this.hiddenTrees=new Set(best.blocked.map(hit=>hit.object.userData.ids?.[hit.instanceId]).filter(Boolean));
  for(const tree of g.trees)if(actors.some(a=>Math.hypot(tree.position[0]-a.position.x,tree.position[1]+a.position.z)<3.5))this.hiddenTrees.add(tree.id);
 }
 camera(dt){
  const g=this.g,a=this.helper.actor,p=g.actor.position;
  // Frame both friends above the bottom conversation tray.
  const target=a.position.clone().lerp(p,.5);target.y-=.6;
  const k=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt*4);
  g.zoom+=(7.5-g.zoom)*k;g.updateProjection();g.focus.lerp(target,k);g.camera.up.set(0,1,0);
  g.camera.position.copy(g.focus).add(this.cameraOffset||new THREE.Vector3(4,5,9));g.camera.lookAt(g.focus);
  if(this.hiddenTrees?.size){const zero=new THREE.Matrix4().makeScale(0,0,0);for(const batch of g.treeBatches){for(const [i,id] of batch.mesh.userData.ids.entries())if(this.hiddenTrees.has(id))batch.mesh.setMatrixAt(i,zero);batch.mesh.instanceMatrix.needsUpdate=true;}}
  a.rotation.y=Math.atan2(p.x-a.position.x,p.z-a.position.z);g.actor.rotation.y=Math.atan2(a.position.x-p.x,a.position.z-p.z);
 }
 handle(data){
  if(data.session!==this.session||!this.chatOpen)return;
  if(data.type==='gk-living-friend-intro'){this.answerFence(data.answer);return;}
  if(data.type==='gk-living-friend-close')this.close();
  if(data.type==='gk-living-friend-task'&&validFriendTask(data.task)){
   if(data.task==='build'){this.close();window.dispatchEvent(new Event('gk-open-build'));this.post({type:'gk-living-friend-ended',session:this.session});return;}
   let result;try{result=this.assign(data.task);}catch{result={ok:false,line:'I couldn’t save that. Let’s try again.'};}
   this.post({type:'gk-living-friend-task-result',session:this.session,...result,world:this.brief()});
  }
 }
 target(type){
  const g=this.g,s=g.store.state,pos=this.position();
  const reachable=(target,extra={})=>{const path=g.nav.approach(pos,target,.8);return path&&Math.hypot((path.at(-1)||pos).x-target.x,(path.at(-1)||pos).y-target.y)<1.8?{target,path,...extra}:null;};
  if(type==='water'||type==='harvest'){
   const phase=type==='water'?'thirsty':'ready';
   for(const [index,p] of this.t.garden.plots.entries())if(gardenCrop(this.t.farm.state.garden,index)?.phase===phase){const found=reachable(p,{index});if(found)return found;}
  }
  if(type==='chop'&&woodRoom(s)>0){
   const trees=activeTrees(g.world,s,gameTime(s)).filter(t=>t.species!=='apple').sort((a,b)=>Math.hypot(a.position[0]-pos.x,a.position[1]-pos.y)-Math.hypot(b.position[0]-pos.x,b.position[1]-pos.y));
   for(const tree of trees.slice(0,30)){const found=reachable({x:tree.position[0],y:tree.position[1]},{id:tree.id});if(found)return found;}
  }
  if(type==='plow'){
   const center=this.t.garden.plots[0];
   for(let radius=1;radius<=4;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
    const key=cellAt(g.world,center.x+dx,center.y+dy).key,p=cellFromKey(g.world,key);
    if(this.t.garden.plots.some(plot=>Math.hypot(plot.x-p.x,plot.y-p.y)<.7)||s.cells[key]?.soil||!canPlow(g.world,s,key))continue;
    const found=reachable(p,{key});if(found)return found;
   }
  }
  return null;
 }
 assign(type,automatic=false){
  if(!validFriendTask(type)||!this.available)return {ok:false,line:'Let’s try again when I’m back.'};
  if(type==='stop'){this.saveClearPlan(null);this.finish(false);this.nextRoutine=this.t.elapsed+90;return {ok:true,line:'Of course! I’ll take a little break.'};}
  if(this.t.builder||assignedProject(this.g.store.state,'adam'))return {ok:false,line:'I’m finishing our building first.'};
  if(type==='build'){const asked=this.g.buildAsk?.requestBuilding?.({name:'Noah'},'tent','tent');if(!asked)window.dispatchEvent(new Event('gk-open-build'));else this.close();return {ok:true,line:'Where should I build? I’ll cut the trees and break the rocks on that spot.'};}
  if(type==='plow'){const asked=this.g.buildAsk?.request?.({id:'help-dig',mode:'garden',name:'Adam',text:'Tap the areas you want me to dig. Up to 20 spots.',cap:20});if(asked){this.close();return {ok:true,line:'Tap the areas you want me to dig. Up to 20 spots.'};}}
  if(type==='chop'){
   if(this.g.buildAsk.busy()||this.g.store.state.village?.siteDraft)return {ok:false,line:'Finish choosing your other spot first.'};
   this.close();const asked=this.g.buildAsk.startClearArea();
   return {ok:asked,line:asked?'Draw a box around the area you want me to clear.':'Let’s try again in a moment.'};
  }
  if(this.g.store.state.characters.adam.energy<10)return {ok:false,line:'I need a little rest before I can help.'};
  const target=this.target(type);if(!target)return {ok:false,line:({water:'The plants have water already!',harvest:'Let’s let the vegetables grow a little longer.',chop:'I need a clear path and room for wood in our bag.',plow:'There’s no clear garden spot nearby.'})[type]};
  this.finish(false);this.freeze();this.job={type,...target,position:this.position(),time:0,automatic};
  return {ok:true,line:({water:'I’ll water a thirsty plant!',harvest:'I’ll pick a ripe vegetable!',chop:'I’ll cut one tree for our wood pile!',plow:'I’ll dig a new garden spot!'})[type]};
 }
 saveClearPlan(plan){this.g.store.save({...this.g.store.state,livingClearArea:plan});}
 clearArea(keys,protectedKeys=[]){
  if(!this.available||this.t.builder||assignedProject(this.g.store.state,'adam')){this.g.toast('Adam is busy. Try again when he is ready.');return false;}
  const targets=clearTargets(this.g.world,this.g.store.state,keys,protectedKeys);
  if(!targets.length)return false;
  this.finish(false);
  this.saveClearPlan({keys:[...keys],ids:targets.map(t=>t.id),protectedKeys:[...protectedKeys]});
  this.clearRetryAt=0;this.clearNotice='';
  this.g.toast('Adam: I’ll clear the marked area. Your garden and buildings are safe.');
  return true;
 }
 nextClearJob(){
  const g=this.g,s=g.store.state,plan=s.livingClearArea;
  if(!plan||g.siteView||this.t.elapsed<(this.clearRetryAt||0))return;
  const targets=clearTargets(g.world,s,plan.keys,plan.protectedKeys).filter(t=>plan.ids.includes(t.id));
  if(!targets.length){this.saveClearPlan(null);g.toast('Adam: All clear! What shall we make here?');g.notify();return;}
  const pos=this.position(),scoped={...s,activeCharacter:'adam'};
  let reason='I can’t reach the remaining spots. Make a path, then I’ll try again.';
  targets.sort((a,b)=>Math.hypot(a.position[0]-pos.x,a.position[1]-pos.y)-Math.hypot(b.position[0]-pos.x,b.position[1]-pos.y));
  for(const target of targets){
   if(!canAffordEnergy(scoped,target)){reason='I need some energy. I’ll continue after a meal or rest.';continue;}
   if(target.type==='chop'&&!woodRoom(s)){reason='Our wood storage is full. Use some wood and I’ll keep going.';continue;}
   if(target.type==='mine_hit'&&toolTier(s).tier<rockProfile(target).minTier){reason='These rocks need stronger tools. I’ll continue after we upgrade.';continue;}
   const point={x:target.position[0],y:target.position[1]},reach=Math.max(1.7,(target.radius||0)+1),path=g.nav.approach(pos,point,Math.max(.8,reach-.5)),end=path?.at(-1)||pos;
   if(!path||Math.hypot(end.x-point.x,end.y-point.y)>reach)continue;
   this.freeze();this.job={type:target.type,id:target.id,target:point,path,reach,position:pos,time:0,automatic:true,clearing:true};this.clearNotice='';return;
  }
  this.clearRetryAt=this.t.elapsed+10;
  if(this.clearNotice!==reason){g.toast(`Adam: ${reason}`,6000);this.clearNotice=reason;}
 }
 finish(done){
  if(!this.job)return;
  const automatic=this.job.automatic;this.job=null;this.helper.can.visible=false;this.helper.hammer.visible=false;this.helper.bench.visible=false;if(this.tool)this.tool.visible=false;
  this.freeze();this.nextRoutine=this.t.elapsed+30;if(done&&!automatic)this.g.toast('Adam: All done! Thanks for working with me.');
 }
 update(dt){
  if(!this.available){this.near=false;if(this.chatOpen){this.post({type:'gk-living-friend-ended',session:this.session});this.close();}if(this.job)this.finish(false);return;}
  if(this.g.arrivals?.busy&&!this.chatOpen){this.near=false;return;}
  const t=this.t,g=this.g,h=this.helper,distance=Math.hypot(g.player.x-h.actor.position.x,g.player.y+h.actor.position.z);
  const near=distance<2.8&&!t.watching&&!t.dialogOpen&&!g.interior&&!g.overview;
  if(near&&!this.near&&!this.job&&!t.builder&&!assignedProject(g.store.state,'adam'))this.freeze();
  if(near&&!this.near&&t.elapsed>=this.nextHello){this.greeting=nearbyGreeting(t.playerName,this.greetingIndex++);this.nextHello=t.elapsed+45;}
  this.near=near;
  if(this.chatOpen){resetAnimatedPose(h);h.actor.rotation.y=Math.atan2(g.actor.position.x-h.actor.position.x,g.actor.position.z-h.actor.position.z);return;}
  if(!this.job&&g.store.state.livingClearArea&&!t.builder&&!assignedProject(g.store.state,'adam'))this.nextClearJob();
  if((g.siteView||g.store.state.livingClearArea)&&!this.job)return;
  if(g.residents?.models?.has('adam')&&!this.job)return;
  if(!this.job){
   if(near){h.can.visible=false;h.hammer.visible=false;h.bench.visible=false;updateLocomotion(h,g.idlePose,dt,0,Date.now()/1000);h.actor.rotation.y=Math.atan2(g.actor.position.x-h.actor.position.x,g.actor.position.z-h.actor.position.z);}
   // Farmer routine: tend thirsty plants. Tree cutting needs the child's explicit request.
   if(t.elapsed>this.nextRoutine&&!near&&!t.builder&&t.farm.state.garden.completed){this.nextRoutine=t.elapsed+30;this.assign('water',true);}return;
  }
  if(t.builder||assignedProject(g.store.state,'adam')){this.finish(false);return;}
  const j=this.job;
  const before={...j.position};advancePath(j.position,j.path,dt*1.7);
  h.actor.position.set(j.position.x,heightAt(g.world,j.position.x,j.position.y)+.015,-j.position.y);
  if(j.path.length){turnToward(h.actor,Math.atan2(j.position.x-before.x,-j.position.y+before.y),dt);updateLocomotion(h,g.idlePose,dt,1.7,Date.now()/1000);return;}
  if(Math.hypot(j.position.x-j.target.x,j.position.y-j.target.y)>(j.reach||1.8)){this.finish(false);return;}
  resetAnimatedPose(h);h.actor.rotation.y=Math.atan2(j.target.x-j.position.x,-j.target.y+j.position.y);j.time+=dt;
  const swing=Math.sin(j.time*5);h.bones.mixamorigSpine?.rotateX(.15+.1*swing);h.bones.mixamorigRightArm?.rotateX(-.7+.4*swing);h.bones.mixamorigRightForeArm?.rotateX(-.5);
  h.actor.updateMatrixWorld(true);
  if(j.type==='water'){h.can.visible=true;const hand=h.bones.mixamorigRightHand;h.can.position.copy(hand.getWorldPosition(new THREE.Vector3()));h.can.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()));h.can.rotateZ(-.5);}
  else if(['chop','plow','mine_hit','dig_stump'].includes(j.type)){
   if(this.toolKind!==j.type){if(this.tool)g.scene.remove(this.tool);this.tool=g.asset(j.type==='chop'?'tool_axe':j.type==='mine_hit'?'tool_pickaxe':'tool_hoe');g.scene.add(this.tool);this.toolKind=j.type;}
   this.tool.visible=true;const hand=h.bones.mixamorigRightHand;this.tool.position.copy(hand.getWorldPosition(new THREE.Vector3()));this.tool.quaternion.copy(hand.getWorldQuaternion(new THREE.Quaternion()));
  }
  if(j.time<(j.clearing?1.4:4))return;
  if(j.clearing&&!clearTargets(g.world,g.store.state,g.store.state.livingClearArea?.keys||[],g.store.state.livingClearArea?.protectedKeys||[]).some(target=>target.id===j.id&&target.type===j.type)){this.finish(false);return;}
  let done=false;
  try{
   if(j.type==='water'||j.type==='harvest'){
    const farm=t.farm.state,next=j.type==='water'?gardenWork(farm,'water',j.index,Date.now()):gardenHarvest(farm,j.index,Date.now());
    const crop=GARDEN_CROPS[j.index];
    done=t.farm.commit(next,j.type==='harvest'&&next!==farm?{inventory:{...g.store.state.inventory,[crop]:(g.store.state.inventory[crop]||0)+1}}:{});
   }else{
    const s=g.store.state,scoped={...s,activeCharacter:'adam',player:{...j.position}},next=applyAction(scoped,{type:j.type,id:j.id,key:j.key,actionId:`friend:adam:${crypto.randomUUID()}`},g.world,gameTime(s));
    if(next!==scoped){g.store.save({...next,activeCharacter:s.activeCharacter,player:s.player});g.refreshDynamic();done=true;}
   }
  }catch{g.toast('Adam: Let’s try that again.');}
  if(!done&&j.clearing)this.clearRetryAt=t.elapsed+10;
  if(done)g.burst(j.target,j.type==='water'?'water':'seed',.5);this.finish(done);g.notify();
 }
 snapshot(){return {near:this.near&&!this.chatOpen&&!this.t.builder&&!assignedProject(this.g.store.state,'adam'),greeting:this.greeting||nearbyGreeting(this.t.playerName),chatOpen:this.chatOpen,working:this.job?.type||null};}
 dispose(){this.close();if(this.tool){this.g.scene.remove(this.tool);} }
}
