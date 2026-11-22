import * as THREE from 'three';
import {activeRocks,heightAt,dist,label,gameTime} from './core.mjs';
import {MINERALS,DEPOSITS,TOOL_TIERS,MINING_SWING_SECONDS,ROCK_REVEAL_MS,toolTier,rockProfile,rockRemaining,rockFindLine,toolNeedMessage,upgradeStatus,forgeEstimate,forgeJob,forgeProgress} from './mining.mjs';
import {SHOVEL_TIERS,shovelStatus,shovelTier} from './digging.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

export class Mining {
  constructor(game,environment){
    this.g=game;this.nodes=new Map();this.labels=[];this.group=new THREE.Group();game.scene.add(this.group);
    this.chipGeometry=new THREE.IcosahedronGeometry(.06,0);this.gemGeometry=new THREE.OctahedronGeometry(.09,0);
    this.materials=Object.fromEntries(Object.entries(MINERALS).map(([id,m])=>[id,new THREE.MeshStandardMaterial({color:m.color,roughness:id==='diamond'?.25:.8,metalness:id==='diamond'?.1:0})]));
    environment.updateMatrixWorld(true);const remove=[];
    environment.traverse(source=>{
      const id=source.userData.resource_id||source.name;if(!game.world.boulders.some(r=>r.id===id))return;
      const group=new THREE.Group();source.matrixWorld.decompose(group.position,group.quaternion,group.scale);
      const mesh=source.clone(true);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);group.add(mesh);this.group.add(group);group.updateMatrixWorld(true);
      mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.rockId=id;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
      const rock=game.world.boulders.find(r=>r.id===id);if(!rock)return;
      const profile=rockProfile(rock),bounds=new THREE.Box3().setFromObject(group);
      const node={id,group,mesh,bounds,rock,profile,baseScale:group.scale.clone(),baseQuaternion:group.quaternion.clone()};this.nodes.set(id,node);
      this.decorate(node);remove.push(source);
    });
    for(const o of remove)o.removeFromParent();
    if(this.nodes.size!==game.world.boulders.length)throw Error('Some of the editable rocks are missing from the map export.');
  }
  decorate(node){
    if(node.profile.deposit==='stone')return;
    const marker=new THREE.Group(),center=node.bounds.getCenter(V());let top=V(center.x,node.bounds.max.y,center.z),best=-Infinity;
    node.mesh.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++){const p=V().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);if(p.y>best){best=p.y;top=p;}}});
    // Vein chips use world-size geometry, so the original boulder can keep its exact scale.
    marker.position.copy(top);const material=this.materials[node.profile.deposit==='copper'?'copper_ore':node.profile.deposit==='iron'?'iron_ore':'diamond'];
    const r=node.rock.radius,size=Math.max(.045,Math.min(.17,r*.23));
    for(let i=0;i<4;i++){const chip=new THREE.Mesh(node.profile.deposit==='diamond'?this.gemGeometry:this.chipGeometry,material);chip.position.set(Math.cos(i*2.2)*size*.5,-size*.25,Math.sin(i*2.2)*size*.5);chip.scale.set(size/.06*(i? .7:1),size/.06*(node.profile.deposit==='diamond'?1.2:.6),size/.06*.8);chip.rotation.set(.2*i,.7*i,.2);chip.castShadow=true;marker.add(chip);}
    this.group.add(marker);node.marker=marker;
  }
  prepareTools(){
    this.heads=[];this.hoeHeads=[];
    const paint=(id,bucket)=>this.g.tools[id].traverse(o=>{if(o.isMesh&&/Head|Blade|Shank/.test(o.name)){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();bucket.push(...(Array.isArray(o.material)?o.material:[o.material]));}});
    paint('axe',this.heads);paint('pickaxe',this.heads);paint('hoe',this.hoeHeads);
    this.applyTier();
  }
  applyTier(){
    const tier=toolTier(this.g.store.state),shovel=shovelTier(this.g.store.state),hoe=shovel.tier>0?shovel:tier;
    for(const m of this.heads||[]){m.color.set(tier.color);m.roughness=tier.tier===3?.3:.7;m.metalness=tier.tier?.2:0;}
    for(const m of this.hoeHeads||[]){m.color.set(hoe.color);m.roughness=shovel.tier>=3?.4:.7;m.metalness=shovel.tier>=2?.25:0;}
    this.tier=tier;this.shovelSeen=shovel.tier;
  }
  refresh(){
    const g=this.g,state=g.store.state;this.rocks=activeRocks(g.world,state);
    for(const node of this.nodes.values()){
      const gone=state.removedRocks.includes(node.id),inRange=g.overview||dist(g.player,{x:node.rock.position[0],y:node.rock.position[1]})<36;
      node.group.visible=inRange&&(!gone||this.work===node);if(node.marker)node.marker.visible=inRange&&!gone;
    }
    if(this.tier?.tier!==toolTier(state).tier||this.shovelSeen!==(state.tools?.shovel||0))this.applyTier();
  }
  mine(id){
    const g=this.g,node=this.nodes.get(id);if(!node||g.store.state.removedRocks.includes(id))return false;
    const profile=node.profile,tier=toolTier(g.store.state);g.tool='mine';
    if(tier.tier<profile.minTier){g.toast(toolNeedMessage(profile),ROCK_REVEAL_MS);return false;}
    const floor=heightAt(g.world,node.rock.position[0],node.rock.position[1]);if(node.bounds.min.y>floor+.75){g.toast('That rock is on the high terrace. Choose a rock on the grass.');return false;}
    return g.request({type:'mine',id,rock:node.rock},{x:node.rock.position[0],y:node.rock.position[1]},node.rock.radius+.85);
  }
  nearest(deposit){
    const g=this.g,tier=toolTier(g.store.state);
    const rocks=this.rocks.filter(r=>(!deposit||rockProfile(r).deposit===deposit)&&rockProfile(r).minTier<=tier.tier)
      .sort((a,b)=>dist(g.player,{x:a.position[0],y:a.position[1]})-dist(g.player,{x:b.position[0],y:b.position[1]}));
    for(const r of rocks){const node=this.nodes.get(r.id);if(node.bounds.min.y>heightAt(g.world,r.position[0],r.position[1])+.75)continue;if(g.nav.approach(g.player,{x:r.position[0],y:r.position[1]},r.radius+.85))return this.mine(r.id);}
    g.toast(deposit?`No reachable ${deposit} veins are available with ${tier.name} tools. Try a stronger upgrade.`:'No reachable rocks nearby. Walk to another clearing.');return false;
  }
  craftShovel(tier){
    const g=this.g;if(g.action||g.order){g.toast('Let your character finish this action before crafting.');return;}
    const status=shovelStatus(g.store.state,tier);if(!status.canCraft){g.toast(status.reason);return;}
    try{
      g.store.commit({type:'upgrade_shovel',tier});const made=SHOVEL_TIERS[tier];
      if((tier||0)<=1){this.applyTier();g.status=`${made.name} made! You can dig a Water Well now. Find it under Build › Gardens.`;}
      else{const days=made.forgeDays,estimate=days===.5?'half an island day (~5 min)':days===1?'1 island day (~10 min)':'a little while';g.status=`${made.name} is in the forge · ${estimate}`;}
      g.toast(g.status);
    }catch(e){g.toast(e.message);}
  }
  upgrade(tier){
    const g=this.g;if(g.action||g.order){g.toast('Let your character finish this action before crafting.');return;}
    const status=upgradeStatus(g.store.state,tier);if(!status.canCraft){g.toast(status.reason);return;}
    try{
      g.store.commit({type:'upgrade_tools',tier});
      if((tier||0)<=0){this.applyTier();g.status=`${TOOL_TIERS[tier].name} tools crafted · ${TOOL_TIERS[tier].power}× strength`;}
      else g.status=`${TOOL_TIERS[tier].name} tools are in the forge · ${forgeEstimate(tier)}`;
      g.toast(g.status);
    }catch(e){g.toast(e.message);}
  }
  /** Finish a forge job once island time has run out. A tool still forging does not change the owned tier. */
  settleForge(){
    const g=this.g,state=g.store?.state;if(!state||!forgeJob(state))return;
    if(!forgeProgress(state,gameTime(state))?.done)return;
    try{
      const beforeTier=state.tools?.tier||0,beforeShovel=state.tools?.shovel||0;
      g.store.commit({type:'finish_forge'});
      const tools=g.store.state.tools||{};
      if((tools.shovel||0)!==beforeShovel){
        this.applyTier();
        const name=SHOVEL_TIERS[tools.shovel]?.name||'Shovel';
        g.status=`${name} is ready! Your characters use their strongest shovel.`;
        g.toast(g.status);g.notify();
      }else if((tools.tier||0)!==beforeTier){
        this.applyTier();
        const name=TOOL_TIERS[tools.tier].name;
        g.status=`${name} tools are ready! Your characters use their strongest tools.`;
        g.toast(g.status);g.notify();
      }
    }catch{/* The next tick tries again. */}
  }
  begin(a){
    const g=this.g;this.work=this.nodes.get(a.id);const node=this.work,box=node.bounds;
    const point=box.getCenter(V());point.y=Math.min(g.actor.position.y+.92,point.y);
    const origin=g.actor.position.clone();origin.y=point.y;const ray=new THREE.Raycaster(origin,point.clone().sub(origin).normalize());
    const hit=ray.intersectObject(node.mesh,true)[0];a.contact=(hit?.point||point).clone();a.contactLocal=g.actor.worldToLocal(a.contact.clone());
    a.crouch=THREE.MathUtils.clamp((.9-a.contactLocal.y)*.34,.03,.28);a.workHits=Math.ceil(rockRemaining(a.rock,g.store.state)/toolTier(g.store.state).power);a.cycle=MINING_SWING_SECONDS;a.duration=.48+a.workHits*a.cycle+.38;
    const saved=g.restPose.map(p=>({bone:p.bone,position:p.bone.position.clone(),quaternion:p.bone.quaternion.clone()}));
    for(const p of g.restPose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}g.actor.updateMatrixWorld(true);
    const targets=this.targets(a,.65);this.pose(a,targets.wrist,1);
    const grip=g.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),contact=g.tools.pickaxe.userData.contact_local,length=Math.hypot(...contact);
    // Fit once when equipping; the tool stays rigid throughout the swing.
    a.toolScale=THREE.MathUtils.clamp(grip.distanceTo(g.localPoint(targets.head))/length,.8,1.5);g.tools.pickaxe.scale.setScalar(a.toolScale);
    for(const p of saved){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}g.actor.updateMatrixWorld(true);
    g.status=`Taking ${toolTier(g.store.state).name.toLowerCase()} pickaxe…`;
  }
  targets(a,phase){
    const y=a.contactLocal.y,z=a.contactLocal.z,low=a.crouch/.28;
    const up=[-.30,1.96-low*.13,.18],hit=[-.22,y+.68,Math.max(.25,z-.52)],follow=[-.20,y+.57,Math.max(.28,z-.45)];
    const raised=[-.2,2.7-low*.18,.15],contact=a.contactLocal.toArray();let wrist,head;
    if(phase<.4){const k=ease(phase/.4);wrist=follow.map((v,i)=>THREE.MathUtils.lerp(v,up[i],k));head=contact.map((v,i)=>THREE.MathUtils.lerp(v,raised[i],k));}
    else if(phase<=.66){const k=ease((phase-.4)/.26);wrist=up.map((v,i)=>THREE.MathUtils.lerp(v,hit[i],k));head=raised.map((v,i)=>THREE.MathUtils.lerp(v,contact[i],k));}
    else{const k=ease((phase-.66)/.34);wrist=hit.map((v,i)=>THREE.MathUtils.lerp(v,follow[i],k));head=contact;}
    return {wrist,head};
  }
  pose(a,wrist,bend){
    const g=this.g,feet=['Right','Left'].map(side=>{const foot=g.bones[`mixamorig${side}Foot`];return {side,foot,p:foot.getWorldPosition(V()),q:foot.getWorldQuaternion(new THREE.Quaternion())};});
    g.bones.mixamorigHips.position.y-=a.crouch*bend;g.bones.mixamorigSpine.rotateX((.17+.15*a.crouch/.28)*bend);g.actor.updateMatrixWorld(true);
    for(const f of feet){g.solveChain([g.bones[`mixamorig${f.side}Leg`],g.bones[`mixamorig${f.side}UpLeg`]],f.foot,f.p);f.foot.quaternion.copy(f.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(f.q));f.foot.updateWorldMatrix(false,true);}
    g.ik('Right',g.localPoint(wrist));g.actor.updateMatrixWorld(true);
  }
  strike(a){
    const g=this.g;try{
      if(g.nutrition&&!g.nutrition.check('mine_hit')){a.failed=true;return;}
      const before=g.store.state;g.store.commit({type:'mine_hit',id:a.id,...(a.gatherId?{actionId:`${a.gatherId}:${a.hits}`}:{})});if(g.store.state===before){a.failed=true;const profile=this.work?.profile;g.toast(profile&&toolTier(g.store.state).tier<profile.minTier?toolNeedMessage(profile):'The rock needs a stronger tool.',ROCK_REVEAL_MS);return;}
      g.music?.sfx?.play('rock');g.touchResourceHealth?.('rock',a.id);this.emit(a.contact,'stone',13);a.broken=g.store.state.removedRocks.includes(a.id);
      const left=rockRemaining(a.rock,g.store.state);
      if(a.broken){a.breakTime=a.t;for(const id of Object.keys(this.work.profile.drops))if(id!=='stone')this.emit(a.contact,id,8);a.reward=rockFindLine(this.work.profile);g.status=a.reward;g.toast(a.reward,ROCK_REVEAL_MS);}
      else g.status=`Mining · ${a.hits} / ${a.workHits} hits · ${left} strength left`;
      g.notify();
    }catch(e){a.failed=true;g.toast(e.message);}
  }
  animate(dt){
    const g=this.g,a=g.action;a.t+=dt*g.animationRate*(g.nutrition?.workRate?.()??1);const tool=g.tools.pickaxe;tool.visible=true;
    const index=Math.floor(Math.max(0,a.t-.48)/a.cycle),phase=((Math.max(0,a.t-.48)%a.cycle)/a.cycle);
    let {wrist,head}=this.targets(a,phase);
    if(a.t<.48){const k=ease(a.t/.48);wrist=[-.34,1.5-.45*k,.12];head=[-.1,1.1,.4];}
    this.pose(a,wrist,ease((a.t-.4)/.35));const hand=g.bones.mixamorigRightHand,grip=hand.localToWorld(V(0,.065,0)),p=tool.userData.contact_local;
    tool.position.copy(grip);tool.quaternion.setFromUnitVectors(V(p[0],p[2],-p[1]).normalize(),g.localPoint(head).sub(grip).normalize());
    if(a.t<.38){tool.position.copy(g.localPoint([-.36,1.03,.12]));tool.quaternion.setFromAxisAngle(V(1,0,0),-.3);}
    if(a.t>.6)g.ik('Left',tool.localToWorld(V(0,0,-.16)));else g.ik('Left',g.localPoint([.36,1.12,.16]));
    if(!a.failed&&!a.broken&&index<a.workHits&&phase>=.64&&a.hits<=index){a.hits=index+1;this.strike(a);}
    if(this.work){const node=this.work;if(a.broken){const k=1-ease((a.t-a.breakTime)/.3);node.group.scale.copy(node.baseScale).multiplyScalar(k);if(node.marker)node.marker.visible=false;}else node.group.quaternion.copy(node.baseQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),phase>.62?Math.sin(phase*35)*.035:0));}
    if(a.failed||a.t>=a.duration)g.finishAction();
  }
  end(a){const node=this.work;if(node){node.group.quaternion.copy(node.baseQuaternion);node.group.scale.copy(node.baseScale);}this.work=null;this.refresh();if(!a.failed&&a.broken)this.g.status=a.reward;}
  emit(point,id,count){const g=this.g;for(let i=0;i<count;i++){const mesh=new THREE.Mesh(id==='diamond'?this.gemGeometry:this.chipGeometry,this.materials[id]);mesh.position.copy(point);mesh.scale.setScalar(.65+Math.random()*.5);g.scene.add(mesh);g.particles.push({mesh,life:1,v:V((Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2)});}}
  updateLabels(){this.labels=[];}
  snapshot(){const s=this.g.store.state;return {tier:toolTier(s),labels:this.labels,rocksRemaining:activeRocks(this.g.world,s).length};}
}
