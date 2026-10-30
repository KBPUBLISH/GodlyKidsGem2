// Procedural Dining Hall: an open timber pavilion (posts, a thatched gable roof and a low back wall)
// over one long trestle table with benches, and a bell on a post by the front corner. Until a Blender
// model ships, these are the `building_dining_hall_{foundation,frame,complete}` prototypes.
// Local axes match the catalogue: x runs along the table (7 m side), +z is the front (workPoint side).
// Seats and the serving spot are defined in dining.mjs and must stay in step with the table here.
import * as THREE from 'three';
import {TABLE_TOP_Y,BENCH_TOP_Y} from './dining.mjs';
const MAT={
  stone:new THREE.MeshStandardMaterial({color:'#8d8a80',roughness:.95}),
  stoneDark:new THREE.MeshStandardMaterial({color:'#6f6a60',roughness:.95}),
  // Slab only: its top (y=.14) can land exactly on the flat grass (ground is y≈.14) when a hall is saved
  // with baseHeight 0 or sits on an uneven site, so the two faces z-fought and the rim shimmered as the
  // camera moved. A small negative polygon offset pulls the slab in front of coplanar terrain.
  slab:new THREE.MeshStandardMaterial({color:'#6f6a60',roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.85}),
  woodDark:new THREE.MeshStandardMaterial({color:'#74502c',roughness:.85}),
  plank:new THREE.MeshStandardMaterial({color:'#b98853',roughness:.9}),
  thatch:new THREE.MeshStandardMaterial({color:'#c9a661',roughness:1}),
  thatchDark:new THREE.MeshStandardMaterial({color:'#a8863f',roughness:1}),
  cloth:new THREE.MeshStandardMaterial({color:'#f3e6c8',roughness:.95}),
  brass:new THREE.MeshStandardMaterial({color:'#d2a649',roughness:.35,metalness:.6}),
  rope:new THREE.MeshStandardMaterial({color:'#8a7349',roughness:1}),
  lantern:new THREE.MeshStandardMaterial({color:'#ffd27a',emissive:'#ffb347',emissiveIntensity:.55,roughness:.6}),
};
const POSTS=[-3.1,0,3.1].flatMap(x=>[[x,-2.1],[x,2.1]]);
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function foundation(){
  const g=new THREE.Group();
  const slab=mesh(new THREE.BoxGeometry(6.9,.14,4.9),MAT.slab);slab.position.y=.07;g.add(slab);
  for(const [x,z] of POSTS){const plinth=mesh(new THREE.BoxGeometry(.5,.3,.5),MAT.stone);plinth.position.set(x,.29,z);g.add(plinth);}
  const floor=mesh(new THREE.BoxGeometry(6.5,.08,4.5),MAT.plank);floor.position.y=.18;g.add(floor);
  return g;
}
function frame(){
  const g=foundation();
  for(const [x,z] of POSTS){const post=mesh(new THREE.BoxGeometry(.24,2.6,.24),MAT.woodDark);post.position.set(x,.44+1.3,z);g.add(post);}
  for(const z of [-2.1,2.1]){const beam=mesh(new THREE.BoxGeometry(6.7,.2,.26),MAT.wood);beam.position.set(0,3.0,z);g.add(beam);}
  for(const x of [-3.1,0,3.1]){const tie=mesh(new THREE.BoxGeometry(.2,.18,4.5),MAT.wood);tie.position.set(x,3.0,0);g.add(tie);
    const king=mesh(new THREE.BoxGeometry(.16,.95,.16),MAT.woodDark);king.position.set(x,3.7,0);g.add(king);}
  const ridge=mesh(new THREE.BoxGeometry(7.0,.18,.2),MAT.wood);ridge.position.y=4.21;g.add(ridge);
  return g;
}
function complete(){
  const g=frame();
  // Thatched gable: two slopes from the ridge (y≈4.26) down past the eaves (y≈2.95), clear of the beams, with a dark ridge cap.
  const pitch=Math.atan2(1.3,2.65);
  for(const side of [-1,1]){const slope=mesh(new THREE.BoxGeometry(7.6,.14,3.0),MAT.thatch,'roof');slope.position.set(0,3.6,side*1.37);slope.rotation.x=side*pitch;g.add(slope);
    const under=mesh(new THREE.BoxGeometry(7.4,.05,2.8),MAT.plank,'roof');under.position.set(0,3.52,side*1.33);under.rotation.x=side*pitch;g.add(under);}
  const cap=mesh(new THREE.BoxGeometry(7.7,.16,.5),MAT.thatchDark,'roof');cap.position.y=4.32;g.add(cap);
  // Open on every side so friends can walk straight to a bench; lanterns on the beams make it cosy.
  for(const [x,z] of [[-1.55,-2.1],[1.55,-2.1],[-1.55,2.1],[1.55,2.1]]){const lamp=mesh(new THREE.BoxGeometry(.18,.24,.18),MAT.lantern,'body');lamp.position.set(x,2.72,z);g.add(lamp);
    const hook=mesh(new THREE.CylinderGeometry(.015,.015,.14,6),MAT.rope,'body');hook.position.set(x,2.9,z);g.add(hook);}
  // Long trestle table with a runner, and a bench either side.
  const top=mesh(new THREE.BoxGeometry(5.0,.1,.95),MAT.wood,'body');top.position.y=TABLE_TOP_Y-.05;g.add(top);
  const runner=mesh(new THREE.BoxGeometry(4.6,.012,.42),MAT.cloth,'body');runner.position.y=TABLE_TOP_Y+.006;g.add(runner);
  for(const x of [-2.0,0,2.0]){const trestle=mesh(new THREE.BoxGeometry(.12,TABLE_TOP_Y-.3,.7),MAT.woodDark,'body');trestle.position.set(x,.22+(TABLE_TOP_Y-.3)/2,0);trestle.rotation.y=0;g.add(trestle);
    const foot=mesh(new THREE.BoxGeometry(.3,.08,.8),MAT.woodDark,'body');foot.position.set(x,.26,0);g.add(foot);}
  for(const z of [-.85,.85]){const seat=mesh(new THREE.BoxGeometry(4.8,.08,.38),MAT.wood,'body');seat.position.set(0,BENCH_TOP_Y-.04,z);g.add(seat);
    for(const x of [-2.1,0,2.1]){const leg=mesh(new THREE.BoxGeometry(.1,BENCH_TOP_Y-.26,.32),MAT.woodDark,'body');leg.position.set(x,.22+(BENCH_TOP_Y-.26)/2,z);g.add(leg);}}
  // Bell on a post by the front-right corner; the cook rings it at ten.
  const bellPost=mesh(new THREE.BoxGeometry(.14,2.1,.14),MAT.woodDark,'body');bellPost.position.set(3.05,.22+1.05,2.55);g.add(bellPost);
  const arm=mesh(new THREE.BoxGeometry(.12,.1,.6),MAT.woodDark,'body');arm.position.set(3.05,2.3,2.85);g.add(arm);
  const bell=new THREE.Group();bell.name='bell';bell.position.set(3.05,2.2,3.05);
  const cup=mesh(new THREE.CylinderGeometry(.09,.2,.3,14,1,true),MAT.brass,'body');cup.material=MAT.brass;cup.position.y=-.15;bell.add(cup);
  const crown=mesh(new THREE.SphereGeometry(.09,10,8),MAT.brass,'body');bell.add(crown);
  const clapper=mesh(new THREE.SphereGeometry(.05,8,6),MAT.woodDark,'body');clapper.position.y=-.32;bell.add(clapper);
  const pull=mesh(new THREE.CylinderGeometry(.012,.012,.9,6),MAT.rope,'body');pull.position.y=-.8;bell.add(pull);
  g.add(bell);
  return g;
}
/** Adds the hall prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerDiningHallAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_dining_hall_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
