import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Low-poly timber coop. Batched by material to keep the island cheap to render. */
export function createCoopModel(level){
 const root=new THREE.Group();root.name='Chicken coop';if(!level)return root;
 const palette={wood:'#c99856',plank:'#e0b774',trim:'#83552f',roof:'#b94d31',tile:'#d96a42',dark:'#493629',straw:'#dbb766',iron:'#657074',leaf:'#6e9546'};
 const parts=new Map(),w=level===1?1.75:2.3,eave=level===1?1.18:1.34,rise=level===1?.52:.63;
 function add(geo,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,step=false){if(geo.index){const indexed=geo;geo=geo.toNonIndexed();indexed.dispose();}const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));geo.applyMatrix4(matrix);const key=color+(step?':step':'');if(!parts.has(key))parts.set(key,[]);parts.get(key).push(geo);}
 const box=(a,b,c,color,x,y,z,rx=0,ry=0,rz=0,step=false)=>add(new THREE.BoxGeometry(a,b,c),color,x,y,z,rx,ry,rz,step);
 const beam=(a,b,thickness,color)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end),geo=new THREE.BoxGeometry(thickness,length,thickness);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));const mid=start.add(end).multiplyScalar(.5);add(geo,color,mid.x,mid.y,mid.z);};
 // The raised deck and six steps match coopSurfaceHeight exactly.
 box(w+.12,.1,1.3,'trim',0,.35,0);
 for(let i=0;i<8;i++)box((w+.1)/8-.012,.035,1.28,'plank',-w/2+(i+.5)*(w+.1)/8,.397,0);
 for(const x of [-w/2+.08,w/2-.08])for(const z of [-.47,.47]){box(.14,.4,.14,'trim',x,.2,z);box(.18,.08,.18,'iron',x,.10,z);}
 // Planked walls leave a real open doorway at the top of the ramp.
 for(let j=0;j<5;j++){
  const y=.46+j*(eave-.43)/5,h=(eave-.43)/5-.012;
  box(w,h,.08,j%2?'wood':'plank',0,y,-.47);
  for(const sign of [-1,1]){
   box(.08,h,.88,j%2?'plank':'wood',sign*w/2,y,0);
   box((w-.62)/2,h,.08,j%2?'wood':'plank',sign*(w+.62)/4,y,.47);
  }
 }
 box(.62,.17,.08,'wood',0,eave-.04,.47);
 for(const x of [-w/2,w/2]){box(.12,eave-.36,.13,'trim',x,(eave+.36)/2,.49);box(.12,eave-.36,.13,'trim',x,(eave+.36)/2,-.49);}
 for(const x of [-.34,.34])box(.1,eave-.5,.13,'plank',x,(eave+.3)/2,.52);
 box(.78,.11,.14,'trim',0,eave-.13,.52);
 // Solid triangular gables, diagonal braces, and layered terracotta shingles.
 const gable=new THREE.Shape();gable.moveTo(-w/2,0);gable.lineTo(w/2,0);gable.lineTo(0,rise);gable.closePath();
 for(const z of [-.5,.46]){add(new THREE.ExtrudeGeometry(gable,{depth:.04,bevelEnabled:false}), 'wood',0,eave,z);for(const sign of [-1,1])beam([sign*w/2,eave,z+.05],[0,eave+rise,z+.05],.09,'plank');}
 const rw=w/2+.16,angle=Math.atan2(rise,rw),slope=Math.hypot(rw,rise);
 for(const sign of [-1,1]){
  box(slope,.10,1.44,'roof',sign*rw/2,eave+rise/2,0,0,0,-sign*angle);
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
   const t=(row+.5)/3;box(slope/3+.035,.055,.278,(row+col)%3===0?'roof':'tile',sign*rw*t,eave+rise*(1-t)+.08,-.57+col*.285,0,0,-sign*angle);
  }
  for(const z of [-.75,.75])beam([0,eave+rise+.06,z],[sign*(rw+.03),eave+.02,z],.12,'trim');
 }
 box(.16,.13,1.55,'tile',0,eave+rise+.11,0);
 for(const z of [-.79,.79])box(.19,.18,.19,'plank',0,eave+rise+.13,z);
 // Side nesting boxes are distinct on the larger upgrade.
 for(const sign of (level===1?[1]:[-1,1])){
  const x=sign*(w/2+.14);box(.38,.11,.56,'trim',x,.48,0);box(.38,.24,.06,'wood',x,.63,-.25);box(.38,.24,.06,'wood',x,.63,.25);box(.38,.07,.56,'straw',x,.55,0);
  box(.45,.08,.64,'tile',x,.80,0,0,0,sign*.12);
  box(.07,.16,.56,'plank',sign*(w/2+.34),.59,0);
 }
 // An extra roof lantern makes the upgrade easy to recognize from the island camera.
 if(level===2){box(.38,.28,.35,'plank',0,eave+rise+.22,-.05);box(.21,.11,.02,'dark',0,eave+rise+.25,.135);for(const sign of [-1,1])box(.30,.06,.48,'tile',sign*.12,eave+rise+.43,-.05,0,0,-sign*.35);}
 for(let i=0;i<6;i++){
  const y=.4-(i+.5)*.4/6,z=.65+(i+.5)*1.1/6;
  box(.72,.065,1.1/6,'plank',0,y,z,0,0,0,true);
  box(.72,.025,.035,'trim',0,y+.038,z+.06,0,0,0,true);
 }
 // Open front entry stays clear of the walkable ramp.
 for(const x of [-1.65,1.65]){
  for(const z of [-1.1,-.35,.45,1.2]){box(.12,.68,.12,'trim',x,.34,z);box(.15,.07,.15,'plank',x,.70,z);}
  for(const y of [.23,.49])box(.075,.075,2.3,'wood',x,y,.05);
  beam([x,.18,-1.1],[x,.56,-.35],.05,'plank');beam([x,.18,.45],[x,.56,1.2],.05,'plank');
 }
 for(const y of [.23,.49])box(3.3,.075,.075,'wood',0,y,-1.1);
 for(const x of [-.55,.55]){box(.12,.66,.12,'trim',x,.33,1.2);for(const y of [.23,.49])box(1.1,.075,.075,'wood',Math.sign(x)*1.1,y,1.2);}
 for(const [key,geos] of parts){const color=key.split(':')[0],merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,new THREE.MeshStandardMaterial({color:palette[color],roughness:.88,flatShading:true}));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.coopStep=key.endsWith(':step');root.add(mesh);}
 return root;
}
