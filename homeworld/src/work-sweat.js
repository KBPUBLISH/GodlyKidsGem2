import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
/** Shared bead look: the same glossy light blue as the sweat drops in the energy flash (see .energy-fx-sweat). */
export function sweatMaterial(game){
 return game.particleMaterials.sweat??=new THREE.MeshStandardMaterial({color:'#8fdcff',emissive:'#3da7e6',emissiveIntensity:.35,roughness:.2,metalness:0});
}
/**
 * Working sweat: while a character is hammering/chopping, pop one little bead off their brow every ~0.5–0.9 s.
 * `timer` is any per-worker object (resident userData, community helper, the player's action) that keeps `sweatAt`.
 * Beads join the shared particle list, so they fall and fade exactly like wood chips and water splashes.
 * Always pushes to `game.particles` (the list is replaced every frame, so cached references go stale).
 */
export function emitWorkSweat(game,timer,bones,now=performance.now()){
 if(!game?.particles||!timer)return false;
 if(timer.sweatAt==null){timer.sweatAt=now+200+Math.random()*400;return false;}
 if(now<timer.sweatAt)return false;
 timer.sweatAt=now+500+Math.random()*400;
 const head=bones?.mixamorigHead;if(!head)return false;
 const side=Math.random()<.5?-1:1,p=head.getWorldPosition(V());
 const mesh=new THREE.Mesh(game.particleGeometry,sweatMaterial(game));
 mesh.position.copy(p).add(V(side*(.06+Math.random()*.06),.08+Math.random()*.08,(Math.random()-.5)*.14));
 mesh.scale.setScalar(1.2+Math.random()*.6);game.scene.add(mesh);
 game.particles.push({mesh,life:.7,v:V(side*(.5+Math.random()*.5),1.1+Math.random()*.5,(Math.random()-.5)*.5)});
 return true;
}
