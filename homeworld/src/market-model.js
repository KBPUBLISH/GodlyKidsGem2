// Procedural Market: two timber stalls side by side under one red-and-cream striped awning, with
// counters, crates and baskets of island food, and a little sign post by the front corner. Until a
// Blender model ships, these are the `building_market_{foundation,frame,complete}` prototypes.
// Local axes match the catalogue: x runs along the stalls (5 m side), +z is the front (workPoint side).
import * as THREE from 'three';
const MAT={
  slab:new THREE.MeshStandardMaterial({color:'#6f6a60',roughness:.95,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
  stone:new THREE.MeshStandardMaterial({color:'#8d8a80',roughness:.95}),
  wood:new THREE.MeshStandardMaterial({color:'#9a6b3c',roughness:.85}),
  woodDark:new THREE.MeshStandardMaterial({color:'#74502c',roughness:.85}),
  plank:new THREE.MeshStandardMaterial({color:'#b98853',roughness:.9}),
  crate:new THREE.MeshStandardMaterial({color:'#c99a5a',roughness:.9}),
  stripeRed:new THREE.MeshStandardMaterial({color:'#d9433a',roughness:.9}),
  stripeCream:new THREE.MeshStandardMaterial({color:'#f6efe0',roughness:.9}),
  basket:new THREE.MeshStandardMaterial({color:'#b48a4a',roughness:1}),
  apple:new THREE.MeshStandardMaterial({color:'#e2503a',roughness:.6}),
  carrot:new THREE.MeshStandardMaterial({color:'#f08a2a',roughness:.7}),
  pumpkin:new THREE.MeshStandardMaterial({color:'#e8912c',roughness:.75}),
  wheat:new THREE.MeshStandardMaterial({color:'#e9c364',roughness:.9}),
  fish:new THREE.MeshStandardMaterial({color:'#6fb3c9',roughness:.5,metalness:.1}),
  sign:new THREE.MeshStandardMaterial({color:'#f3e2b4',roughness:.9}),
  rope:new THREE.MeshStandardMaterial({color:'#8a7349',roughness:1}),
};
const POSTS=[-2.2,0,2.2].flatMap(x=>[[x,-1.6],[x,1.4]]);
const COUNTER_Y=.95;
function mesh(geometry,material,phase){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;if(phase)m.userData.assembly_phase=phase;return m;}
function foundation(){
  const g=new THREE.Group();
  const slab=mesh(new THREE.BoxGeometry(4.9,.14,3.9),MAT.slab);slab.position.y=.07;g.add(slab);
  for(const [x,z] of POSTS){const plinth=mesh(new THREE.BoxGeometry(.42,.26,.42),MAT.stone);plinth.position.set(x,.27,z);g.add(plinth);}
  const floor=mesh(new THREE.BoxGeometry(4.6,.08,3.5),MAT.plank);floor.position.y=.18;g.add(floor);
  return g;
}
function frame(){
  const g=foundation();
  for(const [x,z] of POSTS){const post=mesh(new THREE.BoxGeometry(.2,2.5,.2),MAT.woodDark);post.position.set(x,.4+1.25,z);g.add(post);}
  for(const z of [-1.6,1.4]){const beam=mesh(new THREE.BoxGeometry(4.8,.18,.22),MAT.wood);beam.position.set(0,2.75,z);g.add(beam);}
  for(const x of [-2.2,0,2.2]){const tie=mesh(new THREE.BoxGeometry(.18,.16,3.2),MAT.wood);tie.position.set(x,2.75,-.1);g.add(tie);}
  // Two counters, one per stall, split by the middle posts.
  for(const x of [-1.15,1.15]){
    const top=mesh(new THREE.BoxGeometry(1.9,.1,.8),MAT.wood);top.position.set(x,COUNTER_Y,.75);g.add(top);
    const front=mesh(new THREE.BoxGeometry(1.9,COUNTER_Y-.3,.08),MAT.plank);front.position.set(x,.22+(COUNTER_Y-.3)/2,1.12);g.add(front);
    for(const dx of [-.85,.85]){const leg=mesh(new THREE.BoxGeometry(.1,COUNTER_Y-.3,.7),MAT.woodDark);leg.position.set(x+dx,.22+(COUNTER_Y-.3)/2,.75);g.add(leg);}
  }
  return g;
}
function crate(x,z,material,y=.22){
  const g=new THREE.Group();g.position.set(x,y,z);
  const box=mesh(new THREE.BoxGeometry(.55,.4,.55),MAT.crate,'body');box.position.y=.2;g.add(box);
  for(const s of [-1,1]){const slat=mesh(new THREE.BoxGeometry(.57,.05,.57),MAT.woodDark,'body');slat.position.y=.2+s*.15;g.add(slat);}
  const fill=mesh(new THREE.BoxGeometry(.46,.1,.46),material,'body');fill.position.y=.43;g.add(fill);
  for(let i=0;i<4;i++){const ball=mesh(new THREE.SphereGeometry(.09,8,6),material,'body');ball.position.set((i%2?.12:-.12),.5,(i<2?.12:-.12));g.add(ball);}
  return g;
}
function basket(x,z,y,material,count=5){
  const g=new THREE.Group();g.position.set(x,y,z);
  const bowl=mesh(new THREE.CylinderGeometry(.24,.17,.18,12,1,true),MAT.basket,'body');bowl.material.side=THREE.DoubleSide;bowl.position.y=.09;g.add(bowl);
  const base=mesh(new THREE.CylinderGeometry(.17,.17,.02,12),MAT.basket,'body');base.position.y=.01;g.add(base);
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,ball=mesh(new THREE.SphereGeometry(.07,8,6),material,'body');ball.position.set(Math.cos(a)*.11,.2,Math.sin(a)*.11);g.add(ball);}
  const top=mesh(new THREE.SphereGeometry(.07,8,6),material,'body');top.position.y=.27;g.add(top);
  return g;
}
function complete(){
  const g=frame();
  // Striped awning: a gentle slope from the back beam (high, under the ridge) down over the front lip, in alternating red and cream strips.
  // Positive x-rotation lowers +z (the front), so the scallops hang from the low front edge and the ridge sits on the high back edge.
  const pitch=.28,strips=10,width=5.2/strips;
  for(let i=0;i<strips;i++){
    const strip=mesh(new THREE.BoxGeometry(width+.01,.07,3.9),i%2?MAT.stripeCream:MAT.stripeRed,'roof');
    strip.position.set(-2.6+width*(i+.5),3.15,.1);strip.rotation.x=pitch;g.add(strip);
  }
  // Scalloped front edge: little blocks hanging below the awning lip.
  for(let i=0;i<strips;i++){const tab=mesh(new THREE.BoxGeometry(width-.08,.22,.07),i%2?MAT.stripeCream:MAT.stripeRed,'roof');tab.position.set(-2.6+width*(i+.5),2.55,2.05);g.add(tab);}
  const ridge=mesh(new THREE.BoxGeometry(5.3,.1,.16),MAT.woodDark,'roof');ridge.position.set(0,3.75,-1.85);g.add(ridge);
  // Stall goods: baskets on the counters, crates on the floor.
  g.add(basket(-1.7,.75,COUNTER_Y+.05,MAT.apple));
  g.add(basket(-.95,.6,COUNTER_Y+.05,MAT.carrot,6));
  g.add(basket(.75,.7,COUNTER_Y+.05,MAT.wheat,7));
  g.add(basket(1.6,.6,COUNTER_Y+.05,MAT.fish,4));
  g.add(crate(-1.9,-.9,MAT.pumpkin));
  g.add(crate(-1.3,-.9,MAT.apple));
  g.add(crate(1.6,-.95,MAT.carrot));
  g.add(crate(1.6,-.95,MAT.wheat,.62));
  const barrel=mesh(new THREE.CylinderGeometry(.3,.26,.7,12),MAT.woodDark,'body');barrel.position.set(.2,.57,-1.0);g.add(barrel);
  for(const y of [.35,.78]){const hoop=mesh(new THREE.TorusGeometry(.3,.02,6,16),MAT.rope,'body');hoop.rotation.x=Math.PI/2;hoop.position.set(.2,y,-1.0);g.add(hoop);}
  // Sign post by the front-right corner with a hanging board.
  const post=mesh(new THREE.BoxGeometry(.12,2.0,.12),MAT.woodDark,'body');post.position.set(2.35,.22+1.0,1.85);g.add(post);
  const arm=mesh(new THREE.BoxGeometry(.6,.08,.1),MAT.woodDark,'body');arm.position.set(2.1,2.15,1.85);g.add(arm);
  const board=mesh(new THREE.BoxGeometry(.5,.3,.05),MAT.sign,'body');board.position.set(2.0,1.9,1.85);g.add(board);
  const appleSign=mesh(new THREE.SphereGeometry(.08,8,6),MAT.apple,'body');appleSign.position.set(2.0,1.9,1.89);g.add(appleSign);
  for(const dx of [-.15,.15]){const string=mesh(new THREE.CylinderGeometry(.01,.01,.12,4),MAT.rope,'body');string.position.set(2.0+dx,2.08,1.85);g.add(string);}
  return g;
}
/** Adds the market prototypes to a world asset library (id → Object3D). Existing entries (a real model) win. */
export function registerMarketAssets(library){
  const stages={foundation,frame,complete};
  for(const [stage,build] of Object.entries(stages)){
    const id=`building_market_${stage}`;if(library[id])continue;
    const root=build();root.name=id;root.userData.game_asset_id=id;root.userData.prototype=true;library[id]=root;
  }
}
