import {buildingById,woodTotal} from './building.mjs';
export const BAG_WOOD_CAPACITY=20;
export function woodStorage(state){
 const containers=[{id:'bag',name:'My bag',kind:'bag',capacity:BAG_WOOD_CAPACITY},...(state.buildings||[]).filter(b=>b.status==='complete'&&buildingById(b.kind)?.woodCapacity).map(b=>({id:b.id,name:buildingById(b.kind).name,kind:b.kind,capacity:buildingById(b.kind).woodCapacity}))];
 let left=woodTotal(state);for(const box of containers){box.used=Math.min(left,box.capacity);left-=box.used;}
 const total=woodTotal(state),capacity=containers.reduce((n,b)=>n+b.capacity,0);
 return {total,capacity,free:Math.max(0,capacity-total),overflow:Math.max(0,total-capacity),containers};
}
export const woodRoom=state=>woodStorage(state).free;
export function validWoodDrops(value,state,world){
 if(value===undefined)return true;if(!Array.isArray(value)||value.length>10000)return false;
 const ids=new Set(),items=new Set(Object.values(world.species||{}).map(s=>s.wood_item));
 return value.every(d=>{
  if(!d||typeof d.treeId!=='string'||d.treeId.length>140||d.id!==`wood:${d.treeId}`||ids.has(d.id)||!state.removedTrees.includes(d.treeId)||!items.has(d.item)||!Number.isInteger(d.quantity)||d.quantity<1||d.quantity>3||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
  ids.add(d.id);return d.x>=world.grid.origin[0]&&d.x<=world.grid.origin[0]+world.grid.columns&&d.y>=world.grid.origin[1]&&d.y<=world.grid.origin[1]+world.grid.rows;
 });
}
