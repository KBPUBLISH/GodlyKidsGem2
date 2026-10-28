// Farm and wild animals the kid can place on the island. Pure data + save-state helpers (no three.js).
// Each GLB is a single rig in real-world metres, Y-up, with its own CRT_<id>_Idle / move clip.
// Resolves to /homeworld/assets/animals/<id>.glb. Built from segments on purpose: the publish step rewrites
// the literal "/assets/" to "/homeworld/assets/" inside the bundle, and this URL must not be rewritten twice.
const url=id=>['/homeworld','assets','animals',`${id}.glb`].join('/')+`?v=${typeof __HW_BUILD__!=='undefined'?__HW_BUILD__:'dev'}`;
export const ANIMALS=[
  {id:'chicken',name:'Chicken',emoji:'🐔',url:url('chicken'),idle:'CRT_chicken_Idle',move:'CRT_chicken_Walk',speed:.5,wander:3,scale:1},
  {id:'cow',name:'Cow',emoji:'🐄',url:url('cow'),idle:'CRT_cow_Idle',move:'CRT_cow_Walk',speed:.7,wander:4,scale:1},
  {id:'coyote',name:'Coyote',emoji:'🐺',url:url('coyote'),idle:'CRT_coyote_Idle',move:'CRT_coyote_Walk',speed:1,wander:5,scale:1},
  {id:'crow',name:'Crow',emoji:'🐦‍⬛',url:url('crow'),idle:'CRT_crow_Idle',move:'CRT_crow_Walk',fly:'CRT_crow_Fly',speed:.8,flySpeed:2.2,wander:4,scale:1},
  {id:'dog_hound',name:'Hound',emoji:'🐕',url:url('dog_hound'),idle:'CRT_dog_hound_Idle',move:'CRT_dog_hound_Walk',speed:.9,wander:5,scale:1},
  {id:'dog_shepherd',name:'Shepherd dog',emoji:'🐕‍🦺',url:url('dog_shepherd'),idle:'CRT_dog_shepherd_Idle',move:'CRT_dog_shepherd_Walk',speed:.9,wander:5,scale:1},
  {id:'dog_terrier',name:'Terrier',emoji:'🐶',url:url('dog_terrier'),idle:'CRT_dog_terrier_Idle',move:'CRT_dog_terrier_Walk',speed:.8,wander:4,scale:1},
  {id:'donkey',name:'Donkey',emoji:'🫏',url:url('donkey'),idle:'CRT_donkey_Idle',move:'CRT_donkey_Walk',speed:.8,wander:4,scale:1},
  {id:'goat',name:'Goat',emoji:'🐐',url:url('goat'),idle:'CRT_goat_Idle',move:'CRT_goat_Walk',speed:.8,wander:4,scale:1},
  {id:'horse',name:'Horse',emoji:'🐴',url:url('horse'),idle:'CRT_horse_Idle',move:'CRT_horse_Walk',speed:1.2,wander:5,scale:1},
  {id:'rabbit',name:'Rabbit',emoji:'🐰',url:url('rabbit'),idle:'CRT_rabbit_Idle',move:'CRT_rabbit_Hop',speed:1.1,wander:3,scale:1},
  {id:'sheep',name:'Sheep',emoji:'🐑',url:url('sheep'),idle:'CRT_sheep_Idle',move:'CRT_sheep_Walk',speed:.6,wander:4,scale:1},
  {id:'snake',name:'Snake',emoji:'🐍',url:url('snake'),idle:'CRT_snake_Idle',move:'CRT_snake_Slither',speed:.4,wander:3,scale:1},
  {id:'squirrel',name:'Squirrel',emoji:'🐿️',url:url('squirrel'),idle:'CRT_squirrel_Idle',move:'CRT_squirrel_Walk',speed:.9,wander:4,scale:1},
];
export const MAX_ANIMALS=40;
export const animalById=id=>ANIMALS.find(a=>a.id===id);
/** Saved animals: `state.animals = [{id, kind, x, y, placedAt}]`. Undefined (old saves) is fine. */
export function validAnimals(value){
  if(value===undefined)return true;if(!Array.isArray(value)||value.length>500)return false;
  const ids=new Set();
  return value.every(a=>{
    if(!a||typeof a.id!=='string'||!a.id||a.id.length>128||ids.has(a.id)||!animalById(a.kind)||!Number.isFinite(a.x)||!Number.isFinite(a.y))return false;
    if(a.placedAt!==undefined&&!Number.isFinite(a.placedAt))return false;
    ids.add(a.id);return true;
  });
}
/** Placement rules shared by the save logic and the island UI. `terrain(x,y)` is core's terrainType; `footprints` are building bounds. */
export function animalSiteStatus(state,plan,{terrain,footprints,pointInBounds}){
  const def=animalById(plan?.kind);if(!def)return {ok:false,reason:'Choose an animal first.'};
  if(!Number.isFinite(plan.x)||!Number.isFinite(plan.y))return {ok:false,reason:'Tap the ground to choose a spot.'};
  if((state.animals||[]).length>=MAX_ANIMALS)return {ok:false,reason:'The island is full of animals! Send one home first.'};
  if(terrain(plan.x,plan.y)===0)return {ok:false,reason:`${def.name}s cannot stand in the water. Tap grass instead.`};
  if(footprints.some(b=>pointInBounds(plan,b,.25)))return {ok:false,reason:'A building is already there. Tap open grass instead.'};
  return {ok:true,reason:`${def.name} placed!`,def};
}
