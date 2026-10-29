// Procedural forge. The building catalogue expects `building_forge_{foundation,frame,complete}`
// prototypes in the asset library; until a Blender model ships, this builds a storybook forge
// out of primitives, the same way the well and clay oven do.
// The hearth mouth faces +Z (the building's "front"), which is where workPoint() puts the character.
import * as THREE from 'three';
const MAT={
  stone:new THREE.MeshStandardMaterial({color:'#8d8680',roughness:.95}),
  stoneDark:new THREE.MeshStandardMaterial({color:'#6a635c',roughness:.95}),
  soot:new THREE.MeshStandardMaterial({color:'#2c241e',roughness:1}),
  iron:new THREE.MeshStandardMaterial({color:'#5d6a74',roughness:.45,metalness:.55}),
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.8}),
  leather:new THREE.MeshStandardMaterial({color:'#8d4b32',roughness:.75}),
  flame:new THREE.MeshStandardMaterial({color:'#ffb347',emissive:'#ff6a1a',emissiveIntensity:1.5,roughness:.55}),
  ember:new THREE.MeshStandardMaterial({color:'#ff7a2a',emissive:'#ff4d12',emissiveIntensity:1.2,roughness:.6}),
};
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function stoneCourse(half,height,y){
  const g=new THREE.Group(),n=4,step=(half*2)/n;
  for(let i=0;i<n;i++)for(const [x,z,rot] of [[-half+step*(i+.5),-half,0],[-half+step*(i+.5),half,0],[-half,-half+step*(i+.5),1],[half,-half+step*(i+.5),1]]){
    const block=mesh(new THREE.BoxGeometry(step*.94,height,.28),(i+rot)%2?MAT.stone:MAT.stoneDark);
    block.position.set(x,y+height/2,z);block.rotation.y=rot?Math.PI/2:0;g.add(block);
  }
  return g;
}
function foundation(){
  const g=new THREE.Group();
  const slab=mesh(new THREE.BoxGeometry(1.7,.14,1.55),MAT.stoneDark);slab.position.y=.07;g.add(slab);
  g.add(stoneCourse(.78,.28,.14));
  return g;
}
function frame(){
  const g=foundation();
  g.add(stoneCourse(.78,.32,.42));
  // Hearth floor and the back wall. The front stays open so the fire reads from the work side.
  const floor=mesh(new THREE.BoxGeometry(1.15,.08,1.05),MAT.soot);floor.position.set(0,.78,.05);g.add(floor);
  const back=mesh(new THREE.BoxGeometry(1.2,.55,.22),MAT.stone);back.position.set(0,1.05,-.48);g.add(back);
  const sideL=mesh(new THREE.BoxGeometry(.22,.55,.9),MAT.stoneDark);sideL.position.set(-.58,1.05,-.05);g.add(sideL);
  const sideR=mesh(new THREE.BoxGeometry(.22,.55,.9),MAT.stone);sideR.position.set(.58,1.05,-.05);g.add(sideR);
  const anvil=mesh(new THREE.BoxGeometry(.46,.16,.22),MAT.iron);anvil.position.set(.95,.55,.35);g.add(anvil);
  return g;
}
function complete(){
  const g=frame();
  const lip=mesh(new THREE.BoxGeometry(1.15,.1,.16),MAT.stoneDark);lip.position.set(0,.82,.52);g.add(lip);
  const coal=mesh(new THREE.SphereGeometry(.08,8,6),MAT.ember,'flame');coal.position.set(-.12,.86,.05);coal.scale.set(1,.6,1);coal.castShadow=false;g.add(coal);
  const coal2=mesh(new THREE.SphereGeometry(.06,8,6),MAT.ember,'flame');coal2.position.set(.16,.84,.12);coal2.scale.set(1,.55,1);coal2.castShadow=false;g.add(coal2);
  const flame=mesh(new THREE.ConeGeometry(.16,.38,8),MAT.flame,'flame');flame.position.set(0,1.08,.08);flame.castShadow=false;g.add(flame);
  const flame2=mesh(new THREE.ConeGeometry(.09,.24,7),MAT.flame,'flame');flame2.position.set(.14,1.0,.16);flame2.castShadow=false;g.add(flame2);
  const chimney=mesh(new THREE.BoxGeometry(.32,.7,.32),MAT.stone,'roof');chimney.position.set(-.28,1.55,-.35);g.add(chimney);
  const cap=mesh(new THREE.BoxGeometry(.44,.08,.44),MAT.stoneDark,'roof');cap.position.set(-.28,1.92,-.35);g.add(cap);
  const horn=mesh(new THREE.BoxGeometry(.55,.1,.28),MAT.iron);horn.position.set(.95,.68,.35);g.add(horn);
  const stem=mesh(new THREE.CylinderGeometry(.07,.08,.28,8),MAT.iron);stem.position.set(.95,.4,.35);g.add(stem);
  const bellows=mesh(new THREE.BoxGeometry(.18,.42,.55),MAT.leather);bellows.position.set(-.95,.48,.2);bellows.rotation.z=.15;g.add(bellows);
  const handle=mesh(new THREE.BoxGeometry(.08,.5,.08),MAT.wood);handle.position.set(-1.05,.78,.35);handle.rotation.z=.4;g.add(handle);
  return g;
}
/** Adds the forge prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerForgeAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_forge_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
