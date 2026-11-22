// All counters are outside the open central aisle. Routes stay in that aisle
// until the chef reaches the front of the chosen counter.
export const KITCHEN_STATIONS = [
 {id:'pantry',name:'Pantry',verb:'Choose a recipe',icon:'🥕',x:-4.35,z:-2,standZ:-.35},
 {id:'prep',name:'Chop & prep',verb:'Prepare your ingredients',icon:'🔪',x:-1.45,z:-2,standZ:-.35},
 {id:'pot',name:'Mix & simmer',verb:'Stir something lovely',icon:'🥣',x:1.45,z:-2,standZ:-.35},
 {id:'oven',name:'Bake',verb:'Bake until golden',icon:'🍞',x:4.35,z:-2,standZ:-.35},
 {id:'serve',name:'Serve',verb:'Enjoy or share your meal',icon:'🍽️',x:3.65,z:2.65,standZ:1.1},
];
export function kitchenRoute(position,id){
 const station=KITCHEN_STATIONS.find(s=>s.id===id);if(!station)return [];
 return [{x:position.x,z:.8},{x:station.x,z:.8},{x:station.x,z:station.standZ}];
}
export function kitchenNextStation(session,recipe,ready=false){
 if(!session)return 'pantry';
 if(session.phase==='collected'||ready)return 'serve';
 if(session.phase==='cooking')return recipe?.steps.at(-1)?.station||'pot';
 return recipe?.steps[session.step]?.station||'prep';
}
export function kitchenCanWork(station,moving,session,recipe,ready=false){
 return !moving&&station===kitchenNextStation(session,recipe,ready);
}
