import * as THREE from 'three';
import './style.css';
import { SAVE_KEY, freshState, restoreState, currentRequest, progress, readyToDeliver, collect, deliver, REQUESTS } from './quests.mjs';

const icons = {
  leaf: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M26 5C11 3 4 10 8 19c7 7 19 0 18-14Z" fill="#6f9566"/><path d="M5 28 22 10M12 21l-1-7m7 1h6" stroke="#456d47" stroke-width="2.4" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12V5a2 2 0 0 1 4 0v6l1-1c1-1 3-1 4 1l2 4-3 6H9l-5-6c-1-2 1-3 2-2l3 2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 6 2 2 3-4m-5 9 2 2 3-4m4-5h9m-9 7h9M4 21h17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  you: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-4a8 8 0 0 1 16 0v4Z"/></svg>',
};

const root = document.querySelector('#app');
const lifecycle=new AbortController();
root.innerHTML = `
  <header class="topbar"><div class="brand">${icons.leaf}<span>Our little world</span></div><span class="test-label">PLAY TEST</span></header>
  <section class="task-card" aria-label="Current help request"></section>
  <div class="entity-controls" aria-label="Friends and things in the world"></div>
  <div class="world-label"><span class="player-dot"></span>YOU</div>
  <div class="speech" hidden></div><div class="toast" role="status" aria-live="polite" hidden></div>
  <footer class="bottom-area"><div class="walk-hint">Tap to walk. Tap a log, crop, or friend to help.</div><div class="bottom-row"><div class="you-card"><span class="you-icon">${icons.you}</span><div><div class="you-title">Your own adventure</div><div class="you-sub">You + your Bible friends</div></div></div><button class="tasks-button">${icons.tasks}My tasks<span class="count">1</span></button></div></footer>
  <dialog class="sheet" aria-labelledby="sheet-title"><div class="sheet-header"><div><div class="eyebrow">ONE LITTLE THING AT A TIME</div><h2 id="sheet-title">Helping each other</h2></div><button class="close-button" aria-label="Close tasks">×</button></div><div class="task-list"></div><p class="sheet-note">Your friends have their own little routines. Help when you’re ready. There’s no timer and no rush.</p><button class="primary">Back to our world</button></dialog>`;

let state;
try { state = restoreState(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { state = freshState(); }
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Play still works without storage. */ } };
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch {
  root.innerHTML = '<div class="fallback"><h1>This little world needs 3D graphics</h1><p>Please open it in a browser with WebGL enabled. Your other Godly Kids saves have not changed.</p></div>';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xd5e9df, 1);
renderer.domElement.setAttribute('aria-label', '3D island. You control the teal character. Tap the ground to walk, or use arrow keys or W A S D. Tap highlighted supplies to collect them and friends to talk.');
renderer.domElement.setAttribute('tabindex', '0');
root.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd5e9df, 38, 75);
const camera = new THREE.OrthographicCamera();
camera.position.set(12, 18, 21);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xfff7dc, 0x7a9d81, 2.4));
const sun = new THREE.DirectionalLight(0xffedce, 3.1);
sun.position.set(-7, 16, 7); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 45 });
sun.shadow.normalBias = 0.04;
sun.shadow.bias = -0.00015;
scene.add(sun);

