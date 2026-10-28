import * as THREE from 'three';
import {cellAt,cellFromKey,heightAt,gameTime,buildSiteStatus,buildPlacementStatus,dist,Navigation,activeTrees,activeRocks,activeStumps,stumpRadius,buildMoveStatus,stateWithoutBuilding,buildUpgradeStatus} from './core.mjs';
import {BUILDINGS,buildingById,activeBuildings,footprint,workPoint,materialStatus,buildingProgress,buildingStage,woodTotal,upgradeDefinition,upgradeCost,upgradePlan,pointInBounds,fireFuelLeft,FIRE_LOW_MINUTES} from './building.mjs';
import {projectPlan,defaultCrew,projectTimeLeft,projectDuration,assignedProject} from './project-rules.mjs';
import {woodStorage} from './wood-storage.mjs';
import {emitWorkSweat} from './work-sweat.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const token=(type,id)=>`${type}:${id}`;
const jobToken=(type,b)=>token(type,b.jobId||b.id);
export class Construction {
 constructor(game){
  this.g=game;this.preview=null;this.nodes=new Map();this.lastUpdate=0;this.lastResume=0;
  this.group=new THREE.Group();this.ghostGroup=new THREE.Group();this.gridGroup=new THREE.Group();game.scene.add(this.group,this.ghostGroup,this.gridGroup);
  this.ghostMaterials={ok:new THREE.MeshBasicMaterial({color:'#79ca47',transparent:true,opacity:.30,depthWrite:false}),bad:new THREE.MeshBasicMaterial({color:'#f2756a',transparent:true,opacity:.48,depthWrite:false})};
  this.edgeMaterials={ok:new THREE.LineBasicMaterial({color:'#b9ef7d',transparent:true,opacity:.50}),bad:new THREE.LineBasicMaterial({color:'#ffd2c7',transparent:true,opacity:.9})};
  this.hammer=game.asset('tool_hammer');this.bench=game.asset('construction_workbench');this.hammer.visible=false;this.bench.visible=false;game.scene.add(this.hammer,this.bench);game.tools.hammer=this.hammer;this.refresh();
 }
 refresh(){
  const g=this.g,live=activeBuildings(g.store.state),wood=woodStorage(g.store.state),ids=new Set(live.map(b=>b.id));
  for(const [id,n]of this.nodes)if(!ids.has(id)){this.group.remove(n.root);this.nodes.delete(id);}
  for(const b of live){
   const stage=buildingStage(b),assetStage=stage==='finishing'?'complete':stage;
   let n=this.nodes.get(b.id);
   if(!n||n.stage!==stage||n.kind!==b.kind||n.key!==b.key||n.rotation!==b.rotation){
    if(n)this.group.remove(n.root);
    const root=g.asset(`building_${b.kind}_${assetStage}`),fp=footprint(g.world,b);root.position.set(fp.center.x,b.baseHeight,-fp.center.y);root.rotation.y=b.rotation*Math.PI/2;
    root.userData.buildingId=b.id;root.traverse(o=>{if(o.isMesh)o.userData.buildingId=b.id;});this.group.add(root);n={root,stage,kind:b.kind,key:b.key,rotation:b.rotation};this.nodes.set(b.id,n);
    if(['campfire','oven'].includes(b.kind)&&b.status==='complete'){const light=new THREE.PointLight(b.kind==='oven'?'#ff8a3a':'#ffad50',6,b.kind==='oven'?4:6,2);light.position.set(0,b.kind==='oven'?.55:.65,b.kind==='oven'?.6:0);root.add(light);n.fireLight=light;}
   }
   if(stage==='finishing')this.finishShape(n.root,buildingProgress(b));
   if(buildingById(b.kind).woodCapacity){const box=wood.containers.find(c=>c.id===b.id),fraction=box?box.used/box.capacity:0,slots=n.root.userData.storage_log_slots||1;n.root.traverse(o=>{if(o.userData.storage_log_index)o.visible=o.userData.storage_log_index<=Math.ceil(fraction*slots);});}
  }
  if(this.preview&&this.previewRevision!==g.store.state.revision)this.updatePreview();
 }
 finishShape(root,p){root.traverse(o=>{if(!o.isMesh)return;const phase=o.userData.assembly_phase;if(phase==='roof'){o.visible=p>=.82;o.scale.y=Math.max(.001,ease((p-.82)/.18));}else if(phase==='body'){o.scale.y=Math.max(.001,ease((p-.65)/.17));}else if(phase==='flame')o.visible=p>.92;});}
 findSpot(kind,rotation=0){
  const g=this.g,at=cellAt(g.world,g.player.x,g.player.y),def=buildingById(kind),candidates=[];
  for(let dy=-15;dy<=15;dy++)for(let dx=-15;dx<=15;dx++){
   const col=at.col+dx,row=at.row+dy;if(col<0||row<0)continue;
   const plan={kind,key:`${col}:${row}`,rotation};const fp=footprint(g.world,plan),d=dist(fp.center,g.player);if(d<2||d>16)continue;candidates.push({plan,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  const trees=g.trees,minutes=gameTime(g.store.state);
  for(const {plan}of candidates){
   const site=buildSiteStatus(g.world,g.store.state,plan,minutes);if(!site.ok)continue;
   const proposed={...g.store.state,buildings:[...(g.store.state.buildings||[]),{...plan,id:'preview',status:'queued'}]},nav=new Navigation(g.world,proposed,minutes),work=workPoint(g.world,plan),path=nav.path(g.player,work);
   if(path&&dist(path.at(-1)||g.player,work)<=1.05)return plan;
  }
  // A hypothetical cleared map is used only to suggest a reachable site. Nothing is removed or awarded here.
  const cleared={...g.store.state,removedTrees:g.world.trees.map(t=>t.id),removedRocks:g.world.boulders.map(r=>r.id),pickedSeeds:g.world.seeds.map(s=>s.id)},options=[];
  for(const {plan,d}of candidates){if(!buildSiteStatus(g.world,cleared,plan,minutes).ok)continue;const obstacles=this.obstacles(plan);options.push({plan,score:obstacles.trees.length*3+obstacles.rocks.length*5+obstacles.seeds.length+obstacles.stumps.length*2+d*.2});}
  options.sort((a,b)=>a.score-b.score);
  for(const {plan}of options.slice(0,12)){const proposed={...g.store.state,buildings:[...(g.store.state.buildings||[]),{...plan,id:'preview',status:'queued'}]},nav=new Navigation(g.world,proposed,minutes),work=workPoint(g.world,plan),path=nav.path(g.player,work);if(path&&dist(path.at(-1)||g.player,work)<=1.05)return plan;}
  return {kind,key:`${Math.max(0,at.col+2)}:${Math.max(0,at.row)}`,rotation};
 }
 obstacles(plan){
  const g=this.g,fp=footprint(g.world,plan);if(!fp)return {trees:[],rocks:[],seeds:[],stumps:[]};const hit=(p,r)=>Math.hypot(p[0]-Math.max(fp.x,Math.min(fp.x+fp.w,p[0])),p[1]-Math.max(fp.y,Math.min(fp.y+fp.h,p[1])))<r;
  return {trees:activeTrees(g.world,g.store.state,gameTime(g.store.state)).filter(t=>hit(t.position,t.radius+.4)),rocks:activeRocks(g.world,g.store.state).filter(r=>hit(r.position,r.radius+.16)),seeds:g.world.seeds.filter(s=>!g.store.state.pickedSeeds.includes(s.id)&&hit(s.position,.2)),stumps:activeStumps(g.world,g.store.state).filter(t=>hit(t.position,stumpRadius(t)))};
 }
 /** Players World: hand the whole footprint to one friend (trees, rocks, seeds), then bring the preview back. */
 beginClear(workerId){
  const g=this.g;if(!this.preview)return false;const ob=this.obstacles(this.preview);if(!(ob.trees.length+ob.rocks.length+ob.seeds.length+ob.stumps.length)){g.toast(this.previewStatus?.reason||'This spot is already clear.');return false;}
  this.sitePlan={...this.preview};this.preview=null;this.previewStatus=null;this.ghostGroup.clear();this.gridGroup.clear();
  const ok=g.assign?g.assign({type:'clear'},workerId):g.autoWork.start({type:'clear'});
  if(!ok){this.resumeSite();return false;}
  g.notify();return true;
 }
 /** The cleared site comes back as a live preview so the kid can press Place. */
 resumeSite(){
  const plan=this.sitePlan;if(!plan)return;this.sitePlan=null;const g=this.g;
  if(g.action||g.order)return setTimeout(()=>{this.sitePlan=plan;this.resumeSite();},600);
  this.preview=plan;g.persist();g.tool='build';g.overview=false;this.rebuildGhost();this.updatePreview();g.notify();
 }
 /** Not enough wood or stone: remember what we are working towards and open the to-do list. */
 setGoalFromPreview(){
  const g=this.g;if(!this.preview)return;const kind=this.preview.kind;this.cancelPreview();g.setGoal?.(kind);g.ui={...(g.ui||{}),openPlan:Date.now()};g.notify();
 }
 clearSpot(){
  if(!this.preview||this.g.action||this.g.order)return;if(!/^(Chop the tree|Smash the rock|Pick up the seeds|Dig out the stump)/.test(this.previewStatus?.reason||'')){this.g.toast(this.previewStatus?.reason||'Choose another spot.');return;}const g=this.g,ob=this.obstacles(this.preview),plan={...this.preview};let ok=false;
  this.preview=null;this.ghostGroup.clear();this.gridGroup.clear();
  if(ob.trees.length){const t=ob.trees.sort((a,b)=>dist(g.player,{x:a.position[0],y:a.position[1]})-dist(g.player,{x:b.position[0],y:b.position[1]}))[0];ok=g.chop(t.id);}
  else if(ob.rocks.length)ok=g.mining.mine(ob.rocks[0].id);
  else if(ob.stumps.length)ok=g.digStump(ob.stumps[0].id);
  else if(ob.seeds.length){g.tool='walk';g.walk({x:ob.seeds[0].position[0],y:ob.seeds[0].position[1]});ok=!!g.path.length;}
  if(ok){this.clearPlan=plan;this.clearStep='working';}else{this.preview=plan;this.rebuildGhost();this.updatePreview();}
  g.notify();
 }
 startPreview(kind){
  const g=this.g;this.sitePlan=null;if(g.action||g.order||activeBuildings(g.store.state).some(b=>b.status!=='complete'&&!b.project)){g.toast('Let your character finish this building first.');return false;}
  if(!buildingById(kind))return false;g.persist();this.preview=this.findSpot(kind);if(projectPlan(kind))this.preview.crew=defaultCrew(g.store.state,kind);g.path=[];g.keys.clear();g.tool='build';g.overview=false;g.zoom=Math.max(g.zoom,19);g.resize();this.rebuildGhost();this.updatePreview();g.status='Tap the grass to move your building. Green means the spot is clear!';g.notify();return true;
 }
 moveExisting(id){
  const g=this.g,b=g.store.state.buildings.find(b=>b.id===id);if(!b||b.status!=='complete'||g.action||g.order)return false;
  g.persist();this.preview={kind:b.kind,key:b.key,rotation:b.rotation,movingId:b.id};g.path=[];g.keys.clear();g.tool='build';g.overview=false;g.zoom=Math.max(g.zoom,19);g.resize();this.rebuildGhost();this.updatePreview();g.notify();return true;
 }
 startUpgrade(id){
  const g=this.g,b=g.store.state.buildings.find(b=>b.id===id);if(!b||b.status!=='complete'||!upgradeDefinition(b)||g.action||g.order||g.nutrition?.sleep||activeBuildings(g.store.state).some(b=>b.status!=='complete'&&!b.project))return false;
  const plan=upgradePlan(g.world,b),fp=footprint(g.world,plan);
  if(fp&&pointInBounds(g.player,fp.bounds,.4)){const path=g.nav.path(g.player,workPoint(g.world,plan));if(!path||dist(path.at(-1)||g.player,workPoint(g.world,plan))>1.05){g.toast('Step away from this home, then try its upgrade.');return false;}g.path=path;g.keys.clear();this.pendingUpgradeId=id;g.toast('Making room to preview a bigger home.');g.notify();return true;}
  this.pendingUpgradeId=null;g.persist();this.preview=plan;if(projectPlan(plan.kind))this.preview.crew=defaultCrew(g.store.state,plan.kind);g.path=[];g.keys.clear();g.tool='build';g.overview=false;g.zoom=Math.max(g.zoom,21);g.resize();this.rebuildGhost();this.updatePreview();g.notify();return true;
 }
 placeUpgrade(){
  const g=this.g,p=this.preview,status=buildUpgradeStatus(g.world,g.store.state,p.upgradingId,gameTime(g.store.state),p.crew);if(!status.ok){g.toast(status.reason);this.updatePreview();return false;}
  try{const before=g.store.state;g.store.commit({type:'upgrade_building',id:p.upgradingId,kind:p.kind,crew:p.crew,actionId:crypto.randomUUID()});if(g.store.state===before||g.store.state.buildings.find(b=>b.id===p.upgradingId)?.status!=='queued'){g.toast('That home changed. Please try again.');this.updatePreview();return false;}this.preview=null;this.ghostGroup.clear();this.gridGroup.clear();g.refreshDynamic();g.toast('Materials ready. Let’s upgrade your home!');this.go(p.upgradingId);g.notify();return true;}catch(e){g.toast(e.message);return false;}
 }
 moveFinished(){
  const g=this.g,p=this.preview,status=buildMoveStatus(g.world,g.store.state,{...p,id:p.movingId});if(!status.ok){g.toast(status.reason);return false;}
  try{g.store.commit({type:'move_building',id:p.movingId,key:p.key,rotation:p.rotation,crew:p.crew,actionId:crypto.randomUUID()});const saved=g.store.state.buildings.find(b=>b.id===p.movingId);if(saved?.key!==p.key||saved?.rotation!==p.rotation){g.toast('That spot changed. Try another spot.');this.updatePreview();return false;}this.cancelPreview();g.refreshDynamic();g.status=`${buildingById(p.kind).name} moved!`;g.toast(g.status);return true;}catch(e){g.toast(e.message);return false;}
 }
 rebuildGhost(){
  this.ghostGroup.clear();const model=this.g.asset(`building_${this.preview.kind}_complete`);model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material=this.ghostMaterials.ok;const edges=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,55),this.edgeMaterials.ok);edges.userData.previewEdge=true;o.add(edges);}});this.ghostGroup.add(model);this.ghost=model;
 }
 updatePreview(){
  if(!this.preview)return;const g=this.g,omit=this.preview.movingId||this.preview.upgradingId,checkState=omit?stateWithoutBuilding(g.world,g.store.state,omit):g.store.state,site=buildSiteStatus(g.world,checkState,this.preview),status=site.ok?(this.preview.upgradingId?buildUpgradeStatus(g.world,g.store.state,this.preview.upgradingId,gameTime(g.store.state),this.preview.crew):this.preview.movingId?buildMoveStatus(g.world,g.store.state,{...this.preview,id:this.preview.movingId}):buildPlacementStatus(g.world,g.store.state,this.preview)):site,fp=site.footprint||footprint(g.world,this.preview);
  if(!fp){this.previewStatus={ok:false,reason:'This home is too close to the island edge. Move it farther inland first.'};this.siteValid=false;this.previewRevision=g.store.state.revision;this.ghostGroup.visible=false;this.gridGroup.clear();return;}this.ghostGroup.visible=true;
  this.previewStatus=status;this.previewRevision=g.store.state.revision;this.siteValid=site.ok;this.ghostGroup.position.set(fp.center.x,site.baseHeight??heightAt(g.world,fp.center.x,fp.center.y)+.02,-fp.center.y);this.ghostGroup.rotation.y=this.preview.rotation*Math.PI/2;
  this.ghost.traverse(o=>{if(o.isMesh)o.material=this.ghostMaterials[site.ok?'ok':'bad'];if(o.userData.previewEdge)o.material=this.edgeMaterials[site.ok?'ok':'bad'];});
  this.drawPlacementGrid(fp);
 }
 drawPlacementGrid(fp){
  for(const o of this.gridGroup.children)o.geometry?.dispose();this.gridGroup.clear();const g=this.g,points=[];
  for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){
   const px=Math.floor(fp.center.x)+x,py=Math.floor(fp.center.y)+y;
   for(const [a,b]of [[[px,py],[px+1,py]],[[px,py],[px,py+1]]])points.push(a[0],heightAt(g.world,...a)+.035,-a[1],b[0],heightAt(g.world,...b)+.035,-b[1]);
  }
  const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3));this.gridGroup.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#fff4c9',transparent:true,opacity:.30,depthWrite:false})));
  const p=fp.bounds,h=this.ghostGroup.position.y+.035,outline=new THREE.BufferGeometry().setFromPoints([V(p[0],h,-p[1]),V(p[2],h,-p[1]),V(p[2],h,-p[3]),V(p[0],h,-p[3]),V(p[0],h,-p[1])]);this.gridGroup.add(new THREE.Line(outline,this.edgeMaterials[this.siteValid?'ok':'bad']));
 }
 moveTo(target){if(!this.preview||this.preview.upgradingId)return;const c=cellAt(this.g.world,target.x,target.y),fp=footprint(this.g.world,this.preview);this.preview.key=`${Math.max(0,c.col-Math.floor(fp.w/2))}:${Math.max(0,c.row-Math.floor(fp.h/2))}`;this.updatePreview();this.g.notify();}
 nudge(dx,dy){if(!this.preview||this.preview.upgradingId)return;const [x,y]=this.preview.key.split(':').map(Number);this.preview.key=`${Math.max(0,x+dx)}:${Math.max(0,y+dy)}`;this.updatePreview();this.g.notify();}
 rotate(){if(!this.preview||this.preview.upgradingId)return;this.preview.rotation=(this.preview.rotation+1)%4;this.updatePreview();this.g.notify();}
 findAnother(){if(!this.preview||this.preview.upgradingId)return;const movingId=this.preview.movingId;this.preview={...this.findSpot(this.preview.kind,this.preview.rotation),...(movingId?{movingId}:{})};this.updatePreview();this.g.notify();}
 cancelPreview(){this.pendingUpgradeId=null;this.clearPlan=null;this.preview=null;this.previewStatus=null;this.ghostGroup.clear();this.gridGroup.clear();if(this.g.tool==='build')this.g.setTool('walk');this.g.notify();}
 place(){
  const g=this.g;if(!this.preview||g.action||g.order)return false;if(this.preview.movingId)return this.moveFinished();if(this.preview.upgradingId)return this.placeUpgrade();
  const plan={...this.preview,id:crypto.randomUUID()},status=buildPlacementStatus(g.world,g.store.state,plan);if(!status.ok){g.toast(status.reason);this.updatePreview();return false;}
  try{const before=g.store.state;g.store.commit({type:'place_building',...plan,actionId:token('place',plan.id)});if(!g.store.state.buildings.some(b=>b.id===plan.id)){g.toast('That spot changed. Choose a new spot.');this.updatePreview();return false;}this.preview=null;this.ghostGroup.clear();this.gridGroup.clear();g.refreshDynamic();g.status=`${buildingById(plan.kind).name} materials ready. Let’s build!`;this.go(plan.id);g.notify();return true;}catch(e){g.toast(e.message);return false;}
 }
 go(id){
  const g=this.g,b=g.store.state.buildings.find(b=>b.id===id);if(!b||!['queued','building'].includes(b.status))return false;
  if(b.project){g.store.communityStep({active:true});g.refreshDynamic();g.status='Your crew will keep building and take rest breaks.';g.notify();return true;}
  if(g.action||g.order)return false;const work=workPoint(g.world,b),path=g.nav.path(g.player,work);if(!path||dist(path.at(-1)||g.player,work)>1.05){g.toast('The way is blocked. Clear a path, then press Continue building.');return false;}
  g.path=path;g.tool='build';g.order={type:'build',id,target:footprint(g.world,b).center};g.status='Walking to the building site…';g.marker.visible=false;g.notify();return true;
 }
 focusProject(id){const b=this.g.store.state.buildings.find(b=>b.id===id);if(!b)return;const p=footprint(this.g.world,b).center;this.g.community.focusPoint=V(p.x,b.baseHeight+1,-p.y);this.g.community.focusUntil=Number.MAX_SAFE_INTEGER;this.g.overview=false;this.g.zoom=16;this.g.resize();this.g.notify();}
 setCrew(ids){if(!this.preview)return;this.preview.crew=ids;this.updatePreview();this.g.notify();}
 pauseProject(id,paused){try{this.g.store.commit({type:'pause_project',id,paused,actionId:crypto.randomUUID()});this.g.refreshDynamic();this.g.notify();}catch(e){this.g.toast(e.message);}}
 cancelQueued(id){const g=this.g,b=g.store.state.buildings.find(b=>b.id===id);if(g.action||!b)return;try{g.store.commit({type:'cancel_building',id,actionId:jobToken('cancel',b)});if(g.order?.id===id){g.order=null;g.path=[];}g.refreshDynamic();g.toast('Building cancelled. Your materials and energy are back.');}catch(e){g.toast(e.message);}}
 begin(a){
  const g=this.g;let b=g.store.state.buildings.find(b=>b.id===a.id);if(b?.status==='queued'){g.store.commit({type:'begin_building',id:b.id,actionId:jobToken('begin',b)});b=g.store.state.buildings.find(b=>b.id===a.id);}
  if(!b||b.status!=='building'){a.failed=true;return;}
  a.building=b;a.hits=Math.floor((Date.now()-b.startedAt)/820);this.bench.visible=true;this.bench.position.copy(g.localPoint([0,0,.80]));this.bench.quaternion.copy(g.actor.quaternion);this.hammer.visible=true;
  const pose=g.restPose.map(p=>({bone:p.bone,position:p.bone.position.clone(),quaternion:p.bone.quaternion.clone()}));this.pose([-.24,1.34,.44],1);const grip=g.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),target=g.localPoint([-.05,.88,.80]),contact=this.hammer.userData.contact_local;
  a.toolScale=grip.distanceTo(target)/Math.hypot(...contact);this.hammer.scale.setScalar(a.toolScale);
  for(const p of pose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);}g.actor.updateMatrixWorld(true);g.status=`Building ${buildingById(b.kind).name.toLowerCase()}…`;this.refresh();
 }
 pose(wrist,bend){this.g.mining.pose({crouch:.06},wrist,bend);this.g.ik('Left',this.g.localPoint([.30,.98,.66]));this.g.actor.updateMatrixWorld(true);}
 targets(phase){
  const up=[-.28,1.94,.18],hit=[-.24,1.34,.44],raised=[-.10,2.46,.30],contact=[-.05,.88,.80];const k=phase<.40?ease(phase/.4):phase<.66?1-ease((phase-.4)/.26):0;
  return {wrist:hit.map((v,i)=>THREE.MathUtils.lerp(v,up[i],k)),head:contact.map((v,i)=>THREE.MathUtils.lerp(v,raised[i],k))};
 }
 animate(dt){
  const g=this.g,a=g.action;if(a.failed){g.finishAction();return;}a.t+=dt;
  const elapsed=Math.max(0,(Date.now()-a.building.startedAt)/1000),phase=(elapsed%.82)/.82,index=Math.floor(elapsed/.82),{wrist,head}=this.targets(phase);this.pose(wrist,ease(a.t/.3));
  const grip=g.bones.mixamorigRightHand.localToWorld(V(0,.065,0)),tip=this.hammer.userData.contact_local;this.hammer.position.copy(grip);this.hammer.quaternion.setFromUnitVectors(V(tip[0],tip[2],-tip[1]).normalize(),g.localPoint(head).sub(grip).normalize());
  if(phase>=.64&&a.hits<=index){a.hits=index+1;g.burst({x:this.bench.position.x,y:-this.bench.position.z},'wood',.88);}
  if(g.actor.visible&&!g.overview)emitWorkSweat(g,a,g.bones);
  g.status=`Building ${buildingById(a.building.kind).name.toLowerCase()} · ${Math.max(1,Math.ceil(buildingById(a.building.kind).seconds-elapsed))}s`;
  if(buildingProgress(a.building)>=1)g.finishAction();
 }
 finish(a){
  const g=this.g;this.clearWork();if(a.failed)return;
  const before=g.store.state;g.store.commit({type:'finish_building',id:a.id,actionId:jobToken('finish',a.building)});if(g.store.state!==before){g.status=`${buildingById(a.building.kind).name} built!`;g.toast(g.status);}
 }
 clearWork(){this.hammer.visible=false;this.bench.visible=false;}
 inspectRay(ray){
  const hits=ray.intersectObjects([...this.nodes.values()].map(n=>n.root),true),id=hits[0]?.object.userData.buildingId,b=this.g.store.state.buildings.find(b=>b.id===id);if(!b||b.kind==='garden'||b.kind==='path')return false;
  if(b.project&&b.status!=='complete'){this.openMenu={id:'build',nonce:Date.now()};this.g.notify();return true;}
  if(buildingById(b.kind).woodCapacity||['hut','tent','cottage','townhouse','chest','campfire','oven','well'].includes(b.kind)){const home=['hut','tent','cottage','townhouse'].includes(b.kind);this.openMenu={id:home?'sleep':b.kind==='chest'||buildingById(b.kind).woodCapacity?'inventory':['campfire','oven','well'].includes(b.kind)?b.kind:'food',homeId:home?b.id:undefined,fireId:b.kind==='campfire'?b.id:undefined,ovenId:b.kind==='oven'?b.id:undefined,wellId:b.kind==='well'?b.id:undefined,nonce:Date.now()};this.g.notify();}else this.g.toast(`${buildingById(b.kind).name} · you built this!`);return true;
 }
 update(){
  const now=Date.now(),g=this.g;
  for(const [id,n]of this.nodes){const b=g.store.state.buildings.find(b=>b.id===id);if(!b)continue;if(n.stage==='finishing')this.finishShape(n.root,buildingProgress(b));if(n.fireLight){const left=fireFuelLeft(b,gameTime(g.store.state)),lit=left>0,low=lit&&left<FIRE_LOW_MINUTES?.55:1;n.fireLight.intensity=lit?(3+(1-(g.daylight??1))*8)*(1+.06*Math.sin(now*.012))*low:0;n.root.traverse(o=>{if(o.userData.assembly_phase==='flame'){o.visible=lit;o.scale.y=(1+.05*Math.sin(now*.007))*low;o.rotation.y=Math.sin(now*.004)*.06;}});}}
  if(now-this.lastUpdate<350)return;this.lastUpdate=now;
  if(this.pendingUpgradeId&&!g.action&&!g.order&&!g.path.length){const id=this.pendingUpgradeId;this.pendingUpgradeId=null;this.startUpgrade(id);}
  if(this.clearPlan&&!g.action&&!g.order&&!g.path.length){
   if(this.clearStep==='working'){this.clearStep='returning';g.walk(workPoint(g.world,this.clearPlan));}
   else{this.preview=this.clearPlan;this.clearPlan=null;g.persist();g.tool='build';this.rebuildGhost();this.updatePreview();g.notify();}
  }
  const current=activeBuildings(g.store.state).find(b=>b.status!=='complete'&&!b.project);
  if(current&&current.status==='building'&&buildingProgress(current,now)>=1&&g.action?.type!=='build'){
   try{g.store.commit({type:'finish_building',id:current.id,actionId:jobToken('finish',current)});if(g.order?.id===current.id){g.order=null;g.path=[];}g.refreshDynamic();g.status=`${buildingById(current.kind).name} built!`;g.toast(g.status);}catch(e){g.toast(e.message);}
  }else if(current&&!g.action&&!g.order&&!this.preview&&now-this.lastResume>3000){this.lastResume=now;this.go(current.id);}
  this.refresh();
 }
 snapshot(){
  const g=this.g,state=g.store.state,live=activeBuildings(state),ob=this.preview?this.obstacles(this.preview):null,clearAction=/^(Chop the tree|Smash the rock|Pick up the seeds|Dig out the stump)/.test(this.previewStatus?.reason||'')?(ob?.trees.length?'Chop a tree here':ob?.rocks.length?'Smash a rock here':ob?.stumps.length?'Dig out a stump here':ob?.seeds.length?'Pick up these seeds':null):null;
  const old=this.preview?.upgradingId&&state.buildings.find(b=>b.id===this.preview.upgradingId),definition=this.preview?{...buildingById(this.preview.kind),...(old?upgradeCost(old):{})}:null;
  return {preview:this.preview?{...this.preview,definition,crew:this.preview.crew,crewRequired:projectPlan(this.preview.kind)?.crew,crewCandidates:Object.entries(state.characters).map(([id,c])=>({id,name:c.name,energy:Math.floor(c.energy),asleep:!!c.sleep,assigned:!!assignedProject(state,id)})),duration:projectDuration(this.preview.kind),siteValid:this.siteValid,canPlace:!!this.previewStatus?.ok,reason:this.previewStatus?.reason,clearAction,have:{wood:woodTotal(state),stone:state.inventory.stone||0},needsClear:!!clearAction,needsMaterials:!this.preview.movingId&&(woodTotal(state)<(definition?.wood||0)||(state.inventory.stone||0)<(definition?.stone||0)),workers:g.playersOnly&&g.crew?g.crew():null,obstacleCount:ob?ob.trees.length+ob.rocks.length+ob.seeds.length+ob.stumps.length:0}:null,items:live.map(b=>({...b,name:buildingById(b.kind).name,projectLabel:b.project?projectTimeLeft(b):null,crewNames:b.project?.crew.map(id=>state.characters[id]?.name||id),woodCapacity:buildingById(b.kind).woodCapacity,progress:buildingProgress(b),remaining:Math.max(0,Math.ceil((1-buildingProgress(b))*buildingById(b.kind).seconds))})),wood:woodTotal(state),openMenu:this.openMenu};
 }
}
