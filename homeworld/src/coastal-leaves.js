import * as THREE from 'three';

const rng = seed => () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const up = new THREE.Vector3(0,1,0);

// Leaves are folded, pointed meshes, not transparent cards. Each species keeps
// its existing instanced batches, positions, trunk, fruit and growth transforms.
export function makeLeafCanopy(source, kind) {
  source.computeBoundingBox();
  const box=source.boundingBox, center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3()), rnd=rng(571+kind.length*127);
  const positions=[], colors=[];
  const tri=(a,b,c,shade)=>{
    for(const p of [a,b,c])positions.push(p.x,p.y,p.z);
    for(const f of [1,.92,1.04])colors.push(shade*f,shade*f,shade*f);
  };
  // A raised central vein and six broad edge facets make leaves readable at
  // the ordinary play distance without adding a separate draw call per leaf.
  const leaf=(base,axis,normal,length,width,shade)=>{
    const z=axis.clone().normalize(), x=new THREE.Vector3().crossVectors(normal,z).normalize();
    const y=new THREE.Vector3().crossVectors(z,x).normalize();
    const point=(a,b,c)=>base.clone().addScaledVector(x,a*width).addScaledVector(y,b*length).addScaledVector(z,c*length);
    const edge=[point(0,0,0),point(-.36,0,.22),point(-.5,0,.52),point(-.29,-.025,.80),point(0,-.05,1),point(.29,-.025,.80),point(.5,0,.52),point(.36,0,.22)];
    const ridge=point(0,.11,.48);
    for(let i=0;i<8;i++)tri(edge[i],edge[(i+1)%8],ridge,shade*(i<4?.87:1.07));
  };
  if(kind==='Palm') {
    const crown=new THREE.Vector3(center.x,box.max.y-.27,center.z);
    const radius=Math.max(size.x,size.z)*.45;
    for(let f=0;f<9;f++){
      const a=f*Math.PI*2/9+.16, radial=new THREE.Vector3(Math.cos(a),0,Math.sin(a));
      const side=new THREE.Vector3(-radial.z,0,radial.x), reach=radius*(.88+rnd()*.15);
      const at=t=>crown.clone().addScaledVector(radial,reach*t).addScaledVector(up,Math.sin(t*Math.PI)*.32-t*t*.52);
      for(let j=0;j<13;j++){
        const t=j/13, p=at(t), next=at((j+1)/13);
        leaf(p,next.clone().sub(p),up,p.distanceTo(next)*1.15,.035,.73);
        if(j<2)continue;
        for(const s of [-1,1]){
          const direction=side.clone().multiplyScalar(s).addScaledVector(radial,.4).addScaledVector(up,-.28-t*.45);
          const length=(.17+Math.sin(t*Math.PI)*.45)*(reach/1.65);
          leaf(p,direction,up,length,.11*(1-t*.45),.7+rnd()*.4);
        }
      }
    }
  } else {
    const p=source.attributes.position, idx=source.index;
    const triangleCount=(idx?idx.count:p.count)/3, areas=[], faces=[];
    let total=0;
    for(let t=0;t<triangleCount;t++){
      const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(t*3+j):t*3+j));
      const cross=new THREE.Vector3().crossVectors(vertices[1].clone().sub(vertices[0]),vertices[2].clone().sub(vertices[0]));
      const area=cross.length()/2;if(area<1e-7)continue;
      total+=area;areas.push(total);faces.push({vertices,normal:cross.normalize()});
    }
    const pine=kind.startsWith('Pine');
    // The hidden backing needs only a small silhouette mesh, not thousands
    // of the original crown's triangles beneath an opaque layer of leaves.
    const core=pine?new THREE.ConeGeometry(1,2,10):new THREE.SphereGeometry(1,10,7);
    core.scale(size.x*.39,size.y*.43,size.z*.39);core.translate(center.x,center.y,center.z);
    const cp=core.attributes.position,ci=core.index;
    for(let i=0;i<ci.count;i+=3)tri(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(cp,ci.getX(i+j))),.55);
    core.dispose();
    const count=Math.min(pine?420:750,Math.max(180,Math.round(total*(pine?28:22))));
    for(let i=0;i<count;i++){
      const pick=rnd()*total;let lo=0,hi=areas.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<pick)lo=mid+1;else hi=mid;}
      const {vertices:[a,b,c],normal}=faces[lo];
      const u=Math.sqrt(rnd()),v=rnd();
      const base=a.clone().multiplyScalar(1-u).addScaledVector(b,u*(1-v)).addScaledVector(c,u*v);
      const n=normal.clone().addScaledVector(up,.4).normalize();
      const tangent=new THREE.Vector3().crossVectors(Math.abs(n.y)>.95?new THREE.Vector3(1,0,0):up,n).normalize();
      tangent.applyAxisAngle(n,rnd()*Math.PI*2);
      const length=pine?.32+rnd()*.22:.43+rnd()*.28;
      base.addScaledVector(normal,.025).addScaledVector(tangent,-length*.3);
      leaf(base,tangent,n,length,length*(pine?.33:.58),.63+rnd()*.55);
    }
  }
  const result=new THREE.BufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();
  result.userData.coastalTriangleCount=positions.length/9;
  return result;
}

export class LeafyTrees {
  constructor(game){
    this.game=game;this.variants=new Map();this.originals=new Map();this.materials=new Map();
    for(const [id,root] of Object.entries(game.library))if(/^(tree_|treegrowth_)/.test(id))root.traverse(mesh=>{
      if(!mesh.isMesh||Array.isArray(mesh.material))return;
      const match=mesh.material.name.match(/SoftTree_(Oak|Maple|Apple|Palm|Pine|PineMid|PineTop)$/);
      if(!match)return;
      const original=mesh.geometry;if(this.variants.has(original))return;
      const kind=match[1],geometry=makeLeafCanopy(original,kind);
      let material=this.materials.get(mesh.material);
      if(!material){
        material=mesh.material.clone();material.name+=' Coastal leaves';
        const palette={Oak:'#73ab39',Maple:'#91b449',Apple:'#58a844',Palm:'#63a64a',Pine:'#47884a',PineMid:'#629945',PineTop:'#81ac4d'};
        material.color.set(palette[kind]);material.vertexColors=true;material.side=THREE.DoubleSide;material.roughness=.92;
        this.materials.set(mesh.material,material);
      }
      const record={original,originalMaterial:mesh.material,geometry,material};
      this.variants.set(original,record);this.originals.set(geometry,record);
    });
  }
  setEnabled(enabled){
    const swap=mesh=>{
      if(!mesh.isMesh)return;
      const r=this.variants.get(mesh.geometry)||this.originals.get(mesh.geometry);if(!r)return;
      mesh.geometry=enabled?r.geometry:r.original;mesh.material=enabled?r.material:r.originalMaterial;
      if(mesh.isInstancedMesh)mesh.computeBoundingSphere();
    };
    for(const [id,root] of Object.entries(this.game.library))if(/^(tree_|treegrowth_)/.test(id))root.traverse(swap);
    this.game.scene.traverse(swap);
  }
  dispose(){
    this.setEnabled(false);
    for(const r of this.variants.values())r.geometry.dispose();
    for(const material of this.materials.values())material.dispose();
  }
}
