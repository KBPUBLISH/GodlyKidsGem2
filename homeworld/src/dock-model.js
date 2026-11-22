// Procedural Harbour Dock: a plank pier on timber pilings with mooring bollards, a lantern post, a coil
// of rope and a crate waiting to be carried ashore. Until a Blender model ships, these are the
// `building_dock_{foundation,frame,complete}` prototypes. Local axes match the catalogue: x runs across
// the pier (2 m side), z along it (5 m side), +z is the front (the landward end, where the workPoint is).
import * as THREE from 'three';
const MAT={
  stone:new THREE.MeshStandardMaterial({color:'#8d8a80',roughness:.95}),
  piling:new THREE.MeshStandardMaterial({color:'#5c3f22',roughness:.9}),
  beam:new THREE.MeshStandardMaterial({color:'#74502c',roughness:.85}),
  plank:new THREE.MeshStandardMaterial({color:'#b98853',roughness:.9}),
  plankDark:new THREE.MeshStandardMaterial({color:'#a3733f',roughness:.9}),
  rope:new THREE.MeshStandardMaterial({color:'#c9b283',roughness:1}),
  iron:new THREE.MeshStandardMaterial({color:'#3c3a36',roughness:.6,metalness:.4}),
  lantern:new THREE.MeshStandardMaterial({color:'#ffd36a',emissive:'#ffb13b',emissiveIntensity:.8,roughness:.4}),
  crate:new THREE.MeshStandardMaterial({color:'#c99a5a',roughness:.9}),
  sign:new THREE.MeshStandardMaterial({color:'#f3e2b4',roughness:.9}),
};
const DECK_Y=1.0;
const PILINGS=[-2.1,-1.0,.1,1.2,2.2].flatMap(z=>[[-.75,z],[.75,z]]);
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function foundation(){
  const g=new THREE.Group();
  for(const [x,z] of PILINGS){const plinth=mesh(new THREE.BoxGeometry(.34,.22,.34),MAT.stone);plinth.position.set(x,.11,z);g.add(plinth);}
  return g;
}
function frame(){
  const g=foundation();
  for(const [x,z] of PILINGS){const post=mesh(new THREE.CylinderGeometry(.1,.12,DECK_Y,8),MAT.piling);post.position.set(x,.22+DECK_Y/2,z);g.add(post);}
  for(const x of [-.75,.75]){const stringer=mesh(new THREE.BoxGeometry(.16,.14,4.7),MAT.beam);stringer.position.set(x,DECK_Y+.1,.05);g.add(stringer);}
  return g;
}
function complete(){
  const g=frame();
  // Deck: planks laid across the pier, alternating shades, with a slight gap between them.
  const planks=15,len=4.6,w=len/planks;
  for(let i=0;i<planks;i++){
    const p=mesh(new THREE.BoxGeometry(1.9,.07,w-.03),i%3?MAT.plank:MAT.plankDark,'body');
    p.position.set(0,DECK_Y+.2,-2.25+w*(i+.5));g.add(p);
  }
  // Mooring bollards on the seaward end and halfway along, each with a rope hitched round it.
  for(const [x,z] of [[-.78,-2.1],[.78,-2.1],[.78,0]]){
    const b=mesh(new THREE.CylinderGeometry(.11,.13,.55,10),MAT.piling,'body');b.position.set(x,DECK_Y+.5,z);g.add(b);
    const cap=mesh(new THREE.CylinderGeometry(.15,.11,.08,10),MAT.iron,'body');cap.position.set(x,DECK_Y+.8,z);g.add(cap);
    const hitch=mesh(new THREE.TorusGeometry(.14,.03,6,14),MAT.rope,'body');hitch.rotation.x=Math.PI/2;hitch.position.set(x,DECK_Y+.62,z);g.add(hitch);
  }
  // Lantern post by the landward corner so boats find the pier at dusk.
  const post=mesh(new THREE.BoxGeometry(.12,1.9,.12),MAT.beam,'body');post.position.set(-.78,DECK_Y+.2+.95,2.0);g.add(post);
  const arm=mesh(new THREE.BoxGeometry(.5,.08,.08),MAT.beam,'body');arm.position.set(-.56,DECK_Y+2.1,2.0);g.add(arm);
  const cage=mesh(new THREE.BoxGeometry(.26,.34,.26),MAT.iron,'body');cage.position.set(-.36,DECK_Y+1.82,2.0);g.add(cage);
  const glow=mesh(new THREE.BoxGeometry(.18,.24,.18),MAT.lantern,'body');glow.position.copy(cage.position);g.add(glow);
  // A coil of rope and a crate left on the planks.
  const coil=mesh(new THREE.TorusGeometry(.22,.07,8,18),MAT.rope,'body');coil.rotation.x=Math.PI/2;coil.position.set(.45,DECK_Y+.3,1.2);g.add(coil);
  const crate=mesh(new THREE.BoxGeometry(.5,.42,.5),MAT.crate,'body');crate.position.set(-.45,DECK_Y+.45,.6);g.add(crate);
  for(const s of [-1,1]){const slat=mesh(new THREE.BoxGeometry(.52,.05,.52),MAT.beam,'body');slat.position.set(-.45,DECK_Y+.45+s*.16,.6);g.add(slat);}
  // Welcome board hanging from the lantern post.
  const board=mesh(new THREE.BoxGeometry(.05,.3,.6),MAT.sign,'body');board.position.set(-.78,DECK_Y+1.25,1.55);g.add(board);
  return g;
}
/** Adds the dock prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerDockAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_dock_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
