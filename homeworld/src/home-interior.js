// Door, roof reveal, and a light interior for finished homes (tent, hut, cottage, townhouse).
import * as THREE from 'three';
import {buildingById} from './building.mjs';

export const HOME_KINDS=['tent','hut','cottage','townhouse'];
/** Hinge swing into the room. Local +Z is the front, so positive Y rotation carries the free edge toward -Z. */
export const DOOR_SWING=100*Math.PI/180;

const MAT={
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.82,flatShading:true}),
  woodDark:new THREE.MeshStandardMaterial({color:'#6b4424',roughness:.88,flatShading:true}),
  knob:new THREE.MeshStandardMaterial({color:'#e6d3a1',roughness:.6,flatShading:true}),
  floor:new THREE.MeshStandardMaterial({color:'#c4a574',roughness:.95,flatShading:true}),
  rug:new THREE.MeshStandardMaterial({color:'#b85a3c',roughness:.92,flatShading:true}),
  mattress:new THREE.MeshStandardMaterial({color:'#f4efe4',roughness:.9,flatShading:true}),
  pillow:new THREE.MeshStandardMaterial({color:'#f7f3e6',roughness:.9,flatShading:true}),
  blanket:new THREE.MeshStandardMaterial({color:'#6e8f5b',roughness:.9,flatShading:true}),
};

function board(w,h,d,mat,x,y,z){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;
}

/** Plank door on the front (+Z) face, hinged on its left edge. Used when the model has no door mesh. */
function plankDoor(kind){
  const spec=kind==='tent'?{w:.68,h:1.32,y:.06,z:.9}:{w:.8,h:1.58,y:.18,z:1.14};
  const hinge=new THREE.Group();
  hinge.name='home-door-hinge';
  hinge.position.set(-spec.w/2,0,spec.z);
  const door=new THREE.Group();
  const plankW=spec.w/3-.02;
  for(let i=0;i<3;i++) door.add(board(plankW,spec.h-.08,.07,MAT.wood,(i+.5)*(spec.w/3),spec.y+spec.h/2,0));
  for(const fy of [.32,.7]) door.add(board(spec.w*.9,.09,.09,MAT.woodDark,spec.w/2,spec.y+spec.h*fy,.04));
  door.add(board(.06,.06,.06,MAT.knob,spec.w*.82,spec.y+spec.h*.48,.07));
  hinge.add(door);
  return {hinge,doorZ:spec.z};
}

function makeBed(){
  const g=new THREE.Group();
  g.add(board(.7,.16,1.12,MAT.wood,0,.14,0));
  g.add(board(.6,.1,.96,MAT.mattress,0,.26,0));
  g.add(board(.6,.06,.52,MAT.blanket,0,.32,.16));
  g.add(board(.42,.08,.24,MAT.pillow,0,.34,-.36));
  return g;
}

function makeTable(){
  const g=new THREE.Group();
  g.add(board(.62,.06,.46,MAT.wood,0,.42,0));
  for(const x of [-.24,.24]) for(const z of [-.16,.16]) g.add(board(.06,.4,.06,MAT.woodDark,x,.2,z));
  return g;
}

function furnish(kind){
  // Homes sleep more friends than the ground floor shows (building.mjs `beds`); at most four beds are drawn, the rest are "upstairs".
  const def=buildingById(kind),beds=Math.min(4,def?.beds||1),g=new THREE.Group();
  g.name='home-interior';
  const fw=Math.min((def?.size[0]||2)*.72,3.1),fd=Math.min((def?.size[1]||2)*.62,2.8);
  g.add(board(fw,.04,fd,MAT.floor,0,.03,-.05));
  g.add(board(Math.min(fw*.78,2.3),.03,Math.min(fd*.7,1.9),MAT.rug,0,.06,-.12));
  const cols=beds>=2?2:1;
  for(let i=0;i<beds;i++){
    const bed=makeBed();
    bed.name='home-bed';
    bed.position.set((i%cols-(cols-1)/2)*.88,0,-.2-Math.floor(i/cols)*1.15);
    g.add(bed);
  }
  const table=makeTable();
  table.name='home-table';
  table.position.set(Math.min(.65,(def?.size[0]||2)*.18),0,.32);
  g.add(table);
  g.visible=false;
  return g;
}

function ownMaterials(mesh){
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const cloned=list.map(m=>{const c=m.clone();c.transparent=true;c.opacity=1;c.depthWrite=true;return c;});
  mesh.material=Array.isArray(mesh.material)?cloned:cloned[0];
  return cloned;
}

function localBox(root,meshes){
  const box=new THREE.Box3(),inv=new THREE.Matrix4(),v=new THREE.Vector3();
  root.updateWorldMatrix(true,true);inv.copy(root.matrixWorld).invert();
  for(const mesh of meshes){
    const pos=mesh.geometry?.attributes?.position;if(!pos) continue;
    mesh.updateWorldMatrix(true,false);
    const m=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);box.expandByPoint(v);}
  }
  return box;
}

function isDoor(o){
  if(!o.isMesh) return false;
  return o.userData.semantic_part==='door'||/door/i.test(o.name||'');
}

/** Roof pieces, or the tent canvas when a home has no roof phase. */
function collectCovers(root,kind,doors){
  const skip=new Set(doors),roofs=[];
  root.traverse(o=>{if(o.isMesh&&!skip.has(o)&&o.userData.assembly_phase==='roof') roofs.push(o);});
  if(roofs.length) return roofs.map(mesh=>({mesh,lift:1.2}));
  if(kind!=='tent') return [];
  const bodies=[];
  root.traverse(o=>{
    if(!o.isMesh||skip.has(o)||o.userData.assembly_phase!=='body') return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if(o.geometry.boundingBox.max.y>1.05) bodies.push(o);
  });
  return bodies.map(mesh=>({mesh,lift:.7}));
}

/**
 * Prepares one placed home: hinge its door (or add a plank door), remember roof/canvas pieces, and parent a hidden interior.
 * Returns a rig with setOpen(0..1).
 */
export function rigHome(root,kind){
  const doors=[];
  root.traverse(o=>{if(isDoor(o)) doors.push(o);});
  const covers=collectCovers(root,kind,doors).map(c=>({...c,baseY:c.mesh.position.y,mats:ownMaterials(c.mesh)}));
  let hinge,doorZ;
  if(doors.length){
    const box=localBox(root,doors);
    doorZ=(box.min.z+box.max.z)/2;
    hinge=new THREE.Group();hinge.name='home-door-hinge';
    root.add(hinge);hinge.position.set(box.min.x,0,doorZ);hinge.updateWorldMatrix(true,false);
    for(const mesh of doors) hinge.attach(mesh);
  }else{
    const made=plankDoor(kind);hinge=made.hinge;doorZ=made.doorZ;root.add(hinge);
    const id=root.userData.buildingId;
    hinge.traverse(o=>{if(o.isMesh) o.userData.buildingId=id;});
  }
  hinge.userData.homeDoor=true;
  const interior=furnish(kind);root.add(interior);
  const rig={kind,hinge,doorZ,covers,interior,setOpen(amount){
    const a=THREE.MathUtils.clamp(amount,0,1);
    hinge.rotation.y=a*DOOR_SWING;
    for(const c of covers){
      c.mesh.position.y=c.baseY+a*c.lift;
      const opacity=1-.85*a;
      for(const m of c.mats){m.opacity=opacity;m.transparent=opacity<.99;m.depthWrite=opacity>.82;m.needsUpdate=true;}
    }
    interior.visible=a>.12;
  }};
  return rig;
}
