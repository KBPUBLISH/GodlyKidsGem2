// The render model, player and chickens share the same raised floor and stair surface.
export function coopSurfaceHeight(center,x,y){
 if(!center)return null;const dx=x-center.x,z=center.y-y;
 if(Math.abs(dx)<=.92&&Math.abs(z)<=.65)return .4;
 if(Math.abs(dx)<=.38&&z>=.65&&z<=1.75)return Math.max(0,Math.min(.4,(1.75-z)/1.1*.4));
 return null;
}
export function eggSlots(animal){
 const slots=animal.eggSlots;
 return Array.isArray(slots)&&slots.length===animal.ready&&new Set(slots).size===slots.length&&slots.every(i=>Number.isInteger(i)&&i>=0&&i<3)?slots:Array.from({length:animal.ready},(_,i)=>i);
}
