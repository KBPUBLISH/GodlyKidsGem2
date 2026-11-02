import * as THREE from 'three';
/** Shared lightweight prototypes; normal crop rendering and harvest animations reuse them. */
export function registerPotatoAssets(library){
 const leaf=new THREE.MeshStandardMaterial({color:'#659746',roughness:.9}),skin=new THREE.MeshStandardMaterial({color:'#b68b53',roughness:1});
 for(const [stage,size]of [['seedling',.35],['growing',.65],['ready',1]]){
  const root=new THREE.Group();
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,m=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),leaf);m.scale.set(.13*size,.22*size,.09*size);m.position.set(Math.cos(a)*.15*size,.17*size,Math.sin(a)*.15*size);m.rotation.z=Math.cos(a)*.6;root.add(m);}
  if(stage==='ready')for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),skin);m.scale.set(.12,.07,.08);m.position.set((i-1)*.16,.06,.21);root.add(m);}
  library[`crop_potato_${stage}`]=root;
 }
}
