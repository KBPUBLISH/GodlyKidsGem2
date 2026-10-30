// Toy-block meshes for Adam's farm buildables (farm-rules.mjs FARM_BUILDINGS): a water trough and a feed pile.
// Same style as the stable/scarecrow in fencing.mjs: flat, non-metallic, one group per build stage.
import * as THREE from 'three';

const mat=(color,rough=.9)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:0});
function piece(geo,material,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}

/** A 2×1 wooden trough on two trestles, water inside. */
function trough(){
  const g=new THREE.Group(),wood=mat('#9c6a3c'),dark=mat('#6b4426'),water=new THREE.MeshStandardMaterial({color:'#6cc4d8',roughness:.25,metalness:0,transparent:true,opacity:.85});
  const W=1.8,D=.7,H=.42,T=.07;
  g.add(piece(new THREE.BoxGeometry(W,T,D),wood,0,.26,0));
  g.add(piece(new THREE.BoxGeometry(W,H,T),wood,0,.26+H/2,-D/2+T/2));
  g.add(piece(new THREE.BoxGeometry(W,H,T),wood,0,.26+H/2,D/2-T/2));
  g.add(piece(new THREE.BoxGeometry(T,H,D),wood,-W/2+T/2,.26+H/2,0));
  g.add(piece(new THREE.BoxGeometry(T,H,D),wood,W/2-T/2,.26+H/2,0));
  for(const x of [-.6,.6]){g.add(piece(new THREE.BoxGeometry(.1,.3,.6),dark,x,.15,0));}
  const pool=piece(new THREE.BoxGeometry(W-2*T-.02,.04,D-2*T-.02),water,0,.26+H-.1,0);pool.castShadow=false;g.add(pool);
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}
/** A hay mound with a few grain sacks leaning on it. */
function feedPile(){
  const g=new THREE.Group(),hay=mat('#dcb75a',.95),hay2=mat('#c9a04a',.95),sack=mat('#c7a98a',.9),tie=mat('#6b4426');
  const mound=piece(new THREE.SphereGeometry(.42,12,10),hay,0,.3,0);mound.scale.set(1,.7,1);g.add(mound);
  const mound2=piece(new THREE.SphereGeometry(.3,10,8),hay2,.22,.26,.16);mound2.scale.set(1,.7,1);g.add(mound2);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const straw=piece(new THREE.BoxGeometry(.04,.04,.5),hay2,Math.cos(a)*.32,.14,Math.sin(a)*.32);straw.rotation.y=-a;straw.rotation.z=.3;g.add(straw);}
  const s=piece(new THREE.CylinderGeometry(.15,.17,.42,10),sack,-.3,.22,-.22);s.rotation.z=.25;g.add(s);
  g.add(piece(new THREE.TorusGeometry(.1,.025,6,12),tie,-.34,.42,-.22));
  g.traverse(o=>{o.frustumCulled=false;});
  return g;
}

/** Register `building_<kind>_<stage>` meshes unless a real library model already exists. */
export function registerFarmBrainAssets(library){
  const kinds={trough,feed_pile:feedPile};
  for(const [kind,build] of Object.entries(kinds)){
    for(const stage of ['foundation','frame','complete']){
      const id=`building_${kind}_${stage}`;
      if(library[id])continue;
      const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
    }
  }
}
