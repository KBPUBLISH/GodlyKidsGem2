// Procedural clay oven. The building catalogue expects `building_oven_{foundation,frame,complete}` prototypes
// in the asset library; until a Blender model ships, this builds a storybook bread oven out of primitives.
// The mouth faces +Z (the building's "front"), which is where workPoint() puts the character.
import * as THREE from 'three';
const MAT={
  stone:new THREE.MeshStandardMaterial({color:'#8d8a80',roughness:.95}),
  stoneDark:new THREE.MeshStandardMaterial({color:'#6f6a60',roughness:.95}),
  clay:new THREE.MeshStandardMaterial({color:'#c4784b',roughness:.9}),
  clayDark:new THREE.MeshStandardMaterial({color:'#a35f3a',roughness:.9}),
  soot:new THREE.MeshStandardMaterial({color:'#2a211c',roughness:1}),
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.8}),
  flame:new THREE.MeshStandardMaterial({color:'#ffb347',emissive:'#ff7a1a',emissiveIntensity:1.6,roughness:.6}),
};
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function stoneRing(half,height,y){
  const g=new THREE.Group(),n=5,step=(half*2)/n;
  for(let i=0;i<n;i++)for(const [x,z,rot] of [[-half+step*(i+.5),-half,0],[-half+step*(i+.5),half,0],[-half,-half+step*(i+.5),1],[half,-half+step*(i+.5),1]]){
    const block=mesh(new THREE.BoxGeometry(step*.96,height,.26),(i+rot)%2?MAT.stone:MAT.stoneDark);block.position.set(x,y+height/2,z);block.rotation.y=rot?Math.PI/2:0;g.add(block);
  }
  return g;
}
function foundation(){
  const g=new THREE.Group();
  const slab=mesh(new THREE.BoxGeometry(1.7,.12,1.7),MAT.stoneDark);slab.position.y=.06;g.add(slab);
  g.add(stoneRing(.72,.3,.12));
  return g;
}
function frame(){
  const g=foundation();
  g.add(stoneRing(.72,.3,.42));
  const hearth=mesh(new THREE.BoxGeometry(1.3,.08,1.3),MAT.soot);hearth.position.y=.76;g.add(hearth);
  // Lower half of the clay dome, laid as brick courses.
  for(let i=0;i<3;i++){const r=.68-i*.05,course=mesh(new THREE.CylinderGeometry(r,r+.04,.16,18),i%2?MAT.clay:MAT.clayDark);course.position.y=.8+.08+i*.16;g.add(course);}
  return g;
}
function complete(){
  const g=frame();
  const dome=mesh(new THREE.SphereGeometry(.6,20,14,0,Math.PI*2,0,Math.PI/2),MAT.clay);dome.position.y=1.26;dome.scale.set(1,.85,1);g.add(dome);
  // Mouth: a dark arch cut-in at the front plus a sooty lip and the glow inside.
  const mouth=mesh(new THREE.CylinderGeometry(.22,.22,.3,16,1,false,0,Math.PI),MAT.soot);mouth.rotation.z=Math.PI/2;mouth.rotation.y=Math.PI/2;mouth.position.set(0,1.02,.56);g.add(mouth);
  const mouthFloor=mesh(new THREE.BoxGeometry(.44,.04,.32),MAT.soot);mouthFloor.position.set(0,.86,.56);g.add(mouthFloor);
  const lip=mesh(new THREE.TorusGeometry(.24,.05,8,16,Math.PI),MAT.clayDark);lip.position.set(0,.86,.7);g.add(lip);
  const flame=mesh(new THREE.ConeGeometry(.14,.3,8),MAT.flame,'flame');flame.position.set(0,1.0,.5);flame.castShadow=false;g.add(flame);
  const ember=mesh(new THREE.SphereGeometry(.1,8,6),MAT.flame,'flame');ember.position.set(.08,.9,.46);ember.castShadow=false;g.add(ember);
  // Chimney at the back and a little wooden peel resting against the side.
  const chimney=mesh(new THREE.BoxGeometry(.26,.7,.26),MAT.stone,'roof');chimney.position.set(-.18,1.7,-.3);g.add(chimney);
  const cap=mesh(new THREE.BoxGeometry(.34,.06,.34),MAT.stoneDark,'roof');cap.position.set(-.18,2.08,-.3);g.add(cap);
  const peel=mesh(new THREE.BoxGeometry(.05,1.25,.05),MAT.wood);peel.position.set(.84,.72,.3);peel.rotation.z=-.22;g.add(peel);
  const blade=mesh(new THREE.BoxGeometry(.03,.26,.22),MAT.wood);blade.position.set(.7,1.3,.3);blade.rotation.z=-.22;g.add(blade);
  return g;
}
/** Adds the oven prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerOvenAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_oven_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