const materials = new Map();
function mat(color, extra = {}) {
  const key = `${color}-${JSON.stringify(extra)}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .95, ...extra }));
  return materials.get(key);
}
function mesh(geometry, color, parent = scene, x = 0, y = 0, z = 0, extra = {}) {
  const m = new THREE.Mesh(geometry, mat(color, extra));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const sphere = (r, color, p, x, y, z) => mesh(new THREE.SphereGeometry(r, 12, 8), color, p, x, y, z);
const box = (w, h, d, color, p, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), color, p, x, y, z);
function cylinder(rt, rb, h, color, p, x, y, z, n = 12) { return mesh(new THREE.CylinderGeometry(rt, rb, h, n), color, p, x, y, z); }

const sea = mesh(new THREE.PlaneGeometry(160, 160), 0xa9d3cc, scene, 0, -1.05, 0);
sea.rotation.x = -Math.PI / 2; sea.receiveShadow = false; sea.castShadow = false;
cylinder(7.5, 7.1, .6, 0xe4d1a2, scene, 0, -.55, 0, 64).scale.z = .94;
cylinder(7.25, 7.5, .35, 0x9abb75, scene, 0, -.13, 0, 64).scale.z = .94;
// Rounded sandy paths are part of the scenery, not another menu.
for (const [x, z, sx, sz] of [[0,2,1.1,3.6],[-1,-.2,3.4,.75],[1.7,1,2.7,.75],[-1.3,-2,1.1,1.6]]) {
  const path = cylinder(1,1,.018,0xd6ce9d,scene,x,.055,z,40); path.scale.set(sx,1,sz);
}
const interactions = [];
function interactive(group, data) { group.userData.interaction = data; interactions.push(group); return group; }
function tree(x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, .04, z); g.scale.setScalar(scale); scene.add(g);
  cylinder(.13,.2,1.45,0x8d7150,g,0,.65,0,7);
  const crown = sphere(.9,0x6d975a,g,0,1.8,0); crown.scale.y=1.1;
  sphere(.65,0x86a967,g,-.38,1.72,.25); sphere(.62,0x95b66f,g,.27,2.13,.1);
  return g;
}
for (const t of [[-5,-3,1.2],[-3.9,-4.7,1],[-.6,-5.3,1.1],[3.5,-4.6,1.3],[5,-2.8,1.05],[5,1.8,.85],[-5.6,1.7,.85],[-4.9,4.1,.7]]) tree(...t);
// Small grass tufts, stones, and pebbles make the world feel lived in.
for(let i=0;i<46;i++){
  const a=i*2.39996,r=5.9+(i%3)*.12,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(i%4===0){const rock=sphere(.17,0xadb4a0,scene,x,.14,z);rock.scale.set(1.4,.75,1);}
  else for(let j=0;j<3;j++){const blade=mesh(new THREE.ConeGeometry(.035,.23,3),0x73965a,scene,x+j*.055,.13,z);blade.rotation.z=(j-1)*.2;}
}

const resources = new Map();
function resource(id, type, x, z) {
  const g = new THREE.Group(); g.position.set(x,.08,z); scene.add(g);
  if(type==='wood'){
    const log=cylinder(.19,.19,.8,0xa27c50,g,0,.2,0,9);log.rotation.z=Math.PI/2;
    const cut=cylinder(.165,.165,.014,0xe8c793,g,.406,.2,0,9);cut.rotation.z=Math.PI/2;
    const ring=cylinder(.07,.07,.018,0xba9564,g,.417,.2,0,9);ring.rotation.z=Math.PI/2;
    box(.2,.2,.16,0xa27c50,g,-.12,.41,0).rotation.z=-.3;
  } else if(type==='carrot') {
    const soil=cylinder(.36,.4,.05,0x97704c,g,0,.005,0,14);
    const carrot=mesh(new THREE.ConeGeometry(.13,.38,8),0xeaa348,g,0,.18,0);carrot.rotation.z=Math.PI;
    for(let j=0;j<4;j++){const leaf=mesh(new THREE.ConeGeometry(.085,.34,4),0x6c9b4e,g,(j-1.5)*.055,.43,0);leaf.rotation.z=(j-1.5)*.3;}
  } else {
    cylinder(.018,.018,.32,0x6d954e,g,0,.16,0,5);
    for(let j=0;j<5;j++) sphere(.085,0xf4cf6a,g,Math.cos(j*1.256)*.09,.35,Math.sin(j*1.256)*.09);
    sphere(.06,0xc79344,g,0,.39,0);
  }
  // Broad invisible hit target helps fingers without making the scenery oversized.
  const hit=mesh(new THREE.CylinderGeometry(.47,.47,.8,8),0xffffff,g,0,.3,0,{visible:false});
  const ring=mesh(new THREE.RingGeometry(.44,.49,32),0xfff2bc,g,0,.02,0,{side:THREE.DoubleSide,transparent:true,opacity:.9});ring.rotation.x=-Math.PI/2;
  resources.set(id,{id,type,group:g,ring,hit}); interactive(g,{kind:'resource',id,type});
}
resource('log-1','wood',-3.5,.1);resource('log-2','wood',-3.6,1.5);resource('log-3','wood',-2.1,2.2);
const garden=box(2.15,.09,1.55,0x9a7752,scene,3.2,.07,-.9);
for(const [x,z] of [[2.7,-1.25],[3.55,-1.25],[2.7,-.45],[3.55,-.45]]) resource(`carrot-${resources.size-2}`,'carrot',x,z);
resource('flower-1','flower',-1.9,4.2);resource('flower-2','flower',-.8,4.7);resource('flower-3','flower',.5,4.7);

function person({robe,skin,hair,player=false,beard=false}) {
  const group=new THREE.Group(), body=new THREE.Group();group.add(body);
  const leftLeg=box(.14,.35,.16,0x665d49,body,-.12,.21,0),rightLeg=box(.14,.35,.16,0x665d49,body,.12,.21,0);
  const torso=cylinder(.22,.28,.48,robe,body,0,.57,0,8);
  cylinder(.23,.255,.055,player?0xe9cb81:0xb89a67,body,0,.43,0,8);
  const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.position.set(-.27,.73,0);rightArm.position.set(.27,.73,0);body.add(leftArm,rightArm);
  const arm=(g)=>{const sleeve=cylinder(.085,.08,.25,robe,g,0,-.1,0,7);sphere(.075,skin,g,0,-.26,0);};arm(leftArm);arm(rightArm);
  sphere(.235,skin,body,0,1.04,0);
  const hairCap=sphere(.242,hair,body,0,1.14,-.035);hairCap.scale.set(1,.68,.95);
  if(player){for(let i=0;i<4;i++)sphere(.09,hair,body,-.15+i*.1,1.235,.05);box(.29,.3,.12,0xd2a767,body,0,.65,-.24);}
  else {sphere(.12,hair,body,-.2,.99,-.025);sphere(.12,hair,body,.2,.99,-.025);}
  sphere(.025,0x37443b,body,-.08,1.065,.209);sphere(.025,0x37443b,body,.08,1.065,.209);
  sphere(.032,skin,body,0,1.005,.235);
  if(beard){const b=mesh(new THREE.ConeGeometry(.16,.25,8),hair,body,0,.86,.11);b.rotation.z=Math.PI;}
  const mouth=box(.065,.013,.015,0xa96852,body,0,.938,.218);
  const shadow=mesh(new THREE.CircleGeometry(.34,24),0x385d3f,group,0,.008,0,{transparent:true,opacity:.12,depthWrite:false});shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  group.userData={body,leftLeg,rightLeg,leftArm,rightArm};scene.add(group);return group;
}
const player=person({robe:0x4b9b99,skin:0xbd8a64,hair:0x473f32,player:true});
player.position.set(state.player.x,.07,state.player.z);
player.rotation.y=.4;
const playerRing=mesh(new THREE.RingGeometry(.36,.41,36),0xfff2bb,scene,player.position.x,.075,player.position.z,{side:THREE.DoubleSide});playerRing.rotation.x=-Math.PI/2;
const friends = [
  {id:'noah',name:'Noah',face:'👨🏽‍🦳',color:0xb88c69,skin:0xba8a68,hair:0xe0d5bd,beard:true,points:[[-1.1,-1.8],[-.5,-2.4],[-2,-2.1],[-1.3,-.8]],line:'I’m making a cozy place for us. Thanks for being here.'},
  {id:'eve',name:'Eve',face:'👩🏽',color:0xc49a68,skin:0xba8967,hair:0x554331,points:[[2.05,.5],[3.75,.6],[3.85,-1.7],[2.1,-1.7]],line:'A little water, a little sunshine. Look how our garden grows!'},
  {id:'ruth',name:'Ruth',face:'👩🏾',color:0xa688a0,skin:0x9d7355,hair:0x413b32,points:[[-3,3.4],[-2.2,3.1],[-.7,3.5],[.8,2.4]],line:'It’s good to have a friend beside you.'},
].map(f=>{
  const model=person({robe:f.color,skin:f.skin,hair:f.hair,beard:f.beard});model.position.set(f.points[0][0],.07,f.points[0][1]);
  // Routines have no player selection, manual job assignment, or exposed status panel.
  return {...f,model,point:1,wait:2,routineTime:0,marker:null};
});
for(const f of friends){
  const target=mesh(new THREE.CylinderGeometry(.48,.48,1.5,8),0xffffff,f.model,0,.7,0,{visible:false});
  interactive(f.model,{kind:'friend',id:f.id});
  const marker=new THREE.Group();f.model.add(marker);marker.position.y=1.65;
  sphere(.16,0xffefba,marker,0,0,0);box(.035,.1,.02,0x8f7839,marker,0,.025,.155);sphere(.02,0x8f7839,marker,0,-.065,.155);f.marker=marker;
  const hand=f.model.userData.rightArm;
  if(f.id==='noah'){
    cylinder(.025,.025,.34,0x98784b,hand,0,-.3,.12,6);
    box(.25,.12,.12,0xc3aa7d,hand,0,-.14,.12);
  }else if(f.id==='eve'){
    cylinder(.12,.13,.2,0x80a9a0,hand,0,-.34,.12,9);
    const spout=cylinder(.035,.04,.23,0x80a9a0,hand,.14,-.29,.12,6);spout.rotation.z=-.9;
  }else cylinder(.14,.11,.18,0xb99665,hand,0,-.33,.13,9);
}

// Noah's home changes through visible milestones instead of a building-management screen.
const home=new THREE.Group();home.position.set(-1.3,.07,-3.35);scene.add(home);
const foundation=box(2.1,.15,1.65,0xbbaa83,home,0,.075,0);
const frame=new THREE.Group();home.add(frame);
for(const x of [-.85,.85])for(const z of [-.62,.62])cylinder(.07,.07,1.55,0xb6976b,frame,x,.85,z,6);
box(1.85,.1,.1,0xb6976b,frame,0,1.58,.65);
const finishedHome=new THREE.Group();home.add(finishedHome);
box(1.9,1.3,1.5,0xe6c99c,finishedHome,0,.8,0);
const roof=cylinder(0,1.57,1,0xb67552,finishedHome,0,1.8,0,4);roof.rotation.y=Math.PI/4;roof.scale.z=.85;
box(.44,.8,.06,0x937653,finishedHome,0,.49,.78);
box(.32,.34,.06,0x779a98,finishedHome,-.6,1,.78);box(.36,.045,.075,0xf2dfae,finishedHome,-.6,1,.82);
sphere(.025,0xe8c977,finishedHome,.13,.49,.82);
const welcomeFlowers=new THREE.Group();home.add(welcomeFlowers);
for(let i=0;i<6;i++){const f=sphere(.095,i%2?0xf0c975:0xe7b59f,welcomeFlowers,-.95+i*.38,.19,.99);sphere(.05,0x8c9a55,welcomeFlowers,-.95+i*.38,.09,.99);}
const bench=new THREE.Group();scene.add(bench);bench.position.set(2.7,.1,2.9);box(1.2,.11,.4,0xb79866,bench,0,.34,0);box(.1,.35,.3,0x8d7855,bench,-.45,.16,0);box(.1,.35,.3,0x8d7855,bench,.45,.16,0);
const basket=cylinder(.23,.19,.25,0xc59b64,scene,3.7,.22,2.8,10);
const destinationRing=mesh(new THREE.RingGeometry(.16,.22,32),0xfff5d8,scene,0,.09,0,{side:THREE.DoubleSide,transparent:true,opacity:.9});destinationRing.rotation.x=-Math.PI/2;destinationRing.visible=false;

let destination=null,pending=null,gathering=null,time=0,toastUntil=0,speechUntil=0,speechFriend=null,disposed=false;
const keys=new Set();
const taskCard=document.querySelector('.task-card'),sheet=document.querySelector('.sheet'),toast=document.querySelector('.toast'),speech=document.querySelector('.speech');
const entityControls=document.querySelector('.entity-controls');
const entityButtons=new Map();
function addEntityButton(id,label,getPosition,onClick){
  const button=document.createElement('button');button.className='entity-button';button.setAttribute('aria-label',label);
  button.addEventListener('click',onClick);entityControls.append(button);entityButtons.set(id,{button,getPosition,onClick});
}
for(const r of resources.values()){
  const number=r.id.split('-')[1];
  addEntityButton(r.id,`${r.type==='wood'?'Collect log':r.type==='carrot'?'Pick carrot':'Pick flower'} ${number}`,()=>r.group.position.clone().add(new THREE.Vector3(0,.3,0)),()=>walkTo(r.group.position.clone(),{kind:'resource',id:r.id,type:r.type}));
}
for(const f of friends)addEntityButton(f.id,`Talk to ${f.name}`,()=>f.model.position.clone().add(new THREE.Vector3(0,.7,0)),()=>walkTo(f.model.position.clone(),{kind:'friend',id:f.id}));
// Keep generous touch areas without allowing an adjacent crop's rectangle to steal a tap.
entityControls.addEventListener('click',event=>{
  if(event.detail===0)return; // Keyboard activation uses the focused button's own handler.
  event.stopPropagation();event.preventDefault();
  let nearest=null,distance=Infinity;
  for(const entity of entityButtons.values()){
    if(entity.button.hidden)continue;
    const r=entity.button.getBoundingClientRect();
    const d=Math.hypot(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2);
    if(d<distance){nearest=entity;distance=d;}
  }
  if(nearest&&distance<36)nearest.onClick();
},{capture:true});
function say(message, seconds=4){toast.textContent=message;toast.hidden=false;toastUntil=time+seconds;}
function speak(friend,message){speech.textContent=message;speech.hidden=false;speechUntil=time+4;speechFriend=friend;}
function renderUI(){
  const task=currentRequest(state),ready=readyToDeliver(state);
  if(task){
    const friend=friends.find(f=>f.id===task.friend);
    taskCard.innerHTML=`<div class="task-heading"><span class="portrait ${friend.id}" aria-hidden="true">${friend.face}</span><div><div class="eyebrow">${task.name.toUpperCase()} HAS A LITTLE REQUEST</div><h1>${task.title}</h1></div></div><p class="request-copy">“${task.ask}”</p><div class="task-bottom"><span class="next-action">${icons.hand}${ready?task.delivery:task.action}</span><span class="progress" aria-label="${progress(state)} of ${task.count} ${task.item} collected">${Array.from({length:task.count},(_,i)=>`<i class="${i<progress(state)?'done':''}"></i>`).join('')}<b>${progress(state)}/${task.count}</b></span></div>`;
  }else taskCard.innerHTML=`<div class="eyebrow">A LITTLE WORLD, BUILT TOGETHER</div><h1>You belong here.</h1><div class="completion-card">A home, a garden, and friends beside you. Take a walk and say hello. More adventures can wait.</div>`;
  document.querySelector('.count').textContent=task?'1':'✓';
  document.querySelector('.task-list').innerHTML=REQUESTS.map((t,i)=>`<div class="task-row ${i<state.stage?'complete':i>state.stage?'future':''}"><span class="status">${i<state.stage?'✓':i===state.stage?'•':'·'}</span><div><strong>${i>state.stage?'A new little adventure':t.title}</strong><small>${i<state.stage?'You helped '+t.name:i===state.stage?(ready?t.delivery:t.count+' '+t.item+' for '+t.name):'Discover it together, a little later'}</small></div></div>`).join('');
  for(const r of resources.values()){
    r.group.visible=!state.gathered.includes(r.id);
    const active=task?.item===r.type;r.ring.visible=active;r.group.scale.setScalar(active?1.12:1);
    entityButtons.get(r.id).button.hidden=!r.group.visible||!active;
  }
  for(const f of friends){f.model.visible=f.id!=='ruth'||state.stage>=2;f.marker.visible=task?.friend===f.id;entityButtons.get(f.id).button.hidden=!f.model.visible;}
  frame.visible=state.stage>=1&&state.homeWork<1;finishedHome.visible=state.homeWork>=1;foundation.visible=state.stage>=1;welcomeFlowers.visible=state.stage>=3;
}
renderUI();
document.querySelector('.tasks-button').addEventListener('click',()=>sheet.showModal());
const closeSheet=()=>sheet.close();
document.querySelector('.close-button').addEventListener('click',closeSheet);document.querySelector('.primary').addEventListener('click',closeSheet);
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet();}});

function walkTo(point,interaction=null){
  const x=Math.max(-5.3,Math.min(5.3,point.x)),z=Math.max(-4.8,Math.min(5.3,point.z));
  destination=new THREE.Vector3(x,.07,z);pending=interaction;gathering=null;
  destinationRing.position.set(x,.09,z);destinationRing.visible=true;
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),-.07);
function interactionRoot(object){let p=object;while(p&&!p.userData.interaction)p=p.parent;return p;}
let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>14)return;down=null;
  if(sheet.open)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const visible=interactions.filter(g=>g.visible);const hits=raycaster.intersectObjects(visible,true);
  for(const hit of hits){
    const group=interactionRoot(hit.object);if(!group)continue;
    const interaction=group.userData.interaction;
    if(interaction.kind==='resource'){
      if(currentRequest(state)?.item!==interaction.type){say('Let’s help with our little request first.');return;}
      walkTo(group.position.clone(),interaction);return;
    }
    if(interaction.kind==='friend'){walkTo(group.position.clone(),interaction);return;}
  }
  const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(ground,p))walkTo(p);
});
addEventListener('keydown',e=>{
  if(sheet.open||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Escape'].includes(e.key))return;
  e.preventDefault();keys.add(e.key.toLowerCase());
  if(e.key==='Escape'){destination=null;pending=null;gathering=null;destinationRing.visible=false;}
},{signal:lifecycle.signal});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()),{signal:lifecycle.signal});
addEventListener('blur',()=>keys.clear(),{signal:lifecycle.signal});

function interact(){
  if(!pending)return;
  if(pending.kind==='resource'){
    const r=resources.get(pending.id);
    if(!r||!r.group.visible){pending=null;return;}
    gathering={id:r.id,finish:time+.65};pending=null;
  }else{
    const friend=friends.find(f=>f.id===pending.id);pending=null;
    if(!friend)return;
    friend.wait=4;
    const task=currentRequest(state);
    if(task?.friend===friend.id&&readyToDeliver(state)){
      const next=deliver(state,friend.id);if(next!==state){state=next;save();renderUI();speak(friend,task.thanks);say(state.stage===2?'A new home. A new friend. Welcome, Ruth!':state.stage===3?'You made this place a little more like home.':'Noah is building. Eve has a little request for you.',5);}
    }else speak(friend,task?.friend===friend.id?task.ask:friend.line);
  }
}
function move(model,target,speed,dt,stop=.08){
  const delta=target.clone().sub(model.position);delta.y=0;const distance=delta.length();
  if(distance<=stop+.001)return false;
  model.position.addScaledVector(delta.normalize(),Math.min(speed*dt,Math.max(0,distance-stop)));
  const angle=Math.atan2(delta.x,delta.z);let diff=angle-model.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));model.rotation.y+=diff*Math.min(1,dt*10);
  return true;
}
function animatePerson(model,moving,dt,work=false){
  const d=model.userData,phase=time*(moving?9:3),swing=moving?Math.sin(phase)*.42:0;
  d.leftLeg.rotation.x=swing;d.rightLeg.rotation.x=-swing;
  d.leftArm.rotation.x=work?-.7+Math.sin(time*4)*.3:-swing*.75;d.rightArm.rotation.x=work?-.7+Math.sin(time*4+.5)*.3:swing*.75;
  d.body.position.y=moving?Math.abs(Math.sin(phase))*.025:Math.sin(time*2)*.007;
}
const clock=new THREE.Clock();let persistTimer=0;
function frameLoop(){
  if(disposed)return;
  requestAnimationFrame(frameLoop);
  const dt=Math.min(clock.getDelta(),.05);time+=dt;
  // All NPC routines continue independently; their identities are never assigned to player.
  for(const friend of friends){
    if(!friend.model.visible)continue;
    friend.wait-=dt;let moving=false;
    if(friend.wait<=0){
      const p=friend.points[friend.point];moving=move(friend.model,new THREE.Vector3(p[0],.07,p[1]),.48,dt,.05);
      if(!moving){friend.point=(friend.point+1)%friend.points.length;friend.wait=3.5+(friend.point%3)*1.2;}
    }
    animatePerson(friend.model,moving,dt,!moving&&friend.wait>0);
    friend.marker.position.y=1.65+Math.sin(time*2)*.045;
  }
  if(state.stage>=1&&state.homeWork<1){
    // Noah builds without player commands, upkeep meters, or another completed request.
    state.homeWork=Math.min(1,state.homeWork+dt/18);
    if(state.homeWork>=1){save();renderUI();say('Noah finished our little home. Come have a look!',5);}
  }
  let moving=false;
  if(!sheet.open){
    const x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const z=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(x||z){
      const direction=new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(12,21)).normalize();
      const next=player.position.clone().addScaledVector(direction,1.9*dt);next.x=Math.max(-5.3,Math.min(5.3,next.x));next.z=Math.max(-4.8,Math.min(5.3,next.z));
      moving=move(player,next,1.9,dt,0);destination=null;pending=null;gathering=null;destinationRing.visible=false;
    }else if(destination){
      if(pending?.kind==='friend'){const f=friends.find(f=>f.id===pending.id);destination.copy(f.model.position);f.wait=Math.max(f.wait,.25);}
      const stopDistance=pending?.kind==='friend' ? .65 : pending?.kind==='resource' ? .3 : .07;
      moving=move(player,destination,1.9,dt,stopDistance);
      if(!moving){destination=null;destinationRing.visible=false;interact();}
    }
    if(gathering&&time>=gathering.finish){
      const next=collect(state,gathering.id);gathering=null;
      if(next!==state){state=next;save();renderUI();say(readyToDeliver(state)?`All ready! Tap ${currentRequest(state).name} to bring these over.`:`A little help goes a long way. ${progress(state)} of ${currentRequest(state).count} collected.`,3);}
    }
  }
  animatePerson(player,moving,dt,!!gathering);
  playerRing.position.set(player.position.x,.08,player.position.z);
  destinationRing.scale.setScalar(1+Math.sin(time*5)*.1);
  const label=document.querySelector('.world-label'),p=player.position.clone().add(new THREE.Vector3(0,1.6,0)).project(camera);
  label.style.left=`${(p.x+1)*innerWidth/2}px`;label.style.top=`${(-p.y+1)*innerHeight/2}px`;
  for(const {button,getPosition} of entityButtons.values()){
    if(button.hidden)continue;
    const p=getPosition().project(camera);button.style.left=`${(p.x+1)*innerWidth/2}px`;button.style.top=`${(-p.y+1)*innerHeight/2}px`;
  }
  if(speechFriend&&!speech.hidden){const p=speechFriend.model.position.clone().add(new THREE.Vector3(0,1.9,0)).project(camera);speech.style.left=`${Math.max(110,Math.min(innerWidth-110,(p.x+1)*innerWidth/2))}px`;speech.style.top=`${Math.max(300,(-p.y+1)*innerHeight/2)}px`;}
  if(time>toastUntil)toast.hidden=true;if(time>speechUntil)speech.hidden=true;
  persistTimer+=dt;if(persistTimer>1){state.player.x=player.position.x;state.player.z=player.position.z;save();persistTimer=0;}
  renderer.render(scene,camera);
}
function resize(){
  const aspect=innerWidth/innerHeight,width=innerWidth<700?16:18*aspect,height=width/aspect;
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.near=.1;camera.far=100;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize,{signal:lifecycle.signal});resize();frameLoop();
document.addEventListener('visibilitychange',()=>{keys.clear();clock.getDelta();},{signal:lifecycle.signal});
if(import.meta.hot)import.meta.hot.dispose(()=>{
  disposed=true;lifecycle.abort();save();
  scene.traverse(object=>object.geometry?.dispose());
  materials.forEach(material=>material.dispose());renderer.dispose();
});
