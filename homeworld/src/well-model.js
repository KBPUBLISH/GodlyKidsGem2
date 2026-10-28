// Procedural water well. The building catalogue expects `building_well_{foundation,frame,complete}` prototypes
// in the asset library; until a Blender model ships, this builds a storybook well out of primitives.
import * as THREE from 'three';
const MAT={
  stone:new THREE.MeshStandardMaterial({color:'#8d8a80',roughness:.95}),
  stoneDark:new THREE.MeshStandardMaterial({color:'#6f6a60',roughness:.95}),
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.8}),
  roof:new THREE.MeshStandardMaterial({color:'#7a4a2a',roughness:.85}),
  water:new THREE.MeshStandardMaterial({color:'#4fb6c9',roughness:.25,metalness:.1,emissive:'#1b5f6d',emissiveIntensity:.25}),
  rope:new THREE.MeshStandardMaterial({color:'#d6c39a',roughness:1}),
  bucket:new THREE.MeshStandardMaterial({color:'#b9895a',roughness:.8}),
  dirt:new THREE.MeshStandardMaterial({color:'#6b4f33',roughness:1}),
};
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function stoneRing(radius,height,y,count=12){
  const g=new THREE.Group();
  for(let i=0;i<count;i++){
    const a=(i+(y>0?.5:0))/count*Math.PI*2,block=mesh(new THREE.BoxGeometry(.4,height,.26),i%2?MAT.stone:MAT.stoneDark);
    block.position.set(Math.cos(a)*radius,y+height/2,Math.sin(a)*radius);block.rotation.y=-a-Math.PI/2;g.add(block);
  }
  return g;
}
function foundation(){
  const g=new THREE.Group();
  const pit=mesh(new THREE.CylinderGeometry(.62,.62,.06,20),MAT.dirt);pit.position.y=.03;g.add(pit);
  g.add(stoneRing(.66,.22,0));
  return g;
}
function frame(){
  const g=foundation();
  g.add(stoneRing(.66,.26,.22));g.add(stoneRing(.65,.26,.48));
  const water=mesh(new THREE.CylinderGeometry(.5,.5,.03,20),MAT.water);water.position.y=.16;g.add(water);
  for(const x of [-.78,.78]){const post=mesh(new THREE.BoxGeometry(.14,1.75,.14),MAT.wood);post.position.set(x,.875,0);g.add(post);}
  return g;
}
function complete(){
  const g=frame();
  const cap=mesh(new THREE.TorusGeometry(.66,.08,8,20),MAT.stone);cap.rotation.x=Math.PI/2;cap.position.y=.76;g.add(cap);
  const bar=mesh(new THREE.CylinderGeometry(.05,.05,1.6,10),MAT.wood);bar.rotation.z=Math.PI/2;bar.position.y=1.55;g.add(bar);
  const crank=mesh(new THREE.BoxGeometry(.05,.22,.05),MAT.wood);crank.position.set(.86,1.45,0);g.add(crank);
  const spool=mesh(new THREE.CylinderGeometry(.09,.09,.3,10),MAT.rope);spool.rotation.z=Math.PI/2;spool.position.y=1.55;g.add(spool);
  const rope=mesh(new THREE.CylinderGeometry(.012,.012,.55,6),MAT.rope);rope.position.set(0,1.27,0);g.add(rope);
  const bucket=mesh(new THREE.CylinderGeometry(.13,.1,.2,10),MAT.bucket);bucket.position.set(0,.9,0);g.add(bucket);
  // Gable: inner edges meet at the ridge, outer edges hang over the posts.
  const roofL=mesh(new THREE.BoxGeometry(2.05,.07,.9),MAT.roof,'roof');roofL.rotation.x=-Math.PI/4.6;roofL.position.set(0,1.98,-.33);g.add(roofL);
  const roofR=mesh(new THREE.BoxGeometry(2.05,.07,.9),MAT.roof,'roof');roofR.rotation.x=Math.PI/4.6;roofR.position.set(0,1.98,.33);g.add(roofR);
  const ridge=mesh(new THREE.BoxGeometry(2.1,.09,.14),MAT.wood,'roof');ridge.position.set(0,2.29,0);g.add(ridge);
  for(const x of [-.78,.78]){const brace=mesh(new THREE.BoxGeometry(.1,.7,.1),MAT.wood);brace.position.set(x,1.9,0);g.add(brace);}
  return g;
}
/** Adds the well prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerWellAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_well_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
